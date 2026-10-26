/**
 * Monomorphic vs. polymorphic functions — and why hot code gets fast
 *
 * V8 starts every function in the Ignition interpreter. A function that is
 * called often becomes "hot" and is tiered up to machine code:
 *
 *   Ignition (interpreter) -> Sparkplug -> Maglev -> TurboFan
 *
 * Optimized code also specializes on the *hidden classes* (maps) it has seen:
 *
 *   1 shape        monomorphic  -> the property offset is fixed, so the load
 *                                  becomes a direct field access
 *   2-4 shapes     polymorphic  -> V8 checks which map it got, then uses the
 *                                  matching offset; still fast
 *   5+ shapes      megamorphic  -> the inline cache gives up and falls back to
 *                                  a generic lookup, which is much slower
 *
 * Run:
 *   node src/monomorphic-vs-polymorphic.ts
 *
 * Watch V8 compile the hot functions:
 *   node --trace-opt --trace-deopt src/monomorphic-vs-polymorphic.ts
 */

type Point2D = { x: number; y: number };
type Point3D = { x: number; y: number; z: number };

// These two functions contain exactly the same logic.
// The difference is only what V8 sees at their call sites.
function add2D(p: Point2D): number {
  return p.x + p.y;
}

function addAnyPoint(p: Point2D | Point3D): number {
  return p.x + p.y;
}

const WARMUP_CHUNK = 100_000;
const MEASURED_CALLS = 5_000;

// points2d and points3d have different hidden classes: the 3D objects have an
// extra `z` property, so V8 creates a different map for them.
const points2d: Point2D[] = Array.from({ length: WARMUP_CHUNK }, (_, i) => ({
  x: i,
  y: i + 1,
}));

const points3d: Point3D[] = Array.from({ length: WARMUP_CHUNK }, (_, i) => ({
  x: i,
  y: i + 1,
  z: i + 2,
}));

// Every call sees the same shape -> monomorphic.
function runMono(calls: number): number {
  let sum = 0;
  for (let i = 0; i < calls; i++) {
    sum += add2D(points2d[i]);
  }
  return sum;
}

// Calls see two shapes -> polymorphic.
function runPoly(calls: number): number {
  let sum = 0;
  for (let i = 0; i < calls; i++) {
    const p = (i & 1) === 0 ? points2d[i] : points3d[i];
    sum += addAnyPoint(p);
  }
  return sum;
}

function time(label: string, run: (calls: number) => number): number {
  const start = performance.now();
  const sum = run(MEASURED_CALLS);
  const elapsed = performance.now() - start;

  console.log(`${label}: ${elapsed.toFixed(3)} ms (sum: ${sum})`);
  return elapsed;
}

// The first measured batch suffers through interpretation and JIT compilation.
const monoCold = time("monomorphic, cold", runMono);

// Call the function many times so V8 has a reason to optimize it.
let checksum = 0;
for (let i = 0; i < 20; i++) checksum += runMono(WARMUP_CHUNK);

// By now `add2D` has been optimized, so the same work is much faster.
const monoHot = time("monomorphic, hot ", runMono);
console.log(`  -> ${(monoCold / monoHot).toFixed(1)}x faster once hot\n`);

// Same experiment with two shapes at the call site.
const polyCold = time("polymorphic, cold", runPoly);

for (let i = 0; i < 20; i++) checksum += runPoly(WARMUP_CHUNK);

const polyHot = time("polymorphic, hot ", runPoly);
console.log(`  -> ${(polyCold / polyHot).toFixed(1)}x faster once hot`);

// Keep the results alive so the optimizer cannot discard the loops.
console.log(`\n(checksum: ${checksum})`);
