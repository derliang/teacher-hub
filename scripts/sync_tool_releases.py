#!/usr/bin/env python3
# Copyright (c) 2026 derliang. All rights reserved.
# Non-commercial use only. See LICENSE.md.
# Contact: derliang@gmail.com
"""Sync only approved public GitHub Pages tools' release metadata.
Fail closed if the source does not provide a credible version/date pair.
"""
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# The tools listed in tools.json are the approved set: a tool is added there when the owner approves
# listing it. Tools with no dedicated rule below must provide "versionJson" (see latest_from_version_json).
BUILTIN = ("seat-helper", "cleaning-helper", "exam-helper-clock")
OWNER = "derliang"
TW = dt.timezone(dt.timedelta(hours=8))
UA = {"User-Agent": "teacher-hub-release-sync", "Accept": "application/vnd.github+json"}
if os.environ.get("GH_API_TOKEN"):
    UA["Authorization"] = "Bearer " + os.environ["GH_API_TOKEN"]

def fetch(url):
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")

def match(pattern, content, label):
    found = re.search(pattern, content)
    if not found:
        raise ValueError(f"Missing {label}")
    return found.group(1)

def validate(version, day):
    if not re.fullmatch(r"\d+(?:\.\d+){1,3}", version):
        raise ValueError("Invalid version")
    parsed = dt.date.fromisoformat(day)
    if parsed > dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date():
        raise ValueError("Future release date")
    return version, day

def taiwan_date(iso_utc):
    stamp = dt.datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
    return stamp.astimezone(TW).date().isoformat()

def latest_from_version_json(tool):
    """Version from the published version.json; date = Taiwan date of the first commit that set that version."""
    url = tool.get("versionJson", "")
    source = tool.get("source", "")
    m_url = re.fullmatch(r"https://" + OWNER + r"\.github\.io/([A-Za-z0-9._-]+)/((?:[A-Za-z0-9._-]+/)*version\.json)", url)
    m_src = re.fullmatch(r"https://github\.com/" + OWNER + r"/([A-Za-z0-9._-]+)", source)
    if not m_url or not m_src or m_url.group(1) != m_src.group(1):
        raise ValueError("Tool has no dedicated rule and no valid versionJson/source pair")
    repo, path = m_src.group(1), m_url.group(2)
    v = str(json.loads(fetch(url)).get("version", "")).lstrip("v")
    commits = json.loads(fetch(f"https://api.github.com/repos/{OWNER}/{repo}/commits?path={path}&per_page=30"))
    first = None
    for c in commits:  # newest first; walk back while the file still carries the same version
        raw = json.loads(fetch(f"https://raw.githubusercontent.com/{OWNER}/{repo}/{c['sha']}/{path}"))
        if str(raw.get("version", "")).lstrip("v") != v:
            break
        first = c
    if first is None:
        raise ValueError("No commit found that sets the published version")
    return (*validate(v, taiwan_date(first["commit"]["committer"]["date"])), f"{path} version and the commit that first set it")

def latest(tool):
    repo = tool["id"]
    if repo not in BUILTIN:
        return latest_from_version_json(tool)
    html = fetch(f"https://raw.githubusercontent.com/derliang/{repo}/main/index.html")
    if repo == "seat-helper":
        v = match(r"\bAPP_VERSION\s*=\s*['\"]v?(\d+(?:\.\d+)+)['\"]", html, "seat APP_VERSION")
        readme = fetch("https://raw.githubusercontent.com/derliang/seat-helper/main/README.md")
        day = match(r"(?m)^###\s+[^\n]*?v" + re.escape(v) + r"\s*\((\d{4}-\d{2}-\d{2})\)", readme, "seat release date")
        evidence = "README.md version release entry"
    elif repo == "cleaning-helper":
        v = match(r"<title>[^<]*?v(\d+(?:\.\d+)+)</title>", html, "cleaning version")
        url = f"https://api.github.com/repos/derliang/{repo}/commits?path=index.html&per_page=100"
        commits = json.loads(fetch(url))
        # Release commit: "Bump version to vX" style, or a message that starts with "vX".
        pattern = r"(?i)(?:(?:bump version|release|發版|版本).*?v|^v)" + re.escape(v) + r"(?![\d.])"
        releases = [c for c in commits if re.search(pattern, c["commit"]["message"])]
        if not releases:
            raise ValueError("No matching cleaning version-release commit in recent history")
        # Taiwan date (UTC+8), not the UTC date.
        day = taiwan_date(releases[0]["commit"]["committer"]["date"])
        evidence = "Version-specific release commit for index.html"
    else:
        v = match(r"\bAPP_VERSION\s*=\s*['\"](\d+(?:\.\d+)+)['\"]", html, "exam APP_VERSION")
        day = match(r"\bAPP_DATE\s*=\s*['\"](\d{4}-\d{2}-\d{2})['\"]", html, "exam APP_DATE")
        evidence = "index.html APP_VERSION and APP_DATE"
    return (*validate(v, day), evidence)

def version_tuple(v):
    return tuple(int(x) for x in v.split("."))

def main():
    path = ROOT / "tools.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    entries = data["tools"]
    ids = [x["id"] for x in entries]
    if not entries or len(set(ids)) != len(ids) or not all(re.fullmatch(r"[a-z0-9-]+", i) for i in ids):
        raise RuntimeError("tools.json has duplicate or invalid tool ids")
    changes = []
    errors = []
    for tool in entries:
        try:
            version, day, evidence = latest(tool)
            old_version = tool["version"]
            if version_tuple(version) < version_tuple(old_version):
                raise ValueError("Upstream version is older than the recorded version")
            if version_tuple(version) > version_tuple(old_version) and day < tool["releaseDate"]:
                raise ValueError("New version has older release date")
            if (version, day) != (old_version, tool["releaseDate"]):
                changes.append(f"{tool['id']}: v{old_version} ({tool['releaseDate']}) -> v{version} ({day})")
                tool["version"] = version
                tool["releaseDate"] = day
                tool["dateEvidence"] = evidence
        except (ValueError, KeyError, urllib.error.URLError, TimeoutError) as exc:
            errors.append(f"{tool['id']}: {exc}")
    # A tool that fails verification keeps its recorded values; the others still sync.
    if errors:
        print("Skipped (verification failed, recorded values kept):\n" + "\n".join(errors))
    if not changes:
        print("No new releases")
        if errors:
            raise SystemExit(1)
        return
    # Update static fallback as well as metadata; do not alter links or visual styling.
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    for tool in entries:
        pattern = r'(<div class="app-meta" data-tool="' + re.escape(tool["id"]) + r'"><strong>)v[^<]+(</strong><span class="date">發布：)[^<]+(</span></div>)'
        replacement = lambda m: m.group(1) + "v" + tool["version"] + m.group(2) + tool["releaseDate"] + m.group(3)
        html, count = re.subn(pattern, replacement, html)
        if count != 1:
            raise RuntimeError(f"Unexpected HTML format: {tool['id']}")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")
    print("\n".join(changes))
    if errors:
        raise SystemExit(1)  # still flag the run as failed so the broken source is noticed

if __name__ == "__main__":
    main()
