# TrustForex Blog

Static pages built from Markdown, on the same system as the other landing pages (cb8's nav, grounds,
glass, holds and footer). Built for the day there are sixty posts in five categories: every post
carries a category, and the build writes the listing, one page per category, one page per post,
and a `posts.json` index any other page can read.

    node design/landing/blog/build.mjs      # posts/*.md + categories.json → index.html, c/*, p/*, editor/, posts.json
    node design/landing/blog/render.js      # the renderer's self-check
    sh design/landing/deploy.sh             # runs the build, then ships everything

Live at https://trustforex.net/v/landing/blog/ — the editor at `/blog/editor/`.

## Sources (edit these) vs. generated (never edit)

| Source | What it is |
|---|---|
| `posts/<slug>.md` | one post: front matter + Markdown |
| `categories.json` | the five categories: `id`, `name`, `blurb`, `ground` (the halo behind covers), `icon` (the cover glyph) |
| `render.js` | the renderer — Markdown subset + the theme's blocks; used by the build and the editor |
| `build.mjs` | the templates: listing, category, post, editor, `posts.json` |
| `page.css`, `blog.js`, `editor.js` | the blog's styles and scripts over cb8's |

`index.html`, `c/`, `p/`, `editor/index.html` and `posts.json` are outputs of the build.

## Where a post appears

- **Latest** — the newest post is the hero of the listing (and of its category page).
- **The grid** — every post, three across, filtered by the category chips and sorted (newest / oldest / most read); nine at a time, then *Show more*.
- **From the Blog** — at the foot of every listing: the two `featured: true` posts as large cards, and *Most popular* — the four highest `reads`.
- **More in <category>** — three related posts under every post.
- `posts.json` — slug, title, category, date, author, excerpt, minutes, reads, featured, url — for anything else that wants the list.

The categories are placeholders until the founder names the real five; change `categories.json`
and rebuild — posts keep their `category:` id.

## Writing a post

Open `/blog/editor/`, fill the fields, write, press the block buttons, watch the preview (it is the
real renderer). *Download .md* and put the file in `posts/`, then build and deploy. The draft
autosaves in that browser. Or write the file by hand:

```
---
title: How we measure a signal
category: signals          # an id from categories.json
date: 2026-09-01           # YYYY-MM-DD; newest first everywhere
author: TrustForex
excerpt: One sentence for the card and the hero.   # optional — the first paragraph otherwise
cover: https://…/image.webp   # optional — the category's halo otherwise
featured: true             # optional — one of the two large cards in From the Blog
reads: 412                 # optional — ranks Most popular (until real analytics exist)
draft: true                # optional — skipped by the build
---

## A heading            → h2, listed in "On this page"
## A heading {.blue}    → the brand-blue gradient title (also {.accent}, {.muted})
### A smaller heading
Paragraphs, **bold**, *italic*, `code`, [links](https://…), ![images](src "caption")
- lists   1. numbered lists   > quotes   --- rules   ``` code ```
| Column | Column |   pipe tables → the dashboard-row table
|---|---|
```

### The theme's blocks

```
:::glass                    frosted white card on the paper page
:::blue                     the blue block (halo ground, white text); headings inside may be {.blue}
:::pane                     a blue block with the deep-blue glass pane inside it
:::callout info Title       a callout in a state colour: info · success · warning · danger (title optional)
:::quote                    a pull quote; a last line starting with "— " is the attribution
:::stats                    the dashboard tiles: one `Label | Value | Note` per line
:::steps                    the activation path: one step per line, the last on blue
:::cta Label | https://…    the closing block: text, then the glass button
:::                         closes the open block (blocks nest one level, e.g. a quote inside blue)
```

Icons in callouts are Iconly slots (`cb8/ico/*.json`) with an inline glyph until the file is pulled
(`_qa/iconly.py`). Covers use the category's glyph the same way.
