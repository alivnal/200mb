"""Download Kunduz pixel beaver pose PNGs from Stitch into .stitch/mascots/."""

from __future__ import annotations

import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MCP_CONFIG = pathlib.Path.home() / ".cursor" / "mcp.json"
OUT_DIR = ROOT / ".stitch" / "mascots"
PROJECT_ID = "183486163239250139"

POSES = [
    ("4492d13f9ac84bc7b7cc1658b62a6103", "beaver-base-front.png"),
    ("64448e085b784d02a11a01f1a6edc114", "beaver-hard-at-work.png"),
    ("85004735ba2a4d7cbf226f1b331c5ff1", "beaver-celebrate.png"),
    ("03bf7dff772444969da850f12241acff", "beaver-greeting.png"),
    ("255995fae4dc411b8d039ccc445eff4f", "beaver-error-sad.png"),
    ("0981dfa56fa34c57aff37ebb150cd7d6", "beaver-confused.png"),
    ("9a34dbc9239540dabc34926d4acf8fd0", "beaver-sleepy.png"),
]


def load_api_key() -> str:
    config = json.loads(MCP_CONFIG.read_text(encoding="utf-8"))
    return config["mcpServers"]["stitch"]["headers"]["X-Goog-Api-Key"]


def fetch_screen(screen_id: str, api_key: str) -> dict:
    url = f"https://stitch.googleapis.com/v1/projects/{PROJECT_ID}/screens/{screen_id}"
    req = urllib.request.Request(url, headers={"X-Goog-Api-Key": api_key})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


def download_file(url: str, dest: pathlib.Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "video-compressor/1.0"})
    with urllib.request.urlopen(req) as response:
        dest.write_bytes(response.read())


def main() -> None:
    api_key = load_api_key()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    for screen_id, filename in POSES:
        screen = fetch_screen(screen_id, api_key)
        shot_url = screen.get("screenshot", {}).get("downloadUrl")
        if not shot_url:
            raise RuntimeError(f"No screenshot URL for {screen_id}")

        dest = OUT_DIR / filename
        download_file(shot_url, dest)
        title = screen.get("title", "")
        manifest.append(
            {
                "filename": filename,
                "screenId": screen_id,
                "title": title,
                "path": f".stitch/mascots/{filename}",
            }
        )
        print(f"OK {filename} ({dest.stat().st_size} bytes)")

    (OUT_DIR / "manifest.json").write_text(
        json.dumps({"projectId": PROJECT_ID, "poses": manifest}, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote manifest with {len(manifest)} poses -> {OUT_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
