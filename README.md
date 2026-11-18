# FEHB International — Platform API foundation

This is the first isolated foundation for the private FEHB management platform. It does **not** replace the existing public website or its current Cloudflare Pages deployment.

## Stack

- Cloudflare Workers + TypeScript for the API runtime
- Cloudflare D1 (SQLite) for structured records; schema is in `migrations/`
- Cloudflare R2 is reserved for private files after access controls and consent workflows are implemented
- Wrangler for local development and deployment

## Current status

- `GET /api/health` returns service health.
- Other `/api/*` routes intentionally return `501` until authentication, authorization, validation, and database bindings are configured.
- The D1 schema is a starting point, not a live database.
- No staff login or beneficiary record is active yet.

## Local setup

Requires a current Node.js LTS release.

```bash
npm install
npm run dev
```

Open `http://localhost:8787/api/health`.

## Before connecting production data

1. Create a D1 database in the FEHB Cloudflare account.
2. Add its binding to `wrangler.jsonc` as `FEHB_D1` and add the matching `database_id`.
3. Apply the SQL migration to a development database first, inspect it, then apply to production.
4. Implement staff authentication and role checks before exposing management routes.
5. Add rate limiting, request validation, CSRF protection for cookie-based sessions, and audit logging to every sensitive mutation.
6. Configure private R2 storage only when file-level authorization and retention rules are ready.

## Data protection rules

- Never commit secrets, API tokens, passwords, tax identifiers, identity scans, or private beneficiary documents.
- Collect only information required to deliver a programme.
- Obtain guardian consent before processing or publishing identifiable information about children.
- Public gallery images require documented permission; do not use beneficiary records as public website content.
- Keep the management API separate from public website routes.
