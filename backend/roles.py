"""Shared metadata normalization for senior retrieval and public search."""
import re


def normalized_name(value):
    return " ".join(re.findall(r"[\w+]+", value.casefold()))


def normalized_role(value):
    value = normalized_name(value)
    for abbreviation, full_name in (
        ("dse", "digital specialist engineer"),
        ("sde", "software development engineer"),
        ("mle", "machine learning engineer"),
    ):
        if value in {abbreviation, full_name, f"{full_name} {abbreviation}", f"{abbreviation} {full_name}"}:
            return full_name
    # Keep levels and unrelated role names distinct.
    return value
