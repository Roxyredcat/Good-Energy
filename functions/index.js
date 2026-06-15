/**
 * Firebase Cloud Function: sendParentalVerification
 * - Requires environment variables:
 *   - SENDGRID_API_KEY
 *   - FROM_EMAIL
 *   - APP_URL (optional, defaults to https://good-energy-8b1b4.web.app)
 *
 * Deployment:
 * 1. cd functions
 * 2. npm install
 * 3. firebase deploy --only functions
 *
 * Alternatively set env via Firebase functions config or use environment variables in your CI.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || (functions.config().sendgrid && functions.config().sendgrid.key);
const FROM_EMAIL = process.env.FROM_EMAIL || (functions.config().sendgrid && functions.config().sendgrid.from);
const APP_URL = process.env.APP_URL || (functions.config().app && functions.config().app.url) || 'https://good-energy-8b1b4.web.app';

if (!SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY not set; emails will fail until configured.');
}

exports.sendParentalVerification = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { userId, parentalEmail } = req.body || {};
  if (!userId || !parentalEmail) return res.status(400).send('Missing userId or parentalEmail');

  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days

    await admin.firestore().doc(`profiles/${userId}`).set({
      parentalVerificationToken: token,
      parentalTokenExpiresAt: expiresAt
    }, { merge: true });

    const verifyUrl = `${APP_URL}/?view=verify-parent&token=${token}&userId=${userId}`;

    if (!SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY not configured. Skipping send.');
      return res.status(500).send('Email not sent (SENDGRID_API_KEY not configured)');
    }

    // Use fetch to call SendGrid API directly (avoid @sendgrid/mail dependency)
    const payload = {
      personalizations: [
        { to: [{ email: parentalEmail }], subject: 'Parental Consent for Good Energy' }
      ],
      from: { email: FROM_EMAIL || 'no-reply@good-energy.example' },
      content: [
        { type: 'text/plain', value: `Please verify parental consent for your child by clicking the link: ${verifyUrl}` },
        { type: 'text/html', value: `<p>Please verify parental consent for your child on <strong>Good Energy</strong>.</p>
             <p>Click the link below to approve:</p>
             <p><a href="${verifyUrl}">Approve account</a></p>
             <p>This link expires in 7 days.</p>` }
      ]
    };

    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('SendGrid error', resp.status, text);
      return res.status(500).send('Failed to send verification email');
    }

    return res.status(200).send('Verification email sent');
  } catch (err) {
    console.error('sendParentalVerification error', err);
    return res.status(500).send('Failed to send verification email');
  }
});
