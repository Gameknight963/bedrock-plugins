import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    pin = json.loads((ROOT / "sdk.json").read_text())
    destination = ROOT / ".sdk" / "bedrock"
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--no-checkout", pin["repository"], str(destination)], check=True)
    subprocess.run(["git", "fetch", "origin", pin["revision"]], cwd=destination, check=True)
    subprocess.run(["git", "checkout", "--detach", pin["revision"]], cwd=destination, check=True)
    print(f"SDK ready at {destination}")


if __name__ == "__main__":
    prepare()
