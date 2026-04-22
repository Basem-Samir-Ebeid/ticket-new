# IT Ticket System

React + Supabase ticket management system with Admin and Employee roles.

## Stack
- React + Vite
- Supabase (Auth + PostgreSQL + Edge Functions)
- TailwindCSS
- React Router v6

---

## Setup Guide

### 1. Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full SQL from `supabase/schema.sql`
3. Go to **Authentication → Settings** → disable "Enable email confirmations"

### 2. Create Admin User

In Supabase Dashboard → **Authentication → Users** → **Add User**:
- Email: `admin@yourcompany.com`
- Password: choose a strong password

Then in **SQL Editor**, promote them to admin:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@yourcompany.com';
```

### 3. Deploy Edge Function

Install Supabase CLI then:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-user
```

### 4. Local Development

```bash
cp .env.example .env
# Fill in your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase → Settings → API

npm install
npm run dev
```

### 5. Deploy to Vercel

1. Push repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

---

## Features

**Admin:**
- Create employee accounts
- View all employees
- View all tickets (with status filter)
- View tickets per employee
- Change ticket status (opened/pending/solved)

**Employee:**
- Login with email/password created by admin
- Create tickets (title, description, assign to someone, auto date)
- Filter own tickets by status
- See live stats

---

## Project Structure

```
src/
  context/AuthContext.jsx   # Auth state & profile
  lib/supabase.js           # Supabase client
  pages/
    Login.jsx
    AdminDashboard.jsx
    EmployeeDashboard.jsx
  components/
    Navbar.jsx
    StatusBadge.jsx
  App.jsx                   # Routes + role-based redirect
  main.jsx
supabase/
  functions/create-user/    # Edge function (admin creates employees)
  schema.sql                # Full DB schema + RLS policies
```
# IT-ticket-system
