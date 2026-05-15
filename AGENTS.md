# AGENTS.md — jb-offingen

## Quick start

```bash
node server.js              # dev (port 3000)
pm2 start server.js --name "jb-offingen.de"   # production
pm2 restart "jb-offingen.de"
```

## Architecture

- **Zero-dependency static site.** No `package.json`, no build step, no test/lint config.
- Single-page entry: `index.html` contains all markup, inline CSS, and inline JS.
- `server.js` is a minimal Node static file server (GET/HEAD only, traversal-safe).
- Production: nginx (see `nginx-config.txt`) proxies HTTPS → `127.0.0.1:3000`.

## Content conventions

- All content changes go into `index.html`. Do not add a build system or split assets.
- Team cards: `.candidate` (avatar + cand-meta). Add `gemeinderat` class for elected members. List position: `<span class="tag">LPn</span>`. Role badge: `<span class="role">Gemeinderat</span>`. Age: `<span class="badge">`.
- Candidate modal clones `.candidate` nodes — keep the DOM structure and class names stable.
- Feedback form uses `mailto:` — preserve `id="feedback-form"` and `id="feedback-text"`.
- Image files in `images/` may contain non-ASCII characters (e.g. `Suß`). Do not rename them without updating all references.
- Detailed conventions documented in `.github/copilot-instructions.md`.

## Brand colors

- `--blue: #143b79` (primary blue)
- `--gold: #E1CF35` (accent yellow from logo)

## No-commit files

- Do not commit or stage plan files.

## Smoke test

```bash
curl -I http://localhost:3000/
```
