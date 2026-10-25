# Copyright (c) 2026 derliang. All rights reserved.
# Non-commercial use only. See LICENSE.md.
# Authorization inquiries: derliang@gmail.com
"""check_design.py 的自動測試：確認檢查真的抓得到走樣，而不是永遠通過。

    python scripts/test_check_design.py
"""
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_design as cd  # noqa: E402

ROOT = cd.ROOT
HOME = (ROOT / "index.html").read_text(encoding="utf-8")
MOCK = (ROOT / "docs/design/mockups/GAS工具預覽頁.html").read_text(encoding="utf-8")
PAGE = {"kind": "home", "nav": "home"}


def run(fn, *args):
    cd.errors.clear()
    fn(*args)
    return list(cd.errors)


def has(errs, text):
    return any(text in e for e in errs)


class RealPages(unittest.TestCase):
    def test_whole_repo_passes(self):
        cd.errors.clear()
        self.assertEqual(cd.main(), 0, "\n".join(cd.errors))


class Style(unittest.TestCase):
    def test_hardcoded_color(self):
        html = HOME.replace("</style>", ".x{color:#ff0000}</style>", 1)
        self.assertTrue(has(run(cd.check_style, "t", html), "寫死色碼"))

    def test_big_radius(self):
        html = HOME.replace("</style>", ".x{border-radius:16px}</style>", 1)
        self.assertTrue(has(run(cd.check_style, "t", html), "圓角超過 4px"))

    def test_foreign_font(self):
        html = HOME.replace("</style>", ".x{font-family:Inter,sans-serif}</style>", 1)
        self.assertTrue(has(run(cd.check_style, "t", html), "字型沒有走 token"))

    def test_gradient(self):
        html = HOME.replace("</style>", ".x{background:linear-gradient(red,blue)}</style>", 1)
        self.assertTrue(has(run(cd.check_style, "t", html), "漸層"))

    def test_token_drift(self):
        html = HOME.replace("--primary:#1b3763", "--primary:#2255aa", 1)
        self.assertTrue(has(run(cd.check_style, "t", html), "與 tokens.css 不同"))

    def test_unknown_token(self):
        html = HOME.replace("--shadow:rgba(20,35,59,.28);", "--shadow:rgba(20,35,59,.28); --neon:#0f0;", 1)
        self.assertTrue(has(run(cd.check_style, "t", html), "沒有的 token"))

    def test_missing_dark_mode(self):
        html = re.sub(r':root\[data-theme="dark"\]\{[^}]*\}', "", HOME, count=1)
        self.assertTrue(has(run(cd.check_style, "t", html), "深色"))


class LinkedCss(unittest.TestCase):
    """自助部署頁的樣式放在 assets/app.css，檢查必須讀得到並套用同樣的規則。"""

    def _page(self, css):
        import tempfile
        d = Path(tempfile.mkdtemp())
        (d / "assets").mkdir()
        (d / "assets/app.css").write_text(css, encoding="utf-8")
        html = '<html><head><link rel="stylesheet" href="assets/app.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=x"></head></html>'
        return html, d

    def _tokens(self):
        return (ROOT / "docs/design/tokens.css").read_text(encoding="utf-8")

    def test_linked_css_is_checked(self):
        html, d = self._page(self._tokens() + ".x{color:#ff0000}")
        errs = run(cd.check_style, "t", html, d)
        self.assertTrue(has(errs, "寫死色碼"))

    def test_linked_css_token_drift(self):
        html, d = self._page(self._tokens().replace("--primary:#1b3763", "--primary:#2255aa", 1))
        self.assertTrue(has(run(cd.check_style, "t", html, d), "與 tokens.css 不同"))

    def test_linked_css_clean_passes(self):
        html, d = self._page(self._tokens() + ".x{color:var(--ink);border-radius:4px;font-family:var(--sans)}")
        self.assertEqual(run(cd.check_style, "t", html, d), [])

    def test_missing_linked_css(self):
        html, d = self._page("")
        (d / "assets/app.css").unlink()
        self.assertTrue(has(run(cd.check_style, "t", html, d), "不存在"))


