"""Tests for proper-noun / NER spelling shields in LanguageTool results."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from languagetool import filter_proper_noun_spelling_matches  # noqa: E402


def _spell(offset, length, token, suggestion='x'):
    return {
        'offset': offset,
        'length': length,
        'message': f'Possible spelling mistake found: {token}',
        'replacements': [suggestion],
        'rule': {'id': 'MORFOLOGIK_RULE_EN_US', 'description': 'Possible spelling mistake'},
    }


def test_mid_sentence_titlecase_spelling_is_suppressed():
    text = 'We visited Bramley last autumn.'
    offset = text.index('Bramley')
    matches = [_spell(offset, len('Bramley'), 'Bramley', 'Brambly')]

    assert filter_proper_noun_spelling_matches(text, matches) == []


def test_sentence_initial_titlecase_spelling_is_kept():
    text = 'Bramley is a small village.'
    matches = [_spell(0, len('Bramley'), 'Bramley', 'Brambly')]

    assert filter_proper_noun_spelling_matches(text, matches) == matches


def test_common_titlecase_typo_near_dictionary_word_is_kept():
    text = 'I saw Teh dog run.'
    offset = text.index('Teh')
    matches = [_spell(offset, len('Teh'), 'Teh', 'The')]

    assert filter_proper_noun_spelling_matches(text, matches) == matches


def test_repeated_titlecase_entity_suppresses_later_spelling_flags():
    text = 'Kwai arrived early. Later, Kwai left quietly.'
    first = text.index('Kwai')
    second = text.index('Kwai', first + 1)
    matches = [
        _spell(first, len('Kwai'), 'Kwai', 'Quay'),
        _spell(second, len('Kwai'), 'Kwai', 'Quay'),
    ]

    filtered = filter_proper_noun_spelling_matches(text, matches)

    assert filtered == matches[:1]


def test_non_spelling_rules_are_unchanged():
    text = 'We visited Bramley last autumn.'
    offset = text.index('Bramley')
    matches = [
        {
            'offset': offset,
            'length': len('Bramley'),
            'message': 'Style',
            'replacements': ['the village'],
            'rule': {'id': 'STYLE_HINT', 'description': 'Style'},
        }
    ]

    assert filter_proper_noun_spelling_matches(text, matches) == matches


def test_lowercase_spelling_flags_are_unchanged():
    text = 'I recieved the package.'
    offset = text.index('recieved')
    matches = [_spell(offset, len('recieved'), 'recieved', 'received')]

    assert filter_proper_noun_spelling_matches(text, matches) == matches
