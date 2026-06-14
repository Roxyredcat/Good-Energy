# Remaining Critical Features - Implementation Priority Queue

## Summary
4 critical features are now implemented. 5 more critical features need frontend/backend work.

---

## PHASE 2: HIGH PRIORITY (Do Next)

### 1. ⏳ Photo Moderation System (CRITICAL)

**Why Critical:**
- Safety requirement for Teen Pool
- Inappropriate photos can expose minors to harm
- No content filter currently exists

**Current State:**
- Users can upload photos as avatars
- No validation or flagging system

**Implementation:**
```javascript
// Use Google Cloud Vision API or AWS Rekognition

async function moderatePhoto(imageUrl) {
  const vision = require('@google-cloud/vision');
  const client = new vision.ImageAnnotatorClient();
  
  const request = {
    image: { source: { imageUri: imageUrl } },
    features: [
      { type: 'SAFE_SEARCH_DETECTION' },
      { type: 'EXPLICIT_CONTENT_DETECTION' }
    ]
  };
  
  const [result] = await client.annotateImage(request);
  const detection = result.safeSearchAnnotation;
  
  if (detection.adult === 'LIKELY' || detection.adult === 'VERY_LIKELY') {
    return { flagged: true, reason: 'Inappropriate content detected' };
  }
  
  return { flagged: false };
}
```

**Database:**
```javascript
// Add flagged_avatars collection
{
  userId: string,
  imageUrl: string,
  flagReason: string,
  flaggedAt: timestamp,
  reviewedAt: null,
  reviewedBy: null,
  action: 'remove|approve' // default null = pending
}
```

**Effort:** 2-3 hours (requires API key and credential setup)

---

### 2. ⏳ Email Verification for Parental Consent (CRITICAL)

**Why Critical:**
- COPPA legal requirement
- Cannot launch without this
- Parental verification blocks account access

**Current State:**
- Frontend collects parent email ✅
- No email sending system
- No verification link handling

**What to Build:**
- Firebase Cloud Functions for email sending
- Email template with verification link
- Verification endpoint
- Link handling in frontend
- 24-hour token expiration

**Effort:** 4-6 hours (includes email service setup)

See: `PARENTAL_VERIFICATION_GUIDE.md`

---

### 3. ⏳ Support Form (HIGH)

**Why Important:**
- LEGAL.md explicitly requires "in-app Support form"
- Users need way to report issues and appeal violations
- Must be accessible from header

**Current State:**
- Only link to legal.html exists
- No form UI
- No admin email integration

**Implementation:**
```javascript
// Support form modal with:
- Subject line
- Message textarea
- Category dropdown (appeal/privacy/report/bug)
- User email auto-filled
- Captcha (prevent spam)
- Submit to admin email

// Database collection: support_tickets
{
  id: uuid,
  userId: string,
  email: string,
  category: 'appeal|privacy|report|bug',
  subject: string,
  message: string,
  status: 'open|in_review|resolved',
  createdAt: timestamp,
  resolvedAt: null,
  adminNotes: string
}
```

**Effort:** 2-3 hours

---

### 4. ⏳ Data Purge Cron Job (HIGH)

**Why Important:**
- LEGAL.md: "Deleted accounts are purged within 30 days"
- Privacy/compliance requirement
- Data should not persist indefinitely

**Current State:**
- Soft delete implemented in frontend ✅
- No automatic hard delete process

**What to Build:**
```javascript
// Firebase Cloud Scheduler job (runs daily at 2 AM UTC)
exports.purgeDeletedAccounts = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const deletedUsers = await db.collection('profiles')
      .where('isDeleted', '==', true)
      .where('deletedAt', '<', 
        admin.firestore.Timestamp.fromDate(new Date(thirtyDaysAgo)))
      .get();
    
    const batch = db.batch();
    let count = 0;
    
    for (const doc of deletedUsers.docs) {
      const userId = doc.id;
      
      // Delete profile
      batch.delete(doc.ref);
      
      // Delete all posts
      const posts = await db.collection('posts')
        .where('authorId', '==', userId)
        .get();
      
      for (const post of posts.docs) {
        batch.delete(post.ref);
      }
      
      count++;
    }
    
    await batch.commit();
    console.log(`Purged ${count} deleted accounts`);
  });
```

**Effort:** 1-2 hours

---

### 5. ⏳ Aura Privacy Enforcement (HIGH)

