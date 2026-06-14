# Parental Email Verification System - Backend Guide

NOTE: Good Energy has removed the teen pool and now requires all users to be 18 or older. The parental verification system described below is retained for reference only and is currently deprecated.

## Overview

This guide explains how the parental email verification system worked (for historical/reference use). The platform no longer supports accounts for persons under 18.

## Current State

The frontend now:
1. ✅ Collects parent email during signup for <18 users
2. ✅ Stores `parentalEmail` in profile
3. ✅ Shows "parental-pending" screen
4. ✅ Sets `parentalVerified: false` initially

## What Needs to be Built

### 1. Email Sending Service

You need a backend endpoint that sends verification emails. Options:

**Option A: Firebase Cloud Functions (Recommended)**
- No additional server needed
- Scalable and serverless
- Integrates directly with Firestore

**Option B: External Service**
- SendGrid, Mailgun, AWS SES
- More features but requires API integration

### 2. Email Verification Link

Generate a time-limited verification token:
- Token should be unique per profile
- Should expire after 24-48 hours
- Should include parent email and user UID

Example implementation (Node.js):
```javascript
const crypto = require('crypto');

function generateVerificationToken(userId, parentEmail) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  return { token, expiresAt };
}
```

### 3. Database Schema Update

Add to `profiles` collection:
```javascript
{
  // ... existing fields
  parentalEmail: "parent@example.com",
  parentalVerified: false,
  parentalVerificationToken: "abc123def456...",
  parentalTokenExpiresAt: timestamp,
  parentalVerificationSentAt: timestamp,
  parentalVerifiedAt: null  // Set when parent confirms
}
```

### 4. API Endpoints Needed

#### A. Send Parental Verification Email
```
POST /api/auth/send-parental-verification
Body: { userId: string }
Response: { success: boolean, message: string }
```

Implementation:
1. Get user profile from Firestore
2. Check if `parentalEmail` exists
3. Generate verification token
4. Store token in profile with expiry
5. Send email with verification link
6. Return success

#### B. Verify Parental Email
```
GET /api/auth/verify-parental-email?token={token}&userId={userId}
Response: { success: boolean, message: string }
```

Implementation:
1. Look up user by userId
2. Check if token is valid (matches stored token)
3. Check if token is not expired
4. Set `parentalVerified: true`
5. Clear token and expiry
6. Set `parentalVerifiedAt: timestamp`
7. Return success message
8. Frontend should then allow user to continue to avatar setup

### 5. Email Template

Send this email to the parent:

```html
Subject: Verify Your Teen's Good Energy Account

Dear Parent/Guardian,

Your teen has started creating an account on Good Energy, a calm social space designed for positive connection.

To comply with child privacy laws, we need your permission. Click the link below to verify:

[LINK: https://goodenergy.app/verify-parent?token=ABC123&userId=user123]

This link expires in 24 hours.

If you did not authorize this account, please ignore this email.

Good Energy Team
https://goodenergy.app
```

### 6. Frontend Changes Needed

Modify `App.jsx` to:

1. **After signup, check age:**
```jsx
if (parseInt(age) < 18) {
  // Send verification email
  await fetch('/api/auth/send-parental-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: cred.user.uid })
  });
  
  setView('parental-pending');
}
```

2. **Add polling to parental-pending view:**
```jsx
useEffect(() => {
  if (view !== 'parental-pending') return;
  
  const interval = setInterval(async () => {
    const snap = await getDoc(doc(db, 'profiles', user.uid));
    if (snap.data().parentalVerified) {
      setShowAvatarSetup(true);
      setView('feed');
    }
  }, 5000); // Check every 5 seconds
  
  return () => clearInterval(interval);
}, [view, user]);
```

3. **Add verification page route:**
```jsx
if (view === 'verify-parent') {
  // Get token from URL params
  // Call verification endpoint
  // Show success/error message
}
```

