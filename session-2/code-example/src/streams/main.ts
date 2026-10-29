import { readFile, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { Transform, Writable, type TransformCallback } from "node:stream";
import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
export class WriteToConsoleStream extends Writable {
  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    process.stdout.write(chunk, callback);
  }
}

async function readFileInBulk() {
  const jsonFile = await readFile("./data/cities-00000.ndjson", {
    encoding: "utf-8",
  });
  const jsonLines = jsonFile.split("\n").filter(Boolean);
  const cityWeatherData = jsonLines.map((line) => JSON.parse(line));
  console.log(cityWeatherData[0]);
}
export class StreamProgress extends Transform {
  private bytesRead = 0;
  private lastPercentage = -1;
  private readonly totalBytes: number;
  constructor(totalBytes: number) {
    super();
    this.totalBytes = totalBytes;
  }
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.bytesRead += chunk.length;
    const percentage = Math.floor((this.bytesRead / this.totalBytes) * 100);
    if (percentage !== this.lastPercentage) {
      console.log(`${percentage}%`);
      this.lastPercentage = percentage;
    }

    callback(null, chunk);
  }
}

function getProgressStream(totalBytes: number) {
  let totalByteRead = 0;
  let latestPercentage = -1;
  return new Transform({
    transform(chunk, encoding, callback) {
      totalByteRead += chunk.length;
      const percentage = Math.floor((totalByteRead / totalBytes) * 100);
      if (percentage !== latestPercentage) {
        console.log(`${percentage}%`);
        latestPercentage = percentage;
      }
      callback(null, chunk);
    },
  });
}

async function readFileInStream() {
  const input = "./data/cities-00000.ndjson";
  const output = "./data/cities-00000.ndjson.gz";
  const { size } = await stat(input);

  try {
    await Promise.all([
      pipeline(
        createReadStream(input),
        // new StreamProgress(size),
        createGzip({ level: 9 }),
        createWriteStream(output),
      ),
      setTimeout(5000).then(() => {
        throw new Error("Timeout reached");
      }),
    ]);

    console.log("File written successfully");
  } catch (error) {
    console.error("Pipeline failed:", error);
  }

  console.log("i am here");
}
readFileInStream();
