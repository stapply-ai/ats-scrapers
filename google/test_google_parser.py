from __future__ import annotations

import json
from pathlib import Path

from google.parser import find_job_by_ats_id, parse_jobs


SAMPLE_PATH = Path(__file__).resolve().parents[1] / "google" / "list_ds1_raw.txt"


def load_sample_jobs():
    data = json.loads(SAMPLE_PATH.read_text())
    return parse_jobs(data)


def test_parse_google_index_contains_expected_jobs():
    jobs = load_sample_jobs()

    assert len(jobs) == 20
    first_job = jobs[0]

    assert first_job["ats_id"] == "75727382358434502"
    assert first_job["title"].startswith("Customer Solutions Engineer")
    assert "Singapore" in first_job["location"]


def test_find_single_job_by_ats_id():
    jobs = load_sample_jobs()

    job = find_job_by_ats_id(jobs, "101243395980042950")
    assert job is not None
    assert "Technical Program Manager" in job["title"]
    assert "Thornton, CO, USA" in job["location"]
    assert "Reston, VA, USA" in job["location"]
