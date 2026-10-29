import type { CityWeather } from "./citiesGen.ts";

export function sharedArrayBufferToCity(
  citiesData: Float64Array<SharedArrayBuffer>,
): CityWeather[] {
  const fieldsPerCity = 4;
  const cities: CityWeather[] = [];

  for (let i = 0; i < citiesData.length / fieldsPerCity; i++) {
    const offset = i * fieldsPerCity;
    const city: CityWeather = {
      cityId: citiesData[offset],
      latitude: citiesData[offset + 1],
      longitude: citiesData[offset + 2],
      temperature: citiesData[offset + 3],
    };
    cities.push(city);
  }

  return cities;
}
