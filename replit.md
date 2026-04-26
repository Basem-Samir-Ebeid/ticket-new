# IT Ticket System

A full-stack IT Ticket System built with React + Vite, using Supabase as the backend (auth, database, realtime, storage).

## Architecture

- **Frontend**: React 18 + Vite 5 + TailwindCSS 3
- **Routing**: React Router v6
- **Backend**: Supabase (external) — handles auth, PostgreSQL database, realtime subscriptions, file storage, and edge functions
- **Dev server**: Port 5000 (Vite)

## Key Files

- `src/main.jsx` — React entry point
- `src/App.jsx` — Route definitions and role-based access control
- `src/context/AuthContext.jsx` — Auth state, session management, attendance logout
- `src/lib/supabase.js` — Supabase client (uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
- `src/pages/Login.jsx` — Login and password reset page
- `src/pages/AdminDashboard.jsx` — Admin view: tickets, users, attendance, leave requests, performance
- `src/pages/EmployeeDashboard.jsx` — Employee view: assigned tickets, attendance, leave requests
- `src/pages/MemberDashboard.jsx` — Member view: request tickets, notifications, attendance, leave

## Environment Variables

| Key | Where | Description |
|-----|-------|-------------|
| `VITE_SUPABASE_URL` | shared env var | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | shared env var | Supabase publishable anon key |

## User Roles

- `admin` — Full access: manage users, tickets, attendance, leave requests, performance
- `employee` — View/update assigned tickets, submit leave, register attendance
- `member` — Submit ticket requests, view own tickets, notifications, leave

## Database (Supabase)

Tables: `profiles`, `tickets`, `ticket_replies`, `login_times`, `leave_requests`, `notifications`, `session_revocations`

Key stored procedures: `register_attendance`, `register_logout`, `get_attendance_records`, `delete_user`

## Running

```bash
npm run dev
```

Runs on port 5000.
