#!/usr/bin/env python3
"""Apply the template's common naming and port choices to a fresh clone."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".py", ".yaml", ".yml", ".toml", ".md", ".txt", ".ts", ".tsx", ".html", ".conf", ".env"}
IGNORED_PARTS = {".git", ".venv", "venv", "node_modules", "dist", "__pycache__"}


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    return values


def write_env(path: Path, changes: dict[str, str]) -> None:
    lines = path.read_text().splitlines()
    seen = set()
    for index, line in enumerate(lines):
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key = line.split("=", 1)[0]
        if key in changes:
            lines[index] = f"{key}={changes[key]}"
            seen.add(key)
    lines.extend(f"{key}={value}" for key, value in changes.items() if key not in seen)
    path.write_text("\n".join(lines) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-name", help="Docker Compose project name (lowercase slug)")
    parser.add_argument("--app-title", help="Title shown in the browser and application")
    parser.add_argument("--python-package", help="Django settings/Celery package name")
    parser.add_argument("--frontend-port", type=int, help="Local Vite port")
    parser.add_argument("--app-port", type=int, help="Local production HTTP port")
    args = parser.parse_args()

    env_path = ROOT / ".env"
    if not env_path.exists():
        shutil.copyfile(ROOT / ".env.example", env_path)
    current = read_env(env_path)
    changes: dict[str, str] = {}
    if args.project_name:
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.project_name):
            parser.error("--project-name must be a lowercase slug")
        changes["PROJECT_NAME"] = args.project_name
    if args.app_title:
        changes["APP_TITLE"] = args.app_title
    if args.frontend_port:
        changes["FRONTEND_PORT"] = str(args.frontend_port)
    if args.app_port:
        changes["APP_PORT"] = str(args.app_port)

    old_package = current.get("PYTHON_PACKAGE", "config")
    new_package = args.python_package or old_package
    if not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]*", new_package):
        parser.error("--python-package must be a valid Python identifier")
    package_dir = ROOT / "backend" / old_package
    target_dir = ROOT / "backend" / new_package
    if old_package != new_package:
        if not package_dir.is_dir():
            parser.error(f"Could not find current Django package: {package_dir}")
        if target_dir.exists():
            parser.error(f"Target Python package already exists: {target_dir}")
        package_dir.rename(target_dir)
        for path in ROOT.rglob("*"):
            if not path.is_file() or path.suffix not in TEXT_SUFFIXES or IGNORED_PARTS.intersection(path.parts):
                continue
            content = path.read_text(errors="ignore")
            updated = re.sub(rf"\b{re.escape(old_package)}\b", new_package, content)
            if updated != content:
                path.write_text(updated)
    changes["PYTHON_PACKAGE"] = new_package
    write_env(env_path, changes)
    print(f"Configured project values in {env_path.name}. Keep it private; it may contain secrets.")


if __name__ == "__main__":
    main()
