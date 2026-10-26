# Session 1 — Event Loop Lab

> Block the loop, prove it, fix it with a worker, measure the lag, and compare
> the libuv pool.

## What you will do

| Task | What it proves |
| --- | --- |
| **1** | Node runs your JavaScript on one thread. A synchronous CPU loop freezes every request. A worker thread moves the CPU work off that thread. |
| **2** | Event-loop lag is measurable. A blocked loop shows up as a large maximum delay. |
| **3** | Async I/O is not parallel JavaScript. The libuv pool can run blocking native work in parallel, but it cannot rescue a busy loop. |

**Suggested time:** 2–3 hours.

## Contents

- [Before you start](#before-you-start)
- [Rules](#rules)
- [Task 1 — Block the loop, then fix it](#task-1--block-the-loop-then-fix-it)
- [Task 2 — Make the lag visible](#task-2--make-the-lag-visible)
- [Task 3 — Async I/O is not parallel JavaScript](#task-3--async-io-is-not-parallel-javascript)
- [Submission](#submission)
- [Common traps](#common-traps)
- [References](#references)

## Before you start

- Node.js **22.18+** (or 24+). The course examples use TypeScript with Node's
  built-in type stripping. Plain JavaScript is also fine.
- `pnpm` or `npm`.
- Git and a GitHub account (you will submit via pull request).
- Express or the built-in `node:http` module for Tasks 1–3.

All paths in this README are relative to your submission folder:
`session-1/task/your-username/`.

Check your version:

```bash
node --version
```

## Rules

- The 20-second block in Task 1 must be **synchronous CPU work on the main
  thread**. A busy loop is the expected solution.
- **Not allowed** for the block:
  - `setTimeout`
  - `await new Promise((resolve) => setTimeout(resolve, 20_000))`
  - `Atomics.wait`
  - `execSync("sleep 20")`
  - any external process

  These either do not block the loop or do not represent CPU-bound work. They
  do not reproduce the bug.
- Do **not** use a synchronous native call (for example, `pbkdf2Sync`,
  `readFileSync`, or `gzipSync`) as the block. Use a JavaScript busy loop.
- Do **not** use `fib(45)` for timing. Its duration depends on the machine.
  Use a time-based loop so the block lasts a full 20 seconds.
- Task 1 has **one endpoint only**: `GET /api`. Do not add a `/health` route;
  the probe script is your client.
- Use `node:worker_threads` for the fix in Task 1.
- Final evidence must use the default timings: **20 seconds blocked, every
  40 seconds**. You may temporarily use shorter values while developing, but
  say so in `NOTES.md` and re-run the final evidence with the defaults.

## Task 1 — Block the loop, then fix it

> **Original brief:** Create a Node.js app with one endpoint, `GET /api`. Every
> 40 seconds, block the main thread for a full 20 seconds. Then fix it with a
> worker thread.

### 1.1 Build the app

Create a Node.js server with a single endpoint, `GET /api`.

- Log the listening URL when the server starts.
- The first block should start about **10 seconds** after the server starts.
  After that, run one block every **40 seconds**, start-to-start.
- Each block must keep the main thread busy for **at least 20 seconds**.
- Blocks must not overlap.
- Use `performance.now()` and a `while` loop. Do not use timers or `await` for
  the block itself.
- Log `block:start` and `block:end` with timestamps.

Hint: a `setTimeout` for the first run, then another `setTimeout` after each
block ends, gives you the 10s, 50s, 90s cadence.

`GET /api` returns:

```json
{
  "now": "2026-10-26T12:00:15.000Z",
  "block": {
    "running": false,
    "lastStart": "2026-10-26T11:59:50.000Z",
    "lastEnd": "2026-10-26T12:00:10.000Z"
  }
}
```

While the block is running, **no other JavaScript runs** — no request handler,
no timer callback, no promise continuation.

### 1.2 Prove it

Create a small client script called `probe.mjs`.

- It sends a request to `/api` every **250 ms** for **90 seconds**.
- It records how long each request takes.
- At the end, it prints the results and a simple summary:
  - number of requests
  - fastest request
  - slowest request
  - average request time

Keep sending on a timer; do not wait for one response before sending the next
request. That way some requests are sent while the server is blocked.

Run the probe and save the output as `evidence/before.txt`.

You should see a gap of about **20 seconds** where requests wait, followed by a
burst of responses when the block ends.

**Note:** the server's `now` is when the handler actually ran, not when the
request arrived. The client-side time is the proof.

Answer these questions in `NOTES.md`:

1. Why do requests wait while the loop is computing?
2. Why does `setTimeout(20_000)` not reproduce the bug?

### 1.3 Fix it with a worker

Move the 20-second CPU job to a worker thread.

- Keep the same 40-second schedule.
- `/api` must keep answering while the worker is busy. Each request should
  return in **under 200 ms**.
- Return the job state from `/api`:

```json
{
  "now": "2026-10-26T12:00:05.000Z",
  "job": {
    "running": true,
    "lastStart": "2026-10-26T12:00:00.000Z",
    "lastEnd": "2026-10-26T11:59:40.000Z",
    "lastResult": {
      "iterations": 123456789,
      "elapsedMs": 20001
    }
  }
}
```

`lastResult` is from the most recent completed job.

- The worker must complete the full 20 seconds of work and return a result.
  A loop that finishes early, or a worker whose result is ignored, does not
  count.
- Handle worker `error` and `exit` events. Log the failure and keep the server
  alive.
- Stop the worker when the server stops (`SIGINT` / `SIGTERM`).
- Do not create a worker per HTTP request. The job is scheduled, so one
  long-lived worker or one worker per scheduled job is enough.

Run the probe again and save the output as `evidence/after.txt`.

Answer these questions in `NOTES.md`:

1. Did the 20-second job get faster? Did the server get faster? What exactly
   improved?
2. When would a worker thread be the wrong tool?

## Task 2 — Make the lag visible

Add event-loop delay monitoring to your Task 1 app.

- Use `monitorEventLoopDelay` from `node:perf_hooks`.
- Every second, print the **maximum delay** since the last check, then reset
  the histogram.
- Run it before the worker fix and after the worker fix.
- Save the outputs as `evidence/lag-before.txt` and `evidence/lag-after.txt`.

Hint: the histogram reports nanoseconds. Divide by `1_000_000` to print
milliseconds.

Expected result:

- Before the fix: the maximum delay is about **20 seconds**.
- After the fix: the maximum delay stays **under 100 ms**.

Answer in `NOTES.md`:

- Why does the monitoring log stop during the block?
- Why is that pause itself evidence that the loop was blocked?

## Task 3 — Async I/O is not parallel JavaScript

This task shows what the libuv thread pool can and cannot do.

Write a script called `pool.mjs` (or `src/pool.ts` if you use TypeScript):

- Start **8** `crypto.pbkdf2` hashes at the same time.
- Use the same password, salt, iteration count, and key length for every call.
  Pick values that take a noticeable amount of time (for example, 200,000
  iterations).
- Measure the **total time** for all 8 calls to finish.
- Keep a **100 ms heartbeat** running and print it while the hashes run.

Run the script four times, with the pool size set before Node starts:

```bash
UV_THREADPOOL_SIZE=1 node src/pool.mjs
UV_THREADPOOL_SIZE=2 node src/pool.mjs
UV_THREADPOOL_SIZE=4 node src/pool.mjs
UV_THREADPOOL_SIZE=8 node src/pool.mjs
```

Use your actual file path. If you use TypeScript, run `node src/pool.ts` with the
same `UV_THREADPOOL_SIZE` prefix.

Save each run as `evidence/pool-1.txt`, `evidence/pool-2.txt`,
`evidence/pool-4.txt`, and `evidence/pool-8.txt`.

Record the total time and the average time per hash in a small table.

Answer in `NOTES.md`:

1. Does the heartbeat stay on time? What does that tell you about the event
   loop?
2. Why does the total time change when the pool size changes?
3. Why does `UV_THREADPOOL_SIZE` not fix the problem in Task 1?
4. What is the default pool size?

## Submission

Submit your work as a **pull request** to the course repository:

**Repository:** <https://github.com/mostafaroshdy1/elevate-2026-10>

### 1. Create a branch

Start from `main` and create a branch named after yourself:

```bash
git checkout main
git pull
git checkout -b session-1/your-username
```

Replace `your-username` with your GitHub username.

If you do not have write access to the repository, fork it first, clone your
fork, and create the branch there.

### 2. Add your work

Put everything under:

```text
session-1/task/your-username/
  NOTES.md
  package.json
  src/
    server.ts        (or server.mjs)
    worker.ts        (or worker.mjs)
    pool.ts          (or pool.mjs)
  probe.mjs
  evidence/
    before.txt
    after.txt
    lag-before.txt
    lag-after.txt
    pool-1.txt
    pool-2.txt
    pool-4.txt
    pool-8.txt
```

Do **not** edit `session-1/task/README.md`. Do not commit `node_modules`,
`.env` files, or build output.

`NOTES.md` must contain:

- answers to the Task 1, 2, and 3 questions
- the pool-size table from Task 3
- a short explanation of what you learned about the event loop

Evidence files can be raw terminal output. Screenshots are optional.

### 3. Commit and push

```bash
git add session-1/task/your-username
git commit -m "Session 1 submission - Your Name"
git push -u origin session-1/your-username
```

Replace `Your Name` with your full name.

### 4. Open the pull request

Open one PR per student against the **`main`** branch of the course
repository.

- **Title:** `Session 1 - Your Name`
- **Base branch:** `main`
- **Compare branch:** `session-1/your-username`
- **Description:**

  ```md
  ## Summary
  - Task 1: ...
  - Task 2: ...
  - Task 3: ...

  ## How to run
  ...

  ## Evidence
  - `evidence/before.txt`
  - `evidence/after.txt`
  ...
  ```

After pushing, GitHub shows a **Compare & pull request** button. If it does
not, open the repository's **Pull requests** tab and choose **New pull
request**.

### PR checklist

Before opening the PR, confirm:

- [ ] The PR targets `main`.
- [ ] The branch is up to date with `main`.
- [ ] Only files under `session-1/task/your-username/` are added or changed.
- [ ] The assignment `README.md` is unchanged.
- [ ] `node_modules`, `.env`, and build output are not committed.
- [ ] `pnpm install` / `npm install` works from your submission folder.
- [ ] The server and probe run as described.
- [ ] All evidence files are included.
- [ ] The PR description explains how to run the project.

The instructor will review the PR and merge it.

## Common traps

- **`setTimeout` does not block.** It schedules a callback for later. The loop
  is free in the meantime.
- **`await` does not stop CPU work.** It only pauses the current async
  function. A synchronous loop after the `await` still blocks everything.
- **`Atomics.wait` blocks, but it is not CPU-bound work.** It is banned here
  because this task is about a busy loop.
- **`fib(45)` is not a reliable 20 seconds.** It depends on the machine. Use
  `performance.now()`.
- **A worker does not make CPU work faster.** It keeps the main loop free.
  The job still takes about 20 seconds.
- **Do not create a worker per request.** Worker startup costs time and
  memory. Pool workers when the work is per-request.
- **`UV_THREADPOOL_SIZE` does not help pure JavaScript.** It only changes the
  libuv pool used by native blocking work such as `fs`, `crypto`, `dns`, and
  `zlib`.
- **A synchronous native call also blocks the loop.** `readFileSync`,
  `pbkdf2Sync`, and `gzipSync` are not free. When an async API exists, use it;
  a worker is for CPU-heavy JavaScript.
- **The libuv pool defaults to 4 threads.** More pool threads help only when
  the work is native/blocking and the CPU has room.
- **A blocked loop can still accept TCP connections.** The kernel completes
  the handshake, but Node cannot read the request or send a response until
  the loop is free.
- **The monitoring log stops during a block.** That is expected. The
  maximum-delay value recorded after the block is the evidence.
- **Client-side latency is the proof.** Server-side `now` is when the handler
  ran, not when the request arrived.

## References

- Node.js event loop:
  <https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick>
- `worker_threads`:
  <https://nodejs.org/api/worker_threads.html>
- `monitorEventLoopDelay`:
  <https://nodejs.org/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions>
- libuv thread pool:
  <https://docs.libuv.org/en/v1.x/threadpool.html>
- Node.js cluster:
  <https://nodejs.org/api/cluster.html>
- Session slides:
  [Part 1](../nodejs-architecture-part1.pdf) ·
  [Part 2](../nodejs-architecture-part2.pdf)
