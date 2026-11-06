"""Opt-in deterministic Gutenberg heading regressions for SpecGuard E1."""
import hashlib
import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts" / "aquinas-gutenberg.py"))
headings = module["article_headings"]
fixture = (
    b"EIGHTH ARTICLE [I, Q. 19, Art. 8]\r\n\r\nWhether the Will of God Imposes Necessity?\r\n"
    b"NINTH ARTICLE [I, Q. 19, Art. 8]\r\n\r\nWhether God Wills Evils?\r\n"
)


class HeadingTests(unittest.TestCase):
    def test_pinned_typo_preserves_text_and_resolves_both_articles(self):
        scope = headings.__globals__
        original = scope["SOURCE_SHA256"]
        try:
            scope["SOURCE_SHA256"] = hashlib.sha256(fixture).hexdigest()
            text, locators = headings(fixture)
        finally:
            scope["SOURCE_SHA256"] = original
        self.assertEqual(list(locators), ["ST.I.q19.a8", "ST.I.q19.a9"])
        self.assertTrue(text[locators["ST.I.q19.a9"]:].startswith(module["CORRECTION"]))
        self.assertEqual(text, fixture.decode().replace("\r\n", "\n"))

    def test_unpinned_duplicate_fails_closed(self):
        with self.assertRaisesRegex(ValueError, r"duplicate article locator: ST\.I\.q19\.a8"):
            headings(fixture)


if __name__ == "__main__":
    unittest.main()
