
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

type WeatherRow = {
  temperature: number;
};

function isWeatherRow(value: unknown): value is WeatherRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "temperature" in value &&
    typeof value.temperature === "number" &&
    Number.isFinite(value.temperature)
  );
}

async function main(): Promise<void> {
  const inputPath = resolve(
    process.env.INPUT_FILE ??
      "session-2/code-example/src/streams/data/cities-00000.ndjson",
  );

  const { size: totalBytes } = await stat(inputPath);
  const input = createReadStream(inputPath);

  let bytesRead = 0;
  let nextProgress = 10;

  input.on("data", (chunk: Buffer) => {
    bytesRead += chunk.length;

    if (totalBytes > 0) {
      const percentage = Math.floor((bytesRead / totalBytes) * 100);

      while (percentage >= nextProgress && nextProgress <= 100) {
        console.log(`Progress: ${nextProgress}%`);
        nextProgress += 10;
      }
    }
  });

  const lines = createInterface({
    input,
    crlfDelay: Infinity,
  });

  let totalRows = 0;
  let temperatureSum = 0;
  let minTemperature = Infinity;
  let maxTemperature = -Infinity;

  for await (const line of lines) {
    if (line.trim() === "") continue;

    const parsed: unknown = JSON.parse(line);

    if (!isWeatherRow(parsed)) {
      throw new Error(`Invalid weather record at row ${totalRows + 1}`);
    }

    const temperature = parsed.temperature;

    totalRows++;
    temperatureSum += temperature;
    minTemperature = Math.min(minTemperature, temperature);
    maxTemperature = Math.max(maxTemperature, temperature);
  }

  if (totalRows === 0) {
    console.log("No records found.");
    return;
  }

  const averageTemperature = temperatureSum / totalRows;

  console.log("\nStream statistics");
  console.log("-----------------");
  console.log(`Total rows: ${totalRows}`);
  console.log(`Average temperature: ${averageTemperature.toFixed(1)}`);
  console.log(`Minimum temperature: ${minTemperature}`);
  console.log(`Maximum temperature: ${maxTemperature}`);
}

main().catch((error: unknown) => {
  console.error("Stream statistics failed:", error);
  process.exitCode = 1;
});
