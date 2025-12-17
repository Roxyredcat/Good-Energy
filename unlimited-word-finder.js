// Unlimited Word Finder Game (Premium Feature)
// Place this BEFORE the main App component in src/App.jsx

const WordFinderGame = ({ onClose }) => {
  const [grid, setGrid] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [foundWords, setFoundWords] = useState([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Common positive words to seed the grid (but players can find ANY words)
  const seedWords = ['CALM', 'PEACE', 'KIND', 'LOVE', 'HOPE', 'JOY', 'TRUST', 'GRACE', 'LIGHT', 'SMILE'];
  
  // Dictionary of valid 3+ letter words (simplified - in production, use a real dictionary API)
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
    'YEAH', 'YEAR', 'YOUR', 'ZONE'
  ]);
  
  useEffect(() => {
    generateGrid();
  }, []);
  
  const generateGrid = () => {
    const size = 8;
    const newGrid = Array(size).fill().map(() => 
      Array(size).fill().map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
    );
    
    // Place seed words in various directions
    seedWords.slice(0, 5).forEach((word) => {
      const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * (size - word.length));
      
      if (direction === 'horizontal') {
        for (let j = 0; j < word.length; j++) {
          newGrid[row][col + j] = word[j];
        }
      } else {
        for (let j = 0; j < word.length; j++) {
          if (row + j < size) {
            newGrid[row + j][col] = word[j];
          }
        }
      }
    });
    
    setGrid(newGrid);
    setFoundWords([]);
    setScore(0);
    setSelectedCells([]);
    setCurrentWord('');
    setMessage('Find any words! Drag across letters.');
  };
  
  const handleCellMouseDown = (row, col) => {
    setIsDragging(true);
    setSelectedCells([{ row, col }]);
    setCurrentWord(grid[row][col]);
  };
  
  const handleCellMouseEnter = (row, col) => {
    if (!isDragging) return;
    
    const lastCell = selectedCells[selectedCells.length - 1];
    if (!lastCell) return;
    
    // Check if adjacent (horizontal or vertical only)
    const isAdjacent = 
      (Math.abs(row - lastCell.row) === 1 && col === lastCell.col) ||
      (Math.abs(col - lastCell.col) === 1 && row === lastCell.row);
    
    if (isAdjacent && !selectedCells.some(cell => cell.row === row && cell.col === col)) {
      setSelectedCells([...selectedCells, { row, col }]);
      setCurrentWord(currentWord + grid[row][col]);
    }
  };
  
  const handleCellMouseUp = () => {
    setIsDragging(false);
    checkWord();
  };
  
  const checkWord = () => {
    const word = currentWord.toUpperCase();
    
    if (word.length < 3) {
      setMessage('Words must be at least 3 letters');
      setSelectedCells([]);
      setCurrentWord('');
      return;
    }
    
    if (foundWords.includes(word)) {
      setMessage('Already found that word!');
      setSelectedCells([]);
      setCurrentWord('');
      return;
    }
    
    if (validWords.has(word)) {
      const points = word.length * 10;
      setFoundWords([...foundWords, word]);
      setScore(score + points);
      setMessage(`✨ Found "${word}"! +${points} points`);
    } else {
      setMessage(`"${word}" is not a valid word`);
    }
    
    setSelectedCells([]);
    setCurrentWord('');
    
    setTimeout(() => setMessage(''), 2000);
  };
  
  const isCellSelected = (row, col) => {
    return selectedCells.some(cell => cell.row === row && cell.col === col);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Word Finder</h3>
            <p className="text-sm text-gray-600">Drag across letters to form words (3+ letters)</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="bg-indigo-50 p-3 rounded-lg mb-4">
          <p className="text-center font-bold text-indigo-600 text-2xl">Score: {score}</p>
          <p className="text-center text-sm text-gray-600">Found: {foundWords.length} words</p>
          {currentWord && (
            <p className="text-center text-lg font-bold text-blue-600 mt-2">
              {currentWord}
            </p>
          )}
        </div>
        
        {message && (
          <div className="bg-blue-100 border-l-4 border-blue-500 p-3 rounded mb-4 text-sm">
            {message}
          </div>
        )}
        
        <div 
          className="grid grid-cols-8 gap-1 mb-4 select-none"
          onMouseLeave={() => {
            if (isDragging) {
              setIsDragging(false);
              checkWord();
            }
          }}
        >
          {grid.map((row, i) => 
            row.map((letter, j) => (
              <div
                key={`${i}-${j}`}
                onMouseDown={() => handleCellMouseDown(i, j)}
                onMouseEnter={() => handleCellMouseEnter(i, j)}
                onMouseUp={handleCellMouseUp}
                className={`aspect-square rounded flex items-center justify-center font-bold text-sm cursor-pointer transition-colors ${
                  isCellSelected(i, j)
                    ? 'bg-indigo-600 text-white scale-110'
                    : 'bg-blue-100 hover:bg-blue-200'
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
            {foundWords.map((word, i) => (
              <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                {word} ({word.length * 10})
              </span>
            ))}
          </div>
        </div>
        
        <button
          onClick={generateGrid}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
        >
          New Game
        </button>
      </div>
    </div>
  );
};