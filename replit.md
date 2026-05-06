# IT Ticket System (Finest)

A role-based IT Ticket Management System for managing support tickets, attendance, leave requests, and real-time notifications.

## Run & Operate

- `npm run dev` — starts Vite (port 5000) + Express (port 3000) concurrently
- `npm run build` — builds frontend to `dist/`
- `npm run start` — production server (PORT=5000, serves built frontend)
- `npm run db:push` — push schema changes to database

Required env vars: `DATABASE_URL` (Replit managed), `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`

## Stack

- **Frontend**: React 18, React Router v6, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript (via tsx)
- **Database**: PostgreSQL via Drizzle ORM + `pg`
- **Auth**: JWT (`jsonwebtoken` + `bcryptjs`) — custom, no external auth provider
- **Real-time**: WebSocket (`ws` library) at `/ws`
- **Notifications**: Web Push (VAPID via `web-push`)
- **Uploads**: `multer`

## Where things live

- `src/` — React frontend
  - `src/pages/` — Login, AdminDashboard, EmployeeDashboard, MemberDashboard, SuperAdminDashboard
  - `src/context/AuthContext.jsx` — auth state, WS connect, push subscription
  - `src/lib/api.js` — all API calls + WebSocket client
- `server/` — Express backend
  - `server/index.ts` — HTTP server + WebSocket server
  - `server/app.ts` — Express app + route wiring
  - `server/routes/` — auth, users, tickets, attendance, leaves, notifications, uploads, push, settings
  - `server/db.ts` — Drizzle setup
  - `server/auth.ts` — JWT sign/verify, requireAuth middleware
- `shared/schema.ts` — Drizzle table definitions (source of truth for DB schema)
- `drizzle.config.ts` — Drizzle Kit config
- `vite.config.js` — Vite config; proxies `/api`, `/ws`, `/uploads` to port 3000
- `public/sw.js` — Service worker for Web Push

## Architecture decisions

- Vite dev server (port 5000) proxies all `/api`, `/ws`, `/uploads` requests to Express (port 3000) — single origin for browser
- JWT stored in `localStorage`; WebSocket auth via `?token=` querystring
- WebSocket uses `window.location.host` for URL construction — works correctly through Replit's proxy
- Production: Express serves built frontend from `public/`; dev: Vite handles frontend separately

## Product

- **Roles**: super_admin, admin, employee, member — each gets a different dashboard
- **Tickets**: create, assign, status updates, replies with file/image attachments
- **Ticket Requests**: members/employees submit; admins accept/refuse
- **Attendance**: geolocation check-in/out within configurable office radius
- **Leave Requests**: submit, approve/reject with notes
- **Notifications**: real-time via WebSocket + Web Push for admins
- **File uploads**: profile pictures, ticket reply attachments

## User preferences

_Populate as you build_

## Gotchas

- Default super admin: `admin@system.com` / `Admin@1234` (created on migration)
- Run `npm run db:push` after any schema changes in `shared/schema.ts`
- GitHub auto-sync uses a post-commit hook; requires `GITHUB_TOKEN` secret

## Pointers

- DB schema: `shared/schema.ts`
- API client: `src/lib/api.js`
- Drizzle config: `drizzle.config.ts`
