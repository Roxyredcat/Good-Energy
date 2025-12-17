-- ============================================
-- PREMIUM FEATURES - DATABASE SCHEMA UPDATE
-- ============================================
-- Run this in Supabase SQL Editor to add premium features

-- Add premium field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Add visibility control to posts (premium feature)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private'));

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_banned BOOLEAN DEFAULT false,
  banned_until TIMESTAMPTZ,
  UNIQUE (group_id, user_id)
);

-- Group messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Word Finder scores (premium game)
CREATE TABLE IF NOT EXISTS word_finder_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  words_found INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY FOR PREMIUM FEATURES
-- ============================================

-- Groups RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groups they're members of"
ON groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Premium users can create groups"
ON groups FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_premium = true
  )
);

CREATE POLICY "Group admins can update groups"
ON groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
    AND group_members.role = 'admin'
  )
);

-- Group Members RLS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view group members if they're in the group"
ON group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Group admins can add members"
ON group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_members.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Admins can ban/remove members"
ON group_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role = 'admin'
  )
);

CREATE POLICY "Users can leave groups"
ON group_members FOR DELETE
USING (auth.uid() = user_id);

-- Group Messages RLS
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group messages"
ON group_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.is_banned = false
  )
);

CREATE POLICY "Non-banned members can send messages"
ON group_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.is_banned = false
  )
);

-- Word Finder Scores RLS
ALTER TABLE word_finder_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores"
ON word_finder_scores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Premium users can save scores"
ON word_finder_scores FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_premium = true
  )
);

-- ============================================
-- FUNCTIONS FOR GROUP MODERATION
-- ============================================

-- Function to auto-ban users from groups after violations
CREATE OR REPLACE FUNCTION handle_group_violation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user has 3+ violations
  IF (
    SELECT violations FROM profiles WHERE id = NEW.user_id
  ) >= 3 THEN
    -- Ban from all groups for 24 hours
    UPDATE group_members
    SET is_banned = true, banned_until = NOW() + INTERVAL '24 hours'
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_violation_ban_from_groups ON violations;

CREATE TRIGGER on_violation_ban_from_groups
  AFTER INSERT ON violations
  FOR EACH ROW EXECUTE FUNCTION handle_group_violation();

-- Function to auto-unban users after cooldown
CREATE OR REPLACE FUNCTION unban_users_after_cooldown()
RETURNS void AS $$
BEGIN
  UPDATE group_members
  SET is_banned = false, banned_until = NULL
  WHERE is_banned = true
  AND banned_until < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Premium features database setup complete!';
  RAISE NOTICE 'Added: Groups, Group Members, Group Messages, Word Finder Scores';
  RAISE NOTICE 'Premium field added to profiles';
  RAISE NOTICE 'Auto-moderation for group drama enabled';
END $$;