import { parentPort, workerData } from "node:worker_threads";
if (!parentPort) {
  throw new Error("This script must be run as a worker thread");
}

parentPort.on("message", (message: unknown) => {
  console.log(`Worker received message: ${message}`);
});
