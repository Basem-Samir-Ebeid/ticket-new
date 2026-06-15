---
name: Auth middleware naming
description: Correct export names to use when importing auth middleware in Express route files
---

## Rule
In `server/routes/*.ts`, always import from `'../auth'` using these exact names:
- `requireAuth` — authenticates the request (NOT `authenticate`)
- `requireAdmin` — checks admin role
- `checkPermission` — granular permission check (used in users route)

## Why
The file `server/auth.ts` exports `requireAuth`, `requireAdmin`, `checkPermission`, and `signToken`. There is no `authenticate` export. Using the wrong name causes a `SyntaxError: The requested module does not provide an export named 'authenticate'` crash at startup.

## How to apply
Every new route file must use `requireAuth` instead of `authenticate`. Double-check by grepping other routes: `grep "from '../auth'" server/routes/*.ts`.
