'use strict';

const {
  calcScore,
  scoreClass,
  scoreLbl,
  fmt,
  safeJSON,
  tLang,
  validateAnalysis,
} = require('../../js/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// calcScore
// ─────────────────────────────────────────────────────────────────────────────
describe('calcScore', () => {
  test('returns null for empty array', () => {
    expect(calcScore([])).toBeNull();
  });

  test('returns null for null input', () => {
    expect(calcScore(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(calcScore(undefined)).toBeNull();
  });

  test('returns 100 when all coverages are yes', () => {
    const covs = [
      { status: 'yes' },
      { status: 'yes' },
      { status: 'yes' },
    ];
    expect(calcScore(covs)).toBe(100);
  });

  test('returns 0 when all coverages are no', () => {
    const covs = [
      { status: 'no' },
      { status: 'no' },
    ];
    expect(calcScore(covs)).toBe(0);
  });

  test('returns 50 when all coverages are partial', () => {
    const covs = [
      { status: 'partial' },
      { status: 'partial' },
    ];
    expect(calcScore(covs)).toBe(50);
  });

  test('calculates mixed coverages correctly', () => {
    // 2 yes (4pts) + 1 partial (1pt) + 1 no (0pt) = 5/8 = 62.5 → 63
    const covs = [
      { status: 'yes' },
      { status: 'yes' },
      { status: 'partial' },
      { status: 'no' },
    ];
    expect(calcScore(covs)).toBe(63);
  });

  test('handles single yes coverage', () => {
    expect(calcScore([{ status: 'yes' }])).toBe(100);
  });

  test('handles single no coverage', () => {
    expect(calcScore([{ status: 'no' }])).toBe(0);
  });

  test('handles single partial coverage', () => {
    expect(calcScore([{ status: 'partial' }])).toBe(50);
  });

  test('typical health insurance — 10 coverages, 6 yes 2 partial 2 no = 70', () => {
    const covs = [
      ...Array(6).fill({ status: 'yes' }),     // 12 pts
      ...Array(2).fill({ status: 'partial' }),  // 2 pts
      ...Array(2).fill({ status: 'no' }),       // 0 pts
    ];
    // total: 14/20 = 70
    expect(calcScore(covs)).toBe(70);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreClass
// ─────────────────────────────────────────────────────────────────────────────
describe('scoreClass', () => {
  test('returns score-g for 80', ()  => expect(scoreClass(80)).toBe('score-g'));
  test('returns score-g for 100', () => expect(scoreClass(100)).toBe('score-g'));
  test('returns score-g for 81', ()  => expect(scoreClass(81)).toBe('score-g'));
  test('returns score-o for 79', ()  => expect(scoreClass(79)).toBe('score-o'));
  test('returns score-o for 55', ()  => expect(scoreClass(55)).toBe('score-o'));
  test('returns score-o for 60', ()  => expect(scoreClass(60)).toBe('score-o'));
  test('returns score-r for 54', ()  => expect(scoreClass(54)).toBe('score-r'));
  test('returns score-r for 0', ()   => expect(scoreClass(0)).toBe('score-r'));
  test('returns score-r for null', () => expect(scoreClass(null)).toBe('score-r'));
  test('boundary: exactly 55 → score-o', () => expect(scoreClass(55)).toBe('score-o'));
  test('boundary: exactly 79 → score-o', () => expect(scoreClass(79)).toBe('score-o'));
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreLbl
// ─────────────────────────────────────────────────────────────────────────────
describe('scoreLbl', () => {
  test('returns empty string for null', () => {
    expect(scoreLbl(null, 'he')).toBe('');
    expect(scoreLbl(null, 'en')).toBe('');
  });

  test('Excellent / מצוין for >= 80', () => {
    expect(scoreLbl(80, 'he')).toBe('מצוין');
    expect(scoreLbl(80, 'en')).toBe('Excellent');
    expect(scoreLbl(100, 'en')).toBe('Excellent');
  });

  test('Good / טוב for 65-79', () => {
    expect(scoreLbl(65, 'he')).toBe('טוב');
    expect(scoreLbl(65, 'en')).toBe('Good');
    expect(scoreLbl(79, 'en')).toBe('Good');
  });

  test('Average / בינוני for 50-64', () => {
    expect(scoreLbl(50, 'he')).toBe('בינוני');
    expect(scoreLbl(50, 'en')).toBe('Average');
    expect(scoreLbl(64, 'en')).toBe('Average');
  });

  test('Needs attention / דורש תשומת לב for < 50', () => {
    expect(scoreLbl(49, 'he')).toBe('דורש תשומת לב');
    expect(scoreLbl(49, 'en')).toBe('Needs attention');
    expect(scoreLbl(0, 'en')).toBe('Needs attention');
  });

  test('defaults to Hebrew when lang not provided', () => {
    expect(scoreLbl(80)).toBe('מצוין');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fmt
// ─────────────────────────────────────────────────────────────────────────────
describe('fmt', () => {
  test('formats positive integer', () => {
    expect(fmt(1000)).toContain('₪');
    expect(fmt(1000)).toContain('1');
  });

  test('returns — for null', ()      => expect(fmt(null)).toBe('—'));
  test('returns — for undefined', () => expect(fmt(undefined)).toBe('—'));
  test('returns — for empty string', () => expect(fmt('')).toBe('—'));

  test('returns ₪0 for zero', () => {
    expect(fmt(0)).toBe('₪0');
  });

  test('rounds decimal values', () => {
    const r = fmt(127.55);
    expect(r).toContain('₪');
    expect(r).toContain('128'); // rounded
  });

  test('formats large numbers', () => {
    const r = fmt(500000);
    expect(r).toContain('₪');
    expect(r.length).toBeGreaterThan(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeJSON
// ─────────────────────────────────────────────────────────────────────────────
describe('safeJSON', () => {
  test('parses clean JSON object', () => {
    const result = safeJSON('{"type":"ביטוח בריאות","company":"פניקס"}');
    expect(result).toEqual({ type: 'ביטוח בריאות', company: 'פניקס' });
  });

  test('strips markdown code fences', () => {
    const raw = '```json\n{"type":"ביטוח בריאות"}\n```';
    expect(safeJSON(raw)).toEqual({ type: 'ביטוח בריאות' });
  });

  test('strips ``` without json label', () => {
    const raw = '```\n{"type":"תלוש שכר"}\n```';
    expect(safeJSON(raw)).toEqual({ type: 'תלוש שכר' });
  });

  test('handles preamble text before JSON', () => {
    const raw = 'Here is the analysis:\n{"company":"הראל","people":[]}';
    expect(safeJSON(raw)).toEqual({ company: 'הראל', people: [] });
  });

  test('returns null for invalid JSON', () => {
    expect(safeJSON('not json at all')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(safeJSON(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(safeJSON('')).toBeNull();
  });

  test('parses complex nested response', () => {
    const data = {
      company: 'פניקס ביטוח',
      people: [{
        name: 'ישראל ישראלי',
        metrics: [{ label: 'פרמיה', value: '₪127' }],
        coverages: [{ label: 'ניתוח', status: 'yes', detail: 'עד ₪250,000' }],
        insights: [{ text: 'כיסוי טוב', type: 'info' }],
        breakdown: [],
      }]
    };
    const raw = '```json\n' + JSON.stringify(data) + '\n```';
    expect(safeJSON(raw)).toEqual(data);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tLang
// ─────────────────────────────────────────────────────────────────────────────
describe('tLang', () => {
  test('returns Hebrew when lang is he', () => {
    expect(tLang('שלום', 'Hello', 'he')).toBe('שלום');
  });
  test('returns English when lang is en', () => {
    expect(tLang('שלום', 'Hello', 'en')).toBe('Hello');
  });
  test('defaults to Hebrew when lang is undefined', () => {
    expect(tLang('שלום', 'Hello')).toBe('שלום');
  });
  test('defaults to Hebrew when lang is null', () => {
    expect(tLang('שלום', 'Hello', null)).toBe('שלום');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAnalysis
// ─────────────────────────────────────────────────────────────────────────────
describe('validateAnalysis', () => {
  const validPerson = {
    name: 'ישראל ישראלי',
    metrics:   [{ label: 'פרמיה', value: '₪127' }],
    coverages: [{ label: 'ניתוח', status: 'yes', detail: '' }],
    insights:  [{ text: 'טוב', type: 'info' }],
    breakdown: [],
  };

  test('valid analysis passes', () => {
    const { valid, errors } = validateAnalysis({
      company: 'פניקס',
      people: [validPerson],
    });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('missing people array fails', () => {
    const { valid, errors } = validateAnalysis({ company: 'x' });
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('people'))).toBe(true);
  });

  test('empty people array fails', () => {
    const { valid } = validateAnalysis({ company: 'x', people: [] });
    expect(valid).toBe(false);
  });

  test('null input fails', () => {
    const { valid } = validateAnalysis(null);
    expect(valid).toBe(false);
  });

  test('person missing name fails', () => {
    const p = { ...validPerson, name: undefined };
    const { errors } = validateAnalysis({ people: [p] });
    expect(errors.some(e => e.includes('name'))).toBe(true);
  });

  test('person missing metrics fails', () => {
    const p = { ...validPerson, metrics: undefined };
    const { errors } = validateAnalysis({ people: [p] });
    expect(errors.some(e => e.includes('metrics'))).toBe(true);
  });

  test('invalid coverage status fails', () => {
    const p = {
      ...validPerson,
      coverages: [{ label: 'test', status: 'invalid', detail: '' }],
    };
    const { errors } = validateAnalysis({ people: [p] });
    expect(errors.some(e => e.includes('status'))).toBe(true);
  });

  test('valid statuses yes/no/partial pass', () => {
    const p = {
      ...validPerson,
      coverages: [
        { label: 'a', status: 'yes',     detail: '' },
        { label: 'b', status: 'no',      detail: '' },
        { label: 'c', status: 'partial', detail: '' },
      ],
    };
    const { valid } = validateAnalysis({ people: [p] });
    expect(valid).toBe(true);
  });
});
