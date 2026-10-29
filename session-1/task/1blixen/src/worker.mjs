
import { parentPort } from "node:worker_threads";
import { performance } from "node:perf_hooks";

parentPort.on("message", ({ type, durationMs }) => {
  if (type !== "run") return;

  const startedAt = performance.now();
  let iterations = 0;

  try {
    while (performance.now() - startedAt < durationMs) {
      iterations++;
    }

    parentPort.postMessage({
      type: "done",
      result: {
        iterations,
        elapsedMs: performance.now() - startedAt,
      },
    });
  } catch (error) {
    parentPort.postMessage({
      type: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
