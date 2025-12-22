from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Iterable, List

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from export_utils import generate_job_id, write_jobs_csv  # noqa: E402
from google.parser import parse_jobs  # noqa: E402

GOOGLE_DIR = Path(__file__).resolve().parent
DATA_DIR = GOOGLE_DIR / "data"
JOBS_CSV_PATH = GOOGLE_DIR / "jobs.csv"
FALLBACK_RAW_FILES = [GOOGLE_DIR / "list_ds1_raw.txt"]


def _payload_files() -> List[Path]:
    paths: List[Path] = []
    if DATA_DIR.exists():
        for pattern in ("*.json", "*.txt"):
            for file_path in sorted(DATA_DIR.glob(pattern)):
                if file_path.is_file():
                    paths.append(file_path)
    for fallback in FALLBACK_RAW_FILES:
        if fallback.exists() and fallback.is_file() and fallback not in paths:
            paths.append(fallback)
    return paths


def _load_jobs_from_path(path: Path) -> List[dict[str, str]]:
    try:
        payload = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        print(f"Skipping {path.name}: {exc}")
        return []
    jobs = parse_jobs(payload)
    return jobs


def _unique_key(job: dict[str, str]) -> tuple[str, str]:
    return (job.get("ats_id") or "", job.get("url") or "")


def _job_to_row(job: dict[str, str]) -> dict[str, str]:
    url = job.get("url", "")
    ats_id = job.get("ats_id", "")
    row = {
        "url": url,
        "title": job.get("title", ""),
        "location": job.get("location", ""),
        "company": job.get("company", ""),
        "ats_id": ats_id,
    }
    row["id"] = generate_job_id("google", url, ats_id)
    return row


def main(paths: Iterable[Path] | None = None) -> None:
    raw_files = list(paths) if paths is not None else _payload_files()
    if not raw_files:
        print("No Google ds:1 payload files found. Run google/main.py to fetch data first.")
        return

    job_rows: List[dict[str, str]] = []
    seen = set()

    for raw_file in raw_files:
        jobs = _load_jobs_from_path(raw_file)
        print(f"Loaded {len(jobs)} jobs from {raw_file.relative_to(GOOGLE_DIR)}")
        for job in jobs:
            key = _unique_key(job)
            if not any(key):
                continue
            if key in seen:
                continue
            seen.add(key)
            job_rows.append(_job_to_row(job))

    print(f"Aggregated {len(job_rows)} unique jobs")
    diff_path = write_jobs_csv(JOBS_CSV_PATH, job_rows)
    if diff_path:
        print(f"Created diff file: {diff_path.name}")


if __name__ == "__main__":
    main()
