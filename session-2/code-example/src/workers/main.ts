import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
  BroadcastChannel,
  isInternalThread,
} from "node:worker_threads";
import express from "express";
import { citiesGen, type CityWeather } from "./helpers/citiesGen.ts";
import { randomUUID } from "node:crypto";
import { cityToSharedArrayBuffer } from "./helpers/cityToSharedArrayBuffer.ts";
const MAX_ALLOWED_WORKERS = 1;
const app = express();
const meanTemperatureWorkers: Worker[] = [];
let nextWorkerIndex = 0;

const pendingRequests = new Map<
  string,
  (result: { meanTemperature: number }) => void
>();

app.get("/cities/mean-temperature", async (req, res) => {
  const cities = citiesGen(1_000_000);
  const citiesData = cityToSharedArrayBuffer(cities);
  const reqId = randomUUID();
  const meanTemperatureWorker = await getMeanTemperatureWorker();

  req.on("close", () => {
    pendingRequests.delete(reqId);
  });

  pendingRequests.set(reqId, (result) => res.json(result));
  meanTemperatureWorker.postMessage([citiesData, reqId]);
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

async function getMeanTemperatureWorker(): Promise<Worker> {
  if (meanTemperatureWorkers.length < MAX_ALLOWED_WORKERS) {
    const worker = new Worker(
      new URL("./mean-temperature-worker.ts", import.meta.url),
    );

    worker.on(
      "message",
      (message: { meanTemperature: number; requestId: string }) => {
        const { requestId, meanTemperature } = message;
        const resolve = pendingRequests.get(requestId);

        if (resolve) {
          resolve({ meanTemperature });
          pendingRequests.delete(requestId);
        }
      },
    );

    meanTemperatureWorkers.push(worker);
  }

  const worker = meanTemperatureWorkers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % meanTemperatureWorkers.length;

  return worker;
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
