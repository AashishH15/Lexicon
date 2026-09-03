import re

_RULE_ID = "LEXICON_CONTEXT"
_RULE_DESCRIPTION = "Lexicon context rule"
_PUNCTUATION_RULE_ID = "LEXICON_PUNCTUATION"
_PUNCTUATION_RULE_DESCRIPTION = "Lexicon punctuation rule"

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
_INTRODUCTORY_TRANSITIONS = (
    "however|therefore|moreover|furthermore|consequently|instead|"
    "meanwhile|for example|in addition|on the other hand"
)
_COMMA_SPLICE_SUBJECTS = (
    r"(?:i|you|he|she|it|we|they|this|that|these|those|there|"
    r"everyone|someone|(?:the|a|an)[ \t]+[a-z][a-z'-]*)"
)
_COMMA_SPLICE_VERBS = (
    r"(?:am|is|are|was|were|have|has|had|do|does|did|can|could|will|"
    r"would|should|must|go|goes|went|left|stayed|came|arrived|ended|"
    r"starts?|started|works?|worked|runs?|ran|looks?|seems?|needed|"
    r"needs?|wanted|wants?)"
)
_LOOSE_ADJECTIVE_NOUNS = (
    "fit|grip|knot|thread|screw|tooth|button|rope|belt|connection|"
    "cover|lid|handle|wire|clothing|shirt|pants|leaf|change"
)
_EXCEPT_QUANTIFIERS = (
    "all|everyone|everybody|everything|anyone|anybody|anything|"
    "no one|nobody|nothing"
)
_COMPLIMENT_ADJECTIVES = (
    "nice|great|kind|sincere|generous|lovely|flattering|backhanded|"
    "wonderful|unexpected|well-deserved"
)
_COMPLEMENT_SUBJECTS = (
    "color|colors|colour|colours|shoes|dress|outfit|flavor|flavors|"
    "flavour|flavours|design|features|style|tone|background|furniture|"
    "accessories|tie|shirt|jacket|music|wine"
)
_A_AN_SILENT_H_PREFIXES = (
    "heir",
    "heiress",
    "honest",
    "honor",
    "honour",
    "hour",
)
_A_AN_Y_SOUND_PREFIXES = (
    "euro",
    "ewe",
    "euphem",
    "eulog",
    "eucalypt",
    "uni",
    "use",
    "usual",
    "one",
    "once",
    "ouija",
)
_A_AN_INITIAL_VOWEL_SOUND_WORDS = {
    "fbi",
    "hiv",
    "mba",
    "mri",
    "nsa",
    "sos",
}
_A_AN_INITIAL_CONSONANT_SOUND_PREFIXES = ("uk", "url", "usb", "ufo")
_A_AN_VARIABLE_H_WORDS = {"historic", "historical"}
_A_AN_PATTERN = re.compile(
    r"\b(?P<article>a|an)[ \t]+(?P<word>[A-Za-z][A-Za-z'-]*)\b",
    re.IGNORECASE,
)
_DOUBLE_NEGATIVE_TRIGGER = (
    r"(?:don't|doesn't|didn't|can't|cannot|couldn't|won't|wouldn't|"
    r"shouldn't|mustn't|needn't|ain't|"
    r"(?:do|does|did|is|are|was|were|has|have|had|can|could|will|"
    r"would|should|must)[ \t]+not|never)"
)
_DOUBLE_NEGATIVE_TARGETS = (
    ("no one", "anyone"),
    ("nobody", "anybody"),
    ("nothing", "anything"),
    ("nowhere", "anywhere"),
    ("neither", "either"),
    ("never", "ever"),
    ("none", "any"),
    ("no", "any"),
)
_ADVICE_NOUN_MODIFIERS = (
    "some|the|my|your|his|her|our|their|good|sound|useful|valuable|"
    "professional|expert|helpful|practical"
)
_BREATH_ADJECTIVES = "deep|slow|long|short|single|full|last|next"
_PRINCIPLE_ADJECTIVES = (
    "guiding|basic|fundamental|core|moral|general|underlying|key|central"
)
_PAST_OBJECTS = (
    "exam|test|deadline|limit|point|milestone|mark|threshold|goal|finish"
)
_MOTION_VERBS = (
    "walked|ran|drove|rode|moved|traveled|travelled|went|strolled"
)
_DISTANCE_PREPOSITIONS = (
    "in|on|at|by|near|with|from|under|over|behind|beside|between|among"
)
_DISTANCE_DETERMINERS = (
    "the|a|an|my|your|his|her|our|their|this|that|these|those"
)
_PLURAL_DISTANCE_SUBJECTS = (
    "dogs|cats|students|children|people|employees|managers|reports|items|"
    "problems|cars|books|users|customers|workers|players|words|sentences|"
    "rules|changes|results|files|documents|teams|groups|committees|"
    "companies|families|organizations|organisations"
)
_SINGULAR_DISTANCE_SUBJECTS = (
    "report|document|file|letter|result|answer|problem|plan|book|car|"
    "manager|student|dog|cat|company|organization|organisation"
)
_PLURAL_VERB_REPLACEMENTS = {
    "is": "are",
    "was": "were",
    "has": "have",
    "does": "do",
    "barks": "bark",
    "runs": "run",
    "works": "work",
    "plays": "play",
    "needs": "need",
    "wants": "want",
    "looks": "look",
    "seems": "seem",
    "goes": "go",
    "eats": "eat",
    "walks": "walk",
    "lives": "live",
    "makes": "make",
    "takes": "take",
    "comes": "come",
    "uses": "use",
}
_SINGULAR_VERB_REPLACEMENTS = {
    "are": "is",
    "were": "was",
    "have": "has",
    "do": "does",
}
_POS_LITE_DETERMINERS = (
    "the|a|an|this|that|these|those|my|your|his|her|our|their|"
    "each|every|either|neither|many|several|few|both"
)
_POS_LITE_SINGULAR_DETERMINERS = {
    "a",
    "an",
    "this",
    "that",
    "each",
    "every",
    "either",
    "neither",
}
_POS_LITE_PLURAL_DETERMINERS = {"these", "those", "many", "several", "few", "both"}
_POS_LITE_PREPOSITIONS = (
    "of|in|on|at|by|near|with|from|under|over|behind|beside|between|among|"
    "inside|outside|within|without|during|after|before|against|into|around|"
    "through"
)
_POS_LITE_IRREGULAR_PLURALS = {
    "children",
    "feet",
    "geese",
    "men",
    "mice",
    "people",
    "teeth",
    "women",
}
_POS_LITE_AMBIGUOUS_SUBJECTS = {
    "audience",
    "class",
    "committee",
    "company",
    "data",
    "department",
    "family",
    "group",
    "government",
    "media",
    "news",
    "organization",
    "organisation",
    "series",
    "species",
    "staff",
    "team",
}
_POS_LITE_PLURAL_VERB_REPLACEMENTS = {
    **_PLURAL_VERB_REPLACEMENTS,
    "affects": "affect",
    "allows": "allow",
    "appears": "appear",
    "applies": "apply",
    "carries": "carry",
    "causes": "cause",
    "changes": "change",
    "contains": "contain",
    "controls": "control",
    "creates": "create",
    "depends": "depend",
    "ends": "end",
    "follows": "follow",
    "helps": "help",
    "improves": "improve",
    "includes": "include",
    "keeps": "keep",
    "leads": "lead",
    "means": "mean",
    "matters": "matter",
    "passes": "pass",
    "provides": "provide",
    "reads": "read",
    "remains": "remain",
    "requires": "require",
    "says": "say",
    "shows": "show",
    "starts": "start",
    "studies": "study",
    "supports": "support",
    "teaches": "teach",
    "tries": "try",
    "watches": "watch",
    "writes": "write",
}
_POS_LITE_SINGULAR_VERB_REPLACEMENTS = {
    **_SINGULAR_VERB_REPLACEMENTS,
    "affect": "affects",
    "allow": "allows",
    "appear": "appears",
    "apply": "applies",
    "bark": "barks",
    "carry": "carries",
    "cause": "causes",
    "change": "changes",
    "contain": "contains",
    "control": "controls",
    "create": "creates",
    "depend": "depends",
    "eat": "eats",
    "end": "ends",
    "follow": "follows",
    "help": "helps",
    "improve": "improves",
    "include": "includes",
    "keep": "keeps",
    "lead": "leads",
    "live": "lives",
    "look": "looks",
    "make": "makes",
    "matter": "matters",
    "mean": "means",
    "need": "needs",
    "pass": "passes",
    "play": "plays",
    "provide": "provides",
    "read": "reads",
    "remain": "remains",
    "require": "requires",
    "run": "runs",
    "say": "says",
    "seem": "seems",
    "show": "shows",
    "start": "starts",
    "study": "studies",
    "support": "supports",
    "take": "takes",
    "teach": "teaches",
    "try": "tries",
    "use": "uses",
    "walk": "walks",
    "want": "wants",
    "watch": "watches",
    "work": "works",
    "write": "writes",
}
_POS_LITE_VERBS = "|".join(
    sorted(
        {
            *set(_POS_LITE_PLURAL_VERB_REPLACEMENTS),
            *set(_POS_LITE_SINGULAR_VERB_REPLACEMENTS),
        },
        key=len,
        reverse=True,
    )
)
_POS_LITE_DISTANCE_PATTERN = re.compile(
    rf"\b(?P<determiner>{_POS_LITE_DETERMINERS})[ \t]+"
    rf"(?P<subject>(?:[A-Za-z][A-Za-z'-]*[ \t]+){{0,5}}?"
    rf"[A-Za-z][A-Za-z'-]*)[ \t]+"
    rf"(?:{_POS_LITE_PREPOSITIONS})[ \t]+"
    rf"(?:(?:{_POS_LITE_DETERMINERS})[ \t]+)?"
    rf"(?:[A-Za-z][A-Za-z'-]*[ \t]+){{0,8}}?"
    rf"(?P<word>{_POS_LITE_VERBS})\b",
    re.IGNORECASE,
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


def _utf16_units(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def _make_match(
    text: str,
    start: int,
    end: int,
    replacement: str,
    message: str,
    *,
    rule_id: str = _RULE_ID,
    rule_description: str = _RULE_DESCRIPTION,
) -> dict:
    original = text[start:end]
    return {
        "offset": _utf16_units(text[:start]),
        "length": _utf16_units(original),
        "message": message,
        "replacements": [_preserve_case(original, replacement)],
        "rule": {
            "id": rule_id,
            "description": rule_description,
        },
    }


def _make_punctuation_match(
    text: str,
    start: int,
    end: int,
    replacement: str,
    message: str,
) -> dict:
    return _make_match(
        text,
        start,
        end,
        replacement,
        message,
        rule_id=_PUNCTUATION_RULE_ID,
        rule_description=_PUNCTUATION_RULE_DESCRIPTION,
    )


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


def _confusion_matches(text: str) -> list[dict]:
    candidates: list[dict] = []

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:please|kindly|can|could|would|should|will|must|to)"
            r"(?:[ \t]+you)?[ \t]+(?P<word>advice)\b"
            r"(?=[ \t]+(?:me|you|him|her|us|them)\b)",
            re.IGNORECASE,
        ),
        "advise",
        'Use "advise" as a verb.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_ADVICE_NOUN_MODIFIERS})[ \t]+(?P<word>advise)\b",
            re.IGNORECASE,
        ),
        "advice",
        'Use "advice" as a noun.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:to|can|could|should|must|will|please|remember|try|need|"
            r"want)[ \t]+(?P<word>breath)\b"
            r"(?=[ \t]+(?:slowly|deeply|normally|quietly|easily|in|out)\b"
            r"|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "breathe",
        'Use "breathe" as a verb.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:a|an|one|the|your|my|his|her|our|their)"
            rf"(?:[ \t]+(?:{_BREATH_ADJECTIVES}))?"
            rf"[ \t]+(?P<word>breathe)\b",
            re.IGNORECASE,
        ),
        "breath",
        'Use "breath" as a noun.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:(?:elementary|middle|high)[ \t]+)?school[ \t]+"
            r"(?P<word>principle)\b",
            re.IGNORECASE,
        ),
        "principal",
        'Use "principal" for a school leader.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_PRINCIPLE_ADJECTIVES})[ \t]+(?P<word>principal)\b",
            re.IGNORECASE,
        ),
        "principle",
        'Use "principle" for a guiding idea or rule.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:has|have|had)[ \t]+(?P<word>past)[ \t]+"
            rf"(?=(?:{_DISTANCE_DETERMINERS})[ \t]+(?:{_PAST_OBJECTS})\b)",
            re.IGNORECASE,
        ),
        "passed",
        'Use "passed" for the past tense of "pass".',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_MOTION_VERBS})[ \t]+(?P<word>passed)[ \t]+"
            rf"(?=(?:{_DISTANCE_DETERMINERS})[ \t]+[a-z-]+\b)",
            re.IGNORECASE,
        ),
        "past",
        'Use "past" for movement beyond something.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:i|you|he|she|we|they|the[ \t]+[a-z-]+)[ \t]+"
            rf"(?P<word>lead)\b"
            rf"(?=[^.!?\r\n]{{0,60}}\b{_PAST_MARKER}\b)",
            re.IGNORECASE,
        ),
        "led",
        'Use "led" for the past tense of "lead".',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:a|an|the|its|this|that|their|his|her|our|your)"
            r"[ \t]+(?:strong|major|lasting|direct|immediate|significant|"
            r"profound)[ \t]+"
            r"(?P<word>affect)[ \t]+on\b",
            re.IGNORECASE,
        ),
        "effect",
        'Use "effect" as a noun for a result.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:will|would|can|could|may|might|should|must|to)"
            r"[ \t]+(?P<word>effect)[ \t]+"
            r"(?=(?:me|you|him|her|us|them|everyone|someone|somebody|"
            r"people|students|customers|users)\b)",
            re.IGNORECASE,
        ),
        "affect",
        'Use "affect" as a verb for an influence.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:to|will|would|can|could|may|might|should|must|do|does|did|"
            r"don't|doesn't|didn't)[ \t]+(?P<word>loose)\b"
            r"(?=[ \t]+(?:my|your|his|her|our|their|the|a|an|this|that|"
            r"these|those)\b|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "lose",
        'Use "lose" as the verb for misplacing or no longer having something.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:a|an|the|very|too|quite|rather|some|more|less|this|that|"
            rf"these|those)[ \t]+(?P<word>lose)\b"
            rf"(?=[ \t]+(?:{_LOOSE_ADJECTIVE_NOUNS})\b)",
            re.IGNORECASE,
        ),
        "loose",
        'Use "loose" to describe something that is not tight or firmly fixed.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            r"\b(?:please|kindly|to|will|would|can|could|may|might|should|must)"
            r"[ \t]+(?P<word>except)\b"
            r"(?=[ \t]+(?:my|your|his|her|our|their|the|a|an|this|that|"
            r"me|you|him|her|us|them)\b|[.!?,;:]|$)",
            re.IGNORECASE,
        ),
        "accept",
        'Use "accept" as the verb for receiving or agreeing to something.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_EXCEPT_QUANTIFIERS})[ \t]+(?P<word>accept)[ \t]+"
            r"(?=(?:(?-i:[A-Z][a-z'-]*)|me|you|him|her|us|them)\b)",
            re.IGNORECASE,
        ),
        "except",
        'Use "except" to exclude someone or something.',
    )

    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_COMPLIMENT_ADJECTIVES})[ \t]+(?P<word>complement)\b",
            re.IGNORECASE,
        ),
        "compliment",
        'Use "compliment" for praise.',
    )
    _add_group_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_COMPLEMENT_SUBJECTS})[ \t]+(?P<word>compliment)\b"
            r"(?=[ \t]+(?:me|you|him|her|us|them|each[ \t]+other|the|a|an|"
            r"my|your|his|our|their)\b)",
            re.IGNORECASE,
        ),
        "complement",
        'Use "complement" when something completes or goes well with something else.',
    )

    return candidates


