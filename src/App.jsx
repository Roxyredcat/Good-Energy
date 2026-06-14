import React, { useState, useEffect } from 'react';
import AvatarCreator from './AvatarCreator.jsx';
import {
  Heart, Send, LogOut, AlertCircle, X, Settings, Download, Trash2, Bell, Shield
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, getDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, serverTimestamp, arrayUnion,
  where, getDocs
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
const storage = getStorage(app);

// Parental verification endpoint removed — minors are not permitted.

const MY_AURA_CONFIG = {
  blue:   { label: '💙 Good Energy',    ring: '#6366f1', glow: 'rgba(99,102,241,0.35)',  statusText: 'Your energy is positive ✨',                        gradient: 'from-indigo-400 to-violet-500' },
  orange: { label: '🌤 Take a Breath',  ring: '#f97316', glow: 'rgba(249,115,22,0.3)',   statusText: 'Take a moment to reflect 🌿',                        gradient: 'from-orange-400 to-amber-400' },
  black:  { label: '☁️ Quiet Mode',     ring: '#6b7280', glow: 'rgba(107,114,128,0.25)', statusText: "You're in Quiet Mode. Reflect & return 🌙",           gradient: 'from-gray-500 to-gray-700' },
  banned: { label: '⛔ Suspended',       ring: '#ef4444', glow: 'rgba(239,68,68,0.3)',    statusText: 'Account suspended for policy violations.',             gradient: 'from-red-500 to-rose-600' },
  gold:   { label: '✨ Premium',         ring: '#f59e0b', glow: 'rgba(245,158,11,0.4)',   statusText: 'Premium member — thank you! 🌟',                      gradient: 'from-yellow-400 to-amber-500' },
};

const getMyAura = (profile) => {
  if (!profile) return MY_AURA_CONFIG.blue;
  if (profile.aura === 'banned') return MY_AURA_CONFIG.banned;
  if (profile.isPremium) return MY_AURA_CONFIG.gold;
  return MY_AURA_CONFIG[profile.aura] || MY_AURA_CONFIG.blue;
};

const ModerationEngine = {
  negative: ['stupid','idiot','dumb','trash','garbage','hate','worst','loser'],
  targeted: ['you are',"you're",'your'],
  predatory: ['meet up','address','phone number','where do you','come over','alone','parents away','snap me','kik','whatsapp','private','secret','dont tell','tell no one'],
  check(text) {
    const t = text.toLowerCase().trim();
    if (!t) return { allowed: false, reason: 'Message cannot be empty' };
    if (this.predatory.some(p => t.includes(p)))
      return { allowed: false, reason: 'Potentially predatory content detected; this is not allowed.' };
    if (this.negative.some(w => t.includes(w)) && this.targeted.some(p => t.includes(p)))
      return { allowed: false, reason: 'Please keep the tone calm and constructive.' };
    return { allowed: true };
  }
};

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^[\]`]+)/gi;
const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;

function extractLinks(text) {
  const links = [];
  let match;
  const re = new RegExp(URL_REGEX.source, 'gi');
  while ((match = re.exec(text)) !== null) links.push(match[1]);
  return links;
}

function renderTextWithLinks(text) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-indigo-500 underline underline-offset-2 hover:text-indigo-700 break-all">{part}</a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function LinkPreview({ url }) {
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch) {
    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          <iframe className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen title="YouTube video" />
        </div>
      </div>
    );
  }
  if (IMAGE_EXT_REGEX.test(url)) {
    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
        <img src={url} alt="linked" className="w-full max-h-80 object-contain" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-3 flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-600 hover:bg-indigo-100 transition-colors">
      <span className="text-lg">🔗</span>
      <span className="truncate">{url}</span>
    </a>
  );
}

const Avatar = ({ config = {}, size = 48, myAuraRing = null }) => {
  const ringStyle = myAuraRing
    ? { boxShadow: `0 0 0 2.5px ${myAuraRing.ring}, 0 0 14px ${myAuraRing.glow}` }
    : {};

  const inner = (config && config.photoUrl)
    ? <img src={config.photoUrl} alt="avatar" className="rounded-full object-cover w-full h-full" />
    : (
      <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-violet-500">
        <span style={{ fontSize: size * 0.45 }}>{(config && config.emoji) || '😊'}</span>
      </div>
    );

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size, minWidth: size, minHeight: size }}>
      <div className="w-full h-full rounded-full overflow-hidden" style={ringStyle}>{inner}</div>
    </div>
  );
};

function PostMedia({ mediaUrl }) {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith('data:video') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm')) {
    return (
      <div className="mt-3 rounded-2xl overflow-hidden bg-black">
        <video src={mediaUrl} controls className="w-full max-h-80 object-contain" />
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
      <img src={mediaUrl} alt="post" className="w-full max-h-80 object-contain" />
    </div>
  );
}

export default function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [error, setError] = useState('');
  const [board, setBoard] = useState(Array(9).fill(null));
  const [player, setPlayer] = useState('X');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [wordScore, setWordScore] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showAvatarSetup, setShowAvatarSetup] = useState(false);
  // Teen pool removed; minors under 18 are not permitted.
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [chatWith, setChatWith] = useState(null);
  const [chatWithProfile, setChatWithProfile] = useState(null);
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportForm, setSupportForm] = useState({ category: 'report', subject: '', message: '' });
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [verifyTokenError, setVerifyTokenError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [expandedComments, setExpandedComments] = useState({});
  const [postComments, setPostComments] = useState({});

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null); setProfile(null); setView('splash');
        setNewPost(''); setNewPostMedia(null); return;
      }
      setUser(u);
      const snap = await getDoc(doc(db, 'profiles', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data); setIsPremium(data.isPremium || false);
        setShowAvatarSetup(false);
        setView(data.isNewUser ? 'onboarding' : 'feed');
      } else {
        setProfile(null); setShowAvatarSetup(false); setView('onboarding');
      }
    });
  }, []);

  // If the app is opened via an email verification link, automatically switch to the verify view
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userId = params.get('userId');
      const v = params.get('view');
      if (token && userId) {
        setView(v === 'verify-parent' ? 'verify-parent' : 'verify-parent');
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async snap => {
      const loaded = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.authorId));
        return { id: d.id, ...data, profiles: pSnap.exists() ? pSnap.data() : null };
      }));
      setPosts(loaded.filter(Boolean));
    });
  }, [user]);

  useEffect(() => {
    if (!user || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    const q = query(collection(db, 'messages', conversationId, 'texts'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      setMessages(prev => ({ ...prev, [conversationId]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
  }, [user, chatWith]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'inboxes', user.uid), async (snap) => {
      if (!snap.exists()) return;
      const convList = snap.data().conversations || [];
      const enriched = await Promise.all(convList.map(async (conv) => {
        const pSnap = await getDoc(doc(db, 'profiles', conv.uid));
        return { ...conv, profile: pSnap.exists() ? pSnap.data() : null };
      }));
      enriched.sort((a, b) => (b.lastMsgAt?.seconds || 0) - (a.lastMsgAt?.seconds || 0));
      setConversations(enriched);
      setTotalUnread(enriched.reduce((sum, c) => sum + (c.unread || 0), 0));
    });
  }, [user]);

  // Parental verification flow removed — platform restricted to 18+ users.

  const loadComments = (postId) => {
    if (postComments[postId] !== undefined) return;
    setPostComments(prev => ({ ...prev, [postId]: [] }));
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
    onSnapshot(q, async snap => {
      const comments = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.authorId));
        return { id: d.id, ...data, authorProfile: pSnap.exists() ? pSnap.data() : null };
      }));
      setPostComments(prev => ({ ...prev, [postId]: comments }));
    });
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    loadComments(postId);
  };

  const updateInbox = async (ownerUid, partnerUid, lastMsg, unread) => {
    const inboxRef = doc(db, 'inboxes', ownerUid);
    const snap = await getDoc(inboxRef);
    const convs = snap.exists() ? (snap.data().conversations || []) : [];
    const idx = convs.findIndex(c => c.uid === partnerUid);
    const entry = { uid: partnerUid, lastMsg, lastMsgAt: new Date(), unread };
    if (idx >= 0) convs[idx] = entry; else convs.push(entry);
    await setDoc(inboxRef, { conversations: convs }, { merge: true });
  };

  const openChat = async (profileData, uid) => {
    setChatWith(uid); setChatWithProfile(profileData);
    setSelectedProfileUser(null); setShowInbox(false); setView('chat');
    try {
      const inboxSnap = await getDoc(doc(db, 'inboxes', user.uid));
      if (inboxSnap.exists()) {
        const updated = (inboxSnap.data().conversations || []).map(c => c.uid === uid ? { ...c, unread: 0 } : c);
        await updateDoc(doc(db, 'inboxes', user.uid), { conversations: updated });
      }
    } catch (e) {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    const text = newMessage; setNewMessage('');
    try {
      await addDoc(collection(db, 'messages', conversationId, 'texts'), {
        senderId: user.uid, senderName: profile?.username || 'Unknown',
        text, createdAt: serverTimestamp()
      });
      await updateInbox(user.uid, chatWith, text, 0);
      const receiverSnap = await getDoc(doc(db, 'inboxes', chatWith));
      const receiverConvs = receiverSnap.exists() ? (receiverSnap.data().conversations || []) : [];
      const existing = receiverConvs.find(c => c.uid === user.uid);
      await updateInbox(chatWith, user.uid, text, (existing?.unread || 0) + 1);
    } catch (err) { setError('Failed to send: ' + err.message); }
  };

  const searchUsers = async (q) => {
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const snap = await getDocs(collection(db, 'profiles'));
      setSearchResults(
        snap.docs.map(d => ({ uid: d.id, ...d.data() }))
          .filter(p => p.uid !== user.uid && p.username?.toLowerCase().includes(q.toLowerCase()) && !p.isDeleted)
      );
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  const signUp = async () => {
    if (!username || !email || !password) { setError('Please fill in all fields'); return; }
    if (password !== passwordConfirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!age || parseInt(age) < 18) { setError('You must be at least 18 years old to join Good Energy'); return; }
    const ageNum = parseInt(age);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'profiles', cred.user.uid), {
        username, age: ageNum, aura: 'blue', violations: 0,
        avatar: { emoji: '😊', color: 'bg-indigo-500' },
        isPremium: false, isNewUser: true, createdAt: serverTimestamp()
      });
      setEmail(''); setPassword(''); setPasswordConfirm(''); setUsername(''); setAge(''); setError('');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email already has an account.');
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else setError(err.message);
    }
  };

  const login = async () => {
    if (!email || !password) { setError('Please fill in email and password'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail(''); setPassword(''); setPasswordConfirm(''); setError('');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found')
        setError("Email or password is incorrect.");
      else setError(err.message);
    }
  };

  const logout = async () => { try { await signOut(auth); } catch (err) { setError(err.message || 'Failed to logout'); } };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const img = new Image();
        img.onload = async () => {
            // No teen pool — allow avatar photo uploads for adult users.

            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            const maxSize = 200; let w = img.width, h = img.height;
            if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
            else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
            canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
            const photoUrl = canvas.toDataURL('image/jpeg', 0.7);
            await updateDoc(doc(db, 'profiles', user.uid), { 'avatar.photoUrl': photoUrl });
            setProfile(p => ({ ...p, avatar: { ...(p.avatar || {}), photoUrl } }));
            if (showAvatarSetup) { setShowAvatarSetup(false); setView('feed'); }
            else { setShowProfileEdit(false); }
        };
        img.src = ev.target?.result;
      };
      reader.readAsDataURL(file);
    } catch (err) { setError('Failed to save avatar: ' + err.message); }
  };

  const updateAvatar = async (emoji) => {
    const a = { emoji, color: 'bg-indigo-500' };
    await updateDoc(doc(db, 'profiles', user.uid), { avatar: a });
    setProfile(p => ({ ...p, avatar: a }));
  };

  const handleAvatarComplete = async (avatarData) => {
    try {
      if (!user) return setError('Not signed in');
      if (avatarData.type === 'emoji') {
        const a = { emoji: avatarData.emoji, color: avatarData.color || 'bg-indigo-500' };
        await updateDoc(doc(db, 'profiles', user.uid), { avatar: a });
        setProfile(p => ({ ...p, avatar: a }));
      } else if (avatarData.type === 'photo') {
        const photoUrl = avatarData.photo;
        await updateDoc(doc(db, 'profiles', user.uid), { 'avatar.photoUrl': photoUrl });
        setProfile(p => ({ ...p, avatar: { ...(p.avatar || {}), photoUrl } }));
      }
      setShowAvatarSetup(false); setView('feed'); setError('');
    } catch (err) { setError('Failed to set avatar: ' + err.message); }
  };

  const createPost = async () => {
    const check = ModerationEngine.check(newPost);
    if (!check.allowed) return setError(check.reason);
    try {
      await addDoc(collection(db, 'posts'), {
        content: newPost, mediaUrl: newPostMedia, authorId: user.uid,
        reactions: [], emojiReactions: {}, createdAt: serverTimestamp()
      });
      setNewPost(''); setNewPostMedia(null); setError('');
    } catch (err) { setError('Failed to create post: ' + err.message); }
  };

  const comment = async (postId, text) => {
    const check = ModerationEngine.check(text);
    if (!check.allowed) {
      if (check.reason && check.reason.toLowerCase().includes('predatory')) {
        await updateDoc(doc(db, 'profiles', user.uid), { violations: 999, aura: 'banned' });
        setError('Your account has been suspended for safety violations.'); return;
      }
      await violation(); return setError(check.reason);
    }
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      content: text, authorId: user.uid, createdAt: serverTimestamp()
    });
    setCommentInputs(p => ({ ...p, [postId]: '' }));
  };

  const react = async (post) => {
    const has = post.reactions.includes(user.uid);
    await updateDoc(doc(db, 'posts', post.id), {
      reactions: has ? post.reactions.filter(id => id !== user.uid) : arrayUnion(user.uid)
    });
  };

  const reactWithEmoji = async (post, emoji) => {
    const key = `${user.uid}_${emoji}`;
    if (post.emojiReactions?.[key]) {
      const updated = { ...post.emojiReactions }; delete updated[key];
      await updateDoc(doc(db, 'posts', post.id), { emojiReactions: updated });
    } else {
      await updateDoc(doc(db, 'posts', post.id), { emojiReactions: { ...post.emojiReactions, [key]: emoji } });
    }
    setShowReactionPicker(null);
  };

  const violation = async () => {
    const v = (profile.violations || 0) + 1;
    const aura = v >= 3 ? 'black' : v === 1 ? 'orange' : 'blue';
    await updateDoc(doc(db, 'profiles', user.uid), { violations: v, aura });
    setProfile(p => ({ ...p, violations: v, aura }));
    if (v >= 3) setView('reset');
  };

  const deleteAccount = async () => {
    if (!deletePassword) { setError('Please enter your password to confirm'); return; }
    try {
      setError('');
      await updateDoc(doc(db, 'profiles', user.uid), {
        isDeleted: true, deletedAt: new Date().toISOString(),
        username: '[deleted]', email: '[deleted]'
      });
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
      for (const postDoc of postsSnap.docs) await deleteDoc(doc(db, 'posts', postDoc.id));
      setShowDeleteConfirm(false); setDeletePassword(''); await logout();
    } catch (err) { setError('Failed to delete account: ' + err.message); }
  };

  const exportData = async () => {
    try {
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
      const blob = new Blob([JSON.stringify({
        profile, posts: postsSnap.docs.map(d => d.data()), exportedAt: new Date().toISOString()
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `good-energy-export-${Date.now()}.json`; link.click();
      URL.revokeObjectURL(url); setError('');
      await updateDoc(doc(db, 'profiles', user.uid), { dataExportedAt: serverTimestamp() });
    } catch (err) { setError('Failed to export data: ' + err.message); }
  };

  const submitSupportTicket = async () => {
    if (!supportForm.subject || !supportForm.message) { setError('Please fill in all fields'); return; }
    setSupportSubmitting(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: user.uid, email: user.email, ...supportForm,
        status: 'open', createdAt: serverTimestamp()
      });
      setSupportForm({ category: 'report', subject: '', message: '' });
      setSupportVisible(false); setError('');
      alert('Support ticket submitted! We will respond within 24 hours.');
    } catch (err) { setError('Failed to submit: ' + err.message); }
    finally { setSupportSubmitting(false); }
  };

  const win = b => {
    for (let [a, b2, c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])
      if (b[a] && b[a] === b[b2] && b[a] === b[c]) return b[a];
  };
  const play = i => {
    if (board[i]) return;
    const b = [...board]; b[i] = player; setBoard(b);
    if (win(b) || b.every(Boolean)) setTimeout(() => { setBoard(Array(9).fill(null)); setPlayer('X'); }, 300);
    else setPlayer(p => p === 'X' ? 'O' : 'X');
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-sm";

  if (view === 'splash') return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' }}>
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 2px), radial-gradient(circle at 75% 75%, white 2px, transparent 2px)',
        backgroundSize: '60px 60px'
      }} />
      <div className="relative z-10 text-center px-6">
        <div className="text-7xl mb-4" style={{ filter: 'drop-shadow(0 4px 24px rgba(255,255,255,0.4))' }}>🌿</div>
        <h1 className="text-6xl font-black text-white mb-3 tracking-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.2)' }}>Good Energy</h1>
        <p className="text-white/80 text-xl mb-10 font-light">A positive space for everyone ✨</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={() => { setView('signup'); setError(''); setEmail(''); setPassword(''); }}
            className="bg-white text-indigo-700 px-10 py-3.5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">Get Started</button>
          <button onClick={() => { setView('login'); setError(''); setEmail(''); setPassword(''); }}
            className="bg-white/20 backdrop-blur-sm text-white border border-white/40 px-10 py-3.5 rounded-2xl font-bold text-lg hover:bg-white/30 transition-all">Log In</button>
        </div>
        <div className="mt-10 flex gap-4 text-sm text-white/60">
          <a href="/legal.html" target="_blank" className="hover:text-white transition-colors">Terms of Service</a>
          <span>•</span>
          <a href="/legal.html" target="_blank" className="hover:text-white transition-colors">Privacy Policy</a>
        </div>
      </div>
    </div>
  );

  if (view === 'signup') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-indigo-50">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌿</div>
          <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-400 text-sm mt-1">Join the Good Energy community</p>
        </div>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className={`${inputCls} mb-3`} />
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputCls} mb-3`} />
        <div className="relative mb-3">
          <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} pr-16`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-xs text-indigo-500 font-medium">{showPassword ? 'Hide' : 'Show'}</button>
        </div>
        <div className="relative mb-3">
          <input type={showPassword ? "text" : "password"} placeholder="Confirm Password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} className={`${inputCls} pr-8`} />
          {password && passwordConfirm && <span className="absolute right-3 top-2.5 text-sm">{password === passwordConfirm ? '✅' : '❌'}</span>}
        </div>
        <input type="number" placeholder="Age" min="18" max="120" value={age} onChange={e => setAge(e.target.value)} className={`${inputCls} mb-3`} />
        {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-xl border border-red-100">{error}</div>}
        <p className="text-xs text-gray-400 mb-3 text-center">
          By signing up you agree to our{' '}
          <a href="/legal.html" target="_blank" className="text-indigo-500 underline">Terms of Service</a> and{' '}
          <a href="/legal.html" target="_blank" className="text-indigo-500 underline">Privacy Policy</a>.
        </p>
        <button onClick={signUp} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">Create Account</button>
        <button onClick={() => { setView('login'); setError(''); setPasswordConfirm(''); setUsername(''); setAge(''); }}
          className="w-full text-center text-sm text-indigo-600 hover:underline py-1">Already have an account? Log In</button>
      </div>
    </div>
  );

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-indigo-50">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌿</div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-gray-400 text-sm mt-1">Log in to Good Energy</p>
        </div>
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputCls} mb-3`} />
        <div className="relative mb-4">
          <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} className={`${inputCls} pr-16`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-xs text-indigo-500 font-medium">{showPassword ? 'Hide' : 'Show'}</button>
        </div>
        {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-xl border border-red-100">{error}</div>}
        <button onClick={login} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">Log In</button>
        <button onClick={() => { setView('signup'); setError(''); setPassword(''); setEmail(''); }}
          className="w-full text-center text-sm text-indigo-600 hover:underline py-1">Need an account? Sign Up</button>
      </div>
    </div>
  );

  if (showAvatarSetup && user && profile) {
    const myAura = getMyAura(profile);
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
          <h2 className="text-2xl font-bold mb-1">Set Your Avatar 🎨</h2>
          <p className="text-gray-400 text-sm mb-5">Choose an emoji or customize your avatar</p>
          <div className="flex justify-center mb-6">
            <Avatar config={profile?.avatar} size={96} myAuraRing={myAura} />
          </div>
          <div className="mb-4">
            <AvatarCreator onComplete={handleAvatarComplete} allowPhoto={true} />
          </div>
          <button onClick={() => { setShowAvatarSetup(false); setView('feed'); }} className="w-full bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600">Close</button>
        </div>
      </div>
    );
  }

  if (view === 'onboarding') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
        <div className="text-5xl mb-3">🌿</div>
        <h2 className="text-2xl font-bold mb-2">Welcome to Good Energy!</h2>
        <p className="text-gray-400 mb-6">Choose your experience:</p>
        <button onClick={async () => {
          try { await setDoc(doc(db, 'profiles', user.uid), { isPremium: false, isNewUser: false }, { merge: true }); setIsPremium(false); setShowAvatarSetup(true); }
          catch (err) { setError('Failed to continue. Please try again.'); }
        }} className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl mb-3 hover:bg-gray-200 transition font-medium">Continue Free</button>
        <button onClick={() => setView('premium')} className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-yellow-200">✨ Upgrade to Premium</button>
      </div>
    </div>
  );

  if (view === 'premium') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
        <div className="text-5xl mb-3">✨</div>
        <h2 className="text-2xl font-bold mb-1">Good Energy Premium</h2>
        <p className="text-gray-400 mb-5 text-sm">Unlock exclusive features</p>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 text-left space-y-2.5 text-sm">
          {['🎮 Word Finder Game', '⚡ Priority Moderation', '😍 Custom Emoji Reactions', '📊 Advanced Analytics'].map(f => (
            <div key={f} className="flex items-center gap-2 text-amber-800"><span className="text-green-500">✓</span>{f}</div>
          ))}
        </div>
        <div className="text-3xl font-black text-amber-600 mb-5">$4.99<span className="text-base font-normal text-gray-400">/month</span></div>
        <button onClick={async () => {
          try { await setDoc(doc(db, 'profiles', user.uid), { isPremium: true, isNewUser: false }, { merge: true }); setIsPremium(true); setShowAvatarSetup(true); }
          catch (err) { setError('Failed to subscribe. Please try again.'); }
        }} className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-yellow-200">Subscribe Now</button>
        <button onClick={async () => {
          try { await setDoc(doc(db, 'profiles', user.uid), { isPremium: false, isNewUser: false }, { merge: true }); setIsPremium(false); setShowAvatarSetup(true); }
          catch (err) { setError('Failed to continue.'); }
        }} className="w-full bg-gray-100 py-3 rounded-xl hover:bg-gray-200 transition text-gray-600">Skip for Now</button>
      </div>
    </div>
  );

  // Parental consent screens removed — Good Energy is for users 18 and older only.
  if (view === 'parental-pending' || view === 'verify-parent') return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-xl text-center">
        <div className="text-4xl mb-4">ℹ️</div>
        <h2 className="text-2xl font-bold mb-3">Account Not Allowed</h2>
        <p className="text-gray-500 mb-4 text-sm">Accounts for persons under 18 are not permitted on Good Energy.</p>
        <button onClick={() => setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition">Back to Home</button>
      </div>
    </div>
  );
    
  
  
  
  
          : (<><div className="text-5xl mb-4">✅</div><h2 className="text-2xl font-bold text-green-600 mb-3">Account Verified!</h2><p className="text-gray-500 mb-6">Your teen can now access Good Energy!</p><button onClick={() => setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold">Continue to App</button></>)
        }
      </div>
    </div>
  );

  if (view === 'reset') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="bg-white p-8 rounded-3xl text-center shadow-2xl max-w-sm w-full">
        <h2 className="text-xl font-bold mb-2">🧘 Take a Moment</h2>
        <p className="text-gray-400 text-sm mb-5">You've entered Quiet Mode. Play a round to reset, then return to the community.</p>
        <div className="grid grid-cols-3 gap-2 mb-5 max-w-xs mx-auto">
          {board.map((c, i) => (
            <button key={i} onClick={() => play(i)} className={`w-16 h-16 rounded-xl text-2xl font-bold transition mx-auto ${c ? 'bg-indigo-100' : 'bg-gray-100 hover:bg-gray-200'}`}>{c}</button>
          ))}
        </div>
        <button onClick={() => { updateDoc(doc(db, 'profiles', user.uid), { violations: 0, aura: 'blue' }); setView('feed'); }}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2.5 rounded-xl font-medium w-full">Return to Feed</button>
      </div>
    </div>
  );

  if (profile?.aura === 'banned') return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center border-2 border-red-200 shadow-xl">
        <div className="text-5xl mb-4">⛔</div>
        <h2 className="text-2xl font-bold text-red-600 mb-3">Account Suspended</h2>
        <p className="text-gray-600 mb-2">Your account has been suspended for violating our community safety policies.</p>
        <p className="text-gray-400 text-sm mb-4">Good Energy is committed to protecting all members, especially minors.</p>
        <p className="text-gray-400 text-sm mb-6">To appeal, please sign in and use the Support form, or contact us via the appeal process in our Terms of Service.</p>
        <button onClick={logout} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-medium hover:bg-gray-300 transition">Sign Out</button>
      </div>
    </div>
  );

  if (view === 'wordFinder') return (
    <div className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
      <div className="max-w-md mx-auto">
        <button onClick={() => setView('feed')} className="mb-4 bg-white text-indigo-600 px-4 py-2 rounded-xl shadow-sm font-medium hover:shadow-md transition">← Back</button>
        <div className="bg-white p-6 rounded-3xl shadow-xl text-center">
          <h2 className="text-3xl font-black mb-1">✨ Word Finder</h2>
          <p className="text-gray-400 text-sm mb-5">Find positive words to earn points!</p>
          <div className="grid grid-cols-4 gap-2 mb-6 bg-indigo-50 p-4 rounded-2xl">
            {['L','O','V','E','C','A','L','M','J','O','Y','S','K','I','N','D'].map((l, i) => (
              <div key={i} className="bg-white p-3 rounded-xl font-black text-lg cursor-pointer hover:bg-indigo-100 transition shadow-sm">{l}</div>
            ))}
          </div>
          <div className="text-5xl font-black text-amber-500 mb-5">{wordScore} <span className="text-xl text-gray-400">pts</span></div>
          <button onClick={() => setWordScore(wordScore + 100)} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition mb-2">+ Find Word (+100)</button>
        </div>
      </div>
    </div>
  );

  if (selectedProfileUser) {
    return (
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <button onClick={() => setSelectedProfileUser(null)} className="mb-4 bg-white text-indigo-600 px-4 py-2 rounded-xl shadow-sm font-medium hover:shadow-md transition">← Back to Feed</button>
        <div className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-indigo-400 to-violet-500 relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          <div className="px-8 pb-8 text-center -mt-12">
            <div className="flex justify-center mb-3">
              <Avatar config={selectedProfileUser.avatar} size={80} />
            </div>
            <h2 className="text-2xl font-bold mb-1">{selectedProfileUser.username}</h2>
            {selectedProfileUser.age && <p className="text-gray-400 text-sm mb-5">Age {selectedProfileUser.age}</p>}
            {selectedProfileUser.uid !== user?.uid && (
              <button onClick={() => openChat(selectedProfileUser, selectedProfileUser.uid)}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">
                💬 Send Message
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'chat' && chatWith) {
    const conversationId = [user.uid, chatWith].sort().join('_');
    const currentMessages = messages[conversationId] || [];
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
          <button onClick={() => { setChatWith(null); setChatWithProfile(null); setView('feed'); }} className="text-indigo-600 font-bold mr-2">←</button>
          {chatWithProfile && (
            <>
              <Avatar config={chatWithProfile.avatar} size={38} />
              <p className="font-bold text-sm">{chatWithProfile.username}</p>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {currentMessages.length === 0 && (
            <div className="text-center text-gray-300 mt-16"><p className="text-5xl mb-3">💬</p><p className="font-medium">No messages yet. Say hi!</p></div>
          )}
          {currentMessages.map((msg, i) => {
            const isMe = msg.senderId === user.uid;
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white' : 'bg-white text-gray-800 shadow-md'}`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-white border-t p-3 flex gap-2">
          <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..." className="flex-1 p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 text-sm" />
          <button onClick={sendMessage} className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition"><Send size={18} /></button>
        </div>
      </div>
    );
  }

  const myAura = getMyAura(profile);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 50%, #fdf4ff 100%)' }}>
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl">🌿</span>
            <h1 className="text-base font-black text-gray-900 tracking-tight">Good Energy</h1>
            {/* Teen pool removed; no under-18 accounts allowed */}
            {isPremium && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">✨ Pro</span>}
          </div>
          <div className="relative flex-1">
            <input value={searchQuery} onChange={e => searchUsers(e.target.value)}
              onFocus={() => setShowSearch(true)} onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="🔍 Search users..." className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50" />
            {showSearch && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                {searching && <div className="p-4 text-sm text-gray-400 text-center">Searching...</div>}
                {!searching && searchResults.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">No users found</div>}
                {searchResults.map(u => (
                  <button key={u.uid} onMouseDown={() => { setSelectedProfileUser(u); setSearchQuery(''); setSearchResults([]); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition">
                    <Avatar config={u.avatar || {}} size={32} />
                    <p className="font-semibold text-sm">{u.username}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 items-center flex-shrink-0">
            {isPremium && (
              <button onClick={() => setView('wordFinder')} className="text-xs bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-2.5 py-1.5 rounded-lg font-bold hover:opacity-90 transition">🎮</button>
            )}
            <div className="relative">
              <button onClick={() => setShowInbox(!showInbox)} className="relative p-2 rounded-xl hover:bg-gray-100 transition text-gray-500 hover:text-indigo-600">
                <Bell size={18} />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </button>
              {showInbox && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b flex justify-between items-center">
                    <span className="font-bold text-sm">Messages</span>
                    <button onClick={() => setShowInbox(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>
                  {conversations.length === 0
                    ? <div className="p-8 text-center text-gray-300"><div className="text-3xl mb-2">💬</div><p className="text-sm">No conversations yet</p></div>
                    : conversations.map(conv => (
                      <button key={conv.uid} onClick={() => openChat(conv.profile, conv.uid)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-b-0 transition">
                        <div className="relative flex-shrink-0">
                          <Avatar config={conv.profile?.avatar || {}} size={40} />
                          {conv.unread > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                              {conv.unread > 9 ? '9+' : conv.unread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${conv.unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{conv.profile?.username || 'Unknown'}</p>
                          <p className="text-xs text-gray-400 truncate">{conv.lastMsg}</p>
                        </div>
                        {conv.unread > 0 && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            <button onClick={() => setShowProfileEdit(true)} title="Edit Profile" className="hover:opacity-80 transition">
              <Avatar config={profile?.avatar} size={32} myAuraRing={myAura} />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"><Settings size={18} /></button>
            <button onClick={() => setSupportVisible(true)} className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition">Help</button>
            <button onClick={logout} className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-400 hover:text-red-500"><LogOut size={16} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {profile && (
          <div className="mb-4 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <Avatar config={profile.avatar} size={44} myAuraRing={myAura} />
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-900">{profile.username}</p>
              <p className="text-xs text-gray-400 mt-0.5">{myAura.statusText}</p>
            </div>
            {(profile.violations || 0) > 0 && profile.aura !== 'banned' && (
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg" title="Only visible to you">
                <Shield size={11} /> {profile.violations}/3
              </div>
            )}
            <a href="/legal.html" target="_blank" className="text-xs text-gray-300 hover:text-gray-500 transition ml-1">Legal</a>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex gap-3 mb-3">
            <Avatar config={profile?.avatar} size={40} myAuraRing={myAura} />
            <textarea value={newPost} onChange={e => setNewPost(e.target.value)}
              className="flex-1 p-3 border border-gray-200 rounded-xl resize-none bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition text-sm"
              placeholder="Share something positive... ✨" rows={2} />
          </div>
          {newPost && extractLinks(newPost).length > 0 && (
            <div className="mb-3">
              {extractLinks(newPost).map((url, i) => <LinkPreview key={i} url={url} />)}
            </div>
          )}
          <div className="flex items-center justify-between">
            <label>
              <input type="file" accept="image/*,video/*" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setNewPostMedia(ev.target?.result);
                reader.readAsDataURL(file);
              }} className="hidden" />
              <span className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg cursor-pointer text-sm hover:bg-gray-200 transition font-medium">📎 Add Media</span>
            </label>
            <button onClick={createPost} disabled={!newPost.trim() && !newPostMedia}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-1.5 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-40 text-sm shadow-md shadow-indigo-200">Post</button>
          </div>
          {newPostMedia && (
            <div className="mt-3 relative rounded-xl overflow-hidden border border-gray-100">
              {newPostMedia.startsWith('data:video')
                ? <video src={newPostMedia} controls className="w-full max-h-48 object-contain bg-black" />
                : <img src={newPostMedia} alt="preview" className="w-full max-h-48 object-contain bg-gray-50" />}
              <button onClick={() => setNewPostMedia(null)} className="absolute top-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded-lg text-xs">✕ Remove</button>
            </div>
          )}
          {error && <div className="text-red-500 text-sm flex gap-1.5 items-center mt-3 p-2 bg-red-50 rounded-xl"><AlertCircle size={14} />{error}</div>}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <div className="text-5xl mb-3">🌿</div>
            <p className="font-medium">No posts yet. Be the first to share!</p>
          </div>
        )}

        {posts.map(p => {
          const postLinks = extractLinks(p.content || '');
          const comments = postComments[p.id] || [];
          const isExpanded = expandedComments[p.id];
          return (
            <div key={p.id} className="bg-white rounded-2xl mb-3 shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-indigo-200" />
              <div className="p-4">
                <div className="flex gap-3 items-center mb-3">
                  <button onClick={() => setSelectedProfileUser({ ...p.profiles, uid: p.authorId })} className="hover:opacity-80 transition flex-shrink-0">
                    <Avatar config={p.profiles?.avatar || {}} size={42} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => setSelectedProfileUser({ ...p.profiles, uid: p.authorId })} className="font-bold text-sm hover:text-indigo-600 transition block text-left">
                      {p.profiles?.username || 'Unknown'}
                    </button>
                    {p.createdAt?.toDate && (
                      <p className="text-xs text-gray-300 mt-0.5">{p.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed mb-1">{renderTextWithLinks(p.content || '')}</p>
                {postLinks.map((url, i) => <LinkPreview key={i} url={url} />)}
                <PostMedia mediaUrl={p.mediaUrl} />
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => react(p)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${p.reactions.includes(user.uid) ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-400'}`}>
                    <Heart size={15} className={p.reactions.includes(user.uid) ? 'fill-red-500' : ''} />
                    {p.reactions.length > 0 && <span>{p.reactions.length}</span>}
                  </button>
                  <button onClick={() => setShowReactionPicker(showReactionPicker === p.id ? null : p.id)}
                    className="px-3 py-1.5 rounded-xl bg-gray-50 text-sm hover:bg-indigo-50 transition">😊</button>
                  <button onClick={() => toggleComments(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 text-sm text-gray-400 hover:bg-indigo-50 hover:text-indigo-500 transition font-medium ml-auto">
                    💬 {comments.length > 0 ? comments.length : ''} {isExpanded ? 'Hide' : 'Comment'}
                  </button>
                </div>
                {showReactionPicker === p.id && (
                  <div className="mt-3 bg-gray-50 p-3 rounded-2xl flex gap-1.5 flex-wrap border border-gray-100">
                    {['👍','❤️','😂','🔥','😍','🎉','✨','💪','🌟','🙏','😢','👏','😮','🤔','🎈','🌻','🤝','⭐'].map(emoji => (
                      <button key={emoji} onClick={() => reactWithEmoji(p, emoji)}
                        className="text-xl hover:scale-125 transition-transform p-0.5 rounded-lg">{emoji}</button>
                    ))}
                  </div>
                )}
                {Object.values(p.emojiReactions || {}).length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[...new Set(Object.values(p.emojiReactions))].map(emoji => (
                      <span key={emoji} className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg text-sm">{emoji}</span>
                    ))}
                  </div>
                )}
                {isExpanded && (
                  <div className="mt-3 border-t border-gray-50 pt-3">
                    {comments.map((c, i) => (
                      <div key={i} className="flex gap-2 mb-2.5">
                        <Avatar config={c.authorProfile?.avatar || {}} size={28} />
                        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm">
                          <span className="font-semibold text-xs text-gray-500">{c.authorProfile?.username || 'Unknown'} </span>
                          <span className="text-gray-800">{renderTextWithLinks(c.content || '')}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Avatar config={profile?.avatar} size={28} myAuraRing={myAura} />
                      <input value={commentInputs[p.id] || ''} onChange={e => setCommentInputs(v => ({ ...v, [p.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && comment(p.id, commentInputs[p.id])}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
                        placeholder="Add a comment..." />
                      <button onClick={() => comment(p.id, commentInputs[p.id])} className="text-indigo-500 hover:text-indigo-700 transition"><Send size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-80 text-center shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Edit Avatar</h3>
            <div className="flex justify-center mb-3">
              <Avatar config={profile?.avatar} size={80} myAuraRing={myAura} />
            </div>
            <div className="mb-4 p-2.5 rounded-xl text-xs font-medium bg-indigo-50 text-indigo-600">
              {myAura.label} — {myAura.statusText}
            </div>
            <div className="mb-4">
              <button onClick={() => setShowAvatarSetup(true)} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl font-bold hover:opacity-90 transition">Customize Avatar</button>
            </div>
            <button onClick={() => setShowProfileEdit(false)} className="bg-gray-100 px-4 py-2.5 rounded-xl w-full hover:bg-gray-200 transition text-gray-600">Close</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-80 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Account Settings ⚙️</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-2.5">
              <button onClick={exportData} className="w-full flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2.5 rounded-xl hover:bg-blue-100 transition font-medium text-sm">
                <Download size={16} /> Export My Data
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-2.5 rounded-xl hover:bg-red-100 transition font-medium text-sm">
                <Trash2 size={16} /> Delete Account
              </button>
              <a href="/legal.html" target="_blank" className="w-full flex items-center gap-2 bg-gray-50 border border-gray-100 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-100 transition font-medium text-sm">
                📄 Terms &amp; Privacy Policy
              </a>
              <button onClick={() => setShowSettings(false)} className="w-full bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-96 border-2 border-red-200 shadow-2xl">
            <h3 className="text-lg font-bold text-red-600 mb-3">⚠️ Delete Account</h3>
            <p className="text-gray-600 text-sm mb-1">Your account will be scheduled for deletion.</p>
            <p className="text-gray-400 text-xs mb-4">Per our <a href="/legal.html" target="_blank" className="underline text-indigo-500">Privacy Policy</a>, all data is permanently purged within <strong>30 days</strong>. Enter your password to confirm:</p>
            <input type="password" placeholder="Confirm password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className={`${inputCls} mb-4`} />
            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
            <div className="flex gap-2">
              <button onClick={deleteAccount} className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 transition font-bold text-sm">Delete Account</button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setError(''); }} className="flex-1 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {supportVisible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-96 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">💬 Support &amp; Appeals</h3>
              <button onClick={() => setSupportVisible(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
                <select value={supportForm.category} onChange={e => setSupportForm({ ...supportForm, category: e.target.value })} className={inputCls}>
                  <option value="report">Report Content</option>
                  <option value="appeal">Appeal Violation</option>
                  <option value="privacy">Privacy Concern</option>
                  <option value="bug">Report Bug</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Subject</label>
                <input type="text" value={supportForm.subject} onChange={e => setSupportForm({ ...supportForm, subject: e.target.value })} placeholder="Brief subject" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Message</label>
                <textarea value={supportForm.message} onChange={e => setSupportForm({ ...supportForm, message: e.target.value })} placeholder="Tell us what happened..." className={`${inputCls} h-24 resize-none`} />
              </div>
              {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded-xl">{error}</div>}
              <div className="flex gap-2">
                <button onClick={submitSupportTicket} disabled={supportSubmitting} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition font-medium text-sm disabled:opacity-40">
                  {supportSubmitting ? 'Sending...' : 'Submit'}
                </button>
                <button onClick={() => setSupportVisible(false)} className="flex-1 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600 text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}