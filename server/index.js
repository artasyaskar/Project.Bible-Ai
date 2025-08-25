// Load environment variables locally only in development
if (process.env.NODE_ENV !== 'production') {
  // Ensure we load the .env that lives in the server/ folder
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
}

// Helper: translate text to a target language while preserving verse/citation markers
const DISABLE_URDU_TRANSLATIONS = String(process.env.DISABLE_URDU_TRANSLATIONS || '').toLowerCase() === 'true';
async function translateText(text, targetLang) {
  if (!text || !targetLang) return text;
  if (DISABLE_URDU_TRANSLATIONS && /urdu/i.test(targetLang)) {
    // Skip Urdu translation if disabled by env to save API quota
    return undefined;
  }
  const instruction = `Translate the following text to ${targetLang}.

Rules:
- Preserve verse markers like (12), (1), etc.
- Preserve citation tokens like v1, v2–4 exactly.
- Do NOT add commentary. Return only the translated text.
- If the target language is Urdu: strictly use "یسوع" for Jesus (never "عیسیٰ") and "یوحنا" for John (never "یحییٰ" or similar). Replace any such occurrences accordingly.
- Perspective and terminology: use a strictly Christian background and avoid Islamic/Muslim terminology or titles.

Text:
${text}`;
  const result = await trackAndGenerate(instruction, { temperature: 0.0, maxOutputTokens: undefined });
  // Post-process to enforce Urdu naming preference only for Urdu
  return /urdu/i.test(targetLang) ? enforceUrduJesus(result) : result;
}

