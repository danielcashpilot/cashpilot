// Shared classification logic — mirrors the identify prompt in js/app.js exactly.
// Used by both capture.js and regression.js.

const fs   = require('fs');
const path = require('path');

// Load .env from project root if present
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

// ── Must stay in sync with js/app.js TYPES ──────────────────────────────────
const TYPES = [
  'ביטוח בריאות','ביטוח מחלות קשות','ביטוח שיניים','ביטוח רכב',
  'ביטוח מבנה/דירה','ביטוח אחריות מקצועית','ביטוח עסקים','ביטוח תכולה',
  'ביטוח תאונות אישיות','ביטוח רכב חובה','ביטוח רכב מקיף','ביטוח מנהלים',
  'ביטוח נסיעות לחול','ביטוח חבויות','ביטוח רכב צד ג','ביטוח חיים',
  'ביטוח חיים צד ג','ביטוח חיות מחמד','ביטוח אובדן כושר עבודה','ביטוח משכנתא',
  'חשבון חשמל','חשבון מים','חשבון ארנונה','חשבון גז','חשבון אינטרנט',
  'חשבון טלוויזיה וכבלים','חשבון טלפון','חשבון פלאפון','חשבון בנק',
  'פיקדונות','חיסכונות בשקלים','חיסכונות במטח','פנסיה',
  'קופות גמל להשקעה','תוכנית חיסכון','קופות גמל','קרן השתלמות',
  'תלוש שכר','משכנתא',
];

// ── Must stay in sync with js/app.js FILENAME_OVERRIDES ─────────────────────
const FILENAME_OVERRIDES = [
  { keywords: ['ריסק'],                  type: 'ביטוח חיים' },
  { keywords: ['דירה', 'בית', 'מבנה'],  type: 'ביטוח מבנה/דירה' },
  { keywords: ['משכנתא', 'משכנתאות'],   type: 'משכנתא' },
  { keywords: ['פנסיה'],                 type: 'פנסיה' },
  { keywords: ['שכר', 'תלוש'],          type: 'תלוש שכר' },
];

function filenameTypeOverride(filename, aiType) {
  const lower = filename.toLowerCase();
  for (const rule of FILENAME_OVERRIDES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.type;
    }
  }
  return aiType;
}

function buildPrompt(filename) {
  return (
    'You are CashPilot. The file is named: "' + filename + '".\n' +
    'CRITICAL RULES — filename keywords override document content. You MUST apply these before reading anything else:\n' +
    '- filename contains "ריסק" → MUST choose "ביטוח חיים" (term life/risk policy, NOT health insurance)\n' +
    '- filename contains "דירה" or "בית" or "מבנה" → MUST choose "ביטוח מבנה/דירה"\n' +
    '- filename contains "משכנתא" → MUST choose "משכנתא"\n' +
    '- filename contains "פנסיה" → MUST choose "פנסיה"\n' +
    '- filename contains "שכר" or "תלוש" → MUST choose "תלוש שכר"\n' +
    'If no keyword matches, read the document and choose EXACTLY one of these types verbatim:\n' +
    TYPES.join(' | ') + '\n' +
    'Also detect if this document covers MULTIPLE PEOPLE (e.g. a family insurance policy).\n' +
    'Reply ONLY valid JSON: {"type":"EXACT type from list above","company":"company name","people":["name1"] or []}'
  );
}

async function classifyPDF(filePath) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set.\n' +
      'Add it to a .env file in the project root, or run:\n' +
      '  $env:ANTHROPIC_API_KEY="sk-ant-..."  (PowerShell)\n' +
      '  export ANTHROPIC_API_KEY="sk-ant-..." (bash)'
    );
  }

  const filename = path.basename(filePath);
  const b64 = fs.readFileSync(filePath).toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: buildPrompt(filename) },
        ],
      }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const raw = data.content.map(b => b.text || '').join('');
  let parsed = {};
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    parsed = JSON.parse(cleaned.substring(start, end + 1));
  } catch (_) {}

  const aiType   = parsed.type || TYPES[0];
  const finalType = filenameTypeOverride(filename, aiType);

  return {
    type:       finalType,
    aiType,                          // what the AI said before override
    overridden: finalType !== aiType,
    company:    parsed.company || '',
  };
}

module.exports = { TYPES, classifyPDF };
