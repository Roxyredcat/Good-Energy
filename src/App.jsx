import React, { useState, useEffect } from 'react';
import {
  Heart, MessageCircle, Send, LogOut, User, AlertCircle, X, Check, Settings, Download, Trash2
} from 'lucide-react';

/* ================= FIREBASE ================= */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  where,
  getDocs
} from 'firebase/firestore';

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

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

/* ================= MODERATION ================= */

const ModerationEngine = {
  negative: ['stupid','idiot','dumb','trash','garbage','hate','worst','loser'],
  targeted: ['you are',"you're",'your'],
  predatory: ['meet up','address','phone number','where do you','come over','alone','parents away','snap me','kik','whatsapp','private','secret','dont tell','tell no one'],

  check(text, isTeenPool=false) {
    const t = text.toLowerCase().trim();
    if (!t) return { allowed:false, reason:'Message cannot be empty' };

    if (isTeenPool) {
      const hasPredatory = this.predatory.some(p => t.includes(p));
      if (hasPredatory) {
        return { allowed:false, reason:'⚠️ Unsafe message detected. We protect teen safety here.' };
      }
    }

    const neg = this.negative.some(w => t.includes(w));
    const targ = this.targeted.some(p => t.includes(p));

    if (neg && targ) {
      return { allowed:false, reason:'Please keep the tone calm and constructive.' };
    }
    return { allowed:true };
  }
};

/* ================= AVATAR ================= */

