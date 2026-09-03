"""Tests for context-based English grammar enhancements."""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from grammar_enhancements import enhance_matches  # noqa: E402
from grammar_rule_benchmark import _load_cases, _score_case  # noqa: E402


def _corrections(text, matches):
    return [
        (
            text.encode("utf-16-le")[
                match["offset"] * 2 : (match["offset"] + match["length"]) * 2
            ].decode("utf-16-le"),
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


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "Please advice me before the meeting.",
            ("advice", "advise"),
        ),
        (
            "She gave me good advise.",
            ("advise", "advice"),
        ),
        (
            "Remember to breath slowly.",
            ("breath", "breathe"),
        ),
        (
            "Take a deep breathe.",
            ("breathe", "breath"),
        ),
        (
            "The school principle addressed the students.",
            ("principle", "principal"),
        ),
        (
            "The guiding principal is fairness.",
            ("principal", "principle"),
        ),
        (
            "She has past the exam.",
            ("past", "passed"),
        ),
        (
            "We walked passed the store.",
            ("passed", "past"),
        ),
        (
            "She lead the team yesterday.",
            ("lead", "led"),
        ),
        (
            "It had a strong affect on sales.",
            ("affect", "effect"),
        ),
        (
            "The policy will effect everyone.",
            ("effect", "affect"),
        ),
    ],
)
def test_high_confidence_confusion_pairs_are_detected(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "I don't want to loose my keys.",
            ("loose", "lose"),
        ),
        (
            "The shirt has a lose fit.",
            ("lose", "loose"),
        ),
        (
            "Please except my apology.",
            ("except", "accept"),
        ),
        (
            "Everyone accept John was invited.",
            ("accept", "except"),
        ),
        (
            "She gave me a nice complement.",
            ("complement", "compliment"),
        ),
        (
            "The red shoes compliment her outfit.",
            ("compliment", "complement"),
        ),
    ],
)
def test_additional_high_confidence_confusion_pairs_are_detected(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "She ate a apple.",
            ("a", "an"),
        ),
        (
            "He is an university student.",
            ("an", "a"),
        ),
    ],
)
def test_a_an_confusion_is_detected(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text",
    [
        "I don't want to lose my keys.",
        "The shirt has a loose fit.",
        "Please accept my apology.",
        "Everyone except John was invited.",
        "She gave me a nice compliment.",
        "The red shoes complement her outfit.",
        "She ate an apple.",
        "He is a university student.",
        "She waited for an hour.",
        "He made a useful suggestion.",
    ],
)
def test_new_confusion_rules_do_not_flag_valid_contexts(text):
    assert enhance_matches(text, []) == []


def test_a_an_offsets_use_utf16_units():
    text = "😀 She ate a apple."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [("a", "an")]
    assert matches[0]["offset"] == 11
    assert matches[0]["length"] == 1


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "I don't have no money.",
            ("no", "any"),
        ),
        (
            "She doesn't know nothing.",
            ("nothing", "anything"),
        ),
        (
            "We didn't go nowhere.",
            ("nowhere", "anywhere"),
        ),
        (
            "He can't find nobody.",
            ("nobody", "anybody"),
        ),
        (
            "I do not have no reason to worry.",
            ("no", "any"),
        ),
        (
            "They never said nothing.",
            ("nothing", "anything"),
        ),
    ],
)
def test_double_negatives_are_detected(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text",
    [
        "I don't have any money.",
        "She doesn't know anything.",
        "We didn't go anywhere.",
        "He can't find anybody.",
        "I have no reason to worry.",
        "Nobody called.",
        "The result is not impossible.",
        "The change is not uncommon.",
        "I don't know. Nobody called.",
        "I don't know, nobody called.",
        "I don't know whether nobody called.",
        "I don't know if nothing changed.",
        "I don't think it's no longer relevant.",
    ],
)
def test_valid_negative_contexts_are_not_flagged(text):
    assert enhance_matches(text, []) == []


def test_double_negative_offsets_use_utf16_units():
    text = "😀 I don't have no money."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [("no", "any")]
    assert matches[0]["offset"] == 16
    assert matches[0]["length"] == 2


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "Hello , world.",
            (" ,", ","),
        ),
        (
            "What ?",
            (" ?", "?"),
        ),
        (
            "Wait ; continue.",
            (" ;", ";"),
        ),
        (
            "See ( this",
            ("( ", "("),
        ),
        (
            "See [ item",
            ("[ ", "["),
        ),
        (
            "See item )",
            (" )", ")"),
        ),
        (
            "What??",
            ("??", "?"),
        ),
        (
            "Stop!!",
            ("!!", "!"),
        ),
    ],
)
def test_punctuation_spacing_and_repetition_are_detected(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "However we left.",
            ("However", "However,"),
        ),
        (
            "It was late. Therefore we left.",
            ("Therefore", "Therefore,"),
        ),
        (
            "For example this works.",
            ("For example", "For example,"),
        ),
        (
            "I went home, it was late.",
            (",", ";"),
        ),
        (
            "The meeting ended, everyone left.",
            (",", ";"),
        ),
    ],
)
def test_sentence_level_punctuation_is_detected(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text",
    [
        "Hello, world.",
        "What?",
        "Wait; continue.",
        "See (this).",
        "See [item].",
        "What?!",
        "Wait...",
        "However, we left.",
        "For example, this works.",
        "It was late. Therefore, we left.",
        "I went home, and it was late.",
        "When I arrived, it was late.",
        "Although it rained, we left.",
        "He said however we left.",
    ],
)
def test_valid_punctuation_contexts_are_not_flagged(text):
    assert enhance_matches(text, []) == []


