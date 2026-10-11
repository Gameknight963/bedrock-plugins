import hashlib
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify_previous(current, previous):
    if current["source"]["treeSha256"] != previous["source"]["treeSha256"]:
        raise ValueError(f"{current['manifest']['id']} changed without a version bump ({current['manifest']['version']})")


def gh(*args):
    return subprocess.check_output(["gh", *args], text=True)


def next_tag(tags, date):
    prefix = f"collection-{date}-"
    numbers = [int(tag[len(prefix):]) for tag in tags
               if tag.startswith(prefix) and re.fullmatch(r"[1-9]\d*", tag[len(prefix):])]
    return prefix + str(max(numbers, default=0) + 1)


def main():
    repository = os.environ["GITHUB_REPOSITORY"]
    commit = os.environ["GITHUB_SHA"]
    releases = json.loads(gh("api", "--paginate", "--slurp", f"repos/{repository}/releases"))
    tag_pages = json.loads(gh("api", "--paginate", "--slurp", f"repos/{repository}/tags"))
    tags = {entry["name"] for page in tag_pages for entry in page}
    tags.update(entry["tag_name"] for page in releases for entry in page)
    tag = next_tag(tags, datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    print(f"Publishing {tag}", flush=True)
    history = ROOT / ".artifacts/history"
    published = {}
    for page in releases:
        for release in page:
            previous_tag = release["tag_name"]
            if release["draft"] or not re.fullmatch(r"collection-\d{4}-\d{2}-\d{2}-[1-9]\d*", previous_tag):
                continue
            folder = history / previous_tag
            folder.mkdir(parents=True)
            gh("release", "download", previous_tag, "--repo", repository, "--pattern", "catalog.json", "--dir", str(folder))
            catalog = json.loads((folder / "catalog.json").read_text(encoding="utf-8"))
            for record in catalog["plugins"]:
                key = (record["manifest"]["id"], record["manifest"]["version"])
                published.setdefault(key, (previous_tag, record))
    dist = ROOT / ".artifacts/dist"
    catalog_file = dist / "catalog.json"
    catalog = json.loads(catalog_file.read_text(encoding="utf-8"))
    for record in catalog["plugins"]:
        filename = f"{record['manifest']['id']}-{record['manifest']['version']}.zip"
        record["package"]["url"] = f"https://github.com/{repository}/releases/download/{tag}/{filename}"
        key = (record["manifest"]["id"], record["manifest"]["version"])
        if key not in published:
            continue
        previous_tag, previous = published[key]
        verify_previous(record, previous)
        filename = f"{key[0]}-{key[1]}.zip"
        folder = history / previous_tag
        gh("release", "download", previous_tag, "--repo", repository, "--pattern", filename, "--dir", str(folder))
        package = folder / filename
        if hashlib.sha256(package.read_bytes()).hexdigest() != previous["package"]["sha256"]:
            raise ValueError(f"Published package checksum failed: {filename}")
        shutil.copyfile(package, dist / filename)
        record["package"]["sha256"] = previous["package"]["sha256"]
        record["package"]["size"] = package.stat().st_size
        record["source"] = previous["source"]
    catalog_file.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    assets = [str(file) for file in sorted(dist.iterdir()) if file.is_file()]
    gh("release", "create", tag, "--repo", repository, "--target", commit, "--draft", "--title", tag,
       "--notes", "Reviewed plugin packages. See catalog.json for versions, source commits, licenses and checksums.", *assets)
    gh("release", "edit", tag, "--repo", repository, "--draft=false")
    print(f"Published {tag}")


if __name__ == "__main__":
    main()