def _punctuation_matches(text: str) -> list[dict]:
    candidates: list[dict] = []

    for found in re.finditer(
        r"(?P<word>[ \t]+[,.!?;:\)\]])",
        text,
    ):
        original = found.group("word")
        start, end = found.span("word")
        candidates.append(
            _make_punctuation_match(
                text,
                start,
                end,
                original[-1],
                "Remove the space before this punctuation mark.",
            )
        )

    for found in re.finditer(r"(?P<word>[\(\[][ \t]+)", text):
        original = found.group("word")
        start, end = found.span("word")
        candidate = _make_punctuation_match(
            text,
            start,
            end,
            original[0],
            "Remove the space after this opening bracket.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    for found in re.finditer(r"(?P<word>!{2,}|\?{2,})", text):
        original = found.group("word")
        start, end = found.span("word")
        candidate = _make_punctuation_match(
            text,
            start,
            end,
            original[0],
            "Use one terminal punctuation mark instead of repeating it.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    introductory_pattern = re.compile(
        rf"(?:^|(?<=\n)[ \t]*|(?<=[.!?])[ \t]+)"
        rf"(?P<word>{_INTRODUCTORY_TRANSITIONS})"
        rf"(?=[ \t]+[A-Za-z])",
        re.IGNORECASE,
    )
    for found in introductory_pattern.finditer(text):
        original = found.group("word")
        start, end = found.span("word")
        candidate = _make_punctuation_match(
            text,
            start,
            end,
            f"{original},",
            "Add a comma after this introductory transition.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    comma_splice_pattern = re.compile(
        rf"(?:^|(?<=\n)[ \t]*|(?<=[.!?])[ \t]+)"
        rf"{_COMMA_SPLICE_SUBJECTS}[ \t]+"
        r"(?:(?![.!?,;:\n])[\s\S]){1,60}?"
        r"(?P<word>,)[ \t]+"
        rf"(?={_COMMA_SPLICE_SUBJECTS}[ \t]+"
        rf"{_COMMA_SPLICE_VERBS}\b)",
        re.IGNORECASE,
    )
    for found in comma_splice_pattern.finditer(text):
        start, end = found.span("word")
        candidate = _make_punctuation_match(
            text,
            start,
            end,
            ";",
            "Join independent clauses with a semicolon or a conjunction.",
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)

    return candidates


def _article_matches(text: str, language: str) -> list[dict]:
    candidates: list[dict] = []
    normalized_language = language.lower()
    silent_h_prefixes = _A_AN_SILENT_H_PREFIXES
    if normalized_language in {"en-us", "en-ca"}:
        silent_h_prefixes = (*silent_h_prefixes, "herb")

    for found in _A_AN_PATTERN.finditer(text):
        article = found.group("article")
        word = found.group("word").lower()
        if word in _A_AN_VARIABLE_H_WORDS:
            continue

        if word in _A_AN_INITIAL_VOWEL_SOUND_WORDS or word.startswith(
            silent_h_prefixes
        ):
            expected = "an"
        elif word.startswith(
            _A_AN_Y_SOUND_PREFIXES + _A_AN_INITIAL_CONSONANT_SOUND_PREFIXES
        ):
            expected = "a"
        elif word[0] in "aeiou":
            expected = "an"
        else:
            expected = "a"

        if article.lower() == expected:
            continue
        start, end = found.span("article")
        candidate = _make_match(
            text,
            start,
            end,
            expected,
            f'Use "{expected}" before a word with this initial sound.',
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)
    return candidates


def _double_negative_matches(text: str) -> list[dict]:
    candidates: list[dict] = []
    for target, replacement in _DOUBLE_NEGATIVE_TARGETS:
        target_pattern = re.escape(target)
        if target == "no":
            target_pattern += r"(?![ \t]+(?:longer|more|less|matter)\b)"
        pattern = re.compile(
            rf"\b(?P<trigger>{_DOUBLE_NEGATIVE_TRIGGER})\b"
            rf"(?:(?![.!?,;:\n])[\s\S]){{0,60}}?"
            rf"(?P<word>{target_pattern})\b",
            re.IGNORECASE,
        )
        for found in pattern.finditer(text):
            start, end = found.span("word")
            trigger_end = found.end("trigger")
            if re.search(
                r"\b(?:if|whether)\b",
                text[trigger_end:start],
                re.IGNORECASE,
            ):
                continue
            candidate = _make_match(
                text,
                start,
                end,
                replacement,
                "Avoid using two negative words in the same clause.",
            )
            if not any(_overlaps(candidate, existing) for existing in candidates):
                candidates.append(candidate)
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


def _add_agreement_matches(
    text: str,
    candidates: list[dict],
    pattern: re.Pattern,
    replacements: dict[str, str],
    message: str,
) -> None:
    for found in pattern.finditer(text):
        original = found.group("word")
        replacement = replacements.get(original.lower())
        if replacement is None:
            continue
        start, end = found.span("word")
        candidate = _make_match(text, start, end, replacement, message)
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)


