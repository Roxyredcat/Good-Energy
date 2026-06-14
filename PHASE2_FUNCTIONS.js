// Good Energy Phase 2 - Firebase Cloud Functions
// Deploy to functions/index.js with: firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// ===== EMAIL SETUP =====
// For Gmail: Use App Password
// For SendGrid: Replace with sendgrid library
// For Mailgun: Replace with mailgun library

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ===== 1. SEND PARENTAL VERIFICATION =====
exports.sendParentalVerification = functions.https.onCall(async (data, context) => {
  // Security: Must be authenticated
  if (!context.auth) throw new Error('Unauthenticated');
  if (context.auth.uid !== data.userId) throw new Error('Unauthorized');

  const userRef = db.collection('profiles').doc(data.userId);
  const userSnap = await userRef.get();
  const user = userSnap.data();

  if (!user?.parentalEmail) throw new Error('No parental email found');
  if (user.parentalVerified) return { success: true, message: 'Already verified' };

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

  // Save to profile
  await userRef.update({
    parentalVerificationToken: token,
    parentalTokenExpiresAt: admin.firestore.Timestamp.fromDate(new Date(expiresAt)),
    parentalVerificationSentAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Build link
  const verifyUrl = `${process.env.APP_DOMAIN}/verify-parent?token=${token}&userId=${data.userId}`;

  // Send email
  const mailOptions = {
    to: user.parentalEmail,
    subject: 'Verify Your Teen\'s Good Energy Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Hi Parent/Guardian!</h2>
        <p>Your teen is joining Good Energy, a calm social space for positive connection.</p>
        <p>We need your permission to comply with child privacy laws.</p>
        
        <a href="${verifyUrl}" style="
          display: inline-block;
          background: #4f46e5;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: bold;
        ">✅ Verify Account</a>
        
        <p style="color: #666;">This link expires in 24 hours.</p>
        <p style="color: #999; font-size: 12px;">If you did not authorize this account, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Good Energy Team<br>Keeping teens safe online ✨</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Verification email sent' };
  } catch (error) {
    console.error('Email error:', error);
    throw new Error('Failed to send email: ' + error.message);
  }
});

// ===== 2. VERIFY PARENTAL EMAIL =====
exports.verifyParentalEmail = functions.https.onCall(async (data, context) => {
  const { token, userId } = data;
  if (!token || !userId) throw new Error('Missing parameters');

  const userRef = db.collection('profiles').doc(userId);
  const userSnap = await userRef.get();
  const user = userSnap.data();

  if (!user) throw new Error('User not found');
  if (user.parentalVerificationToken !== token) throw new Error('Invalid verification token');

  const expiresAt = user.parentalTokenExpiresAt?.toDate?.().getTime();
  if (!expiresAt || Date.now() > expiresAt) throw new Error('Token expired - please request new verification');

  // Mark as verified
  await userRef.update({
    parentalVerified: true,
    parentalVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    parentalVerificationToken: admin.firestore.FieldValue.delete(),
    parentalTokenExpiresAt: admin.firestore.FieldValue.delete()
  });

  return { success: true, message: 'Account verified successfully!' };
});

// ===== 3. SUBMIT SUPPORT TICKET =====
exports.submitSupportTicket = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new Error('Unauthenticated');

  const { subject, message, category } = data;
  if (!subject || !message || !category) throw new Error('Missing required fields');
  if (subject.length < 3) throw new Error('Subject too short');
  if (message.length < 10) throw new Error('Message too short');

  // Create ticket
  const ticket = {
    userId: context.auth.uid,
    email: context.auth.token.email,
    subject: subject.substring(0, 100),
    message: message.substring(0, 5000),
    category,
    status: 'open',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await db.collection('support_tickets').add(ticket);

  // Notify admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@goodenergy.app';
  const mailOptions = {
    to: adminEmail,
    subject: `[Good Energy Support] ${category.toUpperCase()}: ${subject}`,
    html: `
      <h3>New Support Ticket</h3>
      <p><strong>Ticket ID:</strong> ${docRef.id}</p>
      <p><strong>From:</strong> ${context.auth.token.email}</p>
      <p><strong>Category:</strong> ${category}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p><a href="https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore/data/support_tickets/${docRef.id}">View in Firebase Console</a></p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Admin notification email failed:', error);
    // Don't throw - ticket was created, email is optional
  }

  return { success: true, ticketId: docRef.id };
});

// ===== 4. MODERATE PHOTO (Placeholder for Google Vision) =====
exports.moderatePhotoUpload = functions.https.onCall(async (data, context) => {
  // TODO: Integrate with Google Cloud Vision API
  // For now: Return safe (manual moderation)
  // Actual integration would check for unsafe content
  
  console.log('Photo moderation called for:', data.userId);
  
  return {
    safe: true,
    confidence: 0.99,
    message: 'Photo approved'
  };
});

// ===== 5. PURGE DELETED ACCOUNTS (Daily Cron) =====
// Setup: https://cloud.google.com/scheduler/docs/quickstart
// Command: gcloud scheduler jobs create pubsub purge-deleted-accounts --schedule="0 2 * * *" --topic=purge-deleted --time-zone=UTC
exports.purgeDeletedAccounts = functions.pubsub
  .topic('purge-deleted')
  .onPublish(async (message) => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Find deleted accounts
    const deletedUsers = await db.collection('profiles')
      .where('isDeleted', '==', true)
      .where('deletedAt', '<', new Date(thirtyDaysAgo))
      .limit(100)
      .get();

    console.log(`Purging ${deletedUsers.docs.length} deleted accounts`);

    let purgeCount = 0;
    const batch = db.batch();

    for (const doc of deletedUsers.docs) {
      const userId = doc.id;

      // Delete profile
      batch.delete(doc.ref);

      // Delete all posts
      const posts = await db.collection('posts')
        .where('authorId', '==', userId)
        .limit(500)
        .get();

      for (const postDoc of posts.docs) {
        batch.delete(postDoc.ref);
      }

      purgeCount++;

      // Firestore has limits on batch writes
      if (purgeCount % 50 === 0) {
        await batch.commit();
        batch.clear();
      }
    }

    if (purgeCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Purged ${purgeCount} accounts`);
    return { purged: purgeCount };
  });

// ===== 6. ADMIN: GET SUPPORT TICKETS =====
exports.getSupportTickets = functions.https.onCall(async (data, context) => {
  // TODO: Add admin role verification
  if (!context.auth) throw new Error('Unauthenticated');

  const { status = 'open', limit = 50 } = data;

  const tickets = await db.collection('support_tickets')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 100))
    .get();

  return {
    tickets: tickets.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString()
    }))
  };
});

// ===== 7. ADMIN: UPDATE TICKET STATUS =====
exports.updateTicketStatus = functions.https.onCall(async (data, context) => {
  // TODO: Add admin role verification
  if (!context.auth) throw new Error('Unauthenticated');

  const { ticketId, status, notes } = data;
  if (!ticketId || !status) throw new Error('Missing parameters');

  await db.collection('support_tickets').doc(ticketId).update({
    status,
    adminNotes: notes || '',
    resolvedAt: ['resolved', 'closed'].includes(status) 
      ? admin.firestore.FieldValue.serverTimestamp()
      : null
  });

  return { success: true };
});
