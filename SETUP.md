# CashPilot — Development Setup

## Prerequisites

1. **Install Node.js v20+**  
   Download from https://nodejs.org/ (LTS version)  
   Verify: `node --version` and `npm --version`

2. **Install Git**  
   Already downloaded: `C:\Users\danie\Downloads\Git-2.51.0-64-bit.exe`

## First Time Setup

```bash
# 1. Init git repo
cd C:\Users\danie\cashpilot
git init
git add .
git commit -m "Initial commit — CashPilot with test suite"

# 2. Connect to GitHub
git remote add origin https://github.com/YOUR_USERNAME/cashpilot.git
git push -u origin main

# 3. Install dependencies
npm install

# 4. Install server dependencies
cd server && npm install && cd ..

# 5. Install Playwright browsers
npx playwright install chromium
```

## Running Tests

```bash
# All tests
npm test

# Unit tests only (faster)
npm run test:unit

# E2E tests only  
npm run test:e2e

# Watch mode (auto-reruns on file change)
npm run test:watch

# Coverage report
npm run coverage
```

## Adding real PDFs for local testing

Copy your PDFs to `tests/fixtures/pdfs/`:
- `phoenix-health.pdf` → copy of פניקס 2025.pdf
- `harel-life.pdf` → copy of ריסק הראל אדל.pdf

These are gitignored — they stay local only.

## CI/CD

Tests run automatically on every `git push` via GitHub Actions.
See `.github/workflows/test.yml`.
