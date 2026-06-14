# Good Energy - Legal Requirements Implementation Roadmap

## Overview
Analysis of LEGAL.md requirements against current codebase implementation.

---

## ✅ ALREADY IMPLEMENTED

### 1. **Age Verification** ✓
- **Location**: `App.jsx` line 211-214
- **Status**: Users must be 13+, auto-calculated isTeenPool for <18
- **Code**: `if (!age || age < 13) { setError('You must be at least 13 years old') }`

### 2. **Teen Pool Segregation** ✓
- **Location**: `App.jsx` lines 186-189, 220
- **Status**: Teens only see teen pool posts, content flagged accordingly
- **Code**: `if (isTeenPool && !data.isTeenPool && data.authorId !== user.uid) { return null; }`

### 3. **Predatory Language Detection** ✓
- **Location**: `App.jsx` lines 57-82 (ModerationEngine)
- **Status**: Checks for unsafe contact attempts ("meet up", "phone number", etc.)
- **Code**: Teen violations for predatory language result in instant ban (violations: 999, aura: 'banned')

### 4. **Aura System (Violations)** ✓ (Partial)
- **Location**: `App.jsx` lines 461-471, 225
- **Status**: Blue (0 violations) → Orange (1) → Black (2+) → Banned (3+)
- **Code**: `const aura = v >= 3 ? 'black' : v === 1 ? 'orange' : 'blue';`
- **Issue**: Aura is stored but privacy enforcement needs verification

### 5. **Avatar System** ✓ (Partial)
- **Location**: `App.jsx` lines 84-105, 298-386, `AvatarCreator.jsx`
- **Status**: Emoji avatars working, photo upload working
- **Features**: 20 emojis available, photo compression to 200x200
- **Issue**: Needs photo flagging for inappropriate content (manual review)

### 6. **Moderation Enforcement** ✓ (Partial)
- **Location**: `App.jsx` lines 390-430 (ModerationEngine)
- **Status**: Content checked before posting, violations tracked
- **Penalties**:
  - Negative + Targeted language = violation
  - Teen pool predatory language = instant ban
  - 3+ violations = "Quiet Mode" (Reset game) then permanent ban

### 7. **Account Logout** ✓
- **Location**: `App.jsx` lines 288-294
- **Status**: Logout button available in feed header

### 8. **Password Security** ✓ (Delegated)
- **Location**: Firebase Auth (lines 40-52)
- **Status**: Firebase handles encryption, 6+ character minimum enforced

### 9. **Support Link** ✓ (Partial)
- **Location**: `App.jsx` lines 509-511, 780
- **Status**: Legal page accessible via header
- **Issue**: No in-app support form - only links to /legal.html

### 10. **Privacy Policy Compliance** ✓ (Partial)
- **Location**: LEGAL.md section 2
- **Status**: Policy documented but implementation needs verification:
  - Data encryption (Firestore/Firebase)
  - Automatic 30-day account purge (NOT IMPLEMENTED)
  - Data export (NOT IMPLEMENTED)

---

## 🔴 CRITICAL MISSING IMPLEMENTATIONS

### 1. **Parental Consent for Minors (REQUIRED FOR COPPA)**
- **Legal Requirement**: LEGAL.md line 179 states "under 18 must have parental consent"
- **Current Status**: ❌ NOT IMPLEMENTED
- **Priority**: CRITICAL (Legal compliance)
- **What's needed**:
  - Parental email verification screen for users <18
  - Email verification link sent to parent
  - Profile blocked until parent confirms
  - Parent email stored in database

### 2. **Photo Moderation System**
- **Legal Requirement**: Safety measures for avatar uploads, especially in Teen Pool
- **Current Status**: ⚠️ PARTIAL (Photo uploads work but no flagging system)
- **Priority**: CRITICAL
- **What's needed**:
  - Content moderation API integration (e.g., Google Vision API, AWS Rekognition)
  - Auto-flag inappropriate photos
  - Manual review queue for admins
  - Automatic photo removal

### 3. **Account Deletion & Data Purge**
- **Legal Requirement**: LEGAL.md lines 210-211: "Deleted accounts are purged within 30 days"
- **Current Status**: ❌ NOT IMPLEMENTED
- **Priority**: HIGH (Legal/Privacy requirement)
- **What's needed**:
  - Delete account button in settings
  - Soft delete: mark user as deleted, set deletion_at timestamp
  - Cron job to hard delete after 30 days
  - Delete associated posts, comments, reactions

