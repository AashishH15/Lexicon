import re

_RULE_ID = "LEXICON_CONTEXT"
_RULE_DESCRIPTION = "Lexicon context rule"

_POSSESSIVE_NOUNS = (
    "book|car|coat|color|colour|company|document|desk|"
    "house|idea|job|keys|life|name|phone|place|plan|problem|"
    "report|room|team|thing|time|work"
)
_POSSESSIVE_PHRASE = (
    rf"(?:new|old|own|first|next|favorite|favourite|big|small|red|blue)\s+"
    rf"(?:{_POSSESSIVE_NOUNS})|(?:{_POSSESSIVE_NOUNS})"
)
_COMMON_VERBS = (
    "going|coming|doing|working|trying|looking|using|making|"
    "taking|planning"
)
_LOCATION_PREPOSITIONS = (
    "over|by|near|from|around|under|behind|beside|between|"
    "inside|outside|at|in|on"
)
_COUNTING_VERBS = "buy|bought|choose|chose|eat|ate|order|ordered"
_PLURAL_WORD = r"[a-z][a-z-]*s"
_PAST_MARKER = r"(?:yesterday|last\s+(?:night|week|month|year)|\d+\s+days?\s+ago)"
_COMPARATIVES = (
    "more|less|better|worse|taller|shorter|older|younger|faster|slower|"
    "higher|lower|greater|smaller|bigger|earlier|later"
)
_PAST_FORMS = {
    "receive": "received",
    "walk": "walked",
    "play": "played",
    "work": "worked",
    "visit": "visited",
    "finish": "finished",
    "start": "started",
    "call": "called",
    "watch": "watched",
    "open": "opened",
    "close": "closed",
    "look": "looked",
    "talk": "talked",
    "use": "used",
    "need": "needed",
    "want": "wanted",
    "ask": "asked",
    "help": "helped",
    "clean": "cleaned",
    "cook": "cooked",
    "study": "studied",
    "try": "tried",
    "carry": "carried",
    "go": "went",
    "eat": "ate",
    "see": "saw",
    "make": "made",
    "write": "wrote",
    "take": "took",
    "come": "came",
    "do": "did",
    "say": "said",
    "run": "ran",
    "have": "had",
}
_COLLECTIVE_PLURAL_VARIANTS = {"en-au", "en-gb", "en-ie", "en-nz", "en-za"}


def _preserve_case(original: str, replacement: str) -> str:
    """Keep the first-letter case of the original word."""
    if original.isupper():
        return replacement.upper()
    if original[:1].isupper():
        return replacement.capitalize()
    return replacement


def _make_match(
    text: str,
    start: int,
    end: int,
    replacement: str,
    message: str,
) -> dict:
    original = text[start:end]
    return {
        "offset": start,
        "length": end - start,
        "message": message,
        "replacements": [_preserve_case(original, replacement)],
        "rule": {
            "id": _RULE_ID,
            "description": _RULE_DESCRIPTION,
        },
    }


def _overlaps(left: dict, right: dict) -> bool:
    left_end = left["offset"] + left["length"]
    right_end = right["offset"] + right["length"]
    return left["offset"] < right_end and right["offset"] < left_end


def _add_group_matches(
    text: str,
    candidates: list[dict],
    pattern: re.Pattern,
    replacement: str,
    message: str,
    group: str = "word",
) -> None:
    for found in pattern.finditer(text):
        start, end = found.span(group)
        candidate = _make_match(text, start, end, replacement, message)
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)


def _context_matches(text: str) -> list[dict]:
    candidates: list[dict] = []

    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>there)\s+(?=(?:{_POSSESSIVE_PHRASE})\b)",
            re.IGNORECASE,
        ),
        "their",
        'Use "their" to show possession.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>they're)\s+(?=(?:{_POSSESSIVE_PHRASE})\b)",
            re.IGNORECASE,
        ),
        "their",
        'Use "their" to show possession.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>you're)\s+(?=(?:{_POSSESSIVE_PHRASE})\b)",
            re.IGNORECASE,
        ),
        "your",
        'Use "your" to show possession.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>it's)\s+(?=(?:{_POSSESSIVE_PHRASE})\b)",
            re.IGNORECASE,
        ),
        "its",
        'Use "its" to show possession.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>who's)\s+(?=(?:{_POSSESSIVE_PHRASE})\b)",
            re.IGNORECASE,
        ),
        "whose",
        'Use "whose" to show possession.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>their|there)\s+(?:{_COMMON_VERBS})\b"
            r"(?=\s+(?:to|on|for|with)\b|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "they're",
        'Use "they\'re" when you mean "they are".',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>your)\s+(?:{_COMMON_VERBS})\b"
            r"(?=\s+(?:to|on|for|with)\b|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "you're",
        'Use "you\'re" when you mean "you are".',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?P<word>its)\s+(?:{_COMMON_VERBS})\b"
            r"(?=\s+(?:to|on|for|with)\b|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "it's",
        'Use "it\'s" when you mean "it is".',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?P<word>whose)\s+(?:coming|going)\b"
            r"(?=\s+(?:tonight|tomorrow|here|there|now)\b)",
            re.IGNORECASE,
        ),
        "who's",
        'Use "who\'s" when you mean "who is".',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(r"\b(?P<word>your)\s+welcome\b", re.IGNORECASE),
        "you're",
        'Use "you\'re" when you mean "you are".',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_LOCATION_PREPOSITIONS})\s+(?P<word>they're)\b",
            re.IGNORECASE,
        ),
        "there",
        'Use "there" for a place.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_LOCATION_PREPOSITIONS})\s+(?P<word>their)\b"
            r"(?=\s+(?:by|near|over)\b|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "there",
        'Use "there" for a place.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_COMPARATIVES})\s+(?P<word>then)\b",
            re.IGNORECASE,
        ),
        "than",
        'Use "than" for a comparison.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:could|would|should|might|must)\s+(?P<word>of)\b",
            re.IGNORECASE,
        ),
        "have",
        'Use "have" after a modal verb.',
    )

    return candidates


