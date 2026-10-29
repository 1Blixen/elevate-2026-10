export type CityWeather = {
  cityId: number;
  latitude: number;
  longitude: number;
  temperature: number;
};

export function citiesGen(count: number): CityWeather[] {
  return Array.from({ length: count }, (_, i) => ({
    cityId: i + 1,
    latitude: Math.random() * 180 - 90,
    longitude: Math.random() * 360 - 180,
    temperature: Math.floor(Math.random() * 46) - 10,
  }));
}
