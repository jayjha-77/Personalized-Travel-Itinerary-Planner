# Personalized Travel Itinerary Planner — Milestone 2

Database foundation and minimal full-stack scaffold:
- React + Vite frontend
- Express API (deployable to Vercel)
- Supabase PostgreSQL schema, constraints, indexes, and Row Level Security
- Server-side-only secrets

## Prerequisites
- Node.js 20+
- A Supabase project
- Git (recommended)

## 1. Create the Supabase project
Create a project at https://supabase.com/dashboard. Open SQL Editor and run
`supabase/migrations/001_initial_schema.sql` in one go.

The migration creates:
- `profiles`
- `preferences`
- `destinations`
- `trips`
- `itinerary_days`
- `itinerary_activities`
- indexes, updated-at triggers, RLS policies, and least-privilege grants

The `profiles` row is created automatically when a Supabase Auth user is created.
Use Supabase Auth for registration/login in a later milestone.

## 2. Configure the frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase Project Settings → API Keys.
The publishable key is designed for browser use. RLS must remain enabled.

## 3. Configure the backend
```bash
cd ../backend
cp .env.example .env
npm install
npm run dev
```
Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `FRONTEND_ORIGIN`.
`SUPABASE_SECRET_KEY` is optional for the current health-check-only backend; it is included for future trusted server-side operations.
Do not put it in `frontend/.env`, do not prefix it with `VITE_`, and never commit either `.env` file.
For legacy Supabase projects, the dashboard may expose a `service_role` key instead of a `sb_secret_...` key. Treat either as highly sensitive.

## 4. Verify
- Frontend: http://localhost:5173
- API health: http://localhost:3000/api/health
- API config check: http://localhost:3000/api/config-status (does not return secrets)

## 5. Deployment notes
- Frontend: deploy `frontend` to Render as a Static Site; build command `npm install && npm run build`; publish directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Backend: deploy `backend` to Vercel. Set the Root Directory to `backend`, and add `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (if used), `FRONTEND_ORIGIN`, and `NODE_ENV=production`. `api/index.js` exports the Express app for Vercel.
- Set `FRONTEND_ORIGIN` to the exact production frontend origin, without a trailing slash.
- If using Supabase Auth redirects, add local and production URLs in Supabase Authentication → URL Configuration.

## Security checklist
- RLS is enabled on every user-facing table.
- `anon` receives no table privileges in this schema.
- `authenticated` receives only necessary CRUD privileges on user-owned tables and read-only access to active destinations.
- `destinations` writes are reserved for trusted backend/admin operations.
- Never expose Supabase secret/service-role keys or AI-provider keys in frontend bundles.
- Use a separate test project before applying schema changes to production.
- Back up/commit SQL migrations; dashboard SQL is not a substitute for source control.
