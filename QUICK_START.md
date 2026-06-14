# Quick Start for Phase 2 Implementation

## 5-Minute Overview

**What's been done:**
- Parental consent UI for minors ✅
- Account deletion UI ✅
- Data export UI ✅  
- Settings page ✅

**What's blocking launch:**
- Email verification for parents (frontend ready, backend needed)
- Photo moderation for avatars (not started)
- Support form (not started)
- Data purge cron job (not started)

**Time to completion:** 10-14 hours of backend work

---

## Reading Order (Pick One)

### For Quick Context (15 min)
1. This file (you're reading it)
2. `BEFORE_AND_AFTER.md` - Visual summary

### For Complete Understanding (45 min)
1. `IMPLEMENTATION_STATUS.md` - Dashboard view
2. `IMPLEMENTATION_LOG.md` - What changed
3. `NEXT_STEPS.md` - Priority queue

### For Implementation (Detailed)
1. `API_REFERENCE.md` - Endpoints & setup
2. Feature-specific guide:
   - `PARENTAL_VERIFICATION_GUIDE.md` (email verification)
   - Photo moderation (TODO: create guide)
   - Support form (TODO: create guide)

---

## Quick Test Checklist

To verify Phase 1 is working, test these flows:

### Test 1: Adult Signup (5 min)
```
1. Click "Get Started"
2. Enter: email, password, username, age 25
3. Click "Sign Up"
4. Should go to onboarding
5. Choose avatar
6. Should reach feed
7. ✅ PASS: No parental email asked
```

### Test 2: Teen Signup (5 min)
```
1. Click "Get Started"
2. Enter: email, password, username, age 15
3. Parental email field appears ✅ NEW
4. Enter parent email
5. Click "Sign Up"
6. Should show "Parental Consent Pending" ✅ NEW
7. ✅ PASS: Blocked from feed (as expected)
```

### Test 3: Settings Access (3 min)
```
1. Log in as adult user
2. Look at top right corner
3. Should see: Profile (👤) and Settings (⚙️) ✅ NEW
4. Click Settings
5. Should see:
   - Export My Data button
   - Delete Account button
6. ✅ PASS: Settings modal works
```

### Test 4: Export Data (3 min)
```
1. In Settings modal
2. Click "Export My Data"
3. File should download: good-energy-export-{timestamp}.json
4. Open file in text editor
5. Should contain: profile, posts, exportedAt
6. ✅ PASS: Export works
```

### Test 5: Delete Account (3 min)
```
1. In Settings modal
2. Click "Delete Account"
3. Delete confirmation modal appears
4. Enter password
5. Click "Delete"
6. Should be logged out automatically
7. Check Firestore: profile should have isDeleted: true
8. ✅ PASS: Soft delete works
```

---

## Immediate Next Steps (Choose One)

### Option A: Start Email Verification (Recommended)
**Why:** Blocking feature, COPPA requirement
**Time:** 4-6 hours
**Steps:**
1. Read: `PARENTAL_VERIFICATION_GUIDE.md`
2. Choose email service (SendGrid is easiest)
3. Create Cloud Functions
4. Add verification page to frontend
5. Test end-to-end

### Option B: Start Photo Moderation
**Why:** Teen safety critical
**Time:** 3-4 hours  
**Steps:**
1. Get Google Vision API credentials
2. Create Cloud Function
3. Integrate with avatar upload
4. Test with safe and unsafe images

### Option C: Start Support Form
**Why:** Legal requirement (LEGAL.md)
**Time:** 2-3 hours
**Steps:**
1. Create support modal component
2. Add form submission logic
3. Create support_tickets collection
4. Setup admin email notifications

**Recommendation:** Do in order: Email > Photo > Support

---

## Code Locations

### New Code in App.jsx:

**State variables (line ~148):**
```javascript
const [parentalEmail, setParentalEmail] = useState('');
const [showParentalConsent, setShowParentalConsent] = useState(false);
const [showSettings, setShowSettings] = useState(false);
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [deletePassword, setDeletePassword] = useState('');
```

**New functions (line ~504):**
```javascript
const deleteAccount = async () => { ... }
const exportData = async () => { ... }
```

**Parental email input (line ~662):**
```javascript
{isSignupMode && age && parseInt(age) < 18 && (
  <input placeholder="Parent/Guardian Email" ... />
)}
```

**New views:**
- `if (view === 'parental-pending')` (line ~804)
- Settings modal (line ~947)
- Delete confirmation modal (line ~984)

**New button in header (line ~908):**
```javascript
<button onClick={()=>setShowSettings(true)}><Settings size={20}/></button>
```

---

## File Structure

```
Good Energy/
├── src/
│   └── App.jsx ← ALL CHANGES HERE
├── public/
│   ├── legal.html
│   └── LEGAL.md
├── LEGAL.md (requirements document)
├── IMPLEMENTATION_ROADMAP.md
├── IMPLEMENTATION_LOG.md ← WHAT CHANGED
├── IMPLEMENTATION_STATUS.md ← DASHBOARD
├── PARENTAL_VERIFICATION_GUIDE.md ← FOR EMAIL
├── API_REFERENCE.md ← FOR BACKEND
├── NEXT_STEPS.md ← PRIORITIES
├── BEFORE_AND_AFTER.md ← VISUAL SUMMARY
└── QUICK_START.md ← THIS FILE
```

---

## Most Common Issues & Fixes

### Issue: "Settings button doesn't appear"
**Cause:** Not logged in / on feed view
**Fix:** 
- Login first
- Make sure you're on feed view (not auth/onboarding)
- Check browser console for errors

### Issue: "Export downloads but file is empty"
**Cause:** No posts in database
**Fix:**
- Create some posts first
- Export should include profile even with no posts

### Issue: "Delete doesn't work"
**Cause:** Wrong password, or Firestore permissions
**Fix:**
- Check password is correct
- Verify Firestore is in TEST MODE
- Check browser console for error

### Issue: "Parental email field doesn't show"
**Cause:** Age is >= 18
**Fix:**
- Use age < 18 (e.g., 15)
- Field should appear when age is entered

---

## Database Fields to Add

Run these in Firestore console if missing:

```javascript
// profiles collection - add fields to new users
parentalEmail: null
parentalVerified: false
isDeleted: false
deletedAt: null
dataExportedAt: null

// New collections needed (create manually)
support_tickets/
flagged_avatars/
```

---

## Environment Variables

No new env vars needed for Phase 1. Phase 2 will need:

```bash
# For email verification
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=xxx

# For photo moderation  
GOOGLE_CLOUD_PROJECT=good-energy-8b1b4
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# For support
ADMIN_EMAIL=admin@goodenergy.app
```

---

## Testing Commands

```bash
# Build to check for syntax errors
npm run build

# Start dev server
npm run dev

# No automated tests yet (can add later)
```

---

## Debugging Tips

### Check if changes are working:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for any red errors
4. Try clicking buttons
5. Watch for console logs

### Check Firestore data:
1. Go to Firebase Console
2. Navigate to Firestore
3. Find profiles collection
4. Look for your test user
5. Verify fields are being set

### Check network requests:
1. DevTools > Network tab
2. Sign up or make changes
3. Look for failed requests
4. Check response body for error details

---

## Success Criteria for Phase 1

Phase 1 is complete when:
- [ ] All 5 tests above pass
- [ ] Code builds without errors
- [ ] No breaking changes to existing features
- [ ] Firestore shows new fields on users
- [ ] Settings modal opens and closes
- [ ] Export downloads JSON file
- [ ] Delete marks profile as deleted

**Estimated time to verify:** 15-20 minutes

---

## Getting Help

If stuck:
1. **Check the docs:**
   - Feature guide first
   - Then API_REFERENCE.md
   - Then search IMPLEMENTATION_LOG.md

2. **Check the code:**
   - Grep for similar patterns
   - Look at existing Firebase calls for examples
   - Check error messages in console

3. **Check Firestore:**
   - Verify collections exist
   - Verify fields are being set
   - Check if rules allow operations

4. **Reset & debug:**
   - Clear browser cache (Ctrl+Shift+Delete)
   - Sign out and sign back in
   - Create fresh test user
   - Check both browser + Firestore

---

## Time Budget

If developer has X hours:

**2-3 hours:**
- Verify Phase 1 is working
- Read all documentation
- Understand codebase

**5-6 hours:**
- Implement email verification
- Deploy Cloud Functions
- Test parental flow

**3-4 hours:**
- Implement photo moderation
- Test with images
- Handle flagged content

**2-3 hours:**
- Create support form
- Setup admin email
- Test submissions

**1-2 hours:**
- Create data purge cron
- Fix aura privacy
- Deploy final features

**Total for launch:** 10-14 hours

---

## Success Looks Like

When Phase 2 is done:
```
✅ Teen signs up
✅ Parental email requested
✅ Email sent to parent
✅ Parent clicks link
✅ Account unlocks
✅ Teen can use app
✅ User can export data anytime
✅ User can delete account anytime
✅ Support form works
✅ Photo moderation prevents bad avatars
✅ Data auto-purges after 30 days
✅ Ready to submit to App Stores
```

---

## One-Page Summary

**Phase 1 Status:** ✅ COMPLETE (Settings, Delete, Export, Parental Email UI)
**Phase 2 Status:** ⏳ READY TO START (Email verification, Photo moderation, Support, Data purge)
**Launch Blockers:** 5 backend features (10-14 hours)
**Next Session:** Choose 1 feature from NEXT_STEPS.md and implement

---

