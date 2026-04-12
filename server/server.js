const express = require('express');
const cors    = require('cors');
const app     = express();

// Allowed origins — add your Netlify URL here
const ALLOWED_ORIGINS = [
  'https://cashpilot1demo.netlify.app',
  'https://cashpilot.netlify.app',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'null', // file:// origin for local development
];

app.use(cors({
  origin: function(origin, cb) {
    // Allow requests with no origin (curl, Postman) only in dev
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin ' + origin + ' not allowed'));
  }
}));

app.use(express.json({ limit: '50mb' }));

// ─── Rate limiting (simple in-memory) ─────────────────────────────────────
const rateLimits = new Map();
const RATE_WINDOW = 60 * 1000;   // 1 minute
const RATE_MAX    = 10;           // requests per window

app.use('/analyze', function(req, res, next) {
  const ip  = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const rec = rateLimits.get(ip) || { count: 0, start: now };

  if (now - rec.start > RATE_WINDOW) {
    rec.count = 1; rec.start = now;
  } else {
    rec.count++;
  }
  rateLimits.set(ip, rec);

  if (rec.count > RATE_MAX) {
    return res.status(429).json({ error: { message: 'Too many requests. Try again in a minute.' } });
  }
  next();
});

// ─── Analyze endpoint ──────────────────────────────────────────────────────
app.post('/analyze', async (req, res) => {
  // Validate required fields
  if (!req.body || !req.body.messages || !Array.isArray(req.body.messages)) {
    return res.status(400).json({ error: { message: 'Invalid request: messages array required' } });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'Server configuration error' } });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: 'Server error: ' + err.message } });
  }
});

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', name: 'CashPilot Server' }));

const PORT = process.env.PORT || 3000;
/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => console.log('CashPilot server on port ' + PORT));
}

module.exports = app;
