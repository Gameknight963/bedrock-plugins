import importlib.util
import json
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


build = module("build")
release = module("release")


class PackagingTests(unittest.TestCase):
    def test_every_plugin_has_one_project_in_the_solution(self):
        listed = {entry.attrib["Path"] for entry in ET.parse(ROOT / "Plugins.slnx").getroot().iter("Project")}
        expected = set()
        for folder in (ROOT / "plugins").iterdir():
            if not folder.is_dir():
                continue
            definition = json.loads((folder / "build.json").read_text())
            project = folder / definition["project"]
            projects = [file for file in folder.iterdir() if file.suffix in {".esproj", ".vcxproj", ".csproj"}]
            self.assertEqual(projects, [project], folder.name)
            expected.add(project.relative_to(ROOT).as_posix())
        self.assertEqual(listed, expected)

    def test_plugin_sources_do_not_contain_binaries(self):
        for file in (ROOT / "plugins").rglob("*"):
            relative = file.relative_to(ROOT / "plugins")
            if any(part in {"bin", "obj"} for part in relative.parts):
                continue
            self.assertNotIn(file.suffix.lower(), {".dll", ".node", ".exe", ".wasm", ".lib", ".pdb"}, str(relative))

    def test_paths_cannot_escape_or_be_absolute(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ["../outside", str(root / "absolute"), "a\\b", "."]:
                with self.assertRaises(ValueError):
                    build.contained(root, relative)

    def test_declared_entry_point_must_be_packaged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plugin = root / "plugin"
            plugin.mkdir()
            (plugin / "plugin.json").write_text(json.dumps({"manifestVersion": 2, "id": "test.plugin", "version": "1.0.0", "entrypoints": {"renderer": {"runtime": "javascript", "path": "missing.js"}}}))
            (plugin / "build.json").write_text(json.dumps({"files": {"plugin.json": "plugin.json", "README.md": "README.md", "LICENSE": "LICENSE"}}))
            with self.assertRaisesRegex(ValueError, "entry point"):
                build.package(plugin, root / "output")

    def test_archives_are_stable_and_contain_one_folder(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plugin = root / "example"
            plugin.mkdir()
            (plugin / "LICENSE").write_text("License")
            (plugin / "README.md").write_text("Description")
            first = build.archive(plugin, root / "first.zip")
            second = build.archive(plugin, root / "second.zip")
            self.assertEqual(first, second)
            with zipfile.ZipFile(root / "first.zip") as archive:
                self.assertEqual(archive.namelist(), ["example/LICENSE", "example/README.md"])

    def test_published_version_requires_same_source(self):
        record = {"manifest": {"id": "example", "version": "1.0.0"}, "source": {"treeSha256": "a"}}
        release.verify_previous(record, record)
        changed = {**record, "source": {"treeSha256": "b"}}
        with self.assertRaisesRegex(ValueError, "version bump"):
            release.verify_previous(changed, record)


if __name__ == "__main__":
    unittest.main()
