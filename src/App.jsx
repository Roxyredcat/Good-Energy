import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, Send, LogOut, AlertCircle, X, Settings, Download, Trash2, Bell, Shield,
  MessageCircle, BookOpen, Users, ChevronDown, ChevronUp, Lock, UserPlus, UserCheck,
  UserX, Ban, Check, Clock
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, getDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, serverTimestamp, arrayUnion,
  arrayRemove, where, getDocs, limit
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

/* ── RATE LIMITING & LOCKOUT ── */
const LoginGuard = {
  attempts: {},
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
  windowMs: 10 * 60 * 1000,
  check(email) {
    const key = email.toLowerCase();
    const now = Date.now();
    if (!this.attempts[key]) return { allowed: true };
    const { count, firstAttempt, lockedUntil } = this.attempts[key];
    if (lockedUntil && now < lockedUntil) {
      const mins = Math.ceil((lockedUntil - now) / 60000);
      return { allowed: false, reason: `Account temporarily locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.` };
    }
    if (lockedUntil && now >= lockedUntil) { delete this.attempts[key]; return { allowed: true }; }
    if (now - firstAttempt > this.windowMs) { delete this.attempts[key]; return { allowed: true }; }
    return { allowed: true };
  },
  record(email, failed) {
    const key = email.toLowerCase();
    const now = Date.now();
    if (!failed) { delete this.attempts[key]; return; }
    if (!this.attempts[key]) this.attempts[key] = { count: 0, firstAttempt: now };
    this.attempts[key].count++;
    if (this.attempts[key].count >= this.maxAttempts) this.attempts[key].lockedUntil = now + this.lockoutMs;
  },
  remaining(email) {
    const key = email.toLowerCase();
    if (!this.attempts[key]) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - this.attempts[key].count);
  }
};

/* ── AURA SYSTEM ── */
const MY_AURA_CONFIG = {
  blue:   { label: '💙 Good Energy',   ring: '#6366f1', glow: 'rgba(99,102,241,0.35)',  statusText: 'Your energy is positive ✨',               gradient: 'from-indigo-400 to-violet-500' },
  orange: { label: '🌤 Take a Breath', ring: '#f97316', glow: 'rgba(249,115,22,0.3)',   statusText: 'Take a moment to reflect 🌿',               gradient: 'from-orange-400 to-amber-400' },
  black:  { label: '☁️ Quiet Mode',    ring: '#6b7280', glow: 'rgba(107,114,128,0.25)', statusText: "You're in Quiet Mode. Reflect & return 🌙", gradient: 'from-gray-500 to-gray-700' },
  banned: { label: '⛔ Suspended',      ring: '#ef4444', glow: 'rgba(239,68,68,0.3)',    statusText: 'Account suspended for policy violations.',  gradient: 'from-red-500 to-rose-600' },
  gold:   { label: '✨ Premium',        ring: '#f59e0b', glow: 'rgba(245,158,11,0.4)',   statusText: 'Premium member — thank you! 🌟',            gradient: 'from-yellow-400 to-amber-500' },
};
const getMyAura = (profile) => {
  if (!profile) return MY_AURA_CONFIG.blue;
  if (profile.aura === 'banned') return MY_AURA_CONFIG.banned;
  if (profile.isPremium) return MY_AURA_CONFIG.gold;
  return MY_AURA_CONFIG[profile.aura] || MY_AURA_CONFIG.blue;
};

/* ── MODERATION ENGINE ── */
const ModerationEngine = {
  negative: ['stupid','idiot','dumb','trash','garbage','hate','worst','loser'],
  targeted: ['you are',"you're",'your'],
  predatory: ['meet up','address','phone number','where do you','come over','alone','parents away','snap me','kik','whatsapp','private','secret','dont tell','tell no one'],
  check(text, isTeenPool = false) {
    const t = text.toLowerCase().trim();
    if (!t) return { allowed: false, reason: 'Message cannot be empty' };
    if (isTeenPool && this.predatory.some(p => t.includes(p)))
      return { allowed: false, reason: 'Unsafe message detected. We protect teen safety here.' };
    if (this.negative.some(w => t.includes(w)) && this.targeted.some(p => t.includes(p)))
      return { allowed: false, reason: 'Please keep the tone calm and constructive.' };
    return { allowed: true };
  }
};

/* ── LINK DETECTION ── */
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
    if (URL_REGEX.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline underline-offset-2 hover:text-indigo-700 break-all">{part}</a>;
    return <span key={i}>{part}</span>;
  });
}
function LinkPreview({ url }) {
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch) return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="relative" style={{ paddingBottom: '56.25%' }}>
        <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytMatch[1]}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="YouTube video" />
      </div>
    </div>
  );
  if (IMAGE_EXT_REGEX.test(url)) return <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50"><img src={url} alt="linked" className="w-full max-h-80 object-contain" /></div>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-600 hover:bg-indigo-100 transition-colors"><span className="text-lg">🔗</span><span className="truncate">{url}</span></a>;
}

/* ── AVATAR ── */
const Avatar = ({ config = {}, size = 48, myAuraRing = null }) => {
  const ringStyle = myAuraRing ? { boxShadow: `0 0 0 2.5px ${myAuraRing.ring}, 0 0 14px ${myAuraRing.glow}` } : {};
  const inner = (config && config.photoUrl)
    ? <img src={config.photoUrl} alt="avatar" className="rounded-full object-cover w-full h-full" />
    : <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-violet-500"><span style={{ fontSize: size * 0.45 }}>{(config && config.emoji) || '😊'}</span></div>;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size, minWidth: size, minHeight: size }}>
      <div className="w-full h-full rounded-full overflow-hidden" style={ringStyle}>{inner}</div>
    </div>
  );
};

