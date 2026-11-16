"""Candidate generation for keyboard-wedge Fireplan QR scans."""

import re

SCANNER_KEYBOARD_TRANSLATIONS = (
    str.maketrans(
        {
            "a": "q",
            "A": "Q",
            "z": "w",
            "Z": "W",
            "q": "a",
            "Q": "A",
            "m": ";",
            "M": ":",
            "w": "z",
            "W": "Z",
            "&": "1",
            "é": "2",
            '"': "3",
            "'": "4",
            "’": "4",
            "(": "5",
            "§": "6",
            "è": "7",
            "!": "8",
            "ç": "9",
            "à": "0",
            "=": "/",
            ":": ".",
            "+": "?",
            "-": "=",
            ";": ",",
        }
    ),
    str.maketrans(
        {
            "q": "a",
            "Q": "A",
            ".": ":",
            ">": "/",
            "<": ".",
            "M": "?",
            "d": "d",
            "/": "=",
            "!": "1",
            "@": "2",
            "*": "8",
            ")": "0",
            "m": ",",
        }
    ),
    str.maketrans(
        {
            "q": "a",
            "Q": "A",
            ".": ":",
            ">": "/",
            "<": ".",
            "M": "?",
            "d": "d",
            "/": "=",
            "!": "1",
            "&": "2",
            "$": "8",
            "*": "1",
            ")": "0",
            "m": ",",
        }
    ),
    str.maketrans(
        {
            ")": "0",
            "!": "1",
            "@": "2",
            "#": "3",
            "$": "4",
            "%": "5",
            "^": "6",
            "&": "7",
            "*": "8",
            "(": "9",
        }
    ),
)
FIREPLAN_QR_PATTERN = re.compile(
    r"https?://infoscan\.firebru\.brussels/?\?data[=-]\d+,\d+,\d+,\d+",
    re.IGNORECASE,
)


def fireplan_scan_candidates(value: str) -> list[str]:
    """Return original and documented layout alternatives for a Fireplan QR URL."""
    raw_scan = value.strip()
    recognition_candidates = [raw_scan]
    half_length = len(raw_scan) // 2
    if half_length and len(raw_scan) % 2 == 0 and raw_scan[:half_length] == raw_scan[half_length:]:
        recognition_candidates.append(raw_scan[:half_length])
    possible_candidates = [
        candidate
        for raw_candidate in recognition_candidates
        for candidate in (
            raw_candidate,
            *(raw_candidate.translate(table) for table in SCANNER_KEYBOARD_TRANSLATIONS),
        )
    ]
    if not any(FIREPLAN_QR_PATTERN.fullmatch(candidate) for candidate in possible_candidates):
        return []

    candidates: list[str] = []

    def add(candidate: str) -> None:
        half_length = len(candidate) // 2
        if (
            half_length
            and len(candidate) % 2 == 0
            and candidate[:half_length] == candidate[half_length:]
        ):
            half = candidate[:half_length]
            if half not in candidates:
                candidates.append(half)
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    add(raw_scan)
    for candidate in list(candidates):
        for translation in SCANNER_KEYBOARD_TRANSLATIONS:
            add(candidate.translate(translation))
    return candidates
