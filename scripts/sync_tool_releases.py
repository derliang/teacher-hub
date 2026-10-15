#!/usr/bin/env python3
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
ALLOWED = ("seat-helper", "cleaning-helper", "exam-helper-clock")
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

def latest(repo):
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
        releases = [c for c in commits if re.search(r"(?i)(bump version|release|發版|版本).*?v" + re.escape(v) + r"(?![\d.])", c["commit"]["message"])]
        if not releases:
            raise ValueError("No matching cleaning version-release commit in recent history")
        day = releases[0]["commit"]["committer"]["date"][:10]
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
    if sorted(x["id"] for x in entries) != sorted(ALLOWED):
        raise RuntimeError("Tools allowlist changed; manual approval required")
    changes = []
    errors = []
    for tool in entries:
        try:
            version, day, evidence = latest(tool["id"])
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
    if errors:
        raise RuntimeError("Cannot safely sync all sources; no changes written:\n" + "\n".join(errors))
    if not changes:
        print("No new releases")
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

if __name__ == "__main__":
    main()
