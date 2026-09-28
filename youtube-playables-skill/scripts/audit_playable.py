#!/usr/bin/env python3
"""Fast static preflight for a built YouTube Playables bundle.

Usage:
    python audit_playable.py path/to/dist

This is not a substitute for Google's Playables Test Suite or certification.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

MIB = 1024 * 1024
TOTAL_LIMIT = 250 * MIB
FILE_LIMIT = 30 * MIB
FILE_COUNT_LIMIT = 8000
ALLOWED_NAME = re.compile(r"^[A-Za-z0-9_.-]+$")
URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.I)

ALLOWED_EXTERNAL_PREFIXES = (
    "https://www.youtube.com/game_api/v1",
    "https://www.youtube.com/game_api/v0",
)

TEXT_SUFFIXES = {
    ".html", ".htm", ".js", ".mjs", ".cjs", ".css", ".json",
    ".txt", ".xml", ".svg", ".map", ".ts"
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dist", type=Path)
    args = parser.parse_args()
    root = args.dist.resolve()

    if not root.is_dir():
        print(f"ERROR: not a directory: {root}")
        return 2

    errors: list[str] = []
    warnings: list[str] = []
    files = [p for p in root.rglob("*") if p.is_file()]

    if not (root / "index.html").is_file():
        errors.append("Missing root index.html")

    if len(files) > FILE_COUNT_LIMIT:
        errors.append(f"File count {len(files)} exceeds {FILE_COUNT_LIMIT}")

    total = sum(p.stat().st_size for p in files)
    if total >= TOTAL_LIMIT:
        errors.append(f"Total uncompressed size {total / MIB:.1f} MiB >= 250 MiB")

    for p in files:
        rel = p.relative_to(root)
        if p.stat().st_size >= FILE_LIMIT:
            errors.append(f"File >=30 MiB: {rel} ({p.stat().st_size / MIB:.1f} MiB)")
        for part in rel.parts:
            if not ALLOWED_NAME.match(part):
                errors.append(f"Unsupported filename characters: {rel}")
                break

        if p.suffix.lower() in TEXT_SUFFIXES and p.stat().st_size < 10 * MIB:
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            for url in URL_RE.findall(text):
                if not url.startswith(ALLOWED_EXTERNAL_PREFIXES):
                    warnings.append(f"External URL in {rel}: {url[:160]}")

            # Obvious absolute asset paths. This is heuristic, not a parser.
            if re.search(r"(?:src|href)=[\"']/[^/\"']", text, re.I):
                warnings.append(f"Possible absolute asset path in {rel}")

    index = root / "index.html"
    if index.is_file():
        html = index.read_text(encoding="utf-8", errors="ignore")
        sdk_pos = html.find("https://www.youtube.com/game_api/v1")
        module_positions = [m.start() for m in re.finditer(r"<script\b", html, re.I)]
        if sdk_pos < 0:
            errors.append("index.html does not include YouTube Playables SDK v1")
        elif module_positions and any(pos < sdk_pos for pos in module_positions):
            warnings.append("A script tag appears before the YouTube SDK; verify no game code runs first")

    print(f"Files: {len(files)}")
    print(f"Uncompressed total: {total / MIB:.2f} MiB")

    if warnings:
        print("\nWARNINGS")
        for item in sorted(set(warnings)):
            print(f"- {item}")

    if errors:
        print("\nERRORS")
        for item in sorted(set(errors)):
            print(f"- {item}")
        return 1

    print("\nPASS: no static hard-limit violations detected by this script.")
    print("Still run the official YouTube Playables Test Suite and runtime checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