### 7. Firebase Cloud Function Example

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendParentalVerification = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  
  // Security: Only allow authenticated users
  if (!context.auth) throw new Error('Unauthenticated');
  if (context.auth.uid !== userId) throw new Error('Unauthorized');
  
  // Get user profile
  const userRef = admin.firestore().collection('profiles').doc(userId);
  const userSnap = await userRef.get();
  const user = userSnap.data();
  
  if (!user || !user.parentalEmail) {
    throw new Error('No parental email found');
  }
  
  // Generate token
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
  
  // Save token to profile
  await userRef.update({
    parentalVerificationToken: token,
    parentalTokenExpiresAt: admin.firestore.Timestamp.fromDate(new Date(expiresAt)),
    parentalVerificationSentAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Send email
  const verificationUrl = 
    `https://goodenergy.app/verify-parent?token=${token}&userId=${userId}`;
  
  await transporter.sendMail({
    to: user.parentalEmail,
    subject: 'Verify Your Teen\'s Good Energy Account',
    html: `
      <h2>Hi Parent/Guardian!</h2>
      <p>Your teen is joining Good Energy, a positive social space.</p>
      <p>We need your permission to comply with child privacy laws.</p>
      <a href="${verificationUrl}" style="
        display: inline-block;
        background: #4f46e5;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        margin: 20px 0;
      ">Verify Account</a>
      <p>This link expires in 24 hours.</p>
      <p>Good Energy Team</p>
    `
  });
  
  return { success: true };
});

exports.verifyParentalEmail = functions.https.onCall(async (data, context) => {
  const { token, userId } = data;
  
  if (!token || !userId) throw new Error('Missing parameters');
  
  // Get user profile
  const userRef = admin.firestore().collection('profiles').doc(userId);
  const userSnap = await userRef.get();
  const user = userSnap.data();
  
  if (!user) throw new Error('User not found');
  
  // Validate token
  if (user.parentalVerificationToken !== token) {
    throw new Error('Invalid token');
  }
  
  // Check expiry
  const expiresAt = user.parentalTokenExpiresAt?.toDate().getTime();
  if (Date.now() > expiresAt) {
    throw new Error('Token expired');
  }
  
  // Mark as verified
  await userRef.update({
    parentalVerified: true,
    parentalVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    parentalVerificationToken: admin.firestore.FieldValue.delete(),
    parentalTokenExpiresAt: admin.firestore.FieldValue.delete()
  });
  
  return { success: true };
});
```

### 8. Environment Variables

Store in `.env.local`:
```
VITE_FIREBASE_PROJECT_ID=good-energy-8b1b4
VITE_EMAIL_DOMAIN=goodenergy.app
```

Backend `.env`:
```
EMAIL_USER=noreply@goodenergy.app
EMAIL_PASSWORD=your-app-password
FIREBASE_PROJECT_ID=good-energy-8b1b4
```

### 9. Security Considerations

1. ✅ Verify token matches stored token
2. ✅ Check token hasn't expired
3. ✅ Only allow one verification per token
4. ✅ Rate limit email sending (max 3 per day per email)
5. ✅ Don't expose user ID in email link (actually, do include it - it's public)
6. ✅ Use HTTPS only for verification links
7. ✅ Sanitize all inputs

### 10. Testing Checklist

- [ ] Signup for <18 user collects parent email
- [ ] Verification email sent to parent email
- [ ] Email link is clickable and valid
- [ ] Token validation works
- [ ] Token expiration works
- [ ] Teen account unlocks after parent verification
- [ ] Rate limiting prevents spam
- [ ] Invalid tokens are rejected
- [ ] Verification log is recorded

---

## COPPA Requirements Met

✅ Age gating (13+)
✅ Parental email collection
✅ Parental email verification
✅ Account access blocked until verified
✅ Verification audit trail (parentalVerifiedAt timestamp)
✅ Email privacy (stored securely in Firebase)

