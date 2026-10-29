
import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const URL = "http://localhost:3000/api";
const DURATION_MS = 90_000;
const INTERVAL_MS = 250;
const outputFile = process.argv[2] ?? "evidence/probe.txt";

const results = [];
const inFlight = new Set();
const startedAt = performance.now();

async function probe() {
  const requestStarted = performance.now();

  const request = (async () => {
    try {
      const response = await fetch(URL);
      await response.text();

      results.push({
        latencyMs: performance.now() - requestStarted,
        status: response.status,
      });
    } catch (error) {
      results.push({
        latencyMs: performance.now() - requestStarted,
        error: String(error),
      });
    }
  })();

  inFlight.add(request);

  try {
    await request;
  } finally {
    inFlight.delete(request);
  }
}

void probe();

const interval = setInterval(() => {
  if (performance.now() - startedAt >= DURATION_MS) {
    clearInterval(interval);
    return;
  }

  void probe();
}, INTERVAL_MS);

await new Promise((resolve) => {
  const check = setInterval(() => {
    if (performance.now() - startedAt >= DURATION_MS) {
      clearInterval(check);
      clearInterval(interval);
      resolve();
    }
  }, 25);
});

await Promise.allSettled([...inFlight]);

const latencies = results.map((result) => result.latencyMs);
const average = latencies.length
  ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
  : 0;

const report = [
  `Duration: ${DURATION_MS / 1000} seconds`,
  `Interval: ${INTERVAL_MS} ms`,
  `Requests completed: ${results.length}`,
  `Fastest: ${latencies.length ? Math.min(...latencies).toFixed(2) : "n/a"} ms`,
  `Slowest: ${latencies.length ? Math.max(...latencies).toFixed(2) : "n/a"} ms`,
  `Average: ${latencies.length ? average.toFixed(2) : "n/a"} ms`,
  "",
  "Individual requests:",
  ...results.map((result, i) => `${i + 1}. ${JSON.stringify(result)}`),
].join("\n");

console.log(report);
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, report + "\n", "utf8");
console.log(`Saved ${outputFile}`);
