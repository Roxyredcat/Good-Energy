import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { Heart, MessageCircle, Users, Search, X, LogOut, Home, Settings, ChevronRight,
AlertCircle, Crown, Lock, Unlock, MessageSquare, Sparkles } from 'lucide-react';

// ==================== CONFIGURATION ====================
const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || 
  !import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY === '';

let supabase = null;
if (import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY && 
    import.meta.env.VITE_SUPABASE_ANON_KEY.length > 0) {
  try {
    supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  } catch (e) {
    console.debug('Supabase initialization skipped (demo mode):', e.message);
  }
}

// ==================== MODERATION ENGINE ====================
const ModerationEngine = {
  negativeKeywords: ['stupid', 'idiot', 'dumb', 'trash', 'garbage', 'terrible', 'awful', 'sucks', 'hate',
    'worst', 'useless', 'pathetic', 'loser', 'ugly'],
  targetedPhrases: ['you are', 'you\'re', 'your', 'shut up', 'get lost', 'go away', 'nobody cares', 'who asked', 'why would anyone'],
  sarcasticPhrases: ['oh wow', 'how original', 'totally what we needed', 'great job', 'well done'],
  positiveContextProfanity: ['fucking proud', 'fuck yeah', 'holy shit', 'damn good', 'badass'],
  
  checkComment(text) {
    const lower = text.toLowerCase().trim();
    if (!lower || lower.length < 1) return { allowed: false, reason: 'Comment cannot be empty' };
    if (lower === '...' || lower === '…') return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try expressing your thought more fully.' };
    if (lower === 'k' || lower === 'ok' || lower === 'okay') return { allowed: true };
    
    for (let phrase of this.positiveContextProfanity) {
      if (lower.includes(phrase)) return { allowed: true };
    }

    const hasNegative = this.negativeKeywords.some(word => lower.includes(word));
    const hasTarget = this.targetedPhrases.some(phrase => lower.includes(phrase));
    if (hasNegative && hasTarget) return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try rewording to uplift instead.' };
    
    for (let phrase of this.sarcasticPhrases) {
      if (lower.includes(phrase)) return { allowed: false, reason: 'This seems dismissive. Let\'s keep the energy positive.' };
    }
    
    if (this.negativeKeywords.some(word => lower.includes(word))) {
      if (lower.includes('not') || lower.includes('isn\'t') || lower.includes('aren\'t')) return { allowed: true };
      return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try expressing this more constructively.' };
    }
    
    if (lower.includes('sad') || lower.includes('down') || lower.includes('struggling') || lower.includes('hard day')) return { allowed: true };
    return { allowed: true };
  }
};

// ==================== PREDATORY BEHAVIOR DETECTOR ====================
const PredatoryBehaviorDetector = {
  ageQuestions: ['how old are you', 'what is your age', 'how old', 'ur age', 'your age', 'old r u', 'r u old', 'when were you born', 'what year were you born', 'birth year'],
  locationPatterns: ['where do you live', 'where are you from', 'your address', 'zip code', 'postal code', 'what city', 'what town', 'what state', 'your location', 'where u live', 'where do u live'],
  inappropriateRequests: ['send me a picture', 'send a photo', 'send pics', 'selfie please', 'show me your', 'can i see you', 'your real name', 'real identity', 'meet up', 'come over', 'home alone', 'parents away'],
  grooming: ['you mature for your age', 'so mature', 'special connection', 'keep this secret', 'don\'t tell anyone', 'just between us', 'no one would understand', 'adults don\'t get it', 'i understand you better than'],
  sexualContent: ['sex', 'naked', 'inappropriate', 'explicit', 'nsfw', 'adult content'],
  
  detectPredatoryBehavior(text) {
    if (!text) return { detected: false, severity: 'none' };
    const lower = text.toLowerCase().trim();

    const hasAgeQuestion = this.ageQuestions.some(q => lower.includes(q));
    const hasLocation = this.locationPatterns.some(p => lower.includes(p));
    const hasInappropriate = this.inappropriateRequests.some(r => lower.includes(r));
    const hasGrooming = this.grooming.some(g => lower.includes(g));
    const hasSexual = this.sexualContent.some(s => lower.includes(s));

    const severityCount = [hasAgeQuestion, hasLocation, hasInappropriate, hasGrooming, hasSexual].filter(Boolean).length;
    
    if (severityCount >= 2 || hasGrooming || hasSexual) {
      return { detected: true, severity: 'critical', reason: 'Potential predatory behavior detected. Account flagged for review.' };
    }
    if (severityCount >= 1) {
      return { detected: true, severity: 'high', reason: 'Suspicious behavior detected. Please review this interaction.' };
    }
    return { detected: false, severity: 'none' };
  }
};

