"""Set SourceForge defaults after its existing GitHub mirror imports a release."""

import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def request_json(url, *, data=None, headers=None):
    request = Request(
        url,
        data=data,
        headers={"Accept": "application/json", **(headers or {})},
        method="PUT" if data is not None else "GET",
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    api_key = os.environ.get("SOURCEFORGE_API_KEY")
    if not api_key:
        raise SystemExit("Add the SourceForge Releases API key as SOURCEFORGE_API_KEY in repository Actions secrets.")

    # Always resolve latest, so reruns and edits to older releases cannot roll back defaults.
    release = request_json(
        "https://api.github.com/repos/chuthree/brew-guide/releases/latest",
        headers={"Authorization": f"Bearer {os.environ['GH_TOKEN']}"},
    )
    tag = release["tag_name"]
    if release["draft"] or release["prerelease"] or not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
        raise SystemExit("Latest release must be a stable vX.Y.Z version.")

    platforms = {
        "windows": "windows_x64.exe",
        "mac": "macos_arm64.dmg",
        "linux": "linux_x64.AppImage",
        "android": "android.apk",
    }
    assets = {asset["name"]: asset for asset in release["assets"]}
    pending = {}
    for platform, suffix in platforms.items():
        name = f"BrewGuide_{tag[1:]}_{suffix}"
        if name not in assets or assets[name]["size"] <= 0:
            raise SystemExit(f"Release is missing installer: {name}")
        pending[platform] = name

    for attempt in range(25):
        for platform, name in list(pending.items()):
            try:
                result = request_json(
                    f"https://sourceforge.net/projects/brewguide/files/{tag}/{name}",
                    data=urlencode({"default": platform, "api_key": api_key}).encode(),
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                ).get("result", {})
                defaults = result.get("x_sf", {}).get("default", "").split(",")
                if (result.get("name") == name
                        and result.get("size") == assets[name]["size"]
                        and platform in defaults):
                    print(f"{platform}: {name}", flush=True)
                    del pending[platform]
            except HTTPError as error:
                if error.code in (401, 403):
                    raise SystemExit(f"SourceForge authorization failed (HTTP {error.code}).") from None
                print(f"{platform}: HTTP {error.code}; waiting for mirror", flush=True)
            except (URLError, TimeoutError, ValueError):
                # Do not print response bodies or request objects containing the API key.
                print(f"{platform}: mirror not ready; retrying", flush=True)
        if not pending:
            print(f"SourceForge defaults updated to {tag}.")
            return
        if attempt < 24:
            time.sleep(30)
    raise SystemExit(f"SourceForge did not confirm defaults for: {', '.join(pending)}. Rerun after the mirror finishes syncing.")


if __name__ == "__main__":
    main()
