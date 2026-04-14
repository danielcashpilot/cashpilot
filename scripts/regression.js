// Regression test — classifies each PDF in golden.json and checks against
// the stored golden type. Run after any prompt change to detect regressions.
//
// Usage:
//   npm run regression

const fs   = require('fs');
const path = require('path');
const { classifyPDF } = require('./classify');

const DOCS_DIR    = path.join(__dirname, '..', 'test_documents');
const GOLDEN_FILE = path.join(DOCS_DIR, 'golden.json');

async function main() {
  if (!fs.existsSync(GOLDEN_FILE)) {
    console.error('No golden.json found. Run "npm run golden" first.');
    process.exit(1);
  }

  const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  const pdfs   = Object.keys(golden).sort();

  if (pdfs.length === 0) {
    console.log('golden.json is empty. Run "npm run golden" to add documents.');
    return;
  }

  console.log(`\nCashPilot — Classification Regression`);
  console.log(`${'─'.repeat(40)}`);
  console.log(`Testing ${pdfs.length} document(s)...\n`);

  let passed  = 0;
  let failed  = 0;
  let errored = 0;
  const failures = [];

  for (const pdf of pdfs) {
    const filePath = path.join(DOCS_DIR, pdf);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${pdf}\n   File not found — skipped`);
      continue;
    }

    if (passed + failed + errored > 0) await new Promise(r => setTimeout(r, 15000)); // avoid rate limit
    process.stdout.write(`  ${pdf} ... `);

    let result;
    try {
      result = await classifyPDF(filePath);
    } catch (e) {
      console.log(`ERROR\n   ${e.message}`);
      errored++;
      continue;
    }

    const expected = golden[pdf];
    if (result.type === expected) {
      console.log(`✅ PASS  (${result.type})`);
      passed++;
    } else {
      console.log(`❌ FAIL`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Got:      ${result.type}${result.overridden ? ` (AI said "${result.aiType}", overridden by filename rule)` : ''}`);
      failures.push({ pdf, expected, got: result.type });
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}  Errors: ${errored}`);

  if (failed > 0) {
    console.log('\nFailed documents:');
    failures.forEach(f => console.log(`  • ${f.pdf}\n    expected "${f.expected}", got "${f.got}"`));
    process.exit(1);
  } else if (errored > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ All classifications match golden.');
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
