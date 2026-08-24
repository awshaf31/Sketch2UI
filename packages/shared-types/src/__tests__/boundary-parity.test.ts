import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { insideFraction } from "../boundary-geometry.js";

// PARITY CONTRACT — see packages/shared-types/fixtures/boundary-overlap-parity.json.
//
// The same fixture file is executed by the Python suite in
// services/cv-worker/tests/test_boundary_parity.py against boundary_filter.py. Both must
// pass. This is what keeps the two language implementations from drifting apart, since
// a cross-language algorithm cannot simply be de-duplicated the way the split hash was.

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../fixtures/boundary-overlap-parity.json");

interface Fixture {
  tolerance: number;
  cases: { name: string; box: number[]; polygon: number[][]; expected: number }[];
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf-8")) as Fixture;

describe("boundary overlap parity (TypeScript side)", () => {
  it("has cases to run", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const testCase of fixture.cases) {
    it(testCase.name, () => {
      const [x, y, width, height] = testCase.box;
      const actual = insideFraction(
        { x, y, width, height },
        testCase.polygon as [number, number][]
      );
      expect(Math.abs(actual - testCase.expected)).toBeLessThan(fixture.tolerance);
    });
  }
});
