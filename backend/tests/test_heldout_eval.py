"""Tests for held-out grammar eval corpora and benchmark modes."""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from grammar_rule_benchmark import (  # noqa: E402
    _load_cases,
    _score_case,
    run_benchmark,
)

from grammar_enhancements import enhance_matches  # noqa: E402

CLEAN_CORPUS = "heldout_clean"
ERRORS_CORPUS = "heldout_errors"
DOMAINS = {"technical", "academic", "business", "casual"}


def _texts(cases):
    return [str(case.get("text", "")) for case in cases]


def test_clean_corpus_has_sixty_clean_cases_across_four_domains():
    cases = _load_cases(CLEAN_CORPUS)

    assert len(cases) == 60
    for case in cases:
        assert case.get("expected", []) == []
        assert case.get("domain") in DOMAINS
    for domain in DOMAINS:
        assert sum(1 for case in cases if case.get("domain") == domain) >= 10


def test_errors_corpus_has_fifty_unseen_errors():
    cases = _load_cases(ERRORS_CORPUS)

    assert len(cases) == 50
    for case in cases:
        expected = case.get("expected", [])
        assert len(expected) >= 1
        for item in expected:
            assert str(item["original"]) in str(case.get("text", ""))
            assert str(item["replacement"]) != str(item["original"])


def test_heldout_texts_do_not_repeat_training_texts():
    training = set(_texts(_load_cases()))
    for corpus in (CLEAN_CORPUS, ERRORS_CORPUS):
        for text in _texts(_load_cases(corpus)):
            assert text not in training


def test_clean_corpus_has_no_custom_rule_flags():
    for case in _load_cases(CLEAN_CORPUS):
        text = str(case.get("text", ""))
        language = str(case.get("language", "en-US"))
        assert enhance_matches(text, [], language) == []


def test_errors_corpus_expected_matches_are_found():
    missing = []
    for case in _load_cases(ERRORS_CORPUS):
        result = _score_case(case)
        if result["true_positives"] != result["expected"]:
            missing.append(case.get("id", ""))
    assert missing == []


def test_benchmark_defaults_keep_old_shape():
    summary = run_benchmark(iterations=1)

    assert summary["mode"] == "custom-only"
    assert summary["cases"] == len(_load_cases())
    assert summary["expected_matches"] >= 1
    assert summary["total_words"] >= 1
    assert summary["fp_per_1000_words"] == pytest.approx(0.0)


def test_benchmark_reports_false_positives_per_thousand_words():
    def _flag_all(text, _matches, _language="en-US"):
        del text, _matches, _language
        return [
            {
                "offset": 0,
                "length": 1,
                "message": "Forced",
                "replacements": ["x"],
                "rule": {"id": "TEST", "description": ""},
            }
        ]

    summary = run_benchmark(iterations=1, corpus=CLEAN_CORPUS, enhancer=_flag_all)
    words = summary["total_words"]

    assert words == sum(
        len(text.split()) for text in _texts(_load_cases(CLEAN_CORPUS))
    )
    assert summary["false_positives"] == summary["cases"]
    assert summary["fp_per_1000_words"] == pytest.approx(
        summary["cases"] / words * 1000
    )


def test_benchmark_combined_mode_uses_stub_checker():
    def _stub_checker(text, language="en-US", level="picky"):
        del level
        assert language.startswith("en")
        return []

    summary = run_benchmark(
        iterations=1, mode="combined", corpus=CLEAN_CORPUS, lt_checker=_stub_checker
    )

    assert summary["mode"] == "combined"
    assert summary["false_positives"] == 0
    assert summary["false_negatives"] == 0


def test_benchmark_lt_modes_score_stub_matches():
    def _stub_checker(text, language="en-US", level="picky"):
        del text, language, level
        return [
            {
                "offset": 0,
                "length": 5,
                "message": "Stub",
                "replacements": ["Hello"],
                "rule": {"id": "STUB", "description": ""},
            }
        ]

    summary = run_benchmark(
        iterations=1, mode="lt-picky", corpus=CLEAN_CORPUS, lt_checker=_stub_checker
    )

    assert summary["mode"] == "lt-picky"
    assert summary["actual_matches"] == summary["cases"]
    assert summary["false_positives"] == summary["cases"]


def test_benchmark_rejects_unknown_mode_and_corpus():
    with pytest.raises(ValueError):
        run_benchmark(iterations=1, mode="unknown-mode")
    with pytest.raises(ValueError):
        run_benchmark(iterations=1, corpus="unknown-corpus")


def test_live_checker_reports_clear_error_without_server(monkeypatch):
    from grammar_rule_benchmark import _live_lt_matches

    import languagetool

    def _no_server():
        raise RuntimeError("no Java")

    monkeypatch.setattr(languagetool, "_ensure_local_server", _no_server)

    with pytest.raises(RuntimeError, match="LanguageTool server"):
        _live_lt_matches("Hello.", "en-US", "picky")
