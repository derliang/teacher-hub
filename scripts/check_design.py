# Copyright (c) 2026 derliang. All rights reserved.
# Non-commercial use only. See LICENSE.md.
# Authorization inquiries: derliang@gmail.com
"""Teacher Hub 設計規範自動檢查（本機執行，不需要網路、不需要任何套件）。

    python scripts/check_design.py

做什麼：
  1. repo 內每一個 .html 都必須登記在 docs/design/pages.json（沒登記就失敗）。
  2. 逐頁檢查：語言、viewport、標題、檔頭版權、tokens 與 docs/design/tokens.css 相同、
     不寫死色碼、圓角不超過 4px、字型只走 token、沒有 emoji、圖片有替代文字且檔案存在、
     沒有 iframe、頁尾只有一個版權句。
  3. 依頁面類型檢查導覽：首頁有兩扇門與兩區；子頁有頂端導覽與麵包屑；
     GAS 工具預覽頁不得有登入或安裝按鈕。
  4. 版本與計數一致：site.json、tools.json 與頁面備援文字、區段件數。
  5. tokens 的文字對比（淺色與深色）至少 4.5:1。
舊風格過渡頁（kind=legacy）只檢查最低限度，並列為例外。

檢查不到的（要人看）：實際版面有沒有跑掉、橫向捲動、各寬度的畫面。見 docs/design/PAGES.md 的「人工檢查」。
結束碼：0 通過；1 有錯誤。
"""
import fnmatch
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / "docs" / "design"

errors = []
warnings = []


def err(page, msg):
    errors.append(f"[{page}] {msg}")


def read(path):
    return Path(path).read_text(encoding="utf-8")


# ---------- tokens ----------

BLOCK_LIGHT = re.compile(r":root\{([^}]*)\}")
BLOCK_DARK_MEDIA = re.compile(r'@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}\}')
BLOCK_DARK_ATTR = re.compile(r':root\[data-theme="dark"\]\{([^}]*)\}')


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def parse_props(body):
    props = {}
    for part in body.split(";"):
        m = re.match(r"\s*--([\w-]+)\s*:\s*(.+?)\s*$", part, flags=re.S)
        if m:
            props[m.group(1)] = re.sub(r"\s+", "", m.group(2)).lower()
    return props


def token_blocks(css):
    css = strip_comments(css)
    dark_media = BLOCK_DARK_MEDIA.search(css)
    dark_attr = BLOCK_DARK_ATTR.search(css)
    rest = BLOCK_DARK_MEDIA.sub("", css)
    rest = BLOCK_DARK_ATTR.sub("", rest)
    light = BLOCK_LIGHT.search(rest)
    return (
        parse_props(light.group(1)) if light else {},
        parse_props(dark_media.group(1)) if dark_media else {},
        parse_props(dark_attr.group(1)) if dark_attr else {},
    )


def css_without_tokens(css):
    css = strip_comments(css)
    css = BLOCK_DARK_MEDIA.sub("", css)
    css = BLOCK_DARK_ATTR.sub("", css)
    css = BLOCK_LIGHT.sub("", css, count=1)
    return css


CANON = token_blocks(read(DESIGN / "tokens.css"))


def luminance(hexcolor):
    h = hexcolor.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


PAIRS = [
    ("ink", "bg"), ("ink", "surface"), ("ink", "sunk"),
    ("ink2", "bg"), ("ink2", "surface"), ("ink2", "sunk"),
    ("ink3", "bg"), ("ink3", "surface"), ("ink3", "sunk"),
    ("primary", "bg"), ("primary", "surface"),
    ("on-primary", "primary"), ("on-primary-2", "primary"),
    ("brass", "bg"), ("brass", "surface"), ("brass", "sunk"), ("brass", "brass-soft"),
    ("chip-live-fg", "chip-live-bg"),
    ("ok", "ok-soft"), ("bad", "bad-soft"),
]


def check_token_contrast():
    light, dark_media, _ = CANON
    for name, theme in (("淺色", light), ("深色", {**light, **dark_media})):
        for fg, bg in PAIRS:
            if fg not in theme or bg not in theme:
                err("tokens.css", f"{name}缺少 --{fg} 或 --{bg}")
                continue
            c = contrast(theme[fg], theme[bg])
            if c < 4.5:
                err("tokens.css", f"{name}對比不足：--{fg} 在 --{bg} 上為 {c:.2f}:1（需要 ≥ 4.5）")


# ---------- 單頁檢查 ----------

