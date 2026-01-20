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
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= MODERATION ================= */

const ModerationEngine = {
  negative: ['stupid','idiot','dumb','trash','garbage','hate','worst','loser'],
  targeted: ['you are',"you're",'your'],

  check(text) {
    const t = text.toLowerCase().trim();
    if (!t) return { allowed:false, reason:'Message cannot be empty' };

    const neg = this.negative.some(w => t.includes(w));
    const targ = this.targeted.some(p => t.includes(p));

    if (neg && targ) {
      return { allowed:false, reason:'Please keep the tone calm and constructive.' };
    }
    return { allowed:true };
  }
};

/* ================= AVATAR ================= */

const Avatar = ({ config={}, size=48 }) => (
  <div
    className={`${config.color || 'bg-blue-500'} rounded-full flex items-center justify-center`}
    style={{ width:size, height:size }}
  >
    <span style={{ fontSize:size*0.6 }}>{config.emoji || '😊'}</span>
  </div>
);

/* ================= APP ================= */

export default function App() {

  const [user,setUser] = useState(null);
  const [profile,setProfile] = useState(null);
  const [view,setView] = useState('splash');

  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [username,setUsername] = useState('');

  const [posts,setPosts] = useState([]);
  const [newPost,setNewPost] = useState('');
  const [commentInputs,setCommentInputs] = useState({});
  const [error,setError] = useState('');

  const [board,setBoard] = useState(Array(9).fill(null));
  const [player,setPlayer] = useState('X');

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
        setProfile(snap.data());
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
          return { id:d.id, ...data, profiles:p.data() };
        })
      );
      setPosts(loaded);
    });
  }, [user]);

  /* ===== AUTH ===== */

  const signUp = async () => {
    const cred = await createUserWithEmailAndPassword(auth,email,password);
    await setDoc(doc(db,'profiles',cred.user.uid),{
      username,
      aura:'blue',
      violations:0,
      avatar:{ emoji:'😊', color:'bg-blue-500' },
      createdAt:serverTimestamp()
    });
  };

  const login = async () =>
    signInWithEmailAndPassword(auth,email,password);

  const logout = async () =>
    signOut(auth);

  /* ===== POSTS ===== */

  const createPost = async () => {
    const check = ModerationEngine.check(newPost);
    if (!check.allowed) return setError(check.reason);

    await addDoc(collection(db,'posts'),{
      content:newPost,
      authorId:user.uid,
      reactions:[],
      createdAt:serverTimestamp()
    });
    setNewPost('');
    setError('');
  };

  const comment = async (postId,text) => {
    const check = ModerationEngine.check(text);
    if (!check.allowed) {
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
        <input placeholder="Username" onChange={e=>setUsername(e.target.value)} className="w-full mb-2 p-2 border"/>
        <input placeholder="Email" onChange={e=>setEmail(e.target.value)} className="w-full mb-2 p-2 border"/>
        <input type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} className="w-full mb-4 p-2 border"/>
        <button onClick={signUp} className="w-full bg-indigo-600 text-white py-2 rounded mb-2">Sign Up</button>
        <button onClick={login} className="w-full bg-gray-200 py-2 rounded">Log In</button>
      </div>
    </div>
  );

  if (view === 'onboarding') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-4">Welcome to Good Energy! 🌿</h2>
        <p className="text-gray-600 mb-6">Let's get you set up.</p>
        <button
          onClick={async () => {
            if (profile) {
              setView('feed');
            }
          }}
          className="w-full bg-indigo-600 text-white py-2 rounded"
        >
          Continue
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Good Energy</h1>
        <div className="flex gap-4 items-center">
          <a href="/legal.html" target="_blank" className="text-xs text-gray-500 hover:text-gray-700">Legal</a>
          <button onClick={logout}><LogOut/></button>
        </div>
      </div>

      <textarea
        value={newPost}
        onChange={e=>setNewPost(e.target.value)}
        className="w-full p-3 rounded mb-2"
        placeholder="Share something positive..."
      />

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

          <div className="flex gap-4 mt-2">
            <button onClick={()=>react(p)} className="flex gap-1">
              <Heart className={p.reactions.includes(user.uid) ? 'fill-red-500 text-red-500':''}/>
              {p.reactions.length}
            </button>
            <MessageCircle/>
          </div>

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
