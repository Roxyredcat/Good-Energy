import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, AlertCircle, Users, Search, Settings, Home, X, LogOut, User, Shield, FileText, ChevronRight } from 'lucide-react';

const ModerationEngine = {
  negativeKeywords: ['hate', 'stupid', 'dumb', 'idiot', 'kill yourself', 'kys', 'loser', 'pathetic', 'worthless', 'ugly', 'fat', 'disgusting', 'trash', 'garbage', 'die', 'suck', 'terrible', 'awful', 'horrible', 'worst', 'useless'],
  targetedPhrases: ['you are', 'you\'re', 'ur', 'u r'],
  sarcasticPhrases: ['oh wow', 'sure jan', 'yeah right', 'totally', 'wow so', 'much wow'],
  positiveContextProfanity: ['this is fucking awesome', 'holy shit this is amazing', 'damn this is good', 'badass', 'kick ass'],
  
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
    
    for (let phrase of this.positiveContextProfanity) {
      if (lower.includes(phrase)) {
        return { allowed: true };
      }
    }
    
    const hasNegative = this.negativeKeywords.some(word => lower.includes(word));
    const hasTarget = this.targetedPhrases.some(phrase => lower.includes(phrase));
    
    if (hasNegative && hasTarget) {
      return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try rewording to uplift instead.' };
    }
    
    for (let phrase of this.sarcasticPhrases) {
      if (lower.includes(phrase)) {
        return { allowed: false, reason: 'This seems dismissive. Let\'s keep the energy positive.' };
      }
    }
    
    if (this.negativeKeywords.some(word => lower.includes(word))) {
      if (lower.includes('not') || lower.includes('isn\'t') || lower.includes('aren\'t')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'This doesn\'t match the calm tone here. Try expressing this more constructively.' };
    }
    
    if (lower.includes('sad') || lower.includes('down') || lower.includes('struggling') || lower.includes('hard day')) {
      return { allowed: true };
    }
    
    return { allowed: true };
  }
};

