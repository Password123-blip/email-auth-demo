# Acme Cloud — live email auth demo

A static, serverless build of the email-auth starter. No build step, no npm,
no terminal: the browser talks to Supabase directly using the publishable key.

## Files

- `index.html` — markup for the landing page, auth card and dashboard
- `styles.css` — all styling
- `app.js` — auth logic (sign in, sign up, magic link, session, sign out)

## How it works

1. `app.js` creates a Supabase client with the publishable key.
2. Sign-in and sign-up call `supabase.auth.signInWithPassword` /
   `signUp`. The session is persisted in `localStorage`.
3. On load, `getSession()` decides whether to render the landing page or the
   dashboard.
4. The dashboard reads the user's row from the `profiles` table — protected by
   row-level security, so each user only ever sees their own.

## Backend

The database, auth and row-level security all live in Supabase:

- `profiles` table with RLS policies (select / insert / update own row only)
- a Postgres trigger that creates a profile row on every signup

The full server-rendered version (Next.js API routes + middleware) lives in the
sibling `email-auth-app` repository.

## Deploying

This folder is served as-is by GitHub Pages. Push it to any static host
(GitHub Pages, Netlify, Cloudflare Pages) and it works.

## Supabase dashboard settings to check

- **Authentication → URL Configuration** — add this site's URL to *Redirect
  URLs* so magic links and confirmation emails return here.
- **Authentication → Sign In / Providers → Email** — turn *Confirm email* off
  for instant sign-ups, or configure your own SMTP sender.
