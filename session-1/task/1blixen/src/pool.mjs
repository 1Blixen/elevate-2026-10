
import { pbkdf2 } from "node:crypto";
import { performance } from "node:perf_hooks";

const HASH_COUNT = 8;
const ITERATIONS = 200_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function hashOne(index) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();

    pbkdf2(
      "event-loop-lab-password",
      "event-loop-lab-salt",
      ITERATIONS,
      KEY_LENGTH,
      DIGEST,
      (error, key) => {
        const elapsedMs = performance.now() - startedAt;

        if (error) {
          reject(error);
          return;
        }

        resolve({ index, elapsedMs, keyBytes: key.length });
      },
    );
  });
}

let heartbeatCount = 0;

const heartbeat = setInterval(() => {
  heartbeatCount++;
  console.log(`[heartbeat ${heartbeatCount}] event loop is responsive`);
}, 100);

const startedAt = performance.now();

try {
  const results = await Promise.all(
    Array.from({ length: HASH_COUNT }, (_, index) =>
      hashOne(index + 1),
    ),
  );

  const totalMs = performance.now() - startedAt;
  clearInterval(heartbeat);

  for (const result of results) {
    console.log(
      `Hash ${result.index}: ${result.elapsedMs.toFixed(2)} ms`,
    );
  }

  console.log(`UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE ?? "4 (default)"}`);
  console.log(`Total time: ${totalMs.toFixed(2)} ms`);
  console.log(`Average total time per hash: ${(totalMs / HASH_COUNT).toFixed(2)} ms`);
  console.log(`Heartbeats during run: ${heartbeatCount}`);
} catch (error) {
  clearInterval(heartbeat);
  console.error(error);
  process.exitCode = 1;
}
