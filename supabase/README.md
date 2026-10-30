# Supabase and Vercel setup

These files prepare the database schema and deployment settings. The app still
uses browser-local storage and is not connected to Supabase; do not use it with
real or shared production data until authentication and database persistence
are implemented and tested.

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

## Vercel

1. Import `miqsecurityao-cyber/MIQ_secure` into the MIQ-owned Vercel account.
2. Use the Vite framework preset, build command `pnpm run build`, and output
   directory `dist`.
3. After the Supabase client and authentication are implemented, configure
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel for the required
   environments. `.env.example` shows the variable names only.
4. Do not deploy this version as a production system for real data: its login
   and records are not yet connected to Supabase.
