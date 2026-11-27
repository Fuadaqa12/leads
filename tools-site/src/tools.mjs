// Categories and tools. Names/descriptions live in src/i18n/<lang>.mjs under tools[id] = [name, description, keywords]
export const CATS = [
  { id: 'image', icon: 'image', color: '#f97316' },
  { id: 'pdf', icon: 'file', color: '#ef4444' },
  { id: 'text', icon: 'type', color: '#10b981' },
  { id: 'calc', icon: 'calc', color: '#f59e0b' },
  { id: 'convert', icon: 'ruler', color: '#06b6d4' },
  { id: 'dev', icon: 'code', color: '#6366f1' },
  { id: 'gen', icon: 'sparkles', color: '#ec4899' },
  { id: 'time', icon: 'clock', color: '#8b5cf6' },
  { id: 'media', icon: 'video', color: '#14b8a6' },
];

// kind: file | text | calc | gen  (used for generic how-to and FAQ text)
export const TOOLS = [
  // image
  { id: 'compress-image', cat: 'image', icon: 'compress', engine: 'image', opts: { mode: 'compress' }, kind: 'file', pop: 1 },
  { id: 'resize-image', cat: 'image', icon: 'resize', engine: 'image', opts: { mode: 'resize' }, kind: 'file', pop: 1 },
  { id: 'jpg-to-png', cat: 'image', icon: 'convert', engine: 'image', opts: { mode: 'convert', to: 'image/png' }, kind: 'file' },
  { id: 'png-to-jpg', cat: 'image', icon: 'convert', engine: 'image', opts: { mode: 'convert', to: 'image/jpeg' }, kind: 'file', pop: 1 },
  { id: 'webp-to-jpg', cat: 'image', icon: 'convert', engine: 'image', opts: { mode: 'convert', to: 'image/jpeg' }, kind: 'file' },
  { id: 'image-to-webp', cat: 'image', icon: 'convert', engine: 'image', opts: { mode: 'convert', to: 'image/webp' }, kind: 'file' },
  { id: 'image-converter', cat: 'image', icon: 'convert', engine: 'image', opts: { mode: 'convert', to: 'image/png' }, kind: 'file' },
  { id: 'rotate-image', cat: 'image', icon: 'rotate', engine: 'image', opts: { mode: 'rotate' }, kind: 'file' },
  { id: 'photo-filters', cat: 'image', icon: 'sliders', engine: 'image', opts: { mode: 'filter' }, kind: 'file' },
  { id: 'image-to-base64', cat: 'image', icon: 'binary', engine: 'image', opts: { mode: 'base64' }, kind: 'file' },
  // pdf
  { id: 'merge-pdf', cat: 'pdf', icon: 'layers', engine: 'pdf', opts: { mode: 'merge' }, kind: 'file', pop: 1, vendor: ['pdf-lib.min.js'] },
  { id: 'split-pdf', cat: 'pdf', icon: 'scissors', engine: 'pdf', opts: { mode: 'split' }, kind: 'file', vendor: ['pdf-lib.min.js'] },
  { id: 'jpg-to-pdf', cat: 'pdf', icon: 'image', engine: 'pdf', opts: { mode: 'images' }, kind: 'file', pop: 1, vendor: ['pdf-lib.min.js'] },
  { id: 'rotate-pdf', cat: 'pdf', icon: 'rotate', engine: 'pdf', opts: { mode: 'rotate' }, kind: 'file', vendor: ['pdf-lib.min.js'] },
  { id: 'delete-pdf-pages', cat: 'pdf', icon: 'trash', engine: 'pdf', opts: { mode: 'delete' }, kind: 'file', vendor: ['pdf-lib.min.js'] },
  // text
  { id: 'word-counter', cat: 'text', icon: 'hash', engine: 'text', opts: { mode: 'counter' }, kind: 'text', pop: 1 },
  { id: 'case-converter', cat: 'text', icon: 'case', engine: 'text', opts: { mode: 'case' }, kind: 'text' },
  { id: 'remove-duplicate-lines', cat: 'text', icon: 'list', engine: 'text', opts: { mode: 'dedupe' }, kind: 'text' },
  { id: 'sort-lines', cat: 'text', icon: 'sort', engine: 'text', opts: { mode: 'sort' }, kind: 'text' },
  { id: 'find-and-replace', cat: 'text', icon: 'search', engine: 'text', opts: { mode: 'replace' }, kind: 'text' },
  { id: 'remove-extra-spaces', cat: 'text', icon: 'eraser', engine: 'text', opts: { mode: 'clean' }, kind: 'text' },
  { id: 'text-to-speech', cat: 'text', icon: 'volume', engine: 'text', opts: { mode: 'tts' }, kind: 'text', pop: 1 },
  { id: 'reverse-text', cat: 'text', icon: 'undo', engine: 'text', opts: { mode: 'reverse' }, kind: 'text' },
  { id: 'slug-generator', cat: 'text', icon: 'link', engine: 'text', opts: { mode: 'slug' }, kind: 'text' },
  // calculators
  { id: 'percentage-calculator', cat: 'calc', icon: 'percent', engine: 'calc', opts: { mode: 'percent' }, kind: 'calc', pop: 1 },
  { id: 'bmi-calculator', cat: 'calc', icon: 'heart', engine: 'calc', opts: { mode: 'bmi' }, kind: 'calc', pop: 1 },
  { id: 'age-calculator', cat: 'calc', icon: 'cake', engine: 'calc', opts: { mode: 'age' }, kind: 'calc', pop: 1 },
  { id: 'loan-calculator', cat: 'calc', icon: 'bank', engine: 'calc', opts: { mode: 'loan' }, kind: 'calc', pop: 1 },
  { id: 'compound-interest-calculator', cat: 'calc', icon: 'trend', engine: 'calc', opts: { mode: 'compound' }, kind: 'calc' },
  { id: 'discount-calculator', cat: 'calc', icon: 'tag', engine: 'calc', opts: { mode: 'discount' }, kind: 'calc' },
  { id: 'tip-calculator', cat: 'calc', icon: 'receipt', engine: 'calc', opts: { mode: 'tip' }, kind: 'calc' },
  { id: 'calorie-calculator', cat: 'calc', icon: 'flame', engine: 'calc', opts: { mode: 'calorie' }, kind: 'calc' },
  { id: 'date-difference-calculator', cat: 'calc', icon: 'calendar', engine: 'calc', opts: { mode: 'datediff' }, kind: 'calc' },
  { id: 'average-calculator', cat: 'calc', icon: 'sigma', engine: 'calc', opts: { mode: 'average' }, kind: 'calc' },
  // converters
  { id: 'length-converter', cat: 'convert', icon: 'ruler', engine: 'unit', opts: { cat: 'length' }, kind: 'calc' },
  { id: 'weight-converter', cat: 'convert', icon: 'scale', engine: 'unit', opts: { cat: 'weight' }, kind: 'calc' },
  { id: 'temperature-converter', cat: 'convert', icon: 'thermo', engine: 'unit', opts: { cat: 'temperature' }, kind: 'calc' },
  { id: 'area-converter', cat: 'convert', icon: 'grid', engine: 'unit', opts: { cat: 'area' }, kind: 'calc' },
  { id: 'volume-converter', cat: 'convert', icon: 'beaker', engine: 'unit', opts: { cat: 'volume' }, kind: 'calc' },
  { id: 'speed-converter', cat: 'convert', icon: 'gauge', engine: 'unit', opts: { cat: 'speed' }, kind: 'calc' },
  { id: 'data-size-converter', cat: 'convert', icon: 'db', engine: 'unit', opts: { cat: 'data' }, kind: 'calc' },
  { id: 'color-converter', cat: 'convert', icon: 'palette', engine: 'dev', opts: { mode: 'color' }, kind: 'calc' },
  { id: 'timestamp-converter', cat: 'convert', icon: 'clock', engine: 'dev', opts: { mode: 'timestamp' }, kind: 'calc' },
  // developer
  { id: 'json-formatter', cat: 'dev', icon: 'braces', engine: 'dev', opts: { mode: 'json' }, kind: 'text', pop: 1 },
  { id: 'base64-encode-decode', cat: 'dev', icon: 'binary', engine: 'dev', opts: { mode: 'base64' }, kind: 'text' },
  { id: 'url-encode-decode', cat: 'dev', icon: 'link', engine: 'dev', opts: { mode: 'url' }, kind: 'text' },
  { id: 'hash-generator', cat: 'dev', icon: 'key', engine: 'dev', opts: { mode: 'hash' }, kind: 'text' },
  { id: 'uuid-generator', cat: 'dev', icon: 'id', engine: 'dev', opts: { mode: 'uuid' }, kind: 'gen' },
  // generators
  { id: 'password-generator', cat: 'gen', icon: 'lock', engine: 'dev', opts: { mode: 'password' }, kind: 'gen', pop: 1 },
  { id: 'qr-code-generator', cat: 'gen', icon: 'qr', engine: 'dev', opts: { mode: 'qr' }, kind: 'gen', pop: 1, vendor: ['qrcode.js'] },
  { id: 'random-number-generator', cat: 'gen', icon: 'dice', engine: 'calc', opts: { mode: 'random' }, kind: 'gen' },
  { id: 'spin-the-wheel', cat: 'gen', icon: 'wheel', engine: 'wheel', opts: {}, kind: 'gen', pop: 1 },
  { id: 'coin-flip', cat: 'gen', icon: 'coin', engine: 'calc', opts: { mode: 'random', sub: 'coin' }, kind: 'gen' },
  { id: 'lorem-ipsum-generator', cat: 'gen', icon: 'align', engine: 'text', opts: { mode: 'lorem' }, kind: 'gen' },
  // time
  { id: 'online-stopwatch', cat: 'time', icon: 'timer', engine: 'time', opts: { mode: 'stopwatch' }, kind: 'gen', pop: 1 },
  { id: 'countdown-timer', cat: 'time', icon: 'hourglass', engine: 'time', opts: { mode: 'timer' }, kind: 'gen' },
  // media
  { id: 'screen-recorder', cat: 'media', icon: 'monitor', engine: 'media', opts: { mode: 'screen' }, kind: 'gen', pop: 1 },
  { id: 'voice-recorder', cat: 'media', icon: 'mic', engine: 'media', opts: { mode: 'voice' }, kind: 'gen' },
];
