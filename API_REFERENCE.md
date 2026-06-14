# Quick Reference: API Endpoints & Functions Needed

## Firebase Cloud Functions to Deploy

### 1. Parental Email Verification

**Function: `sendParentalVerification`**
- Type: Callable Cloud Function
- Trigger: Called from frontend after signup
- What it does: Generates token, saves to DB, sends email to parent
- Input: `{ userId: string }`
- Output: `{ success: boolean, message?: string }`

**Function: `verifyParentalEmail`**
- Type: Callable Cloud Function  
- Trigger: Called when parent clicks link or user navigates to verify page
- What it does: Validates token, marks parent as verified, allows teen to access app
- Input: `{ token: string, userId: string }`
- Output: `{ success: boolean, message?: string }`

### 2. Data Purge Scheduler

**Function: `purgeDeletedAccounts`**
- Type: Cloud Scheduler triggered
- Schedule: Daily at 2 AM UTC
- What it does: Finds profiles with `isDeleted=true` and `deletedAt < 30 days ago`, hard deletes them
- No input/output needed

### 3. Photo Moderation (Optional - can use API directly)

**Function: `moderatePhotoUpload` (Optional wrapper)**
- Type: HTTP Callable
- Trigger: Before avatar photo is saved
- What it does: Calls Google Vision/AWS Rekognition, returns safe/unsafe
- Input: `{ imageUrl: string, userId: string }`
- Output: `{ safe: boolean, confidence: number, reason?: string }`

---

## Frontend API Calls Needed

All frontend calls should use the Callable Functions format:

```javascript
// Example: Call Cloud Function from frontend
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendVerification = httpsCallable(functions, 'sendParentalVerification');

try {
  const result = await sendVerification({ userId: user.uid });
  console.log(result.data);
} catch (error) {
  console.error('Error:', error);
}
```

### Required Frontend Calls:

1. **After signup (for <18 users):**
```javascript
const sendVerification = httpsCallable(functions, 'sendParentalVerification');
await sendVerification({ userId: cred.user.uid });
setView('parental-pending');
```

2. **On parental-pending page (polling):**
```javascript
const userSnap = await getDoc(doc(db, 'profiles', user.uid));
if (userSnap.data().parentalVerified) {
  // Unlock account
  setShowAvatarSetup(true);
}
```

3. **On verification link click:**
```javascript
// Extract token from URL params
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const userId = params.get('userId');

const verifyEmail = httpsCallable(functions, 'verifyParentalEmail');
await verifyEmail({ token, userId });
```

4. **Photo moderation (on avatar upload):**
```javascript
const moderatePhoto = httpsCallable(functions, 'moderatePhotoUpload');
const result = await moderatePhoto({ 
  imageUrl: photoUrl,
  userId: user.uid 
});

if (!result.data.safe) {
  setError('Photo contains inappropriate content');
  return;
}
```

---

## Database Indexes Needed

Create these indexes in Firestore for performance:

### 1. For parental verification
```
Collection: profiles
Fields: parentalVerified (ASC), createdAt (DESC)
```

### 2. For data purge
```
Collection: profiles
Fields: isDeleted (ASC), deletedAt (ASC)
```

### 3. For posts by user
```
Collection: posts
Fields: authorId (ASC), createdAt (DESC)
```

### 4. For support tickets
```
Collection: support_tickets
Fields: status (ASC), createdAt (DESC)
Fields: userId (ASC), createdAt (DESC)
```

---

## Environment Variables Needed

### Frontend `.env.local`
```
VITE_FIREBASE_API_KEY=AIzaSyDTjV0dJi079nMtD73Wou87tkVFXHbbIt0
VITE_FIREBASE_PROJECT_ID=good-energy-8b1b4
VITE_APP_DOMAIN=https://goodenergy.app
```

