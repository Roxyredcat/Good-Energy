import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { Heart, MessageCircle, Users, Search, Send, X, User, LogOut, Shield, Home, Mail, Settings, FileText, ChevronRight, AlertCircle } from 'lucide-react';

// YOUR ACTUAL FIREBASE CONFIG - ALREADY FILLED IN!
const firebaseConfig = {
  apiKey: "AIzaSyDTjV0dJi079nMtD73Wou87tkVFXHbbIt0",
  authDomain: "good-energy-8b1b4.firebaseapp.com",
  projectId: "good-energy-8b1b4",
  storageBucket: "good-energy-8b1b4.firebasestorage.app",
  messagingSenderId: "307590356350",
  appId: "1:307590356350:web:c2c28396ae9da84062672f",
  measurementId: "G-M74W3HFN2M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Moderation Engine (unchanged)
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadProfile(currentUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        setView('splash');
      }
    });

    return () => unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        setProfile(data);
        setEditedProfile(data);
        
        if (data.aura === 'black') {
          setView('reset');
        } else if (view === 'splash') {
          setView('onboarding');
        }
      } else {
        const defaultProfile = {
          username: user?.displayName || username,
          aura: 'blue',
          violations: 0,
          is_private: false,
          avatar_config: {},
          created_at: serverTimestamp()
        };
        await setDoc(doc(db, 'profiles', userId), defaultProfile);
        setProfile(defaultProfile);
        setEditedProfile(defaultProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
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
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username });
      
      await setDoc(doc(db, 'profiles', userCredential.user.uid), {
        username: username,
        aura: 'blue',
        violations: 0,
        is_private: false,
        avatar_config: {},
        created_at: serverTimestamp()
      });
      
      alert('Account created successfully!');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const completeOnboarding = () => {
    setView('feed');
    loadFeed();
  };

  const loadFeed = async () => {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('created_at', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      
      const postsData = await Promise.all(
        postsSnapshot.docs.map(async (postDoc) => {
          const postData = { id: postDoc.id, ...postDoc.data() };
          
          const authorDoc = await getDoc(doc(db, 'profiles', postData.author_id));
          postData.profiles = authorDoc.exists() ? authorDoc.data() : null;
          
          const commentsQuery = query(
            collection(db, 'comments'),
            where('post_id', '==', postDoc.id),
            orderBy('created_at', 'asc')
          );
          const commentsSnapshot = await getDocs(commentsQuery);
          postData.comments = await Promise.all(
            commentsSnapshot.docs.map(async (commentDoc) => {
              const commentData = { id: commentDoc.id, ...commentDoc.data() };
              const commentAuthorDoc = await getDoc(doc(db, 'profiles', commentData.author_id));
              commentData.profiles = commentAuthorDoc.exists() ? commentAuthorDoc.data() : null;
              return commentData;
            })
          );
          
          const reactionsQuery = query(
            collection(db, 'reactions'),
            where('post_id', '==', postDoc.id)
          );
          const reactionsSnapshot = await getDocs(reactionsQuery);
          postData.reactions = reactionsSnapshot.docs.map(doc => doc.data());
          
          return postData;
        })
      );
      
      setPosts(postsData);
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
    
    try {
      await addDoc(collection(db, 'posts'), {
        author_id: user.uid,
        content: newPost,
        created_at: serverTimestamp()
      });
      
      setNewPost('');
      setModerationError('');
      loadFeed();
    } catch (error) {
      console.error('Error creating post:', error);
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
    
    try {
      await addDoc(collection(db, 'comments'), {
        post_id: postId,
        author_id: user.uid,
        content: content,
        created_at: serverTimestamp()
      });
      
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setModerationError('');
      loadFeed();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const incrementViolation = async () => {
    const newViolations = (profile.violations || 0) + 1;
    let newAura = profile.aura;
    
    if (newViolations === 1) newAura = 'orange';
    if (newViolations >= 3) newAura = 'black';
    
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        violations: newViolations,
        aura: newAura
      });
      
      await addDoc(collection(db, 'violations'), {
        user_id: user.uid,
        reason: 'Attempted negative comment',
        created_at: serverTimestamp()
      });
      
      loadProfile(user.uid);
    } catch (error) {
      console.error('Error incrementing violation:', error);
    }
  };

  const toggleReaction = async (postId) => {
    try {
      const reactionsQuery = query(
        collection(db, 'reactions'),
        where('post_id', '==', postId),
        where('user_id', '==', user.uid)
      );
      const reactionsSnapshot = await getDocs(reactionsQuery);
      
      if (!reactionsSnapshot.empty) {
        await deleteDoc(reactionsSnapshot.docs[0].ref);
      } else {
        await addDoc(collection(db, 'reactions'), {
          post_id: postId,
          user_id: user.uid,
          emoji: '❤️',
          created_at: serverTimestamp()
        });
      }
      
      loadFeed();
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const profilesSnapshot = await getDocs(collection(db, 'profiles'));
      const results = profilesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(profile => 
          profile.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
          profile.id !== user.uid
        )
        .slice(0, 10);
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const sendFriendRequest = async (receiverId) => {
    try {
      await addDoc(collection(db, 'friend_requests'), {
        sender_id: user.uid,
        receiver_id: receiverId,
        status: 'pending',
        created_at: serverTimestamp()
      });
      
      alert('Friend request sent!');
      setSearchResults([]);
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const requestsQuery = query(
        collection(db, 'friend_requests'),
        where('receiver_id', '==', user.uid),
        where('status', '==', 'pending')
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      
      const requestsData = await Promise.all(
        requestsSnapshot.docs.map(async (requestDoc) => {
          const requestData = { id: requestDoc.id, ...requestDoc.data() };
          const senderDoc = await getDoc(doc(db, 'profiles', requestData.sender_id));
          requestData.sender = senderDoc.exists() ? senderDoc.data() : null;
          return requestData;
        })
      );
      
      setFriendRequests(requestsData);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const acceptFriendRequest = async (requestId, senderId) => {
    try {
      await updateDoc(doc(db, 'friend_requests', requestId), {
        status: 'accepted'
      });
      
      await addDoc(collection(db, 'friends'), {
        user_id: user.uid,
        friend_id: senderId,
        created_at: serverTimestamp()
      });
      
      await addDoc(collection(db, 'friends'), {
        user_id: senderId,
        friend_id: user.uid,
        created_at: serverTimestamp()
      });
      
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const loadFriends = async () => {
    try {
      const friendsQuery = query(
        collection(db, 'friends'),
        where('user_id', '==', user.uid)
      );
      const friendsSnapshot = await getDocs(friendsQuery);
      
      const friendsData = await Promise.all(
        friendsSnapshot.docs.map(async (friendDoc) => {
          const friendData = { id: friendDoc.id, ...friendDoc.data() };
          const profileDoc = await getDoc(doc(db, 'profiles', friendData.friend_id));
          friendData.profile = profileDoc.exists() ? profileDoc.data() : null;
          return friendData;
        })
      );
      
      setFriends(friendsData);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const unfriend = async (friendId) => {
    try {
      const friendsQuery1 = query(
        collection(db, 'friends'),
        where('user_id', '==', user.uid),
        where('friend_id', '==', friendId)
      );
      const friendsQuery2 = query(
        collection(db, 'friends'),
        where('user_id', '==', friendId),
        where('friend_id', '==', user.uid)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(friendsQuery1),
        getDocs(friendsQuery2)
      ]);
      
      await Promise.all([
        ...snapshot1.docs.map(doc => deleteDoc(doc.ref)),
        ...snapshot2.docs.map(doc => deleteDoc(doc.ref))
      ]);
      
      loadFriends();
    } catch (error) {
      console.error('Error unfriending:', error);
    }
  };

  const blockUser = async (blockedId) => {
    try {
      await unfriend(blockedId);
      
      await addDoc(collection(db, 'blocks'), {
        blocker_id: user.uid,
        blocked_id: blockedId,
        created_at: serverTimestamp()
      });
      
      alert('User blocked');
      loadFriends();
      loadFeed();
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const updateProfileData = async () => {
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        username: editedProfile.username,
        is_private: editedProfile.is_private,
        avatar_config: editedProfile.avatar_config
      });
      
      setProfile(editedProfile);
      setIsEditingProfile(false);
      alert('Profile updated!');
    } catch (error) {
      console.error('Error updating profile:', error);
    }
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
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        aura: 'blue',
        violations: 0
      });
      
      alert('You\'re welcome back. Let\'s keep this space calm.');
      loadProfile(user.uid);
    } catch (error) {
      console.error('Error completing reset:', error);
    }
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
                  className="aspect-square bg-gray-800 border-2 border-gray-700 rounded-lg text-3xl font-bold text-white hover:bg-gray-700 transition"
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
                    {post.created_at?.toDate?.()?.toLocaleDateString() || 'Just now'}
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
                            {comment.created_at?.toDate?.()?.toLocaleDateString() || 'Just now'}
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

        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-2xl font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
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

        {showTerms && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold">Terms of Service</h2>
                <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
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
                <button onClick={() => setShowPrivacy(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
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
      </div>
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
