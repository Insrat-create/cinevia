# Deploying Cinevia

This project is set up for:

- Supabase as the backend
- Cloudflare Pages hosting using a `.pages.dev` URL

The app already uses a standard Vite production build:

- build command: `npm run build`
- build output directory: `dist`
- deploy command: none

Cloudflare Pages can build directly from Git, so the normal production flow is:

1. Push code to your repo.
2. Cloudflare installs dependencies.
3. Cloudflare runs `npm run build`.
4. Cloudflare publishes `dist`.
5. Your site updates on `https://<project-name>.pages.dev`.

## 1. Add frontend environment variables

Create a `.env` file from [`.env.example`](/d:/Cinevia/cinevia/.env.example) and fill in:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SITE_URL=http://localhost:5173
```

For production, change `VITE_SITE_URL` to your deployed site URL.

Example:

```env
VITE_SITE_URL=https://your-project.pages.dev
```

`VITE_SITE_URL` is used for auth redirects. The app can fall back to `window.location.origin`, but setting it explicitly keeps email and OAuth redirects predictable across environments.

## 2. Create a Supabase project

Create a new Supabase project, then copy:

- Project URL
- anon public key

## 3. Create the database tables

Open the Supabase SQL Editor and run:

- [`supabase/schema.sql`](/d:/Cinevia/cinevia/supabase/schema.sql)

That file creates:

- `profiles`
- `favorites`
- `continue_watching`
- row-level security policies
- `updated_at` automation for profiles

## 4. Configure Supabase Auth URLs

In Supabase Dashboard, go to `Authentication > URL Configuration`.

Set:

- Site URL: `https://your-project.pages.dev`

Add redirect URLs for local development and production:

- `http://localhost:5173/`
- `http://localhost:5173/reset-password`
- `https://your-project.pages.dev/`
- `https://your-project.pages.dev/reset-password`

If you later add a custom domain, add that domain here too.

## 5. Configure auth providers

In Supabase Auth:

- enable Email
- enable Google

## 6. Configure Google OAuth through Supabase

This app uses Supabase social auth from the browser by calling `supabase.auth.signInWithOAuth({ provider: 'google' })`.

In Google Cloud Console:

1. Create a Web application OAuth client.
2. Add Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://your-project.pages.dev`
3. Add the Authorized redirect URI shown in `Supabase Dashboard > Authentication > Providers > Google`.
4. Copy the Google client ID and client secret back into the Google provider settings in Supabase.

The redirect URI in Google should be the Supabase callback URL, not a frontend route in this repo.

## 7. Deploy to Cloudflare Pages

Create or keep a normal Cloudflare Pages project for this repo and confirm:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: none

Add these environment variables in `Settings > Environment variables`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

Then connect the repo and deploy.

## 8. Routing notes

This repo no longer needs Netlify-specific deployment files.

Cloudflare Pages already serves Vite-style single-page apps correctly when there is no top-level `404.html`, so deep links like `/movies/...` or `/reset-password` can resolve through the SPA without extra redirect rules.

If you later add a top-level `404.html` or custom rewrite rules, re-test route refreshes.

## 9. Final verification checklist

After deployment, verify:

- email sign-up sends confirmation email
- email sign-in works
- Google sign-in returns to the site correctly
- favorites sync between refreshes
- continue watching syncs between refreshes
- password reset email lands on `/reset-password`
- Bunny playback still loads video and thumbnails
- refreshing a deep link still loads the app

## Notes

- The app falls back to local/demo account storage if Supabase env vars are missing.
- Only `VITE_` variables are exposed to the frontend bundle. Do not place private secrets in Vite env vars.
- The Google client secret belongs in Supabase provider settings, not in frontend code.
- The deployed production setup only becomes real after the Supabase project, auth providers, Cloudflare environment variables, and Google OAuth settings are configured.
