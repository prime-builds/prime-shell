#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "services" / "python-backend"
SCHEMA_ROOT = ROOT / "packages" / "app-contracts" / "schemas"
WORK_ROOT = BACKEND_ROOT / "build" / "pyinstaller"


def get_target_identity() -> str:
    os_name = {
        "darwin": "macos",
        "linux": "linux",
        "win32": "windows",
    }.get(sys.platform, sys.platform)
    machine = platform.machine().lower()
    arch = {
        "amd64": "x86_64",
        "x64": "x86_64",
        "arm64": "aarch64",
        "aarch64": "aarch64",
    }.get(machine, machine)
    return f"{os_name}-{arch}"


def calculate_schema_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*.json")):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return "sha256:" + digest.hexdigest()


def calculate_build_id(source: Path, entrypoint: Path) -> str:
    digest = hashlib.sha256()
    paths = sorted(source.rglob("*.py")) + [entrypoint]
    for path in paths:
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return "sha256:" + digest.hexdigest()


def main() -> int:
    target_identity = get_target_identity()
    schema_hash = calculate_schema_hash(SCHEMA_ROOT)
    build_id = calculate_build_id(
        BACKEND_ROOT / "src", BACKEND_ROOT / "entrypoint.py"
    )

    if WORK_ROOT.exists():
        shutil.rmtree(WORK_ROOT)

    metadata_dir = WORK_ROOT / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    build_info_path = metadata_dir / "build_info.json"
    build_info_path.write_text(
        json.dumps(
            {
                "buildId": build_id,
                "schemaHash": schema_hash,
                "targetTriple": target_identity,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    data_sep = ";" if sys.platform == "win32" else ":"
    add_data_arg = f"{build_info_path.resolve()}{data_sep}prime_shell_backend"

    pyinstaller_cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        "--onedir",
        "--console",
        "--name",
        "prime-shell-python-backend",
        "--paths",
        str((BACKEND_ROOT / "src").resolve()),
        "--add-data",
        add_data_arg,
        "--distpath",
        str((WORK_ROOT / "dist").resolve()),
        "--workpath",
        str((WORK_ROOT / "work").resolve()),
        "--specpath",
        str((WORK_ROOT / "spec").resolve()),
        str((BACKEND_ROOT / "entrypoint.py").resolve()),
    ]

    print("Running PyInstaller:", " ".join(pyinstaller_cmd))
    subprocess.run(pyinstaller_cmd, check=True)

    output_root = BACKEND_ROOT / "dist" / "sidecar" / target_identity
    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    shutil.copytree(
        WORK_ROOT / "dist" / "prime-shell-python-backend",
        output_root / "prime-shell-python-backend",
    )

    bundle = output_root / "prime-shell-python-backend"
    files = []
    for path in sorted(item for item in bundle.rglob("*") if item.is_file()):
        files.append(
            {
                "path": path.relative_to(bundle).as_posix(),
                "size": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )

    manifest_path = output_root / "sidecar-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "backendVersion": "0.1.0",
                "buildId": build_id,
                "schemaHash": schema_hash,
                "targetTriple": target_identity,
                "bundleBytes": sum(item["size"] for item in files),
                "files": files,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Sidecar successfully built at: {output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