// Enforce Urdu naming preferences: always use "یسوع" for Jesus and "یوحنا" for John
function enforceUrduJesus(input) {
  if (!input || typeof input !== 'string') return input;
  // Common variants with/without diacritics and small alef
  const patterns = [
    // Jesus
    /عِ?ی\s?س\s?ی(?:ٰ|ٗ|ِ|ُ|ْ|ّ)?/g, // covers عیسی, عِیسی, عیسیٰ and minor diacritics/spaces
    /عیسٰی/g,
    // John (Yahya variants -> Yohanna)
    /یح(?:ی|ي)ی(?:ٰ|ٗ|ِ|ُ|ْ|ّ)?/g, // یحیی, یحيي, یحییٰ
    /یحیا/g, // یحیا
    /يحيى/g // Arabic form
  ];
  let out = input;
  // First replace Jesus variants
  out = out.replace(/(?:عِ?ی\s?س\s?ی(?:ٰ|ٗ|ِ|ُ|ْ|ّ)?|عیسٰی)/g, 'یسوع');
  // Then replace John variants
  out = out.replace(/(?:یح(?:ی|ي)ی(?:ٰ|ٗ|ِ|ُ|ْ|ّ)?|یحیا|يحيى)/g, 'یوحنا');
  return out;
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@vercel/kv');

const app = express();

// --- Admin/Usage config ---
const ADMIN_DASHBOARD_KEY = process.env.ADMIN_DASHBOARD_KEY || '';
const MONTHLY_TOKEN_BUDGET = Number(process.env.MONTHLY_TOKEN_BUDGET || 0); // optional, total tokens budget for month

// Free tier limits (based on Gemini's free tier)
const FREE_TIER_LIMITS = {
  REQUESTS_PER_MINUTE: 60,          // 60 requests per minute
  REQUESTS_PER_DAY: 1000,           // 1,000 requests per day
  CHARACTERS_PER_MINUTE: 60000,     // 60,000 characters per minute
  CHARACTERS_PER_DAY: 1000000,      // 1,000,000 characters per day
};

// Track usage for rate limiting and quota monitoring
const usageTracking = {
  currentMinute: Math.floor(Date.now() / 60000),
  currentDay: new Date().toDateString(),
  minuteCount: 0,
  dayCount: 0,
  minuteChars: 0,
  dayChars: 0,
  lastReset: Date.now(),

  checkAndResetCounters() {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const currentDay = new Date().toDateString();
    
    // Reset minute counters if needed
    if (currentMinute !== this.currentMinute) {
      this.currentMinute = currentMinute;
      this.minuteCount = 0;
      this.minuteChars = 0;
      this.lastReset = now;
    }
    
    // Reset daily counters if needed
    if (currentDay !== this.currentDay) {
      this.currentDay = currentDay;
      this.dayCount = 0;
      this.dayChars = 0;
    }
  },
  
  recordUsage(charCount) {
    this.checkAndResetCounters();
    this.minuteCount++;
    this.dayCount++;
    this.minuteChars += charCount;
    this.dayChars += charCount;
  },
  
  getUsageStatus() {
    this.checkAndResetCounters();
    const usageStatus = {
      // Current minute rate limits
      minuteRequests: this.minuteCount,
      minuteLimit: FREE_TIER_LIMITS.REQUESTS_PER_MINUTE,
      minuteChars: this.minuteChars,
      charMinuteLimit: FREE_TIER_LIMITS.CHARACTERS_PER_MINUTE,
      
      // Daily rate limits
      dailyRequests: this.dayCount,
      dailyLimit: FREE_TIER_LIMITS.REQUESTS_PER_DAY,
      dailyChars: this.dayChars,
      charDailyLimit: FREE_TIER_LIMITS.CHARACTERS_PER_DAY,
      dayCount: this.dayCount,
      
      // Status flags (50% buffer for warning, 80% for critical)
      isApproachingLimit: (
        this.dayCount >= (FREE_TIER_LIMITS.REQUESTS_PER_DAY * 0.5) ||
        this.dayChars >= (FREE_TIER_LIMITS.CHARACTERS_PER_DAY * 0.5) ||
        this.minuteCount >= (FREE_TIER_LIMITS.REQUESTS_PER_MINUTE * 0.5) ||
        this.minuteChars >= (FREE_TIER_LIMITS.CHARACTERS_PER_MINUTE * 0.5)
      ),
      
      isOverLimit: (
        this.dayCount >= (FREE_TIER_LIMITS.REQUESTS_PER_DAY * 0.8) ||
        this.dayChars >= (FREE_TIER_LIMITS.CHARACTERS_PER_DAY * 0.8) ||
        this.minuteCount >= (FREE_TIER_LIMITS.REQUESTS_PER_MINUTE * 0.8) ||
        this.minuteChars >= (FREE_TIER_LIMITS.CHARACTERS_PER_MINUTE * 0.8)
      ),
      
      isCritical: (
        this.dayCount >= FREE_TIER_LIMITS.REQUESTS_PER_DAY * 0.9 ||
        this.dayChars >= FREE_TIER_LIMITS.CHARACTERS_PER_DAY * 0.9 ||
        this.minuteCount >= FREE_TIER_LIMITS.REQUESTS_PER_MINUTE * 0.9 ||
        this.minuteChars >= FREE_TIER_LIMITS.CHARACTERS_PER_MINUTE * 0.9
      )
    };
    return usageStatus;
  }
};

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(limiter);

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Utility sleep
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// In-memory caches and simple locks
if (!global.__dailySummaryCache) global.__dailySummaryCache = new Map();
if (!global.__dailySummaryLocks) global.__dailySummaryLocks = new Map();
const DAILY_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Cache for specific chapter summaries
if (!global.__chapterSummaryCache) global.__chapterSummaryCache = new Map();
if (!global.__chapterSummaryLocks) global.__chapterSummaryLocks = new Map();
const CHAPTER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Initialize Vercel KV client
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// --- Persistent usage tracker using Vercel KV
async function getUsage() {
  try {
    const usage = await kv.get('usage') || {
      periodStart: getMonthStart(),
      inputTokens: 0,
      outputTokens: 0,
      requests: 0
    };
    return usage;
  } catch (error) {
    console.error('KV get error:', error);
    return {
      periodStart: getMonthStart(),
      inputTokens: 0,
      outputTokens: 0,
      requests: 0
    };
  }
}

async function updateUsage(updates) {
  try {
    const current = await getUsage();
    const nowStart = getMonthStart();
    
    // Reset if new month
    if (current.periodStart !== nowStart) {
      current.periodStart = nowStart;
      current.inputTokens = 0;
      current.outputTokens = 0;
      current.requests = 0;
    }
    
    // Apply updates
    if (updates.inputTokens) current.inputTokens += updates.inputTokens;
    if (updates.outputTokens) current.outputTokens += updates.outputTokens;
    if (updates.requests) current.requests += updates.requests;
    
    // Save back to KV with 30-day TTL
    await kv.set('usage', current, { ex: 30 * 24 * 60 * 60 });
    return current;
  } catch (error) {
    console.error('KV set error:', error);
    return null;
  }
}

function getMonthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0)).getTime();
}

