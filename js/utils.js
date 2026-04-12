(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    for (var k in exp) { root[k] = exp[k]; }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {

  /**
   * Calculate financial health score (0-100) from an array of coverage objects.
   * Each coverage has { status: 'yes'|'no'|'partial' }
   * yes=2pts, partial=1pt, no=0pts — normalized to 100
   * @returns {number|null}
   */
  function calcScore(coverages) {
    if (!coverages || !coverages.length) return null;
    var pts = coverages.reduce(function(s, c) {
      return s + (c.status === 'yes' ? 2 : c.status === 'partial' ? 1 : 0);
    }, 0);
    return Math.round((pts / (coverages.length * 2)) * 100);
  }

  /**
   * CSS class name for a score: 'score-g' (>=80), 'score-o' (>=55), 'score-r' (<55)
   */
  function scoreClass(n) {
    if (n === null || n === undefined) return 'score-r';
    return n >= 80 ? 'score-g' : n >= 55 ? 'score-o' : 'score-r';
  }

  /**
   * Human label for a score in given language ('he' or 'en').
   */
  function scoreLbl(n, lang) {
    if (n === null || n === undefined) return '';
    lang = lang || 'he';
    if (n >= 80) return lang === 'he' ? 'מצוין'          : 'Excellent';
    if (n >= 65) return lang === 'he' ? 'טוב'             : 'Good';
    if (n >= 50) return lang === 'he' ? 'בינוני'          : 'Average';
    return            lang === 'he' ? 'דורש תשומת לב'  : 'Needs attention';
  }

  /**
   * Format a number as Israeli shekel string (₪1,234) or '—' for falsy values.
   */
  function fmt(n) {
    if (!n && n !== 0) return '—';
    if (n === 0) return '₪0';
    return '₪' + Math.round(n).toLocaleString('he-IL');
  }

  /**
   * Safely parse JSON from an AI response that may have markdown fences or preamble text.
   * Returns parsed object or null on failure.
   */
  function safeJSON(raw) {
    if (!raw) return null;
    try {
      var cleaned = raw.replace(/```json|```/g, '').trim();
      var start = cleaned.indexOf('{');
      var end   = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
      return JSON.parse(cleaned);
    } catch(e) { return null; }
  }

  /**
   * Bilingual text selector.
   * @param {string} he  Hebrew text
   * @param {string} en  English text
   * @param {string} lang 'he' or 'en'
   */
  function tLang(he, en, lang) {
    return (lang || 'he') === 'he' ? he : en;
  }

  /**
   * Validate that an object matches the expected AI analysis schema.
   * Returns { valid: boolean, errors: string[] }
   */
  function validateAnalysis(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') {
      return { valid: false, errors: ['Response is not an object'] };
    }
    if (!Array.isArray(obj.people) || obj.people.length === 0) {
      errors.push('Missing or empty people array');
    } else {
      obj.people.forEach(function(p, i) {
        if (!p.name) errors.push('Person ' + i + ' missing name');
        if (!Array.isArray(p.metrics))   errors.push('Person ' + i + ' missing metrics array');
        if (!Array.isArray(p.coverages)) errors.push('Person ' + i + ' missing coverages array');
        if (!Array.isArray(p.insights))  errors.push('Person ' + i + ' missing insights array');
        if (!Array.isArray(p.breakdown)) errors.push('Person ' + i + ' missing breakdown array');
        if (p.coverages) {
          p.coverages.forEach(function(c, j) {
            if (!['yes','no','partial'].includes(c.status)) {
              errors.push('Person ' + i + ' coverage ' + j + ' has invalid status: ' + c.status);
            }
          });
        }
      });
    }
    return { valid: errors.length === 0, errors: errors };
  }

  return { calcScore, scoreClass, scoreLbl, fmt, safeJSON, tLang, validateAnalysis };
});
