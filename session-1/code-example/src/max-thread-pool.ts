import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";

const numberOfHashes = 4000; // Example value, adjust as needed

const hashingPromises: Promise<string>[] = [];

for (let i = 0; i < numberOfHashes; i++) {
  const hashingPromise = bcrypt.hash(randomUUID(), 10).then((hash) => {
    for (let i = 0; i < 5_000_000; i++) {} // saturate nodejs thread
    return hash;
  });
  hashingPromises.push(hashingPromise);
}

const t1 = performance.now();
await Promise.all(hashingPromises); // saturates the thread pool
const t2 = performance.now();

console.log(`Hashing finishes in ${Math.round(t2 - t1)} ms`);

// UV_THREADPOOL_SIZE=8 node ./src/max-thread-pool.ts
