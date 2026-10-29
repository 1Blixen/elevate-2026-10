
import express from "express";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { Worker } from "node:worker_threads";

const PORT = 3000;
const JOB_DURATION_MS = 20_000;
const JOB_INTERVAL_MS = 40_000;
const FIRST_JOB_DELAY_MS = 10_000;
const useWorker = process.argv.includes("--worker");

const app = express();

const job = {
  running: false,
  lastStart: null,
  lastEnd: null,
  lastResult: null,
};

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

const lagFile = process.env.LAG_FILE;
let lagStream;

if (lagFile) {
  const { createWriteStream } = await import("node:fs");
  lagStream = createWriteStream(lagFile, { flags: "w" });
}

const logTimer = setInterval(() => {
  const line =
    `${new Date().toISOString()} ` +
    `maxDelayMs=${(histogram.max / 1e6).toFixed(2)}\n`;

  if (lagStream) {
    lagStream.write(line);
  } else {
    console.log(`[event-loop-delay] ${line.trim()}`);
  }

  histogram.reset();
}, 1000);

let worker = null;
let nextJobTimer;
let shuttingDown = false;

function startJob() {
  if (shuttingDown) return;

  job.running = true;
  job.lastStart = new Date().toISOString();
  job.lastEnd = null;
  job.lastResult = null;

  const startedAt = performance.now();

  // Schedule the next start 40 seconds after this start.
  nextJobTimer = setTimeout(startJob, JOB_INTERVAL_MS);

  if (useWorker) {
    if (!worker) {
      job.running = false;
      console.error("Worker is unavailable.");
      return;
    }

    worker.postMessage({
      type: "run",
      durationMs: JOB_DURATION_MS,
    });
    return;
  }

  // Baseline: this loop blocks the main event loop.
  let iterations = 0;

  while (performance.now() - startedAt < JOB_DURATION_MS) {
    iterations++;
  }

  const elapsedMs = performance.now() - startedAt;

  job.running = false;
  job.lastEnd = new Date().toISOString();
  job.lastResult = { iterations, elapsedMs };

  console.log(
    `Blocking job finished: ${iterations} iterations, ` +
    `${elapsedMs.toFixed(2)} ms`
  );
}

if (useWorker) {
  worker = new Worker(new URL("./worker.mjs", import.meta.url));

  worker.on("message", (message) => {
    if (message.type === "done") {
      job.running = false;
      job.lastEnd = new Date().toISOString();
      job.lastResult = message.result;

      console.log(
        `Worker job finished in ${message.result.elapsedMs.toFixed(2)} ms`
      );
    }

    if (message.type === "failure") {
      job.running = false;
      job.lastEnd = new Date().toISOString();
      console.error("Worker job failed:", message.error);
    }
  });

  worker.on("error", (error) => {
    job.running = false;
    job.lastEnd = new Date().toISOString();
    console.error("Worker error:", error.message);
  });

  worker.on("exit", (code) => {
    if (!shuttingDown) {
      worker = null;
      job.running = false;
      job.lastEnd = new Date().toISOString();

      if (code !== 0) {
        console.error(`Worker exited unexpectedly: ${code}`);
      }
    }
  });
}

app.get("/api", (_req, res) => {
  res.json({
    now: new Date().toISOString(),
    block: {
      running: job.running,
      lastStart: job.lastStart,
      lastEnd: job.lastEnd,
      ...(useWorker ? { lastResult: job.lastResult } : {}),
    },
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Mode: ${useWorker ? "worker" : "blocking"}`);

  nextJobTimer = setTimeout(startJob, FIRST_JOB_DELAY_MS);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}; shutting down.`);
  clearTimeout(nextJobTimer);
  clearInterval(logTimer);
  histogram.disable();

  const closeServer = () => {
    if (lagStream) lagStream.end();
    server.close();
  };

  if (worker) {
    worker.terminate().finally(closeServer);
  } else {
    closeServer();
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
