
# Session 1 — Event Loop Lab

## Task 1: Blocking the event loop

The synchronous CPU loop executes JavaScript on Node.js's main thread. While the loop runs, Node.js cannot execute the Express route handler, process HTTP requests, send responses, or run timers. Incoming TCP connections may wait in the operating system, but Node.js cannot process them until the main thread becomes available.

Using setTimeout with a delay of 20 seconds does not reproduce this behavior. setTimeout schedules a callback for later without occupying the CPU while it waits.

## Task 1: Worker-thread fix

The worker runs the same CPU-intensive JavaScript loop on a separate thread. This allows the main thread to continue handling HTTP requests while the computation runs.

The worker does not inherently make the computation faster. It improves server responsiveness by moving the CPU work off the main thread.

## Task 2: Event-loop delay

The event-loop delay monitor records the maximum delay observed during each monitoring interval. Its measurements are converted from nanoseconds to milliseconds.

Before the fix, the synchronous loop prevents the monitoring callback from running. The missing or delayed monitoring output demonstrates that the event loop is blocked. After the fix, the main thread can continue running the monitoring callback while the worker computes.

## Task 3: libuv thread pool

The experiment runs eight asynchronous pbkdf2 password-hashing operations. The UV_THREADPOOL_SIZE environment variable controls the number of worker threads available in libuv's thread pool.

The total completion time can change as the pool size changes because more hashing operations may execute concurrently. The heartbeat continues while the asynchronous operations run because their computation does not occupy the main JavaScript thread.

Increasing the libuv thread-pool size does not fix a synchronous JavaScript busy loop. That loop executes on the main thread rather than using the libuv thread pool.

The default libuv thread-pool size is 4.

## Measurements


| Pool size | Total time (ms) | Average time per hash (ms) |
|---:|---:|---:|
| 1 | [199.46] | [24.93] |
| 2 | [108.68] | [13.58] |
| 4 | [92.71] | [11.59] |
| 8 | [68.59] | [8.57] |
