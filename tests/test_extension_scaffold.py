import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXTENSION_DIR = REPO_ROOT / "extension"
METADATA_PATH = EXTENSION_DIR / "metadata.json"
EXTENSION_PATH = EXTENSION_DIR / "extension.js"
PACKAGE_JSON_PATH = REPO_ROOT / "package.json"


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

        self.assertIn("formatTopBarActivity", source)
        self.assertIn("formatTopBarActivity(this._trackerState, now)", source)
        self.assertNotIn("Focus Task 0:00", source)

    def test_extension_refreshes_top_bar_label_periodically(self):
        source = EXTENSION_PATH.read_text(encoding="utf-8")

        self.assertIn("import GLib from 'gi://GLib'", source)
        self.assertIn("LABEL_REFRESH_INTERVAL_SECONDS = 60", source)
        self.assertIn("GLib.timeout_add_seconds", source)
        self.assertIn("this._updateLabel();", source)
        self.assertIn("return GLib.SOURCE_CONTINUE", source)
        self.assertIn("GLib.source_remove(this._labelRefreshTimerId)", source)
        self.assertRegex(source, r"destroy\s*\(\)\s*{")

    def test_extension_menu_exposes_task_controls(self):
        source = EXTENSION_PATH.read_text(encoding="utf-8")

        expected_imports = [
            "addTaskToList",
            "removeTaskFromList",
            "renameTaskInList",
            "resumePreviousTaskFromBreak",
            "resumePreviousTaskFromInterruption",
            "switchToNextTask",
            "startBreakSession",
            "startInterruptionSession",
        ]
        for expected_import in expected_imports:
            self.assertIn(expected_import, source)

        expected_labels = [
            "Next",
            "Add Task...",
            "Switch to Next Task",
            "Start Break",
            "Start Interruption",
            "End Break",
            "End Interruption",
            "Manage Tasks",
            "Rename",
            "Remove",
        ]
        for label in expected_labels:
            self.assertIn(f"_('{label}')", source)

        self.assertIn("PopupMenu.PopupSubMenuMenuItem", source)
        self.assertIn("PopupMenu.PopupSeparatorMenuItem", source)
        self.assertNotIn("No active task", source)

    def test_extension_exposes_direct_switch_actions(self):
        source = EXTENSION_PATH.read_text(encoding="utf-8")

        self.assertIn("this._nextButton.connect('clicked'", source)
        self.assertIn("_updateNextButtonState", source)
        self.assertIn("_createTaskSwitchItem", source)
        self.assertIn("this.menu.addMenuItem(this._createTaskSwitchItem(task))", source)
        self.assertIn("return this._createActionItem(label, () => this._switchToTask(task.id))", source)

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

    def test_build_command_packages_local_extension_modules(self):
        package_json = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
        build_command = package_json["scripts"]["build"]

        self.assertIn("cd extension", build_command)
        self.assertIn("--extra-source activityModel.js", build_command)
        self.assertIn("--extra-source topBarViewModel.js", build_command)


if __name__ == "__main__":
    unittest.main()
