"""Tests for context-based English grammar enhancements."""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from grammar_enhancements import enhance_matches  # noqa: E402


def _corrections(text, matches):
    return [
        (
            text[match["offset"] : match["offset"] + match["length"]],
            match["replacements"][0],
        )
        for match in matches
    ]


def test_homophone_sentence_returns_three_corrections():
    text = "Their going to there house over they're."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [
        ("Their", "They're"),
        ("there", "their"),
        ("they're", "there"),
    ]


def test_to_too_two_sentence_returns_three_corrections():
    text = "I went too the store to buy to apples, and it was two expensive."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [
        ("too", "to"),
        ("to", "two"),
        ("two", "too"),
    ]


def test_agreement_and_past_tense_sentence_returns_two_corrections():
    text = "She receive the document yesterday and are very happy."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [
        ("receive", "received"),
        ("are", "was"),
    ]


def test_collective_subject_uses_singular_verb():
    text = "The team have finished, and is going home."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [("have", "has")]


def test_collective_subject_keeps_uk_plural_agreement():
    text = "The team have finished, and is going home."

    assert enhance_matches(text, [], "en-GB") == []


def test_possessive_confusion_is_detected():
    text = "I know your going."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [("your", "you're")]


def test_additional_confusion_pairs_are_detected():
    text = "They're car is parked over their by they're."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [
        ("They're", "Their"),
        ("their", "there"),
        ("they're", "there"),
    ]


def test_existing_match_is_replaced_when_context_rule_is_more_specific():
    text = "They are over they're."
    base_match = {
        "offset": text.rfind("they're"),
        "length": len("they're"),
        "message": "Contraction at sentence end",
        "replacements": ["they are"],
        "rule": {"id": "CONTRACTION_ENDS"},
    }

    matches = enhance_matches(text, [base_match])

    assert _corrections(text, matches) == [("they're", "there")]


def test_non_english_text_is_unchanged():
    text = "Their going to there house."
    base_match = {
        "offset": 0,
        "length": 5,
        "message": "Existing match",
        "replacements": ["Their"],
        "rule": {"id": "TEST"},
    }

    assert enhance_matches(text, [base_match], "fr-FR") == [base_match]


def test_check_text_applies_enhancements_after_language_tool(monkeypatch):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_check_local", lambda *_args: [])
    text = "I know your going."

    matches = languagetool.check_text(text)

    assert _corrections(text, matches) == [("your", "you're")]


@pytest.mark.parametrize(
    "text",
    [
        "Their house is over there.",
        "You're going to love your new desk.",
        "It was two expensive cars.",
    ],
)
def test_valid_context_is_not_flagged(text):
    assert enhance_matches(text, []) == []