/* ── POST MEDIA ── */
function PostMedia({ mediaUrl }) {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith('data:video') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm'))
    return <div className="mt-3 rounded-2xl overflow-hidden bg-black"><video src={mediaUrl} controls className="w-full max-h-80 object-contain" /></div>;
  return <div className="mt-3 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100"><img src={mediaUrl} alt="post" className="w-full max-h-80 object-contain" /></div>;
}

/* ── FAQ DATA ── */
const FAQ_DATA = [
  {
    category: '🔑 Account & Password',
    items: [
      { q: 'How do I reset my password?', a: 'On the login screen, tap "Forgot Password?" and enter your email. We\'ll send a reset link within a few minutes. Check your spam folder if you don\'t see it.' },
      { q: 'My account is locked. What do I do?', a: 'After 5 failed login attempts, your account is temporarily locked for 15 minutes to protect you. Wait 15 minutes and try again. If you\'ve forgotten your password, use the "Forgot Password?" option.' },
      { q: 'How do I delete my account?', a: 'Go to Settings (⚙️ icon in the header) → Delete Account. You\'ll need to confirm with your password. Per our Privacy Policy, all data is permanently deleted within 30 days.' },
    ]
  },
  {
    category: '💙 The Aura System',
    items: [
      { q: 'What is the Aura system?', a: 'Your Aura is a private energy indicator only visible to YOU — never to other users. Blue = Good Energy, Orange = Take a Breath (1 warning), Grey = Quiet Mode (2+ warnings), Gold = Premium member.' },
      { q: 'Can other users see my Aura?', a: 'No. Your Aura is 100% private by design. Other users only ever see a neutral avatar — no rings, no colors, no indicators. This is core to our non-stigmatizing moderation philosophy.' },
      { q: 'How do I get out of Quiet Mode?', a: 'In Quiet Mode, you\'ll be taken to the Reset Space where you can play a relaxing game. Once you\'re ready, click "Return to Feed." Your violations reset and your Aura returns to Blue.' },
    ]
  },
  {
    category: '⚖️ Appeals & Suspensions',
    items: [
      { q: 'My account was suspended. Can I appeal?', a: 'Yes. Chat with Sage 🌿 and describe your situation. Sage can walk you through the appeal process. Suspensions for predatory behavior toward minors are permanent and cannot be appealed.' },
      { q: 'I was warned unfairly. What can I do?', a: 'Use the "Chat with Sage" button. Explain what happened and Sage will guide you through the process.' },
    ]
  },
  {
    category: '👨‍👩‍👧 Teen Safety & Parental Consent',
    items: [
      { q: 'Why does my teen need parental consent?', a: 'Users under 18 are placed in a protected Teen Pool with extra moderation. Parental consent ensures a guardian is aware their child is using Good Energy.' },
      { q: 'How does parental verification work?', a: 'When a user under 18 signs up, we send a verification email to the parent/guardian. The parent clicks a link to verify. Until verified, the account cannot access the main feed.' },
      { q: 'What extra protections are in the Teen Pool?', a: 'Teens are in a separate pool where predatory language detection is much stricter. Any unsafe message triggers an immediate account suspension.' },
    ]
  },
  {
    category: '✨ Premium Features',
    items: [
      { q: 'What does Premium include?', a: 'Premium ($4.99/month) includes: the Word Finder game 🎮, custom emoji reactions 😍, priority moderation ⚡, and a Gold Aura ring visible only to you.' },
      { q: 'How do I cancel Premium?', a: 'Chat with Sage or go to Settings. Premium cancellation is processed within 24 hours.' },
    ]
  },
  {
    category: '🗑️ Data & Privacy',
    items: [
      { q: 'How do I export my data?', a: 'Go to Settings (⚙️) → Export My Data. You\'ll get a JSON file with your profile and all your posts.' },
      { q: 'What data does Good Energy collect?', a: 'We collect your email, username, age, posts, and comments. We never sell your data. Read our full Privacy Policy via the Legal link.' },
    ]
  },
];

/* ── SAGE AI ── */
function SageChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Sage 🌿 — Good Energy's support guide. I'm here to help with anything: account issues, how the app works, appeals, or just finding your way around. What can I help you with today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are Sage 🌿, the warm and caring AI support guide for Good Energy — a positive social media app. You speak like a wise, kind friend — never robotic or corporate. You are NOT Claude, you are Sage, created specifically for Good Energy.

Good Energy facts you know:
- Positive social media platform focused on good vibes and community
- Aura system is PRIVATE — only visible to the user themselves, never others
- Blue aura = Good standing, Orange = 1 warning, Grey/Black = Quiet Mode (2+ warnings), Gold = Premium, Red = Suspended
- Teen Pool: users under 18 have stricter moderation and need parental consent
- Premium is $4.99/month: Word Finder game, custom emoji reactions, priority moderation
- Password reset available on login screen via "Forgot Password?"
- Accounts lock 15 minutes after 5 failed login attempts
- Data export available in Settings
- Account deletion takes 30 days to fully purge
- Appeals available for suspensions (except predatory behavior toward minors — permanent)
- Friend requests: users can send, accept, or decline friend requests from profile pages. A Friend Requests page shows all pending incoming requests.
- Block user: users can block others from their profile page. Blocked users cannot message you and their posts are hidden. You can unblock from their profile anytime.
- Built with love by a solo founder

