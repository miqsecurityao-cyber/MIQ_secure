# Supabase and Vercel setup

The app authenticates with Supabase, checks the signed-in user against the
`miq_admins` allowlist, and reads/writes clients, requests, and quotes in the
database when Supabase environment variables are configured.

## Supabase

1. Create a Supabase project for MIQ Security and keep its database password in
   a password manager.
2. Run `migrations/20261030093500_initial_schema.sql` in the Supabase SQL
   Editor, or apply it with the Supabase CLI after linking the project.
3. In Supabase Authentication, create the administrator account yourself, then
   disable public sign-ups. Do not expose a registration flow in the app.
4. Copy that administrator's Auth user ID from Authentication > Users and add
   only that ID to the allowlist using the SQL Editor:

   ```sql
   insert into public.miq_admins (user_id)
   values ('ADMIN_AUTH_USER_UUID');
   ```

5. Keep the Supabase service-role/secret key private. Never put it in a
   `VITE_*` variable or in browser code. The browser may use only the project's
   publishable/anon key, protected by Row Level Security.

The migration enables Row Level Security on all application tables. Only user
IDs explicitly listed in `miq_admins` can read or change clients, requests, and
quotes. Users cannot add themselves to that allowlist through the app.

6. In Authentication > URL Configuration, set the Site URL to the production
   Vercel URL and add that URL, plus `http://localhost:8443`, to the allowed
   redirect URLs. This is required for password-reset links.

Existing browser-local records are not automatically copied. The current
administrator confirmed that no important local records need migration.

## Vercel

1. Import `miqsecurityao-cyber/MIQ_secure` into the MIQ-owned Vercel account.
2. Use the Vite framework preset, build command `pnpm run build`, and output
   directory `dist`.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel for
   Production (and Preview if required). `.env.example` shows the variable
   names only. Obtain these values from Supabase Project Settings > API.
4. Add the same variables to a local `.env.local` file to test locally. Never
   commit `.env.local`.
5. Redeploy after setting or changing environment variables. Verify admin
   login, denied access for a non-admin user, record persistence, and logout.

The anon/publishable key is intended for browser use; Row Level Security is
what protects the database. Never expose the service-role/secret key.
