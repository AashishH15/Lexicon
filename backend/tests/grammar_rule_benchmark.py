"""Deterministic before/after benchmark for custom grammar enhancements."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "grammar_rule_corpus.json"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from grammar_enhancements import enhance_matches  # noqa: E402


def _load_cases() -> list[dict[str, Any]]:
    with FIXTURE_PATH.open(encoding="utf-8") as fixture:
        cases = json.load(fixture)
    if not isinstance(cases, list):
        raise ValueError("The grammar benchmark fixture must contain a list.")
    return cases


def _utf16_to_python_index(text: str, offset: int) -> int | None:
    if offset < 0:
        return None
    units = 0
    for index, character in enumerate(text):
        if units == offset:
            return index
        units += 2 if ord(character) > 0xFFFF else 1
    return len(text) if units == offset else None


def _match_signature(
    text: str, match: dict[str, Any]
) -> tuple[str, str, int, int]:
    offset = int(match["offset"])
    length = int(match["length"])
    start = _utf16_to_python_index(text, offset)
    end = _utf16_to_python_index(text, offset + length)
    original = text[start:end] if start is not None and end is not None else ""
    replacements = match.get("replacements") or []
    replacement = str(replacements[0]) if replacements else ""
    return original, replacement, offset, length


def _expected_signature(
    expected: dict[str, Any],
) -> tuple[str, str, int | None]:
    return (
        str(expected["original"]),
        str(expected["replacement"]),
        int(expected["offset"]) if "offset" in expected else None,
    )


def _score_case(
    case: dict[str, Any], enhancer=enhance_matches
) -> dict[str, Any]:
    text = str(case.get("text", ""))
    language = str(case.get("language", "en-US"))
    expected = [_expected_signature(item) for item in case.get("expected", [])]
    actual_matches = enhancer(text, [], language)
    actual = [_match_signature(text, match) for match in actual_matches]
    remaining = list(actual)
    true_positives = 0
    original_hits = 0
    correct_replacements = 0
    offset_errors = 0

    for original, replacement, expected_offset in expected:
        exact_index = next(
            (
                index
                for index, candidate in enumerate(remaining)
                if candidate[0] == original
                and candidate[1] == replacement
                and (expected_offset is None or candidate[2] == expected_offset)
            ),
            None,
        )
        if exact_index is not None:
            candidate = remaining.pop(exact_index)
            true_positives += 1
            original_hits += 1
            correct_replacements += 1
            continue

        diagnostic_index = next(
            (
                index
                for index, candidate in enumerate(remaining)
                if candidate[0] == original
            ),
            None,
        )
        if diagnostic_index is None:
            expected_length = len(original.encode("utf-16-le")) // 2
            diagnostic_index = next(
                (
                    index
                    for index, candidate in enumerate(remaining)
                    if candidate[1] == replacement
                    and candidate[3] == expected_length
                ),
                None,
            )
        if diagnostic_index is None:
            continue
        candidate = remaining.pop(diagnostic_index)
        original_matches = candidate[0] == original
        replacement_matches = candidate[1] == replacement
        if original_matches:
            original_hits += 1
        if original_matches and replacement_matches:
            correct_replacements += 1
        if expected_offset is not None and candidate[2] != expected_offset:
            offset_errors += 1

    return {
        "id": case.get("id", ""),
        "expected": len(expected),
        "actual": len(actual),
        "true_positives": true_positives,
        "false_positives": len(actual) - true_positives,
        "false_negatives": len(expected) - true_positives,
        "original_hits": original_hits,
        "correct_replacements": correct_replacements,
        "offset_errors": offset_errors,
        "actual_matches": actual,
    }


def run_benchmark(
    iterations: int = 100, enhancer=enhance_matches
) -> dict[str, Any]:
    if iterations < 1:
        raise ValueError("iterations must be at least 1")
    cases = _load_cases()
    scored_cases = [_score_case(case, enhancer) for case in cases]
    expected = sum(case["expected"] for case in scored_cases)
    actual = sum(case["actual"] for case in scored_cases)
    true_positives = sum(case["true_positives"] for case in scored_cases)
    false_positives = sum(case["false_positives"] for case in scored_cases)
    false_negatives = sum(case["false_negatives"] for case in scored_cases)
    original_hits = sum(case["original_hits"] for case in scored_cases)
    correct_replacements = sum(
        case["correct_replacements"] for case in scored_cases
    )
    offset_errors = sum(case["offset_errors"] for case in scored_cases)

    durations = []
    for _ in range(iterations):
        started = time.perf_counter()
        for case in cases:
            enhancer(
                str(case.get("text", "")),
                [],
                str(case.get("language", "en-US")),
            )
        durations.append((time.perf_counter() - started) * 1000)

    precision = true_positives / actual if actual else 1.0
    recall = true_positives / expected if expected else 1.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )

    return {
        "fixture": str(FIXTURE_PATH),
        "cases": len(cases),
        "expected_matches": expected,
        "actual_matches": actual,
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "original_hits": original_hits,
        "replacement_accuracy": (
            correct_replacements / original_hits if original_hits else 1.0
        ),
        "offset_errors": offset_errors,
        "latency_ms_per_fixture": {
            "p50": statistics.median(durations),
            "p95": sorted(durations)[max(0, int(iterations * 0.95) - 1)],
        },
        "case_results": scored_cases,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=100)
    args = parser.parse_args()
    print(json.dumps(run_benchmark(args.iterations), indent=2))


if __name__ == "__main__":
    main()