EMOJI = re.compile("[\U0001F000-\U0001FAFF⌀-⏿☀-➿⬀-⯿️]")
EMOJI_OK = {"✓", "✕"}  # ✓ ✕ 是規範允許的符號
STATUS_TEXT = {"st-live": "即開即用", "st-beta": "Beta", "st-wip": "施工中・可預覽", "st-cand": "候選"}


def visible_text(html):
    h = re.sub(r"<style\b.*?</style>", "", html, flags=re.S)
    h = re.sub(r"<script\b.*?</script>", "", h, flags=re.S)
    h = re.sub(r"<!--.*?-->", "", h, flags=re.S)
    return h


def check_common(rel, html, page):
    if not re.search(r'<html[^>]*\blang="zh-Hant"', html):
        err(rel, '<html> 缺少 lang="zh-Hant"')
    if not re.search(r'<meta charset="utf-8">', html, flags=re.I):
        err(rel, "缺少 <meta charset>")
    if not re.search(r'<meta name="viewport" content="width=device-width, ?initial-scale=1', html):
        err(rel, "缺少 viewport meta")
    if not re.search(r"<title>[^<]+</title>", html):
        err(rel, "缺少 <title>")
    if "Copyright (c) 2026 derliang" not in html[:600]:
        err(rel, "檔頭缺少版權註解（Copyright (c) 2026 derliang）")
    if re.search(r"<iframe\b", html):
        err(rel, "不得使用 iframe")


def linked_css(rel, html, base):
    """讀出頁面以 <link rel="stylesheet"> 引用的本地樣式表（外部網址如 Google Fonts 不算）。"""
    out = []
    for m in re.finditer(r"<link\b[^>]*>", html):
        tag = m.group(0)
        if not re.search(r'\brel="stylesheet"', tag):
            continue
        href = re.search(r'\bhref="([^"]+)"', tag)
        if not href or href.group(1).startswith(("http://", "https://", "//", "data:")):
            continue
        path = (base / href.group(1).split("#")[0].split("?")[0]).resolve()
        if path.exists():
            out.append(path.read_text(encoding="utf-8"))
        else:
            err(rel, f"引用的樣式表不存在：{href.group(1)}")
    return out


def check_style(rel, html, base=ROOT):
    styles = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, flags=re.S) + linked_css(rel, html, base))
    if not styles.strip():
        err(rel, "找不到 <style> 或本地樣式表")
        return
    light, dmedia, dattr = token_blocks(styles)
    if not light:
        err(rel, "找不到 :root 的 token 區塊")
    for label, got, canon in (("淺色 :root", light, CANON[0]), ("深色 media", dmedia, CANON[1]), ("深色 data-theme", dattr, CANON[2])):
        for k, v in got.items():
            if k not in canon:
                err(rel, f"{label} 宣告了規範沒有的 token --{k}")
            elif canon[k] != v:
                err(rel, f"{label} 的 --{k} 與 tokens.css 不同（頁面 {v}，規範 {canon[k]}）")
    if dmedia and dattr and dmedia != dattr:
        err(rel, "兩個深色區塊的 token 不一致")
    for need in ("bg", "surface", "ink", "primary"):
        if light and need not in light:
            err(rel, f"淺色 token 缺少 --{need}")
        if dmedia and need in CANON[1] and need not in dmedia:
            err(rel, f"深色 media 區塊缺少 --{need}")
    if not dmedia or not dattr:
        err(rel, "缺少深色模式 token 區塊（media 與 data-theme 兩個都要有）")

    body = css_without_tokens(styles)
    inline = " ".join(re.findall(r'\bstyle="([^"]*)"', html))
    scan = body + " " + inline
    for m in re.finditer(r"#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(", scan):
        err(rel, f"寫死色碼或色彩函式：{m.group(0)}（要用 var(--token)）")
        break
    for m in re.finditer(r"border-radius\s*:\s*([^;}]+)", scan):
        for val in re.findall(r"([\d.]+)(px|%|em|rem)", m.group(1)):
            n, unit = float(val[0]), val[1]
            if unit == "px" and n > 4:
                err(rel, f"圓角超過 4px：{m.group(1).strip()}")
            elif unit == "%" and n != 50:
                err(rel, f"圓角只允許 50%（圓點）：{m.group(1).strip()}")
            elif unit in ("em", "rem"):
                err(rel, f"圓角請用 px：{m.group(1).strip()}")
    for m in re.finditer(r"font-family\s*:\s*([^;}]+)", scan):
        v = m.group(1).strip()
        if not (v.startswith("var(--serif)") or v.startswith("var(--sans)") or v.startswith("ui-monospace") or v == "inherit"):
            err(rel, f"字型沒有走 token：{v[:50]}")
    if re.search(r"gradient\(", scan):
        err(rel, "不得使用漸層背景（見 DESIGN.md 第 8 節）")

    for m in re.finditer(r'<meta name="theme-color" content="(#[0-9a-fA-F]{6})"', html):
        if m.group(1).lower() not in (CANON[0]["bg"], CANON[1]["bg"]):
            err(rel, f"theme-color {m.group(1)} 不是 --bg 的淺色或深色值")