### 4. **Data Export Feature**
- **Legal Requirement**: LEGAL.md line 115: "Right to export your content"
- **Current Status**: ❌ NOT IMPLEMENTED
- **Priority**: HIGH (GDPR/Privacy requirement)
- **What's needed**:
  - Export user data button
  - Generate JSON/CSV with:
    - Profile info
    - All posts
    - All comments
    - Avatar data
  - Email download link

### 5. **Aura Privacy Enforcement**
- **Legal Requirement**: LEGAL.md lines 129-133: "Aura status visible only to user, other users cannot see violation count"
- **Current Status**: ⚠️ STORED BUT NOT ENFORCED
- **Priority**: MEDIUM (Privacy requirement)
- **What's needed**:
  - Remove aura from user profiles sent to other users
  - Hide violation count from public view
  - Only show to self in dashboard

### 6. **Support Form (In-App)**
- **Legal Requirement**: LEGAL.md line 55: "use the in-app Support form"
- **Current Status**: ⚠️ PARTIAL (only links to legal page)
- **Priority**: MEDIUM
- **What's needed**:
  - Modal/page with support form
  - Form fields: email, subject, message, category (appeal/privacy/report)
  - Send to admin email (configure in env)
  - Confirmation message

### 7. **Quiet Mode (Reflection Space)**
- **Legal Requirement**: LEGAL.md lines 17-21: "Quiet Mode — a space for reflection"
- **Current Status**: ⚠️ PARTIAL (Reset game exists, but not tied to violations clearly)
- **Priority**: MEDIUM
- **What's needed**:
  - First violation (orange aura) → user sees notice, can access Quiet Mode
  - Quiet Mode: mini-game (tic-tac-toe exists, good!)
  - User must reset to re-engage with community
  - Clear messaging about purpose

### 8. **Account Termination Mechanism**
- **Legal Requirement**: LEGAL.md line 68: "You may delete your account at any time through settings"
- **Current Status**: ❌ NOT IMPLEMENTED
- **Priority**: CRITICAL
- **What's needed**:
  - Settings page (currently no settings view)
  - Account termination button
  - Confirmation dialog
  - Call delete account function

### 9. **Violation Appeal System**
- **Legal Requirement**: LEGAL.md line 55: "use the in-app Support form (click Support in the header)" for appeals
- **Current Status**: ❌ NOT IMPLEMENTED
- **Priority**: MEDIUM
- **What's needed**:
  - Appeal form in support modal
  - Tie to violation history
  - Send to admin for review

---

## 📊 IMPLEMENTATION PRIORITY MATRIX

### CRITICAL (Do First)
1. Parental consent for minors <18 (Legal requirement)
2. Account deletion & 30-day purge (Legal requirement)
3. Photo moderation system (Safety requirement)
4. Account settings page with delete option

### HIGH
5. Data export feature (Privacy requirement)
6. In-app support form (Required in LEGAL.md)
7. Aura privacy enforcement
8. Violation appeal system

### MEDIUM
9. Quiet Mode improvements (already exists, needs integration)
10. Better error messaging for violations

---

## 📝 NOTES FOR IMPLEMENTATION

### Firebase Limitations
- Current setup uses Firebase (which is fine)
- Need to add custom claims for admin operations
- Firestore rules must enforce privacy (only show own aura)

### Database Schema Changes Needed
```
profiles table needs:
- parental_email (for <18 users)
- parental_verified (boolean)
- parental_verified_at (timestamp)
- deleted_at (for soft delete)
- is_deleted (boolean flag)
- data_exported_at (timestamp)
- appeal_status (pending/approved/denied)
- appeal_reason (text)

New tables:
- violations (id, user_id, type, reason, created_at)
- appeals (id, user_id, violation_id, message, status, created_at)
- support_tickets (id, user_id, type, subject, message, status, created_at)
- flagged_avatars (id, user_id, flag_reason, reviewed_at, admin_id)
```

### Environment Variables Needed
```
VITE_ADMIN_EMAIL=admin@goodenergy.app
VITE_PHOTO_MODERATION_API=google_vision|aws_rekognition
VITE_MODERATION_API_KEY=xxx
```

---

## ✨ CURRENT STRENGTHS
✓ Teen pool protection is strong
✓ Predatory language detection works
✓ Aura system concept is solid
✓ Avatar system is flexible
✓ Moderation engine has good foundation

## 🎯 NEXT STEPS
1. Start with critical items (parental consent, account deletion)
2. Add settings page
3. Implement photo moderation API
4. Add support form
5. Test COPPA compliance

