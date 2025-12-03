#!/usr/bin/env python3
"""
Post job listings to X/Twitter using Playwright (alternative to browser-use).

This is a simpler, more reliable approach using Playwright directly.
"""

import asyncio
import csv
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Optional, Set
from datetime import date, datetime, timezone, timedelta
import json
import shutil
import sqlite3
import tempfile

try:
    from playwright.async_api import async_playwright, Browser, Page
except ImportError:
    print(
        "❌ Playwright not installed. Install with: uv add playwright && uv run playwright install chromium"
    )
    Browser = None
    Page = None

# Get root directory
ROOT_DIR = Path(__file__).resolve().parent

# Track posted jobs
POSTED_JOBS_FILE = ROOT_DIR / "posted_jobs.json"


def load_posted_jobs() -> Set[str]:
    """Load set of job URLs that have already been posted."""
    if not POSTED_JOBS_FILE.exists():
        return set()

    try:
        with open(POSTED_JOBS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return set(data.get("posted_urls", []))
    except Exception as e:
        print(f"Error loading posted jobs: {e}", file=sys.stderr)
        return set()


def save_posted_jobs(posted_urls: Set[str]):
    """Save set of posted job URLs."""
    try:
        data = {
            "posted_urls": list(posted_urls),
            "last_updated": datetime.now().isoformat(),
        }
        with open(POSTED_JOBS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving posted jobs: {e}", file=sys.stderr)


def get_new_jobs_from_csv(
    csv_path: Path, date_filter: Optional[str] = None
) -> List[Dict]:
    """
    Read new jobs from new_ai.csv.
    If date_filter is provided, only return jobs with that date_added.
    Otherwise, return all jobs that haven't been posted yet.
    """
    if not csv_path.exists():
        return []

    posted_urls = load_posted_jobs()
    jobs = []

    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                url = row.get("url", "").strip()
                date_added = row.get("date_added", "").strip()

                # Skip if already posted
                if url in posted_urls:
                    continue

                # Apply date filter if provided
                if date_filter and date_added != date_filter:
                    continue

                jobs.append(row)
    except Exception as e:
        print(f"Error reading CSV: {e}", file=sys.stderr)

    return jobs


def format_summary_post(jobs: List[Dict], is_daily: bool = False) -> str:
    """
    Format jobs into a summary post for social media.
    For now, returns a simple format. Can be enhanced later.
    """
    if not jobs:
        return ""

    count = len(jobs)
    today_str = date.today().strftime("%B %d, %Y")

    if is_daily:
        post = f"🚀 {count} new AI job{'s' if count != 1 else ''} posted today ({today_str})!\n\n"
    else:
        post = f"🆕 {count} new AI job{'s' if count != 1 else ''} just posted!\n\n"

    # Add top 3-5 jobs
    for i, job in enumerate(jobs[:5], 1):
        title = job.get("title", "Unknown")
        company = job.get("company", "Unknown")
        location = job.get("location", "Unknown")
        url = job.get("url", "")

        # Shorten location if too long
        if len(location) > 30:
            location = location.split(",")[0]

        post += f"{i}. {title} @ {company} ({location})\n{url}\n\n"

    post += "🔗 View all jobs: https://stapply.ai/jobs"

    return post


def get_chrome_cookies(
    profile_name: str = "Default", domain: str = "x.com"
) -> List[Dict]:
    """
    Extract cookies from Chrome's Cookies database for a specific domain.
    Returns a list of cookies in Playwright format.
    """
    # Path to Chrome Cookies database
    chrome_cookies_path = (
        Path.home()
        / "Library/Application Support/Google/Chrome"
        / profile_name
        / "Cookies"
    )

    if not chrome_cookies_path.exists():
        raise FileNotFoundError(
            f"Chrome Cookies database not found: {chrome_cookies_path}. "
            "Make sure Chrome is closed and the profile exists."
        )

    # Copy Cookies file to temp location (it's locked when Chrome is running)
    temp_cookies = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    temp_cookies_path = temp_cookies.name
    temp_cookies.close()

    try:
        # Copy the Cookies file
        shutil.copy2(chrome_cookies_path, temp_cookies_path)

        # Connect to the copied database
        conn = sqlite3.connect(temp_cookies_path)
        cursor = conn.cursor()

        # Query cookies for the domain (x.com and twitter.com)
        # Chrome stores cookies with host_key like '.x.com' or 'x.com'
        domains = [domain, f".{domain}"]
        if domain == "x.com":
            domains.extend(["twitter.com", ".twitter.com"])

        placeholders = ",".join(["?"] * len(domains))
        query = f"""
            SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly, samesite
            FROM cookies
            WHERE host_key IN ({placeholders})
        """

        cursor.execute(query, domains)
        rows = cursor.fetchall()

        # Convert to Playwright cookie format
        cookies = []
        for row in rows:
            (
                name,
                value,
                host_key,
                path,
                expires_utc,
                is_secure,
                is_httponly,
                samesite,
            ) = row

            # Convert expires_utc (Chrome uses microseconds since 1601-01-01)
            # to Unix timestamp (seconds since 1970-01-01)
            if expires_utc and expires_utc > 0:
                # Chrome epoch: 1601-01-01 00:00:00 UTC
                # Unix epoch: 1970-01-01 00:00:00 UTC
                # Difference: 11644473600 seconds
                chrome_epoch_offset = 11644473600
                # Convert from microseconds to seconds, then subtract offset
                expires_timestamp = (expires_utc / 1_000_000) - chrome_epoch_offset
                expires = int(expires_timestamp) if expires_timestamp > 0 else None
            else:
                expires = None

            # Convert samesite (0=None, 1=Lax, 2=Strict)
            same_site_map = {0: "None", 1: "Lax", 2: "Strict"}
            same_site_value = same_site_map.get(samesite, "Lax")

            cookie = {
                "name": name,
                "value": value,
                "domain": host_key.lstrip("."),  # Remove leading dot
                "path": path or "/",
                "expires": expires,
                "httpOnly": bool(is_httponly),
                "secure": bool(is_secure),
                "sameSite": same_site_value,
            }

            cookies.append(cookie)

        conn.close()
        return cookies

    except Exception as e:
        print(f"⚠️  Error reading cookies: {e}", file=sys.stderr)
        return []
    finally:
        # Clean up temp file
        try:
            Path(temp_cookies_path).unlink(missing_ok=True)
        except Exception:
            pass


def clone_chrome_profile(profile_name: str = "Default") -> Path:
    """
    Clone Chrome profile to a local directory to avoid conflicts.
    Returns the path to the cloned profile directory.
    """
    # Source Chrome profile
    src_root_dir = Path.home() / "Library/Application Support/Google/Chrome"
    src_profile_dir = src_root_dir / profile_name

    # Local cloned profile directory
    local_root = ROOT_DIR / "user_data" / "Chrome"
    local_profile_dir = local_root / profile_name

    # Create local directory if it doesn't exist
    local_root.mkdir(parents=True, exist_ok=True)

    # Only clone if source exists and local doesn't exist or is outdated
    if src_profile_dir.exists():
        # Check if we need to update (compare modification times of key files)
        needs_update = True
        if local_profile_dir.exists():
            try:
                # Check if Cookies file is newer in source
                src_cookies = src_profile_dir / "Cookies"
                local_cookies = local_profile_dir / "Cookies"
                if src_cookies.exists() and local_cookies.exists():
                    src_mtime = src_cookies.stat().st_mtime
                    local_mtime = local_cookies.stat().st_mtime
                    if src_mtime <= local_mtime:
                        # Check a few more key files
                        key_files = ["Preferences", "Login Data", "Web Data"]
                        needs_update = any(
                            (src_profile_dir / f).exists()
                            and (local_profile_dir / f).exists()
                            and (src_profile_dir / f).stat().st_mtime
                            > (local_profile_dir / f).stat().st_mtime
                            for f in key_files
                        )
            except Exception:
                needs_update = True

        if needs_update:
            print(f"📋 Cloning Chrome profile '{profile_name}' to local directory...")

            # Define ignore patterns for files that shouldn't be copied
            ignore_patterns = shutil.ignore_patterns(
                "Singleton*",
                "RunningChromeVersion",
                "*.lock",
                "*Lock",
                "*Journal*",
                "GPUCache",
                "ShaderCache",
                "GrShaderCache",
            )

            try:
                # Remove old local profile if it exists
                if local_profile_dir.exists():
                    shutil.rmtree(local_profile_dir, ignore_errors=True)

                # Copy the profile
                shutil.copytree(
                    src_profile_dir,
                    local_profile_dir,
                    ignore=ignore_patterns,
                    symlinks=True,
                    dirs_exist_ok=True,
                )
                print(f"✅ Profile cloned to: {local_profile_dir}")
            except Exception as e:
                print(
                    f"⚠️  Error cloning profile: {e}. Using existing local copy if available.",
                    file=sys.stderr,
                )
                if not local_profile_dir.exists():
                    raise
        else:
            print(f"✅ Using existing cloned profile: {local_profile_dir}")
    else:
        raise FileNotFoundError(
            f"Chrome profile not found: {src_profile_dir}. Make sure Chrome is installed and you have a '{profile_name}' profile."
        )

    return local_profile_dir


async def post_to_x_playwright(content: str) -> bool:
    """
    Post content to X/Twitter using Playwright with Chrome profile.
    Returns True if successful, False otherwise.
    """
    if Browser is None or Page is None:
        print("❌ Playwright not available")
        return False

    try:
        # Get cookies from Chrome
        print("🍪 Extracting cookies from Chrome...")
        cookies = get_chrome_cookies("Default", "x.com")

        if not cookies:
            print("⚠️  No cookies found for x.com. You may need to log in manually.")
        else:
            print(f"✅ Found {len(cookies)} cookies for x.com")

        print("🤖 Starting Playwright browser...")
        print(f"📝 Content to post ({len(content)} characters):")
        print("-" * 50)
        print(content)
        print("-" * 50)

        async with async_playwright() as p:
            # Launch regular browser with stealth settings
            browser = await p.chromium.launch(
                headless=False,  # Set to True for headless mode
                channel="chrome",  # Use installed Chrome
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process",
                ],
            )

            try:
                # Create a new context with realistic settings to avoid detection
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1920, "height": 1080},
                    locale="en-US",
                    timezone_id="America/Los_Angeles",
                    permissions=["geolocation", "notifications"],
                    extra_http_headers={
                        "Accept-Language": "en-US,en;q=0.9",
                        "Accept-Encoding": "gzip, deflate, br",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        "Connection": "keep-alive",
                        "Upgrade-Insecure-Requests": "1",
                    },
                )

                # Add script to hide webdriver property and other automation indicators
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    
                    // Override the plugins property
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5]
                    });
                    
                    // Override the languages property
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en']
                    });
                    
                    // Override the chrome property
                    window.chrome = {
                        runtime: {}
                    };
                """)

                # Add cookies to the context
                if cookies:
                    print(f"🍪 Injecting {len(cookies)} cookies...")
                    await context.add_cookies(cookies)

                page = await context.new_page()

                # First navigate to home page to establish session
                print("🌐 Navigating to X.com home page...")
                await page.goto(
                    "https://x.com", wait_until="domcontentloaded", timeout=30000
                )
                await asyncio.sleep(
                    3
                )  # Wait for page to fully load and establish session

                # Check if we're logged in
                logged_in = (
                    await page.locator(
                        '[data-testid="SideNav_AccountSwitcher_Button"]'
                    ).count()
                    > 0
                )
                if not logged_in:
                    print(
                        "⚠️  May not be logged in. Cookies might be expired or invalid."
                    )
                else:
                    print("✅ Appears to be logged in")

                # Now navigate to compose page
                print("📝 Navigating to compose page...")
                await page.goto(
                    "https://x.com/compose/post",
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                await asyncio.sleep(2)  # Additional wait for page to settle

                # Wait for the compose textarea
                print("⏳ Waiting for compose textarea...")
                textarea = page.locator('div[data-testid="tweetTextarea_0"]')
                await textarea.wait_for(state="visible", timeout=10000)

                # Type the content
                print("⌨️  Typing content...")
                await textarea.click()
                await textarea.fill(content)

                # Wait a moment for the post button to become enabled
                await asyncio.sleep(1)

                # Click the post button
                print("📤 Clicking post button...")
                post_button = page.locator('button[data-testid="tweetButton"]')
                await post_button.wait_for(state="visible", timeout=5000)
                await post_button.click()

                # Wait for confirmation (post to appear or redirect)
                print("⏳ Waiting for post confirmation...")
                await asyncio.sleep(3)

                # Check if we're still on compose page (post might have failed)
                # or if we've been redirected (post succeeded)
                current_url = page.url
                if "compose" not in current_url:
                    print("✅ Post appears to have been published!")
                else:
                    # Check for error messages
                    error_elements = await page.locator('[role="alert"]').count()
                    if error_elements > 0:
                        error_text = await page.locator(
                            '[role="alert"]'
                        ).first.inner_text()
                        print(f"⚠️  Possible error: {error_text}")
                    else:
                        print("✅ Post button clicked (verifying...)")

                await context.close()
                await browser.close()
                return True

            except Exception as e:
                print(f"❌ Error during posting: {e}", file=sys.stderr)
                try:
                    await context.close()
                except Exception:
                    pass
                try:
                    await browser.close()
                except Exception:
                    pass
                return False

    except Exception as e:
        print(f"❌ Error launching browser: {e}", file=sys.stderr)
        return False


def post_to_x(content: str) -> bool:
    """
    Synchronous wrapper for posting to X/Twitter.
    Returns True if successful, False otherwise.
    """
    try:
        return asyncio.run(post_to_x_playwright(content))
    except Exception as e:
        print(f"❌ Error in async execution: {e}", file=sys.stderr)
        return False


def is_5pm_pst() -> bool:
    """Check if current time is 5 PM PST."""
    pst = timezone(timedelta(hours=-8))  # PST is UTC-8
    now = datetime.now(pst)
    return now.hour == 17 and now.minute < 5  # Within 5 minutes of 5 PM


def daily_digest_post():
    """Post daily digest of all new jobs from today at 5 PM PST."""
    today_str = date.today().strftime("%d-%m-%Y")
    new_ai_path = ROOT_DIR / "new_ai.csv"

    # Get all jobs from today
    jobs = get_new_jobs_from_csv(new_ai_path, date_filter=today_str)

    if not jobs:
        print("No new jobs from today to post.")
        return

    # Format and post
    post_content = format_summary_post(jobs, is_daily=True)

    if post_to_x(post_content):
        # Mark jobs as posted
        posted_urls = load_posted_jobs()
        for job in jobs:
            url = job.get("url", "").strip()
            if url:
                posted_urls.add(url)
        save_posted_jobs(posted_urls)
        print(f"✅ Posted daily digest: {len(jobs)} jobs")
    else:
        print("❌ Failed to post daily digest")


def hourly_update_post():
    """Post new jobs since last run (hourly updates)."""
    new_ai_path = ROOT_DIR / "new_ai.csv"

    # Get all jobs that haven't been posted yet
    jobs = get_new_jobs_from_csv(new_ai_path, date_filter=None)

    if not jobs:
        print("No new jobs to post since last run.")
        return

    # Format and post
    post_content = format_summary_post(jobs, is_daily=False)

    if post_to_x(post_content):
        # Mark jobs as posted
        posted_urls = load_posted_jobs()
        for job in jobs:
            url = job.get("url", "").strip()
            if url:
                posted_urls.add(url)
        save_posted_jobs(posted_urls)
        print(f"✅ Posted hourly update: {len(jobs)} jobs")
    else:
        print("❌ Failed to post hourly update")


def main():
    parser = argparse.ArgumentParser(
        description="Post job listings to X/Twitter using Playwright"
    )
    parser.add_argument(
        "--mode",
        choices=["daily", "hourly", "auto"],
        default="auto",
        help="Posting mode: daily (5 PM PST digest), hourly (new jobs since last run), or auto (detect based on time)",
    )
    parser.add_argument(
        "--force-daily",
        action="store_true",
        help="Force daily digest post even if not 5 PM PST",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test with mock content from mock_post_content_1.txt",
    )
    args = parser.parse_args()

    if args.test:
        # Test mode - use mock content
        mock_file = ROOT_DIR / "mock_post_content_1.txt"
        if mock_file.exists():
            content = mock_file.read_text()
            print("🧪 Testing with mock content...")
            post_to_x(content)
        else:
            print(f"❌ Mock file not found: {mock_file}")
        return

    if args.mode == "auto":
        # Auto-detect: daily at 5 PM PST, otherwise hourly
        if is_5pm_pst() or args.force_daily:
            print("📅 Running daily digest post...")
            daily_digest_post()
        else:
            print("⏰ Running hourly update post...")
            hourly_update_post()
    elif args.mode == "daily":
        daily_digest_post()
    elif args.mode == "hourly":
        hourly_update_post()


if __name__ == "__main__":
    main()
