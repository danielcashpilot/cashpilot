// Golden capture — classifies each PDF in test_documents/ and saves
// verified types to test_documents/golden.json.
//
// Usage:
//   npm run golden          — capture only new documents (skip existing golden)
//   npm run golden -- --all — re-capture everything (prompt even for existing)

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { TYPES, classifyPDF } = require('./classify');

const DOCS_DIR    = path.join(__dirname, '..', 'test_documents');
const GOLDEN_FILE = path.join(DOCS_DIR, 'golden.json');
const RESET_ALL   = process.argv.includes('--all');
const AUTO_YES    = process.argv.includes('--yes');  // accept AI suggestion without prompting

// Single readline instance shared across all prompts (closing it per-question kills stdin)
const rl = AUTO_YES ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

// ── Interactive prompt ───────────────────────────────────────────────────────
function ask(question) {
  if (AUTO_YES) return Promise.resolve('');
  return new Promise(resolve => rl.question(question, ans => resolve(ans.trim())));
}

// ── Type selection helper ────────────────────────────────────────────────────
async function pickType(suggested) {
  const ans = await ask(
    '  Correct? Press Enter to confirm, or type a number to pick:\n' +
    TYPES.map((t, i) => `    ${String(i + 1).padStart(2)}. ${t}${t === suggested ? ' ◄' : ''}`).join('\n') +
    '\n  > '
  );

  if (!ans) return suggested;

  const num = parseInt(ans, 10);
  if (!isNaN(num) && num >= 1 && num <= TYPES.length) return TYPES[num - 1];

  // Try partial text match
  const match = TYPES.find(t => t === ans || t.includes(ans));
  if (match) return match;

  console.log(`  ⚠️  Unknown input, keeping: ${suggested}`);
  return suggested;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pdfs = fs.readdirSync(DOCS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (pdfs.length === 0) {
    console.log('No PDFs found in test_documents/');
    return;
  }

  let golden = {};
  if (fs.existsSync(GOLDEN_FILE)) {
    golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  }

  console.log(`\nCashPilot — Golden Capture`);
  console.log(`${'─'.repeat(40)}`);
  console.log(`Found ${pdfs.length} PDF(s) in test_documents/`);
  if (RESET_ALL) console.log('Mode: re-capture all (--all)\n');
  else           console.log('Mode: new documents only (use --all to re-capture existing)\n');

  let captured = 0;
  let skipped  = 0;

  for (const pdf of pdfs) {
    const existing = golden[pdf];

    if (existing && !RESET_ALL) {
      console.log(`✓ ${pdf}\n  Golden: ${existing} (skip)`);
      skipped++;
      continue;
    }

    console.log(`\n📄 ${pdf}`);
    if (existing) console.log(`  Current golden: ${existing}`);

    if (captured > 0) await new Promise(r => setTimeout(r, 15000)); // avoid rate limit
    process.stdout.write('  Classifying via AI... ');
    let result;
    try {
      result = await classifyPDF(path.join(DOCS_DIR, pdf));
    } catch (e) {
      console.log(`\n  ❌ Error: ${e.message}`);
      continue;
    }

    console.log(`done`);
    console.log(`  AI result:  ${result.type}${result.overridden ? ` (AI said "${result.aiType}", overridden by filename rule)` : ''}`);
    if (result.company) console.log(`  Company:    ${result.company}`);

    const finalType = await pickType(result.type);
    golden[pdf] = finalType;
    captured++;
    console.log(`  ✅ Saved: ${finalType}`);
  }

  if (rl) rl.close();
  fs.writeFileSync(GOLDEN_FILE, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Done. ${captured} captured, ${skipped} skipped.`);
  console.log(`Golden saved to test_documents/golden.json`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
