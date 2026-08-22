"""Tests for the shared desktop and extension dictionary store."""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import dictionary  # noqa: E402
import main  # noqa: E402


@pytest.fixture
def dictionary_file(tmp_path, monkeypatch):
    monkeypatch.setattr(dictionary, "app_data_dir", lambda: tmp_path)
    return tmp_path / dictionary.DICTIONARY_FILENAME


def test_dictionary_normalization_preserves_first_spelling():
    assert dictionary.normalize_words(
        [" Lexicon ", "lexicon", "", None, "Custom Term"],
    ) == ["Lexicon", "Custom Term"]


def test_add_remove_are_idempotent_and_increment_revision(dictionary_file):
    assert dictionary.get_dictionary() == {"words": [], "revision": 0}

    added = dictionary.add_word("  Lexicon  ")
    assert added == {
        "words": ["Lexicon"],
        "revision": 1,
        "word": "Lexicon",
        "added": True,
    }
    assert dictionary.add_word("lexicon") == {
        "words": ["Lexicon"],
        "revision": 1,
        "word": "Lexicon",
        "added": False,
    }

    removed = dictionary.remove_word("LEXICON")
    assert removed == {
        "words": [],
        "revision": 2,
        "word": "Lexicon",
        "removed": True,
    }
    assert dictionary.remove_word("lexicon") == {
        "words": [],
        "revision": 2,
        "word": "lexicon",
        "removed": False,
    }

    assert json.loads(dictionary_file.read_text(encoding="utf-8")) == {
        "version": 1,
        "revision": 2,
        "words": [],
    }


def test_concurrent_delta_adds_do_not_overwrite_each_other(dictionary_file):
    words = [f"word-{index}" for index in range(16)]
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(dictionary.add_word, words))

    snapshot = dictionary.get_dictionary()
    assert set(snapshot["words"]) == set(words)
    assert snapshot["revision"] == len(words)


def test_dictionary_endpoints_return_the_canonical_snapshot(dictionary_file):
    assert main.dictionary_get() == {
        "ok": True,
        "words": [],
        "revision": 0,
    }

    added = main.dictionary_add(main.DictionaryWordRequest(word="Lexicon"))
    assert added == {
        "ok": True,
        "words": ["Lexicon"],
        "revision": 1,
        "word": "Lexicon",
        "added": True,
    }

    removed = main.dictionary_remove(main.DictionaryWordRequest(word="lexicon"))
    assert removed == {
        "ok": True,
        "words": [],
        "revision": 2,
        "word": "Lexicon",
        "removed": True,
    }


def test_desktop_and_extension_delta_clients_converge(dictionary_file):
    desktop_add = main.dictionary_add(main.DictionaryWordRequest(word="Desktop"))
    extension_add = main.dictionary_add(
        main.DictionaryWordRequest(word="Extension"),
    )
    desktop_remove = main.dictionary_remove(
        main.DictionaryWordRequest(word="Desktop"),
    )

    assert desktop_add["words"] == ["Desktop"]
    assert extension_add["words"] == ["Desktop", "Extension"]
    assert desktop_remove["words"] == ["Extension"]
    assert desktop_remove["revision"] == 3
    assert main.dictionary_get()["words"] == ["Extension"]


def test_grammar_checks_include_the_canonical_dictionary(monkeypatch):
    seen = {}

    def fake_get_dictionary():
        return {"words": ["Lexicon"], "revision": 4}

    def fake_check_text(text, language, ignore):
        seen.update(text=text, language=language, ignore=ignore)
        return []

    monkeypatch.setattr(main, "get_dictionary", fake_get_dictionary)
    monkeypatch.setattr(main, "check_text", fake_check_text)

    response = main.grammar_check(
        main.GrammarRequest(
            text="Lexicon is ready.",
            language="en-GB",
            ignore=["project-term"],
        ),
    )

    assert response == {"matches": []}
    assert seen == {
        "text": "Lexicon is ready.",
        "language": "en-GB",
        "ignore": ["project-term", "Lexicon"],
    }


def test_dictionary_rejects_empty_words(dictionary_file):
    with pytest.raises(ValueError):
        dictionary.add_word("  ")
    with pytest.raises(ValueError):
        dictionary.remove_word("")
