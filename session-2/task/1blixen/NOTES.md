
# Session 2 — Streams and Workers

## Task 1 — Streams

### 1.1 Why is readFileInBulk dangerous for an 8GB file?

`readFileInBulk` loads the entire file into memory before processing it. An 8GB file can therefore consume at least 8GB of memory, and additional memory may be required for strings, parsed objects, and other intermediate data. This can cause excessive memory usage or an out-of-memory error.

Streaming processes the file incrementally. Only a limited portion of the file is held in memory at a time, making it suitable for files much larger than the available memory.

### 1.2 What is backpressure, and why does the generator wait for drain?

Backpressure occurs when a writable stream receives data faster than it can process it.

When `write()` returns `false`, its internal buffer is full. The producer should wait for the `drain` event before writing more data.

Using `once(stream, "drain")` prevents the producer from continuously adding data to the buffer. This limits memory usage and allows the consumer to catch up.

### 1.3 What is the difference between pipeline() and pipe()?

`.pipe()` connects readable and writable streams and handles normal flow control, including backpressure. However, it does not provide a single Promise representing the completion of the entire stream chain, and errors need additional handling.

`pipeline()` coordinates the streams, handles errors across the chain, destroys the connected streams when an error occurs, and provides a Promise when used from `node:stream/promises`.

Awaiting that Promise ensures the operation has completed successfully before the application continues.

### 1.4 Why does main-final.ts print "File written successfully" too early?

Calling `.pipe()` starts the streaming process but does not wait for the destination to finish writing.

The success message is printed immediately after the pipeline is started, so it may appear before all data has been written.

The writable stream's `finish` event indicates that all data has been processed by the writable stream. However, manually listening for `finish` alone does not provide the same complete error handling as `pipeline()`.

Awaiting `pipeline()` is preferable because it resolves only when the complete pipeline succeeds and rejects if an error occurs.

### 1.5 Why doesn't Promise.race or Promise.all with a timeout stop gzip compression?

A timeout that rejects a Promise only affects the Promise operation. It does not automatically stop the underlying streams.

For example, `Promise.all()` may reject after five seconds while the gzip pipeline continues running in the background.

To cancel the operation, use an `AbortController`, pass its signal to `pipeline()`, and call `abort()` when the timeout occurs. The pipeline then destroys its participating streams and rejects.

The implementation also handles Ctrl+C by aborting the pipeline.

---

## Task 2 — Workers

### 2.1 What is the difference between CPU-bound work and event-loop work?

CPU-bound work requires significant processor time, such as calculating the mean temperature of millions of records.

When this work runs synchronously on the main thread, it blocks the Node.js event loop. During that time, the server may be unable to respond promptly to other requests.

A Worker Thread executes JavaScript in a separate thread, allowing the main thread to continue handling requests while the worker performs CPU-intensive calculations.

### 2.2 What happens when postMessage() sends one million JavaScript objects?

Worker messages normally use the structured clone algorithm. Sending a large array of objects requires the data to be serialized and copied into the receiving thread.

For one million objects, this can create substantial CPU overhead, memory usage, and garbage-collection pressure.

Our implementation avoids sending an array of city objects. Instead, it shares numeric data through a SharedArrayBuffer.

### 2.3 What is the difference between SharedArrayBuffer and transferList?

A SharedArrayBuffer provides memory that can be accessed by multiple threads. Both the main thread and worker can create views over the same underlying memory, avoiding a full copy of the data.

A normal ArrayBuffer can instead be transferred using a transferList. Its ownership moves to the receiving thread, and the sender's buffer becomes detached.

SharedArrayBuffer is useful when both threads need access to the same data. It requires care when both threads might modify shared values concurrently.

In this assignment, the main thread generates the data and the worker reads it to calculate the mean.

### 2.4 Why use a worker pool instead of creating a new Worker for every request?

Creating a Worker for every request introduces startup overhead and consumes additional system resources.

A worker pool reuses existing workers and limits the number of concurrent threads.

Our implementation sets `MAX_ALLOWED_WORKERS = 1`, so one worker is reused for incoming calculations. This bounds resource usage, although calculations are processed by that worker sequentially rather than in parallel.

A larger pool could allow multiple CPU-bound calculations to execute concurrently.

### 2.5 What work still happens on the main thread?

The main thread still:
- Validates the requested city count.
- Allocates the SharedArrayBuffer.
- Generates the city data and writes its numeric values.
- Assigns a request ID and sends the message to the worker.
- Receives the result and sends the HTTP response.

The worker performs the mean-temperature calculation.

Generating millions of records on the main thread is still CPU-intensive and can temporarily delay other requests. The health-check test showed that health requests continued to succeed during a large calculation, but response times can increase while the main thread generates the data.

### 2.6 How are worker failures handled?

The worker pool listens for both `error` and `exit` events.

When a worker fails or exits unexpectedly:
1. The worker is marked as retired.
2. It is removed from the worker pool.
3. All pending requests assigned to it are rejected.
4. The corresponding HTTP requests return an error instead of remaining pending.
5. A subsequent request creates a replacement worker.

I tested this by temporarily introducing an intentional error in the worker. The first request returned HTTP 503 instead of hanging. After removing the intentional error, the next request succeeded using a replacement worker.

---

## Evidence

- `evidence/stream-stats.txt`: streaming statistics for 1,000,000 records, including progress.
- `evidence/stream-gzip.txt`: gzip completion and input/output file sizes.
- `evidence/worker-mean.txt`: mean-temperature endpoint result for a large dataset.
- `evidence/worker-health.txt`: health-check results collected during a large calculation.