### Backend/Cloud Functions `.env`
```
# Email Service
EMAIL_PROVIDER=sendgrid  # or mailgun, aws-ses
EMAIL_API_KEY=your_api_key_here
EMAIL_FROM=noreply@goodenergy.app

# Google Vision API
GOOGLE_CLOUD_PROJECT=good-energy-8b1b4
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Or AWS Rekognition
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx

# App Config
APP_DOMAIN=https://goodenergy.app
ADMIN_EMAIL=admin@goodenergy.app
VERIFICATION_TOKEN_EXPIRY_HOURS=24
```

---

## Third-Party Services to Setup

### 1. Email Service (Pick One)

**SendGrid (Recommended)** - Easiest
- Sign up at sendgrid.com
- Get API key
- 100 emails/day free tier
- Use: `npm install @sendgrid/mail`

**Mailgun** - Good alternative
- Sign up at mailgun.com
- Get API key
- 5000 emails/month free
- Use: `npm install mailgun.js`

**AWS SES** - If using AWS
- Setup in AWS Console
- Request production access
- Use: `npm install aws-sdk`

### 2. Photo Moderation (Pick One)

**Google Cloud Vision** - Best for this use case
- Create project in Google Cloud Console
- Enable Vision API
- Create service account
- Download credentials JSON
- Use: `npm install @google-cloud/vision`

**AWS Rekognition** - Alternative
- Setup in AWS Console
- Use: `npm install aws-sdk`

### 3. Firebase Extensions (Optional)

Could use Firebase Extensions instead:
- Stripe Extension for payments (if adding premium)
- Mailchimp Extension for emails (if using Mailchimp)

---

## Deployment Steps

### Step 1: Deploy Cloud Functions
```bash
cd firebase/functions
npm install
firebase deploy --only functions
```

### Step 2: Create Firestore Indexes
```bash
firebase firestore:indexes:create
# Select the index configurations from above
```

### Step 3: Setup Cloud Scheduler
```bash
gcloud scheduler jobs create pubsub purge-deleted-accounts \
  --schedule="0 2 * * *" \
  --time-zone="UTC" \
  --topic=purge-accounts \
  --location=us-east1
```

### Step 4: Update Frontend
- Add API calls (see Frontend API Calls Needed)
- Add verification page route
- Update settings modal with new functions
- Test all flows

---

## Testing Checklist for APIs

- [ ] Send parental verification email function works
- [ ] Email received at correct address
- [ ] Email contains valid verification link
- [ ] Verification link has correct token format
- [ ] Token validates correctly
- [ ] Token expires after 24 hours
- [ ] Verification updates profile correctly
- [ ] Photo moderation catches inappropriate images
- [ ] Photo moderation allows safe images
- [ ] Data purge finds deleted accounts correctly
- [ ] Data purge actually deletes records
- [ ] Data purge respects 30-day window

---

## Cost Estimates (Monthly)

- **Email sending**: $0-10 (50K emails at Mailgun)
- **Google Vision API**: $0-15 (1.5K images at $0.01 each)
- **Firebase Functions**: $0-50 (5M invocations included free)
- **Firestore**: $0-25 (depends on usage)
- **Cloud Scheduler**: Free (up to 3 jobs)
- **Cloud Storage**: $0-5 (avatars/images)

**Total estimated**: $0-105/month for all features

---

## Quick Debugging

### Email not sending?
- Check credentials in .env
- Check email service quota/limits
- Check email template formatting
- Check logs in Firebase Console

### Token not validating?
- Check token format matches what's stored
- Check timestamp comparison (milliseconds vs seconds)
- Check Firestore data types

### Photos not moderating?
- Check Google Cloud credentials
- Check API quota not exceeded
- Check image URL is publicly accessible
- Check response parsing

### Data not purging?
- Check Cloud Scheduler job logs
- Check Firestore query returns results
- Check batch write limits (500 documents)
- Check lastModified timestamp vs deletion timestamp

---

## Support & Debugging

**Firebase Console URL:**
https://console.firebase.google.com/project/good-energy-8b1b4

**Google Cloud Console:**
https://console.cloud.google.com/welcome?project=good-energy-8b1b4

**Mailgun Dashboard:**
https://app.mailgun.com/

**SendGrid Dashboard:**
https://app.sendgrid.com/

---

