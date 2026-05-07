# Finest — IT Ticket Management System

A full-stack web app for managing IT support tickets with role-based access, attendance tracking, leave requests, real-time notifications, and web push.

## Run & Operate

- **Dev**: `npm run dev` — starts backend (port 3000) + Vite frontend (port 5000) concurrently
- **Production**: `npm run start` — `NODE_ENV=production PORT=5000 tsx server/index.ts`
- **Build**: `npm run build` — Vite builds frontend to `dist/`
- **DB push**: `npm run db:push` — apply schema changes via Drizzle Kit

Required env vars:
- `DATABASE_URL` — PostgreSQL connection string (Replit DB integration)
- `JWT_SECRET` — Secret for signing JWTs (set in `.replit` userenv)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — Web Push credentials (set in `.replit` userenv)

## Stack

- **Frontend**: React 18 + Vite 5, Tailwind CSS, React Router v6
- **Backend**: Express 4, TypeScript via `tsx`, Node.js 20
- **Database**: PostgreSQL via `pg` + Drizzle ORM
- **Real-time**: WebSocket (`ws`) server attached to HTTP server at `/ws`
- **Auth**: Custom JWT (bcryptjs hashing, 7-day tokens)
- **Push**: `web-push` (VAPID) + service worker (`public/sw.js`)
- **File uploads**: `multer` → stored in `uploads/` directory

## Where things live

- `server/index.ts` — HTTP + WebSocket server entry
- `server/app.ts` — Express app, route wiring, static serving
- `server/auth.ts` — JWT sign/verify, `requireAuth` middleware
- `server/routes/` — All API route handlers
- `server/db.ts` — Drizzle + pg pool setup
- `shared/schema.ts` — **Source of truth** for all DB table definitions
- `src/main.jsx` — React entry, wraps with BrowserRouter + AuthProvider
- `src/context/AuthContext.jsx` — JWT state, WebSocket lifecycle, push registration
- `src/lib/api.js` — REST + WebSocket client
- `vite.config.js` — Dev server config, proxy rules (`/api`, `/ws`, `/uploads` → port 3000)

## Architecture decisions

- Frontend and backend run on separate ports in dev (5000 / 3000); Vite proxies API calls
- In production, the Express server serves the built frontend from `public/` (single server on port 5000)
- WebSocket auth uses JWT query param (`/ws?token=...`) validated server-side
- JWT stored in `localStorage` as `auth_token`; session revocation via `session_revocations` table + WebSocket push
- File uploads stored locally in `uploads/` — not cloud-backed

## Product

- **Tickets**: Create, assign, track status (opened/pending/solved), reply with images/attachments, ticket request/approval flow
- **Users**: Role-based (employee, admin, super_admin) with profile management and forced password change on first login
- **Attendance**: GPS-verified login/logout tracking, admin view of attendance records
- **Leave requests**: Submit, approve/reject with admin notes
- **Notifications**: In-app (stored) + real-time WebSocket events + Web Push for admins
- **Settings**: Geofencing configuration for attendance validation

## User preferences

- Keep existing JWT-based auth (not replaced with Replit Auth)
- Default admin account: `admin@finest.com` / `admin123` (super_admin role, created during migration)

## Gotchas

- `npm run db:push` must be run after any schema changes in `shared/schema.ts`
- The `postinstall` script runs `scripts/setup-git-hooks.sh` automatically on `npm install`
- `fuser` is used in the `dev` script to kill ports 3000/5000 before starting — requires `fuser` to be available

## Pointers

- DB schema: `shared/schema.ts`
- API routes: `server/app.ts`
- Vite proxy config: `vite.config.js`
