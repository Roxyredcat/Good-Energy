# Good Energy — Worklog

Date: 2025-12-15

Summary:
- Implemented in-app Terms/Privacy, onboarding, Forum & Support UI in `src/App.jsx`.
- Added `supabase-forum-support.sql` (DB tables + RLS) and verified SQL locally.
- Added `scripts/test_forum.js` and `npm run test:forum` to exercise forum end-to-end.

Recent status:
- SQL: created and verified; run in your Supabase project to enable persistence.
- Local test: `npm run test:forum` failed earlier due to an invalid anon key; fix by setting a real anon key or removing placeholder env var.

Next steps for you:
1. Run the SQL in Supabase SQL editor: `supabase-forum-support.sql`.
2. In project root run:
   ```powershell
   npm install
   node --trace-warnings scripts/test_forum.js
   ```
   Or set env vars then run the script:
   ```powershell
   $env:VITE_SUPABASE_URL="https://pvzixnoizskzywsmkcij.supabase.co"
   $env:VITE_SUPABASE_ANON_KEY="<your_anon_key>"
   npm run test:forum
   ```
3. Start dev UI: `npm run dev` and visit the local URL.

Optional next improvements:
- Move Supabase keys to environment variables (`.env`) and remove hardcoded keys from `src/App.jsx`.
- Improve admin UI and real-time subscriptions for forum/support.

If you want, I can commit these changes for you or create a migration script for Supabase CLI.