Respond warmly and clearly. Be honest if unsure. Keep responses concise. Use occasional natural emojis.`,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "I'm having a little trouble right now 🌿 Please try again in a moment.";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting right now 🌿 Please try again in a moment, or check our FAQ for quick answers." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:w-96 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🌿</div>
            <div><p className="font-bold text-white text-sm">Sage</p><p className="text-white/70 text-xs">Good Energy Support Guide</p></div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {m.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm flex-shrink-0 mt-1">🌿</div>}
              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm">🌿</div>
              <div className="bg-white px-4 py-3 rounded-2xl shadow-sm"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="bg-white border-t border-gray-100 p-3 flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Sage anything..." className="flex-1 p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-gray-50 text-sm" />
          <button onClick={send} disabled={loading || !input.trim()} className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-40"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ PAGE ── */
function FAQPage({ onBack, onOpenSage }) {
  const [open, setOpen] = useState({});
  const toggle = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #f8faff 50%, #fdf4ff 100%)' }}>
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition">← Back</button>
          <span className="text-xl">🌿</span>
          <h1 className="text-base font-black text-gray-900">Help Center</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 mb-6 text-white text-center shadow-xl">
          <div className="text-4xl mb-2">🌿</div>
          <h2 className="text-2xl font-black mb-1">How can we help?</h2>
          <p className="text-white/80 text-sm mb-4">Browse our FAQ or chat with Sage for personalized help</p>
          <button onClick={onOpenSage} className="bg-white text-emerald-600 px-6 py-2.5 rounded-2xl font-bold hover:shadow-lg transition-all hover:-translate-y-0.5 text-sm">💬 Chat with Sage</button>
        </div>
        {FAQ_DATA.map((section, si) => (
          <div key={si} className="mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{section.category}</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {section.items.map((item, ii) => {
                const key = `${si}-${ii}`;
                return (
                  <div key={ii} className="border-b border-gray-50 last:border-b-0">
                    <button onClick={() => toggle(key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition">
                      <span className="font-medium text-sm text-gray-800 pr-4">{item.q}</span>
                      {open[key] ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                    </button>
                    {open[key] && <div className="px-4 pb-4 text-sm text-gray-500 leading-relaxed bg-gray-50">{item.a}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center mt-4 mb-8">
          <div className="text-3xl mb-2">🤔</div>
          <p className="font-bold text-gray-800 mb-1">Still need help?</p>
          <p className="text-sm text-gray-400 mb-4">Sage is available 24/7 and knows everything about Good Energy</p>
          <button onClick={onOpenSage} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2.5 rounded-xl font-bold hover:opacity-90 transition text-sm">🌿 Chat with Sage</button>
        </div>
      </div>
    </div>
  );
}

/* ── FORUMS PAGE ── */
function ForumsPage({ user, profile, onBack }) {
  const [posts, setPosts] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [category, setCategory] = useState('general');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [replies, setReplies] = useState({});

  const categories = [
    { value: 'general', label: '💬 General' },
    { value: 'help', label: '🙋 Help & Questions' },
    { value: 'feedback', label: '💡 Feedback & Ideas' },
    { value: 'positivity', label: '✨ Positivity Corner' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'forums'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, async snap => {
      const loaded = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.authorId));
        return { id: d.id, ...data, authorProfile: pSnap.exists() ? pSnap.data() : null };
      }));
      setPosts(loaded);
    });
  }, []);

  const loadReplies = (postId) => {
    if (replies[postId] !== undefined) return;
    setReplies(prev => ({ ...prev, [postId]: [] }));
    const q = query(collection(db, 'forums', postId, 'replies'), orderBy('createdAt', 'asc'));
    onSnapshot(q, async snap => {
      const r = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.authorId));
        return { id: d.id, ...data, authorProfile: pSnap.exists() ? pSnap.data() : null };
      }));
      setReplies(prev => ({ ...prev, [postId]: r }));
    });
  };

  const toggleReplies = (postId) => { setExpandedReplies(prev => ({ ...prev, [postId]: !prev[postId] })); loadReplies(postId); };

  const submitPost = async () => {
    if (!newTitle.trim()) { setError('Please add a title'); return; }
    const check = ModerationEngine.check(newTitle + ' ' + newBody);
    if (!check.allowed) { setError(check.reason); return; }
    setPosting(true);
    try {
      await addDoc(collection(db, 'forums'), { title: newTitle, body: newBody, category, authorId: user.uid, createdAt: serverTimestamp(), replyCount: 0, likes: [] });
      setNewTitle(''); setNewBody(''); setError('');
    } catch (err) { setError('Failed to post: ' + err.message); }
    setPosting(false);
  };

  const submitReply = async (postId, text) => {
    if (!text.trim()) return;
    const check = ModerationEngine.check(text);
    if (!check.allowed) { setError(check.reason); return; }
    try {
      await addDoc(collection(db, 'forums', postId, 'replies'), { content: text, authorId: user.uid, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'forums', postId), { replyCount: (posts.find(p => p.id === postId)?.replyCount || 0) + 1 });
      setReplyInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) { setError('Failed to reply: ' + err.message); }
  };

  const likePost = async (post) => {
    const has = post.likes?.includes(user.uid);
    await updateDoc(doc(db, 'forums', post.id), { likes: has ? post.likes.filter(id => id !== user.uid) : arrayUnion(user.uid) });
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 50%, #fdf4ff 100%)' }}>
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition">← Back</button>
          <span className="text-xl">🌿</span>
          <h1 className="text-base font-black text-gray-900">Community Forums</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-gray-700 mb-3">✏️ Start a discussion</h3>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title..." className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Share your thoughts... (optional)" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
          <button onClick={submitPost} disabled={posting || !newTitle.trim()} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-40">{posting ? 'Posting...' : 'Post'}</button>
        </div>
        {posts.length === 0 && <div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">💬</div><p className="font-medium">No discussions yet. Start one!</p></div>}
        {posts.map(post => {
          const catLabel = categories.find(c => c.value === post.category)?.label || '💬 General';
          const isExpanded = expandedReplies[post.id];
          const postReplies = replies[post.id] || [];
          return (
            <div key={post.id} className="bg-white rounded-2xl mb-3 shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-indigo-200" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2"><span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-medium">{catLabel}</span></div>
                <div className="flex gap-3">
                  <Avatar config={post.authorProfile?.avatar || {}} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{post.title}</p>
                    <p className="text-xs text-gray-400">{post.authorProfile?.username || 'Unknown'}</p>
                    {post.body && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{post.body}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => likePost(post)} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition ${post.likes?.includes(user.uid) ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400 hover:bg-red-50'}`}>
                    <Heart size={12} className={post.likes?.includes(user.uid) ? 'fill-red-500' : ''} /> {post.likes?.length || 0}
                  </button>
                  <button onClick={() => toggleReplies(post.id)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-500 transition">
                    <MessageCircle size={12} /> {post.replyCount || 0} {isExpanded ? 'Hide' : 'Reply'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="mt-3 border-t border-gray-50 pt-3">
                    {postReplies.map((r, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <Avatar config={r.authorProfile?.avatar || {}} size={26} />
                        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm">
                          <span className="font-semibold text-xs text-gray-500">{r.authorProfile?.username || 'Unknown'} </span>
                          <span className="text-gray-700">{r.content}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Avatar config={profile?.avatar} size={26} />
                      <input value={replyInputs[post.id] || ''} onChange={e => setReplyInputs(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submitReply(post.id, replyInputs[post.id])} placeholder="Write a reply..." className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <button onClick={() => submitReply(post.id, replyInputs[post.id])} className="text-indigo-500 hover:text-indigo-700 transition"><Send size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── FRIEND REQUESTS PAGE ── */
function FriendRequestsPage({ user, onBack }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, async snap => {
      const loaded = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.fromUid));
        return { id: d.id, ...data, fromProfile: pSnap.exists() ? pSnap.data() : null };
      }));
      setRequests(loaded);
      setLoading(false);
    });
  }, [user.uid]);

  const accept = async (req) => {
    try {
      await updateDoc(doc(db, 'friendRequests', req.id), { status: 'accepted' });
      await updateDoc(doc(db, 'profiles', user.uid), { friends: arrayUnion(req.fromUid) });
      await updateDoc(doc(db, 'profiles', req.fromUid), { friends: arrayUnion(user.uid) });
    } catch (err) { console.error(err); }
  };

  const decline = async (req) => {
    try {
      await updateDoc(doc(db, 'friendRequests', req.id), { status: 'declined' });
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 50%, #fdf4ff 100%)' }}>
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition">← Back</button>
          <span className="text-xl">👥</span>
          <h1 className="text-base font-black text-gray-900">Friend Requests</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4">
        {loading && <div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">⏳</div><p>Loading...</p></div>}
        {!loading && requests.length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <div className="text-5xl mb-3">👥</div>
            <p className="font-medium text-gray-400">No pending friend requests</p>
            <p className="text-sm mt-1 text-gray-300">Find people by searching in the feed and send them a request!</p>
          </div>
        )}
        {requests.map(req => (
          <div key={req.id} className="bg-white rounded-2xl mb-3 shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <Avatar config={req.fromProfile?.avatar || {}} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{req.fromProfile?.username || 'Unknown'}</p>
                <p className="text-xs text-gray-400">Wants to be your friend 👋</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => accept(req)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition"
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  onClick={() => decline(req)}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════ */
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
  const [verifyTokenError, setVerifyTokenError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [expandedComments, setExpandedComments] = useState({});
  const [postComments, setPostComments] = useState({});
  const [showSage, setShowSage] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // ── Friend & Block state ──
  const [friendRequestStatus, setFriendRequestStatus] = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showBlockConfirm, setShowBlockConfirm] = useState(null);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(null);

  /* ── AUTH LISTENER ── */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setProfile(null); setView('splash'); setNewPost(''); setNewPostMedia(null); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'profiles', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data); setIsPremium(data.isPremium || false); setIsTeenPool(data.isTeenPool || false); setShowAvatarSetup(false);
        setBlockedUsers(data.blockedUsers || []);
        setView(data.isNewUser ? 'onboarding' : 'feed');
      } else { setProfile(null); setShowAvatarSetup(false); setView('onboarding'); }
    });
  }, []);

  // ── Live profile listener (catches block/friend/aura changes) ──
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'profiles', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setBlockedUsers(data.blockedUsers || []);
        setIsPremium(data.isPremium || false);
        setIsTeenPool(data.isTeenPool || false);
      }
    });
  }, [user]);

  // ── Pending friend request badge ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    return onSnapshot(q, snap => { setPendingRequestCount(snap.size); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async snap => {
      const loaded = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const pSnap = await getDoc(doc(db, 'profiles', data.authorId));
        if (isTeenPool && !data.isTeenPool && data.authorId !== user.uid) return null;
        if (blockedUsers.includes(data.authorId)) return null;
        return { id: d.id, ...data, profiles: pSnap.exists() ? pSnap.data() : null };
      }));
      setPosts(loaded.filter(Boolean));
    });
  }, [user, isTeenPool, blockedUsers]);

  useEffect(() => {
    if (!user || !chatWith) return;
    const conversationId = [user.uid, chatWith].sort().join('_');
    const q = query(collection(db, 'messages', conversationId, 'texts'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => { setMessages(prev => ({ ...prev, [conversationId]: snap.docs.map(d => ({ id: d.id, ...d.data() })) })); });
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
      const filtered = enriched.filter(c => !blockedUsers.includes(c.uid));
      filtered.sort((a, b) => (b.lastMsgAt?.seconds || 0) - (a.lastMsgAt?.seconds || 0));
      setConversations(filtered);
      setTotalUnread(filtered.reduce((sum, c) => sum + (c.unread || 0), 0));
    });
  }, [user, blockedUsers]);

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

  // ── Check friendship/request status for a target user ──
  const checkFriendStatus = async (targetUid) => {
    if (!user || !targetUid || !profile) return 'none';
    if (profile?.friends?.includes(targetUid)) return 'friends';
    const outQ = query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid), where('toUid', '==', targetUid), where('status', '==', 'pending'));
    const outSnap = await getDocs(outQ);
    if (!outSnap.empty) return 'sent';
    const inQ = query(collection(db, 'friendRequests'), where('fromUid', '==', targetUid), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const inSnap = await getDocs(inQ);
    if (!inSnap.empty) return 'received';
    return 'none';
  };

  useEffect(() => {
    if (!selectedProfileUser || !user) return;
    const uid = selectedProfileUser.uid;
    checkFriendStatus(uid).then(status => {
      setFriendRequestStatus(prev => ({ ...prev, [uid]: status }));
    });
  }, [selectedProfileUser, profile]);

  // ── Friend request actions ──
  const sendFriendRequest = async (targetUid) => {
    try {
      await addDoc(collection(db, 'friendRequests'), { fromUid: user.uid, toUid: targetUid, status: 'pending', createdAt: serverTimestamp() });
      setFriendRequestStatus(prev => ({ ...prev, [targetUid]: 'sent' }));
    } catch (err) { setError('Failed to send request: ' + err.message); }
  };

  const cancelFriendRequest = async (targetUid) => {
    try {
      const q = query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid), where('toUid', '==', targetUid), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(doc(db, 'friendRequests', d.id));
      setFriendRequestStatus(prev => ({ ...prev, [targetUid]: 'none' }));
    } catch (err) { setError('Failed to cancel request: ' + err.message); }
  };

  const acceptFriendRequestFromProfile = async (targetUid) => {
    try {
      const q = query(collection(db, 'friendRequests'), where('fromUid', '==', targetUid), where('toUid', '==', user.uid), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      for (const d of snap.docs) await updateDoc(doc(db, 'friendRequests', d.id), { status: 'accepted' });
      await updateDoc(doc(db, 'profiles', user.uid), { friends: arrayUnion(targetUid) });
      await updateDoc(doc(db, 'profiles', targetUid), { friends: arrayUnion(user.uid) });
      setFriendRequestStatus(prev => ({ ...prev, [targetUid]: 'friends' }));
    } catch (err) { setError('Failed to accept request: ' + err.message); }
  };

  const unfriend = async (targetUid) => {
    try {
      await updateDoc(doc(db, 'profiles', user.uid), { friends: arrayRemove(targetUid) });
      await updateDoc(doc(db, 'profiles', targetUid), { friends: arrayRemove(user.uid) });
      setFriendRequestStatus(prev => ({ ...prev, [targetUid]: 'none' }));
    } catch (err) { setError('Failed to unfriend: ' + err.message); }
  };

  // ── Block / Unblock ──
  const blockUser = async (targetUid) => {
    try {
      await updateDoc(doc(db, 'profiles', user.uid), { blockedUsers: arrayUnion(targetUid), friends: arrayRemove(targetUid) });
      await updateDoc(doc(db, 'profiles', targetUid), { friends: arrayRemove(user.uid) });
      setBlockedUsers(prev => [...prev, targetUid]);
      setFriendRequestStatus(prev => ({ ...prev, [targetUid]: 'none' }));
      setShowBlockConfirm(null);
      setSelectedProfileUser(null);
    } catch (err) { setError('Failed to block user: ' + err.message); }
  };

  const unblockUser = async (targetUid) => {
    try {
      await updateDoc(doc(db, 'profiles', user.uid), { blockedUsers: arrayRemove(targetUid) });
      setBlockedUsers(prev => prev.filter(id => id !== targetUid));
      setShowUnblockConfirm(null);
    } catch (err) { setError('Failed to unblock: ' + err.message); }
  };

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
  const toggleComments = (postId) => { setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] })); loadComments(postId); };

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
    if (blockedUsers.includes(uid)) { setError("You've blocked this user. Unblock them to send messages."); return; }
    setChatWith(uid); setChatWithProfile(profileData); setSelectedProfileUser(null); setShowInbox(false); setView('chat');
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
    if (blockedUsers.includes(chatWith)) { setError("You've blocked this user."); return; }
    const conversationId = [user.uid, chatWith].sort().join('_');
    const text = newMessage; setNewMessage('');
    try {
      await addDoc(collection(db, 'messages', conversationId, 'texts'), { senderId: user.uid, senderName: profile?.username || 'Unknown', text, createdAt: serverTimestamp() });
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
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(p => p.uid !== user.uid && p.username?.toLowerCase().includes(q.toLowerCase()) && !p.isDeleted && !blockedUsers.includes(p.uid))
      );
    } catch (err) { console.error(err); } finally { setSearching(false); }
  };

  /* ── AUTH ── */
  const login = async () => {
    if (!email || !password) { setError('Please fill in email and password'); return; }
    const guard = LoginGuard.check(email);
    if (!guard.allowed) { setError(guard.reason); return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      LoginGuard.record(email, false);
      setEmail(''); setPassword(''); setError('');
    } catch (err) {
      LoginGuard.record(email, true);
      const remaining = LoginGuard.remaining(email);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError(`Email or password is incorrect.${remaining < 5 && remaining > 0 ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.` : ''}`);
      } else { setError(err.message); }
    }
  };

  const signUp = async () => {
    if (!username || !email || !password) { setError('Please fill in all fields'); return; }
    if (password !== passwordConfirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!age || parseInt(age) < 13) { setError('You must be at least 13 years old'); return; }
    const ageNum = parseInt(age);
    if (ageNum < 18 && !parentalEmail) { setError('Users under 18 must provide a parent/guardian email'); return; }
    if (ageNum < 18 && !parentalEmail.includes('@')) { setError('Please enter a valid parent/guardian email'); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'profiles', cred.user.uid), {
        username, age: ageNum, aura: 'blue', violations: 0,
        avatar: { emoji: '😊', color: 'bg-indigo-500' },
        isPremium: false, isTeenPool: ageNum < 18, isNewUser: true,
        parentalEmail: ageNum < 18 ? parentalEmail : null,
        parentalVerified: false,
        friends: [],
        blockedUsers: [],
        createdAt: serverTimestamp()
      });
      setEmail(''); setPassword(''); setPasswordConfirm(''); setUsername(''); setAge(''); setParentalEmail(''); setError('');
      if (ageNum < 18) setView('parental-pending');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email already has an account.');
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else setError(err.message);
    }
  };

  const sendPasswordReset = async () => {
    if (!resetEmail) { setError('Please enter your email'); return; }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true); setError('');
    } catch (err) {
      if (err.code === 'auth/user-not-found') setError('No account found with that email.');
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
          const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
          const maxSize = 200; let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } } else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
          canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
          const photoUrl = canvas.toDataURL('image/jpeg', 0.7);
          await updateDoc(doc(db, 'profiles', user.uid), { 'avatar.photoUrl': photoUrl });
          setProfile(p => ({ ...p, avatar: { ...(p.avatar || {}), photoUrl } }));
          if (showAvatarSetup) { setShowAvatarSetup(false); setView('feed'); } else { setShowProfileEdit(false); }
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
      link.href = url; link.download = `good-energy-export-${Date.now()}.json`; link.click();
      URL.revokeObjectURL(url); setError('');
      await updateDoc(doc(db, 'profiles', user.uid), { dataExportedAt: serverTimestamp() });
    } catch (err) { setError('Failed to export data: ' + err.message); }
  };

  const win = b => { for (let [a, b2, c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) if (b[a] && b[a] === b[b2] && b[a] === b[c]) return b[a]; };
  const play = i => {
    if (board[i]) return;
    const b = [...board]; b[i] = player; setBoard(b);
    if (win(b) || b.every(Boolean)) setTimeout(() => { setBoard(Array(9).fill(null)); setPlayer('X'); }, 300);
    else setPlayer(p => p === 'X' ? 'O' : 'X');
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-sm";

  /* ════════════ VIEWS ════════════ */
  if (view === 'faq') return <FAQPage onBack={() => setView('feed')} onOpenSage={() => { setView('feed'); setTimeout(() => setShowSage(true), 100); }} />;
  if (view === 'forums') return <ForumsPage user={user} profile={profile} onBack={() => setView('feed')} />;
  if (view === 'friendRequests') return <FriendRequestsPage user={user} onBack={() => setView('feed')} />;

  if (view === 'splash') return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' }}>
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 2px), radial-gradient(circle at 75% 75%, white 2px, transparent 2px)', backgroundSize: '60px 60px' }} />
      <div className="relative z-10 text-center px-6">
        <div className="text-7xl mb-4" style={{ filter: 'drop-shadow(0 4px 24px rgba(255,255,255,0.4))' }}>🌿</div>
        <h1 className="text-6xl font-black text-white mb-3 tracking-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.2)' }}>Good Energy</h1>
        <p className="text-white/80 text-xl mb-10 font-light">A positive space for everyone ✨</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={() => { setView('signup'); setError(''); setEmail(''); setPassword(''); }} className="bg-white text-indigo-700 px-10 py-3.5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">Get Started</button>
          <button onClick={() => { setView('login'); setError(''); setEmail(''); setPassword(''); }} className="bg-white/20 backdrop-blur-sm text-white border border-white/40 px-10 py-3.5 rounded-2xl font-bold text-lg hover:bg-white/30 transition-all">Log In</button>
        </div>
        <div className="mt-10 flex gap-4 text-sm text-white/60">
          <a href="/legal.html" target="_blank" className="hover:text-white transition-colors">Terms of Service</a>
          <span>•</span>
          <a href="/legal.html" target="_blank" className="hover:text-white transition-colors">Privacy Policy</a>
        </div>
      </div>
    </div>
  );

  if (view === 'login' && forgotPassword) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-indigo-50">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
          <p className="text-gray-400 text-sm mt-1">We'll send a reset link to your email</p>
        </div>
        {resetSent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📬</div>
            <p className="font-bold text-green-600 mb-2">Reset email sent!</p>
            <p className="text-gray-400 text-sm mb-6">Check your inbox (and spam folder). The link expires in 1 hour.</p>
            <button onClick={() => { setForgotPassword(false); setResetSent(false); setResetEmail(''); }} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">Back to Login</button>
          </div>
        ) : (
          <>
            <input placeholder="Your email address" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className={`${inputCls} mb-3`} />
            {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-xl">{error}</div>}
            <button onClick={sendPasswordReset} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">Send Reset Link</button>
            <button onClick={() => { setForgotPassword(false); setError(''); }} className="w-full text-center text-sm text-indigo-600 hover:underline py-1">← Back to Login</button>
          </>
        )}
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
        <div className="relative mb-2">
          <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} className={`${inputCls} pr-16`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-xs text-indigo-500 font-medium">{showPassword ? 'Hide' : 'Show'}</button>
        </div>
        <button onClick={() => { setForgotPassword(true); setError(''); setResetEmail(email); }} className="text-xs text-indigo-500 hover:underline mb-4 block text-right w-full">Forgot password?</button>
        {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2"><Lock size={14} className="flex-shrink-0 mt-0.5" /><span>{error}</span></div>}
        <button onClick={login} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">Log In</button>
        <button onClick={() => { setView('signup'); setError(''); setPassword(''); setEmail(''); }} className="w-full text-center text-sm text-indigo-600 hover:underline py-1">Need an account? Sign Up</button>
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
        <input type="number" placeholder="Age" min="13" max="120" value={age} onChange={e => setAge(e.target.value)} className={`${inputCls} mb-3`} />
        {age && parseInt(age) < 18 && (
          <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-xs text-orange-600 mb-2 font-medium">⚠️ Users under 18 need parental consent</p>
            <input placeholder="Parent/Guardian Email" type="email" value={parentalEmail} onChange={e => setParentalEmail(e.target.value)} className={inputCls} />
          </div>
        )}
        {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-xl border border-red-100">{error}</div>}
        <p className="text-xs text-gray-400 mb-3 text-center">By signing up you agree to our <a href="/legal.html" target="_blank" className="text-indigo-500 underline">Terms of Service</a> and <a href="/legal.html" target="_blank" className="text-indigo-500 underline">Privacy Policy</a>.</p>
        <button onClick={signUp} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">Create Account</button>
        <button onClick={() => { setView('login'); setError(''); setPasswordConfirm(''); setUsername(''); setAge(''); setParentalEmail(''); }} className="w-full text-center text-sm text-indigo-600 hover:underline py-1">Already have an account? Log In</button>
      </div>
    </div>
  );

  if (showAvatarSetup && user && profile) {
    const myAura = getMyAura(profile);
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
          <h2 className="text-2xl font-bold mb-1">Set Your Avatar 🎨</h2>
          <p className="text-gray-400 text-sm mb-5">Upload a photo or pick an emoji</p>
          <div className="flex justify-center mb-6"><Avatar config={profile?.avatar} size={96} myAuraRing={myAura} /></div>
          <label className="block mb-4">
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl cursor-pointer block hover:opacity-90 transition font-medium">📸 Upload Photo</span>
          </label>
          <p className="text-sm text-gray-400 mb-3">Or choose an emoji:</p>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {['😊','😍','🤔','😂','🎉','😎','🌟','💪','❤️','🔥','✨','🎨','😇','🤝','💧','⭐','🌈','🦄','🤖','🌻','🎯','🏆'].map(emoji => (
              <button key={emoji} onClick={async () => { const a = { emoji, color: 'bg-indigo-500' }; await updateDoc(doc(db, 'profiles', user.uid), { avatar: a }); setProfile(p => ({ ...p, avatar: a })); setShowAvatarSetup(false); setView('feed'); }} className="text-2xl hover:scale-125 transition-transform">{emoji}</button>
            ))}
          </div>
          <button onClick={() => { setShowAvatarSetup(false); setView('feed'); }} className="w-full bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600">Skip for Now</button>
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
        <button onClick={async () => { try { await setDoc(doc(db, 'profiles', user.uid), { isPremium: false, isNewUser: false }, { merge: true }); setIsPremium(false); setShowAvatarSetup(true); } catch (err) { setError('Failed to continue. Please try again.'); } }} className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl mb-3 hover:bg-gray-200 transition font-medium">Continue Free</button>
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
        <button onClick={async () => { try { await setDoc(doc(db, 'profiles', user.uid), { isPremium: true, isNewUser: false }, { merge: true }); setIsPremium(true); setShowAvatarSetup(true); } catch (err) { setError('Failed to subscribe. Please try again.'); } }} className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white py-3 rounded-xl mb-3 font-bold hover:opacity-90 transition shadow-lg shadow-yellow-200">Subscribe Now</button>
        <button onClick={async () => { try { await setDoc(doc(db, 'profiles', user.uid), { isPremium: false, isNewUser: false }, { merge: true }); setIsPremium(false); setShowAvatarSetup(true); } catch (err) { setError('Failed to continue.'); } }} className="w-full bg-gray-100 py-3 rounded-xl hover:bg-gray-200 transition text-gray-600">Skip for Now</button>
      </div>
    </div>
  );

  if (view === 'parental-pending') return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-blue-50">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-xl border-2 border-blue-200 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold mb-3">Parental Consent Pending</h2>
        <p className="text-gray-500 mb-4 text-sm">We sent a verification email to:</p>
        <div className="bg-blue-50 p-3 rounded-xl mb-5 border border-blue-200"><p className="font-mono text-sm text-blue-700">{profile?.parentalEmail}</p></div>
        <p className="text-sm text-gray-400 mb-6">Once your parent or guardian clicks the link in the email, you'll be able to access Good Energy.</p>
        <button onClick={logout} className="w-full bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-300 transition">Sign Out</button>
      </div>
    </div>
  );

  if (view === 'verify-parent') return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-green-50">
      <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-xl text-center">
        {verifyTokenError
          ? (<><div className="text-5xl mb-4">❌</div><h2 className="text-2xl font-bold text-red-600 mb-4">Verification Failed</h2><p className="text-gray-500 mb-6">{verifyTokenError}</p><button onClick={() => setView('splash')} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold">Go Back</button></>)
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
          {board.map((c, i) => (<button key={i} onClick={() => play(i)} className={`w-16 h-16 rounded-xl text-2xl font-bold transition mx-auto ${c ? 'bg-indigo-100' : 'bg-gray-100 hover:bg-gray-200'}`}>{c}</button>))}
        </div>
        <button onClick={() => { updateDoc(doc(db, 'profiles', user.uid), { violations: 0, aura: 'blue' }); setView('feed'); }} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2.5 rounded-xl font-medium w-full">Return to Feed</button>
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
        <button onClick={() => setShowSage(true)} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition mb-3">🌿 Chat with Sage to Appeal</button>
        <button onClick={logout} className="w-full bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-medium hover:bg-gray-300 transition">Sign Out</button>
        {showSage && <SageChat onClose={() => setShowSage(false)} />}
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
            {['L','O','V','E','C','A','L','M','J','O','Y','S','K','I','N','D'].map((l, i) => (<div key={i} className="bg-white p-3 rounded-xl font-black text-lg cursor-pointer hover:bg-indigo-100 transition shadow-sm">{l}</div>))}
          </div>
          <div className="text-5xl font-black text-amber-500 mb-5">{wordScore} <span className="text-xl text-gray-400">pts</span></div>
          <button onClick={() => setWordScore(wordScore + 100)} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition mb-2">+ Find Word (+100)</button>
        </div>
      </div>
    </div>
  );

  /* ── PROFILE VIEW with Friend/Block actions ── */
  if (selectedProfileUser) {
    const targetUid = selectedProfileUser.uid;
    const isBlocked = blockedUsers.includes(targetUid);
    const friendStatus = friendRequestStatus[targetUid] || 'none';
    const isFriend = profile?.friends?.includes(targetUid);

    return (
      <div className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <button onClick={() => setSelectedProfileUser(null)} className="mb-4 bg-white text-indigo-600 px-4 py-2 rounded-xl shadow-sm font-medium hover:shadow-md transition">← Back to Feed</button>
        <div className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-indigo-400 to-violet-500 relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          <div className="px-8 pb-8 text-center -mt-12">
            <div className="flex justify-center mb-3"><Avatar config={selectedProfileUser.avatar} size={80} /></div>
            <h2 className="text-2xl font-bold mb-1">{selectedProfileUser.username}</h2>
            {selectedProfileUser.age && <p className="text-gray-400 text-sm mb-1">Age {selectedProfileUser.age}</p>}
            {isFriend && <span className="inline-block text-xs text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full font-medium mb-4">👥 Friends</span>}
            {!isFriend && <div className="mb-4" />}

            {targetUid !== user?.uid && !isBlocked && (
              <div className="space-y-2.5">
                <button onClick={() => openChat(selectedProfileUser, targetUid)} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-200">
                  💬 Send Message
                </button>

                {/* Friend request controls */}
                {!isFriend && friendStatus === 'none' && (
                  <button onClick={() => sendFriendRequest(targetUid)} className="w-full flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition">
                    <UserPlus size={16} /> Add Friend
                  </button>
                )}
                {!isFriend && friendStatus === 'sent' && (
                  <button onClick={() => cancelFriendRequest(targetUid)} className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 py-2.5 rounded-xl font-medium hover:bg-gray-100 transition">
                    <Clock size={16} /> Request Sent — Cancel
                  </button>
                )}
                {!isFriend && friendStatus === 'received' && (
                  <button onClick={() => acceptFriendRequestFromProfile(targetUid)} className="w-full flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 py-2.5 rounded-xl font-bold hover:bg-green-100 transition">
                    <Check size={16} /> Accept Friend Request
                  </button>
                )}
                {isFriend && (
                  <button onClick={() => unfriend(targetUid)} className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 py-2.5 rounded-xl font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                    <UserX size={16} /> Unfriend
                  </button>
                )}

                {/* Block */}
                <button onClick={() => setShowBlockConfirm(targetUid)} className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-500 py-2.5 rounded-xl font-medium hover:bg-red-100 transition text-sm">
                  <Ban size={14} /> Block User
                </button>
              </div>
            )}

            {targetUid !== user?.uid && isBlocked && (
              <div className="space-y-2.5">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 font-medium">🚫 You've blocked this user</div>
                <button onClick={() => setShowUnblockConfirm(targetUid)} className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-100 transition">
                  <UserCheck size={16} /> Unblock User
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Block confirm */}
        {showBlockConfirm === targetUid && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-3xl w-80 border-2 border-red-200 shadow-2xl text-center">
              <div className="text-4xl mb-3">🚫</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Block {selectedProfileUser.username}?</h3>
              <p className="text-gray-400 text-sm mb-5">They won't be able to see your posts or send you messages. You can unblock them anytime from their profile.</p>
              <div className="flex gap-2">
                <button onClick={() => blockUser(targetUid)} className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 transition font-bold text-sm">Block</button>
                <button onClick={() => setShowBlockConfirm(null)} className="flex-1 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600 text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Unblock confirm */}
        {showUnblockConfirm === targetUid && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-3xl w-80 shadow-2xl text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Unblock {selectedProfileUser.username}?</h3>
              <p className="text-gray-400 text-sm mb-5">They'll be able to see your posts and send you messages again.</p>
              <div className="flex gap-2">
                <button onClick={() => unblockUser(targetUid)} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition font-bold text-sm">Unblock</button>
                <button onClick={() => setShowUnblockConfirm(null)} className="flex-1 bg-gray-100 py-2.5 rounded-xl hover:bg-gray-200 transition text-gray-600 text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'chat' && chatWith) {
    const conversationId = [user.uid, chatWith].sort().join
