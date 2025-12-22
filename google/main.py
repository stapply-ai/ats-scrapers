from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, List

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from export_utils import generate_job_id, write_jobs_csv  # noqa: E402
from google.parser import parse_jobs  # noqa: E402

GOOGLE_DIR = Path(__file__).resolve().parent
DEFAULT_URL = "https://careers.google.com/jobs/results/"
DEFAULT_RAW_PATH = GOOGLE_DIR / "data" / "ds1_listings.json"
DEFAULT_CSV_PATH = GOOGLE_DIR / "jobs.csv"


def _rel_path(path: Path) -> Path:
    try:
        return path.relative_to(ROOT_DIR)
    except ValueError:
        return path


async def _wait_for_ds_chunk(page, chunk_key: str, timeout_ms: int) -> Any:
    js = """
    (chunkKey) => {
        const extract = () => {
            const queue = globalThis.AF_initDataChunkQueue;
            if (Array.isArray(queue)) {
                for (const entry of queue) {
                    if (entry && entry.key === chunkKey && entry.data) {
                        return entry;
                    }
                }
            }
            const requests = globalThis.AF_dataServiceRequests || {};
            const candidate = requests[chunkKey];
            if (candidate && candidate.data) {
                return { key: chunkKey, data: candidate.data };
            }
            return null;
        };
        return extract();
    }
    """
    handle = await page.wait_for_function(js, chunk_key, timeout=timeout_ms)
    chunk = await handle.json_value()
    if not chunk or "data" not in chunk:
        raise RuntimeError(f"Chunk {chunk_key} did not include data")
    return chunk["data"]


async def fetch_ds1_payload(url: str, chunk_key: str, timeout: float, headless: bool) -> List[Any]:
    timeout_ms = int(timeout * 1000)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36"
        ))
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            data = await _wait_for_ds_chunk(page, chunk_key, timeout_ms)
        finally:
            await context.close()
            await browser.close()
    return data


def build_csv_rows(jobs: List[dict[str, str]]) -> List[dict[str, str]]:
    rows: List[dict[str, str]] = []
    for job in jobs:
        job_id = generate_job_id("google", job.get("url"), job.get("ats_id"))
        rows.append({**job, "id": job_id})
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch Google Careers listings via Playwright")
    parser.add_argument("--url", default=DEFAULT_URL, help="Jobs results URL to load")
    parser.add_argument("--chunk", default="ds:1", help="AF_initData chunk key to read")
    parser.add_argument("--timeout", type=float, default=25.0, help="Timeout in seconds")
    parser.add_argument("--raw", default=str(DEFAULT_RAW_PATH), help="Path to store raw ds:1 JSON")
    parser.add_argument("--csv", default=str(DEFAULT_CSV_PATH), help="Output CSV path")
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Launch browser in headed mode (default headless)",
    )
    parser.add_argument(
        "--from-file",
        type=str,
        default=None,
        help="Skip Playwright and parse an existing ds:1 JSON file",
    )
    return parser.parse_args()


async def run(args: argparse.Namespace) -> None:
    raw_path = Path(args.raw)
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    if args.from_file:
        ds1_payload = json.loads(Path(args.from_file).read_text())
    else:
        try:
            ds1_payload = await fetch_ds1_payload(
                args.url,
                args.chunk,
                args.timeout,
                headless=not args.headed,
            )
        except PlaywrightTimeoutError as exc:
            raise SystemExit(f"Timed out waiting for ds chunk: {exc}") from exc
        raw_path.write_text(json.dumps(ds1_payload, indent=2))
        print(f"Saved raw ds:1 payload to {_rel_path(raw_path)}")

    jobs = parse_jobs(ds1_payload)
    print(f"Parsed {len(jobs)} jobs from ds:1 payload")

    rows = build_csv_rows(jobs)
    csv_path = Path(args.csv)
    diff_path = write_jobs_csv(csv_path, rows)
    print(f"Wrote {len(rows)} rows to {_rel_path(csv_path)}")
    if diff_path:
        print(f"Diff written to {_rel_path(diff_path)}")


def main() -> None:
    args = parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
