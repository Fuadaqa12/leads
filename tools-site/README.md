# Toolora — free online tools (static site)

58 client-side tools × 10 languages = 720 SEO pages (hreflang, sitemap, JSON-LD), no backend.

- `node build.mjs` → builds `dist/` (no npm install needed, Node 18+)
- `config.json` — site name, URL, custom domain, languages, AdSense client and slot ids, GA id, Search Console code, contact email
- `src/tools.mjs` — list of tools (add a tool = one line here + its strings in `src/i18n/*.mjs`)
- `src/i18n/<lang>.mjs` — all texts per language (missing keys fall back to English)
- `static/assets/engines/*.js` — tool logic (runs in the browser; files never leave the device)
- `.github/workflows/deploy.yml` — builds and publishes to GitHub Pages on every push to `main`
