import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXTENSION_DIR = REPO_ROOT / "extension"
METADATA_PATH = EXTENSION_DIR / "metadata.json"
EXTENSION_PATH = EXTENSION_DIR / "extension.js"


class ExtensionScaffoldTest(unittest.TestCase):
    def test_metadata_declares_installable_gnome_shell_extension(self):
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))

        self.assertEqual(metadata["uuid"], "focus-task@yalovyy.com")
        self.assertEqual(metadata["name"], "Focus Task")
        self.assertIn("description", metadata)
        self.assertIn("shell-version", metadata)
        self.assertGreater(len(metadata["shell-version"]), 0)
        self.assertTrue(all(isinstance(version, str) for version in metadata["shell-version"]))
        self.assertEqual(metadata["gettext-domain"], "focus-task")

    def test_extension_uses_gnome_shell_lifecycle_without_import_side_effects(self):
        source = EXTENSION_PATH.read_text(encoding="utf-8")

        self.assertIn(
            "resource:///org/gnome/shell/extensions/extension.js",
            source,
        )
        self.assertRegex(source, r"export\s+default\s+class\s+FocusTaskExtension\s+extends\s+Extension")
        self.assertRegex(source, r"\benable\s*\(")
        self.assertRegex(source, r"\bdisable\s*\(")

        before_enable = source.split("enable()", 1)[0]
        self.assertNotIn("Main.panel.addToStatusArea", before_enable)

    def test_extension_formats_top_bar_label_from_tracker_state(self):
        source = EXTENSION_PATH.read_text(encoding="utf-8")

        self.assertIn("import {formatTopBarActivity} from './topBarViewModel.js';", source)
        self.assertIn("formatTopBarActivity(this._trackerState, now)", source)
        self.assertNotIn("Focus Task 0:00", source)

    def test_extension_file_has_no_repository_specific_paths(self):
        source = EXTENSION_PATH.read_text(encoding="utf-8")
        metadata = METADATA_PATH.read_text(encoding="utf-8")

        forbidden_patterns = [
            re.compile(r"/home/"),
            re.compile(r"Projects/focus-task"),
            re.compile(r"etf"),
        ]

        for pattern in forbidden_patterns:
            self.assertIsNone(pattern.search(source))
            self.assertIsNone(pattern.search(metadata))


if __name__ == "__main__":
    unittest.main()
