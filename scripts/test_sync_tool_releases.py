#!/usr/bin/env python3
# Copyright (c) 2026 derliang. All rights reserved.
# Non-commercial use only. See LICENSE.md.
"""Offline tests for scripts/sync_tool_releases.py (no network)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_tool_releases import is_cleaning_release, taiwan_date, validate  # noqa: E402


class CleaningReleaseCommit(unittest.TestCase):
    def test_accepts_known_release_styles(self):
        cases = (("v2.13: 介面整個重做", "2.13"), ("Bump version to v2.9", "2.9"),
                 ("fix: 修復 QA Issues #2–#14（v2.14）", "2.14"), ("fix: something (v2.14)", "2.14"))
        for message, version in cases:
            self.assertTrue(is_cleaning_release(message, version), message)

    def test_rejects_unrelated_or_longer_versions(self):
        self.assertFalse(is_cleaning_release("fix: 工作列表排版", "2.14"))
        self.assertFalse(is_cleaning_release("fix: 修復（v2.141）", "2.14"))
        self.assertFalse(is_cleaning_release("v2.13: 介面整個重做", "2.1"))


class Dates(unittest.TestCase):
    def test_taiwan_date_rolls_over_at_utc_16(self):
        self.assertEqual(taiwan_date("2026-11-08T16:30:00Z"), "2026-11-09")
        self.assertEqual(taiwan_date("2026-11-08T08:29:00Z"), "2026-11-08")

    def test_validate_rejects_prerelease_suffix(self):
        with self.assertRaises(ValueError):
            validate("0.6.1-beta", "2026-11-25")
        self.assertEqual(validate("0.6.1", "2026-11-25"), ("0.6.1", "2026-11-25"))


if __name__ == "__main__":
    unittest.main()