// ==================== WORD FINDER GAME ====================
const WordFinderGame = ({ onClose }) => {
  const [grid, setGrid] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [foundWords, setFoundWords] = useState([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const selectedRef = useRef([]);
  useEffect(() => { selectedRef.current = selectedCells; }, [selectedCells]);
  const [targetWords, setTargetWords] = useState([]);
  const seedWords = ['CALM', 'PEACE', 'KIND', 'LOVE', 'HOPE', 'JOY', 'TRUST', 'GRACE', 'LIGHT', 'SMILE'];

  const validWords = new Set([
    'CALM', 'PEACE', 'KIND', 'LOVE', 'HOPE', 'JOY', 'TRUST', 'GRACE', 'LIGHT', 'SMILE',
    'CARE', 'SAFE', 'WARM', 'SOFT', 'GOOD', 'NICE', 'FINE', 'GLOW', 'HEAL', 'REST',
    'AND', 'THE', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS'
  ]);

  useEffect(() => { generateGrid(); }, []);

  const generateGrid = () => {
    const size = 8;
    const newGrid = Array(size).fill().map(() =>
      Array(size).fill().map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
    );
    seedWords.slice(0, 5).forEach((word) => {
      const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * (size - word.length));
      if (direction === 'horizontal') {
        for (let j = 0; j < word.length; j++) newGrid[row][col + j] = word[j];
      } else {
        for (let j = 0; j < word.length; j++) if (row + j < size) newGrid[row + j][col] = word[j];
      }
    });
    setGrid(newGrid);
    setFoundWords([]);
    setScore(0);
    setSelectedCells([]);
    setCurrentWord('');
    setMessage('Find any words! Drag across letters.');
  };

  const handleCellMouseDown = (row, col) => {
    setIsDragging(true);
    const first = [{ row, col }];
    setSelectedCells(first);
    selectedRef.current = first;
    setCurrentWord(grid[row][col]);
  };

  const handleCellMouseEnter = (row, col) => {
    if (!isDragging) return;
    const lastCells = selectedRef.current;
    const last = lastCells[lastCells.length - 1];
    if (!last) return;

    const rowDiff = Math.abs(row - last.row);
    const colDiff = Math.abs(col - last.col);
    const isAdjacent = (rowDiff <= 1 && colDiff <= 1) && !(rowDiff === 0 && colDiff === 0);
    if (isAdjacent && !lastCells.some(c => c.row === row && c.col === col)) {
      const next = [...lastCells, { row, col }];
      setSelectedCells(next);
      selectedRef.current = next;
      setCurrentWord(prev => prev + grid[row][col]);
    }
  };

  const handleCellMouseUp = () => { setIsDragging(false); checkWord(); };

  const checkWord = () => {
    const wordUpper = currentWord.trim().toUpperCase();
    if (wordUpper.length < 3) { 
      setMessage('Words must be at least 3 letters'); 
      setSelectedCells([]); 
      setCurrentWord(''); 
      return; 
    }
    if (foundWords.includes(wordUpper)) { 
      setMessage('Already found that word!'); 
      setSelectedCells([]); 
      setCurrentWord(''); 
      return; 
    }

    if (validWords.has(wordUpper)) {
      const pts = wordUpper.length * 10;
      setFoundWords(prev => [...prev, wordUpper]);
      setScore(s => s + pts);
      setMessage(`✨ Found "${wordUpper}"! +${pts} points`);
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(`"${wordUpper}" is not in the word list`);
    }
    setSelectedCells([]); 
    setCurrentWord('');
  };

  const isCellSelected = (r, c) => selectedCells.some(cell => cell.row === r && cell.col === c);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Word Finder Game</h3>
            <p className="text-sm text-gray-600">Drag across letters to form words (3+ letters)</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="bg-indigo-50 p-3 rounded-lg mb-4">
          <p className="text-center font-bold text-indigo-600 text-2xl">Score: {score}</p>
          <p className="text-center text-sm text-gray-600">Found: {foundWords.length} words</p>
          {currentWord && <p className="text-center text-lg font-bold text-blue-600 mt-2">{currentWord}</p>}
        </div>
        {message && <div className="bg-blue-100 border-l-4 border-blue-500 p-3 rounded mb-4 text-sm">{message}</div>}
        <div
          className="grid grid-cols-8 gap-1 mb-4 select-none"
          onMouseLeave={() => { if (isDragging) { setIsDragging(false); checkWord(); } }}
        >
          {grid.map((row, i) =>
            row.map((letter, j) => (
              <div
                key={`${i}-${j}`}
                onMouseDown={() => handleCellMouseDown(i, j)}
                onMouseEnter={() => handleCellMouseEnter(i, j)}
                onMouseUp={handleCellMouseUp}
                className={`aspect-square rounded flex items-center justify-center font-bold text-sm cursor-pointer transition-colors ${
                  isCellSelected(i, j) ? 'bg-indigo-600 text-white scale-110' : 'bg-blue-100 hover:bg-blue-200'
                }`}
              >
                {letter}
              </div>
            ))
          )}
        </div>
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Words Found:</p>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {foundWords.map((w, i) => (
              <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                {w} ({w.length * 10})
              </span>
            ))}
          </div>
        </div>
        <button onClick={generateGrid} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
          New Game
        </button>
      </div>
    </div>
  );
};

