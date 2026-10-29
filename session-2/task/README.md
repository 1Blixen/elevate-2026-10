# Session 2 — Streams and Workers

> Process a huge file without loading it into memory, and keep the main thread
> free while a worker does the CPU work.

## What you will do

| Task | What it proves |
| --- | --- |
| **1** | A stream processes data in chunks. Backpressure keeps memory flat. `pipeline` handles errors and waits for completion. |
| **2** | CPU-bound JavaScript belongs in a worker. `SharedArrayBuffer` shares data without a structured-clone copy, and a worker pool avoids repeated startup cost. |

**Suggested time:** 2–3 hours.

## Contents

- [Before you start](#before-you-start)
- [Rules](#rules)
- [Task 1 — Stream a huge file](#task-1--stream-a-huge-file)
- [Task 2 — Worker mean temperature](#task-2--worker-mean-temperature)
- [Submission](#submission)
- [Common traps](#common-traps)
- [References](#references)

## Before you start

- Node.js **22.18+** (or 24+). The examples use TypeScript with Node's built-in
  type stripping. Plain JavaScript is also fine.
- `pnpm` or `npm`.
- The examples in `session-2/code-example/`.

All paths in the tasks are relative to your submission folder,
`session-2/task/your-username/`, unless they start with `session-2/`.

### Data file

The large NDJSON file is not committed. It may already be at:

```text
session-2/code-example/src/streams/data/cities-00000.ndjson
```

If it is not there, or it is too slow to work with, generate a smaller file
(about 80 MB):

1. Open `session-2/code-example/src/streams/helper/generateHugeJson.ts`.
2. Change `const TOTAL = 100_000_000;` to `const TOTAL = 1_000_000;`.
3. Run:

   ```bash
   cd session-2/code-example/src/streams
   node helper/generateHugeJson.ts
   ```

4. Use the generated `data/cities-00000.ndjson`.

Revert the `TOTAL` change (or use a temporary copy) before committing. Your PR
should only touch `session-2/task/your-username/`.

Do not run the default 100M setting unless you have about 8 GB free. Do not
commit `.ndjson` or `.ndjson.gz` files.

**Note:** `src/streams/fastify.server.ts` is a separate Fastify/schema example.
You do not need it for these tasks.

## Rules

- Use `node:stream`, `node:stream/promises`, and `node:worker_threads`.
- Do not use an external stream or worker library.
- Task 1 must not use `readFile` or `readFileSync` on the large file.
- Task 2 starts from the existing worker code. Keep the `SharedArrayBuffer`
  path; explain your changes in `NOTES.md`.
- Do not edit `session-2/task/README.md`.
- Do not commit data files, `node_modules`, `.env`, or build output.

## Task 1 — Stream a huge file

### 1.1 Count and average

Write `src/streams/stream-stats.ts` (or `.mjs`).

- Read the NDJSON file as a stream.
- Print:
  - total rows
  - average temperature (one decimal place)
  - minimum temperature
  - maximum temperature
- Use `createReadStream` plus `readline` or a line-splitting `Transform`.
- Do not use `readFile` or `readFileSync`.
- Do not `JSON.parse` the whole file. Parse one line at a time.
- Print progress every 10%. Reuse the `StreamProgress` idea from `main.ts`.
- Make the input path configurable with an environment variable or a constant,
  so you can test on a small file.

Run it on the large file and save the output as `evidence/stream-stats.txt`.

### 1.2 Gzip with `pipeline`

Write `src/streams/stream-gzip.ts`.

- Use:

  ```ts
  await pipeline(
    createReadStream(input),
    createGzip(),
    createWriteStream(output),
  );
  ```

- Print `done` only after the pipeline finishes.
- Save the output as `evidence/stream-gzip.txt`, including the `done` line and
  an `ls -lh` of the input and output files.

Compare your version with `main-final.ts`:

- Why does it print `File written successfully` immediately, before the file is
  actually complete?
- What is the difference between waiting for `finish` and awaiting `pipeline`?

### 1.3 Explain

Answer in `NOTES.md`:

1. Why would `readFileInBulk()` run out of memory on an 8 GB file, while
   streaming does not?
2. What is backpressure? How does `once(stream, "drain")` in
   `generateHugeJson.ts` keep memory flat?
3. Why use `pipeline` instead of `.pipe()`? What does `.pipe()` do — and not
   do — on errors and completion?
4. In `main.ts`, why does the 5-second timeout not stop the gzip? What would you
   use instead to cancel the pipeline?

## Task 2 — Worker mean temperature

Start from the existing code in `session-2/code-example/src/workers/`:

- `main.ts`
- `mean-temperature-worker.ts`
- `helpers/citiesGen.ts`
- `helpers/cityToSharedArrayBuffer.ts`
- `helpers/sharedArrayBufferToCity.ts`

Copy what you need into your submission folder.

### 2.1 Run and explain

- Start the server.
- Add a `count` query parameter (default `1_000_000`) and use it in the
  endpoint.
- Call `GET /cities/mean-temperature?count=1000` and verify the result.
- Save the response as `evidence/worker-mean.txt`.

In `NOTES.md`, trace the data flow:

```text
request -> generate cities -> pack into SharedArrayBuffer -> worker
        -> compute mean -> postMessage back -> response
```

### 2.2 Add `/health`

Add `GET /health` that returns immediately:

```json
{ "ok": true }
```

Test it while a large request is running:

```bash
curl "http://localhost:3000/cities/mean-temperature?count=5000000"
```

In another terminal, call `/health` a few times and record the response times
in `evidence/worker-health.txt`.

`/health` must answer before the mean request finishes. If a health check is
slow, explain why. (Hint: what is still running on the main thread?)

### 2.3 Remove the object arrays

The current code creates objects twice:

1. `citiesGen(1_000_000)` builds one million `CityWeather` objects on the main
   thread.
2. `cityToSharedArrayBuffer` copies them into a `Float64Array`.
3. The worker calls `sharedArrayBufferToCity` and builds one million objects
   again.

Change it so:

- the main thread writes random city values **directly** into a `Float64Array`
  backed by a `SharedArrayBuffer`;
- the worker computes the sum **directly** from the `Float64Array`;
- no `CityWeather[]` is created on either side.

Keep passing the data as a `SharedArrayBuffer` view. Do not switch back to
`postMessage` with a plain array of objects.

### 2.4 Handle worker errors

- Add `error` and `exit` handlers to the worker.
- If a worker dies, remove it from the pool.
- Pending requests for that worker must not hang. Respond with an error or
  reject them.
- The next request should create a replacement worker.

### 2.5 Explain

Answer in `NOTES.md`:

1. Why is computing the mean temperature CPU-bound work that belongs in a
   worker? Connect this to the event loop from Session 1.
2. What does `postMessage` do by default? Why is structured-cloning one million
   objects expensive? How does `SharedArrayBuffer` avoid that copy?
3. What is the difference between sharing (`SharedArrayBuffer`) and transferring
   (`transferList`)? When would you use each?
4. Why use a pool of workers instead of `new Worker()` for every request? The
   existing code uses `MAX_ALLOWED_WORKERS = 1`; what changes if you raise it?
5. What still runs on the main thread in your solution? What would you move
   next?
6. What happens to pending requests if a worker throws? How did you handle it?

## Submission

Submit your work as a **pull request** to the course repository:

**Repository:** <https://github.com/mostafaroshdy1/elevate-2026-10>

### 1. Create a branch

Start from `main` and create a branch named after yourself:

```bash
git checkout main
git pull
git checkout -b session-2/your-username
```

Replace `your-username` with your GitHub username.

If you do not have write access to the repository, fork it first, clone your
fork, and create the branch there.

### 2. Add your work

Put everything under:

```text
session-2/task/your-username/
  NOTES.md
  package.json
  tsconfig.json
  src/
    streams/
      stream-stats.ts
      stream-gzip.ts
    workers/
      main.ts
      mean-temperature-worker.ts
      helpers/
        ...
  evidence/
    stream-stats.txt
    stream-gzip.txt
    worker-mean.txt
    worker-health.txt
```

Do **not** edit `session-2/task/README.md`. Do not commit `node_modules`,
`.env` files, build output, or data files.

`NOTES.md` must contain:

- answers to the Task 1 and Task 2 questions
- the data-flow explanation from Task 2.1
- a short explanation of what you learned about streams and workers

### 3. Commit and push

```bash
git add session-2/task/your-username
git commit -m "Session 2 submission - Your Name"
git push -u origin session-2/your-username
```

Replace `Your Name` with your full name.

### 4. Open the pull request

Open one PR per student against the **`main`** branch of the course
repository.

- **Title:** `Session 2 - Your Name`
- **Base branch:** `main`
- **Compare branch:** `session-2/your-username`
- **Description:**

  ```md
  ## Summary
  - Task 1: ...
  - Task 2: ...

  ## How to run
  ...

  ## Evidence
  - `evidence/stream-stats.txt`
  - `evidence/stream-gzip.txt`
  - `evidence/worker-mean.txt`
  - `evidence/worker-health.txt`
  ```

After pushing, GitHub shows a **Compare & pull request** button. If it does
not, open the repository's **Pull requests** tab and choose **New pull
request**.

### PR checklist

Before opening the PR, confirm:

- [ ] The PR targets `main`.
- [ ] The branch is up to date with `main`.
- [ ] Only files under `session-2/task/your-username/` are added or changed.
- [ ] The assignment `README.md` is unchanged.
- [ ] `node_modules`, `.env`, build output, and data files are not committed.
- [ ] `pnpm install` / `npm install` works from your submission folder.
- [ ] The streaming scripts and the worker server run as described.
- [ ] All evidence files are included.
- [ ] The PR description explains how to run the project.

The instructor will review the PR and merge it.

## Common traps

- **`readFile` loads the whole file.** A stream reads a chunk, processes it,
  and releases it.
- **`write()` returning `false` means backpressure.** Wait for `drain` before
  writing more, or memory will grow.
- **`.pipe()` is not enough.** It does not wait for the destination to finish
  and does not handle errors as cleanly as `pipeline`.
- **A timeout inside `Promise.all` does not cancel a pipeline.** The pipeline
  keeps running in the background. Use an `AbortController` or destroy the
  stream.
- **`postMessage` structured-clones by default.** One million objects means one
  million copies.
- **`SharedArrayBuffer` shares memory.** A `Float64Array` view lets both sides
  read the same bytes without copying.
- **Transferring is not sharing.** `transferList` moves ownership; the sender
  can no longer use the buffer.
- **A worker pool is not optional at scale.** `new Worker()` per request pays
  startup and memory costs every time.
- **Offloading the reduce does not offload generation.** If the main thread
  still builds the data, it still blocks.
- **Worker errors do not reject pending requests automatically.** You must
  handle `error` and `exit` and clean up the `pendingRequests` map.

## References

- Node.js streams:
  <https://nodejs.org/api/stream.html>
- Backpressure in streams:
  <https://nodejs.org/en/learn/modules/backpressuring-in-streams>
- `stream.pipeline`:
  <https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-callback>
- `worker_threads`:
  <https://nodejs.org/api/worker_threads.html>
- `postMessage` and `transferList`:
  <https://nodejs.org/api/worker_threads.html#portpostmessagevalue-transferlist>
- `SharedArrayBuffer`:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer>
- Session 1 — Event Loop Lab:
  [README](../../session-1/task/README.md)
- Session 2 code examples:
  [code-example](../code-example/)