def check_text(rel, html):
    for ch in EMOJI.findall(visible_text(html)):
        if ch not in EMOJI_OK:
            err(rel, f"出現 emoji 或圖示字元 U+{ord(ch):04X}（規範不用 emoji 當標示）")
            break


def check_images(rel, html, base):
    for m in re.finditer(r"<img\b[^>]*>", html):
        tag = m.group(0)
        if not re.search(r'\balt="[^"]+"', tag):
            err(rel, f"<img> 缺少替代文字：{tag[:80]}")
        src = re.search(r'\bsrc="([^"]+)"', tag)
        if src and not src.group(1).startswith(("http", "data:")):
            target = (base / src.group(1).split("#")[0].split("?")[0]).resolve()
            if not target.exists():
                err(rel, f"圖片檔不存在：{src.group(1)}")


def check_footer(rel, html):
    if len(re.findall(r"<footer\b", html)) != 1:
        err(rel, "頁尾必須剛好一個 <footer>")
    if len(re.findall(r"© 2026 derliang", html)) != 1:
        err(rel, "頁尾版權句「© 2026 derliang」必須剛好出現一次")
    if "LICENSE.md" not in html or "授權說明" not in html:
        err(rel, "頁尾缺少授權說明連結")
    if len(re.findall(r'class="top-link"', html)) != 1:
        err(rel, "頁尾必須剛好一個「回到頂端」連結（.top-link）")
    if not re.search(r'<div class="fhead">\s*<strong>[^<]*</strong>\s*<a class="top-link"[^>]*>[^<]*</a>\s*</div>', html):
        err(rel, "頁尾「回到頂端」必須在品牌列（.fhead）右側，不可單獨成列")
    if 'class="flegal"' not in html:
        err(rel, "頁尾缺少法律列（.flegal：版權句與授權說明）")


def check_doors(rel, html):
    """兩扇門是可點的入口，必須有 hover 與鍵盤聚焦的回饋（外框變色）。"""
    for sel in (r"a\.door\.a:hover", r"a\.door\.b:hover", r"a\.door\.a:focus-visible", r"a\.door\.b:focus-visible"):
        if not re.search(sel + r"[^{]*\{[^}]*border-color", html):
            err(rel, f"兩扇門缺少互動回饋規則（{sel.replace(chr(92), '')} 要改 border-color）")


def section_blocks(html):
    out = {}
    for m in re.finditer(r'<section class="zone[^"]*" id="(usable|gas)".*?</section>', html, flags=re.S):
        out[m.group(1)] = m.group(0)
    return out