// Count tokens via Gemini countTokens API
async function countTokens(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const model = 'models/gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:countTokens?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: String(text || '') }]
      }
    ]
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    // Fall back to rough estimate (4 chars per token) on failure
    const rough = Math.ceil(String(text || '').length / 4);
    return rough;
  }
  const data = await resp.json().catch(() => ({}));
  return Number(data?.totalTokens || 0);
}

// Simple helper to call Gemini REST API with retries and timeout
async function generateWithGemini(prompt, { temperature = 0.7, maxOutputTokens } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature,
      ...(maxOutputTokens ? { maxOutputTokens } : {})
    }
  };

  const maxRetries = 3;
  let attempt = 0;
  let lastErr;

  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error?.message || JSON.stringify(data) || `Gemini API error: ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        console.error('Gemini error:', { status: response.status, body: data });
        // Retry only on 429 or 5xx
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          lastErr = err;
        } else {
          throw err;
        }
      } else {
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        return text.trim();
      }
    } catch (e) {
      clearTimeout(timeout);
      // Retry on abort/network errors
      if (e.name === 'AbortError' || e.code === 'ECONNRESET') {
        lastErr = e;
      } else if (!lastErr) {
        lastErr = e;
      }
    }

    if (attempt < maxRetries) {
      const backoff = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await sleep(backoff);
    }
  }

  throw lastErr || new Error('Gemini request failed');
}

// Wrapper to track token usage per request
async function trackAndGenerate(prompt, opts = {}) {
  let input = 0;
  try {
    input = await countTokens(prompt);
  } catch (_) {
    input = Math.ceil(String(prompt || '').length / 4);
  }
  
  const text = await generateWithGemini(prompt, opts);
  
  let output = 0;
  try {
    output = await countTokens(text);
  } catch (_) {
    output = Math.ceil(String(text || '').length / 4);
  }
  
  // Update usage in KV store
  await updateUsage({
    inputTokens: input,
    outputTokens: output,
    requests: 1
  });
  
  return text;
}

// Canonical list of Bible books with chapter counts (for validation and normalization)
const allBibleBooks = [
  { name: "Genesis", chapters: 50 }, { name: "Exodus", chapters: 40 }, { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 }, { name: "Deuteronomy", chapters: 34 }, { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 }, { name: "Ruth", chapters: 4 }, { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 }, { name: "1 Kings", chapters: 22 }, { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 }, { name: "2 Chronicles", chapters: 36 }, { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 }, { name: "Esther", chapters: 10 }, { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 }, { name: "Proverbs", chapters: 31 }, { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 }, { name: "Isaiah", chapters: 66 }, { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 }, { name: "Ezekiel", chapters: 48 }, { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 }, { name: "Joel", chapters: 3 }, { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 }, { name: "Jonah", chapters: 4 }, { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 }, { name: "Habakkuk", chapters: 3 }, { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 }, { name: "Zechariah", chapters: 14 }, { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 }, { name: "Mark", chapters: 16 }, { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 }, { name: "Acts", chapters: 28 }, { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 }, { name: "2 Corinthians", chapters: 13 }, { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 }, { name: "Philippians", chapters: 4 }, { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 }, { name: "2 Thessalonians", chapters: 3 }, { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 }, { name: "Titus", chapters: 3 }, { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 }, { name: "James", chapters: 5 }, { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 }, { name: "1 John", chapters: 5 }, { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 }, { name: "Jude", chapters: 1 }, { name: "Revelation", chapters: 22 }
];

function normalizeBookName(input) {
  if (!input) return null;
  const target = input.trim().toLowerCase();
  const match = allBibleBooks.find(b => b.name.toLowerCase() === target);
  return match ? match.name : null;
}

// Fetch Bible text (KJV) from bible-api.com
async function fetchBibleText(book, chapter, translation = 'kjv') {
  const cacheKey = `${translation.toLowerCase()}|${book}|${chapter}`;
  if (!global.__bibleCache) global.__bibleCache = new Map();
  const cache = global.__bibleCache;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const qBook = encodeURIComponent(book);
  const qChapter = encodeURIComponent(String(chapter));
  const url = `https://bible-api.com/${qBook}%20${qChapter}?translation=${encodeURIComponent(translation)}`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    const err = new Error(`Bible API error ${resp.status}: ${t || resp.statusText}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  // bible-api returns verses with 'text' and 'verse'
  const verses = (data?.verses || []).map(v => ({ number: v.verse, text: v.text }));
  const passageText = verses.map(v => `(${v.number}) ${v.text.trim()}`).join('\n');
  const result = { verses, passageText, meta: { book: data?.reference?.split(' ')[0] || book, chapter: String(chapter), translation: translation.toUpperCase() } };
  cache.set(cacheKey, result);
  return result;
}

