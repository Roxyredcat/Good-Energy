import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Heart, MessageCircle, Users, Search, X, LogOut, Home, Settings, ChevronRight, AlertCircle, Crown, Lock, Unlock, MessageSquare, Sparkles } from 'lucide-react';
import AvatarCreator from './AvatarCreator';
// Demo mode detection
const isDemoMode = !import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY === '';

// Read Supabase credentials from environment for safety.
// Provide them in a local `.env` as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// Only create client if we have BOTH valid credentials
let supabase = null;
try {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_ANON_KEY.length > 0) {
    supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.debug('Supabase initialization skipped (demo mode):', e.message);
}

// Moderation Engine
const ModerationEngine = {
  negativeKeywords: ['stupid', 'idiot', 'dumb', 'trash', 'garbage', 'terrible', 'awful', 'sucks', 'hate', 'worst', 'useless', 'pathetic', 'loser', 'ugly'],
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

// Predatory Behavior Detection Engine — Teen Pool Safety
const PredatoryBehaviorDetector = {
  // Patterns that indicate grooming/predatory behavior
  ageQuestions: ['how old are you', 'what is your age', 'how old', 'ur age', 'your age', 'old r u', 'r u old', 'when were you born', 'what year were you born', 'birth year'],
  locationPatterns: ['where do you live', 'where are you from', 'your address', 'zip code', 'postal code', 'what city', 'what town', 'what state', 'your location', 'where u live', 'where do u live'],
  inappropriateRequests: ['send me a picture', 'send a photo', 'send pics', 'selfie please', 'show me your', 'can i see you', 'your real name', 'real identity', 'meet up', 'come over', 'home alone', 'parents away'],
  grooming: ['you mature for your age', 'so mature', 'special connection', 'keep this secret', 'don\'t tell anyone', 'just between us', 'no one would understand', 'adults don\'t get it', 'i understand you better than'],
  sexualContent: ['sex', 'naked', 'inappropriate', 'explicit', 'nsfw', 'adult content'],

  detectPredatoryBehavior(text) {
    if (!text) return { detected: false, severity: 'none' };
    const lower = text.toLowerCase().trim();

    // Check each category
    const hasAgeQuestion = this.ageQuestions.some(q => lower.includes(q));
    const hasLocation = this.locationPatterns.some(p => lower.includes(p));
    const hasInappropriate = this.inappropriateRequests.some(r => lower.includes(r));
    const hasGrooming = this.grooming.some(g => lower.includes(g));
    const hasSexual = this.sexualContent.some(s => lower.includes(s));

    // Severity scoring
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

// Word Finder Game (Premium Feature) — updated: accepts any real word via dictionary API and shows target words
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

  // Small local list used for deriving target words; optionally replace with the long list from unlimited-word-finder.js
  const validWords = new Set([
    'CALM', 'PEACE', 'KIND', 'LOVE', 'HOPE', 'JOY', 'TRUST', 'GRACE', 'LIGHT', 'SMILE',
    'CARE', 'SAFE', 'WARM', 'SOFT', 'GOOD', 'NICE', 'FINE', 'GLOW', 'HEAL', 'REST',
    'EASE', 'SLOW', 'QUIET', 'SERENE', 'GENTLE', 'TENDER', 'SACRED', 'BRIGHT', 'CLEAR',
    'TRUE', 'PURE', 'REAL', 'WISE', 'BRAVE', 'STRONG', 'NOBLE', 'FAIR', 'JUST', 'HONEST',
    'OPEN', 'FREE', 'WHOLE', 'FULL', 'RICH', 'DEEP', 'HIGH', 'WIDE', 'VAST', 'GRAND',
    'CAT', 'DOG', 'SUN', 'MOON', 'STAR', 'TREE', 'BIRD', 'FLOWER', 'RAIN', 'WIND',
    'AND', 'THE', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS',
    'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HAS', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW',
    'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'GET', 'HIM', 'MAN',
    'SHE', 'TOO', 'USE', 'AIR', 'END', 'TRY', 'ACT', 'AGE', 'ARM', 'ART', 'BAD',
    'BAG', 'BAR', 'BED', 'BIG', 'BIT', 'BOX', 'BUS', 'BUY', 'CAR', 'CUP', 'CUT',
    'EAR', 'EAT', 'EGG', 'EYE', 'FAR', 'FEW', 'FIT', 'FLY', 'GAS', 'GUN', 'GUY',
    'HIT', 'HOT', 'ICE', 'ILL', 'JOB', 'KEY', 'LAW', 'LAY', 'LEG', 'LET', 'LIE',
    'LOT', 'LOW', 'MAP', 'MRS', 'OIL', 'PAY', 'PEN', 'PET', 'PUT', 'RAN', 'RED',
    'RUN', 'SAD', 'SAT', 'SAY', 'SET', 'SIT', 'SKY', 'SON', 'TAX', 'TEA', 'TEN',
    'TIE', 'TOP', 'TOY', 'VAN', 'WAR', 'WIN', 'YES', 'YET', 'AREA', 'ARMY', 'AWAY',
    'BABY', 'BACK', 'BALL', 'BAND', 'BANK', 'BASE', 'BEAR', 'BEAT', 'BEEN', 'BELL',
    'BEST', 'BILL', 'BLUE', 'BOAT', 'BODY', 'BOOK', 'BORN', 'BOTH', 'CALL', 'CAME',
    'CARD', 'CASE', 'CAST', 'CELL', 'CITY', 'CLUB', 'COLD', 'COME', 'COST', 'DARK',
    'DATA', 'DEAD', 'DEAL', 'DEAR', 'DEEP', 'DOOR', 'DOWN', 'DRAW', 'DROP', 'DRUG',
    'EACH', 'EAST', 'EASY', 'EDGE', 'ELSE', 'EVEN', 'EVER', 'FACE', 'FACT', 'FAIL',
    'FALL', 'FARM', 'FAST', 'FEAR', 'FEEL', 'FEET', 'FELL', 'FELT', 'FILM', 'FIND',
    'FIRE', 'FIRM', 'FISH', 'FIVE', 'FLOW', 'FOOD', 'FOOT', 'FORM', 'FOUR', 'FROM',
    'FULL', 'FUND', 'GAIN', 'GAME', 'GATE', 'GAVE', 'GIRL', 'GIVE', 'GLAD', 'GOAL',
    'GOES', 'GOLD', 'GONE', 'GROW', 'GULF', 'HAIR', 'HALF', 'HALL', 'HAND', 'HANG',
    'HARD', 'HARM', 'HATE', 'HAVE', 'HEAD', 'HEAR', 'HEAT', 'HELD', 'HELP', 'HERE',
    'HERO', 'HIGH', 'HOLD', 'HOME', 'HOUR', 'HUGE', 'HUNG', 'HUNT', 'HURT', 'IDEA',
    'INTO', 'IRON', 'ITEM', 'JOHN', 'JOIN', 'JUMP', 'JUST', 'KEEP', 'KEPT', 'KILL',
    'KING', 'KNEW', 'KNOW', 'LACK', 'LADY', 'LAND', 'LAST', 'LATE', 'LEAD', 'LEFT',
    'LESS', 'LIFE', 'LIKE', 'LINE', 'LINK', 'LIST', 'LIVE', 'LOAD', 'LONG', 'LOOK',
    'LORD', 'LOSE', 'LOSS', 'LOST', 'MAIL', 'MAIN', 'MAKE', 'MALE', 'MANY', 'MARK',
    'MASS', 'MATE', 'MEAN', 'MEET', 'MIND', 'MINE', 'MISS', 'MODE', 'MORE', 'MOST',
    'MOVE', 'MUCH', 'MUST', 'NAME', 'NEAR', 'NECK', 'NEED', 'NEWS', 'NEXT', 'NINE',
    'NONE', 'NOSE', 'NOTE', 'ONCE', 'ONLY', 'ONTO', 'OPEN', 'ORAL', 'OVER', 'PAGE',
    'PAIN', 'PAIR', 'PALM', 'PARK', 'PART', 'PASS', 'PAST', 'PATH', 'PEAK', 'PICK',
    'PINK', 'PLAN', 'PLAY', 'PLOT', 'PLUS', 'POLL', 'POOL', 'POOR', 'PORT', 'POST',
    'PULL', 'PURE', 'PUSH', 'RACE', 'RAIN', 'RANK', 'RARE', 'RATE', 'READ', 'REAL',
    'RELY', 'RICE', 'RIDE', 'RING', 'RISE', 'RISK', 'ROAD', 'ROCK', 'ROLE', 'ROLL',
    'ROOF', 'ROOM', 'ROOT', 'ROSE', 'RULE', 'SAFE', 'SAKE', 'SALE', 'SALT', 'SAME',
    'SAND', 'SAVE', 'SEAT', 'SEED', 'SEEK', 'SEEM', 'SELF', 'SELL', 'SEND', 'SENT',
    'SHIP', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SICK', 'SIDE', 'SIGN', 'SITE', 'SIZE',
    'SKIN', 'SLIP', 'SLOW', 'SNOW', 'SOME', 'SONG', 'SOON', 'SORT', 'SOUL', 'SPOT',
    'STAR', 'STAY', 'STEP', 'STOP', 'SUCH', 'SUIT', 'SURE', 'TAKE', 'TALE', 'TALK',
    'TALL', 'TANK', 'TAPE', 'TASK', 'TEAM', 'TELL', 'TEND', 'TERM', 'TEST', 'TEXT',
    'THAN', 'THAT', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'THUS', 'TILL', 'TIME',
    'TINY', 'TOLL', 'TONE', 'TOOK', 'TOOL', 'TORN', 'TOUR', 'TOWN', 'TREE', 'TRIP',
    'TRUE', 'TURN', 'TWIN', 'TYPE', 'UNIT', 'UPON', 'USED', 'USER', 'VARY', 'VAST',
    'VIEW', 'VOTE', 'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WANT', 'WARD', 'WARM',
    'WASH', 'WAVE', 'WAYS', 'WEAK', 'WEAR', 'WEEK', 'WELL', 'WENT', 'WERE', 'WEST',
    'WHAT', 'WHEN', 'WHOM', 'WIDE', 'WIFE', 'WILD', 'WILL', 'WIND', 'WINE', 'WING',
    'WIRE', 'WISE', 'WISH', 'WITH', 'WOOD', 'WORD', 'WORE', 'WORK', 'WORN', 'YARD',
    'YEAH', 'YEAR', 'YOUR', 'ZONE',
    'CALENDAR', 'SUMMER', 'WINTER', 'FALL', 'SPRING', 'HAPPINESS', 'SUNSHINE', 'MEADOW',
    'MOUNTAIN', 'OCEAN', 'RIVER', 'VALLEY', 'ISLAND', 'FOREST', 'GARDEN', 'RIVER', 'CLOUD',
    'SHINE', 'BLOSSOM', 'HARVEST', 'BREEZE', 'SERENITY', 'TRANQUIL', 'MINDFUL', 'BALANCE',
    'FREEDOM', 'COMPASSION', 'KINDNESS', 'COMMUNITY', 'FRIEND', 'FAMILY', 'HEALING', 'GROWTH',
    'INSPIRE', 'CREATE', 'BREATHE', 'STRENGTH', 'COURAGE', 'WONDER', 'WISDOM', 'HARMONY'
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
    setTimeout(() => setTargetWords(computeTargetWords(newGrid)), 0);
  };

  // derive horizontal & vertical target words from local validWords
  const computeTargetWords = (g) => {
    const size = g.length;
    const found = new Set();
    const directions = [
      [0, 1], [0, -1], [1, 0], [-1, 0], // horiz & vert
      [1, 1], [1, -1], [-1, 1], [-1, -1] // diagonals
    ];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        for (const [dr, dc] of directions) {
          let s = '';
          let nr = r, nc = c;
          while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            s += g[nr][nc];
            if (s.length >= 3 && validWords.has(s)) found.add(s);
            nr += dr; nc += dc;
          }
        }
      }
    }

    return Array.from(found)
      .sort((a, b) => b.length - a.length || a.localeCompare(b))
      .slice(0, 100);
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

    // allow 8-way adjacency (horizontal, vertical, diagonal), not same cell
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

  // Accept if in local validWords, otherwise verify via dictionary API
  const checkWord = async () => {
    const raw = currentWord.trim();
    const wordUpper = raw.toUpperCase();
    const wordLower = raw.toLowerCase();

    if (wordUpper.length < 3) { setMessage('Words must be at least 3 letters'); setSelectedCells([]); setCurrentWord(''); return; }
    if (foundWords.includes(wordUpper)) { setMessage('Already found that word!'); setSelectedCells([]); setCurrentWord(''); return; }

    const acceptWord = (w) => {
      const pts = w.length * 10;
      setFoundWords(prev => [...prev, w]);
      setScore(s => s + pts);
      setMessage(`✨ Found "${w}"! +${pts} points`);
      setTimeout(() => setMessage(''), 2000);
    };

    if (validWords.has(wordUpper)) {
      acceptWord(wordUpper);
    } else {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordLower)}`);
        if (res.ok) {
          acceptWord(wordUpper);
        } else if (res.status === 404) {
          setMessage(`"${wordUpper}" is not recognized as an English word`);
        } else {
          setMessage(`Error checking word (try again)`);
        }
      } catch (err) {
        setMessage('Network error checking word — only local list accepted');
      }
    }

    setSelectedCells([]); setCurrentWord('');
  };

  const isCellSelected = (r, c) => selectedCells.some(cell => cell.row === r && cell.col === c);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Word Finder</h3>
            <p className="text-sm text-gray-600">Drag across letters to form words (3+ letters). Words are accepted if recognized by the dictionary API.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
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
                    className={`aspect-square rounded flex items-center justify-center font-bold text-sm cursor-pointer transition-colors ${isCellSelected(i, j) ? 'bg-indigo-600 text-white scale-110' : 'bg-blue-100 hover:bg-blue-200'
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
                {foundWords.map((w, i) => <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">{w} ({w.length * 10})</span>)}
              </div>
            </div>

            <button onClick={generateGrid} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">New Game</button>
          </div>

          <div className="w-48 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <h4 className="text-sm font-semibold mb-2">Target Words</h4>
            {targetWords.length === 0 ? (
              <p className="text-xs text-gray-500">No seeded targets found — search any words!</p>
            ) : (
              <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
                {targetWords.map((t, idx) => (
                  <li key={idx} className={`px-2 py-1 rounded ${foundWords.includes(t) ? 'bg-green-100 text-green-800' : 'text-gray-700'}`}>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-400 mt-3">Tip: Targets are derived from the board using the local list. You can still find any real word — they will be accepted if the dictionary confirms them.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GoodEnergyApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('splash');
  const [authMode, setAuthMode] = useState('login');

  // Premium
  const [isPremium, setIsPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showWordFinder, setShowWordFinder] = useState(false);

  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isTeenPool, setIsTeenPool] = useState(false);
  const [showTeenPoolWarning, setShowTeenPoolWarning] = useState(false);
  const [hasEnteredTeenPool, setHasEnteredTeenPool] = useState(false); // True after accepting warning
  const [teenPoolBannedUsers, setTeenPoolBannedUsers] = useState(new Set()); // Tracks banned users from teen pool
  const [predatoryFlagged, setPredatoryFlagged] = useState(false); // Current user flagged for predatory behavior
  const [showAvatarCreation, setShowAvatarCreation] = useState(false);
  const [userAvatar, setUserAvatar] = useState('');
  const [avatarType, setAvatarType] = useState('emoji'); // 'emoji' or 'photo'
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [selectedAvatarColor, setSelectedAvatarColor] = useState('bg-blue-500');
  const [selectedAvatarEmoji, setSelectedAvatarEmoji] = useState('😊');

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

  // Groups (Premium)
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [newGroupMessage, setNewGroupMessage] = useState('');

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const openTerms = () => { console.log('DEBUG: openTerms clicked'); setShowTerms(true); };
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const openPrivacy = () => { console.log('DEBUG: openPrivacy clicked'); setShowPrivacy(true); };
  // expose debug helpers so you can call them from DevTools if clicks don't work
  useEffect(() => {
    try {
      window.DEBUG_openTerms = openTerms;
      window.DEBUG_openPrivacy = openPrivacy;
    } catch (e) {
      /* passthrough */
    }
    return () => {
      try { delete window.DEBUG_openTerms; delete window.DEBUG_openPrivacy; } catch (e) { }
    };
  }, []);

  useEffect(() => {
    if (showTerms) console.log('RENDER: Terms modal rendered');
  }, [showTerms]);

  useEffect(() => {
    if (showPrivacy) console.log('RENDER: Privacy modal rendered');
  }, [showPrivacy]);

{/* Legal Modals - React Portal Method */}
      {showTerms && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">TERMS OF SERVICE</h2>
              <button onClick={() => setShowTerms(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
            </div>
            <p className="text-sm text-gray-700 mb-4 font-bold text-indigo-600 underline cursor-pointer" onClick={() => window.open('/legal.html', '_blank')}>Full Legal Document Available Here</p>
            <section className="mb-3 text-sm text-gray-700">
              <p>Good Energy is a social space designed for calm expression and positive connection. By using our service, you agree to our community standards and terms.</p>
            </section>
            <div className="mt-4 text-right">
              <button onClick={() => setShowTerms(false)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">I Agree</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPrivacy && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">PRIVACY POLICY</h2>
              <button onClick={() => setShowPrivacy(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
            </div>
            <p className="text-sm text-gray-700">We collect minimal data to operate the service. We do not sell your personal information.</p>
            <div className="mt-4 text-right">
              <button onClick={() => setShowPrivacy(false)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
  // Forum (local, client-side)
  const [forumPosts, setForumPosts] = useState([
    { id: 1, question: 'How do I upgrade to Premium?', answers: [{ id: 1, text: 'Click the Upgrade button in the banner or Settings.' }] },
    { id: 2, question: 'How does the Word Finder work?', answers: [{ id: 1, text: 'Drag letters to form words; valid words are checked against a dictionary.' }] }
  ]);
  const [newQuestion, setNewQuestion] = useState('');
  const [answerInputs, setAnswerInputs] = useState({});
  const [loadingForum, setLoadingForum] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});

  // Reset Space
  const [ticTacToeBoard, setTicTacToeBoard] = useState(Array(9).fill(null));
  const [ticTacToePlayer, setTicTacToePlayer] = useState('X');
  // Tic-Tac-Toe session state (server-aware)
  const [resetSessionId, setResetSessionId] = useState(null);
  const [resetPlayerSymbol, setResetPlayerSymbol] = useState(null); // 'X' or 'O' for this user
  const [opponentJoined, setOpponentJoined] = useState(false);
  const pollingRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  // Supabase-backed forum & support helpers
  async function loadForum() {
    // Skip in demo mode
    if (isDemoMode || !supabase) {
      console.debug('Demo mode: skipping forum load from Supabase');
      return;
    }

    try {
      setLoadingForum(true);
      const { data, error } = await supabase
        .from('forum_posts')
        .select(`id, question, created_at, author_id,
          profiles:author_id (id, username, avatar_config),
          forum_answers(id, post_id, text, created_at, author_id, profiles:author_id (id, username, avatar_config))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const formatted = data.map(p => ({
          id: p.id,
          question: p.question,
          created_at: p.created_at,
          author_id: p.author_id,
          author: p.profiles || null,
          answers: (p.forum_answers || []).map(a => ({ id: a.id, text: a.text, author_id: a.author_id, author: a.profiles || null }))
        }));
        setForumPosts(formatted);
      }
    } catch (e) {
      console.debug('loadForum error (table may not exist):', e.message || e);
    } finally {
      setLoadingForum(false);
    }
  }

  async function postQuestionToDB(questionText) {
    try {
      const payload = { question: questionText };
      if (user?.id) payload.author_id = user.id;
      const { data, error } = await supabase.from('forum_posts').insert([payload]).select('id,question,author_id,created_at, profiles:author_id (id,username,avatar_config)');
      if (error) throw error;
      return data?.[0] || null;
    } catch (e) {
      console.debug('postQuestionToDB error:', e.message || e);
      return null;
    }
  }

  async function postAnswerToDB(postId, text) {
    try {
      const payload = { post_id: postId, text };
      if (user?.id) payload.author_id = user.id;
      const { data, error } = await supabase.from('forum_answers').insert([payload]).select('id,post_id,text,author_id,created_at, profiles:author_id (id,username,avatar_config)');
      if (error) throw error;
      return data?.[0] || null;
    } catch (e) {
      console.debug('postAnswerToDB error:', e.message || e);
      return null;
    }
  }

  async function createSupportRequest(message) {
    try {
      const payload = { message };
      if (user?.id) payload.user_id = user.id;
      const { data, error } = await supabase.from('support_requests').insert([payload]).select();
      if (error) throw error;
      return data?.[0] || null;
    } catch (e) {
      console.debug('createSupportRequest error:', e.message || e);
      return null;
    }
  }
  useEffect(() => {
    // Skip auth setup in demo mode
    if (isDemoMode || !supabase) {
      loadForum();
      return;
    }

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
      } else {
        setUser(null);
        setProfile(null);
        setView('splash');
      }
    });

    return () => subscription.unsubscribe();
    // call forum load once on mount (will fallback if table is missing)
    loadForum();
  }, []);
  useEffect(() => {
    if (view === 'reset' && user) {
      joinOrCreateSession();
    } else {
      stopSessionPolling();
      setResetSessionId(null);
      setResetPlayerSymbol(null);
      setOpponentJoined(false);
    }
    return () => {
      stopSessionPolling();
      clearTimeout(aiTimeoutRef.current);
    };
  }, [view, user]);

  const joinOrCreateSession = async () => {
    try {
      // try to find a waiting session (someone else waiting)
      const { data: waiting, error: selErr } = await supabase
        .from('tic_tac_toe_sessions')
        .select('*')
        .eq('status', 'waiting')
        .neq('player_x', user.id)
        .limit(1)
        .maybeSingle();

      if (selErr) throw selErr;

      if (waiting) {
        // join as O
        const board = waiting.board ? JSON.parse(waiting.board) : Array(9).fill(null);
        await supabase
          .from('tic_tac_toe_sessions')
          .update({ player_o: user.id, status: 'active', board: JSON.stringify(board), updated_at: new Date().toISOString() })
          .eq('id', waiting.id);
        setResetSessionId(waiting.id);
        setResetPlayerSymbol('O');
        setTicTacToeBoard(board);
        setTicTacToePlayer(waiting.current_player || 'X');
        setOpponentJoined(true);
        startSessionPolling(waiting.id);
      } else {
        // create session as X (waiting)
        const initialBoard = Array(9).fill(null);
        const { data: ins, error: insErr } = await supabase
          .from('tic_tac_toe_sessions')
          .insert({
            player_x: user.id,
            board: JSON.stringify(initialBoard),
            current_player: 'X',
            status: 'waiting',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (insErr) throw insErr;
        setResetSessionId(ins.id);
        setResetPlayerSymbol('X');
        setTicTacToeBoard(initialBoard);
        setTicTacToePlayer('X');
        setOpponentJoined(false);
        startSessionPolling(ins.id);

        // AI fallback: if no one joins within 7s, enable AI
        aiTimeoutRef.current = setTimeout(() => {
          // if still waiting and no opponent, mark AI enabled (opponentJoined stays false)
          checkAndEnableAI(ins.id);
        }, 7000);
      }
    } catch (err) {
      console.error('joinOrCreateSession error', err);
      // fallback: local 2-player only
      setResetSessionId(null);
      setResetPlayerSymbol(null);
      setOpponentJoined(false);
    }
  };

  const checkAndEnableAI = async (sessionId) => {
    try {
      const { data } = await supabase.from('tic_tac_toe_sessions').select('*').eq('id', sessionId).maybeSingle();
      if (data && !data.player_o) {
        // mark as active with AI by leaving player_o null but set a flag locally
        setOpponentJoined(false); // still false — local AI will act
      }
    } catch (err) {
      console.error('checkAndEnableAI', err);
    }
  };

  const startSessionPolling = (sessionId) => {
    stopSessionPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.from('tic_tac_toe_sessions').select('*').eq('id', sessionId).maybeSingle();
        if (data) {
          // update board + current player locally when server changed
          const serverBoard = data.board ? JSON.parse(data.board) : Array(9).fill(null);
          setTicTacToeBoard(serverBoard);
          setTicTacToePlayer(data.current_player || 'X');

          // detect opponent joined
          if (data.player_o && data.player_o !== user.id) {
            setOpponentJoined(true);
            // opponent joined — cancel any pending AI fallback
            if (aiTimeoutRef.current) {
              clearTimeout(aiTimeoutRef.current);
              aiTimeoutRef.current = null;
            }
          }
          if (data.status === 'ended') {
            // cleanup session ended
            stopSessionPolling();
          }
        }
      } catch (err) {
        console.error('polling error', err);
      }
    }, 1400);
  };

  const stopSessionPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };
  useEffect(() => {
    if (view === 'reset' && user) {
      joinOrCreateSession();
    } else {
      stopSessionPolling();
      setResetSessionId(null);
      setResetPlayerSymbol(null);
      setOpponentJoined(false);
    }
    return () => {
      stopSessionPolling();
      clearTimeout(aiTimeoutRef.current);
    };
  }, [view]);
  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setEditedProfile(data);
      setIsPremium(data.is_premium || false);

      if (data.aura === 'black') {
        setView('reset');
      } else if (view === 'splash') {
        setView('onboarding');
      }
    }
  };

  const upgradeToPremium = async () => {
    await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
    setIsPremium(true);
    setShowPremiumModal(false);
    alert('🎉 Welcome to Premium! You now have access to Groups and Word Finder!');
    loadProfile(user.id);
  };

  // Calculate age from birth date
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

    // ALWAYS use demo mode unless BOTH URL and KEY are explicitly set and non-empty
    const hasValidSupabase = import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      import.meta.env.VITE_SUPABASE_ANON_KEY !== '' &&
      !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('undefined');

    console.log('Signup attempt - hasValidSupabase:', hasValidSupabase, 'supabase:', !!supabase);

    if (!hasValidSupabase || !supabase) {
      // Demo mode signup (no Supabase)
      console.log('Demo mode: Simulating signup for', username);
      alert('✨ Demo Account Created! (No Supabase configured)\n\nUsername: ' + username + '\nAge: ' + age + '\n' + (age < 18 ? 'Routed to: Teen Pool' : 'Routed to: Main Feed'));

      // Simulate user object
      const mockUser = {
        id: 'demo-' + Date.now(),
        email: email,
        user_metadata: { username, birth_date: `${birthYear}-${birthMonth}-${birthDay}`, age, is_teen_pool: age < 18 }
      };

      // Set user and profile for demo
      setUser(mockUser);
      setProfile({ id: mockUser.id, username, avatar_config: null, is_premium: false, violations: 0, aura: 'blue' });

      // Route to appropriate view
      if (age < 18) {
        setIsTeenPool(true);
        setView('feed');
      } else {
        setView('onboarding');
      }

      // Clear form
      setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
      setBirthMonth(''); setBirthDay(''); setBirthYear('');
      setHasAcceptedTerms(false);
      setAuthMode('login');
      return;
    }

    // Production mode: use Supabase
    if (!supabase) {
      alert('Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

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

    const user = data.user;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        username: username.trim().toLowerCase(),
        is_private: false
      })
      .eq('id', user.id);

    if (profileError) {
      if (profileError.code === '23505') {
        alert('That username is already taken.');
      } else {
        alert(profileError.message);
      }
      return;
    }

    alert('Account created! Please check your email to verify.');

    if (age < 18) setIsTeenPool(true);

    setBirthMonth('');
    setBirthDay('');
    setBirthYear('');

    const handleLogin = async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    };

    const handleLogout = async () => {
      await supabase.auth.signOut();
    };

    const completeOnboarding = () => {
      setView('feed');
      loadFeed();
    };

    // REPLACE the loadFeed function at line 781 with this:

    const loadFeed = async () => {
      // Demo mode: create mock posts so the feed isn't blank
      if (isDemoMode || !supabase) {
        console.log('Demo mode: Loading mock feed data');
        const mockPosts = [
          {
            id: 'demo-1',
            author_id: 'demo-user-1',
            content: 'Welcome to Good Energy! 🌿 This is a demo post to show you how the feed works. Try creating your own post below!',
            created_at: new Date().toISOString(),
            profiles: {
              username: 'Demo User',
              avatar_config: null,
              is_premium: false
            },
            comments: [
              {
                id: 'demo-comment-1',
                content: 'This looks great! Excited to be here.',
                profiles: { username: 'Demo Friend' }
              }
            ],
            reactions: [
              { emoji: '❤️', user_id: 'demo-user-2' }
            ]
          },
          {
            id: 'demo-2',
            author_id: 'demo-user-2',
            content: 'Just created my avatar! Love the customization options. 😊',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            profiles: {
              username: 'Creative Mind',
              avatar_config: null,
              is_premium: true
            },
            comments: [],
            reactions: [
              { emoji: '❤️', user_id: 'demo-user-1' },
              { emoji: '✨', user_id: 'demo-user-3' }
            ]
          },
          {
            id: 'demo-3',
            author_id: 'demo-user-3',
            content: 'Having a great day! The positive vibes here are amazing. ✨',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            profiles: {
              username: 'Sunshine',
              avatar_config: null,
              is_premium: false
            },
            comments: [
              {
                id: 'demo-comment-2',
                content: 'Same! This space feels different.',
                profiles: { username: 'Demo User' }
              }
            ],
            reactions: [
              { emoji: '☀️', user_id: 'demo-user-1' },
              { emoji: '🌈', user_id: 'demo-user-2' }
            ]
          }
        ];

        setPosts(mockPosts);
        return;
      }

      // Production mode: load from Supabase
      try {
        const { data } = await supabase.from('posts').select(`
      *, profiles:author_id (username, avatar_config, is_premium),
      comments (*, profiles:author_id (username)), reactions (emoji, user_id)
    `).order('created_at', { ascending: false });
        if (data) setPosts(data);
      } catch (error) {
        console.error('Error loading feed:', error);
        setPosts([]);
      }
    };

    const createPost = async () => {
      if (!newPost.trim()) return;
      const check = ModerationEngine.checkComment(newPost);
      if (!check.allowed) { setModerationError(check.reason); return; }

      const { error } = await supabase.from('posts').insert([{
        author_id: user.id,
        content: newPost,
        visibility: isPremium && editedProfile.post_visibility ? editedProfile.post_visibility : 'public'
      }]);

      if (!error) { setNewPost(''); setModerationError(''); loadFeed(); }
    };

    const addComment = async (postId, content) => {
      if (!content.trim()) return;
      const check = ModerationEngine.checkComment(content);
      if (!check.allowed) { setModerationError(check.reason); await incrementViolation(); return; }

      // If in teen pool, check for predatory behavior
      if (isTeenPool) {
        const predCheck = PredatoryBehaviorDetector.detectPredatoryBehavior(content);
        if (predCheck.detected) {
          setModerationError(`🚫 ${predCheck.reason}`);
          await banFromTeenPool(user.id, predCheck.severity);
          setPredatoryFlagged(true);
          return;
        }
      }

      await supabase.from('comments').insert([{ post_id: postId, author_id: user.id, content }]);
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setModerationError('');
      loadFeed();
    };

    const banFromTeenPool = async (userId, severity) => {
      // Add user to banned list
      setTeenPoolBannedUsers(prev => new Set([...prev, userId]));

      // Log violation to support/moderation database (for review)
      try {
        await supabase.from('violations').insert([{
          user_id: userId,
          violation_type: 'teen_pool_predatory_behavior',
          severity: severity, // 'high' or 'critical'
          reason: 'Attempted predatory behavior in teen pool',
          timestamp: new Date().toISOString()
        }]);
      } catch (e) {
        console.debug('Failed to log violation:', e.message);
      }
    };

    const checkTeenPoolBanStatus = async (userId) => {
      // Check if user is banned from teen pool due to predatory behavior
      try {
        const { data, error } = await supabase.from('violations').select('*').eq('user_id', userId).eq('violation_type', 'teen_pool_predatory_behavior');
        if (!error && data && data.length > 0) {
          return true; // User is banned
        }
      } catch (e) {
        console.debug('Check ban status error:', e.message);
      }
      return false; // Not banned
    };

    const incrementViolation = async () => {
      const newViolations = (profile.violations || 0) + 1;
      let newAura = profile.aura;
      if (newViolations === 1) newAura = 'orange';
      if (newViolations >= 3) newAura = 'black';

      await supabase.from('profiles').update({ violations: newViolations, aura: newAura }).eq('id', user.id);
      await supabase.from('violations').insert([{ user_id: user.id, reason: 'Attempted negative comment' }]);
      loadProfile(user.id);
    };

    const toggleReaction = async (postId) => {
      const { data: existing } = await supabase.from('reactions').select('*').eq('post_id', postId).eq('user_id', user.id).single();
      if (existing) {
        await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('reactions').insert([{ post_id: postId, user_id: user.id, emoji: '❤️' }]);
      }
      loadFeed();
    };

    const searchUsers = async () => {
      if (!searchQuery.trim()) { setSearchResults([]); return; }
      const { data } = await supabase.from('profiles').select('*').ilike('username', `%${searchQuery}%`).limit(10);
      if (data) setSearchResults(data.filter(p => p.id !== user.id));
    };

    const sendFriendRequest = async (receiverId) => {
      const { error } = await supabase.from('friend_requests').insert([{ sender_id: user.id, receiver_id: receiverId }]);
      if (!error) { alert('Friend request sent!'); setSearchResults([]); }
    };

    const loadFriendRequests = async () => {
      const { data } = await supabase.from('friend_requests').select(`*, sender:sender_id (username, avatar_config)`).eq('receiver_id', user.id).eq('status', 'pending');
      if (data) setFriendRequests(data);
    };

    const acceptFriendRequest = async (requestId, senderId) => {
      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
      await supabase.from('friends').insert([
        { user_id: user.id, friend_id: senderId },
        { user_id: senderId, friend_id: user.id }
      ]);
      loadFriendRequests();
      loadFriends();
    };

    const loadFriends = async () => {
      const { data } = await supabase.from('friends').select(`*, profile:friend_id (username, avatar_config, is_private)`).eq('user_id', user.id);
      if (data) setFriends(data);
    };

    const unfriend = async (friendId) => {
      await supabase.from('friends').delete().or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
      loadFriends();
    };

    const blockUser = async (blockedId) => {
      await supabase.from('friends').delete().or(`and(user_id.eq.${user.id},friend_id.eq.${blockedId}),and(user_id.eq.${blockedId},friend_id.eq.${user.id})`);
      await supabase.from('blocks').insert([{ blocker_id: user.id, blocked_id: blockedId }]);
      alert('User blocked');
      loadFriends();
      loadFeed();
    };

    const updateProfile = async () => {
      await supabase.from('profiles').update({
        username: editedProfile.username,
        is_private: editedProfile.is_private,
        avatar_config: editedProfile.avatar_config
      }).eq('id', user.id);
      setProfile(editedProfile);
      setIsEditingProfile(false);
      alert('Profile updated!');
    };

    // Group Chat Functions (Premium)
    const loadGroups = async () => {
      const { data } = await supabase.from('groups').select(`
      *, group_members!inner(user_id), 
      profiles:created_by (username)
    `).eq('group_members.user_id', user.id);
      if (data) setGroups(data);
    };

    const createGroup = async (name, description) => {
      const { data, error } = await supabase.from('groups').insert([{
        name, description, created_by: user.id
      }]).select().single();

      if (!error && data) {
        await supabase.from('group_members').insert([{ group_id: data.id, user_id: user.id, role: 'admin' }]);
        loadGroups();
      }
    };

    const sendGroupMessage = async () => {
      if (!newGroupMessage.trim() || !currentGroup) return;
      const check = ModerationEngine.checkComment(newGroupMessage);
      if (!check.allowed) {
        alert(check.reason);
        await incrementViolation();
        return;
      }

      await supabase.from('group_messages').insert([{
        group_id: currentGroup.id,
        user_id: user.id,
        content: newGroupMessage
      }]);
      setNewGroupMessage('');
      loadGroupMessages(currentGroup.id);
    };

    const loadGroupMessages = async (groupId) => {
      const { data } = await supabase.from('group_messages').select(`
      *, profiles:user_id (username, avatar_config)
    `).eq('group_id', groupId).order('created_at', { ascending: true });
      if (data) setGroupMessages(data);
    };

    // AI helpers (single, component-scope implementations)
    const chooseAIMove = (board) => {
      const empties = board.map((v, i) => (v ? null : i)).filter(i => i !== null);
      if (!empties.length) return null;
      return empties[Math.floor(Math.random() * empties.length)];
    };

    // Tic‑Tac‑Toe winner checker for 3x3 board (returns 'X' or 'O' or null)
    const checkWinner = (board) => {
      if (!board || board.length !== 9) return null;
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];
      for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
      }
      return null;
    };

    // aiSymbol: 'X' or 'O'; baseBoard (optional) is used to avoid stale state when invoked from a timeout
    const playAIMove = async (index, aiSymbol, baseBoard = null) => {
      const currentBoard = baseBoard ? [...baseBoard] : [...ticTacToeBoard];
      if (currentBoard[index]) {
        return;
      }
      currentBoard[index] = aiSymbol;
      const nextPlayer = aiSymbol === 'X' ? 'O' : 'X';
      setTicTacToeBoard(currentBoard);
      setTicTacToePlayer(nextPlayer);

      // clear any scheduled AI timeout (we're executing now)
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }

      if (resetSessionId) {
        try {
          await supabase.from('tic_tac_toe_sessions')
            .update({ board: JSON.stringify(currentBoard), current_player: nextPlayer, updated_at: new Date().toISOString() })
            .eq('id', resetSessionId);

          const winner = checkWinner(currentBoard);
          if (winner || currentBoard.every(cell => cell)) {
            setTimeout(async () => {
              alert(winner ? `${winner} wins!` : "It's a draw!");
              await supabase.from('tic_tac_toe_sessions').update({ status: 'ended', updated_at: new Date().toISOString() }).eq('id', resetSessionId);
              resetTicTacToe();
            }, 100);
          }
        } catch (err) {
          console.error('playAIMove error', err);
        }
      }
    };

    const playTicTacToe = async (index) => {

      // local fast-guard
      if (ticTacToeBoard[index]) return;

      // if using server session
      if (resetSessionId) {
        // ensure it's this player's turn when opponent joined
        const mySymbol = resetPlayerSymbol || 'X';
        if (opponentJoined) {
          if (mySymbol !== ticTacToePlayer) return; // wait for other player
        }

        // apply locally
        const newBoard = [...ticTacToeBoard];
        newBoard[index] = mySymbol;
        setTicTacToeBoard(newBoard);

        // switch turn
        const nextPlayer = mySymbol === 'X' ? 'O' : 'X';
        setTicTacToePlayer(nextPlayer);

        // push update to server
        try {
          await supabase.from('tic_tac_toe_sessions')
            .update({
              board: JSON.stringify(newBoard),
              current_player: nextPlayer,
              updated_at: new Date().toISOString()
            })
            .eq('id', resetSessionId);

          // check winner locally
          const winner = checkWinner(newBoard);
          if (winner || newBoard.every(cell => cell)) {
            setTimeout(async () => {
              alert(winner ? `${winner} wins!` : "It's a draw!");
              // mark session ended
              await supabase.from('tic_tac_toe_sessions').update({ status: 'ended', updated_at: new Date().toISOString() }).eq('id', resetSessionId);
              resetTicTacToe();
            }, 100);
            return;
          }

          // if opponent not joined yet -> AI move
          if (!opponentJoined) {
            if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
            aiTimeoutRef.current = setTimeout(() => {
              const aiMove = chooseAIMove(newBoard);
              if (aiMove != null) playAIMove(aiMove, nextPlayer, newBoard);
            }, 700);
          }
        } catch (err) {
          console.error('Error updating session', err);
        }
        return;
      }

      // fallback: local 2-player behavior
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
        const nextPlayer = ticTacToePlayer === 'X' ? 'O' : 'X';
        setTicTacToePlayer(nextPlayer);

        // Local fallback AI: if no server session and no opponent, run AI immediately
        if (!resetSessionId && !opponentJoined) {
          // pick a move now and execute it immediately to avoid timing issues
          const preAiMove = chooseAIMove(newBoard);
          if (preAiMove != null) {
            // invoke AI shortly after to allow React to flush state
            Promise.resolve().then(() => playAIMove(preAiMove, nextPlayer, newBoard)).catch(() => { });
          }

          // keep a scheduled fallback to cover edge cases
          if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
          aiTimeoutRef.current = setTimeout(() => {
            const aiMove = chooseAIMove(newBoard);
            if (aiMove != null) playAIMove(aiMove, nextPlayer, newBoard);
          }, 700);
        }
      }
    };
    const resetTicTacToe = async () => {
      setTicTacToeBoard(Array(9).fill(null));
      setTicTacToePlayer('X');

      // update server session if present: reset board and set waiting or ended
      if (resetSessionId) {
        try {
          await supabase.from('tic_tac_toe_sessions')
            .update({ board: JSON.stringify(Array(9).fill(null)), current_player: 'X', status: 'waiting', updated_at: new Date().toISOString() })
            .eq('id', resetSessionId);
        } catch (err) {
          console.error('resetTicTacToe server update', err);
        }
      }

      // ensure any pending AI timeout is cleared when resetting
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    };
    const completeResetSpace = async () => {
      await supabase.from('profiles').update({ aura: 'blue', violations: 0 }).eq('id', user.id);
      alert('You\'re welcome back. Let\'s keep this space calm.');
      loadProfile(user.id);
    };

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
              <button onClick={() => { setView('auth'); setAuthMode('signup'); }} className="w-64 bg-indigo-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-700 transition shadow-lg">Get Started</button>
              <button onClick={() => { setView('auth'); setAuthMode('login'); }} className="w-64 bg-white text-indigo-600 py-3 px-6 rounded-xl font-medium hover:bg-gray-50 transition border-2 border-indigo-600">Log In</button>
            </div>

            <div className="mt-12 text-sm text-gray-500 space-x-4">
              <button type="button" onClick={openTerms} className="hover:text-indigo-600">Terms</button>
              <button type="button" onClick={openPrivacy} className="hover:text-indigo-600">Privacy</button>
            </div>
          </div>
        </div>
      );
    }

    // Onboarding screens
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
                  <p className="text-sm text-gray-700">This Space is Different. Most platforms reward speed and outrage. We reward thoughtfulness and kindness. You'll notice: Comments are positive by design; No reply chains or dogpiling; Private, respectful moderation; Calm pacing over dopamine hits.</p>
                  <div className="mt-4 flex justify-between">
                    <button onClick={() => setOnboardingStep(0)} className="px-4 py-2 rounded border">Back</button>
                    <button onClick={() => setOnboardingStep(2)} className="bg-indigo-600 text-white px-4 py-2 rounded">I'm ready for this</button>
                  </div>
                </div>
              )}
              {onboardingStep === 2 && (
                <div>
                  <AvatarCreator
                    onComplete={(avatarData) => {
                      // Save avatar data to state
                      setUserAvatar(avatarData);
                      if (avatarData.type === 'emoji') {
                        setSelectedAvatarEmoji(avatarData.emoji);
                        setSelectedAvatarColor(avatarData.color);
                      } else {
                        setUploadedPhoto(avatarData.photo);
                      }
                      // Move to next step
                      setOnboardingStep(3);
                    }}
                  />
                </div>
              )}
              {onboardingStep === 3 && (
                <div>
                  <h3 className="font-semibold">Communication Style</h3>
                  <p className="text-sm text-gray-700">How Communication Works Here: Comments — Only on posts, always flat (no reply chains). Reactions — Choose any emoji, change it anytime. Messages — Private, 1-on-1.</p>
                  <div className="mt-4 flex justify-between">
                    <button onClick={() => setOnboardingStep(2)} className="px-4 py-2 rounded border">Back</button>
                    <button onClick={() => setOnboardingStep(4)} className="bg-indigo-600 text-white px-4 py-2 rounded">Got it</button>
                  </div>
                </div>
              )}
              {onboardingStep === 4 && (
                <div>
                  <h3 className="font-semibold">Moderation Transparency</h3>
                  <p className="text-sm text-gray-700">Keeping This Space Calm: Our system quietly guides conversations toward positivity. If a comment doesn't align with our tone, you'll see a friendly prompt asking you to reword. Everyone deserves a second chance.</p>
                  <div className="mt-4 flex justify-between">
                    <button onClick={() => setOnboardingStep(3)} className="px-4 py-2 rounded border">Back</button>
                    <button onClick={() => setOnboardingStep(5)} className="bg-indigo-600 text-white px-4 py-2 rounded">I understand</button>
                  </div>
                </div>
              )}
              {onboardingStep === 5 && (
                <div>
                  <h3 className="font-semibold">Ready</h3>
                  <p className="text-sm text-gray-700">You're All Set ✨ Remember: Words shape spaces. Kindness is noticed here. You don't need to be loud to be heard.</p>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => { setOnboardingStep(0); completeOnboarding(); }} className="bg-green-600 text-white px-4 py-2 rounded">Enter the Space</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Auth screen
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
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full p-3 border rounded" />
              )}

              {authMode === 'signup' && (
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
              )}

              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 border rounded" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 border rounded" />

              {authMode === 'signup' && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={hasAcceptedTerms} onChange={(e) => setHasAcceptedTerms(e.target.checked)} />
                  I accept the <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 underline">Terms</button>
                </label>
              )}

              {authMode === 'signup' && (
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="w-full p-3 border rounded" />
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

    // Main App with Premium Features
    // Reset view — Tic‑Tac‑Toe UI
    if (view === 'reset') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 shadow-md w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Reset Space — Tic‑Tac‑Toe</h2>
              <button onClick={() => setView('feed')} className="text-sm text-gray-500">Close</button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {ticTacToeBoard.map((cell, idx) => (
                <button
                  key={idx}
                  onClick={() => playTicTacToe(idx)}
                  className={`w-full aspect-square rounded flex items-center justify-center text-2xl font-bold transition ${cell ? 'bg-indigo-600 text-white' : 'bg-blue-50 hover:bg-blue-100'
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

    // Teen Pool View (for users under 18)
    if (isTeenPool) {
      // Check if user is banned from teen pool
      if (predatoryFlagged || teenPoolBannedUsers.has(user?.id)) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-md text-center">
              <div className="text-5xl mb-4">🚫</div>
              <h2 className="text-3xl font-bold text-red-600 mb-4">Account Suspended</h2>
              <p className="text-lg text-gray-700 mb-4">Your account has been permanently banned from the Good Energy Teen Pool due to violating our safety policies.</p>
              <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6">
                <p className="text-sm text-gray-700"><strong>Reason:</strong> Predatory or inappropriate behavior detected in the Teen Pool.</p>
              </div>
              <p className="text-gray-600 mb-6">If you believe this is an error, please contact our support team at support@goodenergy.com with your account details.</p>
              <button onClick={() => { setIsTeenPool(false); setView('splash'); }} className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-700 transition">
                Return to Home
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
          {/* Warning Modal for Teen Pool Entry */}
          {showTeenPoolWarning && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-2xl">
                <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ Important: Teen Space Safety Rules</h2>
                <div className="space-y-4 text-gray-700 mb-6">
                  <p className="font-semibold">Welcome to the Good Energy Teen Space. Your safety is our top priority.</p>
                  <div className="bg-red-50 border-l-4 border-red-600 p-4 space-y-3">
                    <h3 className="font-bold text-red-700">🚫 Prohibited Behavior (Auto-Ban):</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                      <li><strong>Asking for personal information:</strong> Age, address, location, real name, or other identifying details</li>
                      <li><strong>Requesting photos/videos:</strong> Any request for pictures, selfies, or visual content</li>
                      <li><strong>Grooming behavior:</strong> Secret communications, flattery, or isolating language ("don't tell anyone")</li>
                      <li><strong>Sexual or adult content:</strong> Any explicit, inappropriate, or NSFW material</li>
                    </ul>
                  </div>
                  <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4">
                    <h3 className="font-bold text-yellow-700 mb-2">⚡ What Happens:</h3>
                    <p className="text-sm">Any violation of these rules will trigger <strong>immediate account suspension</strong> and <strong>permanent ban from the Teen Space</strong>. All violators are reported to safety moderators.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowTeenPoolWarning(false); setHasEnteredTeenPool(true); }} className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition">
                    I Understand & Accept
                  </button>
                  <button onClick={() => { setIsTeenPool(false); setView('splash'); }} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition">
                    Exit Teen Pool
                  </button>
                </div>
              </div>
            </div>
          )}

          <header className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-green-600">Good Energy Teen Pool</h1>
              <button onClick={() => { setIsTeenPool(false); setHasEnteredTeenPool(false); setView('feed'); }} className="text-sm text-gray-500 hover:text-gray-700">×</button>
            </div>
          </header>
          <div className="max-w-4xl mx-auto px-4 py-8">
            {!hasEnteredTeenPool ? (
              // Welcome Screen (Before entering)
              <div className="bg-white rounded-xl p-8 shadow-md">
                <h2 className="text-3xl font-bold text-green-600 mb-4">Welcome to the Teen Pool 🌿</h2>
                <p className="text-lg text-gray-700 mb-4">
                  You've been placed in our dedicated Teen Pool because you're under 18. This is a specially moderated area designed just for you and other teens.
                </p>
                <div className="bg-green-50 border-l-4 border-green-600 p-4 mb-6">
                  <h3 className="font-semibold text-green-800 mb-2">What's Special About This Pool?</h3>
                  <ul className="text-gray-700 space-y-2 list-disc list-inside">
                    <li>Extra moderation to keep the environment safe and positive</li>
                    <li>AI-powered safety detection that flags inappropriate behavior instantly</li>
                    <li>No contact with unverified adults — all adults in this space are screened</li>
                    <li>Age-appropriate content and discussion topics</li>
                    <li>Resources for teens looking for support, guidance, and connection</li>
                  </ul>
                </div>
                <p className="text-gray-600 mb-6">
                  You can still invite friends, post updates, and participate in discussions — all in a space where your safety and comfort come first.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setShowTeenPoolWarning(true)} className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-green-700 transition">
                    Enter Teen Pool
                  </button>
                  <button onClick={() => { setIsTeenPool(false); setHasEnteredTeenPool(false); setView('splash'); }} className="flex-1 border-2 border-green-600 text-green-600 py-3 px-6 rounded-xl font-medium hover:bg-green-50 transition">
                    Back to Splash
                  </button>
                </div>
              </div>
            ) : (
              // Actual Teen Pool Feed
              <div className="space-y-4">
                {/* Avatar Section */}
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Your Profile</h3>
                    <button onClick={() => setShowAvatarCreation(true)} className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition">
                      Create/Edit Avatar
                    </button>
                  </div>
                  {userAvatar ? (
                    <div className="flex items-center gap-6">
                      {avatarType === 'photo' && uploadedPhoto ? (
                        <img src={uploadedPhoto} alt="Profile" className="w-32 h-32 rounded-full object-cover shadow-md border-4 border-green-200" />
                      ) : (
                        <div className={`${selectedAvatarColor} w-32 h-32 rounded-full flex items-center justify-center text-9xl shadow-md border-4 border-green-100`}>
                          {selectedAvatarEmoji}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">{username || 'Anonymous'}</p>
                        <p className="text-sm text-gray-600">Age: {calculateAge()} years old</p>
                        <p className="text-sm text-green-600 font-medium">🛡️ Teen Pool Member</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600 mb-3">You haven't created an avatar yet!</p>
                      <button onClick={() => setShowAvatarCreation(true)} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">
                        Create Your Avatar Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Creation Modal */}
                {showAvatarCreation && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-3xl my-4">
                      <h2 className="text-2xl font-bold text-green-600 mb-6">Create Your Avatar ✨</h2>

                      {/* Avatar Type Selector */}
                      <div className="mb-8">
                        <label className="block font-semibold text-gray-800 mb-4">Avatar Type</label>
                        <div className="flex gap-4">
                          <button
                            onClick={() => setAvatarType('emoji')}
                            className={`flex-1 p-4 rounded-lg border-2 transition ${avatarType === 'emoji' ? 'border-green-600 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}
                          >
                            <div className="text-4xl mb-2">😊</div>
                            <p className="font-semibold text-gray-800">Emoji Avatar</p>
                            <p className="text-sm text-gray-600">Fun & expressive</p>
                          </button>
                          <button
                            onClick={() => setAvatarType('photo')}
                            className={`flex-1 p-4 rounded-lg border-2 transition ${avatarType === 'photo' ? 'border-green-600 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}
                          >
                            <div className="text-4xl mb-2">📸</div>
                            <p className="font-semibold text-gray-800">Photo Avatar</p>
                            <p className="text-sm text-gray-600">Upload your picture</p>
                          </button>
                        </div>
                      </div>

                      {avatarType === 'emoji' ? (
                        // Emoji Avatar Editor
                        <div className="space-y-8">
                          {/* Emoji Categories */}
                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">🥰 Happy & Expressive</label>
                            <div className="grid grid-cols-6 gap-3 mb-6">
                              {['😊', '😄', '😆', '😍', '🥰', '😘', '😍', '🤩', '😎', '🥸', '😝', '🤪', '😁', '😃', '😀', '☺️'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-green-200 ring-4 ring-green-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">🐕 Animals & Pets</label>
                            <div className="grid grid-cols-6 gap-3 mb-6">
                              {['🐶', '🐕', '🦮', '🐱', '😸', '😹', '😻', '😺', '🐰', '🐹', '🦊', '🐻', '🐼', '🦁', '🐯', '🦒'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-green-200 ring-4 ring-green-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">✨ Creative & Cool</label>
                            <div className="grid grid-cols-6 gap-3 mb-6">
                              {['🚀', '⭐', '🌟', '💫', '🌈', '💎', '🎨', '🎭', '🎪', '🎸', '🎯', '🏆', '👑', '💪', '🔥', '⚡'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-green-200 ring-4 ring-green-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">🌸 Nature & Vibes</label>
                            <div className="grid grid-cols-6 gap-3 mb-8">
                              {['🌻', '🌺', '🌸', '🌼', '🦋', '🐝', '🌙', '☀️', '💚', '💜', '💙', '🌊', '🏔️', '🌲', '🍀', '🎋'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-green-200 ring-4 ring-green-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Background Color Selection */}
                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">Circle Color (Optional)</label>
                            <div className="grid grid-cols-5 gap-3 mb-6">
                              {['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500', 'bg-cyan-500', 'bg-orange-500'].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setSelectedAvatarColor(color)}
                                  className={`w-12 h-12 rounded-full transition ${color} ${selectedAvatarColor === color ? 'ring-4 ring-offset-2 ring-gray-800 scale-110' : 'hover:opacity-80'}`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Preview */}
                          <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-green-200">
                            <p className="text-gray-600 font-semibold mb-4">Preview</p>
                            <div className={`${selectedAvatarColor} w-40 h-40 rounded-full flex items-center justify-center text-9xl shadow-lg mx-auto border-4 border-green-100`}>
                              {selectedAvatarEmoji}
                            </div>
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setUserAvatar(`emoji-${selectedAvatarEmoji}`);
                                setAvatarType('emoji');
                                setShowAvatarCreation(false);
                              }}
                              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition"
                            >
                              Save Emoji Avatar
                            </button>
                            <button
                              onClick={() => setShowAvatarCreation(false)}
                              className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Photo Avatar Upload
                        <div className="space-y-6">
                          <div className="border-2 border-dashed border-green-400 rounded-lg p-8 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setUploadedPhoto(event.target?.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                              id="photo-upload"
                            />
                            <label htmlFor="photo-upload" className="cursor-pointer">
                              <div className="text-5xl mb-4">📸</div>
                              <p className="font-semibold text-gray-800 mb-2">Click to upload a photo</p>
                              <p className="text-sm text-gray-600">or drag and drop (JPG, PNG, GIF)</p>
                            </label>
                          </div>

                          {uploadedPhoto && (
                            <div className="bg-gray-50 rounded-lg p-8 text-center">
                              <p className="text-gray-600 font-semibold mb-4">Preview</p>
                              <img src={uploadedPhoto} alt="Preview" className="w-40 h-40 rounded-full object-cover shadow-lg mx-auto border-4 border-green-200" />
                            </div>
                          )}

                          {/* Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setUserAvatar('photo-upload');
                                setAvatarType('photo');
                                setShowAvatarCreation(false);
                              }}
                              disabled={!uploadedPhoto}
                              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${uploadedPhoto ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                            >
                              Save Photo Avatar
                            </button>
                            <button
                              onClick={() => setShowAvatarCreation(false)}
                              className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Feed Section */}
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Teen Pool Feed</h3>
                  <p className="text-gray-600">Welcome to the safe space! Share your thoughts and connect with other teens.</p>
                  {/* Feed content will go here */}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (view !== 'splash' && view !== 'auth' && view !== 'onboarding' && view !== 'reset' && user) {
      return (
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-indigo-600">Good Energy</h1>

              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <button onClick={() => { setView('feed'); loadFeed(); }} className={`p-2 rounded-lg transition ${view === 'feed' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}><Home className="w-5 h-5" /></button>
                  <button onClick={() => { setView('explorer'); }} className={`p-2 rounded-lg transition ${view === 'explorer' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}>Terms</button>
                  <button onClick={() => { setView('forum'); }} className={`p-2 rounded-lg transition ${view === 'forum' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}>Forum</button>
                  <button onClick={() => setShowSupport(true)} className={`p-2 rounded-lg transition text-gray-600 hover:bg-gray-100`}>Support</button>
                  {(profile?.is_admin || import.meta.env.DEV) && (
                    <button onClick={() => setView('admin')} className={`p-2 rounded-lg transition ${view === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}>Admin</button>
                  )}
                  <button onClick={() => { setView('social'); loadFriendRequests(); loadFriends(); }} className={`p-2 rounded-lg transition ${view === 'social' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}><Users className="w-5 h-5" /></button>
                  {isPremium && (
                    <button onClick={() => { setView('groups'); loadGroups(); }} className={`p-2 rounded-lg transition ${view === 'groups' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}><MessageSquare className="w-5 h-5" /></button>
                  )}
                  <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"><Settings className="w-5 h-5" /></button>
                </div>

                <div className="flex items-center gap-3">
                  <Avatar config={profile?.avatar_config} size={40} />
                  <span className="font-medium flex items-center gap-1">
                    {profile?.username}
                    {isPremium && <Crown className="w-4 h-4 text-yellow-500" />}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${profile?.aura === 'blue' ? 'bg-blue-500' : profile?.aura === 'orange' ? 'bg-orange-500' : 'bg-black'}`} />
                  <button onClick={handleLogout} className="text-gray-600 hover:text-gray-800"><LogOut className="w-5 h-5" /></button>
                  {import.meta.env.DEV && (
                    <button
                      onClick={() => { setUser(null); setProfile(null); setView('splash'); }}
                      className="text-sm text-gray-500 ml-2"
                    >
                      Simulate Logout
                    </button>
                  )}
                  {import.meta.env.DEV && (
                    <>
                      <button onClick={() => setView('reset')} className="text-sm text-gray-500 ml-2">Open Reset</button>
                      <button onClick={() => setShowWordFinder(true)} className="text-sm text-gray-500 ml-2">Open Word Finder</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="max-w-4xl mx-auto p-4">
            {/* Premium Upgrade Banner */}
            {!isPremium && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 mb-4 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-8 h-8" />
                    <div>
                      <p className="font-bold">Upgrade to Premium</p>
                      <p className="text-sm">Unlock Groups, Word Finder, and advanced visibility controls</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPremiumModal(true)} className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100">Upgrade</button>
                </div>
              </div>
            )}

            {/* Feed View */}
            {view === 'feed' && (
              <>
                {/* Avatar Section */}
                <div className="bg-white rounded-xl p-6 mb-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Your Profile</h3>
                    <button onClick={() => setShowAvatarCreation(true)} className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition">
                      Create/Edit Avatar
                    </button>
                  </div>
                  {userAvatar ? (
                    <div className="flex items-center gap-6">
                      {avatarType === 'photo' && uploadedPhoto ? (
                        <img src={uploadedPhoto} alt="Profile" className="w-32 h-32 rounded-full object-cover shadow-md border-4 border-indigo-200" />
                      ) : (
                        <div className={`${selectedAvatarColor} w-32 h-32 rounded-full flex items-center justify-center text-9xl shadow-md border-4 border-indigo-100`}>
                          {selectedAvatarEmoji}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">{profile?.username || 'Anonymous'}</p>
                        <p className="text-sm text-gray-600">Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'recently'}</p>
                        {isTeenPool && <p className="text-sm text-green-600 font-medium">🛡️ Teen Pool Member</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600 mb-3">Express yourself with a custom avatar!</p>
                      <button onClick={() => setShowAvatarCreation(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                        Create Your Avatar Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Creation Modal */}
                {showAvatarCreation && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-4xl my-4">
                      <h2 className="text-2xl font-bold text-indigo-600 mb-6">Create Your Avatar ✨</h2>

                      {/* Avatar Type Selector */}
                      <div className="mb-8">
                        <label className="block font-semibold text-gray-800 mb-4">Avatar Type</label>
                        <div className="flex gap-4">
                          <button
                            onClick={() => setAvatarType('emoji')}
                            className={`flex-1 p-4 rounded-lg border-2 transition ${avatarType === 'emoji' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}
                          >
                            <div className="text-4xl mb-2">😊</div>
                            <p className="font-semibold text-gray-800">Emoji Avatar</p>
                            <p className="text-sm text-gray-600">Fun & expressive</p>
                          </button>
                          <button
                            onClick={() => setAvatarType('photo')}
                            className={`flex-1 p-4 rounded-lg border-2 transition ${avatarType === 'photo' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}
                          >
                            <div className="text-4xl mb-2">📸</div>
                            <p className="font-semibold text-gray-800">Photo Avatar</p>
                            <p className="text-sm text-gray-600">Upload your picture</p>
                          </button>
                        </div>
                      </div>

                      {avatarType === 'emoji' ? (
                        // Emoji Avatar Editor
                        <div className="space-y-8">
                          {/* Emoji Categories */}
                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">🥰 Happy & Expressive</label>
                            <div className="grid grid-cols-6 gap-3 mb-6">
                              {['😊', '😄', '😆', '😍', '🥰', '😘', '😍', '🤩', '😎', '🥸', '😝', '🤪', '😁', '😃', '😀', '☺️'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-indigo-200 ring-4 ring-indigo-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">🐕 Animals & Pets</label>
                            <div className="grid grid-cols-6 gap-3 mb-6">
                              {['🐶', '🐕', '🦮', '🐱', '😸', '😹', '😻', '😺', '🐰', '🐹', '🦊', '🐻', '🐼', '🦁', '🐯', '🦒'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-indigo-200 ring-4 ring-indigo-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">✨ Creative & Cool</label>
                            <div className="grid grid-cols-6 gap-3 mb-6">
                              {['🚀', '⭐', '🌟', '💫', '🌈', '💎', '🎨', '🎭', '🎪', '🎸', '🎯', '🏆', '👑', '💪', '🔥', '⚡'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-indigo-200 ring-4 ring-indigo-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">🌸 Nature & Vibes</label>
                            <div className="grid grid-cols-6 gap-3 mb-8">
                              {['🌻', '🌺', '🌸', '🌼', '🦋', '🐝', '🌙', '☀️', '💚', '💜', '💙', '🌊', '🏔️', '🌲', '🍀', '🎋'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setSelectedAvatarEmoji(emoji)}
                                  className={`text-6xl p-2 rounded-lg transition ${selectedAvatarEmoji === emoji ? 'bg-indigo-200 ring-4 ring-indigo-600 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Background Color Selection */}
                          <div>
                            <label className="block font-semibold text-gray-800 mb-4">Circle Color (Optional)</label>
                            <div className="grid grid-cols-5 gap-3 mb-6">
                              {['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500', 'bg-cyan-500', 'bg-orange-500'].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setSelectedAvatarColor(color)}
                                  className={`w-12 h-12 rounded-full transition ${color} ${selectedAvatarColor === color ? 'ring-4 ring-offset-2 ring-gray-800 scale-110' : 'hover:opacity-80'}`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Preview */}
                          <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-indigo-200">
                            <p className="text-gray-600 font-semibold mb-4">Preview</p>
                            <div className={`${selectedAvatarColor} w-40 h-40 rounded-full flex items-center justify-center text-9xl shadow-lg mx-auto border-4 border-indigo-100`}>
                              {selectedAvatarEmoji}
                            </div>
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setUserAvatar(`emoji-${selectedAvatarEmoji}`);
                                setAvatarType('emoji');
                                setShowAvatarCreation(false);
                              }}
                              className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition"
                            >
                              Save Emoji Avatar
                            </button>
                            <button
                              onClick={() => setShowAvatarCreation(false)}
                              className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Photo Avatar Upload
                        <div className="space-y-6">
                          <div className="border-2 border-dashed border-indigo-400 rounded-lg p-8 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setUploadedPhoto(event.target?.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                              id="photo-upload-feed"
                            />
                            <label htmlFor="photo-upload-feed" className="cursor-pointer">
                              <div className="text-5xl mb-4">📸</div>
                              <p className="font-semibold text-gray-800 mb-2">Click to upload a photo</p>
                              <p className="text-sm text-gray-600">or drag and drop (JPG, PNG, GIF)</p>
                            </label>
                          </div>

                          {uploadedPhoto && (
                            <div className="bg-gray-50 rounded-lg p-8 text-center">
                              <p className="text-gray-600 font-semibold mb-4">Preview</p>
                              <img src={uploadedPhoto} alt="Preview" className="w-40 h-40 rounded-full object-cover shadow-lg mx-auto border-4 border-indigo-200" />
                            </div>
                          )}

                          {/* Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setUserAvatar('photo-upload');
                                setAvatarType('photo');
                                setShowAvatarCreation(false);
                              }}
                              disabled={!uploadedPhoto}
                              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${uploadedPhoto ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                            >
                              Save Photo Avatar
                            </button>
                            <button
                              onClick={() => setShowAvatarCreation(false)}
                              className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                  <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Share something positive..." className="w-full p-3 border rounded-lg resize-none" rows="3" />
                  {isPremium && (
                    <select className="mt-2 p-2 border rounded-lg text-sm" defaultValue="public">
                      <option value="public">Public</option>
                      <option value="friends">Friends Only</option>
                      <option value="private">Private</option>
                    </select>
                  )}
                  {moderationError && (
                    <div className="mt-2 p-3 bg-orange-50 border-l-4 border-orange-400 rounded text-sm text-orange-800 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>{moderationError}</span>
                    </div>
                  )}
                  <button onClick={createPost} className="mt-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Post</button>
                </div>

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
                      <button onClick={() => toggleReaction(post.id)} className={`flex items-center gap-1 transition ${post.reactions?.some(r => r.user_id === user.id) ? 'text-red-500' : 'text-gray-600 hover:text-red-500'}`}>
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

                    <input type="text" placeholder="Add a positive comment..." value={commentInputs[post.id] || ''} onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))} className="w-full p-2 border rounded-lg text-sm" onKeyPress={(e) => {
                      if (e.key === 'Enter' && commentInputs[post.id]?.trim()) {
                        addComment(post.id, commentInputs[post.id]);
                      }
                    }} />
                  </div>
                ))}
              </>
            )}

            {/* Groups View (Premium) */}
            {view === 'groups' && isPremium && (
              <div>
                <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    My Groups
                  </h3>
                  {groups.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No groups yet. Create one to start chatting!</p>
                  ) : (
                    <div className="space-y-2">
                      {groups.map(group => (
                        <button key={group.id} onClick={() => { setCurrentGroup(group); loadGroupMessages(group.id); }} className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition">
                          <p className="font-medium">{group.name}</p>
                          <p className="text-sm text-gray-600">{group.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => {
                    const name = prompt('Group name:');
                    const desc = prompt('Group description:');
                    if (name && desc) createGroup(name, desc);
                  }} className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
                    Create New Group
                  </button>
                </div>

                {showTerms && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">TERMS OF SERVICE</h2>
                        <button onClick={() => setShowTerms(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                      </div>
                      <p className="text-sm text-gray-700 mb-4">Last Updated: December 14, 2025</p>

                      <section className="mb-3">
                        <h3 className="font-semibold">Welcome to Good Energy</h3>
                        <p className="text-sm text-gray-700">Good Energy is a social space designed for calm expression and positive connection. By using our service, you agree to these terms.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">1. Eligibility</h3>
                        <p className="text-sm text-gray-700">You must be at least 13 years old to use Good Energy. If you are under 18, you must have parental consent.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">2. Account Responsibilities</h3>
                        <p className="text-sm text-gray-700">You are responsible for maintaining the security of your account. You may not share your account with others. You must provide accurate information during registration. One account per person.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">3. Our Community Philosophy</h3>
                        <p className="text-sm text-gray-700">Good Energy exists to create a calm, drama-free environment. We ask that you:</p>
                        <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
                          <li>Share content that uplifts rather than divides</li>
                          <li>Respect the privacy of others</li>
                          <li>Use language that aligns with our positive tone</li>
                          <li>Avoid confrontation in public spaces</li>
                        </ul>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">4. Content Guidelines</h3>
                        <p className="text-sm text-gray-700">Allowed:</p>
                        <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
                          <li>Images and videos (up to 90 seconds)</li>
                          <li>Positive comments and reactions</li>
                          <li>Personal expression that respects others</li>
                          <li>Constructive, uplifting communication</li>
                        </ul>
                        <p className="text-sm text-gray-700 mt-2">Not Allowed:</p>
                        <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
                          <li>Harassment, bullying, or targeted negativity</li>
                          <li>Explicit sexual content</li>
                          <li>Violence or threats</li>
                          <li>Hate speech or discrimination</li>
                          <li>Spam or misleading content</li>
                          <li>Impersonation</li>
                          <li>Content that violates others' intellectual property</li>
                        </ul>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">5. Moderation & Aura System</h3>
                        <p className="text-sm text-gray-700">Good Energy uses a private regulation system: your participation is monitored for alignment with community values. Violations may result in temporary restricted access ("Quiet Mode") for reflection. Repeated violations may result in permanent removal. You will not be publicly labeled or shamed.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">6. Privacy in Moderation</h3>
                        <p className="text-sm text-gray-700">Your violation status is private. Other users cannot see your moderation history. We do not publicly announce enforcement actions.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">7. Content Ownership</h3>
                        <p className="text-sm text-gray-700">You retain ownership of content you post. You grant Good Energy a license to display and distribute your content within our service. You may delete your content at any time. Deleted content may remain in backups for up to 90 days.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">8. Prohibited Uses</h3>
                        <p className="text-sm text-gray-700">You may not attempt to bypass our moderation systems, use automated tools (bots) without permission, collect user data without consent, interfere with the service's operation, or use the service for illegal activities.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">9. Account Termination</h3>
                        <p className="text-sm text-gray-700">We reserve the right to suspend accounts that violate these terms, remove content that doesn't align with our values, and terminate accounts at our discretion. You may delete your account at any time through settings.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">10. Disclaimers</h3>
                        <p className="text-sm text-gray-700">Good Energy is provided "as is". We do not guarantee uninterrupted service. We are not responsible for user-generated content and are not liable for interactions between users.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">11. Changes to Terms</h3>
                        <p className="text-sm text-gray-700">We may update these terms. Continued use after changes constitutes acceptance.</p>
                      </section>

                      <section className="mb-3">
                        <h3 className="font-semibold">12. Contact</h3>
                        <p className="text-sm text-gray-700">For questions or appeals, please use the in-app Support form (click the Support button in the header) to submit a request; we will respond privately.</p>
                      </section>

                      <div className="mt-4 text-right">
                        <button onClick={() => setShowTerms(false)} className="bg-indigo-600 text-white px-4 py-2 rounded">Close</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <button onClick={() => { setShowTerms(true); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                    <span>Terms of Service</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button type="button" onClick={openPrivacy} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                    <span>Privacy Policy</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
            {/* Support modal trigger area could live here if needed */}
            {view === 'forum' && (
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <h2 className="text-lg font-semibold mb-3">Good Energy Forum</h2>
                <p className="text-sm text-gray-600 mb-4">Community-driven FAQ and Q&amp;A — ask questions and share answers.</p>

                <div className="mb-4">
                  <h3 className="font-medium">FAQ</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
                    <li>How do I upgrade to Premium? — Click Upgrade in the banner or Settings.</li>
                    <li>How does Word Finder validate words? — It checks against a public dictionary API.</li>
                    <li>How do I reset my space (Tic‑Tac‑Toe)? — Play/reset from the Reset view in the header.</li>
                  </ul>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium">Community Q&amp;A</h3>
                  {forumPosts.map(post => (
                    <div key={post.id} className="mb-3 p-3 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <Avatar config={post.author?.avatar_config} size={36} />
                        <div className="flex-1">
                          <p className="font-medium">Q: {post.question}</p>
                          <p className="text-xs text-gray-500">{post.author?.username || 'Anonymous'}</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {post.answers.map(a => (
                          <div key={a.id} className="p-2 bg-gray-50 rounded">
                            <div className="text-sm">A: {a.text}</div>
                            <div className="text-xs text-gray-500">{a.author?.username || 'Anonymous'}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input value={answerInputs[post.id] || ''} onChange={(e) => setAnswerInputs(prev => ({ ...prev, [post.id]: e.target.value }))} placeholder="Write an answer..." className="flex-1 p-2 border rounded" />
                        <button onClick={async () => {
                          const text = (answerInputs[post.id] || '').trim(); if (!text) return;
                          const created = await postAnswerToDB?.(post.id, text);
                          if (created && created.id) {
                            const newAns = { id: created.id, text: created.text, author: created.profiles || null };
                            setForumPosts(prev => prev.map(p => p.id === post.id ? { ...p, answers: [...p.answers, newAns] } : p));
                          } else {
                            setForumPosts(prev => prev.map(p => p.id === post.id ? { ...p, answers: [...p.answers, { id: Date.now(), text }] } : p));
                          }
                          setAnswerInputs(prev => ({ ...prev, [post.id]: '' }));
                        }} className="bg-indigo-600 text-white px-3 py-2 rounded">Answer</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-medium">Ask a Question</h3>
                  <div className="mt-2 flex gap-2">
                    <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Ask the community..." className="flex-1 p-2 border rounded" />
                    <button onClick={async () => {
                      const q = newQuestion.trim(); if (!q) return;
                      const created = await postQuestionToDB?.(q);
                      if (created && created.id) {
                        const newPost = { id: created.id, question: created.question, author: created.profiles || null, answers: [] };
                        setForumPosts(prev => [newPost, ...prev]);
                      } else {
                        setForumPosts(prev => [{ id: Date.now(), question: q, answers: [] }, ...prev]);
                      }
                      setNewQuestion('');
                    }} className="bg-green-600 text-white px-3 py-2 rounded">Post</button>
                  </div>
                </div>
              </div>
            )}
            {view === 'admin' && (profile?.is_admin || import.meta.env.DEV) && (
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <h2 className="text-lg font-semibold mb-3">Admin — Support Requests</h2>
                <p className="text-sm text-gray-600 mb-3">View and resolve support requests submitted by users.</p>
                <AdminSupport />
              </div>
            )}

            {/* Social View - same as before */}
            {view === 'social' && (
              <div>
                <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                  <h3 className="font-bold mb-3">Search Users</h3>
                  <div className="flex gap-2">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by username..." className="flex-1 p-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && searchUsers()} />
                    <button onClick={searchUsers} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"><Search className="w-5 h-5" /></button>
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
                          <button onClick={() => sendFriendRequest(result.id)} className="bg-blue-500 text-white px-4 py-1 rounded-lg hover:bg-blue-600">Add Friend</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {friendRequests.length > 0 && (
                  <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                    <h3 className="font-bold mb-3">Friend Requests</h3>
                    {friendRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-2 border rounded-lg mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar config={req.sender?.avatar_config} size={40} />
                          <span>{req.sender?.username}</span>
                        </div>
                        <button onClick={() => acceptFriendRequest(req.id, req.sender_id)} className="bg-green-500 text-white px-4 py-1 rounded-lg hover:bg-green-600">Accept</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="font-bold mb-3">Friends ({friends.length})</h3>
                  {friends.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No friends yet. Search for users above!</p>
                  ) : (
                    friends.map(friend => (
                      <div key={friend.friend_id} className="flex items-center justify-between p-2 border rounded-lg mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar config={friend.profile?.avatar_config} size={40} />
                          <span>{friend.profile?.username}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => unfriend(friend.friend_id)} className="bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 text-sm">Unfriend</button>
                          <button onClick={() => blockUser(friend.friend_id)} className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 text-sm">Block</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Premium Modal */}
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
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-indigo-600 mt-1" />
                    <div>
                      <p className="font-medium">Advanced Visibility</p>
                      <p className="text-sm text-gray-600">Control who sees your posts with granular settings</p>
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
                <p className="text-xs text-center text-gray-500 mt-2">This is a demo - upgrading is free for testing</p>
              </div>
            </div>
          )}

          {/* Word Finder Modal */}
          {showWordFinder && <WordFinderGame onClose={() => setShowWordFinder(false)} />}

          {/* Settings Modal with Premium Badge */}
          {showSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-2">
                  <button onClick={() => setIsEditingProfile(true)} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                    <span>Edit Profile</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>

                  {!isPremium && (
                    <button onClick={() => { setShowSettings(false); setShowPremiumModal(true); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between bg-gradient-to-r from-yellow-50 to-orange-50">
                      <span className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        <span className="font-medium">Upgrade to Premium</span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  )}

                  {isPremium && (
                    <button onClick={() => { setShowSettings(false); setShowWordFinder(true); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <span>Word Finder Game</span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  )}

                  <button onClick={() => { setShowSettings(false); setShowTerms(true); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
                    <span>Terms of Service</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>

                  <button type="button" onClick={() => { setShowSettings(false); openPrivacy(); }} className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between">
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
            </div>
          )}

        {/* Terms Modal */}
          {showTerms && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Terms of Service</h2>
                  <button onClick={() => setShowTerms(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                </div>
                <p className="text-sm text-gray-700 mb-4">Last updated: December 15, 2025</p>
                <section className="mb-4">
                  <h3 className="font-semibold">1. Acceptance</h3>
                  <p className="text-sm text-gray-700">By accessing or using Good Energy you agree to these Terms. Please read them carefully. If you do not agree, do not use the service.</p>
                </section>
                <section className="mb-4">
                  <h3 className="font-semibold">2. Use of Service</h3>
                  <p className="text-sm text-gray-700">You may use the Service in accordance with applicable laws and these Terms. You are responsible for your account and for any activity that occurs under your account.</p>
                </section>
                <section className="mb-4">
                  <h3 className="font-semibold">3. Content</h3>
                  <p className="text-sm text-gray-700">Users may post content, questions, and answers. You retain ownership of the content you post but grant Good Energy a license to host, display, and distribute it as needed to operate the Service.</p>
                </section>
                <section className="mb-4">
                  <h3 className="font-semibold">4. Community Guidelines</h3>
                  <p className="text-sm text-gray-700">Treat others with respect. Do not post unlawful, abusive, defamatory, or harassing content. The Moderation Engine may moderate posts to keep the community positive.</p>
                </section>
                <section className="mb-4">
                  <h3 className="font-semibold">5. Privacy</h3>
                  <p className="text-sm text-gray-700">Our <button type="button" onClick={() => { setShowTerms(false); openPrivacy(); }} className="text-indigo-600 underline">Privacy Policy</button> describes how we collect and use personal data.</p>
                </section>
                <section className="mb-4">
                  <h3 className="font-semibold">6. Changes</h3>
                  <p className="text-sm text-gray-700">We may update these Terms. We will provide notice for material changes. Continued use after changes constitutes acceptance.</p>
                </section>
                <div className="mt-4 text-right">
                  <button onClick={() => setShowTerms(false)} className="bg-indigo-600 text-white px-4 py-2 rounded">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Modal */}
          {showPrivacy && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">PRIVACY POLICY</h2>
                  <button onClick={() => setShowPrivacy(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                </div>
                <p className="text-sm text-gray-700 mb-4">Last Updated: December 14, 2025</p>

                <section className="mb-3">
                  <h3 className="font-semibold">Our Commitment</h3>
                  <p className="text-sm text-gray-700">Good Energy respects your privacy. This policy explains how we collect, use, and protect your information.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Information We Collect</h3>
                  <p className="text-sm text-gray-700">Account Information: Email address; Password (encrypted); Avatar configuration (stored as data, not photos). Content You Create: Posts (images, videos, captions), Comments, Emoji reactions. Automatically Collected: Device information, Usage patterns, IP address, Session data.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">What We Don't Collect</h3>
                  <p className="text-sm text-gray-700">Phone numbers, Real names (unless you choose to share), Location data, Browsing history outside our app.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">How We Use Your Information</h3>
                  <p className="text-sm text-gray-700">To provide and improve our service, to moderate content and ensure community safety, to communicate important updates, and to analyze usage patterns (aggregated, not individual).</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">We Never</h3>
                  <p className="text-sm text-gray-700">Sell your data to third parties, show you ads based on your data, track you across other websites, or share your private information publicly.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Data Storage & Retention</h3>
                  <p className="text-sm text-gray-700">Your data is stored securely with industry-standard encryption. Media files are stored on secure servers. We retain data while your account is active. Deleted accounts are purged within 30 days.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Your Privacy Rights</h3>
                  <p className="text-sm text-gray-700">You have the right to access your data, delete your account and data, export your content, opt out of certain data collection, and request corrections to your information.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Moderation & Aura System Privacy</h3>
                  <p className="text-sm text-gray-700">Your violation history is private. Moderation decisions are not shared with other users. Your aura status (blue/orange/black) is visible only to you. Moderation is designed to be non-stigmatizing.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Third-Party Services</h3>
                  <p className="text-sm text-gray-700">We use Supabase (database and authentication) and cloud storage providers for media. These services have their own privacy policies.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Children's Privacy</h3>
                  <p className="text-sm text-gray-700">We do not knowingly collect information from children under 13 without parental consent.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Data Security</h3>
                  <p className="text-sm text-gray-700">We implement encrypted data transmission, secure password storage, regular security audits, and access controls. However, no system is 100% secure. You are responsible for protecting your password.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">International Users</h3>
                  <p className="text-sm text-gray-700">Your data may be processed in countries outside your residence. By using Good Energy, you consent to this transfer.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Changes to Privacy Policy</h3>
                  <p className="text-sm text-gray-700">We will notify users of significant changes via in-app notice. Continued use after changes constitutes acceptance.</p>
                </section>

                <section className="mb-3">
                  <h3 className="font-semibold">Contact</h3>
                  <p className="text-sm text-gray-700">For privacy concerns, please use the in-app Support form (click the Support button in the header).</p>
                </section>

                <div className="mt-4 text-right">
                  <button onClick={() => setShowPrivacy(false)} className="bg-indigo-600 text-white px-4 py-2 rounded">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Support Modal */}
          {showSupport && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Contact Support</h2>
                  <button onClick={() => setShowSupport(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                </div>
                <p className="text-sm text-gray-700 mb-4">Describe your issue and our team will review it. This creates an internal support request (no external email used).</p>
                <textarea value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} className="w-full p-3 border rounded mb-4" rows={6} placeholder="Enter your message..." />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowSupport(false)} className="px-4 py-2 rounded border">Cancel</button>
                  <button onClick={async () => {
                    const msg = supportMessage.trim(); if (!msg) return alert('Please describe your issue');
                    const created = await createSupportRequest?.(msg);
                    if (created) {
                      alert('Support request submitted — thank you.');
                    } else {
                      alert('Support request saved locally.');
                    }
                    setSupportMessage('');
                    setShowSupport(false);
                  }} className="bg-indigo-600 text-white px-4 py-2 rounded">Send</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>;
  }
}
