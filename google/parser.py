from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, List, Sequence


def load_ds1_payload(path: str | Path) -> List[Any]:
    """Load the cached ds:1 payload produced by the Google careers listing page."""
    file_path = Path(path)
    raw = json.loads(file_path.read_text())
    if isinstance(raw, dict) and "data" in raw:
        raw = raw["data"]
    if not isinstance(raw, list):
        raise ValueError("ds:1 payload must be a list")
    return raw


def extract_job_entries(ds1_payload: Any) -> List[Sequence[Any]]:
    """Return the list of job rows from a ds:1 payload."""
    if isinstance(ds1_payload, dict):
        ds1_payload = ds1_payload.get("data")
    if not isinstance(ds1_payload, list) or not ds1_payload:
        return []
    job_entries = ds1_payload[0]
    if isinstance(job_entries, list):
        return job_entries
    return []


def _coerce_str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _extract_location_name(raw_location: Any) -> str | None:
    if isinstance(raw_location, str):
        candidate = raw_location.strip()
        return candidate or None
    if isinstance(raw_location, list):
        for item in raw_location:
            if isinstance(item, str):
                candidate = item.strip()
                if candidate:
                    return candidate
            elif isinstance(item, list):
                for sub in item:
                    if isinstance(sub, str):
                        candidate = sub.strip()
                        if candidate:
                            return candidate
    return None


def _format_locations(raw_locations: Any) -> str:
    if not isinstance(raw_locations, list):
        return ""
    ordered_unique: List[str] = []
    for raw in raw_locations:
        name = _extract_location_name(raw)
        if name and name not in ordered_unique:
            ordered_unique.append(name)
    return ", ".join(ordered_unique)


def normalize_job_entry(entry: Sequence[Any]) -> dict[str, str] | None:
    if not isinstance(entry, Sequence) or not entry:
        return None

    def get(idx: int) -> Any:
        return entry[idx] if idx < len(entry) else None

    ats_id = _coerce_str(get(0))
    title = _coerce_str(get(1))
    url = _coerce_str(get(2))
    company = _coerce_str(get(7)) or "Google"
    locations = _format_locations(get(9))

    if not ats_id and not url:
        return None

    return {
        "url": url,
        "title": title,
        "location": locations,
        "company": company,
        "ats_id": ats_id,
    }


def parse_jobs(ds1_payload: Any) -> List[dict[str, str]]:
    jobs: List[dict[str, str]] = []
    for entry in extract_job_entries(ds1_payload):
        normalized = normalize_job_entry(entry)
        if normalized:
            jobs.append(normalized)
    return jobs


def find_job_by_ats_id(jobs: Iterable[dict[str, str]], ats_id: str) -> dict[str, str] | None:
    for job in jobs:
        if job.get("ats_id") == ats_id:
            return job
    return None
