# Finest — IT Ticket Management System

A full-stack web app for managing IT support tickets, employee attendance (GPS-based check-in/out), leave requests, push notifications, and real-time updates.

## Run & Operate

- `npm run dev` — starts both the Express API (port 3000) and Vite dev server (port 5000) concurrently
- `npm run build` — builds the React frontend to `dist/`
- `npm start` — production mode, serves everything from port 5000
- `npm run db:push` — push Drizzle schema changes to the database

**Required env vars** (already set in Replit secrets):
- `NEON_DATABASE_URL` — Neon PostgreSQL connection string (primary database)
- `JWT_SECRET` — token signing secret
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — web push notifications

**Super admin accounts:**
- Email: `basem.samir@finest-his.com`
- Email: `admin@system.com`

## Database

The project uses **Neon PostgreSQL** as its database, connected via the `NEON_DATABASE_URL` secret.

- Connection is defined in `server/db.ts` — always reads from `NEON_DATABASE_URL`
- Schema is defined in `shared/schema.ts` — run `npm run db:push` after any changes
- Drizzle config in `drizzle.config.ts` — also reads from `NEON_DATABASE_URL`

## Stack

- **Frontend**: React 18 + Vite + React Router v6 + TailwindCSS
- **Backend**: Node.js + Express + TypeScript (tsx)
- **Database**: Neon PostgreSQL + Drizzle ORM (connection via `NEON_DATABASE_URL` secret)
- **Auth**: JWT (bcryptjs password hashing)
- **Real-time**: WebSocket server (`ws`) — broadcasts ticket/attendance/notification events
- **Push**: Web Push (`web-push`) with VAPID keys
- **File uploads**: Multer (disk storage → `uploads/`)
- **Maps**: Leaflet (office location / attendance geofencing)

## Where things live

- `src/` — React app (pages, components, context, lib)
- `server/` — Express routes, WebSocket, DB connection, auth middleware
- `shared/schema.ts` — Drizzle table definitions (source of truth for DB schema)
- `uploads/` — user-uploaded file attachments
- `public/` — static assets + `sw.js` service worker for push notifications

## Architecture decisions

- The Vite dev server proxies `/api`, `/ws`, and `/uploads` to the Express server on port 3000
- In production (`NODE_ENV=production`), Express serves the built frontend from `public/`
- WebSocket connections authenticate via `?token=<jwt>` query parameter
- Roles: `employee`, `admin`, `super_admin` — role-based dashboards and API guards
- `must_change_password` flag forces a password reset on first login

## Product

- IT ticket creation, assignment, status tracking, and replies with file attachments
- GPS-based attendance check-in/out with office geofencing (Leaflet map)
- Leave request submission and admin approval/rejection
- Real-time notifications via WebSocket + browser Web Push
- Admin panel: user management, role assignment, office location settings, session revocation
- Super-admin: full user visibility including plain-text passwords and GitHub sync status

## User preferences

_Populate as you build_

## Gotchas

- Run `npm run db:push` after any schema changes in `shared/schema.ts`
- The `postinstall` script runs `scripts/setup-git-hooks.sh` — this is safe to ignore if `.git/hooks` doesn't exist
- VAPID keys are pre-set in env vars; do not regenerate them without also updating the client push subscription

## Pointers

- DB skill: `.local/skills/database/SKILL.md`
- Workflows skill: `.local/skills/workflows/SKILL.md`