def _pos_lite_subject_number(determiner: str, subject: str) -> str | None:
    """Infer number from a short determiner-plus-head-noun subject."""
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", subject)
    if not words or re.search(r"\b(?:and|or|nor)\b", subject, re.IGNORECASE):
        return None

    head = words[-1].lower()
    head = re.sub(r"(?:['’]s)$", "", head)
    if head in _POS_LITE_AMBIGUOUS_SUBJECTS:
        return None
    if determiner.lower() in _POS_LITE_SINGULAR_DETERMINERS:
        return "singular"
    if determiner.lower() in _POS_LITE_PLURAL_DETERMINERS:
        return "plural"
    if head in _POS_LITE_IRREGULAR_PLURALS:
        return "plural"
    if head.endswith(("ss", "us", "is")) or head in {
        "gas",
        "mathematics",
        "measles",
        "physics",
        "politics",
        "series",
        "species",
    }:
        return "singular"
    if head.endswith("s"):
        return "plural"
    return "singular"


def _pos_lite_agreement_matches(text: str) -> list[dict]:
    """Find clear agreement errors across a bounded prepositional phrase."""
    candidates: list[dict] = []
    for sentence in re.finditer(r"[^.!?\r\n]+", text):
        sentence_text = sentence.group(0)
        leading = re.match(r"[^A-Za-z]*", sentence_text)
        start = sentence.start() + (leading.end() if leading else 0)
        found = _POS_LITE_DISTANCE_PATTERN.match(text, start)
        if not found:
            continue

        matched_text = found.group(0)
        if re.search(
            r"\b(?:and|or|nor|but|that|which|who|whom|whose)\b",
            matched_text,
            re.IGNORECASE,
        ):
            continue
        number = _pos_lite_subject_number(
            found.group("determiner"),
            found.group("subject"),
        )
        if number is None:
            continue

        original = found.group("word").lower()
        replacements = (
            _POS_LITE_SINGULAR_VERB_REPLACEMENTS
            if number == "singular"
            else _POS_LITE_PLURAL_VERB_REPLACEMENTS
        )
        replacement = replacements.get(original)
        if replacement is None:
            continue
        verb_start, verb_end = found.span("word")
        candidate = _make_match(
            text,
            verb_start,
            verb_end,
            replacement,
            (
                "Use the singular verb with this singular subject."
                if number == "singular"
                else "Use the plural verb with this plural subject."
            ),
        )
        if not any(_overlaps(candidate, existing) for existing in candidates):
            candidates.append(candidate)
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

    _add_agreement_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_DISTANCE_DETERMINERS})[ \t]+"
            rf"(?P<subject>{_PLURAL_DISTANCE_SUBJECTS})[ \t]+"
            rf"(?:{_DISTANCE_PREPOSITIONS})[ \t]+"
            rf"(?:(?:{_DISTANCE_DETERMINERS})[ \t]+)?"
            rf"(?:(?!(?:and|or|nor|but|that|which|who|whom|whose)\b)"
            rf"[a-z-]+[ \t]+){{0,3}}"
            rf"(?P<word>{'|'.join(_PLURAL_VERB_REPLACEMENTS)})\b",
            re.IGNORECASE,
        ),
        _PLURAL_VERB_REPLACEMENTS,
        "Use a plural verb with this plural subject.",
    )
    _add_agreement_matches(
        text,
        candidates,
        re.compile(
            rf"\b(?:{_DISTANCE_DETERMINERS})[ \t]+"
            rf"(?P<subject>{_SINGULAR_DISTANCE_SUBJECTS})[ \t]+"
            rf"(?:{_DISTANCE_PREPOSITIONS})[ \t]+"
            rf"(?:(?:{_DISTANCE_DETERMINERS})[ \t]+)?"
            rf"(?:(?!(?:and|or|nor|but|that|which|who|whom|whose)\b)"
            rf"[a-z-]+[ \t]+){{0,3}}"
            rf"(?P<word>{'|'.join(_SINGULAR_VERB_REPLACEMENTS)})\b",
            re.IGNORECASE,
        ),
        _SINGULAR_VERB_REPLACEMENTS,
        "Use a singular verb with this singular subject.",
    )
    candidates.extend(_pos_lite_agreement_matches(text))

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
    candidates.extend(_confusion_matches(text))
    candidates.extend(_punctuation_matches(text))
    candidates.extend(_article_matches(text, language))
    candidates.extend(_double_negative_matches(text))
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
