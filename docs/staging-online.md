# Staging Online

Use this project as an online testing environment with a stable Vercel URL and the Supabase project already provisioned.

## Vercel

Create a Vercel project from the GitHub repository and use these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended project name:

- `escola-sabatina-staging`

## Supabase

After the first Vercel deploy, update Auth URL settings in the Supabase dashboard:

- `Site URL`: your Vercel project URL
- `Redirect URLs`:
  - `http://localhost:3000/**`
  - `https://escola-sabatina-staging.vercel.app/**`

Before publishing scoring changes, apply the latest Supabase migrations and run:

```bash
npm run check:scoring-audit
```

The check must pass against the configured Supabase project before the app is published. It verifies the robust scoring audit table, the `student_attendance_records.updated_at` column, and the reasoned scoring RPC signature.

## Status

The remote database for project ref `ayrbdpksfbtjspprovnt` must include the robust scoring audit migration before scoring launches or corrections can be used safely.
