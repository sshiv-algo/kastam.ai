// api/roast.js — Vercel Serverless Function (CommonJS)
// Calls Gemini API with the user's startup idea and returns a roast JSON.
// GEMINI_API_KEY must be set in Vercel's Environment Variables (never hardcoded).

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

module.exports = async function handler(req, res) {
  // Allow CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { idea, lang, tone } = req.body || {};

  if (!idea || typeof idea !== 'string' || idea.trim() === '') {
    return res.status(400).json({ error: 'Missing or empty idea field' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error: missing API key' });
  }

  const userMessage = (lang === 'ml'
    ? `Startup idea (write all human-facing text in Malayalam, keep JSON keys in English): ${idea.trim()}`
    : `Startup idea: ${idea.trim()}`) + '\n\nMake it hurt. This should be funnier than anything a generic chatbot would write.';

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 1.3,
      topP: 0.97,
      topK: 64,
      maxOutputTokens: 8192
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errorText);
      return res.status(502).json({ error: 'Gemini API request failed', details: geminiRes.status });
    }

    const geminiData = await geminiRes.json();

    // Extract the text content from the Gemini response
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(geminiData));
      return res.status(502).json({ error: 'Unexpected response from Gemini API' });
    }

    // Parse and validate the JSON
    let roastData;
    try {
      roastData = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', rawText);
      return res.status(502).json({ error: 'Gemini returned invalid JSON' });
    }

    // Basic schema check
    const requiredFields = ['survival', 'headline', 'verdict', 'startup_name', 'personas'];
    for (const field of requiredFields) {
      if (!(field in roastData)) {
        console.error(`Missing required field "${field}" in Gemini response`);
        return res.status(502).json({ error: `Incomplete roast data from AI (missing: ${field})` });
      }
    }

    return res.status(200).json(roastData);
  } catch (err) {
    console.error('Unhandled error in /api/roast:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
