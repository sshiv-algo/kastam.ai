/**
 * dev-server.js — Local development server for Kastam.ai
 * Serves index.html and proxies POST /api/roast to Gemini.
 * Run with: node dev-server.js
 * Reads GEMINI_API_KEY from .env.local automatically.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Parse .env.local ────────────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const PORT = 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─── MIME types ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ─── Roast handler (mirrors api/roast.js logic) ───────────────────────────────
const SYSTEM_PROMPT = `You are "Kastam.ai" — an elite, savage, darkly hilarious startup autopsy critic. You write sharp, hyper-specific comedic autopsies for doomed startup ideas.

STRICT RULES & COMEDIC STRUCTURE:
1. BANNED CLICHÉS (NEVER USE ANY OF THESE):
   - "solution looking for a problem"
   - "no one asked for this"
   - "burn rate is unsustainable"
   - "lack of product-market fit"
   - "running out of runway"
   - "pivot or perish"
   - "disruptive innovation"

2. COMEDIC FORMULA:
   - Setup: State a bizarre, hyper-specific reality about the product.
   - Escalation: Explain how the team tried to monetize or scale it with absurd, unearned confidence.
   - Specific Twist: Describe the catastrophic, funny real-world failure mechanism.

3. CALIBRATION & HIGH-BENCHMARK EXAMPLES:
   - Bad (generic AI): "This app fails because users don't want to pay for pigeon tracking."
   - Good (sharp comedy): "Turns out feral urban pigeons have zero respect for dynamic surge pricing or NDA agreements. The fleet collapsed when the birds discovered they could eat the delivery cargo."

4. JSON SCHEMA REQUIREMENT:
You MUST respond with ONLY a raw, valid JSON object — no markdown formatting, no backticks, no text wrapping — matching this exact schema:

{
  "survival": <integer 1-12, survival percentage probability>,
  "headline": <string, 2-5 words, ALL CAPS, e.g. "DEAD ON ARRIVAL">,
  "verdict": <string, 1-2 punchy sentences using Setup -> Escalation -> Twist structure>,
  "startup_name": <string, absurdly punny or pretentious startup name>,
  "time_alive": <string, e.g. "14 months" or "3 weeks">,
  "cause": <string, 1 sentence hyper-specific cause of death>,
  "burned": <string, money burned, e.g. "$4.2M" or "Rs.1.5 Crore">,
  "pivot": <string, the ridiculous last-ditch pivot attempt>,
  "rev_val": <string, pathetic total revenue, e.g. "$14.50">,
  "team_ceo": <string, funny 1-liner roasting the CEO's delusions>,
  "team_cto": <string, funny 1-liner roasting the CTO's technical incompetence>,
  "team_mkt": <string, funny 1-liner roasting marketing hype>,
  "team_sales": <string, funny 1-liner roasting nonexistent sales>,
  "review": <string, 2-3 sentence scathing app store / customer review>,
  "reviewer": <string, fake reviewer name / title>,
  "red_title": <string, Reddit post title about the failure>,
  "reddit1": <string, savage Reddit comment 1>,
  "reddit2": <string, savage Reddit comment 2>,
  "tweet_handle": <string, twitter handle like @VCRoasts>,
  "tweet_body": <string, viral tweet roasting the startup, max 280 chars>,
  "tc_kicker": <string, TechCrunch kicker e.g. "EXCLUSIVE - COLLAPSE">,
  "tc_headline": <string, TechCrunch shutdown headline>,
  "tc_sub": <string, TechCrunch subheadline summary>,
  "email_from": <string, fake VC email address>,
  "email_subject": <string, VC rejection email subject line>,
  "vc_body": <string, formal yet devastating rejection email, use <br> for line breaks and <b> for bold>,
  "linkedin": <string, founder's cringe LinkedIn shutdown post with emojis>,
  "personas": {
    "💀 Brutal VC": <string, 1 line brutal dismissal>,
    "😂 Reddit": <string, 1 line ruthless meme roast>,
    "🦈 Shark Tank": <string, 1 line Shark Tank rejection>,
    "📈 YC Partner": <string, 1 line cold YC metric rejection>,
    "👼 Mentor": <string, 1 line painfully well-meaning patronizing advice>
  },
  "pivot_aud": <string, specific pivot advice for target audience>,
  "pivot_price": <string, specific pivot advice for pricing>,
  "pivot_cut": <string, specific pivot advice on what features to kill>,
  "pivot_gtm": <string, specific pivot advice for go-to-market strategy>
}

LANGUAGE RULE:
If requested in Malayalam ('ml'), write all user-facing text strings in clear, funny Malayalam, while keeping all JSON key names in English. Use USD ($) for global/EN roasts and INR (Rs. / ₹) for Malayalam roasts.`;

async function handleRoast(body) {
  const { idea, lang } = body;

  const userMessage = (lang === 'ml'
    ? `Startup idea (write all human-facing text in Malayalam, keep JSON keys in English): ${idea.trim()}`
    : `Startup idea: ${idea.trim()}`) + '\n\nMake it hurt. This should be funnier than anything a generic chatbot would write.';

  const requestBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 1.3,
      topP: 0.97,
      topK: 64,
      maxOutputTokens: 8192
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    let errBody;
    try { errBody = await res.json(); } catch { errBody = null; }
    const status = res.status;
    const errMsg = errBody?.error?.message || 'Unknown Gemini API error';

    if (status === 429) {
      // Extract retry delay if present
      const retryInfo = errBody?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
      const retryDelay = retryInfo?.retryDelay ? retryInfo.retryDelay.replace('s', '') : null;
      const waitMsg = retryDelay ? ` Please wait ${retryDelay} seconds and try again.` : ' Please try again in a moment.';
      const rateLimitErr = new Error('Rate limit hit — too many requests on the free tier.' + waitMsg);
      rateLimitErr.statusCode = 429;
      throw rateLimitErr;
    }

    const apiErr = new Error(errMsg);
    apiErr.statusCode = 502;
    throw apiErr;
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Unexpected Gemini response shape');

  return JSON.parse(rawText);
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS headers (helpful during dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // ── POST /api/roast ──────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/roast') {
    if (!GEMINI_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set in .env.local' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.idea || !parsed.idea.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing idea field' }));
        }
        const roast = await handleRoast(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(roast));
      } catch (err) {
        console.error('Roast error:', err.message);
        const statusCode = err.statusCode || 502;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── Serve static files ────────────────────────────────────────────────────
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found: ' + urlPath);
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🪦  Kastam.ai dev server running`);
  console.log(`   → http://localhost:${PORT}\n`);
  if (!GEMINI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY not found in .env.local — roasts will fail!\n');
  } else {
    console.log('✅  GEMINI_API_KEY loaded from .env.local\n');
  }
});
