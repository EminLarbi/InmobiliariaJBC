import os
import re
import subprocess
from typing import Optional

import undetected_chromedriver as uc


def _run_cmd_get_output(cmd: list[str]) -> Optional[str]:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        return out.decode("utf-8", errors="ignore").strip()
    except Exception:
        return None


def detect_local_chrome_version() -> Optional[str]:
    """Return full Chrome version string like '139.0.7258.155' or None.

    Tries common paths and commands across macOS/Linux/Windows without raising.
    """
    # Allow explicit override via env vars commonly used in PaaS
    for env_var in ("CHROME_PATH", "GOOGLE_CHROME_SHIM", "GOOGLE_CHROME_BINARY"):
        p = os.environ.get(env_var)
        if p and os.path.exists(p):
            out = _run_cmd_get_output([p, "--version"]) or ""
            if out:
                m = re.search(r"(\d+\.\d+\.\d+\.\d+)", out)
                if m:
                    return m.group(1)

    candidates = []
    # macOS typical
    candidates.append("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    candidates.append("/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta")
    # Linux typical
    candidates += [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
    ]
    # Windows typical (best-effort; requires quoting spaces)
    program_files = os.environ.get("PROGRAMFILES", r"C:\\Program Files")
    program_files_x86 = os.environ.get("PROGRAMFILES(X86)", r"C:\\Program Files (x86)")
    candidates += [
        os.path.join(program_files, "Google/Chrome/Application/chrome.exe"),
        os.path.join(program_files_x86, "Google/Chrome/Application/chrome.exe"),
    ]

    for c in candidates:
        if os.path.isabs(c) and not os.path.exists(c):
            continue
        out = _run_cmd_get_output([c, "--version"]) or ""
        if not out:
            continue
        m = re.search(r"(\d+\.\d+\.\d+\.\d+)", out)
        if m:
            return m.group(1)

    # Fallback: try PATH-resolved commands
    for cmd in ("google-chrome", "chrome", "chromium", "chromium-browser"):
        out = _run_cmd_get_output([cmd, "--version"]) or ""
        if out:
            m = re.search(r"(\d+\.\d+\.\d+\.\d+)", out)
            if m:
                return m.group(1)
    return None


def detect_local_chrome_major() -> Optional[int]:
    v = detect_local_chrome_version()
    if not v:
        return None
    try:
        return int(v.split(".")[0])
    except Exception:
        return None


def make_uc_chrome(*, options: Optional[uc.ChromeOptions] = None, **kwargs):
    """Create uc.Chrome with a matching version_main when possible.

    Additional kwargs are passed through to uc.Chrome().
    """
    major = detect_local_chrome_major()
    if major:
        try:
            return uc.Chrome(options=options, version_main=major, **kwargs)
        except Exception:
            # As a last resort, fall back to default behavior
            return uc.Chrome(options=options, **kwargs)
    # Unknown local version → default behavior
    return uc.Chrome(options=options, **kwargs)

