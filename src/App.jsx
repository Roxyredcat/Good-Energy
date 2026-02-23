import React, { useState, useEffect } from 'react';
import {
  Heart, Send, LogOut, AlertCircle, X, Settings, Download, Trash2, Bell
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

const ModerationEngine = {
  negative: ['stupid','idiot','dumb','trash','garbage','hate','worst','loser'],
  targeted: ['you are',"you're",'your'],
  predatory: ['meet up','address','phone number','where do you','come over','alone','parents away','snap me','kik','whatsapp','private','secret','dont tell','tell no one'],
  check(text, isTeenPool=false) {
    const t = text.toLowerCase().trim();
    if (!t) return { allowed:false, reason:'Message cannot be empty' };
    if (isTeenPool && this.predatory.some(p => t.includes(p)))
      return { allowed:false, reason:'Unsafe message detected. We protect teen safety here.' };
    if (this.negative.some(w => t.includes(w)) && this.targeted.some(p => t.includes(p)))
      return { allowed:false, reason:'Please keep the tone calm and constructive.' };
    return { allowed:true };
  }
};

const Avatar = ({ config={}, size=48 }) => {
  if (config && config.photoUrl) {
    return <img src={config.photoUrl} alt="avatar" className="rounded-full object-cover flex-shrink-0"
      style={{ width:size, height:size, minWidth:size, minHeight:size }}/>;
  }
  return (
    <div className={`${(config && config.color) || 'bg-blue-500'} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ width:size, height:size, minWidth:size, minHeight:size }}>
      <span style={{ fontSize:size*0.5 }}>{(config && config.emoji) || '😊'}</span>
    </div>
  );
};

export default function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [isTeenPool, setIsTeenPool] = useState(false);
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
  const [parentalEmail, setParentalEmail] = useState('');
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

  // ── NOTIFICATIONS ──
  const [conversations, setConversations] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  /* ===== AUTH LISTENER ===== */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setProfile(null); setView('splash'); setNewPost(''); setNewPostMedia(null); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'profiles', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data); setIsPremium(data.isPremium || false); setIsTeenPool(data.isTeenPool || false); setShowAvatarSetup(false);
        setView(data.isNewUser ? 'onboarding' : 'feed');
      } else { setProfile(null); setShowAvatarSetup(false); setView('onboarding'); }
    });
  }, []);

  /* ===== POSTS LISTENER ===== */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async snap => {
      const loaded = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.authorId));
        if (isTeenPool && !data.isTeenPool && data.authorId !== user.uid) return null;
        return { id: d.id, ...data, profiles: pSnap.exists() ? pSnap.data() : null };
      }));
      setPosts(loaded.filter(Boolean));
    });
  }, [user, isTeenPool]);

  /* ===== MESSAGES LISTENER ===== */
  useEffect(() => {
    if (!user || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    const q = query(collection(db, 'messages', conversationId, 'texts'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(prev => ({ ...prev, [conversationId]: msgs }));
    });
  }, [user, chatWith]);

  /* ===== INBOX LISTENER ===== */
  useEffect(() => {
    if (!user) return;
    const inboxRef = doc(db, 'inboxes', user.uid);
    return onSnapshot(inboxRef, async (snap) => {
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

  /* ===== VERIFY PARENT ===== */
  useEffect(() => {
    if (view === 'verify-parent') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token'); const userId = params.get('userId');
      if (token && userId) {
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'profiles', userId));
            if (snap.data().parentalVerificationToken === token) {
              const expiresAt = snap.data().parentalTokenExpiresAt?.toDate?.().getTime();
              if (Date.now() > expiresAt) { setVerifyTokenError('Verification link expired.'); return; }
              await updateDoc(doc(db, 'profiles', userId), { parentalVerified: true, parentalVerifiedAt: serverTimestamp(), parentalVerificationToken: '', parentalTokenExpiresAt: null });
              setVerifyTokenError(''); setView('splash');
            } else { setVerifyTokenError('Invalid verification link'); }
          } catch (err) { setVerifyTokenError('Error: ' + err.message); }
        })();
      }
    }
  }, [view]);

  /* ===== INBOX HELPERS ===== */
  const updateInbox = async (ownerUid, partnerUid, lastMsg, unread) => {
    const inboxRef = doc(db, 'inboxes', ownerUid);
    const snap = await getDoc(inboxRef);
    const convs = snap.exists() ? (snap.data().conversations || []) : [];
    const idx = convs.findIndex(c => c.uid === partnerUid);
    const entry = { uid: partnerUid, lastMsg, lastMsgAt: new Date(), unread };
    if (idx >= 0) { convs[idx] = entry; } else { convs.push(entry); }
    await setDoc(inboxRef, { conversations: convs }, { merge: true });
  };

  const openChat = async (profileData, uid) => {
    setChatWith(uid); setChatWithProfile(profileData); setSelectedProfileUser(null); setShowInbox(false); setView('chat');
    try {
      const inboxRef = doc(db, 'inboxes', user.uid);
      const inboxSnap = await getDoc(inboxRef);
      if (inboxSnap.exists()) {
        const convs = inboxSnap.data().conversations || [];
        const updated = convs.map(c => c.uid === uid ? { ...c, unread: 0 } : c);
        await updateDoc(inboxRef, { conversations: updated });
      }
    } catch (e) { /* silent */ }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    const text = newMessage;
    setNewMessage('');
    try {
      await addDoc(collection(db, 'messages', conversationId, 'texts'), {
        senderId: user.uid, senderName: profile?.username || 'Unknown', text, createdAt: serverTimestamp()
      });
      await updateInbox(user.uid, chatWith, text, 0);
      const receiverSnap = await getDoc(doc(db, 'inboxes', chatWith));
      const receiverConvs = receiverSnap.exists() ? (receiverSnap.data().conversations || []) : [];
      const existing = receiverConvs.find(c => c.uid === user.uid);
      await updateInbox(chatWith, user.uid, text, (existing?.unread || 0) + 1);
    } catch (err) { setError('Failed to send message: ' + err.message); }
  };

  /* ===== SEARCH ===== */
  const searchUsers = async (q) => {
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const snap = await getDocs(collection(db, 'profiles'));
      setSearchResults(snap.docs.map(d => ({ uid: d.id, ...d.data() }))
        .filter(p => p.uid !== user.uid && p.username?.toLowerCase().includes(q.toLowerCase()) && !p.isDeleted));
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  /* ===== AUTH ===== */
  const signUp = async () => {
    if (!username || !email || !password) { setError('Please fill in all fields'); return; }
    if (password !== passwordConfirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!age || age < 13) { setError('You must be at least 13 years old'); return; }
    const ageNum = parseInt(age);
    if (ageNum < 18 && !parentalEmail) { setError('Users under 18 must provide a parent/guardian email'); return; }
    if (ageNum < 18 && !parentalEmail.includes('@')) { setError('Please enter a valid parent/guardian email'); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'profiles', cred.user.uid), {
        username, age: ageNum, aura: 'blue', violations: 0, avatar: { emoji: '😊', color: 'bg-blue-500' },
        isPremium: false, isTeenPool: ageNum < 18, isNewUser: true,
        parentalEmail: ageNum < 18 ? parentalEmail : null, parentalVerified: false, createdAt: serverTimestamp()
      });
      setEmail(''); setPassword(''); setPasswordConfirm(''); setUsername(''); setAge(''); setParentalEmail(''); setError('');
      if (ageNum < 18) setView('parental-pending');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email already has an account.');
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else setError(err.message);
    }
  };

  const login = async () => {
    if (!email || !password) { setError('Please fill in email and password'); return; }
    try { await signInWithEmailAndPassword(auth, email, password); setEmail(''); setPassword(''); setPasswordConfirm(''); setError(''); }
    catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') setError("Email or password is incorrect.");
      else setError(err.message);
    }
  };

  const logout = async () => { try { await signOut(auth); } catch (err) { setError(err.message || 'Failed to logout'); } };

  /* ===== PROFILE ===== */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
          const maxSize = 200; let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h *= maxSize/w; w = maxSize; } } else { if (h > maxSize) { w *= maxSize/h; h = maxSize; } }
          canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
          const photoUrl = canvas.toDataURL('image/jpeg', 0.7);
          await updateDoc(doc(db, 'profiles', user.uid), { 'avatar.photoUrl': photoUrl });
          setProfile(p => ({ ...p, avatar: { ...(p.avatar||{}), photoUrl } }));
          if (showAvatarSetup) { setShowAvatarSetup(false); setView('feed'); } else { setShowProfileEdit(false); }
        };
        img.src = ev.target?.result;
      };
      reader.readAsDataURL(file);
    } catch (err) { setError('Failed to save avatar: ' + err.message); }
  };

  const updateAvatar = async (emoji) => {
    const a = { emoji, color: 'bg-blue-500' };
    await updateDoc(doc(db, 'profiles', user.uid), { avatar: a });
    setProfile(p => ({ ...p, avatar: a }));
  };

  /* ===== POSTS ===== */
  const createPost = async () => {
    const check = ModerationEngine.check(newPost, isTeenPool);
    if (!check.allowed) return setError(check.reason);
    try {
      await addDoc(collection(db, 'posts'), { content: newPost, mediaUrl: newPostMedia, authorId: user.uid, isTeenPool, reactions: [], emojiReactions: {}, createdAt: serverTimestamp() });
      setNewPost(''); setNewPostMedia(null); setError('');
    } catch (err) { setError('Failed to create post: ' + err.message); }
  };

  const comment = async (postId, text) => {
    const check = ModerationEngine.check(text, isTeenPool);
    if (!check.allowed) {
      if (isTeenPool && check.reason.includes('Unsafe')) {
        await updateDoc(doc(db, 'profiles', user.uid), { violations: 999, aura: 'banned' });
        setError('Your account has been suspended for safety violations.'); return;
      }
      await violation(); return setError(check.reason);
    }
    await addDoc(collection(db, 'posts', postId, 'comments'), { content: text, authorId: user.uid, createdAt: serverTimestamp() });
    setCommentInputs(p => ({ ...p, [postId]: '' }));
  };

  const react = async (post) => {
    const has = post.reactions.includes(user.uid);
    await updateDoc(doc(db, 'posts', post.id), { reactions: has ? post.reactions.filter(id => id !== user.uid) : arrayUnion(user.uid) });
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
    const v = profile.violations + 1;
    const aura = v >= 3 ? 'black' : v === 1 ? 'orange' : 'blue';
    await updateDoc(doc(db, 'profiles', user.uid), { violations: v, aura });
    setProfile(p => ({ ...p, violations: v, aura }));
    if (v >= 3) setView('reset');
  };

  const deleteAccount = async () => {
    if (!deletePassword) { setError('Please enter your password to confirm'); return; }
    try {
      setError('');
      await updateDoc(doc(db, 'profiles', user.uid), { isDeleted: true, deletedAt: new Date().toISOString(), username: '[deleted]', email: '[deleted]' });
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
      for (const postDoc of postsSnap.docs) await deleteDoc(doc(db, 'posts', postDoc.id));
      setShowDeleteConfirm(false); setDeletePassword(''); await logout();
    } catch (err) { setError('Failed to delete account: ' + err.message); }
  };

  const exportData = async () => {
    try {
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
      const blob = new Blob([JSON.stringify({ profile, posts: postsSnap.docs.map(d => d.data()), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `good-energy-export-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url); setError('');
      await updateDoc(doc(db, 'profiles', user.uid), { dataExportedAt: serverTimestamp() });
    } catch (err) { setError('Failed to export data: ' + err.message); }
  };

  const submitSupportTicket = async () => {
    if (!supportForm.subject || !supportForm.message) { setError('Please fill in all fields'); return; }
    setSupportSubmitting(true);
    try {
      await addDoc(collection(db, 'support_tickets'), { userId: user.uid, email: user.email, ...supportForm, status: 'open', createdAt: serverTimestamp() });
      setSupportForm({ category: 'report', subject: '', message: '' }); setSupportVisible(false); setError('');
      alert('Support ticket submitted! We will respond within 24 hours.');
    } catch (err) { setError('Failed to submit: ' + err.message); }
    finally { setSupportSubmitting(false); }
  };

  const win = b => {
    for (let [a,b2,c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])
      if (b[a] && b[a]===b[b2] && b[a]===b[c]) return b[a];
  };

  const play = i => {
    if (board[i]) return;
    const b = [...board]; b[i] = player; setBoard(b);
    if (win(b) || b.every(Boolean)) setTimeout(() => { setBoard(Array(9).fill(null)); setPlayer('X'); }, 300);
    else setPlayer(p => p==='X' ? 'O' : 'X');
  };

  /* ================= VIEWS ================= */

  if (view === 'splash') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <h1 className="text-5xl font-bold mb-2">Good Energy 🌿</h1>
      <p className="text-gray-500 mb-8">A positive space for everyone</p>
      <div className="flex gap-4">
        <button onClick={()=>{setView('signup');setError('');setEmail('');setPassword('');}} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-700">Get Started</button>
        <button onClick={()=>{setView('login');setError('');setEmail('');setPassword('');}} className="bg-white text-indigo-600 border-2 border-indigo-600 px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-50">Log In</button>
      </div>
      <div className="mt-10 flex gap-4 text-sm text-gray-500">
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Legal</a><span>|</span>
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Privacy</a>
      </div>
    </div>
  );

  if (view === 'signup') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 shadow-lg">
        <h2 className="text-2xl font-bold mb-1">Create Account 🌿</h2>
        <p className="text-gray-500 text-sm mb-5">Join Good Energy today</p>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full mb-2 p-2 border rounded"/>
        <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full mb-2 p-2 border rounded"/>
        <div className="relative mb-2">
          <input type={showPassword?"text":"password"} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 border rounded pr-20"/>
          <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-2 text-xs text-gray-500">{showPassword?'Hide':'Show'}</button>
        </div>
        <div className="relative mb-2">
          <input type={showPassword?"text":"password"} placeholder="Confirm Password" value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)} className="w-full p-2 border rounded pr-8"/>
          {password && passwordConfirm && <span className="absolute right-2 top-2 text-sm">{password===passwordConfirm?'✅':'❌'}</span>}
        </div>
        <input type="number" placeholder="Age" min="13" max="120" value={age} onChange={e=>setAge(e.target.value)} className="w-full mb-3 p-2 border rounded"/>
        {age && parseInt(age) < 18 && (
          <div className="mb-3">
            <p className="text-xs text-orange-600 mb-1">⚠️ Users under 18 need parental consent</p>
            <input placeholder="Parent/Guardian Email" type="email" value={parentalEmail} onChange={e=>setParentalEmail(e.target.value)} className="w-full p-2 border border-orange-300 rounded"/>
          </div>
        )}
        {error && <div className="text-red-600 text-sm mb-2 p-2 bg-red-50 rounded">{error}</div>}
        <button onClick={signUp} className="w-full bg-indigo-600 text-white py-2 rounded mb-2 font-bold hover:bg-indigo-700">Create Account</button>
        <button onClick={()=>{setView('login');setError('');setPasswordConfirm('');setUsername('');setAge('');setParentalEmail('');}} className="w-full text-center text-sm text-indigo-600 hover:underline py-1">Already have an account? Log In</button>
      </div>
    </div>
  );

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 shadow-lg">
        <h2 className="text-2xl font-bold mb-1">Welcome Back 🌿</h2>
        <p className="text-gray-500 text-sm mb-6">Log in to Good Energy</p>
        <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full mb-3 p-2 border rounded"/>
        <div className="relative mb-4">
          <input type={showPassword?"text":"password"} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} className="w-full p-2 border rounded pr-16"/>
          <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-2 text-xs text-gray-500">{showPassword?'Hide':'Show'}</button>
        </div>
        {error && <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{error}</div>}
        <button onClick={login} className="w-full bg-indigo-600 text-white py-2 rounded mb-3 font-bold hover:bg-indigo-700">Log In</button>
        <button onClick={()=>{setView('signup');setError('');setPassword('');setEmail('');}} className="w-full text-center text-sm text-indigo-600 hover:underline py-1">Need an account? Sign Up</button>
      </div>
    </div>
  );

  if (showAvatarSetup && user && profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
      <div className="bg-white p-8 rounded-xl w-96 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-1">Set Your Avatar 🎨</h2>
        <p className="text-gray-500 text-sm mb-5">Upload a photo or pick an emoji</p>
        <div className="flex justify-center mb-6"><Avatar config={profile?.avatar} size={96}/></div>
        <label className="block mb-4">
          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
          <span className="bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer block hover:bg-indigo-700">📸 Upload Photo</span>
        </label>
        <p className="text-sm text-gray-500 mb-3">Or choose an emoji:</p>
        <div className="grid grid-cols-7 gap-2 mb-6">
          {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨','😇','🤝','💧','⭐','🌈','🦄','🤖','🌻','🎯','🏆'].map(emoji => (
            <button key={emoji} onClick={async()=>{
              const a={emoji,color:'bg-blue-500'}; await updateDoc(doc(db,'profiles',user.uid),{avatar:a});
              setProfile(p=>({...p,avatar:a})); setShowAvatarSetup(false); setView('feed');
            }} className="text-2xl hover:scale-125 transition-transform">{emoji}</button>
          ))}
        </div>
        <button onClick={()=>{setShowAvatarSetup(false);setView('feed');}} className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300">Skip for Now</button>
      </div>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Welcome to Good Energy! 🌿</h2>
        <p className="text-gray-500 mb-6">Choose your experience:</p>
        <button onClick={async()=>{try{await setDoc(doc(db,'profiles',user.uid),{isPremium:false,isNewUser:false},{merge:true});setIsPremium(false);setShowAvatarSetup(true);}catch(err){setError('Failed to continue.');}}}
          className="w-full bg-gray-100 text-gray-800 py-3 rounded mb-2 hover:bg-gray-200 font-medium">Continue Free</button>
        <button onClick={()=>setView('premium')} className="w-full bg-yellow-500 text-white py-3 rounded font-bold hover:bg-yellow-600">✨ Upgrade to Premium</button>
      </div>
    </div>
  );

  if (view === 'premium') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-1">✨ Good Energy Premium</h2>
        <p className="text-gray-500 mb-4 text-sm">Unlock exclusive features</p>
        <ul className="text-left mb-6 space-y-2 text-sm">
          <li>✅ Word Finder Game</li><li>✅ Priority Moderation</li><li>✅ Custom Emoji Reactions</li><li>✅ Advanced Analytics</li>
        </ul>
        <div className="text-2xl font-bold text-yellow-600 mb-4">$4.99/month</div>
        <button onClick={async()=>{try{await setDoc(doc(db,'profiles',user.uid),{isPremium:true,isNewUser:false},{merge:true});setIsPremium(true);setShowAvatarSetup(true);}catch(err){setError('Failed to subscribe.');}}}
          className="w-full bg-yellow-500 text-white py-2 rounded mb-2 font-bold hover:bg-yellow-600">Subscribe</button>
        <button onClick={async()=>{try{await setDoc(doc(db,'profiles',user.uid),{isPremium:false,isNewUser:false},{merge:true});setIsPremium(false);setShowAvatarSetup(true);}catch(err){setError('Failed to continue.');}}}
          className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300">Skip for Now</button>
      </div>
    </div>
  );

  if (view === 'parental-pending') return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-2 border-blue-500 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">⏳ Parental Consent Pending</h2>
        <p className="text-gray-600 mb-4">We sent a verification email to your parent/guardian at:</p>
        <div className="bg-blue-50 p-3 rounded mb-6 border border-blue-300"><p className="font-mono text-sm">{profile?.parentalEmail}</p></div>
        <p className="text-sm text-gray-600 mb-6">Once they verify, you will be able to access Good Energy.</p>
        <button onClick={logout} className="w-full bg-gray-400 text-white px-4 py-2 rounded font-bold hover:bg-gray-500">Sign Out</button>
      </div>
    </div>
  );

  if (view === 'verify-parent') return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-2 border-green-500 shadow-lg">
        {verifyTokenError
          ? <><h2 className="text-2xl font-bold text-red-600 mb-4">❌ Verification Failed</h2><p className="text-gray-700 mb-6">{verifyTokenError}</p><button onClick={()=>setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-2 rounded font-bold">Go Back</button></>
          : <><h2 className="text-2xl font-bold text-green-600 mb-4">✅ Account Verified!</h2><p className="text-gray-700 mb-4">Your parent has verified the account.</p><p className="text-gray-600 mb-6">Your teen can now access Good Energy!</p><button onClick={()=>setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-2 rounded font-bold">Continue to App</button></>
        }
      </div>
    </div>
  );

  if (view === 'reset') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-white p-6 rounded-xl text-center">
        <h2 className="text-xl mb-4">Reset Space</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {board.map((c,i)=>(<button key={i} onClick={()=>play(i)} className="w-16 h-16 bg-gray-200 text-2xl">{c}</button>))}
        </div>
        <button onClick={()=>{updateDoc(doc(db,'profiles',user.uid),{violations:0,aura:'blue'});setView('feed');}} className="bg-indigo-600 text-white px-4 py-2 rounded">Return</button>
      </div>
    </div>
  );

  if (profile?.aura === 'banned') return (
    <div className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-4 border-red-500 shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">⛔ Account Suspended</h2>
        <p className="text-gray-700 mb-4">Your account has been permanently suspended for violating our safety policies.</p>
        <p className="text-gray-600 text-sm mb-6">Good Energy is committed to protecting minors.</p>
        <button onClick={logout} className="bg-gray-400 text-white px-6 py-2 rounded">Sign Out</button>
      </div>
    </div>
  );

  if (view === 'wordFinder') return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={()=>setView('feed')} className="mb-4 bg-gray-300 px-4 py-2 rounded">← Back</button>
        <div className="bg-white p-6 rounded-xl text-center">
          <h2 className="text-3xl font-bold mb-4">✨ Word Finder</h2>
          <div className="grid grid-cols-4 gap-2 mb-6 bg-indigo-100 p-4 rounded">
            {['L','O','V','E','C','A','L','M','J','O','Y','S','K','I','N','D'].map((l,i)=>(
              <div key={i} className="bg-white p-3 rounded font-bold text-lg cursor-pointer hover:bg-indigo-200">{l}</div>
            ))}
          </div>
          <div className="text-4xl font-bold text-yellow-600 mb-4">Score: {wordScore}</div>
          <button onClick={()=>setWordScore(wordScore+100)} className="w-full bg-indigo-600 text-white py-3 rounded mb-2">+ Find Word</button>
        </div>
      </div>
    </div>
  );

  if (selectedProfileUser) return (
    <div className="min-h-screen bg-gray-100 p-4">
      <button onClick={()=>setSelectedProfileUser(null)} className="mb-4 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">← Back to Feed</button>
      <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="flex justify-center mb-4"><Avatar config={selectedProfileUser.avatar} size={96}/></div>
        <h2 className="text-2xl font-bold mb-1">{selectedProfileUser.username}</h2>
        {selectedProfileUser.age && <p className="text-gray-500 mb-6">Age {selectedProfileUser.age}</p>}
        {selectedProfileUser.uid !== user?.uid && (
          <button onClick={()=>openChat(selectedProfileUser, selectedProfileUser.uid)}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 text-lg">💬 Send Message</button>
        )}
      </div>
    </div>
  );

  if (view === 'chat' && chatWith) {
    const conversationId = [user.uid, chatWith].sort().join('_');
    const currentMessages = messages[conversationId] || [];
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
          <button onClick={()=>{setChatWith(null);setChatWithProfile(null);setView('feed');}} className="text-indigo-600 font-bold mr-2">← Back</button>
          {chatWithProfile && (<><Avatar config={chatWithProfile.avatar} size={36}/><span className="font-bold text-lg">{chatWithProfile.username}</span></>)}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{maxHeight:'calc(100vh - 140px)'}}>
          {currentMessages.length === 0 && (
            <div className="text-center text-gray-400 mt-10"><p className="text-4xl mb-2">💬</p><p>No messages yet. Say hi!</p></div>
          )}
          {currentMessages.map((msg,i) => {
            const isMe = msg.senderId === user.uid;
            return (
              <div key={i} className={`flex ${isMe?'justify-end':'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-2xl ${isMe?'bg-indigo-600 text-white':'bg-white text-gray-800 shadow'}`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-white border-t p-3 flex gap-2">
          <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}
            placeholder="Type a message..." className="flex-1 p-2 border rounded-xl focus:outline-none focus:border-indigo-400"/>
          <button onClick={sendMessage} className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"><Send size={18}/></button>
        </div>
      </div>
    );
  }

  /* ── FEED ── */
  return (
    <div className="min-h-screen bg-gray-100 p-4">

      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4 bg-white rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1 flex-shrink-0">
          <h1 className="text-lg font-bold">Good Energy 🌿</h1>
          <span className="text-xs text-gray-400">{isTeenPool?'🔒':isPremium?'✨':''}</span>
        </div>

        {/* SEARCH */}
        <div className="relative flex-1">
          <input value={searchQuery} onChange={e=>searchUsers(e.target.value)}
            onFocus={()=>setShowSearch(true)} onBlur={()=>setTimeout(()=>setShowSearch(false),200)}
            placeholder="🔍 Search users..." className="w-full px-3 py-1.5 border rounded-xl text-sm focus:outline-none focus:border-indigo-400"/>
          {showSearch && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
              {searching && <div className="p-3 text-sm text-gray-400 text-center">Searching...</div>}
              {!searching && searchResults.length === 0 && <div className="p-3 text-sm text-gray-400 text-center">No users found</div>}
              {searchResults.map(u => (
                <button key={u.uid} onMouseDown={()=>{setSelectedProfileUser(u);setSearchQuery('');setSearchResults([]);}}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 text-left">
                  <Avatar config={u.avatar||{}} size={32}/>
                  <span className="font-medium text-sm">{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT BUTTONS */}
        <div className="flex gap-2 items-center flex-shrink-0">
          {isPremium && (
            <button onClick={()=>setView('wordFinder')} className="text-sm bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">🎮 Game</button>
          )}

          {/* NOTIFICATION BELL */}
          <div className="relative">
            <button onClick={()=>setShowInbox(!showInbox)} className="relative text-gray-600 hover:text-indigo-600 p-1">
              <Bell size={20}/>
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </button>

            {/* INBOX DROPDOWN */}
            {showInbox && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b flex justify-between items-center">
                  <span className="font-bold text-sm">Messages</span>
                  <button onClick={()=>setShowInbox(false)}><X size={16}/></button>
                </div>
                {conversations.length === 0
                  ? <div className="p-6 text-center text-gray-400 text-sm">No conversations yet</div>
                  : conversations.map(conv => (
                    <button key={conv.uid} onClick={()=>openChat(conv.profile, conv.uid)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left border-b last:border-b-0">
                      <div className="relative flex-shrink-0">
                        <Avatar config={conv.profile?.avatar||{}} size={40}/>
                        {conv.unread > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                            {conv.unread > 9 ? '9+' : conv.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${conv.unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {conv.profile?.username || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{conv.lastMsg}</p>
                      </div>
                      {conv.unread > 0 && <span className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full"/>}
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          <button onClick={()=>setShowProfileEdit(true)} title="Edit Profile" className="hover:opacity-80">
            <Avatar config={profile?.avatar} size={32}/>
          </button>
          <button onClick={()=>setShowSettings(true)} className="text-gray-600 hover:text-gray-900"><Settings size={18}/></button>
          <button onClick={()=>setSupportVisible(true)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Support</button>
          <a href="/legal.html" target="_blank" className="text-xs text-gray-400 hover:text-gray-600">Legal</a>
          <button onClick={logout} className="text-gray-600 hover:text-red-500"><LogOut size={18}/></button>
        </div>
      </div>

      {/* MODALS */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80 text-center shadow-xl">
            <h3 className="text-lg font-bold mb-4">Edit Avatar</h3>
            <div className="flex justify-center mb-4"><Avatar config={profile?.avatar} size={80}/></div>
            <label className="block mb-4">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
              <span className="bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer block hover:bg-indigo-700">📸 Upload Photo</span>
            </label>
            <p className="text-sm text-gray-500 mb-3">Or choose emoji:</p>
            <div className="grid grid-cols-6 gap-2 mb-4">
              {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨'].map(emoji=>(
                <button key={emoji} onClick={()=>updateAvatar(emoji)} className="text-2xl hover:scale-125 transition-transform">{emoji}</button>
              ))}
            </div>
            <button onClick={()=>setShowProfileEdit(false)} className="bg-gray-200 px-4 py-2 rounded w-full hover:bg-gray-300">Close</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Account Settings ⚙️</h3>
              <button onClick={()=>setShowSettings(false)}><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <button onClick={exportData} className="w-full flex items-center gap-2 bg-blue-50 border border-blue-300 text-blue-700 px-4 py-2 rounded hover:bg-blue-100"><Download size={18}/> Export My Data</button>
              <button onClick={()=>setShowDeleteConfirm(true)} className="w-full flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded hover:bg-red-100"><Trash2 size={18}/> Delete Account</button>
              <button onClick={()=>setShowSettings(false)} className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 border-2 border-red-500 shadow-xl">
            <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ Delete Account</h3>
            <p className="text-gray-700 mb-4">All your data will be deleted. Enter your password to confirm:</p>
            <input type="password" placeholder="Confirm password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} className="w-full p-2 border rounded mb-4"/>
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="flex gap-2">
              <button onClick={deleteAccount} className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-bold">Delete</button>
              <button onClick={()=>{setShowDeleteConfirm(false);setDeletePassword('');setError('');}} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {supportVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">💬 Support & Appeals</h3>
              <button onClick={()=>setSupportVisible(false)}><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold">Category</label>
                <select value={supportForm.category} onChange={e=>setSupportForm({...supportForm,category:e.target.value})} className="w-full p-2 border rounded">
                  <option value="report">Report Content</option><option value="appeal">Appeal Violation</option>
                  <option value="privacy">Privacy Concern</option><option value="bug">Report Bug</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold">Subject</label>
                <input type="text" value={supportForm.subject} onChange={e=>setSupportForm({...supportForm,subject:e.target.value})} placeholder="Brief subject" className="w-full p-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm font-bold">Message</label>
                <textarea value={supportForm.message} onChange={e=>setSupportForm({...supportForm,message:e.target.value})} placeholder="Tell us what happened..." className="w-full p-2 border rounded h-24"/>
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex gap-2">
                <button onClick={submitSupportTicket} disabled={supportSubmitting} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400">{supportSubmitting?'Sending...':'Submit'}</button>
                <button onClick={()=>setSupportVisible(false)} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POST */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex gap-3 mb-3">
          <Avatar config={profile?.avatar} size={40}/>
          <textarea value={newPost} onChange={e=>setNewPost(e.target.value)}
            className="flex-1 p-3 border rounded-xl resize-none" placeholder="Share something positive..." rows={2}/>
        </div>
        <label className="block mb-2">
          <input type="file" accept="image/*,video/*" onChange={async(e)=>{
            const file=e.target.files?.[0]; if(!file) return;
            const reader=new FileReader(); reader.onload=(ev)=>setNewPostMedia(ev.target?.result); reader.readAsDataURL(file);
          }} className="hidden"/>
          <span className="bg-gray-100 px-3 py-1 rounded-lg cursor-pointer inline-block text-sm hover:bg-gray-200 text-gray-600">📎 Add Image/Video</span>
        </label>
        {newPostMedia && (
          <div className="mb-2 relative">
            {newPostMedia.startsWith('data:video')
              ? <video src={newPostMedia} controls className="w-full rounded-xl max-h-64 object-contain bg-black"/>
              : <img src={newPostMedia} alt="preview" className="w-full rounded-xl max-h-64 object-contain bg-gray-100"/>}
            <button onClick={()=>setNewPostMedia(null)} className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-lg text-sm">✕ Remove</button>
          </div>
        )}
        {error && <div className="text-red-600 text-sm flex gap-1 mb-2"><AlertCircle size={16}/>{error}</div>}
        <button onClick={createPost} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700">Post</button>
      </div>

      {/* POSTS FEED */}
      {posts.map(p=>(
        <div key={p.id} className="bg-white p-4 rounded-xl mb-3 shadow-sm">
          <div className="flex gap-3 items-center mb-3">
            <button onClick={()=>setSelectedProfileUser({...p.profiles,uid:p.authorId})} className="hover:opacity-75 flex-shrink-0">
              <Avatar config={p.profiles?.avatar||{}} size={40}/>
            </button>
            <button onClick={()=>setSelectedProfileUser({...p.profiles,uid:p.authorId})} className="font-bold hover:text-indigo-600">
              {p.profiles?.username||'Unknown'}
            </button>
          </div>
          <p className="mb-3 text-gray-800">{p.content}</p>
          {p.mediaUrl && (p.mediaUrl.startsWith('data:video')
            ? <video src={p.mediaUrl} controls className="w-full rounded-xl my-2 max-h-96 bg-black"/>
            : <img src={p.mediaUrl} alt="post media" className="w-full rounded-xl my-2 max-h-96 object-contain bg-gray-50"/>
          )}
          <div className="flex gap-4 mt-2 mb-2">
            <button onClick={()=>react(p)} className="flex items-center gap-1 text-gray-500 hover:text-red-500">
              <Heart size={18} className={p.reactions.includes(user.uid)?'fill-red-500 text-red-500':''}/>
              <span className="text-sm">{p.reactions.length}</span>
            </button>
            <button onClick={()=>setShowReactionPicker(showReactionPicker===p.id?null:p.id)} className="text-xl hover:scale-110">😊</button>
          </div>
          {showReactionPicker===p.id && (
            <div className="bg-gray-50 p-3 rounded-xl mb-2 flex gap-2 flex-wrap">
              {['👍','❤️','😂','🔥','😍','🎉','✨','💪','🌟','🙏','😢','👏','😮','🤔','😭','🎈','🌻','🤝','💧','⭐'].map(emoji=>(
                <button key={emoji} onClick={()=>reactWithEmoji(p,emoji)} className="text-2xl hover:scale-125 cursor-pointer">{emoji}</button>
              ))}
            </div>
          )}
          {Object.values(p.emojiReactions||{}).length>0 && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {Array.from(new Set(Object.values(p.emojiReactions))).map(emoji=>(
                <span key={emoji} className="bg-gray-100 px-2 py-1 rounded-lg text-sm">{emoji}</span>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input value={commentInputs[p.id]||''} onChange={e=>setCommentInputs(v=>({...v,[p.id]:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&comment(p.id,commentInputs[p.id])}
              className="flex-1 p-2 border rounded-xl text-sm focus:outline-none focus:border-indigo-400" placeholder="Add a comment..."/>
            <button onClick={()=>comment(p.id,commentInputs[p.id])} className="text-indigo-600 hover:text-indigo-800"><Send size={18}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}
