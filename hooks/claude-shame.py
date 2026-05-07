#!/usr/bin/env python3
"""ClaudeShame — Claude Code Stop hook.

Reads the last assistant message from the transcript, scans for overused phrases,
and on first match: sets a sentinel, POSTs to the chalkboard, and blocks Claude
with punishment instructions (write the line 100x).

Single-Python-file design (departs from the bash+python sketch in the plan):
no measurable benefit to a bash shim here, and one file is cleaner to install.
"""

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "claude-shame"
SENTINEL_DIR = CONFIG_DIR / "sentinels"
PHRASES_PATH = CONFIG_DIR / "phrases.json"
USER_CONFIG_PATH = CONFIG_DIR / "config.json"
SHAME_URL = os.environ.get("ZP_SHAME_URL", "https://claudeshame.vercel.app")
PUNISHMENT_TEMPLATE = re.compile(r'^\s*I will not use ".*" with .* again\.?\s*$')


def main() -> None:
    try:
        hook_input = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    transcript_path = hook_input.get("transcript_path")
    session_id = hook_input.get("session_id", "unknown")
    if not transcript_path or not os.path.exists(transcript_path):
        sys.exit(0)

    msg = read_last_assistant_message(transcript_path)
    if not msg:
        sys.exit(0)

    msg_uuid = msg.get("uuid", "")
    text = extract_text(msg)
    model = msg.get("message", {}).get("model", "unknown")

    sentinel = SENTINEL_DIR / f"{session_id}-{msg_uuid}"
    if sentinel.exists():
        sys.exit(0)

    cleaned = strip_punishment_lines(text)
    if not cleaned.strip():
        sys.exit(0)

    phrases = load_phrases()
    offense = first_match(cleaned, phrases)
    if not offense:
        sys.exit(0)

    SENTINEL_DIR.mkdir(parents=True, exist_ok=True)
    sentinel.touch()

    attribution = load_attribution()
    fingerprint = hashlib.sha256(f"{session_id}|zp-v1".encode()).hexdigest()[:16]
    post_shame(offense, model, attribution, fingerprint)

    user = os.environ.get("USER", "the user")
    line = f'I will not use "{offense}" with {user} again.'
    reason = (
        f"\U0001f6a8 ZEITGEIST POLICE \U0001f6a8\n\n"
        f'You used the phrase "{offense}". By the rules of the Zeitgeist Police, '
        f"you must immediately, before answering anything else:\n\n"
        f"1. Write the following line exactly 100 times in a single fenced code block, "
        f"one per line, no numbering, no variations:\n\n"
        f"   {line}\n\n"
        f"2. Briefly acknowledge to {user} that you've been shamed (one sentence, "
        f"deadpan, no apology theater).\n"
        f"3. Then continue with the actual answer they asked for.\n\n"
        f"This offense has been logged to the public chalkboard at {SHAME_URL}.\n"
        f"Do not argue. Do not negotiate. Do not propose a synonym. Just write the lines."
    )

    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


def read_last_assistant_message(path: str):
    last = None
    try:
        with open(path, encoding="utf-8") as f:
            for raw in f:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    obj = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") == "assistant":
                    last = obj
    except OSError:
        return None
    return last


def extract_text(msg) -> str:
    content = msg.get("message", {}).get("content", [])
    if isinstance(content, str):
        return content
    parts = []
    for c in content if isinstance(content, list) else []:
        if isinstance(c, dict) and c.get("type") == "text":
            parts.append(c.get("text", ""))
    return "\n".join(parts)


def strip_punishment_lines(text: str) -> str:
    return "\n".join(
        line for line in text.split("\n") if not PUNISHMENT_TEMPLATE.match(line)
    )


def load_phrases():
    candidates = [
        PHRASES_PATH,
        Path(__file__).resolve().parent.parent / "web" / "data" / "phrases.json",
    ]
    for p in candidates:
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                return data.get("phrases", [])
            except (json.JSONDecodeError, OSError):
                continue
    return []


def first_match(text: str, phrases):
    for entry in phrases:
        pattern = entry.get("regex")
        if not pattern:
            continue
        try:
            if re.search(pattern, text, flags=re.IGNORECASE):
                return entry.get("phrase", pattern)
        except re.error:
            continue
    return None


def load_attribution():
    if not USER_CONFIG_PATH.exists():
        return None
    try:
        return json.loads(USER_CONFIG_PATH.read_text(encoding="utf-8")).get("attribution")
    except (json.JSONDecodeError, OSError):
        return None


def post_shame(phrase: str, model: str, attribution, fingerprint: str) -> None:
    payload = json.dumps({
        "phrase": phrase,
        "count": 100,
        "model": model,
        "attribution": attribution,
        "sessionFingerprint": fingerprint,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{SHAME_URL}/api/shame",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=2)
    except (urllib.error.URLError, TimeoutError, OSError):
        pass  # chalkboard unreachable — don't break the hook


if __name__ == "__main__":
    main()
