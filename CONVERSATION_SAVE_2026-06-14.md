Conversation save — Good Energy
Date: 2026-06-14

Summary:
- Implemented teen avatar restrictions: photo option removed for teen profiles; `AvatarCreator` integrated.
- Implemented client logic to request parental verification after teen sign-up; calls a server endpoint.
- Added a serverless function implementation in two places:
  - `functions/index.js` (Firebase Cloud Function) — originally used @sendgrid/mail, updated to call SendGrid HTTP API directly to avoid npm issues.
  - `api/sendParentalVerification.js` (Vercel serverless function) — reads `FIREBASE_SERVICE_ACCOUNT`, `SENDGRID_API_KEY`, `FROM_EMAIL`, `APP_URL` from env and writes verification token to Firestore.
- Deployed to Vercel successfully: Production alias `https://good-energy-theta.vercel.app`.
- `.env.local` contains placeholder envs for local dev; real secrets must be added in Vercel or Firebase.

Status and next steps:
- Vercel endpoint is live; to function, set these env vars in Vercel project: `FIREBASE_SERVICE_ACCOUNT`, `SENDGRID_API_KEY`, `FROM_EMAIL`, `APP_URL`, and `VITE_PARENTAL_ENDPOINT`.
- Firebase Cloud Function deployment previously failed because the project requires Blaze (pay-as-you-go) to enable Artifact Registry for modern function runtimes.

If you want to use Firebase Cloud Functions (instead of Vercel):
1) Billing: enable Blaze (pay-as-you-go) in Firebase Console → Usage & billing. Modern Cloud Functions deploys require Artifact Registry.
2) Set function config values (either via `functions.config()` or environment vars):
   - Using Firebase functions config (recommended):
     firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY" sendgrid.from="no-reply@yourdomain.com" app.url="https://your-app-url"
3) Add your SendGrid API key and FROM email to the config. For service account, if your function uses Firebase Admin initialized via default credentials (deployed in the same project) you do not need a service account key — deployed functions can use application default credentials.
4) Deploy:
   cd functions
   npm install
   firebase deploy --only functions

If you cannot enable Blaze:
- Use the Vercel function already deployed (free tier) and set envs there (recommended). Alternatively use Netlify or Render free tiers.

Questions for you:
- Do you want me to attempt deploying the Firebase Cloud Function now (this requires you to enable Blaze and confirm)?
- Or do you want to continue using Vercel and set env vars there (I can help with that)?

File locations changed/created in this session:
- src/App.jsx (updated to use `VITE_PARENTAL_ENDPOINT`)
- api/sendParentalVerification.js (added)
- functions/index.js (updated to POST to SendGrid API)
- functions/package.json (fixed)
- .env.local (placeholders added)
- CONVERSATION_SAVE_2026-06-14.md (this file)

-- End of save
