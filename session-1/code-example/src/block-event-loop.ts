import express from "express";
import { Worker } from "node:worker_threads";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
const app = express();
const numberOfHashes = 4000; // Example value, adjust as needed

// call this to check if the server is running or blocked
app.get("/v1", (req, res) => {
  res.send({
    message: "Hello World",
    date: new Date(),
  });
});

// i/o-bound task handled asynchronously
app.get("/v2", async (req, res) => {
  const hashingPromises: Promise<string>[] = [];
  for (let i = 0; i < numberOfHashes; i++) {
    const hashingPromise = bcrypt.hash(randomUUID(), 10);
    hashingPromises.push(hashingPromise);
  }

  await Promise.all(hashingPromises);
  res.send({
    message: "Hello World",
    date: new Date(),
  });
});

// CPU-bound task handled in a worker thread
app.get("/v3", (req, res) => {
  const worker = new Worker(new URL("./fib-worker.ts", import.meta.url), {
    workerData: 45,
  });
  worker.on("message", console.log);
  worker.on("error", console.error);

  worker.on("exit", (code) => {
    console.log(`Worker exited with code ${code}`);
    if (code !== 0)
      console.error(new Error(`Worker stopped with exit code ${code}`));
  });

  res.send({
    message: "Hello World",
    date: new Date(),
  });
});

app.get("/v4", (req, res) => {
  fib(45); // cpu bound task -> blocks
  res.send({
    message: "Hello World",
    date: new Date(),
  });
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
JSON.parse("{}");
