
export function citiesGen(count: number): Float64Array {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("Count must be a positive safe integer");
  }

  const fieldsPerCity = 4;
  const totalValues = count * fieldsPerCity;
  const totalBytes = totalValues * Float64Array.BYTES_PER_ELEMENT;

  if (!Number.isSafeInteger(totalBytes)) {
    throw new Error("Requested dataset is too large");
  }

  const sharedBuffer = new SharedArrayBuffer(totalBytes);
  const citiesData = new Float64Array(sharedBuffer);

  for (let i = 0; i < count; i++) {
    const offset = i * fieldsPerCity;

    // Each city occupies four consecutive values:
    // cityId, latitude, longitude, temperature.
    citiesData[offset] = i + 1;
    citiesData[offset + 1] = Math.random() * 180 - 90;
    citiesData[offset + 2] = Math.random() * 360 - 180;
    citiesData[offset + 3] = Math.floor(Math.random() * 46) - 10;
  }

  return citiesData;
}
