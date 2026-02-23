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

/* 🔴 REPLACE WITH YOUR FIREBASE CONFIG */
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

    // Predatory language detection for teen pool
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
  if (config.photoUrl) {
    return (
      <img
        src={config.photoUrl}
        alt="avatar"
        className="rounded-full object-cover"
        style={{ width:size, height:size }}
      />
    );
  }
  return (
    <div
      className={`${config.color || 'bg-blue-500'} rounded-full flex items-center justify-center`}
      style={{ width:size, height:size }}
    >
      <span style={{ fontSize:size*0.6 }}>{config.emoji || '😊'}</span>
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
        // New users go to onboarding first
        if (data.isNewUser) {
          setView('onboarding');
        } else {
          setView('feed');
        }
      } else {
        // Profile doesn't exist yet - go to onboarding to create it
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
          const p = await getDoc(doc(db,'profiles',data.authorId));
          // Filter: teens only see teen pool posts, adults see all
          if (isTeenPool && !data.isTeenPool && data.authorId !== user.uid) {
            return null;
          }
          return { id:d.id, ...data, profiles:p.data() };
        })
      );
      setPosts(loaded.filter(Boolean));
    });
  }, [user, isTeenPool]);

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
    
    // Check if parental consent needed
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
      console.log('🔴 SIGNUP STARTED - Email:', email);
      const cred = await createUserWithEmailAndPassword(auth,email,password);
      console.log('✅ Firebase Auth user created:', cred.user.uid);
      
      const teenPool = ageNum < 18;
      console.log('📝 About to create Firestore profile for:', cred.user.uid);
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
      console.log('✅ Firestore profile created successfully');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setUsername('');
      setAge('');
      setParentalEmail('');
      setError('');
      
      // If minor, show pending parental consent screen
      if (ageNum < 18) {
        setShowParentalConsent(false);
        setView('parental-pending');
      }
    } catch (err) {
      console.error('❌ Signup error code:', err.code);
      console.error('❌ Signup error message:', err.message);
      console.error('❌ Full error:', err);
      
      // Provide helpful error messages
      let errorMsg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This email already has an account. Try logging in or use a different email.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password should be at least 6 characters.';
      } else if (err.code === 'permission-denied') {
        errorMsg = '⚠️ Firestore permission denied. Check that Firestore database is in TEST MODE.';
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
      console.log('Attempting login with email:', email);
      console.log('Password length:', password.length);
      await signInWithEmailAndPassword(auth,email,password);
      console.log('Login successful');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setError('');
    } catch (err) {
      console.error('Login error code:', err.code);
      console.error('Login error message:', err.message);
      console.error('Full error:', err);
      
      // Provide helpful error messages
      let errorMsg = err.message;
      if (err.code === 'auth/invalid-credential') {
        errorMsg = 'Email or password is incorrect. Try signing up if you don\'t have an account.';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email. Try signing up.';
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
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('📸 Photo upload started, file:', file.name, file.type, file.size);

    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          let photoUrl = ev.target?.result;
          console.log('📸 Photo converted to data URL, original length:', photoUrl?.length);
          
          // Compress image by resizing to max 200x200
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxSize = 200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              if (width > maxSize) {
                height *= maxSize / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width *= maxSize / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            photoUrl = canvas.toDataURL('image/jpeg', 0.7);
            console.log('📸 Compressed to:', photoUrl.length, 'bytes');
            
            console.log('📸 Updating Firestore profile with compressed photo');
            await updateDoc(doc(db,'profiles',user.uid), { 'avatar.photoUrl': photoUrl });
            console.log('✅ Avatar updated in Firestore');
            
            setProfile(p => ({...p, avatar: {...(p.avatar || {}), photoUrl}}));
            console.log('✅ Local profile state updated');
            
            if (showAvatarSetup) {
              console.log('Closing avatar setup, going to feed');
              setShowAvatarSetup(false);
              setView('feed');
            } else {
              console.log('Closing edit avatar modal');
              setShowProfileEdit(false);
            }
            setError('');
          };
          img.onerror = () => {
            console.error('❌ Image loading error');
            setError('Failed to process image');
          };
          img.src = photoUrl;
        } catch (err) {
          console.error('❌ Error updating Firestore:', err);
          console.error('Error code:', err.code);
          console.error('Error message:', err.message);
          setError('Failed to save avatar: ' + err.message);
        }
      };
      reader.onerror = (err) => {
        console.error('❌ FileReader error:', err);
        setError('Failed to read file');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('❌ Avatar upload error:', err);
      setError(err.message || 'Failed to upload avatar');
    }
  };

  const updateAvatar = async (emoji) => {
    const newAvatar = { emoji, color:'bg-blue-500' };
    await updateDoc(doc(db,'profiles',user.uid), { avatar: newAvatar });
    setProfile(p => ({...p, avatar: newAvatar}));
    // Don't close modal - let user see the change immediately
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
      console.error('Post creation error:', err);
      setError('Failed to create post: ' + err.message);
    }
  };

  const comment = async (postId,text) => {
    const check = ModerationEngine.check(text, isTeenPool);
    if (!check.allowed) {
      if (isTeenPool) {
        // Teen violations are more serious - ban on predatory behavior
        const isPredatory = check.reason.includes('Unsafe message');
        if (isPredatory) {
          await updateDoc(doc(db,'profiles',user.uid), { violations: 999, aura:'banned' });
          setError('Your account has been suspended for safety violations.');
          return;
        }
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
    const ref = doc(db,'posts',post.id);
    const has = post.reactions.includes(user.uid);
    await updateDoc(ref,{
      reactions: has
        ? post.reactions.filter(id=>id!==user.uid)
        : arrayUnion(user.uid)
    });
  };

  const reactWithEmoji = async (post, emoji) => {
    const ref = doc(db,'posts',post.id);
    const reactionKey = `${user.uid}_${emoji}`;
    const hasReaction = post.emojiReactions?.[reactionKey];
    
    if (hasReaction) {
      const updated = {...post.emojiReactions};
      delete updated[reactionKey];
      await updateDoc(ref, { emojiReactions: updated });
    } else {
      await updateDoc(ref, {
        emojiReactions: { ...post.emojiReactions, [reactionKey]: emoji }
      });
    }
    setShowReactionPicker(null);
  };

  /* ===== VIOLATIONS ===== */

  const violation = async () => {
    const v = profile.violations + 1;
    const aura = v >= 3 ? 'black' : v === 1 ? 'orange' : 'blue';

    await updateDoc(doc(db,'profiles',user.uid),{
      violations:v,
      aura
    });
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
      
      // Soft delete: mark account as deleted
      const deletedAt = new Date().toISOString();
      await updateDoc(doc(db,'profiles',user.uid), {
        isDeleted: true,
        deletedAt,
        username: '[deleted]',
        email: '[deleted]'
      });

      // Delete all user's posts
      const postsSnap = await getDocs(query(collection(db,'posts'), where('authorId','==',user.uid)));
      for (const postDoc of postsSnap.docs) {
        await deleteDoc(doc(db,'posts',postDoc.id));
      }

      console.log('✅ Account marked for deletion. Will be permanently purged in 30 days.');
      setShowDeleteConfirm(false);
      setDeletePassword('');
      
      // Sign out user
      await logout();
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete account: ' + err.message);
    }
  };

  const exportData = async () => {
    try {
      const profileData = profile;
      const postsSnap = await getDocs(query(collection(db,'posts'), where('authorId','==',user.uid)));
      const posts = postsSnap.docs.map(d => d.data());

      const exportObj = {
        profile: profileData,
        posts,
        exportedAt: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportObj, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `good-energy-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setError('');
      // Update export timestamp
      await updateDoc(doc(db,'profiles',user.uid), {
        dataExportedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export data: ' + err.message);
    }
  };

  /* ===== PHASE 2: SUPPORT & VERIFICATION ===== */

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
      // Save to support_tickets collection
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

  // Handle parental email verification from link
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

              // Mark as verified
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

  // Enforce aura privacy - don't send aura in public profiles
  const getPublicProfile = (profile) => {
    if (!profile) return null;
    return {
      username: profile.username,
      avatar: profile.avatar,
      // Aura NOT included for privacy
    };
  };

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
      setTimeout(()=>{
        setBoard(Array(9).fill(null));
        setPlayer('X');
      },300);
    } else setPlayer(p=>p==='X'?'O':'X');
  };

  /* ================= UI ================= */

  if (view === 'splash') return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold">Good Energy 🌿</h1>
      <div className="mt-6 flex gap-4">
        <button onClick={()=>setView('signup')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">
          Get Started
        </button>
        <button onClick={()=>setView('login')} className="bg-gray-600 text-white px-6 py-3 rounded-xl font-bold">
          Log In
        </button>
      </div>
      <div className="mt-8 flex gap-4 text-sm text-gray-600">
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Legal</a>
        <span>•</span>
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Privacy</a>
      </div>
    </div>
  );

  if (view === 'signup') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl w-96">
        <h2 className="text-2xl font-bold mb-4">Create Account 🌿</h2>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full mb-2 p-2 border rounded"/>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full mb-2 p-2 border rounded"/>
        
        <div className="relative mb-2">
          <input 
            type={showPassword ? "text" : "password"} 
            placeholder="Password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            className="w-full p-2 border rounded"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? '🙈 Hide' : '👁️ Show'}
          </button>
        </div>

        <div className="relative mb-2">
          <input 
            type={showPassword ? "text" : "password"} 
            placeholder="Confirm Password" 
            value={passwordConfirm} 
            onChange={e=>setPasswordConfirm(e.target.value)} 
            className="w-full p-2 border rounded"
          />
          {password && passwordConfirm && (
            <span className={`absolute right-2 top-2 text-lg ${password === passwordConfirm ? '✅' : '❌'}`}>
              {password === passwordConfirm ? '✅' : '❌'}
            </span>
          )}
        </div>

        <input type="number" placeholder="Age" min="13" max="120" value={age} onChange={e=>setAge(e.target.value)} className="w-full mb-4 p-2 border rounded"/>
        
        {age && parseInt(age) < 18 && (
          <input placeholder="Parent/Guardian Email" value={parentalEmail} onChange={e=>setParentalEmail(e.target.value)} className="w-full mb-4 p-2 border rounded"/>
        )}
        
        {error && <div className="text-red-600 text-sm mb-2 p-2 bg-red-50 rounded">{error}</div>}
        
        <button onClick={signUp} className="w-full bg-indigo-600 text-white py-2 rounded mb-2 font-bold">Sign Up</button>
        <button onClick={()=>{setView('login'); setError(''); setPasswordConfirm(''); setUsername(''); setAge(''); setParentalEmail('');}} className="w-full bg-gray-200 py-2 rounded">Already have account? Log In</button>
      </div>
    </div>
  );

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl w-96">
        <h2 className="text-2xl font-bold mb-6">Log In 🌿</h2>
        
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full mb-3 p-2 border rounded"/>
        
        <div className="relative mb-4">
          <input 
            type={showPassword ? "text" : "password"} 
            placeholder="Password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            className="w-full p-2 border rounded"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? '🙈 Hide' : '👁️ Show'}
          </button>
        </div>
        
        {error && <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{error}</div>}
        
        <button onClick={login} className="w-full bg-indigo-600 text-white py-2 rounded mb-2 font-bold">Log In</button>
        <button onClick={()=>{setView('signup'); setError(''); setPassword(''); setEmail('');}} className="w-full bg-gray-200 py-2 rounded">Need an account? Sign Up</button>
      </div>
    </div>
  );

  if (showAvatarSetup && user && profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
      <div className="bg-white p-8 rounded-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-4">Set Your Profile 🎨</h2>
        <p className="text-gray-600 mb-6">Upload a photo or choose an emoji as your avatar</p>
        
        <div className="mb-6">
          <Avatar config={profile?.avatar} size={96}/>
        </div>

        <div className="space-y-3 mb-6">
          <label className="block">
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
            <span className="bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer block hover:bg-indigo-700">
              📸 Upload Photo
            </span>
          </label>
        </div>

        <p className="text-sm text-gray-600 mb-4">Or choose emoji:</p>
        <div className="grid grid-cols-6 gap-2 mb-6">
          {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨','😇','🤝','💧','⭐','🌈','🦄','🤖','🌻'].map(emoji => (
            <button
              key={emoji}
              onClick={async () => {
                const newAvatar = { emoji, color:'bg-blue-500' };
                await updateDoc(doc(db,'profiles',user.uid), { avatar: newAvatar });
                setProfile(p => ({...p, avatar: newAvatar}));
                setShowAvatarSetup(false);
                setView('feed');
              }}
              className="text-3xl hover:scale-125 transition cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAvatarSetup(false)}
          className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700"
        >
          Done
        </button>
      </div>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-4">Welcome to Good Energy! 🌿</h2>
        <p className="text-gray-600 mb-6">Choose your experience:</p>
        <button
          onClick={async () => {
            try {
              await setDoc(doc(db,'profiles',user.uid), { isPremium:false, isNewUser:false }, { merge: true });
              setIsPremium(false);
              setShowAvatarSetup(true);
            } catch (err) {
              console.error('Error updating profile:', err);
              setError('Failed to continue. Please try again.');
            }
          }}
          className="w-full bg-gray-200 text-gray-800 py-2 rounded mb-2"
        >
          Continue Free
        </button>
        <button
          onClick={async () => {
            setView('premium');
          }}
          className="w-full bg-yellow-500 text-white py-2 rounded"
        >
          ✨ Upgrade to Premium
        </button>
      </div>
    </div>
  );

  if (view === 'premium') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-2">✨ Good Energy Premium</h2>
        <p className="text-gray-600 mb-4 text-sm">Unlock exclusive features</p>
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
              console.error('Error updating profile:', err);
              setError('Failed to subscribe. Please try again.');
            }
          }}
          className="w-full bg-yellow-500 text-white py-2 rounded mb-2 font-bold"
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
              console.error('Error updating profile:', err);
              setError('Failed to continue. Please try again.');
            }
          }}
          className="w-full bg-gray-200 py-2 rounded"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );

  if (view === 'parental-pending') return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-2 border-blue-500">
        <h2 className="text-2xl font-bold mb-4">⏳ Parental Consent Pending</h2>
        <p className="text-gray-700 mb-2">Welcome to Good Energy! 🌿</p>
        <p className="text-gray-600 mb-6">
          Since you're under 18, your account is waiting for parental verification. We sent an email to your parent/guardian at:
        </p>
        <div className="bg-blue-50 p-3 rounded mb-6 border border-blue-300">
          <p className="font-mono text-sm">{profile?.parentalEmail}</p>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Once they verify, you'll be able to access Good Energy. This usually takes a few minutes.
        </p>
        <button
          onClick={logout}
          className="w-full bg-gray-400 text-white px-4 py-2 rounded font-bold hover:bg-gray-500"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  if (view === 'verify-parent') return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-2 border-green-500">
        {verifyTokenError ? (
          <>
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Verification Failed</h2>
            <p className="text-gray-700 mb-6">{verifyTokenError}</p>
            <button
              onClick={() => setView('splash')}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded font-bold"
            >
              Go Back
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-green-600 mb-4">✅ Account Verified!</h2>
            <p className="text-gray-700 mb-4">Your parent has verified your account.</p>
            <p className="text-gray-600 mb-6">Your teen can now access Good Energy and set up their avatar.</p>
            <button
              onClick={() => setView('splash')}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded font-bold"
            >
              Continue to App
            </button>
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
            <button key={i} onClick={()=>play(i)} className="w-16 h-16 bg-gray-200 text-2xl">
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={()=>{
            updateDoc(doc(db,'profiles',user.uid),{ violations:0,aura:'blue' });
            setView('feed');
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Return
        </button>
      </div>
    </div>
  );

  if (profile?.aura === 'banned') return (
    <div className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center border-4 border-red-500">
        <h2 className="text-2xl font-bold text-red-600 mb-4">⛔ Account Suspended</h2>
        <p className="text-gray-700 mb-4">
          Your account has been permanently suspended for violating our safety policies, particularly regarding teen protection.
        </p>
        <p className="text-gray-600 text-sm mb-6">
          Good Energy is committed to protecting minors. Predatory behavior will not be tolerated.
        </p>
        <button
          onClick={logout}
          className="bg-gray-400 text-white px-6 py-2 rounded"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  if (view === 'wordFinder') return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView('feed')} className="mb-4 bg-gray-300 px-4 py-2 rounded">← Back to Feed</button>
        <div className="bg-white p-6 rounded-xl text-center">
          <h2 className="text-3xl font-bold mb-4">✨ Word Finder</h2>
          <p className="text-gray-600 mb-4">Find hidden words in the grid (Premium Feature)</p>
          <div className="grid grid-cols-4 gap-2 mb-6 bg-indigo-100 p-4 rounded">
            {['L','O','V','E','C','A','L','M','J','O','Y','S','K','I','N','D'].map((letter, i) => (
              <div key={i} className="bg-white p-3 rounded font-bold text-lg cursor-pointer hover:bg-indigo-200">{letter}</div>
            ))}
          </div>
          <div className="text-4xl font-bold text-yellow-600 mb-4">Score: {wordScore}</div>
          <p className="text-gray-600 mb-4">Words found: LOVE, CALM, JOY, KIND, CARE</p>
          <button onClick={() => setWordScore(wordScore + 100)} className="w-full bg-indigo-600 text-white py-3 rounded mb-2">+ Find Word</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Good Energy {isTeenPool && '👶'}</h1>
        <div className="text-xs text-gray-500">{isTeenPool ? '🔒 Teen Pool' : isPremium ? '✨ Premium' : ''}</div>
        <div className="flex gap-4 items-center">
          {isPremium && (
            <button onClick={() => setView('wordFinder')} className="text-sm bg-yellow-500 text-white px-2 py-1 rounded">
              🎮 Word Finder
            </button>
          )}
           <button onClick={()=>setShowProfileEdit(true)}><User size={20}/></button>
           <button onClick={()=>setShowSettings(true)}><Settings size={20}/></button>
           <button onClick={()=>setSupportVisible(true)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">💬 Support</button>
           <a href="/legal.html" target="_blank" className="text-xs text-gray-500 hover:text-gray-700">Legal</a>
           <button onClick={logout}><LogOut/></button>
        </div>
      </div>

      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center mb-4">
          <div className="bg-white p-6 rounded-xl w-80 text-center">
            <h3 className="text-lg font-bold mb-4">Edit Avatar</h3>
            <Avatar config={profile?.avatar} size={64}/>
            <div className="my-4 space-y-2">
              <label className="block">
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                <span className="bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer block">Upload Photo</span>
              </label>
            </div>
            <p className="text-sm text-gray-600 mb-3">Or choose emoji:</p>
            <div className="grid grid-cols-6 gap-2 mb-4">
              {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => updateAvatar(emoji)}
                  className="text-2xl hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowProfileEdit(false)}
              className="bg-gray-300 px-4 py-2 rounded w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Account Settings ⚙️</h3>
              <button onClick={() => setShowSettings(false)}><X size={20}/></button>
            </div>

            <div className="space-y-3">
              <button
                onClick={exportData}
                className="w-full flex items-center gap-2 bg-blue-50 border border-blue-300 text-blue-700 px-4 py-2 rounded hover:bg-blue-100"
              >
                <Download size={18}/>
                Export My Data
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded hover:bg-red-100"
              >
                <Trash2 size={18}/>
                Delete Account
              </button>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 border-2 border-red-500">
            <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ Delete Account</h3>
            <p className="text-gray-700 mb-4">
              This action is permanent. All your data will be deleted after 30 days. Enter your password to confirm:
            </p>
            <input
              type="password"
              placeholder="Confirm password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="flex gap-2">
              <button
                onClick={deleteAccount}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-bold"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setError('');
                }}
                className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {supportVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">💬 Support & Appeals</h3>
              <button onClick={() => setSupportVisible(false)}><X size={20}/></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold">Category</label>
                <select
                  value={supportForm.category}
                  onChange={e => setSupportForm({...supportForm, category: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="report">Report Content</option>
                  <option value="appeal">Appeal Violation</option>
                  <option value="privacy">Privacy Concern</option>
                  <option value="bug">Report Bug</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold">Subject</label>
                <input
                  type="text"
                  value={supportForm.subject}
                  onChange={e => setSupportForm({...supportForm, subject: e.target.value})}
                  placeholder="Brief subject"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="text-sm font-bold">Message</label>
                <textarea
                  value={supportForm.message}
                  onChange={e => setSupportForm({...supportForm, message: e.target.value})}
                  placeholder="Tell us what happened..."
                  className="w-full p-2 border rounded h-24"
                />
              </div>

              {error && <div className="text-red-600 text-sm">{error}</div>}

              <div className="flex gap-2">
                <button
                  onClick={submitSupportTicket}
                  disabled={supportSubmitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {supportSubmitting ? 'Sending...' : 'Submit'}
                </button>
                <button
                  onClick={() => setSupportVisible(false)}
                  className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <textarea
        value={newPost}
        onChange={e=>setNewPost(e.target.value)}
        className="w-full p-3 rounded mb-2"
        placeholder="Share something positive..."
      />

      <label className="block mb-2">
        <input 
          type="file" 
          accept="image/*,video/*" 
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => setNewPostMedia(ev.target?.result);
            reader.readAsDataURL(file);
          }}
          className="hidden"
        />
        <span className="bg-gray-200 px-4 py-2 rounded cursor-pointer inline-block text-sm">
          + Add Image/Video
        </span>
      </label>

      {newPostMedia && (
        <div className="mb-2 relative">
          {newPostMedia.startsWith('data:video') ? (
            <video src={newPostMedia} controls className="w-full rounded max-h-64 object-contain"/>
          ) : (
            <img src={newPostMedia} alt="preview" className="w-full rounded max-h-64 object-contain"/>
          )}
          <button
            onClick={() => setNewPostMedia(null)}
            className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-sm"
          >
            Remove
          </button>
        </div>
      )}

      {error && <div className="text-red-600 flex gap-1"><AlertCircle size={16}/>{error}</div>}

      <button onClick={createPost} className="w-full bg-indigo-600 text-white py-2 rounded mb-6">
        Post
      </button>

      {posts.map(p=>(
        <div key={p.id} className="bg-white p-4 rounded mb-4">
          <div className="flex gap-2 items-center mb-2">
            <Avatar config={p.profiles?.avatar}/>
            <b>{p.profiles?.username}</b>
          </div>

          <p>{p.content}</p>

          {p.mediaUrl && (
            p.mediaUrl.startsWith('data:video') ? (
              <video src={p.mediaUrl} controls className="w-full rounded my-2 max-h-64 object-cover"/>
            ) : (
              <img src={p.mediaUrl} alt="post media" className="w-full rounded my-2 max-h-64 object-cover"/>
            )
          )}

          <div className="flex gap-4 mt-2">
            <button onClick={()=>react(p)} className="flex gap-1">
              <Heart className={p.reactions.includes(user.uid) ? 'fill-red-500 text-red-500':''}/>
              {p.reactions.length}
            </button>
            <button onClick={()=>setShowReactionPicker(showReactionPicker === p.id ? null : p.id)} className="text-xl">
              😊
            </button>
          </div>

          {showReactionPicker === p.id && (
            <div className="bg-gray-50 p-3 rounded mt-2 flex gap-2 flex-wrap">
              {['👍','❤️','😂','🔥','😍','🎉','✨','💪','🌟','🙏','😢','👏','😮','🤔','😭','🎈','🌻','🤝','💧','⭐'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => reactWithEmoji(p, emoji)}
                  className="text-2xl hover:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {Object.values(p.emojiReactions || {}).length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {Array.from(new Set(Object.values(p.emojiReactions))).map(emoji => (
                <span key={emoji} className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {emoji}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <input
              value={commentInputs[p.id]||''}
              onChange={e=>setCommentInputs(v=>({...v,[p.id]:e.target.value}))}
              className="flex-1 p-2 border rounded"
            />
            <button onClick={()=>comment(p.id,commentInputs[p.id])}>
              <Send/>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