def test_punctuation_matches_use_punctuation_metadata():
    matches = enhance_matches("Hello , world.", [])

    assert matches[0]["rule"]["id"] == "LEXICON_PUNCTUATION"
    assert matches[0]["rule"]["description"] == "Lexicon punctuation rule"


def test_punctuation_match_replaces_an_overlapping_engine_match():
    text = "Hello , world."
    base_match = {
        "offset": 6,
        "length": 1,
        "message": "Existing comma match",
        "replacements": [","],
        "rule": {"id": "PUNCT_BASE"},
    }

    matches = enhance_matches(text, [base_match])

    assert _corrections(text, matches) == [(" ,", ",")]
    assert matches[0]["rule"]["id"] == "LEXICON_PUNCTUATION"


@pytest.mark.parametrize("language", ["en-US", "en-GB"])
def test_punctuation_rules_run_for_selected_english_locales(language):
    matches = enhance_matches("Hello , world.", [], language)

    assert _corrections("Hello , world.", matches) == [(" ,", ",")]


def test_punctuation_rules_do_not_run_for_non_english_text():
    text = "Hello , world."
    base_match = {
        "offset": 0,
        "length": 5,
        "message": "Existing match",
        "replacements": ["Hello"],
        "rule": {"id": "TEST"},
    }

    assert enhance_matches(text, [base_match], "fr-FR") == [base_match]


def test_punctuation_offsets_use_utf16_units():
    text = "😀 Hello , world."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [(" ,", ",")]
    assert matches[0]["offset"] == 8
    assert matches[0]["length"] == 2


def test_punctuation_rule_is_filtered_by_user_dictionary(monkeypatch):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_check_local", lambda *_args: [])

    assert languagetool.check_text(
        "Hello , world.",
        ignore=[","],
    ) == []


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "The dogs in the yard barks loudly.",
            ("barks", "bark"),
        ),
        (
            "The report from the managers are incomplete.",
            ("are", "is"),
        ),
    ],
)
def test_subject_verb_agreement_survives_intervening_prepositional_phrases(
    text, expected
):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "The proposal from the engineers are incomplete.",
            ("are", "is"),
        ),
        (
            "The engineers in the laboratory works efficiently.",
            ("works", "work"),
        ),
        (
            "The results of the latest experiment shows a problem.",
            ("shows", "show"),
        ),
        (
            "The result of the latest experiments show a problem.",
            ("show", "shows"),
        ),
        (
            "The children in the courtyard is noisy.",
            ("is", "are"),
        ),
        (
            "The device from the labs have errors.",
            ("have", "has"),
        ),
        (
            "The researcher in the labs do careful work.",
            ("do", "does"),
        ),
        (
            "The senior researchers in the laboratory works efficiently.",
            ("works", "work"),
        ),
        (
            "The analysis of the samples are complete.",
            ("are", "is"),
        ),
        (
            "The analyses of the samples is complete.",
            ("is", "are"),
        ),
        (
            "Many researchers in the laboratory works efficiently.",
            ("works", "work"),
        ),
        (
            "Each researcher in the laboratory work efficiently.",
            ("work", "works"),
        ),
    ],
)
def test_general_pos_lite_agreement_handles_unlisted_subjects(text, expected):
    assert _corrections(text, enhance_matches(text, [])) == [expected]


@pytest.mark.parametrize(
    "text",
    [
        "The proposal from the engineers is incomplete.",
        "The engineers in the laboratory work efficiently.",
        "The results of the latest experiment show a problem.",
        "The result of the latest experiments shows a problem.",
        "The analysis of the samples is complete.",
        "The news from the station is surprising.",
        "The engineers work efficiently.",
        "They reviewed the proposal from the engineers.",
        "The reports from the team that works are complete.",
        "The series of tests is complete.",
        "The researchers in the lab\nworks efficiently.",
    ],
)
def test_general_pos_lite_agreement_does_not_flag_valid_contexts(text):
    assert enhance_matches(text, []) == []


