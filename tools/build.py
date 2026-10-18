import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def contained(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError(f"Invalid package path: {relative!r}")
    path = (root / relative).resolve()
    if Path(relative).is_absolute() or not path.is_relative_to(root.resolve()) or path == root.resolve():
        raise ValueError(f"Path escapes its root: {relative}")
    return path


def sdk_root(path):
    sdk = Path(path).resolve()
    pin = json.loads((ROOT / "sdk.json").read_text())
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=sdk, text=True).strip()
    if revision != pin["revision"]:
        raise ValueError(f"SDK must be at {pin['revision']}, found {revision}")
    return sdk


def find_msbuild():
    vswhere = Path(os.environ.get("ProgramFiles(x86)", "")) / "Microsoft Visual Studio/Installer/vswhere.exe"
    if not vswhere.is_file():
        direct = shutil.which("MSBuild.exe")
        if direct:
            return direct
        raise ValueError("MSBuild was not found; use --msbuild or install Visual Studio C++ build tools")
    matches = subprocess.check_output([str(vswhere), "-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-find", "MSBuild/**/Bin/MSBuild.exe"], text=True).splitlines()
    if not matches:
        raise ValueError("No Visual Studio installation with C++ build tools was found")
    return matches[0]


def package(folder):
    manifest = json.loads((folder / "plugin.json").read_text(encoding="utf-8"))
    if manifest.get("manifestVersion") != 3 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", manifest.get("id", "")):
        raise ValueError(f"Invalid manifest in {folder.name}")
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?", manifest.get("version", "")):
        raise ValueError(f"Invalid version in {folder.name}")
    for required in ["plugin.json", "README.md", "LICENSE"]:
        if not (folder / required).is_file():
            raise ValueError(f"{folder.name} must package {required}")
    for entry in manifest.get("entrypoints", {}).values():
        if entry.get("runtime") not in {"javascript", "native", "dotnet-wasm", "dotnet"} or not contained(folder, entry.get("path")).is_file():
            raise ValueError(f"{folder.name} does not package its declared entry point")
    if not manifest.get("entrypoints") or not contained(folder, manifest.get("readme", "README.md")).is_file():
        raise ValueError(f"Invalid entry points or README in {folder.name}")
    return manifest


def archive(folder, destination):
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for file in sorted(folder.rglob("*")):
            if not file.is_file():
                continue
            info = zipfile.ZipInfo(f"{folder.name}/{file.relative_to(folder).as_posix()}", date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            output.writestr(info, file.read_bytes())
    return hashlib.sha256(destination.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sdk", default=str(ROOT / ".sdk/bedrock"))
    parser.add_argument("--msbuild")
    parser.add_argument("--toolset")
    parser.add_argument("--base-url", default="")
    parser.add_argument("--source-commit")
    parser.add_argument("--skip-build", action="store_true")
    args = parser.parse_args()
    sdk = sdk_root(args.sdk)
    revision = args.source_commit
    if not revision:
        result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, capture_output=True)
        revision = result.stdout.strip() if result.returncode == 0 else None
    if revision and not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Source commit must be a full Git commit hash")
    if args.base_url and not revision:
        raise ValueError("Published catalogs require a source commit")
    artifacts = ROOT / ".artifacts"
    # Only this generated directory is cleared; plugin sources and installed packages are untouched.
    if artifacts.exists():
        if artifacts.resolve() != ROOT / ".artifacts":
            raise ValueError("Artifact directory must not be a symlink")
        shutil.rmtree(artifacts)
    dist = artifacts / "dist"
    dist.mkdir(parents=True)
    records = []
    ids = set()
    msbuild = None
    for folder in sorted((ROOT / "plugins").iterdir()):
        if not folder.is_dir():
            continue
        projects = [file for file in folder.iterdir() if file.suffix in {".esproj", ".vcxproj", ".csproj"}]
        if len(projects) != 1:
            raise ValueError(f"{folder.name} must contain exactly one plugin project")
        project = projects[0]
        output = artifacts / "packages" / folder.name
        properties = [f"/p:BedrockSdkRoot={sdk}", f"/p:PluginPackageDir={output}"]
        if args.skip_build:
            properties.append("/p:PluginSkipBuild=true")
        if project.suffix == ".csproj":
            command = ["dotnet", "msbuild", str(project), "/restore", "/t:PackagePlugin", "/p:Configuration=Release", "/nologo", *properties]
        else:
            msbuild = msbuild or args.msbuild or find_msbuild()
            platform = "AnyCPU" if project.suffix == ".esproj" else "x64"
            command = [msbuild, str(project), "/restore", "/t:PackagePlugin", "/p:Configuration=Release", f"/p:Platform={platform}", "/verbosity:minimal", "/nologo", *properties]
            if args.toolset and project.suffix == ".vcxproj":
                command.append(f"/p:PlatformToolset={args.toolset}")
        subprocess.run(command, check=True)
        manifest = package(output)
        if manifest["id"] in ids:
            raise ValueError(f"Duplicate plugin id: {manifest['id']}")
        ids.add(manifest["id"])
        filename = f"{manifest['id']}-{manifest['version']}.zip"
        checksum = archive(output, dist / filename)
        tree = hashlib.sha256((ROOT / "sdk.json").read_bytes())
        tree.update((ROOT / "tools/Plugin.targets").read_bytes())
        for file in sorted(folder.rglob("*")):
            relative = file.relative_to(folder)
            if file.is_file() and not any(part in {"bin", "obj"} for part in relative.parts):
                tree.update(relative.as_posix().encode())
                tree.update(b"\0")
                tree.update(file.read_bytes())
                tree.update(b"\0")
        records.append({"manifest": manifest, "license": manifest.get("license"), "readme": (output / manifest.get("readme", "README.md")).read_text(),
            "package": {"url": args.base_url.rstrip("/") + "/" + filename if args.base_url else filename, "sha256": checksum, "size": (dist / filename).stat().st_size},
            "source": {"repository": "https://github.com/Gameknight963/bedrock-plugins", "commit": revision, "path": f"plugins/{folder.name}", "treeSha256": tree.hexdigest()}})
    subprocess.run(["node", str(ROOT / "tools/validate.cjs"), str(sdk), str(artifacts / "packages")], check=True)
    catalog = {"catalogVersion": 1, "sdk": json.loads((ROOT / "sdk.json").read_text()), "plugins": records}
    (dist / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Packaged {len(records)} plugins in {dist}")


if __name__ == "__main__":
    main()
