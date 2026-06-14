# Phase 2 Deployment Guide - Quick Start

## ✅ Frontend Complete
All Phase 2 frontend features are NOW in `src/App.jsx`:
- ✅ Support Form (modal with categories)
- ✅ Email Verification View (verify-parent page)
- ✅ Aura Privacy (getPublicProfile function)
- ✅ Support Ticket Submission

## 🔴 Backend Setup Required

### Step 1: Setup Email Service

**Option A: Gmail (Easiest for testing)**
1. Go to myaccount.google.com/apppasswords
2. Create App Password
3. Set in .env:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   ```

**Option B: SendGrid (Production)**
1. Sign up at sendgrid.com
2. Get API key
3. Replace nodemailer config with:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   ```

### Step 2: Create Firebase Cloud Functions

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. Create functions directory:
   ```bash
   firebase init functions
   ```

3. Copy this code to `functions/index.js`:
   (See PHASE2_FUNCTIONS.js file)

4. Install dependencies:
   ```bash
   cd functions
   npm install nodemailer
   npm install
   ```

5. Deploy:
   ```bash
   firebase deploy --only functions
   ```

### Step 3: Send Parental Verification Email

Add to App.jsx after successful signup for minors:

```javascript
// After profile created
const functions = getFunctions();
const sendParentalEmail = httpsCallable(functions, 'sendParentalVerification');
await sendParentalEmail({ userId: cred.user.uid });
```

### Step 4: Handle Verification Link

The verify-parent view is already in App.jsx at line ~920.
It automatically:
- Validates token
- Checks expiration
- Updates parentalVerified
- Shows success/error message

### Step 5: Firestore Collections to Create

Create these manually in Firebase Console:

**support_tickets**
```
Fields:
- userId (string)
- email (string)
- category (string)
- subject (string)
- message (string)
- status (string)
- createdAt (timestamp)
- adminNotes (string)
- resolvedAt (timestamp)
```

**Firestore Rules to Add:**
```javascript
match /support_tickets/{document=**} {
  allow read: if request.auth.uid != null && (
    request.auth.uid == resource.data.userId ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true
  );
  allow create: if request.auth.uid != null;
  allow update, delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true;
}
```

## 🧪 Testing Phase 2

### Email Verification Flow
1. Sign up as age < 18
2. Check email (or Firestore) for verification token
3. Click verification link in email
4. Confirm account is marked parentalVerified

### Support Form
1. Click "Support" button in feed header
2. Fill out form
3. Select category
4. Submit
5. Confirm ticket appears in support_tickets collection

### Aura Privacy
1. Make a post
2. Have another user view profile
3. Verify aura is NOT visible to other users
4. Verify aura IS visible to self

## ⚠️ Common Issues

**Email not sending?**
- Check credentials in .env
- Check email service quota
- Check Firestore Rules allow writes

**Token validation failing?**
- Check token matches exactly (case-sensitive)
- Check timestamp is correct
- Check Firestore Timestamp types match

**Support tickets not saving?**
- Check Firestore permissions
- Check collection exists
- Check user is authenticated

## 🚀 Deployment Checklist

- [ ] Email service account setup
- [ ] Cloud Functions deployed
- [ ] .env variables configured
- [ ] Firestore collections created
- [ ] Firestore rules updated
- [ ] Email sending tested
- [ ] Verification flow tested
- [ ] Support form tested
- [ ] Aura privacy tested

## Next: Remaining Phase 2 Features

**Still needed (simple):**
- Photo moderation (integrate Google Vision when ready)
- Data purge cron job (setup Cloud Scheduler)

Both have guides in API_REFERENCE.md

---

**Timeline:**
- Email setup: 15 minutes
- Cloud Functions: 30 minutes
- Firestore setup: 10 minutes
- Testing: 20 minutes
- **Total: ~75 minutes**

**Current status:** 🟠 Frontend 100% complete, waiting on backend setup