def check_home(rel, html):
    if not re.search(r'<nav class="nav"', html):
        err(rel, "缺少頂端導覽 <nav class=\"nav\">")
    doors = re.findall(r'class="door [ab]"', html)
    if len(doors) != 2:
        err(rel, f"首頁需要兩扇門，找到 {len(doors)} 個")
    check_doors(rel, html)
    secs = section_blocks(html)
    for need in ("usable", "gas"):
        if need not in secs:
            err(rel, f"缺少區段 #{need}")
    if len(secs) != 2:
        return
    counts = {}
    for sid, block in secs.items():
        cards = re.findall(r'<(a|article) class="card([^"]*)"([^>]*)>', block)
        counts[sid] = len(cards)
        for tag, cls, attrs in cards:
            classes = cls.split()
            href = re.search(r'href="([^"]*)"', attrs)
            label = re.search(r'aria-label="[^"]+"', attrs)
            if not label:
                err(rel, "工具卡缺少 aria-label")
            if tag == "a" and not href:
                err(rel, "可點的工具卡缺少 href")
            if "cand" in classes and tag != "article":
                err(rel, "候選卡必須是 <article>，不可有連結")
            if sid == "usable":
                if not ({"live", "beta"} & set(classes)):
                    err(rel, f"「立即可用」區只能放即開即用或 Beta 卡：class={cls.strip()}")
                if href and not href.group(1).startswith("https://derliang.github.io/"):
                    err(rel, f"「立即可用」卡必須直接連到作者的 GitHub Pages：{href.group(1)}")
            else:
                if "beta" in classes:
                    err(rel, "「GAS 部署」區不應有 Beta 卡")
                if "live" in classes and not (href and re.match(r"(\./|/teacher-hub/)?deploy/", href.group(1))):
                    err(rel, "「GAS 部署」區的即開即用卡必須連到 deploy/")
                if "wip" in classes and not (href and re.match(r"(\./|/teacher-hub/)?(grade-deploy/|deploy/|gas/)", href.group(1))):
                    err(rel, f"施工中卡只能連到預覽頁、舊原型或 deploy/：{href.group(1) if href else '（沒有連結）'}")
    for m in re.finditer(r'<span class="st (st-[a-z]+)">([^<]*)</span>', html):
        want = STATUS_TEXT.get(m.group(1))
        if want is None or want != m.group(2):
            err(rel, f"狀態標籤不在規範內：{m.group(1)}「{m.group(2)}」")
    for sid, label in (("usable", "立即可用"), ("gas", "GAS 部署")):
        n = counts[sid]
        count_b = re.search(r'id="%s".*?<span class="count"><b>(\d+)</b>' % sid, html, flags=re.S)
        if not count_b or int(count_b.group(1)) != n:
            err(rel, f"「{label}」區標示件數與實際卡片數不符（實際 {n}）")
        nav_em = re.search(r'<a href="#%s"[^>]*>%s<em>(\d+)</em>' % (sid, label), html)
        if not nav_em or int(nav_em.group(1)) != n:
            err(rel, f"導覽的「{label}」件數與實際卡片數不符（實際 {n}）")
    door_counts = re.findall(r'class="door [ab]".*?<b>(\d+)</b> 款', html, flags=re.S)
    if door_counts != [str(counts["usable"]), str(counts["gas"])]:
        err(rel, f"兩扇門的件數 {door_counts} 與實際 {counts['usable']}、{counts['gas']} 不符")


def check_home_basic(rel, html):
    """模擬頁的首頁：只檢查導覽與兩扇門（連結與件數是假資料，不檢查）。"""
    if not re.search(r'<nav class="nav"', html):
        err(rel, "缺少頂端導覽 <nav class=\"nav\">")
    if len(re.findall(r'class="door [ab]"', html)) != 2:
        err(rel, "首頁模擬頁需要兩扇門")
    check_doors(rel, html)


def check_sub(rel, html, kind):
    if not re.search(r'<nav class="nav"', html):
        err(rel, "缺少頂端導覽 <nav class=\"nav\">")
    if not re.search(r'<nav class="crumbs"[^>]*aria-label="所在位置"', html):
        err(rel, "缺少麵包屑（nav.crumbs，aria-label=\"所在位置\"）")
    if 'aria-current="page"' not in html:
        err(rel, "麵包屑缺少目前頁標示 aria-current=\"page\"")
    crumbs = re.search(r'<nav class="crumbs".*?</nav>', html, flags=re.S)
    if crumbs and "Teacher Hub 首頁" not in crumbs.group(0):
        err(rel, "麵包屑第一層必須是「Teacher Hub 首頁」")
    if kind == "gas-preview":
        if re.search(r"<button\b", html) or re.search(r"accounts\.google\.com|gsi/client|googleapis\.com/auth", html):
            err(rel, "GAS 工具預覽頁不得有按鈕、登入或授權（不可做出能用的樣子）")
        if not re.search(r'class="banner"', html) or not re.search(r"施工中|候選", visible_text(html)):
            err(rel, "GAS 工具預覽頁必須有狀態橫幅（施工中或候選）")
        if not re.search(r"返回.{0,6}GAS 部署", visible_text(html)):
            err(rel, "GAS 工具預覽頁必須有「返回 GAS 部署區」連結")


def check_legacy(rel, html):
    if "Copyright (c) 2026 derliang" not in html[:600]:
        err(rel, "過渡頁缺少檔頭版權註解")
    if not re.search(r'href="\.\./"', html):
        err(rel, "過渡頁缺少返回 Teacher Hub 首頁的連結（href=\"../\"）")
    if "施工中" not in html:
        err(rel, "過渡頁必須明確標示「施工中」")


