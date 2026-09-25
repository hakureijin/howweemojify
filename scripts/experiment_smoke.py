"""Smoke-test the experiment build end to end.

Usage (server must be running: `npm run experiment`):
    python3 scripts/experiment_smoke.py [--base http://127.0.0.1:7777] [--logs logs]

For each viewport (1440x900 and 1366x650, a distinct pid each) opens both
conditions, scrolls through the whole page in small steps, waits past one
heartbeat, clicks a control on the interactive page, closes the pages, then
checks the JSONL log for the expected event types and that every tracked
section accrued dwell time. Exits non-zero on any gap.
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

VIEWPORTS = ((1440, 900), (1366, 650))
CONDITIONS = (("static", "/zh/static/"), ("interactive", "/zh/"))
SECTIONS = (
    "hero", "ch01-cumulative", "ch01-treemap", "ch01-sankey",
    "ch02-pipeline", "ch02-criteria", "ch02-cases", "ch02-map", "footer",
)
stamp = int(time.time())
pids = {vp: f"SMOKE-{stamp}-{vp[0]}x{vp[1]}" for vp in VIEWPORTS}

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for (w, h), pid in pids.items():
        for condition, path in CONDITIONS:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto(f"{args.base}{path}?pid={pid}", wait_until="networkidle")
            assert page.locator("nav button").count() == 0, "language switch must be hidden in the experiment build"
            # Small steps so every section, short or tall, is seen for a while.
            while True:
                page.mouse.wheel(0, 300)
                page.wait_for_timeout(250)
                at_bottom = page.evaluate(
                    "window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2"
                )
                if at_bottom:
                    break
            page.wait_for_timeout(500)
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

ok = True
for (w, h), pid in pids.items():
    mine = [e for e in events if e.get("pid") == pid]
    for condition, _ in CONDITIONS:
        run = [e for e in mine if e.get("condition") == condition]
        types = {e["type"] for e in run}
        need = {"session_start", "scroll", "section_dwell", "heartbeat", "session_end"}
        if condition == "interactive":
            need.add("interact")
        missing = need - types

        dwelled = {e["section"] for e in run if e["type"] == "section_dwell" and e.get("ms", 0) > 0}
        final = [e for e in run if e["type"] == "session_end"] or [e for e in run if e["type"] == "heartbeat"][-1:]
        for e in final:
            dwelled |= {s for s, ms in (e.get("dwell") or {}).items() if ms > 0}
        gaps = [s for s in SECTIONS if s not in dwelled]

        print(
            f"{w}x{h} {condition:12s} events={len(run):4d} "
            f"missing_types={sorted(missing) or '-'} missing_sections={gaps or '-'}"
        )
        ok &= not missing and not gaps
raise SystemExit(0 if ok else 1)