def test_general_pos_lite_agreement_preserves_utf16_offsets():
    text = "😀 The researchers in the laboratory works efficiently."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [("works", "work")]
    expected_offset = len(
        "😀 The researchers in the laboratory ".encode("utf-16-le")
    ) // 2
    assert matches[0]["offset"] == expected_offset
    assert matches[0]["length"] == len("works")


@pytest.mark.parametrize(
    "text",
    [
        "Please advise me before the meeting.",
        "She gave me good advice.",
        "Remember to breathe slowly.",
        "Take a deep breath.",
        "The school principal addressed the students.",
        "The guiding principle is fairness.",
        "She has passed the exam.",
        "We walked past the store.",
        "She led the team yesterday.",
        "It had a strong effect on sales.",
        "The policy will affect everyone.",
        "The dogs in the yard bark loudly.",
        "The report from the managers is incomplete.",
        "The news from the station is surprising.",
        "The dogs in the yard\nbarks loudly.",
    ],
)
def test_high_confidence_rules_do_not_flag_valid_contexts(text):
    assert enhance_matches(text, []) == []


def test_custom_rule_offsets_use_utf16_units():
    text = "😀 Please advice me."
    matches = enhance_matches(text, [])

    assert _corrections(text, matches) == [("advice", "advise")]
    assert matches[0]["offset"] == 10
    assert matches[0]["length"] == len("advice")
    encoded = text.encode("utf-16-le")
    start = matches[0]["offset"] * 2
    end = start + matches[0]["length"] * 2
    assert encoded[start:end].decode("utf-16-le") == "advice"


def _utf16_offset(text, python_index):
    return len(text[:python_index].encode("utf-16-le")) // 2


def test_filter_ignored_keeps_match_when_ignore_matches_python_slice_only():
    import languagetool

    text = "😀 bad"
    match = {
        "offset": 3,
        "length": 3,
        "message": "Ignored",
        "replacements": [],
        "rule": {"id": "RULE", "description": ""},
    }

    assert languagetool._filter_ignored([match], text, ["ad"]) == [match]


def test_filter_ignored_removes_ignored_word_after_emoji():
    import languagetool

    text = "😀 bad"
    match = {
        "offset": 3,
        "length": 3,
        "message": "Ignored",
        "replacements": [],
        "rule": {"id": "RULE", "description": ""},
    }

    assert languagetool._filter_ignored([match], text, ["bad"]) == []


def test_check_text_keeps_match_when_ignore_matches_python_slice_only(
    monkeypatch,
):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_check_local", lambda *_args: [])
    text = "😀 Please advice me."

    matches = languagetool.check_text(text, ignore=["dvice"])

    assert _corrections(text, matches) == [("advice", "advise")]


def test_check_text_filters_ignored_word_after_emoji(monkeypatch):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_check_local", lambda *_args: [])
    text = "😀 Please advice me."

    assert languagetool.check_text(text, ignore=["advice"]) == []


def test_overlapping_engine_match_uses_utf16_offsets():
    text = "😀 They are over they're."
    python_start = text.rfind("they're")
    base_match = {
        "offset": _utf16_offset(text, python_start),
        "length": len("they're"),
        "message": "Contraction at sentence end",
        "replacements": ["they are"],
        "rule": {"id": "CONTRACTION_ENDS"},
    }

    matches = enhance_matches(text, [base_match])

    assert _corrections(text, matches) == [("they're", "there")]


def test_combined_pipeline_match_decodes_with_utf16_slice(monkeypatch):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)

    def _fake_local(_text, _language="en-US"):
        return [
            {
                "offset": 3,
                "length": 3,
                "message": "Spelling",
                "replacements": ["bad"],
                "rule": {"id": "SPELL", "description": ""},
            }
        ]

    monkeypatch.setattr(languagetool, "_check_local", _fake_local)
    text = "😀 bad"

    matches = languagetool.check_text(text)

    assert len(matches) == 1
    encoded = text.encode("utf-16-le")
    start = matches[0]["offset"] * 2
    end = start + matches[0]["length"] * 2
    assert encoded[start:end].decode("utf-16-le") == "bad"


def test_custom_rule_is_filtered_by_user_dictionary(monkeypatch):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_check_local", lambda *_args: [])

    assert languagetool.check_text(
        "Please advice me.",
        ignore=["advice"],
    ) == []


def test_double_negative_rule_is_filtered_by_user_dictionary(monkeypatch):
    import languagetool

    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_check_local", lambda *_args: [])

    assert languagetool.check_text(
        "I don't have no money.",
        ignore=["no"],
    ) == []


@pytest.mark.parametrize(
    "case",
    _load_cases(),
    ids=lambda case: case["id"],
)
def test_fixed_grammar_rule_corpus_has_no_regressions(case):
    result = _score_case(case)

    assert result["true_positives"] == result["expected"]
    assert result["false_positives"] == 0
    assert result["false_negatives"] == 0
    assert result["offset_errors"] == 0
