# Staging Online

Use this project as an online testing environment with a stable Vercel URL and the Supabase project already provisioned.

## Vercel

Create a Vercel project from the GitHub repository and use these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Recommended project name:

- `escola-sabatina-staging`

## Supabase

After the first Vercel deploy, update Auth URL settings in the Supabase dashboard:

- `Site URL`: your Vercel project URL
- `Redirect URLs`:
  - `http://localhost:3000/**`
  - `https://escola-sabatina-staging.vercel.app/**`

## Status

The remote database for project ref `ayrbdpksfbtjspprovnt` already has all local migrations from `0001` to `0022`.
