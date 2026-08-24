"""PARITY CONTRACT — see packages/shared-types/fixtures/boundary-overlap-parity.json.

The same fixture file is executed by the TypeScript suite in
packages/shared-types/src/__tests__/boundary-parity.test.ts against
boundary-geometry.ts. Both must pass. This is what keeps the two language
implementations from drifting apart, since a cross-language algorithm cannot simply be
de-duplicated the way the split hash was.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.preprocessing.boundary_filter import inside_fraction

FIXTURE_PATH = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared-types"
    / "fixtures"
    / "boundary-overlap-parity.json"
)

_fixture = json.loads(FIXTURE_PATH.read_text())
TOLERANCE = _fixture["tolerance"]
CASES = _fixture["cases"]


def test_fixture_has_cases() -> None:
    assert len(CASES) > 0


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_overlap_matches_fixture(case: dict) -> None:
    actual = inside_fraction(
        tuple(case["box"]),
        [tuple(point) for point in case["polygon"]],
    )
    assert abs(actual - case["expected"]) < TOLERANCE, (
        f"{case['name']}: got {actual!r}, fixture expects {case['expected']!r}. "
        "If this is an intended behaviour change, update the fixture AND re-run the "
        "TypeScript parity suite in the same commit."
    )
