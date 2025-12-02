import asyncio
import subprocess
import sys
import time
import urllib.error
import urllib.request
import os

from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()


CDP_ENDPOINT = "http://localhost:9222"


def _is_cdp_available(url: str = f"{CDP_ENDPOINT}/json/version") -> bool:
    """Return True if a Chrome instance is listening on the CDP endpoint."""
    try:
        with urllib.request.urlopen(url, timeout=1) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, TimeoutError):
        return False


def _launch_chrome_with_user_data() -> None:
    """
    Launch a real Chrome instance with remote debugging enabled and a fixed
    user-data-dir

    """
    chrome_cmd = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--remote-debugging-port=9222",
        f"--user-data-dir={os.getenv('USER_DATA_DIR')}",
    ]

    # Start Chrome detached; suppress output in this script.
    try:
        subprocess.Popen(
            chrome_cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        print(
            "Failed to start Google Chrome.\n"
            "Make sure Chrome is installed at:\n"
            "  /Applications/Google Chrome.app\n",
            file=sys.stderr,
        )
        raise


def _ensure_chrome_cdp_available(timeout_seconds: int = 20) -> None:
    """
    Ensure that a Chrome instance is listening on the CDP endpoint.

    - If nothing is listening, start Chrome with the user-data-dir command.
    - Then wait (up to timeout_seconds) for the CDP endpoint to become available.
    """
    if not _is_cdp_available():
        _launch_chrome_with_user_data()

    start = time.time()
    while time.time() - start < timeout_seconds:
        if _is_cdp_available():
            return
        time.sleep(0.5)

    raise RuntimeError(
        f"Chrome did not start listening on {CDP_ENDPOINT} within {timeout_seconds} seconds.\n"
        "Check that Chrome can be launched with the configured command."
    )


async def main() -> None:
    """
    Start (if needed) and then connect to your REAL Chrome via the Chrome
    DevTools Protocol (CDP), using the same command you provided, and drive
    that browser instance to open https://x.com.

    This uses your live Chrome with your real profile, extensions, UA, etc.
    """
    # Ensure a Chrome instance is listening on the CDP endpoint, launching it
    # with your specified command if necessary.
    _ensure_chrome_cdp_available()

    # Connect to the Chrome instance started with --remote-debugging-port.
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_ENDPOINT)

        # Reuse the first existing context (your current profile window) if present;
        # otherwise create a new context.
        context = (
            browser.contexts[0] if browser.contexts else await browser.new_context()
        )

        # Reuse an existing page if available, otherwise open a new tab.
        page = context.pages[0] if context.pages else await context.new_page()

        # Navigate to x.com – this is happening inside your real Chrome instance,
        # so all cookies/profile state that Chrome has will be used.
        # Do not rely on 'networkidle'; just perform a simple navigation.
        await page.goto("https://x.com")

        print(
            "Connected to your real Chrome (CDP) and opened https://x.com.\n"
            "Solve any CAPTCHA manually if shown; this is still your real browser.\n"
            "This script will keep the connection alive for 1 hour or until you stop it."
        )

        # Keep the connection alive so you can interact with the page.
        try:
            await page.wait_for_timeout(60 * 60 * 1000)  # 1 hour
        except KeyboardInterrupt:
            pass
        finally:
            await browser.close()


if __name__ == "__main__":
    """
    Usage (macOS, using your REAL Chrome automatically):

        1. This script will automatically launch Google Chrome with:

               /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
                 --remote-debugging-port=9222 \\
                 --user-data-dir={os.getenv('USER_DATA_DIR')}

           if nothing is already listening on http://localhost:9222.

        2. In a terminal, run:

               pip install playwright
               playwright install chromium
               python open_x_with_chrome_profile.py

        3. The script will connect to that real Chrome instance and open https://x.com
           in one of its tabs, using all cookies/sessions stored under the configured
           user_data_dir.
    """
    asyncio.run(main())