def _to_too_two_matches(text: str) -> list[dict]:
    candidates: list[dict] = []

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?P<word>too)\s+"
            r"(?=(?:the|a|an|my|your|his|her|our|their|this|that|these|those)\b)",
            re.IGNORECASE,
        ),
        "to",
        'Use "to" for direction or an infinitive.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_COUNTING_VERBS})\s+(?P<word>to)\s+(?P<noun>{_PLURAL_WORD})\b",
            re.IGNORECASE,
        ),
        "two",
        'Use "two" for the number 2.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:is|was|are|were|be|seems?|looks?|feels?)\s+"
            r"(?P<word>two)\s+[a-z-]+(?=[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "too",
        'Use "too" to mean excessively.',
    )

    return candidates


def _agreement_matches(text: str, language: str) -> list[dict]:
    candidates: list[dict] = []

    if language.lower() not in _COLLECTIVE_PLURAL_VARIANTS:
        for found in re.finditer(
            r"\b(?:the|a|an)?\s*"
            r"(?P<subject>team|committee|company|government|family|group|"
            r"class|staff|audience|department|organization|organisation)\s+"
            r"(?P<word>have|are|were)\b",
            text,
            re.IGNORECASE,
        ):
            original = found.group("word").lower()
            replacement = "has" if original == "have" else "is"
            if original == "were":
                replacement = "was"
            start, end = found.span("word")
            candidate = _make_match(
                text,
                start,
                end,
                replacement,
                "Use the singular verb with this singular subject.",
            )
            if not any(_overlaps(candidate, existing) for existing in candidates):
                candidates.append(candidate)
    for found in re.finditer(
        r"\b(?:each|every|neither|either)\s+of\b[^.!?]{0,60}?"
        r"\b(?P<word>have|are|were)\b",
        text,
        re.IGNORECASE,
    ):
        original = found.group("word").lower()
        replacement = "has" if original == "have" else "is"
        if original == "were":
            replacement = "was"
        start, end = found.span("word")
        candidate = _make_match(
            text,
            start,
            end,
            replacement,
            "Use the singular verb with this singular subject.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)
    for found in re.finditer(
        r"\b(?:the|a|an)\s+"
        r"(?:list|group|series|set|collection|majority)\s+of\b[^.!?]{0,60}?"
        r"\b(?P<word>have|are|were)\b",
        text,
        re.IGNORECASE,
    ):
        original = found.group("word").lower()
        replacement = "has" if original == "have" else "is"
        if original == "were":
            replacement = "was"
        start, end = found.span("word")
        candidate = _make_match(
            text,
            start,
            end,
            replacement,
            "Use the singular verb with this singular subject.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    for found in re.finditer(
        r"\b(?P<subject>she|he|it)\b"
        r"(?P<middle>[^.!?]{1,100}\band\s+)"
        r"(?P<word>are|were)\b",
        text,
        re.IGNORECASE,
    ):
        original = found.group("word").lower()
        past = re.search(_PAST_MARKER, found.group(0), re.IGNORECASE)
        replacement = "was" if original == "were" or past else "is"
        start, end = found.span("word")
        candidate = _make_match(
            text,
            start,
            end,
            replacement,
            "Use the singular verb with this singular subject.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    for found in re.finditer(
        r"\b(?:i|you|he|she|it|we|they)\s+"
        r"(?P<word>receive|walk|play|work|visit|finish|start|call|watch|"
        r"open|close|look|talk|use|need|want|ask|help|clean|cook|study|"
        r"try|carry|go|eat|see|make|write|take|come|do|say|run|have)\b"
        rf"(?=[^.!?]{{0,100}}\b{_PAST_MARKER}\b)",
        text,
        re.IGNORECASE,
    ):
        original = found.group("word").lower()
        start, end = found.span("word")
        candidate = _make_match(
            text,
            start,
            end,
            _PAST_FORMS[original],
            'Use the past tense with "yesterday" or another past-time phrase.',
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    return candidates


def enhance_matches(
    text: str,
    matches: list[dict],
    language: str = "en-US",
) -> list[dict]:
    """Add high-confidence English matches and resolve conflicting matches."""
    if not language.lower().startswith("en"):
        return matches

    candidates = _context_matches(text)
    candidates.extend(_to_too_two_matches(text))
    candidates.extend(_agreement_matches(text, language))
    candidates.sort(key=lambda item: (item["offset"], item["length"]))

    unique_candidates: list[dict] = []
    for candidate in candidates:
        if not any(_overlaps(candidate, existing) for existing in unique_candidates):
            unique_candidates.append(candidate)

    if not unique_candidates:
        return matches

    kept_matches = [
        match
        for match in matches
        if not any(_overlaps(match, candidate) for candidate in unique_candidates)
    ]
    return sorted([*kept_matches, *unique_candidates], key=lambda item: item["offset"])