export default function GoodEnergyApp() {
  const [view, setView] = useState('splash');
  const [authMode, setAuthMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [commentInputs, setCommentInputs] = useState({});
  const [moderationError, setModerationError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [ticTacToeBoard, setTicTacToeBoard] = useState(Array(9).fill(''));
  const [ticTacToePlayer, setTicTacToePlayer] = useState('X');

  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    const mockUser = { uid: 'user123', email: 'demo@example.com' };
    const mockProfile = {
      id: 'user123',
      username: 'DemoUser',
      email: 'demo@example.com',
      aura: 'blue',
      violations: 0,
      avatar_config: { skin: '#FFD7BA', hair: '#8B4513', eyes: '#4A90E2' },
      is_private: false,
      has_completed_onboarding: true
    };
    
    setUser(mockUser);
    setProfile(mockProfile);
    setEditedProfile(mockProfile);
    setView('feed');
    
    const mockPosts = [
      {
        id: '1',
        user_id: 'user123',
        content: 'Just finished a great morning walk! The weather is beautiful today. 🌞',
        created_at: new Date(),
        reactions: [],
        comments: [],
        profiles: mockProfile
      },
      {
        id: '2',
        user_id: 'user456',
        content: 'Started learning guitar today. Any tips for beginners?',
        created_at: new Date(Date.now() - 3600000),
        reactions: [{ user_id: 'user123' }],
        comments: [
          {
            id: 'c1',
            content: 'That\'s awesome! Practice regularly and be patient with yourself.',
            user_id: 'user123',
            created_at: new Date(),
            profiles: mockProfile
          }
        ],
        profiles: {
          username: 'MusicLover',
          aura: 'blue',
          avatar_config: { skin: '#F4C2A5', hair: '#2C1810', eyes: '#228B22' }
        }
      }
    ];
    
    setPosts(mockPosts);
  };

  const handleSignUp = async () => {
    if (!hasAcceptedTerms) {
      alert('Please accept the Terms of Service and Privacy Policy');
      return;
    }
    setView('onboarding');
  };

  const handleLogin = async () => {
    loadMockData();
  };

  const handleLogout = async () => {
    setUser(null);
    setProfile(null);
    setView('splash');
  };

  const completeOnboarding = () => {
    setView('feed');
  };

  const createPost = async () => {
    const check = ModerationEngine.checkComment(newPost);
    if (!check.allowed) {
      setModerationError(check.reason);
      incrementViolation();
      return;
    }
    
    setModerationError('');
    const post = {
      id: Date.now().toString(),
      user_id: user.uid,
      content: newPost,
      created_at: new Date(),
      reactions: [],
      comments: [],
      profiles: profile
    };
    setPosts([post, ...posts]);
    setNewPost('');
  };

  const addComment = async (postId, content) => {
    if (!content || !content.trim()) return;
    
    const check = ModerationEngine.checkComment(content);
    if (!check.allowed) {
      alert(check.reason);
      incrementViolation();
      return;
    }
    
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const newComment = {
          id: Date.now().toString(),
          content,
          user_id: user.uid,
          created_at: new Date(),
          profiles: profile
        };
        return { ...post, comments: [...(post.comments || []), newComment] };
      }
      return post;
    });
    
    setPosts(updatedPosts);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  const incrementViolation = async () => {
    const newViolations = profile.violations + 1;
    let newAura = profile.aura;
    
    if (newViolations >= 3) {
      newAura = 'black';
      setView('reset');
    } else if (newViolations >= 1) {
      newAura = 'orange';
    }
    
    setProfile({ ...profile, violations: newViolations, aura: newAura });
  };

  const toggleReaction = async (postId) => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const hasReacted = post.reactions?.some(r => r.user_id === user.uid);
        const newReactions = hasReacted
          ? post.reactions.filter(r => r.user_id !== user.uid)
          : [...(post.reactions || []), { user_id: user.uid }];
        return { ...post, reactions: newReactions };
      }
      return post;
    });
    setPosts(updatedPosts);
  };

  const searchUsers = async () => {
    const mockResults = [
      { id: 'user789', username: 'GoodVibes', avatar_config: { skin: '#D4A574', hair: '#FFD700', eyes: '#8B4513' } },
      { id: 'user101', username: 'PositiveMind', avatar_config: { skin: '#F5D0A9', hair: '#4B3621', eyes: '#2E8B57' } }
    ];
    setSearchResults(mockResults);
  };

  const sendFriendRequest = async (receiverId) => {
    alert('Friend request sent!');
    setSearchResults([]);
  };

  const loadFriendRequests = async () => {
    const mockRequests = [
      {
        id: 'req1',
        sender_id: 'user202',
        sender: { username: 'CoolPerson', avatar_config: { skin: '#FFE5CC', hair: '#A0522D', eyes: '#1E90FF' } }
      }
    ];
    setFriendRequests(mockRequests);
  };

  const acceptFriendRequest = async (requestId, senderId) => {
    setFriendRequests(friendRequests.filter(r => r.id !== requestId));
    loadFriends();
  };

  const loadFriends = async () => {
    const mockFriends = [
      {
        id: 'friend1',
        friend_id: 'user456',
        profile: {
          username: 'MusicLover',
          aura: 'blue',
          avatar_config: { skin: '#F4C2A5', hair: '#2C1810', eyes: '#228B22' }
        }
      }
    ];
    setFriends(mockFriends);
  };

  const unfriend = async (friendId) => {
    setFriends(friends.filter(f => f.friend_id !== friendId));
  };

  const blockUser = async (blockedId) => {
    alert('User blocked');
    setFriends(friends.filter(f => f.friend_id !== blockedId));
  };

  const updateProfileData = async () => {
    setProfile(editedProfile);
    setIsEditingProfile(false);
  };

  const playTicTacToe = (index) => {
    if (ticTacToeBoard[index] || checkWinner(ticTacToeBoard)) return;
    
    const newBoard = [...ticTacToeBoard];
    newBoard[index] = ticTacToePlayer;
    setTicTacToeBoard(newBoard);
    setTicTacToePlayer(ticTacToePlayer === 'X' ? 'O' : 'X');
  };

  const checkWinner = (board) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    
    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  const resetTicTacToe = () => {
    setTicTacToeBoard(Array(9).fill(''));
    setTicTacToePlayer('X');
  };

  const completeResetSpace = async () => {
    setProfile({ ...profile, violations: 0, aura: 'blue' });
    setView('feed');
    resetTicTacToe();
  };

  const Avatar = ({ config = {}, size = 64 }) => {
    const { skin = '#FFD7BA', hair = '#8B4513', eyes = '#4A90E2' } = config;
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill={skin} />
        <ellipse cx="35" cy="45" rx="8" ry="12" fill={eyes} />
        <ellipse cx="65" cy="45" rx="8" ry="12" fill={eyes} />
        <circle cx="35" cy="45" r="3" fill="#000" />
        <circle cx="65" cy="45" r="3" fill="#000" />
        <path d="M 30 65 Q 50 75 70 65" stroke="#FF69B4" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="50" cy="20" rx="35" ry="25" fill={hair} />
      </svg>
    );
  };

  // Splash Screen
  if (view === 'splash') {
    return (
      <>
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

        {showTerms && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold">Terms of Service</h2>
                <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg mb-2">1. Acceptable Use</h3>
                <p className="mb-4 text-gray-700">Good Energy is a positive space. Users must maintain respectful, uplifting communication.</p>
                <h3 className="font-bold text-lg mb-2">2. Moderation</h3>
                <p className="mb-4 text-gray-700">Our AI moderation system automatically filters negative content to maintain a calm environment.</p>
                <h3 className="font-bold text-lg mb-2">3. Aura System</h3>
                <p className="mb-4 text-gray-700">Violations result in aura changes (Blue → Orange → Black). Black auras require completing the Reset Space.</p>
                <h3 className="font-bold text-lg mb-2">4. Account Termination</h3>
                <p className="text-gray-700">Repeated violations or attempts to circumvent moderation may result in permanent account suspension.</p>
              </div>
            </div>
          </div>
        )}

        {showPrivacy && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold">Privacy Policy</h2>
                <button onClick={() => setShowPrivacy(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg mb-2">Data Collection</h3>
                <p className="mb-4 text-gray-700">We collect: email, username, posts, comments, and moderation data.</p>
                <h3 className="font-bold text-lg mb-2">Data Usage</h3>
                <p className="mb-4 text-gray-700">Your data powers the feed, friend connections, and moderation system.</p>
                <h3 className="font-bold text-lg mb-2">Data Sharing</h3>
                <p className="mb-4 text-gray-700">We never sell your data. Public posts are visible to other users.</p>
                <h3 className="font-bold text-lg mb-2">Your Rights</h3>
                <p className="text-gray-700">You can request data deletion or export at any time.</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Auth Screen
  if (view === 'auth') {
    return (
      <>
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

        {showTerms && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold">Terms of Service</h2>
                <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg mb-2">1. Acceptable Use</h3>
                <p className="mb-4 text-gray-700">Good Energy is a positive space. Users must maintain respectful, uplifting communication.</p>
                <h3 className="font-bold text-lg mb-2">2. Moderation</h3>
                <p className="mb-4 text-gray-700">Our AI moderation system automatically filters negative content to maintain a calm environment.</p>
                <h3 className="font-bold text-lg mb-2">3. Aura System</h3>
                <p className="mb-4 text-gray-700">Violations result in aura changes (Blue → Orange → Black). Black auras require completing the Reset Space.</p>
                <h3 className="font-bold text-lg mb-2">4. Account Termination</h3>
                <p className="text-gray-700">Repeated violations or attempts to circumvent moderation may result in permanent account suspension.</p>
              </div>
            </div>
          </div>
        )}

        {showPrivacy && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold">Privacy Policy</h2>
                <button onClick={() => setShowPrivacy(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg mb-2">Data Collection</h3>
                <p className="mb-4 text-gray-700">We collect: email, username, posts, comments, and moderation data.</p>
                <h3 className="font-bold text-lg mb-2">Data Usage</h3>
                <p className="mb-4 text-gray-700">Your data powers the feed, friend connections, and moderation system.</p>
                <h3 className="font-bold text-lg mb-2">Data Sharing</h3>
                <p className="mb-4 text-gray-700">We never sell your data. Public posts are visible to other users.</p>
                <h3 className="font-bold text-lg mb-2">Your Rights</h3>
                <p className="text-gray-700">You can request data deletion or export at any time.</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Onboarding Screen
  if (view === 'onboarding') {
    const onboardingSteps = [
      {
        title: "Welcome to Good Energy",
        description: "A calm space for authentic connection. No negativity, no toxicity - just good vibes.",
        icon: "🌿"
      },
      {
        title: "Moderation System",
        description: "Our AI protects this space. Negative comments are blocked automatically to keep things peaceful.",
        icon: "🛡️"
      },
      {
        title: "Aura System",
        description: "Start with a Blue Aura. Violations turn it Orange (warning), then Black (reset space required).",
        icon: "💙"
      },
      {
        title: "Ready to Begin",
        description: "Remember: uplift others, express yourself authentically, and keep the energy good.",
        icon: "✨"
      }
    ];

    const step = onboardingSteps[onboardingStep];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{step.icon}</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{step.title}</h2>
            <p className="text-gray-600">{step.description}</p>
          </div>

          <div className="flex gap-2 mb-6">
            {onboardingSteps.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i === onboardingStep ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-4">
            {onboardingStep > 0 && (
              <button
                onClick={() => setOnboardingStep(onboardingStep - 1)}
                className="flex-1 py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (onboardingStep < onboardingSteps.length - 1) {
                  setOnboardingStep(onboardingStep + 1);
                } else {
                  completeOnboarding();
                }
              }}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              {onboardingStep < onboardingSteps.length - 1 ? 'Next' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset Space (Black Aura)
  if (view === 'reset') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🖤</div>
          <h2 className="text-2xl font-bold text-white mb-4">Reset Space</h2>
          <p className="text-gray-300 mb-6">
            Take a moment to reflect. Play a game to clear your mind, then we'll welcome you back.
          </p>

          <div className="mb-6">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {ticTacToeBoard.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => playTicTacToe(i)}
                  className="aspect-square bg-gray-800 border-border-gray-700 rounded-lg text-3xl font-bold text-white hover:bg-gray-700 transition"
>
{cell}
</button>
))}
</div>
<button
           onClick={resetTicTacToe}
           className="text-gray-400 hover:text-white text-sm"
         >
Reset Game
</button>
</div>
      <button
        onClick={completeResetSpace}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
      >
        I'm Ready to Return
      </button>
    </div>
  </div>
);
}
// Main Feed
if (view === 'feed') {
return (
<>
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
<div className="bg-white border-b sticky top-0 z-10">
<div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
<h1 className="text-2xl font-bold text-indigo-600">Good Energy</h1>
<div className="flex items-center gap-4">
<button
onClick={() => { setView('friends'); loadFriendRequests(); loadFriends(); }}
className="relative p-2 hover:bg-gray-100 rounded-lg transition"
>
<Users className="w-6 h-6 text-gray-600" />
{friendRequests.length > 0 && (
<span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
{friendRequests.length}
</span>
)}
</button>
<button
onClick={() => setShowSettings(true)}
className="p-2 hover:bg-gray-100 rounded-lg transition"
>
<Settings className="w-6 h-6 text-gray-600" />
</button>
</div>
</div>
</div>
      {profile && (
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <Avatar config={profile.avatar_config} size={64} />
            <div className="flex-1">
              <h3 className="font-bold text-lg">{profile.username}</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {profile.aura === 'blue' && '💙'}
                  {profile.aura === 'orange' && '🧡'}
                  {profile.aura === 'black' && '🖤'}
                </span>
                <span className="text-sm text-gray-600">
                  {profile.aura === 'blue' && 'Good Standing'}
                  {profile.aura === 'orange' && 'Warning'}
                  {profile.aura === 'black' && 'Reset Required'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Share something positive..."
            className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows="3"
          />
          {moderationError && (
            <div className="mt-2 flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{moderationError}</span>
            </div>
          )}
          <button
            onClick={createPost}
            className="mt-3 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Post
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8 space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <Avatar config={post.profiles?.avatar_config} size={48} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{post.profiles?.username || 'Unknown'}</span>
                  <span className="text-xl">
                    {post.profiles?.aura === 'blue' && '💙'}
                    {post.profiles?.aura === 'orange' && '🧡'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {post.created_at?.toLocaleDateString?.() || 'Just now'}
                </p>
              </div>
            </div>

            <p className="text-gray-800 mb-4">{post.content}</p>

            <div className="flex items-center gap-4 mb-4 pt-4 border-t">
              <button
                onClick={() => toggleReaction(post.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  post.reactions?.some(r => r.user_id === user?.uid)
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart className="w-5 h-5" />
                <span>{post.reactions?.length || 0}</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                <MessageCircle className="w-5 h-5" />
                <span>{post.comments?.length || 0}</span>
              </button>
            </div>

            {post.comments?.length > 0 && (
              <div className="space-y-3 mb-4">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 bg-gray-50 p-3 rounded-lg">
                    <Avatar config={comment.profiles?.avatar_config} size={32} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{comment.profiles?.username || 'Unknown'}</span>
                        <span className="text-xs text-gray-500">
                          {comment.created_at?.toLocaleDateString?.() || 'Just now'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={commentInputs[post.id] || ''}
                onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                placeholder="Add a supportive comment..."
                className="flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => addComment(post.id, commentInputs[post.id])}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {showSettings && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-2xl font-bold">Settings</h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6" /></button>
          </div>

          <div className="p-6 space-y-6">
            {isEditingProfile ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={editedProfile.username}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editedProfile.is_private}
                      onChange={(e) => setEditedProfile({ ...editedProfile, is_private: e.target.checked })}
                    />
                    <span className="text-sm font-medium">Private Profile</span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setIsEditingProfile(false); setEditedProfile(profile); }}
                    className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateProfileData}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-600" />
                    <span>Edit Profile</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => { setShowTerms(true); setShowSettings(false); }}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <span>Terms of Service</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => { setShowPrivacy(true); setShowSettings(false); }}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <span>Privacy Policy</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Log Out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )}
  </>
);
}
// Friends View
if (view === 'friends') {
return (
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
<div className="bg-white border-b">
<div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
<button onClick={() => setView('feed')} className="p-2 hover:bg-gray-100 rounded-lg">
<Home className="w-6 h-6 text-gray-600" />
</button>
<h1 className="text-2xl font-bold text-indigo-600 flex-1">Friends</h1>
</div>
</div>
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for users..."
            className="flex-1 p-3 border rounded-lg"
          />
          <button
            onClick={searchUsers}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar config={result.avatar_config} size={40} />
                  <span className="font-medium">{result.username}</span>
                </div>
                <button
                  onClick={() => sendFriendRequest(result.id)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
                >
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {friendRequests.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Friend Requests</h3>
          <div className="space-y-3">
            {friendRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar config={request.sender?.avatar_config} size={40} />
                  <span className="font-medium">{request.sender?.username}</span>
                </div>
                <button
                  onClick={() => acceptFriendRequest(request.id, request.sender_id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Your Friends ({friends.length})</h3>
        {friends.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No friends yet. Search for users above!</p>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar config={friend.profile?.avatar_config} size={40} />
                  <div>
                    <div className="font-medium">{friend.profile?.username}</div>
                    <div className="text-sm text-gray-500">
                      {friend.profile?.aura === 'blue' && '💙 Good Standing'}
                      {friend.profile?.aura === 'orange' && '🧡 Warning'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => unfriend(friend.friend_id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Unfriend
                  </button>
                  <button
                    onClick={() => blockUser(friend.friend_id)}
                    className="text-gray-600 text-sm hover:underline"
                  >
                    Block
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);
}
return <div>Loading...</div>;
}