// Validate verse citations like v12 or v3–5 exist in the provided verses
function validateCitations(summary, verses) {
  const maxVerse = verses.length;
  const singleRefs = Array.from(summary.matchAll(/\bv(\d+)\b/g)).map(m => parseInt(m[1], 10));
  const rangeRefs = Array.from(summary.matchAll(/\bv(\d+)[-–](\d+)\b/g)).flatMap(m => [parseInt(m[1], 10), parseInt(m[2], 10)]);
  const all = [...singleRefs, ...rangeRefs].filter(n => !isNaN(n));
  const invalid = all.filter(n => n < 1 || n > maxVerse);
  return { valid: invalid.length === 0, invalid, maxVerse };
}

// Parse citations and attach verse texts
function extractCitations(summary, verses) {
  const results = [];
  const seen = new Set();
  // ranges
  for (const m of summary.matchAll(/\bv(\d+)[-–](\d+)\b/g)) {
    const from = parseInt(m[1], 10);
    const to = parseInt(m[2], 10);
    if (isNaN(from) || isNaN(to)) continue;
    const key = `r:${from}-${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(1, Math.min(from, to));
    const end = Math.min(verses.length, Math.max(from, to));
    const list = verses.slice(start - 1, end).map(v => ({ number: v.number, text: v.text.trim() }));
    if (list.length) results.push({ label: `v${start}–${end}`, verses: list });
  }
  // singles
  for (const m of summary.matchAll(/\bv(\d+)\b/g)) {
    const n = parseInt(m[1], 10);
    if (isNaN(n) || n < 1 || n > verses.length) continue;
    const key = `s:${n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const v = verses[n - 1];
    if (v) results.push({ label: `v${n}`, verses: [{ number: v.number, text: v.text.trim() }] });
  }
  // limit to reasonable count
  return results.slice(0, 12);
}

// Serve static frontend locally
const publicDir = path.join(__dirname, '..', 'client', 'public');
app.use(express.static(publicDir));

// Log basic startup info for troubleshooting
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Serving static from:', publicDir);
console.log('Gemini key configured:', process.env.GEMINI_API_KEY ? 'yes' : 'no');
console.log('Admin dashboard enabled:', ADMIN_DASHBOARD_KEY ? 'yes' : 'no');

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Admin dashboard page (simple, static HTML)
app.get('/admin', (req, res) => {
  const adminFile = path.join(publicDir, 'admin.html');
  if (fs.existsSync(adminFile)) return res.sendFile(adminFile);
  res.status(404).send('Admin page not found');
});

// Health check (helps verify env and connectivity quickly)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    adminKeyConfigured: Boolean(ADMIN_DASHBOARD_KEY),
    adminKeyLength: ADMIN_DASHBOARD_KEY ? ADMIN_DASHBOARD_KEY.length : 0,
    monthlyBudget: MONTHLY_TOKEN_BUDGET
  });
});

