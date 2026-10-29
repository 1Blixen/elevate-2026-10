import { createWriteStream, mkdirSync } from "node:fs";
import { once } from "node:events";
import { join } from "node:path";

export type CityWeather = {
  cityId: number;
  latitude: number;
  longitude: number;
  temperature: number;
};

export interface GenerateOptions {
  /** Output directory. Default: ./out */
  outDir?: string;
  /** Rows per file. Default: 100M (~8-9 GB per file) */
  rowsPerFile?: number;
  /** Rows built per write call. Default: 50k */
  batchSize?: number;
  /** Called after every batch with total rows written so far */
  onProgress?: (rowsWritten: number) => void;
}

/**
 * Streams `total` rows of city weather data to NDJSON files
 * (one JSON object per line), never holding more than one batch in memory.
 */
export async function generateCityFiles(
  total = 10_000_000_000,
  {
    outDir = "./out",
    rowsPerFile = 100_000_000,
    batchSize = 50_000,
    onProgress,
  }: GenerateOptions = {},
): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  let written = 0;
  let fileIndex = 0;

  while (written < total) {
    const rowsInFile = Math.min(rowsPerFile, total - written);
    const filePath = join(
      outDir,
      `cities-${String(fileIndex).padStart(5, "0")}.ndjson`,
    );
    const stream = createWriteStream(filePath);

    for (let done = 0; done < rowsInFile; done += batchSize) {
      const n = Math.min(batchSize, rowsInFile - done);
      let chunk = "";

      for (let j = 0; j < n; j++) {
        const cityId = written + done + j + 1;
        const latitude = (Math.random() * 180 - 90).toFixed(6);
        const longitude = (Math.random() * 360 - 180).toFixed(6);
        const temperature = Math.floor(Math.random() * 46) - 10;

        // Template string is much faster than JSON.stringify per row
        chunk += `{"cityId":${cityId},"latitude":${latitude},"longitude":${longitude},"temperature":${temperature}}\n`;
      }

      // Respect backpressure so memory stays flat
      if (!stream.write(chunk)) await once(stream, "drain");
      onProgress?.(written + done + n);
    }

    stream.end();
    await once(stream, "finish");

    written += rowsInFile;
    fileIndex++;
  }
}

const TOTAL = 100_000_000;
await generateCityFiles(TOTAL, {
  outDir: "./data",
  rowsPerFile: TOTAL,
});
