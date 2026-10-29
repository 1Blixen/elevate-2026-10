import { parentPort, Worker } from "node:worker_threads";
import { citiesGen, type CityWeather } from "./helpers/citiesGen.ts";
import { setTimeout } from "node:timers/promises";
import { sharedArrayBufferToCity } from "./helpers/sharedArrayBufferToCity.ts";

parentPort?.on("message", (args: [Float64Array<SharedArrayBuffer>, string]) => {
  const [citiesData, reqId] = args;
  const cities = sharedArrayBufferToCity(citiesData);
  const meanTemperature =
    cities.reduce((sum, city) => sum + city.temperature, 0) / cities.length;

  parentPort?.postMessage({ meanTemperature, requestId: reqId });
});