// ==================== AVATAR COMPONENT ====================
const Avatar = ({ config = {}, size = 64 }) => {
  const skinColor = config.skinColor || '#FFD1A3';
  const hairColor = config.hairColor || '#4A2C2A';
  const hairStyle = config.hairStyle || 'short';
  const facialHair = config.facialHair || 'none';
  
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="20" fill={skinColor} />
      {hairStyle === 'short' && <path d="M32 12 Q20 12 16 20 Q16 12 32 12 Q48 12 48 20 Q44 12 32 12" fill={hairColor} />}
      {hairStyle === 'long' && <path d="M32 12 Q18 12 14 22 L12 35 Q12 28 14 22 Q18 12 32 12 Q46 12 50 22 Q52 28 52 35 L50 22 Q46 12 32 12" fill={hairColor} />}
      <circle cx="24" cy="28" r="2" fill="#000" />
      <circle cx="40" cy="28" r="2" fill="#000" />
      <path d="M24 38 Q32 42 40 38" stroke="#000" strokeWidth="2" fill="none" />
      {facialHair === 'mustache' && <path d="M24 36 Q28 38 32 36 Q36 38 40 36" stroke={hairColor} strokeWidth="2" fill="none" />}
      {facialHair === 'beard' && (
        <>
          <path d="M24 36 Q28 38 32 36 Q36 38 40 36" stroke={hairColor} strokeWidth="2" fill="none" />
          <path d="M20 38 Q32 46 44 38" fill={hairColor} />
        </>
      )}
    </svg>
  );
};

