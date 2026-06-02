from collections.abc import Mapping, Sequence
from typing import Any


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    return value.replace("\x00", "").strip()


def clean_value(value: Any) -> Any:
    if isinstance(value, str):
        return clean_text(value)

    if isinstance(value, Mapping):
        return {key: clean_value(item) for key, item in value.items()}

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [clean_value(item) for item in value]

    return value
