
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

async function main(): Promise<void> {
  const inputPath = resolve(
    process.env.INPUT_FILE ??
      "session-2/code-example/src/streams/data/cities-00000.ndjson",
  );

  const outputPath = resolve(
    process.env.OUTPUT_FILE ?? `${inputPath}.gz`,
  );

  const controller = new AbortController();

  const handleSigint = () => {
    console.log("\nCancellation requested...");
    controller.abort(new Error("Compression interrupted"));
  };

  process.once("SIGINT", handleSigint);

  try {
    await pipeline(
      createReadStream(inputPath),
      createGzip({ level: 9 }),
      createWriteStream(outputPath),
      { signal: controller.signal },
    );

    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);

    console.log("File written successfully");
    console.log(`Input: ${inputPath} (${inputStats.size} bytes)`);
    console.log(`Output: ${outputPath} (${outputStats.size} bytes)`);
  } catch (error) {
    console.error("Compression failed:", error);
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", handleSigint);
  }
}

main();