class Content(unittest.TestCase):
    def test_emoji(self):
        self.assertTrue(has(run(cd.check_text, "t", "<p>歡迎 🎉</p>"), "emoji"))

    def test_check_mark_allowed(self):
        self.assertEqual(run(cd.check_text, "t", "<p>✓ 會做 ✕ 不會做 → ↗</p>"), [])

    def test_img_alt(self):
        self.assertTrue(has(run(cd.check_images, "t", '<img src="x.svg">', ROOT), "替代文字"))

    def test_img_missing_file(self):
        self.assertTrue(has(run(cd.check_images, "t", '<img src="nope.svg" alt="x">', ROOT), "不存在"))

    def test_two_footers(self):
        html = HOME + "<footer>© 2026 derliang LICENSE.md 授權說明</footer>"
        self.assertTrue(has(run(cd.check_footer, "t", html), "剛好"))

    def test_iframe(self):
        self.assertTrue(has(run(cd.check_common, "t", HOME.replace("</body>", "<iframe></iframe></body>"), PAGE), "iframe"))

    def test_missing_copyright_header(self):
        self.assertTrue(has(run(cd.check_common, "t", HOME.replace("Copyright (c) 2026 derliang", "x"), PAGE), "版權"))


class Home(unittest.TestCase):
    def test_wrong_count(self):
        html = HOME.replace('<span class="count"><b>4</b>', '<span class="count"><b>9</b>', 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "件數"))

    def test_card_without_label(self):
        html = HOME.replace(' aria-label="開啟座位小幫手"', "", 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "aria-label"))

    def test_candidate_with_link(self):
        html = HOME.replace('<article class="card row cand"', '<a class="card row cand" href="x"', 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "候選卡"))

    def test_usable_card_external_link_only_own_pages(self):
        html = HOME.replace("https://derliang.github.io/seat-helper/", "https://example.com/", 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "GitHub Pages"))

    def test_bad_status_label(self):
        html = HOME.replace(">即開即用</span>", ">超讚</span>", 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "狀態標籤"))

    def test_wip_card_linking_elsewhere(self):
        html = HOME.replace('href="./deploy/?product=pingshi-grade-helper"', 'href="https://example.com/"', 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "施工中卡"))

    def test_version_mismatch(self):
        html = HOME.replace("首頁版本 v", "首頁版本 v9", 1)
        self.assertTrue(has(run(cd.check_versions, html), "不一致"))


class FooterAndDoors(unittest.TestCase):
    def test_top_link_alone_on_its_own_row(self):
        m = re.search(r'<a class="top-link"[^>]*>[^<]*</a>', HOME)
        html = HOME.replace(m.group(0), "", 1).replace('<p class="fnote">', m.group(0) + '<p class="fnote">', 1)
        self.assertTrue(has(run(cd.check_footer, "t", html), "品牌列"))

    def test_two_top_links(self):
        html = HOME.replace('<p class="fnote">', '<a class="top-link" href="#top">回到頂端 ↑</a><p class="fnote">', 1)
        self.assertTrue(has(run(cd.check_footer, "t", html), "剛好一個"))

    def test_missing_legal_row(self):
        html = HOME.replace('class="flegal"', 'class="legal"', 1)
        self.assertTrue(has(run(cd.check_footer, "t", html), "法律列"))

    def test_door_without_hover(self):
        html = HOME.replace("a.door.a:hover,a.door.a:focus-visible{border-color", "a.doorz.a:hover,a.doorz.a:focus-visible{border-color", 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "兩扇門缺少互動回饋"))

    def test_door_hover_without_border_change(self):
        html = HOME.replace("a.door.b:hover,a.door.b:focus-visible{border-color:var(--brass)}", "a.door.b:hover,a.door.b:focus-visible{color:red}", 1)
        self.assertTrue(has(run(cd.check_home, "t", html), "兩扇門缺少互動回饋"))


class Sub(unittest.TestCase):
    def test_missing_crumbs(self):
        html = re.sub(r'<nav class="crumbs".*?</nav>', "", MOCK, flags=re.S)
        self.assertTrue(has(run(cd.check_sub, "t", html, "gas-preview"), "麵包屑"))

    def test_preview_with_button(self):
        html = MOCK.replace("</body>", '<button>登入</button></body>')
        self.assertTrue(has(run(cd.check_sub, "t", html, "gas-preview"), "不得有按鈕"))

    def test_preview_without_banner(self):
        html = MOCK.replace('class="banner"', 'class="x"')
        self.assertTrue(has(run(cd.check_sub, "t", html, "gas-preview"), "狀態橫幅"))

    def test_preview_without_back_link(self):
        html = MOCK.replace("返回 GAS 部署區", "回去")
        self.assertTrue(has(run(cd.check_sub, "t", html, "gas-preview"), "返回"))


class Tokens(unittest.TestCase):
    def test_contrast_math(self):
        self.assertAlmostEqual(cd.contrast("#000000", "#ffffff"), 21.0, places=1)

    def test_canonical_tokens_pass(self):
        self.assertEqual(run(cd.check_token_contrast), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