def check_versions(html):
    try:
        site = json.loads(read(ROOT / "site.json"))
        tools = json.loads(read(ROOT / "tools.json"))
    except Exception as e:  # noqa: BLE001
        err("index.html", f"讀不到 site.json 或 tools.json：{e}")
        return
    m = re.search(r"首頁版本 v([\d.]+)｜更新日期 (\d{4}-\d{2}-\d{2})", html)
    if not m or (m.group(1), m.group(2)) != (site["version"], site["updated"]):
        err("index.html", f"頁尾版本備援文字與 site.json 不一致（site.json：v{site['version']}｜{site['updated']}）")
    if not re.search(r"## v%s — %s" % (re.escape(site["version"]), site["updated"]), read(ROOT / "CHANGELOG.md")):
        err("CHANGELOG.md", f"沒有 v{site['version']} — {site['updated']} 的更新紀錄")
    for t in tools["tools"]:
        m = re.search(r'<div class="app-meta" data-tool="%s"><strong>v([^<]+)</strong><span class="date">發布：([^<]+)</span></div>' % re.escape(t["id"]), html)
        if not m:
            err("index.html", f"找不到 {t['id']} 的版本備援標記（格式要符合同步腳本）")
        elif (m.group(1), m.group(2)) != (t["version"], t["releaseDate"]):
            err("index.html", f"{t['id']} 的版本備援文字與 tools.json 不一致")
    for m in re.finditer(r'data-tool="([a-z0-9-]+)"', html):
        if m.group(1) not in {t["id"] for t in tools["tools"]}:
            err("index.html", f"data-tool={m.group(1)} 不在 tools.json（上架工具必須同時進 tools.json）")


# ---------- 主程式 ----------


def all_html():
    out = []
    for p in ROOT.rglob("*.html"):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(".git/") or "/node_modules/" in rel or rel.startswith("node_modules/"):
            continue
        out.append(rel)
    return sorted(out)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    spec = json.loads(read(DESIGN / "pages.json"))
    entries = spec["pages"]
    exact = {e["path"]: e for e in entries if "path" in e}
    patterns = [e for e in entries if "pattern" in e]
    pages_md = read(DESIGN / "PAGES.md") if (DESIGN / "PAGES.md").exists() else ""
    if not pages_md:
        err("docs/design/PAGES.md", "缺少頁面清冊文件")

    for e in entries:
        key = e.get("path") or e.get("pattern")
        if key not in pages_md and key.replace("docs/design/", "") not in pages_md:
            err("docs/design/PAGES.md", f"頁面清冊文件沒有提到 {key}（pages.json 與 PAGES.md 要同步）")
        if e.get("mockup") and not (ROOT / e["mockup"]).exists():
            err("docs/design/pages.json", f"{key} 指定的模擬頁不存在：{e['mockup']}")
        if e.get("status") != "planned" and "path" in e and not (ROOT / e["path"]).exists():
            err("docs/design/pages.json", f"已登記的頁面檔案不存在：{e['path']}")

    check_token_contrast()

    checked = []
    legacy = []
    for rel in all_html():
        entry = exact.get(rel)
        if entry is None:
            for p in patterns:
                if fnmatch.fnmatch(rel, p["pattern"]):
                    entry = p
                    break
        if entry is None:
            err(rel, "頁面沒有登記在 docs/design/pages.json（新增頁面必須先登記，並對應模擬頁）")
            continue
        html = read(ROOT / rel)
        before = len(errors)
        if entry["kind"] == "legacy":
            check_legacy(rel, html)
            legacy.append(rel)
        else:
            base = (ROOT / rel).parent
            check_common(rel, html, entry)
            check_style(rel, html, base)
            check_text(rel, html)
            check_images(rel, html, base)
            check_footer(rel, html)
            if entry["nav"] == "home":
                if entry["kind"] == "home":
                    check_home(rel, html)
                    check_versions(html)
                else:
                    check_home_basic(rel, html)
            elif entry["nav"] == "sub":
                check_sub(rel, html, entry["kind"])
        checked.append((rel, entry["kind"], len(errors) == before))

    print("Teacher Hub 設計檢查")
    print("=" * 40)
    for rel, kind, ok in checked:
        print(f"{'通過' if ok else '失敗'}  {rel}  （{kind}）")
    for rel in legacy:
        print(f"例外  {rel}  （舊風格過渡頁，到期條件見 pages.json）")
    for e in entries:
        if e.get("status") == "planned" and not (ROOT / e["path"]).exists():
            print(f"待建  {e['path']}  （發布時必須通過本檢查）")
    print("-" * 40)
    if errors:
        print(f"共 {len(errors)} 個問題：")
        for line in errors:
            print("  - " + line)
        return 1
    print("全部通過。注意：版面、橫向捲動與各寬度畫面要人工看（見 docs/design/PAGES.md）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
