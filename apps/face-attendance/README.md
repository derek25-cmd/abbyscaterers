# Abby's Attendance (`apps/face-attendance`)

Face-based clock-in and clock-out for Abby's Caterers sites. A tablet at each
site runs this app as an attendance kiosk; employees look at it to clock in
and out, with a PIN as fallback. HR reviews uncertain punches and enrols
employees here too.

It shares the Supabase project with `apps/catering-system` and uses
**Supabase Auth**, so HR managers sign in with their existing catering-system
accounts. The day's `attendance` row that HR sees in the catering-system
attendance grid is rolled up from the kiosk's punches by the database.

> **Phase 1 (this version):** the app shell, sign-in, routing and the database
> foundation only. The three areas below are placeholders that say what will
> be built there. Face capture, enrolment and the kiosk clock-in flow come in
> Phases 2 and 3.

## The three areas

| Path | Who | What it is for |
| --- | --- | --- |
| `/review` | HR (admin, HR manager, general manager) | Check punches the kiosk was unsure about; today's attendance at a glance (Phase 4) |
| `/enroll` | HR | Biometric consent, face templates, PINs and one-time setup codes (Phase 2) |
| `/kiosk` | Kiosk devices (HR may open it for testing) | The full-screen clock-in screen (Phase 3) |

Anyone else who signs in sees a "not allowed" page with a sign-out button.

After sign-in the middleware calls `face_whoami()` in the database, which
returns `hr`, `device` or `none`, and sends the user to `/review`, `/kiosk` or
`/not-allowed`. The decision is made server-side; the client never reads
`staff_users` or `attendance_devices`. Each page checks again on the server.

## Kiosk tablets sign in as devices

Each tablet has its **own Supabase Auth login**, registered in
`attendance_devices`. A device login is **never** a `staff_users` row: that
would make `is_active_staff()` true and open most CMS tables to a shared
tablet. The database refuses it both ways (a trigger on each table). Devices
can read nothing in the CMS; later phases give them one SECURITY DEFINER
function to record a punch. Device creation (and the
`SUPABASE_SERVICE_ROLE_KEY` it needs) comes in a later phase.

## Running it

From the repository root (this app is an npm workspace, like `admin-portal`):

```bash
npm install
cp apps/face-attendance/.env.example apps/face-attendance/.env.local   # then fill in the values
npm run dev --workspace=apps/face-attendance                           # http://localhost:9004
```

Other scripts: `build`, `start` (port 9004), `typecheck`, `lint`, each with
`--workspace=apps/face-attendance`.

Environment variables (see `.env.example`):

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The shared Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Not used yet; for creating device logins later |
| `ANDROID_ASSETLINKS_JSON` | Served at `/.well-known/assetlinks.json` for the Android build; `[]` when unset |

The database side needs the face attendance migrations
(`supabase/migrations/20261016000100` to `20261016000600`). Their tests are in
`supabase/tests/attendance_face_rls.sql`.

## Installable app and Android

The app is a PWA, prepared for a later Android Trusted Web Activity build:

- `public/manifest.webmanifest`: "Abby's Attendance", starts at `/kiosk`,
  fullscreen, landscape, with 192 px and 512 px maskable icons (placeholders).
- `public/sw.js`: a minimal service worker that caches the app shell (the
  offline page, icons and Next's hashed build files). Pages and Supabase calls
  are never cached, and nothing is recorded offline. It is registered in
  production builds only.
- `/.well-known/assetlinks.json`: served from `ANDROID_ASSETLINKS_JSON`.
