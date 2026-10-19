# YORU / ESTABLISHED — Quality Gate

Local-first by design. Browser tests use seeded demo data only, and do not access the owner's private browser or financial records.

Run locally:
1. npm ci
2. npm run test:quality
3. npm run build
4. npm install --no-save @playwright/test@1.55.0
5. npx playwright install chromium
6. npm run test:e2e

CI validates mobile (360px / 393px), desktop, expenses, income edits/deletion, budget persistence, loan payments, secondary drawers, JSON backup downloads and offline PWA reload. Screenshots and failure traces are available as temporary GitHub Actions artifacts.

Promote a commit to production only when the quality workflow passes.