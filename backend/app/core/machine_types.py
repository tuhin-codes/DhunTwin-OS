from __future__ import annotations

from typing import Any


_MACHINE_TYPE_ALIASES = {
    "boiler": "boiler",

    "pump": "pump",

    "motor": "motor",

    "compressor": "compressor",
    "air compressor": "compressor",

    "cnc": "cnc",

    "robot": "robot",
}


def normalize_machine_type(
    value: Any,
) -> str:
    """
    Convert machine-type labels into a canonical form.

    Examples:
        Compressor -> compressor
        Air Compressor -> compressor
        MOTOR -> motor
    """

    if value is None:
        return ""

    normalized = (
        str(value)
        .strip()
        .lower()
    )

    return _MACHINE_TYPE_ALIASES.get(
        normalized,
        normalized,
    )


def machine_type_compatible(
    left: Any,
    right: Any,
) -> bool:
    """
    Determine whether two machine-type labels
    represent the same canonical machine type.
    """

    return (
        normalize_machine_type(left)
        == normalize_machine_type(right)
    )
