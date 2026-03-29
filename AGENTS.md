# AGENTS.md

## Cursor Cloud specific instructions

### Overview

BuySmarter is a **Next.js 14** (TypeScript) PC parts price comparison platform for Bangladesh. It is a single application (not a monorepo) with API routes, SQLite database, and optional Python scrapers.

### Running the application

- **Dev server**: `npm run dev` — starts Next.js on port 3000
- **Lint**: `npm run lint` (pre-existing `react-hooks/rules-of-hooks` error in `components/ui/SearchResults.tsx`)
- **Type-check**: `npm run type-check` (pre-existing TS errors in several files)
- **Production build**: `npm run build` — currently fails due to the pre-existing ESLint error above; dev mode works fine

### Database

- Uses **SQLite** only (`final_products.db` at project root, fallback `cpu_products.db`). PostgreSQL references in the code are legacy/dead.
- The `all_products` table has **no CREATE TABLE** statement in the codebase — it must pre-exist in the `.db` file. Admin tables (`admin_users`, `vendor_applications`, `vendors`) are auto-created by `lib/admin-db.ts` and `lib/vendor-db.ts`.
- The `.db` file is gitignored. If missing, create it with an `all_products` table matching the columns in `scrapers/db_sync.py` `_insert_product()` method.

### Environment variables

- Copy `env.local` → `.env.local` for local development
- `GEMINI_API_KEY` in `.env.local` is needed for AI search features (optional for basic browsing)

### Python scrapers (optional)

- Located in `scrapers/`. Install deps: `pip install -r requirements.txt`
- Run all scrapers: `python3 -m scrapers.run`
- These populate `final_products.db` with product data scraped from vendor websites

### Key gotchas

- `scripts/setup.sh` and `scripts/start-dev.sh` reference a `backend/` directory and Redis, but **neither exists** in the repo. These scripts are outdated/aspirational. Do not run them.
- The `scrape:all` script in `package.json` uses `py` (Windows), use `python3 -m scrapers.run` instead on Linux.