// Admin usage endpoint with free tier tracking
app.get('/api/admin/usage', async (req, res) => {
  try {
    // Check admin key
    if (!ADMIN_DASHBOARD_KEY) {
      return res.status(403).json({ error: 'Admin dashboard not configured' });
    }
    
    const key = (req.query.key || '').toString();
    if (key !== ADMIN_DASHBOARD_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' });
    }

    // Get current usage status and KV store data
    const [usageStatus, usage] = await Promise.all([
      usageTracking.getUsageStatus(),
      getUsage()
    ]);
    
    const usedTokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
    const budget = MONTHLY_TOKEN_BUDGET > 0 ? MONTHLY_TOKEN_BUDGET : null;
    const remainingTokens = budget !== null ? Math.max(0, budget - usedTokens) : null;
    
    // Calculate time until next minute reset
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const secondsLeft = Math.ceil((nextMinute - now) / 1000);
    const resetMins = Math.floor(secondsLeft / 60);
    const resetSecs = secondsLeft % 60;
    
    // Calculate usage percentages for warnings
    const dailyPct = Math.min(100, Math.round((usageStatus.dailyRequests / usageStatus.dailyLimit) * 100));
    const minutePct = Math.min(100, Math.round((usageStatus.minuteRequests / usageStatus.minuteLimit) * 100));
    const tokenPct = budget ? Math.min(100, Math.round((usedTokens / budget) * 100)) : 0;
    
    // Prepare response
    const response = {
      // Current token usage
      tokens: {
        input: usage.inputTokens || 0,
        output: usage.outputTokens || 0,
        total: usedTokens,
        budget: budget,
        remaining: remainingTokens,
        periodStart: new Date(usage.periodStart).toISOString(),
        requests: usage.requests || 0
      },
      
      // Rate limit status
      rateLimits: {
        minute: {
          requests: usageStatus.minuteRequests,
          maxRequests: usageStatus.minuteLimit,
          characters: usageStatus.minuteChars,
          maxCharacters: usageStatus.charMinuteLimit,
          resetsIn: `${resetMins}m ${resetSecs}s`,
          percentage: minutePct
        },
        daily: {
          requests: usageStatus.dailyRequests,
          maxRequests: usageStatus.dailyLimit,
          characters: usageStatus.dailyChars,
          maxCharacters: usageStatus.charDailyLimit,
          resetsAt: 'Midnight UTC',
          percentage: dailyPct
        },
        tokens: {
          used: usedTokens,
          budget: budget,
          remaining: remainingTokens,
          percentage: tokenPct
        }
      },
      
      // Status indicators
      status: {
        isApproachingLimit: dailyPct >= 50 || minutePct >= 50 || tokenPct >= 50,
        isOverLimit: dailyPct >= 80 || minutePct >= 80 || tokenPct >= 80,
        isCritical: dailyPct >= 90 || minutePct >= 90 || tokenPct >= 90,
        shouldRotateKey: dailyPct >= 70 || minutePct >= 70 || tokenPct >= 70,
        
        nextAction: (dailyPct >= 90 || minutePct >= 90 || tokenPct >= 90)
          ? '⚠️ API key is near limits. Rotate key immediately.'
          : (dailyPct >= 70 || minutePct >= 70 || tokenPct >= 70)
            ? '⚠️ Approaching limits. Consider rotating your key soon.'
            : (dailyPct >= 50 || minutePct >= 50 || tokenPct >= 50)
              ? 'ℹ️ Usage is moderate. Monitor your usage.'
              : '✅ Usage is within safe limits.'
      },
      
      // Free tier information
      freeTierLimits: FREE_TIER_LIMITS,
      
      // Last updated timestamp
      timestamp: new Date().toISOString(),
      
      // Environment info (for debugging)
      environment: process.env.NODE_ENV || 'development',
      serverTime: new Date().toISOString()
    };
    
    console.log('[/api/admin/usage] Sending usage data');
    res.json(response);
    
  } catch (error) {
    console.error('[/api/admin/usage] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Books and chapters for daily random summaries (subset drawing from canonical list)
const bibleBooksForRandom = allBibleBooks;

// Bible chapter summary endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const { book, chapter, translation = 'kjv' } = req.body;
    const chapterNumber = parseInt(chapter, 10);

    const normalizedBook = normalizeBookName(book);
    if (!normalizedBook || !chapter || isNaN(chapterNumber)) {
      return res.status(400).json({ error: 'Invalid book or chapter' });
    }

    // Check cache first (include cache version to invalidate old summaries)
    const CACHE_VERSION = 'v3';
    const cacheKey = `${CACHE_VERSION}|${normalizedBook}|${chapterNumber}|${translation.toLowerCase()}`;
    const cached = global.__chapterSummaryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CHAPTER_CACHE_TTL_MS) {
      return res.json(cached.payload);
    }

    // Simple lock to avoid duplicate work
    if (global.__chapterSummaryLocks.has(cacheKey)) {
      await global.__chapterSummaryLocks.get(cacheKey);
      const afterWait = global.__chapterSummaryCache.get(cacheKey);
      if (afterWait && (Date.now() - afterWait.timestamp) < CHAPTER_CACHE_TTL_MS) {
        return res.json(afterWait.payload);
      }
    }

    let unlock;
    const lockPromise = new Promise(r => { unlock = r; });
    global.__chapterSummaryLocks.set(cacheKey, lockPromise);

    try {
      // Fetch authoritative text
      const passage = await fetchBibleText(normalizedBook, chapterNumber, translation);

      // Grounded prompt with strict instructions (English output)
      const prompt = `You are summarizing a Bible passage for a Christian audience. Use ONLY the passage text provided below.\n\n- Do NOT invent any content.\n- If you are unsure, say so.\n- Include verse citations using the format v<number> or v<number>-<number> referencing ONLY verses that exist in this chapter.\n- Keep 1–3 concise paragraphs focused on the main themes and lessons.\n- Translation: ${passage.meta.translation}.\n- Perspective and terminology: use a strictly Christian background and avoid Islamic/Muslim terminology or titles.\n\nPassage: ${normalizedBook} ${chapterNumber}\n${passage.passageText}`;

      let summary = await trackAndGenerate(prompt, { temperature: 0.2, maxOutputTokens: 320 });

      // Validate citations; if invalid, retry once with a stricter reminder
      const check = validateCitations(summary, passage.verses);
      if (!check.valid) {
        const retryPrompt = `${prompt}\n\nYour previous attempt referenced invalid verses (max is v${check.maxVerse}). Revise the summary so that any verse citations only reference existing verses.`;
        summary = await trackAndGenerate(retryPrompt, { temperature: 0.15, maxOutputTokens: 300 });
      }

      const citations = extractCitations(summary, passage.verses);

      // Also prepare an Urdu translation of the summary for bilingual display
      let summaryUr;
      try {
        summaryUr = await translateText(summary, 'Urdu');
      } catch (e) {
        console.warn('Urdu translation failed, continuing with English only:', e.message);
      }

      const payload = {
        book: normalizedBook,
        chapter: String(chapterNumber),
        translation: passage.meta.translation,
        summary,
        summaryUr,
        citations,
        verses: passage.verses,
        passageText: passage.passageText
      };
      global.__chapterSummaryCache.set(cacheKey, { timestamp: Date.now(), payload });
      return res.json(payload);
    } finally {
      if (unlock) unlock();
      global.__chapterSummaryLocks.delete(cacheKey);
    }
  } catch (error) {
    console.error('Summarize error:', error);

    if (error.status === 429) {
      return res.status(429).json({
        error: 'AI service rate limit exceeded. Please try again later.',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'AI summary failed',
      details: error.message
    });
  }
});

// Fallback: serve index.html for any non-API route (useful for direct navigations)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Daily summary endpoint
app.get('/api/daily-summary', async (req, res) => {
  try {
    const translation = (req.query.translation || 'kjv').toString();
    const force = String(req.query.force || '').toLowerCase() === 'true';
    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const CACHE_VERSION = 'v3';
    const cacheKey = `${CACHE_VERSION}|${dateKey}|${translation.toLowerCase()}`;

    // Serve from cache if fresh (unless force refresh is requested)
    if (!force) {
      const cached = global.__dailySummaryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < DAILY_CACHE_TTL_MS) {
        return res.json(cached.payload);
      }
    }

    // Simple lock to prevent stampede: if a generation is in progress, wait for it (unless force)
    if (!force && global.__dailySummaryLocks.has(cacheKey)) {
      await global.__dailySummaryLocks.get(cacheKey);
      const afterWait = global.__dailySummaryCache.get(cacheKey);
      if (afterWait && (Date.now() - afterWait.timestamp) < DAILY_CACHE_TTL_MS) {
        return res.json(afterWait.payload);
      }
      // If still no cache, proceed to generate
    }

    let unlock;
    const lockPromise = new Promise(r => { unlock = r; });
    // Use lock only for non-force calls
    if (!force) global.__dailySummaryLocks.set(cacheKey, lockPromise);

    try {
      const randomBook = bibleBooksForRandom[Math.floor(Math.random() * bibleBooksForRandom.length)];
      const book = randomBook.name;
      const chapter = Math.floor(Math.random() * randomBook.chapters) + 1;

      // Fetch text and summarize
      const passage = await fetchBibleText(book, chapter, translation);
      const prompt = `Provide a concise, 1–2 paragraph daily insight strictly based on the passage below. Do NOT invent content. Include 0–2 verse citations using v<number> that exist in this chapter. Translation: ${passage.meta.translation}.\n- Perspective and terminology: use a strictly Christian background and avoid Islamic/Muslim terminology or titles.\n\nPassage: ${book} ${chapter}\n${passage.passageText}`;
      // To reduce API usage, attempt only once; skip validation retry for daily
      let summary = await trackAndGenerate(prompt, { temperature: 0.2, maxOutputTokens: 220 });
      const citations = extractCitations(summary, passage.verses);

      // Urdu translation for daily summary (best-effort)
      let summaryUr;
      try {
        summaryUr = await translateText(summary, 'Urdu');
      } catch (e) {
        console.warn('Urdu translation (daily) failed:', e.message);
      }

      const payload = {
        book,
        chapter: chapter.toString(),
        translation: passage.meta.translation,
        summary,
        summaryUr,
        citations
      };
      // Update cache even on force so subsequent normal requests get the latest
      global.__dailySummaryCache.set(cacheKey, { timestamp: Date.now(), payload });
      return res.json(payload);
    } finally {
      // Release lock (only if we took it)
      if (!force) {
        if (unlock) unlock();
        global.__dailySummaryLocks.delete(cacheKey);
      }
    }
  } catch (error) {
    console.error('Daily summary error:', error);

    if (error.status === 429) {
      return res.status(429).json({
        error: 'AI service rate limit exceeded. Please try again later.',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to generate daily summary',
      details: error.message
    });
  }
});

// Generic translation endpoint for client-side on-demand translations (e.g., full chapter)
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body || {};
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing text or targetLang' });
    }
    let translatedText = await translateText(text, targetLang);
    translatedText = enforceUrduJesus(translatedText);
    res.json({ translatedText });
  } catch (error) {
    console.error('Translate error:', error);
    res.status(500).json({ error: 'Translation failed', details: error.message });
  }
});

// Start server locally; export app for Vercel serverless
if (process.env.VERCEL) {
  // Vercel will invoke this exported handler
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