**Why Important:**
- LEGAL.md: "Aura status visible only to you"
- Users should not see others' violation counts
- Current implementation leaks this data

**Current State:**
- Aura stored in profile ❌ Public
- Profile sent to all clients including aura
- Other users can see your aura/violations

**Fix:**
```javascript
// In feed, when sending user profiles:
const publicProfile = {
  username: profile.username,
  avatar: profile.avatar,
  // Remove: aura, violations
};

// Only include aura in self-profile:
if (userId === currentUserId) {
  publicProfile.aura = profile.aura;
  publicProfile.violations = profile.violations;
}
```

**Effort:** 1 hour

---

## PHASE 3: MEDIUM PRIORITY (After Phase 2)

### 6. Support Admin Dashboard

Not yet designed. Needed for:
- Reviewing support tickets
- Approving/denying violation appeals
- Managing flagged content

---

### 7. Quiet Mode Improvements

Current: Just tic-tac-toe game
Needed:
- Clear messaging about purpose
- Time-based unlock (user must wait before re-engaging)
- Progress tracking
- Educational content about community values

---

### 8. Content Moderation Dashboard

For admins to:
- Review flagged photos
- Review flagged comments
- Approve/remove content
- Issue warnings

---

## PHASE 4: NICE TO HAVE

- Advanced analytics dashboard
- User blocking/reporting
- Custom moderation rules
- A/B testing infrastructure
- Content recommendations

---

## Implementation Timeline Estimate

| Phase | Features | Time | Deadline |
|-------|----------|------|----------|
| ✅ Phase 1 | Parental consent UI, Delete account, Export data | 2 hours | ✅ Done |
| ⏳ Phase 2 | Email verification, Photo moderation, Support form, Data purge, Aura privacy | 10-14 hours | Critical |
| ⏳ Phase 3 | Admin dashboards, Quiet Mode, Content moderation | 8-12 hours | Before launch |
| 📅 Phase 4 | Analytics, blocking, advanced features | Open-ended | Post-launch |

---

## Testing Before Launch

### Legal Compliance Tests
- [ ] User under 18 cannot access feed without parental verification
- [ ] Parent receives verification email
- [ ] Clicking email link verifies account
- [ ] Account unlocks after verification
- [ ] User can export all their data as JSON
- [ ] User can delete account (soft delete works)
- [ ] Data purges after 30 days (test with date override)
- [ ] Other users cannot see your aura/violations
- [ ] Support form is accessible and functional
- [ ] Inappropriate photos are flagged/rejected

### Safety Tests  
- [ ] Predatory language detected in teen pool
- [ ] User gets banned on first predatory message
- [ ] Profile shows banned status
- [ ] Banned user cannot post or comment

### Usability Tests
- [ ] Settings button easily accessible
- [ ] Export/delete clearly explained
- [ ] Warning about permanent deletion shown
- [ ] Parental pending screen not confusing
- [ ] No data loss on accidental clicks

---

## Launch Checklist

Must complete before going live:

**CRITICAL:**
- [ ] Phase 1 features working (✅ done)
- [ ] Phase 2 features working
- [ ] COPPA legal requirements met
- [ ] Security audit completed
- [ ] Privacy audit completed

**IMPORTANT:**
- [ ] Terms of Service link working
- [ ] Privacy Policy link working
- [ ] Support form functional
- [ ] Error handling tested
- [ ] Database backups configured

**NICE TO HAVE:**
- [ ] Admin dashboard deployed
- [ ] Analytics tracking enabled
- [ ] Monitoring/alerting configured

---

## Next Steps Right Now

1. **Start Phase 2 implementation:**
   - Pick one feature to complete this session
   - Recommend starting with **Email Verification** (blocking feature)
   - Or **Photo Moderation** (safety feature)

2. **Get credentials ready:**
   - Google Cloud Vision API key
   - Email service credentials (SendGrid/Mailgun)
   - Firebase upgrade if needed

3. **Setup backend infrastructure:**
   - Firebase Cloud Functions deployed
   - Cron job scheduled
   - Environment variables configured

---

## Questions?

See documentation files:
- `PARENTAL_VERIFICATION_GUIDE.md` - Detailed email verification implementation
- `IMPLEMENTATION_LOG.md` - Summary of Phase 1 changes
- `IMPLEMENTATION_ROADMAP.md` - Full feature matrix

