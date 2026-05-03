# IT Ticket System

A full-stack IT Ticket & Employee Management System built with React + Vite frontend and an Express + Node.js backend, using Replit's built-in PostgreSQL database with Drizzle ORM.

## Architecture

- **Frontend**: React 18 + Vite 5 + TailwindCSS 3
- **Routing**: React Router v6
- **Backend**: Express (Node.js / TypeScript via tsx)
- **Database**: Replit PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs), stored in localStorage
- **Real-time**: Native WebSocket server (ws package)
- **Dev server**: Vite on port 5000, Express API on port 3000 (proxied via `/api`)

## Key Files

- `src/main.jsx` — React entry point
- `src/App.jsx` — Route definitions and role-based access control
- `src/context/AuthContext.jsx` — Auth state, session management, attendance logout
- `src/lib/api.js` — API client wrapper and WebSocket client
- `src/pages/Login.jsx` — Login page
- `src/pages/AdminDashboard.jsx` — Admin view: tickets, users, attendance, leave requests
- `src/pages/EmployeeDashboard.jsx` — Employee view: assigned tickets, attendance, leave requests
- `src/pages/MemberDashboard.jsx` — Member view: request tickets, notifications, attendance, leave
- `server/index.ts` — Express server entry point
- `server/auth.ts` — JWT sign/verify and auth middleware
- `server/db.ts` — Drizzle ORM database connection
- `server/ws.ts` — WebSocket server setup and broadcast helpers
- `server/routes/` — API route handlers (auth, users, tickets, attendance, leaves, notifications, uploads)
- `shared/schema.ts` — Drizzle table definitions (shared between backend and migrations)
- `drizzle.config.ts` — Drizzle Kit config for schema migrations

## Environment Variables

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | PostgreSQL connection string (set by Replit) |
| `JWT_SECRET` | Secret for signing JWT tokens |

## User Roles

- `admin` — Full access: manage users, tickets, attendance, leave requests
- `employee` — View/update assigned tickets, submit leave, register attendance
- `member` — Submit ticket requests, view own tickets, notifications, leave

## Database Tables

`profiles`, `tickets`, `ticket_replies`, `login_times`, `leave_requests`, `notifications`, `session_revocations`

## Running

```bash
npm run dev
```

Runs Vite (port 5000) and Express (port 3000) concurrently. The Vite dev server proxies `/api`, `/ws`, and `/uploads` to Express.

## Database Migrations

```bash
npm run db:push
```

Pushes schema changes from `shared/schema.ts` to the database.

## Default Admin Account

On a fresh database, create the first admin via the Node.js REPL or by inserting directly into the `profiles` table with a bcrypt-hashed password and `role = 'admin'`.
