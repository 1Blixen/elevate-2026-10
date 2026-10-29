import { parentPort, workerData } from "node:worker_threads";
if (!parentPort) {
  throw new Error("This script must be run as a worker thread");
}

parentPort.on("message", (message: unknown) => {
  console.log(`Worker received message: ${message}`);
});

setTimeout(() => {
  throw new Error("Worker timed out after 10 seconds");
}, 10_000);
