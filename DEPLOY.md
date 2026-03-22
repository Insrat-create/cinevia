# Deploying Cinevia

This project is set up for:

- Supabase as the backend
- Netlify free hosting using a `.netlify.app` URL

## 1. Create a Supabase project

Create a new Supabase project, then copy:

- Project URL
- anon public key

Add them to your `.env` file:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SITE_URL=http://localhost:5173
```

For production, change `VITE_SITE_URL` to your deployed site URL.

Example:

```env
VITE_SITE_URL=https://your-site-name.netlify.app
```

## 2. Create the database tables

Open the Supabase SQL Editor and run:

- [`supabase/schema.sql`](/d:/Cinevia/cinevia/supabase/schema.sql)

That file creates:

- `profiles`
- `favorites`
- `continue_watching`
- row-level security policies
- `updated_at` automation for profiles

## 3. Configure auth providers

In Supabase Auth:

- enable Email
- enable Google

Use your production site URL in the allowed redirect URLs list, plus local development if needed.

Recommended redirect URLs:

- `http://localhost:5173/`
- `http://localhost:5173/reset-password`
- `https://your-site-name.netlify.app/`
- `https://your-site-name.netlify.app/reset-password`

## 4. Google setup

Create Google OAuth credentials and add the callback URLs Supabase gives you in the Google console.

Then paste the Google client ID/secret into the Google provider section in Supabase Auth.

## 5. Deploy to Netlify

This repo already includes:

- [`netlify.toml`](/d:/Cinevia/cinevia/netlify.toml)
- [`public/_redirects`](/d:/Cinevia/cinevia/public/_redirects)

Those files make the React router work on refresh and deep links.

Deploy steps:

1. Push this repo to GitHub.
2. Create a Netlify site from that repo.
3. Set build command to `npm run build`.
4. Set publish directory to `dist`.
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SITE_URL`
6. Redeploy the site.

After deploy, Netlify gives you a free URL like:

- `https://your-site-name.netlify.app`

## 6. Final verification checklist

After deployment, verify:

- email sign-up sends confirmation email
- email sign-in works
- Google sign-in returns to the site correctly
- favorites sync between refreshes
- continue watching syncs between refreshes
- password reset email lands on `/reset-password`

## Notes

- The app falls back to local/demo account storage if Supabase env vars are missing.
- The deployed production setup only becomes real after the Supabase project, auth providers, and Netlify environment variables are configured.
