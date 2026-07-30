# Design vs build review

Side-by-side of every designed screen and its implementation, with a comment
box per screen.

    python3 -m http.server 5300 --bind 127.0.0.1 -d design/review
    open http://127.0.0.1:5300/

- **Left** = the Figma frame (prototype embed, renders 1:1). You must be logged
  into Figma in that browser.
- **Right** = the built screen, deep-linked to the same state via query params
  (`?sheet=`, `?state=`, `?amount=`). Defaults to the deployed build; append
  `?app=http://localhost:5199` to point at a dev server instead.
- **Comments** autosave to localStorage. "Copy all comments" puts them on the
  clipboard as markdown.
- **Overlay mode** stacks the two with a difference blend for spotting drift.

The query params are read in `src/App.tsx` (the `*Q` wrappers). They are inert
without a param, so they cost nothing in normal use.
