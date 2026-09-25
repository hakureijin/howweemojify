"""Smoke-test the experiment build end to end.

Usage (server must be running: `npm run experiment`):
    python3 scripts/experiment_smoke.py [--base http://127.0.0.1:7777] [--logs logs]

Opens both conditions with a test pid, scrolls, waits past one heartbeat,
clicks a control on the interactive page, closes the pages, then checks the
JSONL log for the expected event types.
"""
import argparse
import glob
import json
import time

from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("--base", default="http://127.0.0.1:7777")
p.add_argument("--logs", default="logs")
args = p.parse_args()

pid = f"SMOKE-{int(time.time())}"

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for condition, path in (("static", "/zh/static/"), ("interactive", "/zh/")):
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"{args.base}{path}?pid={pid}", wait_until="networkidle")
        assert page.locator("nav button").count() == 0, "language switch must be hidden in the experiment build"
        for _ in range(12):
            page.mouse.wheel(0, 900)
            page.wait_for_timeout(400)
        if condition == "interactive":
            page.get_by_role("button", name="2015 → 至今").click()
        page.wait_for_timeout(16000)  # past one heartbeat
        page.close()
    browser.close()

time.sleep(1)
events = []
for f in glob.glob(f"{args.logs}/events-*.jsonl"):
    with open(f, encoding="utf-8") as fh:
        events += [json.loads(line) for line in fh if line.strip()]
mine = [e for e in events if e.get("pid") == pid]

ok = True
for condition in ("static", "interactive"):
    types = {e["type"] for e in mine if e.get("condition") == condition}
    need = {"session_start", "scroll", "section_dwell", "heartbeat", "session_end"}
    if condition == "interactive":
        need.add("interact")
    missing = need - types
    print(f"{condition:12s} events={sum(1 for e in mine if e.get('condition') == condition):4d} missing={sorted(missing) or '-'}")
    ok &= not missing
raise SystemExit(0 if ok else 1)
