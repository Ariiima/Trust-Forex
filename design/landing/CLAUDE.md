# Landing site — design/landing/

Static pages, one folder per page, shared styles in `cb8/`. `README.md` here records what was
tried and cut, with numbers. Read the section for the page you are changing before building.

## Run and check

    cd design/landing && python -m http.server 5311   # every _qa script expects port 5311
    python design/landing/_qa/stamp.py                 # after any CSS/JS edit: refresh ?v= keys
    http://localhost:5311/<page>/?check=1              # self-check, logs CHECK OK to the console
    node design/landing/_qa/headings.mjs               # gradient-run check across all pages

Browser checks use Playwright from the repo's `node_modules`, so a probe script must live inside
the repo to import it. The Chrome extension timed out here; do not start with it.

## Known failures that page work does not cause

- `_qa/chapter-scroll.test.mjs` fails on cb8 soft mode. Verified 2026-09-12 with home changes stashed.
- `_qa/lock.test.mjs` fails its "hard" arm. `cb8/main.js` has no hard mode, only `?lock=off`.

## Frame budget

The home protocol corridor, the four `.step` screens in `home/page.css`, must be measured before
motion ships: `node design/landing/_qa/perf-corridor.mjs`. One run takes 5–10 minutes.

- Put every candidate in ONE run as its own arm. Never rebuild and re-run per variant.
- Ground motion there is already measured out four ways, +16 to +57 long frames. Do not rebuild it
  without first moving the harness onto a GPU-composited browser.

## Working rules for design tasks

- Propose the options first and get the user's pick before building any of them.
- After the first failed measurement, stop and report. Do not iterate alone.
