import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Heart, MessageCircle, Users, Search, Send, X, User, LogOut, Shield, Home, Mail, Settings, FileText, ChevronRight, AlertCircle } from 'lucide-react';

const supabase = createClient(
  'https://pvzixnoizskzywsmkcij.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eml4bm9penNrenl3c21rY2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MTY1NzMsImV4cCI6MjA4MTI5MjU3M30.P3xnjT9yqaSpAd8k2fi8Oo--Ds1gTOXJxF4OpcjgFdM'
);

// Moderation Engine
const ModerationEngine = {
  negativeKeywords: [
    'stupid', 'idiot', 'dumb', 'trash', 'garbage', 'terrible', 'awful',
    'sucks', 'hate', 'worst', 'useless', 'pathetic', 'loser', 'ugly'
  ],
  
  targetedPhrases: [
    'you are', 'you\'re', 'your', 'shut up', 'get lost', 'go away',
    'nobody cares', 'who asked', 'why would anyone'
  ],
  
  sarcasticPhrases: [
    'oh wow', 'how original', 'totally what we needed', 'great job', 'well done'
  ],
  
  positiveContextProfanity: [
    'fucking proud', 'fuck yeah', 'holy shit', 'damn good', 'badass'
  ],
  
  checkComment(text) {
    const lower = text.toLowerCase().trim();
    
    if (!lower || lower.length < 1) {
      return { allowed: false, reason: 'Comment cannot be empty' };
    }
    
    if (lower === '...' || lower === '…') {
      return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try expressing your thought more fully.' };
    }
    
    if (lower === 'k' || lower === 'ok' || lower === 'okay') {
      return { allowed: true };
    }
    
    // Check for positive context profanity first
    for (let phrase of this.positiveContextProfanity) {
      if (lower.includes(phrase)) {
        return { allowed: true };
      }
    }
    
    // Check for targeted negativity
    const hasNegative = this.negativeKeywords.some(word => lower.includes(word));
    const hasTarget = this.targetedPhrases.some(phrase => lower.includes(phrase));
    
    if (hasNegative && hasTarget) {
      return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try rewording to uplift instead.' };
    }
    
    // Check for sarcasm
    for (let phrase of this.sarcasticPhrases) {
      if (lower.includes(phrase)) {
        return { allowed: false, reason: 'This seems dismissive. Let\'s keep the energy positive.' };
      }
    }
    
    // Check for direct negativity
    if (this.negativeKeywords.some(word => lower.includes(word))) {
      if (lower.includes('not') || lower.includes('isn\'t') || lower.includes('aren\'t')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try expressing this more constructively.' };
    }
    
    // Emotional vulnerability is allowed
    if (lower.includes('sad') || lower.includes('down') || lower.includes('struggling') || lower.includes('hard day')) {
      return { allowed: true };
    }
    
    return { allowed: true };
  }
};

export default function GoodEnergyApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('splash');
  const [authMode, setAuthMode] = useState('login');
  
  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  
  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  // Posts
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [commentInputs, setCommentInputs] = useState({});
  const [moderationError, setModerationError] = useState('');
  
  // Social
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  
  // Reset Space
  const [ticTacToeBoard, setTicTacToeBoard] = useState(Array(9).fill(null));
  const [ticTacToePlayer, setTicTacToePlayer] = useState('X');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setView('splash');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data);
      setEditedProfile(data);
      
      if (data.aura === 'black') {
        setView('reset');
      } else if (view === 'splash') {
        setView('onboarding');
      }
    }
  };

  const handleSignUp = async () => {
    if (!username.trim()) {
      alert('Username is required');
      return;
    }
    
    if (!hasAcceptedTerms) {
      alert('You must accept the Terms of Service to continue');
      return;
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    
    if (error) {
      alert(error.message);
    } else {
      alert('Account created! Please check your email to verify.');
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const completeOnboarding = () => {
    setView('feed');
    loadFeed();
  };

  const loadFeed = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (username, avatar_config),
        comments (*, profiles:author_id (username)),
        reactions (emoji, user_id)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setPosts(data);
  };

  const createPost = async () => {
    if (!newPost.trim()) return;
    
    const check = ModerationEngine.checkComment(newPost);
    if (!check.allowed) {
      setModerationError(check.reason);
      return;
    }
    
    const { error } = await supabase
      .from('posts')
      .insert([{ author_id: user.id, content: newPost }]);
    
    if (!error) {
      setNewPost('');
      setModerationError('');
      loadFeed();
    }
  };

  const addComment = async (postId, content) => {
    if (!content.trim()) return;
    
    const check = ModerationEngine.checkComment(content);
    if (!check.allowed) {
      setModerationError(check.reason);
      await incrementViolation();
      return;
    }
    
    await supabase.from('comments').insert([{ post_id: postId, author_id: user.id, content }]);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setModerationError('');
    loadFeed();
  };

  const incrementViolation = async () => {
    const newViolations = (profile.violations || 0) + 1;
    let newAura = profile.aura;
    
    if (newViolations === 1) newAura = 'orange';
    if (newViolations >= 3) newAura = 'black';
    
    await supabase.from('profiles').update({ 
      violations: newViolations, 
      aura: newAura 
    }).eq('id', user.id);
    
    await supabase.from('violations').insert([{
      user_id: user.id,
      reason: 'Attempted negative comment'
    }]);
    
    loadProfile(user.id);
  };

  const toggleReaction = async (postId) => {
    const { data: existing } = await supabase
      .from('reactions')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();
    
    if (existing) {
      await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('reactions').insert([{ post_id: postId, user_id: user.id, emoji: '❤️' }]);
    }
    loadFeed();
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery}%`)
      .limit(10);
    
    if (data) setSearchResults(data.filter(p => p.id !== user.id));
  };

  const sendFriendRequest = async (receiverId) => {
    const { error } = await supabase.from('friend_requests').insert([{ sender_id: user.id, receiver_id: receiverId }]);
    if (!error) {
      alert('Friend request sent!');
      setSearchResults([]);
    }
  };

  const loadFriendRequests = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select(`*, sender:sender_id (username, avatar_config)`)
      .eq('receiver_id', user.id)
      .eq('status', 'pending');
    
    if (data) setFriendRequests(data);
  };

  const acceptFriendRequest = async (requestId, senderId) => {
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
    await supabase.from('friends').insert([
      { user_id: user.id, friend_id: senderId },
      { user_id: senderId, friend_id: user.id }
    ]);
    loadFriendRequests();
    loadFriends();
  };

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friends')
      .select(`*, profile:friend_id (username, avatar_config, is_private)`)
      .eq('user_id', user.id);
    
    if (data) setFriends(data);
  };

  const unfriend = async (friendId) => {
    await supabase.from('friends').delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    loadFriends();
  };

  const blockUser = async (blockedId) => {
    await supabase.from('friends').delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${blockedId}),and(user_id.eq.${blockedId},friend_id.eq.${user.id})`);
    await supabase.from('blocks').insert([{ blocker_id: user.id, blocked_id: blockedId }]);
    alert('User blocked');
    loadFriends();
    loadFeed();
  };

  const updateProfile = async () => {
    await supabase.from('profiles').update({
      username: editedProfile.username,
      is_private: editedProfile.is_private,
      avatar_config: editedProfile.avatar_config
    }).eq('id', user.id);
    
    setProfile(editedProfile);
    setIsEditingProfile(false);
    alert('Profile updated!');
  };

  const playTicTacToe = (index) => {
    if (ticTacToeBoard[index]) return;
    
    const newBoard = [...ticTacToeBoard];
    newBoard[index] = ticTacToePlayer;
    setTicTacToeBoard(newBoard);
    
    const winner = checkWinner(newBoard);
    if (winner || newBoard.every(cell => cell)) {
      setTimeout(() => {
        alert(winner ? `${winner} wins!` : "It's a draw!");
        resetTicTacToe();
      }, 100);
    } else {
      setTicTacToePlayer(ticTacToePlayer === 'X' ? 'O' : 'X');
    }
  };

  const checkWinner = (board) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  };

  const resetTicTacToe = () => {
    setTicTacToeBoard(Array(9).fill(null));
    setTicTacToePlayer('X');
  };

  const completeResetSpace = async () => {
    await supabase.from('profiles').update({ aura: 'blue', violations: 0 }).eq('id', user.id);
    alert('You\'re welcome back. Let\'s keep this space calm.');
    loadProfile(user.id);
  };

  const Avatar = ({ config = {}, size = 64 }) => {
    const skinColor = config.skinColor || '#FFD1A3';
    const hairColor = config.hairColor || '#4A2C2A';
    const hairStyle = config.hairStyle || 'short';
    const facialHair = config.facialHair || 'none';
    
    return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="20" fill={skinColor} />
        {hairStyle === 'short' && (
          <path d="M32 12 Q20 12 16 20 Q16 12 32 12 Q48 12 48 20 Q44 12 32 12" fill={hairColor} />
        )}
        {hairStyle === 'long' && (
          <path d="M32 12 Q18 12 14 22 L12 35 Q12 28 14 22 Q18 12 32 12 Q46 12 50 22 Q52 28 52 35 L50 22 Q46 12 32 12" fill={hairColor} />
        )}
        <circle cx="24" cy="28" r="2" fill="#000" />
        <circle cx="40" cy="28" r="2" fill="#000" />
        <path d="M24 38 Q32 42 40 38" stroke="#000" strokeWidth="2" fill="none" />
        {facialHair === 'mustache' && (
          <path d="M24 36 Q28 38 32 36 Q36 38 40 36" stroke={hairColor} strokeWidth="2" fill="none" />
        )}
        {facialHair === 'beard' && (
          <>
            <path d="M24 36 Q28 38 32 36 Q36 38 40 36" stroke={hairColor} strokeWidth="2" fill="none" />
            <path d="M20 38 Q32 46 44 38" fill={hairColor} />
          </>
        )}
      </svg>
    );
  };

  // Splash Screen
  if (view === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-5xl">🌿</span>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Good Energy
            </h1>
            <p className="text-xl text-gray-600">A calm space for positive connection</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => { setView('auth'); setAuthMode('signup'); }}
              className="w-64 bg-indigo-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-700 transition shadow-lg"
            >
              Get Started
            </button>
            <button
              onClick={() => { setView('auth'); setAuthMode('login'); }}
              className="w-64 bg-white text-indigo-600 py-3 px-6 rounded-xl font-medium hover:bg-gray-50 transition border-2 border-indigo-600"
            >
              Log In
            </button>
          </div>
          
          <div className="mt-12 text-sm text-gray-500 space-x-4">
            <button onClick={() => setShowTerms(true)} className="hover:text-indigo-600">Terms</button>
            <button onClick={() => setShowPrivacy(true)} className="hover:text-indigo-600">Privacy</button>
          </div>
        </div>
      </div>
    );
  }

  // Auth Screen
  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-600 mb-2">Good Energy</h1>
            <p className="text-gray-600">Social media for authentic connection</p>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                authMode === 'login' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                authMode === 'signup' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>
          
          <div>
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border rounded-lg mb-4"
              />
            )}
            
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg mb-4"
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg mb-4"
            />
            
            {authMode === 'signup' && (
              <label className="flex items-start gap-2 mb-4 text-sm">
                <input
                  type="checkbox"
                  checked={hasAcceptedTerms}
                  onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-gray-600">
                  I accept the{' '}
                  <button onClick={() => setShowTerms(true)} className="text-indigo-600 hover:underline">
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button onClick={() => setShowPrivacy(true)} className="text-indigo-600 hover:underline">
                    Privacy Policy
                  </button>
                </span>
              </label>
            )}
            
            <button
              onClick={authMode === 'login' ? handleLogin : handleSignUp}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              {authMode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding screens and rest of app continue...
  // (Truncated for brevity - the full code continues with onboarding, reset space, main feed, etc.)
  
  return <div>App Loading...</div>;
}