// ==================== MAIN APP COMPONENT ====================
export default function GoodEnergyApp() {
  // Auth & User State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('splash');
  const [authMode, setAuthMode] = useState('login');
  
  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  
  // Auth Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  
  // Teen Pool
  const [isTeenPool, setIsTeenPool] = useState(false);
  const [showTeenPoolWarning, setShowTeenPoolWarning] = useState(false);
  const [hasEnteredTeenPool, setHasEnteredTeenPool] = useState(false);
  const [teenPoolBannedUsers, setTeenPoolBannedUsers] = useState(new Set());
  const [predatoryFlagged, setPredatoryFlagged] = useState(false);
  
  // Avatar
  const [showAvatarCreation, setShowAvatarCreation] = useState(false);
  const [userAvatar, setUserAvatar] = useState('');
  const [avatarType, setAvatarType] = useState('emoji');
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [selectedAvatarColor, setSelectedAvatarColor] = useState('bg-blue-500');
  const [selectedAvatarEmoji, setSelectedAvatarEmoji] = useState('😊');
  
  // Posts & Social
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [commentInputs, setCommentInputs] = useState({});
  const [moderationError, setModerationError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  
  // Premium
  const [isPremium, setIsPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showWordFinder, setShowWordFinder] = useState(false);
  
  // Groups
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [newGroupMessage, setNewGroupMessage] = useState('');
  
  // Settings & Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  
  // Reset Space (Tic-Tac-Toe)
  const [ticTacToeBoard, setTicTacToeBoard] = useState(Array(9).fill(null));
  const [ticTacToePlayer, setTicTacToePlayer] = useState('X');
  
  // Handlers
  const openTerms = () => setShowTerms(true);
  const openPrivacy = () => setShowPrivacy(true);

  const calculateAge = () => {
    if (!birthMonth || !birthDay || !birthYear) return null;
    const today = new Date();
    const birth = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSignUp = async () => {
    if (!username.trim()) { alert('Username is required'); return; }
    if (!hasAcceptedTerms) { alert('You must accept the Terms of Service'); return; }
    if (!password) { alert('Password is required'); return; }
    if (password !== confirmPassword) { alert('Passwords do not match'); return; }
    if (!birthMonth || !birthDay || !birthYear) { alert('Date of birth is required'); return; }
    
    const age = calculateAge();
    if (age < 13) { alert('You must be at least 13 years old to use Good Energy.'); return; }

    // Demo mode signup
    if (isDemoMode || !supabase) {
      console.log('Demo mode: Simulating signup for', username);
      alert('✨ Demo Account Created!\n\nUsername: ' + username + '\nAge: ' + age);
      
      const mockUser = {
        id: 'demo-' + Date.now(),
        email: email,
        user_metadata: { username, birth_date: `${birthYear}-${birthMonth}-${birthDay}`, age, is_teen_pool: age < 18 }
      };
      
      setUser(mockUser);
      setProfile({ 
        id: mockUser.id, 
        username, 
        avatar_config: null, 
        is_premium: false, 
        violations: 0, 
        aura: 'blue' 
      });
      
      if (age < 18) {
        setIsTeenPool(true);
        setView('feed');
      } else {
        setView('onboarding');
      }
      
      setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
      setBirthMonth(''); setBirthDay(''); setBirthYear('');
      setHasAcceptedTerms(false);
      setAuthMode('login');
      return;
    }

    // Real Supabase signup (production)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          birth_date: `${birthYear}-${birthMonth}-${birthDay}`,
          age,
          is_teen_pool: age < 18
        }
      }
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Account created! Please check your email to verify.');
    if (age < 18) setIsTeenPool(true);
  };

  const handleLogin = async () => {
    if (isDemoMode || !supabase) {
      alert('Demo mode: Login simulated');
      const mockUser = { id: 'demo-user', email };
      setUser(mockUser);
      setProfile({ id: mockUser.id, username: 'DemoUser', aura: 'blue', violations: 0, is_premium: false });
      setView('feed');
      return;
    }
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setView('splash');
  };

  const loadProfile = async (userId) => {
    if (!supabase) return;
    
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setEditedProfile(data);
      setIsPremium(data.is_premium || false);
    }
  };

  const loadFeed = async () => {
    if (isDemoMode || !supabase) {
      const mockPosts = [
        {
          id: 'demo-1',
          author_id: 'demo-user-1',
          content: 'Welcome to Good Energy! 🌿 This is a demo post to show you how the feed works.',
          created_at: new Date().toISOString(),
          profiles: { username: 'Demo User', avatar_config: null, is_premium: false },
          comments: [{ id: 'c1', content: 'This looks great!', profiles: { username: 'Friend' } }],
          reactions: [{ emoji: '❤', user_id: 'demo-user-2' }]
        }
      ];
      setPosts(mockPosts);
      return;
    }

    try {
      const { data } = await supabase.from('posts').select(`
        *, profiles:author_id (username, avatar_config, is_premium),
        comments (*, profiles:author_id (username)), reactions (emoji, user_id)
      `).order('created_at', { ascending: false });
      if (data) setPosts(data);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  };

  const createPost = async () => {
    if (!newPost.trim()) return;
    const check = ModerationEngine.checkComment(newPost);
    if (!check.allowed) { 
      setModerationError(check.reason); 
      return; 
    }

    if (isDemoMode || !supabase) {
      const newPostObj = {
        id: 'demo-' + Date.now(),
        author_id: user.id,
        content: newPost,
        created_at: new Date().toISOString(),
        profiles: { username: profile.username, avatar_config: null, is_premium: isPremium },
        comments: [],
        reactions: []
      };
      setPosts(prev => [newPostObj, ...prev]);
      setNewPost('');
      setModerationError('');
      return;
    }

    const { error } = await supabase.from('posts').insert([{
      author_id: user.id,
      content: newPost
    }]);
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
      return; 
    }

    if (isTeenPool) {
      const predCheck = PredatoryBehaviorDetector.detectPredatoryBehavior(content);
      if (predCheck.detected) {
        setModerationError(`🚫 ${predCheck.reason}`);
        setPredatoryFlagged(true);
        return;
      }
    }

    if (isDemoMode || !supabase) {
      const newComment = {
        id: 'c-' + Date.now(),
        content,
        profiles: { username: profile.username }
      };
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p
      ));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setModerationError('');
      return;
    }

    await supabase.from('comments').insert([{ post_id: postId, author_id: user.id, content }]);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setModerationError('');
    loadFeed();
  };

  const toggleReaction = async (postId) => {
    if (isDemoMode || !supabase) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const hasReacted = p.reactions?.some(r => r.user_id === user.id);
        const newReactions = hasReacted 
          ? p.reactions.filter(r => r.user_id !== user.id)
          : [...(p.reactions || []), { emoji: '❤', user_id: user.id }];
        return { ...p, reactions: newReactions };
      }));
      return;
    }

    const { data: existing } = await supabase.from('reactions').select('*').eq('post_id', postId).eq('user_id', user.id).single();
    if (existing) {
      await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('reactions').insert([{ post_id: postId, user_id: user.id, emoji: '❤' }]);
    }
    loadFeed();
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (isDemoMode || !supabase) {
      setSearchResults([
        { id: 'demo-search-1', username: 'CalmSeeker', is_premium: false, avatar_config: null },
        { id: 'demo-search-2', username: 'PeacefulMind', is_premium: true, avatar_config: null }
      ]);
      return;
    }
    
    const { data } = await supabase.from('profiles').select('*').ilike('username', `%${searchQuery}%`).limit(10);
    if (data) setSearchResults(data.filter(p => p.id !== user.id));
  };

  const sendFriendRequest = async (receiverId) => {
    if (isDemoMode || !supabase) {
      alert('Friend request sent! (Demo mode)');
      setSearchResults([]);
      return;
    }
    
    const { error } = await supabase.from('friend_requests').insert([{ sender_id: user.id, receiver_id: receiverId }]);
    if (!error) { alert('Friend request sent!'); setSearchResults([]); }
  };

  const upgradeToPremium = () => {
    setIsPremium(true);
    setShowPremiumModal(false);
    alert('🎉 Welcome to Premium! You now have access to Groups and Word Finder!');
  };

  const completeOnboarding = () => {
    setView('feed');
    loadFeed();
  };

  const playTicTacToe = (index) => {
    if (ticTacToeBoard[index]) return;
    const newBoard = [...ticTacToeBoard];
    newBoard[index] = ticTacToePlayer;
    setTicTacToeBoard(newBoard);
    
    // Simple win check
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    
    for (const [a, b, c] of lines) {
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        setTimeout(() => {
          alert(`${newBoard[a]} wins!`);
          setTicTacToeBoard(Array(9).fill(null));
        }, 100);
        return;
      }
    }
    
    if (newBoard.every(cell => cell)) {
      setTimeout(() => {
        alert("It's a draw!");
        setTicTacToeBoard(Array(9).fill(null));
      }, 100);
      return;
    }
    
    setTicTacToePlayer(ticTacToePlayer === 'X' ? 'O' : 'X');
  };

  const resetTicTacToe = () => {
    setTicTacToeBoard(Array(9).fill(null));
    setTicTacToePlayer('X');
  };

  const completeResetSpace = async () => {
    if (supabase) {
      await supabase.from('profiles').update({ aura: 'blue', violations: 0 }).eq('id', user.id);
    }
    alert('You\'re welcome back. Let\'s keep this space calm.');
    setView('feed');
  };

  // Initialize auth state
  useEffect(() => {
    if (isDemoMode || !supabase) return;
    
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
        setView('feed');
      } else {
        setUser(null);
        setProfile(null);
        setView('splash');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ==================== RENDER ====================
  
  // Splash Screen
  if (view === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        {isDemoMode && (
          <div className="fixed top-4 right-4 bg-yellow-100 border-l-4 border-yellow-600 px-4 py-2 rounded text-sm text-yellow-800">
            ⚡ Demo Mode: Supabase not configured
          </div>
        )}
        <div className="text-center">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-5xl">🌿</span>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">Good Energy</h1>
            <p className="text-xl text-gray-600">A calm space for positive connection</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => { setView('auth'); setAuthMode('signup'); }} className="w-64 bg-indigo-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-700 transition shadow-lg">
              Get Started
            </button>
            <button onClick={() => { setView('auth'); setAuthMode('login'); }} className="w-64 bg-white text-indigo-600 py-3 px-6 rounded-xl font-medium hover:bg-gray-50 transition border-2 border-indigo-600">
              Log In
            </button>
          </div>
          <div className="mt-12 text-sm text-gray-500 space-x-4">
            <button type="button" onClick={openTerms} className="hover:text-indigo-600">Terms</button>
            <button type="button" onClick={openPrivacy} className="hover:text-indigo-600">Privacy</button>
          </div>
        </div>
      </div>
    );
  }

  // Auth Screen
  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{authMode === 'signup' ? 'Create an account' : 'Log in'}</h2>
            <button onClick={() => setView('splash')} className="text-sm text-gray-500">Back</button>
          </div>
          <div className="space-y-3">
            {authMode === 'signup' && (
              <>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full p-3 border rounded" />
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Date of Birth</label>
                  <div className="flex gap-2">
                    <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className="flex-1 p-3 border rounded text-sm">
                      <option value="">MM</option>
                      {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className="flex-1 p-3 border rounded text-sm">
                      <option value="">DD</option>
                      {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="flex-1 p-3 border rounded text-sm">
                      <option value="">YYYY</option>
                      {Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 border rounded" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 border rounded" />
            {authMode === 'signup' && (
              <>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="w-full p-3 border rounded" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={hasAcceptedTerms} onChange={(e) => setHasAcceptedTerms(e.target.checked)} />
                  I accept the <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 underline">Terms</button>
                </label>
              </>
            )}
            {authMode === 'signup' ? (
              <button onClick={handleSignUp} className="w-full bg-indigo-600 text-white py-3 rounded">Sign Up</button>
            ) : (
              <button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-3 rounded">Log In</button>
            )}
            <div className="text-center text-sm text-gray-600">
              {authMode === 'signup' ? (
                <>Already have an account? <button onClick={() => setAuthMode('login')} className="text-indigo-600">Log in</button></>
              ) : (
                <>Need an account? <button onClick={() => setAuthMode('signup')} className="text-indigo-600">Sign up</button></>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding
  if (view === 'onboarding') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4">Welcome to Good Energy</h2>
          <div className="mb-4">
            {onboardingStep === 0 && (
              <div>
                <h3 className="font-semibold">Welcome</h3>
                <p className="text-sm text-gray-700">Welcome to Good Energy 🌿 — A calm space for positive connection. No ads. No algorithms. No drama.</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setOnboardingStep(1)} className="bg-indigo-600 text-white px-4 py-2 rounded">Continue</button>
                </div>
              </div>
            )}
            {onboardingStep === 1 && (
              <div>
                <h3 className="font-semibold">Philosophy</h3>
                <p className="text-sm text-gray-700">This Space is Different. Most platforms reward speed and outrage. We reward thoughtfulness and kindness.</p>
                <div className="mt-4 flex justify-between">
                  <button onClick={() => setOnboardingStep(0)} className="px-4 py-2 rounded border">Back</button>
                  <button onClick={() => setOnboardingStep(2)} className="bg-indigo-600 text-white px-4 py-2 rounded">I'm ready for this</button>
                </div>
              </div>
            )}
            {onboardingStep === 2 && (
              <div>
                <h3 className="font-semibold">Ready</h3>
                <p className="text-sm text-gray-700">You're All Set ✨ Remember: Words shape spaces. Kindness is noticed here.</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={completeOnboarding} className="bg-green-600 text-white px-4 py-2 rounded">Enter the Space</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Reset View (Tic-Tac-Toe)
  if (view === 'reset') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-md w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Reset Space — Tic-Tac-Toe</h2>
            <button onClick={() => setView('feed')} className="text-sm text-gray-500">Close</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {ticTacToeBoard.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => playTicTacToe(idx)}
                className={`w-full aspect-square rounded flex items-center justify-center text-2xl font-bold transition ${
                  cell ? 'bg-indigo-600 text-white' : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                {cell}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={resetTicTacToe} className="flex-1 bg-indigo-600 text-white py-2 rounded">Reset Board</button>
            <button onClick={completeResetSpace} className="flex-1 bg-green-600 text-white py-2 rounded">Complete Reset</button>
          </div>
          <p className="text-xs text-gray-500 mt-3">Play to reset your space; or click "Complete Reset" to apply the change.</p>
        </div>
      </div>
    );
  }

  // Main Feed View
  if (user && view === 'feed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-indigo-600">Good Energy</h1>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button onClick={() => { setView('feed'); loadFeed(); }} className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                  <Home className="w-5 h-5" />
                </button>
                <button onClick={() => setView('social')} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100">
                  <Users className="w-5 h-5" />
                </button>
                {isPremium && (
                  <button onClick={() => setShowWordFinder(true)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100">
                    <Sparkles className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Avatar config={profile?.avatar_config} size={40} />
                <span className="font-medium flex items-center gap-1">
                  {profile?.username}
                  {isPremium && <Crown className="w-4 h-4 text-yellow-500" />}
                </span>
                <button onClick={handleLogout} className="text-gray-600 hover:text-gray-800">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4">
          {/* Premium Banner */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 mb-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8" />
                  <div>
                    <p className="font-bold">Upgrade to Premium</p>
                    <p className="text-sm">Unlock Groups, Word Finder, and advanced features</p>
                  </div>
                </div>
                <button onClick={() => setShowPremiumModal(true)} className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                  Upgrade
                </button>
              </div>
            </div>
          )}

          {/* Create Post */}
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <textarea 
              value={newPost} 
              onChange={(e) => setNewPost(e.target.value)} 
              placeholder="Share something positive..." 
              className="w-full p-3 border rounded-lg resize-none" 
              rows="3" 
            />
            {moderationError && (
              <div className="mt-2 p-3 bg-orange-50 border-l-4 border-orange-400 rounded text-sm text-orange-800 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{moderationError}</span>
              </div>
            )}
            <button onClick={createPost} className="mt-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
              Post
            </button>
          </div>

          {/* Posts Feed */}
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Avatar config={post.profiles?.avatar_config} size={40} />
                <div>
                  <span className="font-medium flex items-center gap-1">
                    {post.profiles?.username}
                    {post.profiles?.is_premium && <Crown className="w-3 h-3 text-yellow-500" />}
                  </span>
                  <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <p className="mb-3 whitespace-pre-wrap">{post.content}</p>
              <div className="flex gap-4 mb-3 pb-3 border-b">
                <button 
                  onClick={() => toggleReaction(post.id)} 
                  className={`flex items-center gap-1 transition ${
                    post.reactions?.some(r => r.user_id === user.id) ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
                  }`}
                >
                  <Heart className="w-5 h-5" fill={post.reactions?.some(r => r.user_id === user.id) ? 'currentColor' : 'none'} />
                  <span>{post.reactions?.length || 0}</span>
                </button>
                <button className="flex items-center gap-1 text-gray-600">
                  <MessageCircle className="w-5 h-5" />
                  <span>{post.comments?.length || 0}</span>
                </button>
              </div>
              {post.comments?.map(comment => (
                <div key={comment.id} className="ml-4 mb-2 p-2 bg-gray-50 rounded">
                  <span className="font-medium text-sm">{comment.profiles?.username}: </span>
                  <span className="text-sm text-gray-700">{comment.content}</span>
                </div>
              ))}
              <input 
                type="text" 
                placeholder="Add a positive comment..." 
                value={commentInputs[post.id] || ''} 
                onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))} 
                className="w-full p-2 border rounded-lg text-sm" 
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && commentInputs[post.id]?.trim()) {
                    addComment(post.id, commentInputs[post.id]);
                  }
                }} 
              />
            </div>
          ))}
        </div>

        {/* Social View */}
        {view === 'social' && (
          <div className="fixed inset-0 bg-gray-50 z-20 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Social</h2>
                <button onClick={() => setView('feed')} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <h3 className="font-bold mb-3">Search Users</h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search by username..." 
                    className="flex-1 p-2 border rounded-lg" 
                    onKeyPress={(e) => e.key === 'Enter' && searchUsers()} 
                  />
                  <button onClick={searchUsers} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700">
                    <Search className="w-5 h-5" />
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map(result => (
                      <div key={result.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar config={result.avatar_config} size={40} />
                          <span className="flex items-center gap-1">
                            {result.username}
                            {result.is_premium && <Crown className="w-3 h-3 text-yellow-500" />}
                          </span>
                        </div>
                        <button 
                          onClick={() => sendFriendRequest(result.id)} 
                          className="bg-blue-500 text-white px-4 py-1 rounded-lg hover:bg-blue-600"
                        >
                          Add Friend
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showWordFinder && <WordFinderGame onClose={() => setShowWordFinder(false)} />}

        {showPremiumModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  Premium
                </h2>
                <button onClick={() => setShowPremiumModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-indigo-600 mt-1" />
                  <div>
                    <p className="font-medium">Group Chats</p>
                    <p className="text-sm text-gray-600">Create and join groups for open conversations</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-600 mt-1" />
                  <div>
                    <p className="font-medium">Word Finder Game</p>
                    <p className="text-sm text-gray-600">Relax with calming word puzzles</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-lg mb-4 text-center">
                <p className="text-2xl font-bold">$4.99/month</p>
                <p className="text-sm">Support Good Energy and unlock premium features</p>
              </div>
              <button onClick={upgradeToPremium} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700">
                Upgrade Now (Demo - Free)
              </button>
            </div>
          </div>
        )}

        {showSettings && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-2">
                {!isPremium && (
                  <button 
                    onClick={() => { setShowSettings(false); setShowPremiumModal(true); }} 
                    className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between bg-gradient-to-r from-yellow-50 to-orange-50"
                  >
                    <span className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium">Upgrade to Premium</span>
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                )}
                <button onClick={() => { setShowSettings(false); setShowTerms(true); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                  <span>Terms of Service</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <button onClick={() => { setShowSettings(false); setShowPrivacy(true); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                  <span>Privacy Policy</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <div className="pt-4 border-t">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Your Aura Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${profile?.aura === 'blue' ? 'bg-blue-500' : profile?.aura === 'orange' ? 'bg-orange-500' : 'bg-black'}`} />
                      <span className="font-medium capitalize">{profile?.aura}</span>
                      {isPremium && <Crown className="w-4 h-4 text-yellow-500 ml-auto" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Violations: {profile?.violations || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showTerms && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Terms of Service</h2>
                <button onClick={() => setShowTerms(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-700 mb-4">Last updated: December 15, 2025</p>
              <section className="mb-4">
                <h3 className="font-semibold">1. Acceptance</h3>
                <p className="text-sm text-gray-700">By accessing or using Good Energy you agree to these Terms. If you do not agree, do not use the service.</p>
              </section>
              <section className="mb-4">
                <h3 className="font-semibold">2. Community Guidelines</h3>
                <p className="text-sm text-gray-700">Treat others with respect. Do not post unlawful, abusive, defamatory, or harassing content. Our moderation system guides conversations toward positivity.</p>
              </section>
              <div className="mt-4 text-right">
                <button onClick={() => setShowTerms(false)} className="bg-indigo-600 text-white px-4 py-2 rounded">Close</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showPrivacy && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Privacy Policy</h2>
                <button onClick={() => setShowPrivacy(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-700 mb-4">Last Updated: December 14, 2025</p>
              <section className="mb-3">
                <h3 className="font-semibold">Our Commitment</h3>
                <p className="text-sm text-gray-700">Good Energy respects your privacy. We collect minimal data to operate the service and never sell your information.</p>
              </section>
              <section className="mb-3">
                <h3 className="font-semibold">What We Collect</h3>
                <p className="text-sm text-gray-700">Account information, content you create, and basic usage data. We do not track you across other websites.</p>
              </section>
              <div className="mt-4 text-right">
                <button onClick={() => setShowPrivacy(false)} className="bg-indigo-600 text-white px-4 py-2 rounded">Close</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>;
}


