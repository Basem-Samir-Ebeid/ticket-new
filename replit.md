# IT Ticket System

## Overview
A full-stack IT Ticket Management System with role-based access control. Built with React + Vite (frontend) and Express + TypeScript (backend), using PostgreSQL via Drizzle ORM.

## Features
- **Role-based access**: super_admin, admin, employee, member roles
- **Ticket lifecycle**: Create, assign, update status, reply with file attachments
- **Ticket requests**: Members/employees submit requests; admins accept/refuse
- **Attendance tracking**: Geolocation-based check-in/out within configurable office radius
- **Leave requests**: Employees submit; admins approve/reject
- **Real-time updates**: WebSocket-based live notifications
- **Web Push notifications**: For admins/super_admins
- **File uploads**: For ticket replies and profile pictures

## Architecture

### Frontend (React + Vite)
- Port: 5000 (dev server)
- Entry: `src/main.jsx` → `src/App.jsx`
- Auth state: `src/context/AuthContext.jsx` (JWT in localStorage)
- API client: `src/lib/api.js` (calls `/api/*` endpoints)
- Pages: `src/pages/` (Login, AdminDashboard, SuperAdminDashboard, EmployeeDashboard, MemberDashboard)
- Components: `src/components/`

### Backend (Express + TypeScript)
- Port: 3000
- Entry: `server/index.ts`
- WebSocket server at `/ws` path
- Routes mounted at `/api/*`
- Auth: JWT (`server/auth.ts`)
- Database: `server/db.ts` (Drizzle ORM + pg)

### Database (PostgreSQL - Replit managed)
- Schema: `shared/schema.ts`
- Tables: profiles, tickets, ticket_replies, login_times, leave_requests, notifications, push_subscriptions, session_revocations, settings_log
- Config: `drizzle.config.ts`

### Shared
- `shared/schema.ts`: Drizzle table definitions used by both server and drizzle-kit

## Development
- `npm run dev` — runs both Vite client (port 5000) and Express server (port 3000) concurrently
- `npm run db:push` — push schema changes to database
- `npm run build` — build frontend to `dist/`
- `npm run start` — run production server (serves built frontend from `public/`)

## GitHub Auto-Sync
Every Replit checkpoint commit automatically pushes to GitHub via a post-commit git hook.

- Hook: `.git/hooks/post-commit` (installed by `scripts/setup-git-hooks.sh`)
- Push script: `scripts/github-sync.sh` (force-pushes the current branch to GitHub; when `GITHUB_SYNC_BRANCH` is set, only that branch is synced and all others are skipped silently)
- Post-merge: `scripts/post-merge.sh` reinstalls the hook after task merges
- Manual sync: `npm run sync:github`
- Reinstall hook: `npm run hooks:setup`
- Requires `GITHUB_TOKEN` secret (GitHub PAT with `repo` scope)

> **Important:** The sync uses `--force` push, meaning **Replit is the sole source of truth** for the synced branch. Do not push commits directly to GitHub — they will be overwritten on the next Replit checkpoint. All changes must go through Replit.

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (Replit managed)
- `JWT_SECRET` — Secret for signing JWT tokens (set in shared env vars)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — For Web Push notifications (optional)
- `GITHUB_TOKEN` — GitHub Personal Access Token for auto-sync (repo scope required)
- `GITHUB_SYNC_BRANCH` — (optional) When set, only the named branch (e.g. `main`) is pushed to GitHub; commits on any other branch are skipped silently

## Vercel Deployment
- `vercel.json`: Routes `/api/(.*)` → `api/index.ts` (Express serverless), everything else → `index.html`
- `api/index.ts`: Vercel entry point — exports Express app without WebSocket (WS not supported in serverless)
- Make sure to set `DATABASE_URL` and `JWT_SECRET` in Vercel environment variables

## Default Credentials
- Super Admin: `superadmin@company.com` / `admin123`

## Key Configuration
- `vite.config.js`: Proxies `/api`, `/ws`, `/uploads` to Express on port 3000
- `server/officeConfig.ts`: Office geolocation config stored in DB (settingsLog) as primary, file as fallback
- `server/app.ts`: Express app setup (shared between local dev and Vercel)
- `api/index.ts`: Vercel serverless entry point — exports the Express app
- `public/sw.js`: Service worker for Web Push notifications
