
import express from "express";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import type { Response } from "express";
import { citiesGen } from "./helpers/citiesGen.ts";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_ALLOWED_WORKERS = 1;
const DEFAULT_COUNT = 1_000_000;
const MAX_COUNT = 10_000_000;

type WorkerResponse = {
  requestId: string;
  meanTemperature?: number;
  error?: string;
};

type PendingRequest = {
  resolve: (result: { meanTemperature: number }) => void;
  reject: (error: Error) => void;
  response: Response;
};

const app = express();

const workers: Worker[] = [];
const pendingRequests = new Map<string, PendingRequest>();
const retiredWorkers = new WeakSet<Worker>();

let nextWorkerIndex = 0;
let shuttingDown = false;

function retireWorker(worker: Worker, reason: Error): void {
  if (retiredWorkers.has(worker)) return;

  retiredWorkers.add(worker);

  const index = workers.indexOf(worker);

  if (index !== -1) {
    workers.splice(index, 1);
  }

  // Reject every request that was assigned to this worker.
  for (const [requestId, pending] of pendingRequests) {
    // Each request is associated with its worker separately below.
    if (requestWorkers.get(requestId) === worker) {
      pendingRequests.delete(requestId);
      requestWorkers.delete(requestId);
      pending.reject(reason);
    }
  }

  console.error("Worker retired:", reason.message);
}

const requestWorkers = new Map<string, Worker>();

function createMeanTemperatureWorker(): Worker {
  const worker = new Worker(
    new URL("./mean-temperature-worker.ts", import.meta.url),
  );

  worker.on("message", (message: WorkerResponse) => {
    const pending = pendingRequests.get(message.requestId);

    if (!pending) return;

    pendingRequests.delete(message.requestId);
    requestWorkers.delete(message.requestId);

    if (message.error !== undefined) {
      pending.reject(new Error(message.error));
      return;
    }

    if (typeof message.meanTemperature !== "number") {
      pending.reject(new Error("Worker returned an invalid result"));
      return;
    }

    pending.resolve({
      meanTemperature: message.meanTemperature,
    });
  });

  worker.on("error", (error: Error) => {
    retireWorker(worker, error);
  });

  worker.on("exit", (code: number) => {
    if (!shuttingDown) {
      retireWorker(
        worker,
        new Error(`Worker exited unexpectedly with code ${code}`),
      );
    }
  });

  workers.push(worker);

  return worker;
}

function getMeanTemperatureWorker(): Worker {
  // Remove any workers that have already exited.
  const availableWorkers = workers.filter(
    (worker) => !retiredWorkers.has(worker),
  );

  if (availableWorkers.length === 0) {
    return createMeanTemperatureWorker();
  }

  if (workers.length < MAX_ALLOWED_WORKERS) {
    return createMeanTemperatureWorker();
  }

  const worker =
    availableWorkers[nextWorkerIndex % availableWorkers.length];

  nextWorkerIndex++;

  return worker!;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/cities/mean-temperature", async (req, res) => {
  const rawCount = req.query.count;

  const count =
    rawCount === undefined
      ? DEFAULT_COUNT
      : Number(rawCount);

  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > MAX_COUNT
  ) {
    res.status(400).json({
      error: `Count must be an integer between 1 and ${MAX_COUNT}`,
    });
    return;
  }

  let requestId: string | undefined;

  try {
    const worker = getMeanTemperatureWorker();

    // Generate data directly in a SharedArrayBuffer.
    const citiesData = citiesGen(count);

    requestId = randomUUID();

    const resultPromise = new Promise<{
      meanTemperature: number;
    }>((resolve, reject) => {
      pendingRequests.set(requestId!, {
        resolve,
        reject,
        response: res,
      });

      requestWorkers.set(requestId!, worker);

      res.on("close", () => {
        if (!res.writableEnded) {
          pendingRequests.delete(requestId!);
          requestWorkers.delete(requestId!);
          reject(new Error("Client disconnected"));
        }
      });
    });

    try {
      worker.postMessage({
        requestId,
        citiesData,
      });
    } catch (error) {
      pendingRequests.delete(requestId);
      requestWorkers.delete(requestId);
      throw error;
    }

    const result = await resultPromise;

    if (!res.destroyed) {
      res.json(result);
    }
  } catch (error) {
    if (requestId) {
      pendingRequests.delete(requestId);
      requestWorkers.delete(requestId);
    }

    console.error("Mean temperature request failed:", error);

    if (!res.headersSent && !res.destroyed) {
      res.status(503).json({
        error: "Unable to calculate mean temperature",
      });
    }
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

function shutdown(): void {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log("Shutting down server...");

  server.close();

  for (const worker of workers) {
    void worker.terminate();
  }

  for (const [requestId, pending] of pendingRequests) {
    pendingRequests.delete(requestId);
    requestWorkers.delete(requestId);
    pending.reject(new Error("Server is shutting down"));
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
