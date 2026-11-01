
import { parentPort } from "node:worker_threads";

type MeanTemperatureRequest = {
  requestId: string;
  citiesData: Float64Array;
};

if (!parentPort) {
  throw new Error("This file must run inside a Worker");
}

parentPort.on("message", (message: MeanTemperatureRequest) => {
    
  try {
    const { requestId, citiesData } = message;

    if (
      !(citiesData instanceof Float64Array) ||
      citiesData.length === 0 ||
      citiesData.length % 4 !== 0
    ) {
      throw new Error("Invalid city data");
    }

    let temperatureSum = 0;
    let cityCount = 0;

    // Temperature is the fourth value for each city.
    for (let i = 3; i < citiesData.length; i += 4) {
      temperatureSum += citiesData[i]!;
      cityCount++;
    }

    const meanTemperature = temperatureSum / cityCount;

    parentPort!.postMessage({
      requestId,
      meanTemperature,
    });
  } catch (error) {
    parentPort!.postMessage({
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
