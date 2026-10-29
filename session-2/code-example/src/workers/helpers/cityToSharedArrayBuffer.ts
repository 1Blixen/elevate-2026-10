import type { CityWeather } from "./citiesGen.ts";

export function cityToSharedArrayBuffer(
  cities: CityWeather[],
): Float64Array<SharedArrayBuffer> {
  const fieldsPerCity = 4;

  const sharedBuffer = new SharedArrayBuffer(
    cities.length * fieldsPerCity * Float64Array.BYTES_PER_ELEMENT,
  );

  const citiesData = new Float64Array(sharedBuffer);

  for (let i = 0; i < cities.length; i++) {
    const offset = i * fieldsPerCity; // 0
    const city = cities[i]!;

    citiesData[offset] = city.cityId;
    citiesData[offset + 1] = city.latitude;
    citiesData[offset + 2] = city.longitude;
    citiesData[offset + 3] = city.temperature;
  }

  return citiesData;
}
