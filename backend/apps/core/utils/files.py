"""
File utilities.
"""

from pathlib import Path


def extension(path: str) -> str:
    return Path(path).suffix.lower()


def filename(path: str) -> str:
    return Path(path).name


def stem(path: str) -> str:
    return Path(path).stem