const Avatar = ({ config={}, size=48 }) => {
  if (config && config.photoUrl) {
    return (
      <img
        src={config.photoUrl}
        alt="avatar"
        className="rounded-full object-cover flex-shrink-0"
        style={{ width:size, height:size, minWidth:size, minHeight:size }}
      />
    );
  }
  return (
    <div
      className={`${(config && config.color) || 'bg-blue-500'} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ width:size, height:size, minWidth:size, minHeight:size }}
    >
      <span style={{ fontSize:size*0.5 }}>{(config && config.emoji) || '😊'}</span>
    </div>
  );
};

/* ================= APP ================= */

export default function App() {

  const [user,setUser] = useState(null);
  const [profile,setProfile] = useState(null);
  const [view,setView] = useState('splash');

  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [passwordConfirm,setPasswordConfirm] = useState('');
  const [username,setUsername] = useState('');
  const [age,setAge] = useState('');
  const [isTeenPool,setIsTeenPool] = useState(false);
  const [isPremium,setIsPremium] = useState(false);

  const [posts,setPosts] = useState([]);
  const [newPost,setNewPost] = useState('');
  const [newPostMedia,setNewPostMedia] = useState(null);
  const [commentInputs,setCommentInputs] = useState({});
  const [error,setError] = useState('');

  const [board,setBoard] = useState(Array(9).fill(null));
  const [player,setPlayer] = useState('X');

  const [showProfileEdit,setShowProfileEdit] = useState(false);
  const [selectedEmoji,setSelectedEmoji] = useState('😊');
  const [showReactionPicker,setShowReactionPicker] = useState(null);
  const [showWordFinder,setShowWordFinder] = useState(false);
  const [wordScore,setWordScore] = useState(0);
  const [showPassword,setShowPassword] = useState(false);
  const [isSignupMode,setIsSignupMode] = useState(true);
  const [showAvatarSetup,setShowAvatarSetup] = useState(false);
  const [parentalEmail,setParentalEmail] = useState('');
  const [showParentalConsent,setShowParentalConsent] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(false);
  const [deletePassword,setDeletePassword] = useState('');

  const [selectedProfileUser,setSelectedProfileUser] = useState(null);
  const [chatWith,setChatWith] = useState(null);
  const [chatWithProfile,setChatWithProfile] = useState(null);
  const [messages,setMessages] = useState({});
  const [newMessage,setNewMessage] = useState('');

  /* ===== AUTH LISTENER ===== */

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setProfile(null);
        setView('splash');
        setNewPost('');
        setNewPostMedia(null);
        return;
      }

      setUser(u);
      const snap = await getDoc(doc(db,'profiles',u.uid));

      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setIsPremium(data.isPremium || false);
        setIsTeenPool(data.isTeenPool || false);
        setShowAvatarSetup(false);
        if (data.isNewUser) {
          setView('onboarding');
        } else {
          setView('feed');
        }
      } else {
        setProfile(null);
        setShowAvatarSetup(false);
        setView('onboarding');
      }
    });
  }, []);

  /* ===== POSTS LISTENER ===== */

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
    return onSnapshot(q, async snap => {
      const loaded = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          const pSnap = await getDoc(doc(db,'profiles',data.authorId));
          if (isTeenPool && !data.isTeenPool && data.authorId !== user.uid) {
            return null;
          }
          return { id:d.id, ...data, profiles: pSnap.exists() ? pSnap.data() : null };
        })
      );
      setPosts(loaded.filter(Boolean));
    });
  }, [user, isTeenPool]);

  /* ===== MESSAGES LISTENER ===== */

  useEffect(() => {
    if (!user || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    const q = query(collection(db,'messages',conversationId,'texts'), orderBy('createdAt','asc'));
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(prev => ({...prev, [conversationId]: msgs}));
    });
  }, [user, chatWith]);

  const openChat = (profileData, uid) => {
    setChatWith(uid);
    setChatWithProfile(profileData);
    setSelectedProfileUser(null);
    setView('chat');
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    try {
      await addDoc(collection(db,'messages',conversationId,'texts'), {
        senderId: user.uid,
        senderName: profile?.username || 'Unknown',
        text: newMessage,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      setError('Failed to send message: ' + err.message);
    }
  };

  /* ===== AUTH ===== */

  const signUp = async () => {
    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!age || age < 13) {
      setError('You must be at least 13 years old to use Good Energy');
      return;
    }
    
    const ageNum = parseInt(age);
    if (ageNum < 18) {
      if (!parentalEmail) {
        setError('Users under 18 must provide parent/guardian email for verification');
        setShowParentalConsent(true);
        return;
      }
      if (!parentalEmail.includes('@')) {
        setError('Please enter a valid parent/guardian email address');
        return;
      }
    }
    
    try {
      const cred = await createUserWithEmailAndPassword(auth,email,password);
      const teenPool = ageNum < 18;
      await setDoc(doc(db,'profiles',cred.user.uid),{
        username,
        age: ageNum,
        aura:'blue',
        violations:0,
        avatar:{ emoji:'😊', color:'bg-blue-500' },
        isPremium:false,
        isTeenPool:teenPool,
        isNewUser:true,
        parentalEmail: ageNum < 18 ? parentalEmail : null,
        parentalVerified: false,
        createdAt:serverTimestamp()
      });
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setUsername('');
      setAge('');
      setParentalEmail('');
      setError('');
      
      if (ageNum < 18) {
        setShowParentalConsent(false);
        setView('parental-pending');
      }
    } catch (err) {
      let errorMsg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This email already has an account. Try logging in or use a different email.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password should be at least 6 characters.';
      }
      setError(errorMsg);
    }
  };

  const login = async () => {
    if (!email || !password) {
      setError('Please fill in email and password');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth,email,password);
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setError('');
    } catch (err) {
      let errorMsg = err.message;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        errorMsg = "Email or password is incorrect. Try signing up if you don't have an account.";
      }
      setError(errorMsg);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError(err.message || 'Failed to logout');
    }
  };

  /* ===== PROFILE ===== */

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let photoUrl = ev.target?.result;
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) { height *= maxSize / width; width = maxSize; }
          } else {
            if (height > maxSize) { width *= maxSize / height; height = maxSize; }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          photoUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          await updateDoc(doc(db,'profiles',user.uid), { 'avatar.photoUrl': photoUrl });
          setProfile(p => ({...p, avatar: {...(p.avatar || {}), photoUrl}}));
          
          if (showAvatarSetup) {
            setShowAvatarSetup(false);
            setView('feed');
          } else {
            setShowProfileEdit(false);
          }
          setError('');
        };
        img.src = photoUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to save avatar: ' + err.message);
    }
  };

  const updateAvatar = async (emoji) => {
    const newAvatar = { emoji, color:'bg-blue-500' };
    await updateDoc(doc(db,'profiles',user.uid), { avatar: newAvatar });
    setProfile(p => ({...p, avatar: newAvatar}));
  };

  /* ===== POSTS ===== */

  const createPost = async () => {
    const check = ModerationEngine.check(newPost, isTeenPool);
    if (!check.allowed) return setError(check.reason);

    try {
      await addDoc(collection(db,'posts'),{
        content:newPost,
        mediaUrl:newPostMedia,
        authorId:user.uid,
        isTeenPool:isTeenPool,
        reactions:[],
        emojiReactions:{},
        createdAt:serverTimestamp()
      });
      setNewPost('');
      setNewPostMedia(null);
      setError('');
    } catch (err) {
      setError('Failed to create post: ' + err.message);
    }
  };

  const comment = async (postId,text) => {
    const check = ModerationEngine.check(text, isTeenPool);
    if (!check.allowed) {
      if (isTeenPool && check.reason.includes('Unsafe message')) {
        await updateDoc(doc(db,'profiles',user.uid), { violations: 999, aura:'banned' });
        setError('Your account has been suspended for safety violations.');
        return;
      }
      await violation();
      return setError(check.reason);
    }

    await addDoc(collection(db,'posts',postId,'comments'),{
      content:text,
      authorId:user.uid,
      createdAt:serverTimestamp()
    });
    setCommentInputs(p => ({...p,[postId]:''}));
  };

  const react = async (post) => {
    const r = doc(db,'posts',post.id);
    const has = post.reactions.includes(user.uid);
    await updateDoc(r,{
      reactions: has
        ? post.reactions.filter(id=>id!==user.uid)
        : arrayUnion(user.uid)
    });
  };

  const reactWithEmoji = async (post, emoji) => {
    const r = doc(db,'posts',post.id);
    const reactionKey = `${user.uid}_${emoji}`;
    const hasReaction = post.emojiReactions?.[reactionKey];
    
    if (hasReaction) {
      const updated = {...post.emojiReactions};
      delete updated[reactionKey];
      await updateDoc(r, { emojiReactions: updated });
    } else {
      await updateDoc(r, {
        emojiReactions: { ...post.emojiReactions, [reactionKey]: emoji }
      });
    }
    setShowReactionPicker(null);
  };

  /* ===== VIOLATIONS ===== */

  const violation = async () => {
    const v = profile.violations + 1;
    const aura = v >= 3 ? 'black' : v === 1 ? 'orange' : 'blue';
    await updateDoc(doc(db,'profiles',user.uid),{ violations:v, aura });
    setProfile(p => ({...p,violations:v,aura}));
    if (v >= 3) setView('reset');
  };

  /* ===== ACCOUNT MANAGEMENT ===== */

  const deleteAccount = async () => {
    if (!deletePassword) {
      setError('Please enter your password to confirm');
      return;
    }
    try {
      setError('');
      await updateDoc(doc(db,'profiles',user.uid), {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        username: '[deleted]',
        email: '[deleted]'
      });
      const postsSnap = await getDocs(query(collection(db,'posts'), where('authorId','==',user.uid)));
      for (const postDoc of postsSnap.docs) {
        await deleteDoc(doc(db,'posts',postDoc.id));
      }
      setShowDeleteConfirm(false);
      setDeletePassword('');
      await logout();
    } catch (err) {
      setError('Failed to delete account: ' + err.message);
    }
  };

  const exportData = async () => {
    try {
      const postsSnap = await getDocs(query(collection(db,'posts'), where('authorId','==',user.uid)));
      const userPosts = postsSnap.docs.map(d => d.data());
      const exportObj = { profile, posts: userPosts, exportedAt: new Date().toISOString() };
      const dataStr = JSON.stringify(exportObj, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `good-energy-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setError('');
      await updateDoc(doc(db,'profiles',user.uid), { dataExportedAt: serverTimestamp() });
    } catch (err) {
      setError('Failed to export data: ' + err.message);
    }
  };

  /* ===== SUPPORT ===== */

  const [supportVisible, setSupportVisible] = useState(false);
  const [supportForm, setSupportForm] = useState({category: 'report', subject: '', message: ''});
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [verifyTokenError, setVerifyTokenError] = useState('');

  const submitSupportTicket = async () => {
    if (!supportForm.subject || !supportForm.message) {
      setError('Please fill in all fields');
      return;
    }
    setSupportSubmitting(true);
    try {
      await addDoc(collection(db,'support_tickets'), {
        userId: user.uid,
        email: user.email,
        category: supportForm.category,
        subject: supportForm.subject,
        message: supportForm.message,
        status: 'open',
        createdAt: serverTimestamp()
      });
      setSupportForm({category:'report',subject:'',message:''});
      setSupportVisible(false);
      setError('');
      alert('✅ Support ticket submitted! We\'ll respond within 24 hours.');
    } catch (err) {
      setError('Failed to submit: ' + err.message);
    } finally {
      setSupportSubmitting(false);
    }
  };

  useEffect(() => {
    if (view === 'verify-parent') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userId = params.get('userId');
      if (token && userId) {
        (async () => {
          try {
            const snap = await getDoc(doc(db,'profiles',userId));
            if (snap.data().parentalVerificationToken === token) {
              const expiresAt = snap.data().parentalTokenExpiresAt?.toDate?.().getTime();
              if (Date.now() > expiresAt) {
                setVerifyTokenError('Verification link expired. Please request a new one.');
                return;
              }
              await updateDoc(doc(db,'profiles',userId), {
                parentalVerified: true,
                parentalVerifiedAt: serverTimestamp(),
                parentalVerificationToken: '',
                parentalTokenExpiresAt: null
              });
              setVerifyTokenError('');
              setView('splash');
            } else {
              setVerifyTokenError('Invalid verification link');
            }
          } catch (err) {
            setVerifyTokenError('Error: ' + err.message);
          }
        })();
      }
    }
  }, [view]);

  /* ===== RESET GAME ===== */

  const win = b => {
    const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let [a,b2,c] of lines)
      if (b[a] && b[a]===b[b2] && b[a]===b[c]) return b[a];
  };

  const play = i => {
    if (board[i]) return;
    const b=[...board];
    b[i]=player;
    setBoard(b);
    const w=win(b);
    if (w || b.every(Boolean)) {
      setTimeout(()=>{ setBoard(Array(9).fill(null)); setPlayer('X'); },300);
    } else setPlayer(p=>p==='X'?'O':'X');
  };

  /* ================= VIEWS ================= */

  if (view === 'splash') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <h1 className="text-5xl font-bold mb-2">Good Energy 🌿</h1>
      <p className="text-gray-500 mb-8">A positive space for everyone</p>
      <div className="flex gap-4">
        <button
          onClick={()=>{setView('signup'); setError(''); setEmail(''); setPassword('');}}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-700"
        >
          Get Started
        </button>
        <button
          onClick={()=>{setView('login'); setError(''); setEmail(''); setPassword('');}}
          className="bg-white text-indigo-600 border-2 border-indigo-600 px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-50"
        >
          Log In
        </button>
      </div>
      <div className="mt-10 flex gap-4 text-sm text-gray-500">
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Legal</a>
        <span>•</span>
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
          <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 border rounded pr-20"/>
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-xs text-gray-500">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="relative mb-2">
          <input type={showPassword ? "text" : "password"} placeholder="Confirm Password" value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)} className="w-full p-2 border rounded pr-8"/>
          {password && passwordConfirm && (
            <span className="absolute right-2 top-2 text-sm">
              {password === passwordConfirm ? '✅' : '❌'}
            </span>
          )}
        </div>
        <input type="number" placeholder="Age" min="13" max="120" value={age} onChange={e=>setAge(e.target.value)} className="w-full mb-3 p-2 border rounded"/>
        {age && parseInt(age) < 18 && (
          <div className="mb-3">
            <p className="text-xs text-orange-600 mb-1">⚠️ Users under 18 need parental consent</p>
            <input placeholder="Parent/Guardian Email" type="email" value={parentalEmail} onChange={e=>setParentalEmail(e.target.value)} className="w-full p-2 border border-orange-300 rounded"/>
          </div>
        )}
        {error && <div className="text-red-600 text-sm mb-2 p-2 bg-red-50 rounded">{error}</div>}
        <button onClick={signUp} className="w-full bg-indigo-600 text-white py-2 rounded mb-2 font-bold hover:bg-indigo-700">
          Create Account
        </button>
        <button
          onClick={()=>{setView('login'); setError(''); setPasswordConfirm(''); setUsername(''); setAge(''); setParentalEmail('');}}
          className="w-full text-center text-sm text-indigo-600 hover:underline py-1"
        >
          Already have an account? Log In
        </button>
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
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full p-2 border rounded pr-16"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-xs text-gray-500">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {error && <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{error}</div>}
        <button onClick={login} className="w-full bg-indigo-600 text-white py-2 rounded mb-3 font-bold hover:bg-indigo-700">
          Log In
        </button>
        <button
          onClick={()=>{setView('signup'); setError(''); setPassword(''); setEmail('');}}
          className="w-full text-center text-sm text-indigo-600 hover:underline py-1"
        >
          Need an account? Sign Up
        </button>
      </div>
    </div>
  );

  if (showAvatarSetup && user && profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
      <div className="bg-white p-8 rounded-xl w-96 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-1">Set Your Avatar 🎨</h2>
        <p className="text-gray-500 text-sm mb-5">Upload a photo or pick an emoji</p>
        <div className="flex justify-center mb-6">
          <Avatar config={profile?.avatar} size={96}/>
        </div>
        <label className="block mb-4">
          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
          <span className="bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer block hover:bg-indigo-700">
            📸 Upload Photo
          </span>
        </label>
        <p className="text-sm text-gray-500 mb-3">Or choose an emoji:</p>
        <div className="grid grid-cols-7 gap-2 mb-6">
          {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨','😇','🤝','💧','⭐','🌈','🦄','🤖','🌻','🎯','🏆'].map(emoji => (
            <button
              key={emoji}
              onClick={async () => {
                const newAvatar = { emoji, color:'bg-blue-500' };
                await updateDoc(doc(db,'profiles',user.uid), { avatar: newAvatar });
                setProfile(p => ({...p, avatar: newAvatar}));
                setShowAvatarSetup(false);
                setView('feed');
              }}
              className="text-2xl hover:scale-125 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
        <button onClick={() => { setShowAvatarSetup(false); setView('feed'); }} className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300">
          Skip for Now
        </button>
      </div>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Welcome to Good Energy! 🌿</h2>
        <p className="text-gray-500 mb-6">Choose your experience:</p>
        <button
          onClick={async () => {
            try {
              await setDoc(doc(db,'profiles',user.uid), { isPremium:false, isNewUser:false }, { merge: true });
              setIsPremium(false);
              setShowAvatarSetup(true);
            } catch (err) {
              setError('Failed to continue. Please try again.');
            }
          }}
          className="w-full bg-gray-100 text-gray-800 py-3 rounded mb-2 hover:bg-gray-200 font-medium"
        >
          Continue Free
        </button>
        <button
          onClick={() => setView('premium')}
          className="w-full bg-yellow-500 text-white py-3 rounded font-bold hover:bg-yellow-600"
        >
          ✨ Upgrade to Premium
        </button>
      </div>
    </div>
  );

  if (view === 'premium') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-1">✨ Good Energy Premium</h2>
        <p className="text-gray-500 mb-4 text-sm">Unlock exclusive features</p>
        <ul className="text-left mb-6 space-y-2 text-sm">
          <li>✅ Word Finder Game</li>
          <li>✅ Priority Moderation</li>
          <li>✅ Custom Emoji Reactions</li>
          <li>✅ Advanced Analytics</li>
        </ul>
        <div className="text-2xl font-bold text-yellow-600 mb-4">$4.99/month</div>
        <button
          onClick={async () => {
            try {
              await setDoc(doc(db,'profiles',user.uid), { isPremium:true, isNewUser:false }, { merge: true });
              setIsPremium(true);
              setShowAvatarSetup(true);
            } catch (err) {
              setError('Failed to subscribe. Please try again.');
            }
          }}
          className="w-full bg-yellow-500 text-white py-2 rounded mb-2 font-bold hover:bg-yellow-600"
        >
          Subscribe
        </button>
        <button
          onClick={async () => {
            try {
              await setDoc(doc(db,'profiles',user.uid), { isPremium:false, isNewUser:false }, { merge: true });
              setIsPremium(false);
              setShowAvatarSetup(true);
            } catch (err) {
              setError('Failed to continue. Please try again.');
            }
          }}
          className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );

  if (view === 'parental-pending') return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-2 border-blue-500 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">⏳ Parental Consent Pending</h2>
        <p className="text-gray-700 mb-2">Welcome to Good Energy! 🌿</p>
        <p className="text-gray-600 mb-4">Since you're under 18, we sent an email to your parent/guardian at:</p>
        <div className="bg-blue-50 p-3 rounded mb-6 border border-blue-300">
          <p className="font-mono text-sm">{profile?.parentalEmail}</p>
        </div>
        <p className="text-sm text-gray-600 mb-6">Once they verify, you'll be able to access Good Energy.</p>
        <button onClick={logout} className="w-full bg-gray-400 text-white px-4 py-2 rounded font-bold hover:bg-gray-500">
          Sign Out
        </button>
      </div>
    </div>
  );

  if (view === 'verify-parent') return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-2 border-green-500 shadow-lg">
        {verifyTokenError ? (
          <>
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Verification Failed</h2>
            <p className="text-gray-700 mb-6">{verifyTokenError}</p>
            <button onClick={() => setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-2 rounded font-bold">Go Back</button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-green-600 mb-4">✅ Account Verified!</h2>
            <p className="text-gray-700 mb-4">Your parent has verified your account.</p>
            <p className="text-gray-600 mb-6">Your teen can now access Good Energy!</p>
            <button onClick={() => setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-2 rounded font-bold">Continue to App</button>
          </>
        )}
      </div>
    </div>
  );

  if (view === 'reset') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-white p-6 rounded-xl text-center">
        <h2 className="text-xl mb-4">Reset Space</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {board.map((c,i)=>(
            <button key={i} onClick={()=>play(i)} className="w-16 h-16 bg-gray-200 text-2xl">{c}</button>
          ))}
        </div>
        <button
          onClick={()=>{ updateDoc(doc(db,'profiles',user.uid),{ violations:0,aura:'blue' }); setView('feed'); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Return
        </button>
      </div>
    </div>
  );

  if (profile?.aura === 'banned') return (
    <div className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-4 border-red-500 shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">⛔ Account Suspended</h2>
        <p className="text-gray-700 mb-4">Your account has been permanently suspended for violating our safety policies.</p>
        <p className="text-gray-600 text-sm mb-6">Good Energy is committed to protecting minors. Predatory behavior will not be tolerated.</p>
        <button onClick={logout} className="bg-gray-400 text-white px-6 py-2 rounded">Sign Out</button>
      </div>
    </div>
  );

  if (view === 'wordFinder') return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('feed')} className="mb-4 bg-gray-300 px-4 py-2 rounded">← Back</button>
        <div className="bg-white p-6 rounded-xl text-center">
          <h2 className="text-3xl font-bold mb-4">✨ Word Finder</h2>
          <div className="grid grid-cols-4 gap-2 mb-6 bg-indigo-100 p-4 rounded">
            {['L','O','V','E','C','A','L','M','J','O','Y','S','K','I','N','D'].map((letter, i) => (
              <div key={i} className="bg-white p-3 rounded font-bold text-lg cursor-pointer hover:bg-indigo-200">{letter}</div>
            ))}
          </div>
          <div className="text-4xl font-bold text-yellow-600 mb-4">Score: {wordScore}</div>
          <button onClick={() => setWordScore(wordScore + 100)} className="w-full bg-indigo-600 text-white py-3 rounded mb-2">+ Find Word</button>
        </div>
      </div>
    </div>
  );

  if (selectedProfileUser) return (
    <div className="min-h-screen bg-gray-100 p-4">
      <button onClick={() => setSelectedProfileUser(null)} className="mb-4 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">
        ← Back to Feed
      </button>
      <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <Avatar config={selectedProfileUser.avatar} size={96}/>
        </div>
        <h2 className="text-2xl font-bold mb-1">{selectedProfileUser.username}</h2>
        {selectedProfileUser.age && <p className="text-gray-500 mb-6">Age {selectedProfileUser.age}</p>}
        {selectedProfileUser.uid !== user?.uid && (
          <button
            onClick={() => openChat(selectedProfileUser, selectedProfileUser.uid)}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 text-lg"
          >
            💬 Send Message
          </button>
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
          <button onClick={() => { setChatWith(null); setChatWithProfile(null); setView('feed'); }} className="text-indigo-600 font-bold mr-2">←</button>
          {chatWithProfile && (
            <>
              <Avatar config={chatWithProfile.avatar} size={36}/>
              <span className="font-bold text-lg">{chatWithProfile.username}</span>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{maxHeight:'calc(100vh - 140px)'}}>
          {currentMessages.length === 0 && (
            <div className="text-center text-gray-400 mt-10">
              <p className="text-4xl mb-2">💬</p>
              <p>No messages yet. Say hi!</p>
            </div>
          )}
          {currentMessages.map((msg, i) => {
            const isMe = msg.senderId === user.uid;
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-2xl ${isMe ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 shadow'}`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-white border-t p-3 flex gap-2">
          <input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded-xl focus:outline-none focus:border-indigo-400"
          />
          <button onClick={sendMessage} className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700">
            <Send size={18}/>
          </button>
        </div>
      </div>
    );
  }

  /* ── FEED ── */
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex justify-between items-center mb-4 bg-white rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Good Energy 🌿</h1>
          <span className="text-xs text-gray-400">{isTeenPool ? '🔒 Teen Pool' : isPremium ? '✨ Premium' : ''}</span>
        </div>
        <div className="flex gap-3 items-center">
          {isPremium && (
            <button onClick={() => setView('wordFinder')} className="text-sm bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">
              🎮 Word Finder
            </button>
          )}
          <button onClick={()=>setShowProfileEdit(true)} title="Edit Profile" className="hover:opacity-80 transition-opacity">
            <Avatar config={profile?.avatar} size={36}/>
          </button>
          <button onClick={()=>setShowSettings(true)} title="Settings" className="text-gray-600 hover:text-gray-900"><Settings size={20}/></button>
          <button onClick={()=>setSupportVisible(true)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">💬 Support</button>
          <a href="/legal.html" target="_blank" className="text-xs text-gray-400 hover:text-gray-600">Legal</a>
          <button onClick={logout} title="Log Out" className="text-gray-600 hover:text-red-500"><LogOut size={20}/></button>
        </div>
      </div>

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
              {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨'].map(emoji => (
                <button key={emoji} onClick={() => updateAvatar(emoji)} className="text-2xl hover:scale-125 transition-transform">{emoji}</button>
              ))}
            </div>
            <button onClick={() => setShowProfileEdit(false)} className="bg-gray-200 px-4 py-2 rounded w-full hover:bg-gray-300">Close</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Account Settings ⚙️</h3>
              <button onClick={() => setShowSettings(false)}><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <button onClick={exportData} className="w-full flex items-center gap-2 bg-blue-50 border border-blue-300 text-blue-700 px-4 py-2 rounded hover:bg-blue-100">
                <Download size={18}/> Export My Data
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded hover:bg-red-100">
                <Trash2 size={18}/> Delete Account
              </button>
              <button onClick={() => setShowSettings(false)} className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 border-2 border-red-500 shadow-xl">
            <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ Delete Account</h3>
            <p className="text-gray-700 mb-4">All your data will be deleted after 30 days. Enter your password to confirm:</p>
            <input type="password" placeholder="Confirm password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className="w-full p-2 border rounded mb-4"/>
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="flex gap-2">
              <button onClick={deleteAccount} className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-bold">Delete</button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setError(''); }} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {supportVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">💬 Support & Appeals</h3>
              <button onClick={() => setSupportVisible(false)}><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold">Category</label>
                <select value={supportForm.category} onChange={e => setSupportForm({...supportForm, category: e.target.value})} className="w-full p-2 border rounded">
                  <option value="report">Report Content</option>
                  <option value="appeal">Appeal Violation</option>
                  <option value="privacy">Privacy Concern</option>
                  <option value="bug">Report Bug</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold">Subject</label>
                <input type="text" value={supportForm.subject} onChange={e => setSupportForm({...supportForm, subject: e.target.value})} placeholder="Brief subject" className="w-full p-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm font-bold">Message</label>
                <textarea value={supportForm.message} onChange={e => setSupportForm({...supportForm, message: e.target.value})} placeholder="Tell us what happened..." className="w-full p-2 border rounded h-24"/>
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex gap-2">
                <button onClick={submitSupportTicket} disabled={supportSubmitting} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400">
                  {supportSubmitting ? 'Sending...' : 'Submit'}
                </button>
                <button onClick={() => setSupportVisible(false)} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex gap-3 mb-3">
          <Avatar config={profile?.avatar} size={40}/>
          <textarea
            value={newPost}
            onChange={e=>setNewPost(e.target.value)}
            className="flex-1 p-3 border rounded-xl resize-none"
            placeholder="Share something positive..."
            rows={2}
          />
        </div>
        <label className="block mb-2">
          <input
            type="file" accept="image/*,video/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setNewPostMedia(ev.target?.result);
              reader.readAsDataURL(file);
            }}
            className="hidden"
          />
          <span className="bg-gray-100 px-3 py-1 rounded-lg cursor-pointer inline-block text-sm hover:bg-gray-200 text-gray-600">
            📎 Add Image/Video
          </span>
        </label>
        {newPostMedia && (
          <div className="mb-2 relative">
            {newPostMedia.startsWith('data:video') ? (
              <video src={newPostMedia} controls className="w-full rounded-xl max-h-64 object-contain bg-black"/>
            ) : (
              <img src={newPostMedia} alt="preview" className="w-full rounded-xl max-h-64 object-contain bg-gray-100"/>
            )}
            <button onClick={() => setNewPostMedia(null)} className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-lg text-sm">✕ Remove</button>
          </div>
        )}
        {error && <div className="text-red-600 text-sm flex gap-1 mb-2"><AlertCircle size={16}/>{error}</div>}
        <button onClick={createPost} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700">Post</button>
      </div>

      {posts.map(p=>(
        <div key={p.id} className="bg-white p-4 rounded-xl mb-3 shadow-sm">
          <div className="flex gap-3 items-center mb-3">
            <button onClick={() => setSelectedProfileUser({...p.profiles, uid: p.authorId})} className="hover:opacity-75 transition-opacity flex-shrink-0">
              <Avatar config={p.profiles?.avatar || {}} size={40}/>
            </button>
            <button onClick={() => setSelectedProfileUser({...p.profiles, uid: p.authorId})} className="font-bold hover:text-indigo-600">
              {p.profiles?.username || 'Unknown'}
            </button>
          </div>
          <p className="mb-3 text-gray-800">{p.content}</p>
          {p.mediaUrl && (
            p.mediaUrl.startsWith('data:video') ? (
              <video src={p.mediaUrl} controls className="w-full rounded-xl my-2 max-h-96 bg-black"/>
            ) : (
              <img src={p.mediaUrl} alt="post media" className="w-full rounded-xl my-2 max-h-96 object-contain bg-gray-50"/>
            )
          )}
          <div className="flex gap-4 mt-2 mb-2">
            <button onClick={()=>react(p)} className="flex items-center gap-1 text-gray-500 hover:text-red-500">
              <Heart size={18} className={p.reactions.includes(user.uid) ? 'fill-red-500 text-red-500':''}/>
              <span className="text-sm">{p.reactions.length}</span>
            </button>
            <button onClick={()=>setShowReactionPicker(showReactionPicker === p.id ? null : p.id)} className="text-xl hover:scale-110">😊</button>
          </div>
          {showReactionPicker === p.id && (
            <div className="bg-gray-50 p-3 rounded-xl mb-2 flex gap-2 flex-wrap">
              {['👍','❤️','😂','🔥','😍','🎉','✨','💪','🌟','🙏','😢','👏','😮','🤔','😭','🎈','🌻','🤝','💧','⭐'].map(emoji => (
                <button key={emoji} onClick={() => reactWithEmoji(p, emoji)} className="text-2xl hover:scale-125 cursor-pointer">{emoji}</button>
              ))}
            </div>
          )}
          {Object.values(p.emojiReactions || {}).length > 0 && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {Array.from(new Set(Object.values(p.emojiReactions))).map(emoji => (
                <span key={emoji} className="bg-gray-100 px-2 py-1 rounded-lg text-sm">{emoji}</span>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input
              value={commentInputs[p.id]||''}
              onChange={e=>setCommentInputs(v=>({...v,[p.id]:e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && comment(p.id, commentInputs[p.id])}
              className="flex-1 p-2 border rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Add a comment..."
            />
            <button onClick={()=>comment(p.id,commentInputs[p.id])} className="text-indigo-600 hover:text-indigo-800"><Send size={18}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}
