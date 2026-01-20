import React, { useState, useEffect } from 'react';
import {
  Heart, MessageCircle, Send, LogOut, User, AlertCircle, X, Check
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
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

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

  /* ===== AUTH LISTENER ===== */

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setProfile(null);
        setView('splash');
        return;
      }

      setUser(u);
      const snap = await getDoc(doc(db,'profiles',u.uid));

      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setIsPremium(data.isPremium || false);
        setIsTeenPool(data.isTeenPool || false);
        setView('feed');
      } else {
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
    try {
      console.log('Attempting signup with:', email);
      const cred = await createUserWithEmailAndPassword(auth,email,password);
      console.log('User created:', cred.user.uid);
      
      const teenPool = parseInt(age) < 18;
      await setDoc(doc(db,'profiles',cred.user.uid),{
        username,
        age: parseInt(age),
        aura:'blue',
        violations:0,
        avatar:{ emoji:'😊', color:'bg-blue-500' },
        isPremium:false,
        isTeenPool:teenPool,
        createdAt:serverTimestamp()
      });
      console.log('Profile created');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setUsername('');
      setAge('');
      setError('');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account - check Firebase config');
    }
  };

  const login = async () => {
    if (!email || !password) {
      setError('Please fill in email and password');
      return;
    }
    try {
      console.log('Attempting login with:', email);
      await signInWithEmailAndPassword(auth,email,password);
      console.log('Login successful');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setError('');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
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
        const photoUrl = ev.target?.result;
        const newAvatar = { ...profile.avatar, photoUrl };
        await updateDoc(doc(db,'profiles',user.uid), { avatar: newAvatar });
        setProfile(p => ({...p, avatar: newAvatar}));
        setShowProfileEdit(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message || 'Failed to upload avatar');
    }
  };

  const updateAvatar = async (emoji) => {
    const newAvatar = { emoji, color:'bg-blue-500' };
    await updateDoc(doc(db,'profiles',user.uid), { avatar: newAvatar });
    setProfile(p => ({...p, avatar: newAvatar}));
    setShowProfileEdit(false);
  };

  /* ===== POSTS ===== */

  const createPost = async () => {
    const check = ModerationEngine.check(newPost, isTeenPool);
    if (!check.allowed) return setError(check.reason);

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
      <button onClick={()=>setView('auth')} className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl">
        Get Started
      </button>
      <div className="mt-8 flex gap-4 text-sm text-gray-600">
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Legal</a>
        <span>•</span>
        <a href="/legal.html" target="_blank" className="hover:text-indigo-600">Privacy</a>
      </div>
    </div>
  );

  if (view === 'auth') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl w-96">
        <h2 className="text-2xl font-bold mb-4">Good Energy 🌿</h2>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full mb-2 p-2 border"/>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full mb-2 p-2 border"/>
        
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

        <input type="number" placeholder="Age" min="13" max="120" value={age} onChange={e=>setAge(e.target.value)} className="w-full mb-4 p-2 border"/>
        {error && <div className="text-red-600 text-sm mb-2 p-2 bg-red-50 rounded">{error}</div>}
        <button onClick={signUp} className="w-full bg-indigo-600 text-white py-2 rounded mb-2 font-bold">Sign Up</button>
        <button onClick={login} className="w-full bg-gray-200 py-2 rounded">Already have account? Log In</button>
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
            await updateDoc(doc(db,'profiles',user.uid), { isPremium:false });
            setIsPremium(false);
            setView('feed');
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
            await updateDoc(doc(db,'profiles',user.uid), { isPremium:true });
            setIsPremium(true);
            setView('feed');
          }}
          className="w-full bg-yellow-500 text-white py-2 rounded mb-2 font-bold"
        >
          Subscribe
        </button>
        <button
          onClick={async () => {
            await updateDoc(doc(db,'profiles',user.uid), { isPremium:false });
            setIsPremium(false);
            setView('feed');
          }}
          className="w-full bg-gray-200 py-2 rounded"
        >
          Skip for Now
        </button>
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
            <video src={newPostMedia} controls className="w-full rounded max-h-64"/>
          ) : (
            <img src={newPostMedia} alt="preview" className="w-full rounded max-h-64"/>
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
              <video src={p.mediaUrl} controls className="w-full rounded my-2 max-h-64"/>
            ) : (
              <img src={p.mediaUrl} alt="post media" className="w-full rounded my-2 max-h-64"/>
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
              {['👍','❤️','😂','🔥','😍','🎉','✨','💪','🌟','🙏','😢','👏'].map(emoji => (
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
