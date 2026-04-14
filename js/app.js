// ============================================================
// CONFIG
// ============================================================
var RAILWAY_URL = 'https://cashpilot-server-production-a4c8.up.railway.app/analyze';

var TYPES = ['ביטוח בריאות','ביטוח מחלות קשות','ביטוח שיניים','ביטוח רכב','ביטוח מבנה/דירה','ביטוח אחריות מקצועית','ביטוח עסקים','ביטוח תכולה','ביטוח תאונות אישיות','ביטוח רכב חובה','ביטוח רכב מקיף','ביטוח מנהלים','ביטוח נסיעות לחול','ביטוח חבויות','ביטוח רכב צד ג','ביטוח חיים','ביטוח חיים צד ג','ביטוח חיות מחמד','ביטוח אובדן כושר עבודה','ביטוח משכנתא','חשבון חשמל','חשבון מים','חשבון ארנונה','חשבון גז','חשבון אינטרנט','חשבון טלוויזיה וכבלים','חשבון טלפון','חשבון פלאפון','חשבון בנק','פיקדונות','חיסכונות בשקלים','חיסכונות במטח','פנסיה','קופות גמל להשקעה','תוכנית חיסכון','קופות גמל','קרן השתלמות','תלוש שכר','משכנתא'];
var TYPES_EN = ['Health Insurance','Critical Illness Insurance','Dental Insurance','Car Insurance','Home/Property Insurance','Professional Liability','Business Insurance','Contents Insurance','Personal Accident Insurance','Mandatory Car Insurance','Comprehensive Car Insurance','Executive Insurance','Travel Insurance','Liability Insurance','Third Party Car Insurance','Life Insurance','Third Party Life Insurance','Pet Insurance','Disability Insurance','Mortgage Insurance','Electricity Bill','Water Bill','Municipal Tax','Gas Bill','Internet Bill','TV & Cable Bill','Phone Bill','Mobile Bill','Bank Statement','Deposits','NIS Savings','Foreign Currency Savings','Pension','Investment Fund','Savings Plan','Provident Fund','Study Fund','Pay Stub','Mortgage'];
function typeLabel(heType) {
  var idx = TYPES.indexOf(heType);
  return (S.lang === 'en' && idx !== -1) ? TYPES_EN[idx] : heType;
}

var TYPE_HINTS = {
  'תלוש שכר': 'Extract: employee name, employer name, pay period, base salary, hourly rate, overtime, additions (vacation/sick/bonus), vacation days used/accumulated, sick days used/accumulated, taxable income, national insurance base, all deductions (income tax+%, NI, health, pension, savings fund), employer contributions, net pay, bank account.',
  'משכנתא': 'Extract: loan type (prime/CPI/variable/fixed), monthly payment split (principal vs interest), change dates, early repayment penalties, track switching cost, remaining balance.',
  'חשבון בנק': 'Extract: unusual charges/credits vs previous month, income (salary/deposit), checks, standing orders, credit card charges, savings maturity dates, deposit maturity, credit limit, fees, overdraft interest tiers, condition change warnings.',
  'פנסיה': 'Extract: fund name, accumulated balance, returns, management fees, insurance coverages (disability/survivors), retirement age, monthly contributions (employee+employer).'
};

var SCREENS = ['s-welcome','s-upload','s-identify','s-confirm','s-analyze','s-dash'];
var LABELS_HE = ['ברוך הבא','העלאה','זיהוי','אישור','ניתוח','תוצאות'];
var LABELS_EN = ['Welcome','Upload','Identify','Confirm','Analyze','Results'];
var ICONS = {warning:'⚠️', tip:'💡', info:'ℹ️'};

// ============================================================
// STATE
// ============================================================
var S = {
  lang: 'he', wide: false,
  files: [], b64s: [], types: [], results: [],
  cur: 0, curPerson: 0,
  chatOpen: false, chat: []
};

// ============================================================
// HELPERS
// ============================================================
var FILENAME_OVERRIDES = [
  { keywords: ['ריסק'],                   type: 'ביטוח חיים' },
  { keywords: ['דירה', 'בית', 'מבנה'],   type: 'ביטוח מבנה/דירה' },
  { keywords: ['משכנתא', 'משכנתאות'],    type: 'משכנתא' },
  { keywords: ['פנסיה'],                  type: 'פנסיה' },
  { keywords: ['שכר', 'תלוש'],           type: 'תלוש שכר' },
];
function filenameTypeOverride(filename, aiType) {
  var lower = filename.toLowerCase();
  for (var i = 0; i < FILENAME_OVERRIDES.length; i++) {
    var rule = FILENAME_OVERRIDES[i];
    for (var j = 0; j < rule.keywords.length; j++) {
      if (lower.indexOf(rule.keywords[j]) !== -1) return rule.type;
    }
  }
  return aiType;
}

function t(he, en) { return S.lang === 'he' ? he : en; }
function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
function fmt(n) { return n ? '₪' + Math.round(n).toLocaleString('he-IL') : '—'; }
function toB64(f) {
  return new Promise(function(res, rej) {
    var r = new FileReader();
    r.onload = function() { res(r.result.split(',')[1]); };
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

// ============================================================
// API — routes through Railway proxy (no key exposed)
// ============================================================
function callAI(msgs, max) {
  return fetch(RAILWAY_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({model: 'claude-sonnet-4-20250514', max_tokens: max, messages: [{role: 'user', content: msgs}]})
  }).then(function(r){ return r.json(); }).then(function(d){
    if(d.error) throw new Error(d.error.message);
    return d.content.map(function(b){ return b.text || ''; }).join('');
  });
}

function safeJSON(raw) {
  try {
    var cleaned = raw.replace(/```json|```/g,'').trim();
    var start = cleaned.indexOf('{');
    var end = cleaned.lastIndexOf('}');
    if(start !== -1 && end !== -1) cleaned = cleaned.substring(start, end+1);
    return JSON.parse(cleaned);
  } catch(e) { return null; }
}

// ============================================================
// LANGUAGE
// ============================================================
function setLang(lang) {
  S.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.getElementById('heb-btn').classList.toggle('on', lang === 'he');
  document.getElementById('en-btn').classList.toggle('on', lang === 'en');
  updateText();
  renderProgress();
  if(document.getElementById('s-dash').classList.contains('active') && S.results[S.cur]) {
    // Update type badge and switcher labels without re-analyzing
    document.getElementById('type-badge').textContent = typeLabel(S.types[S.cur]) || '—';
    document.querySelectorAll('.pdf-btn').forEach(function(b, j){
      b.textContent = S.files[j].name.replace('.pdf','').substring(0,20);
    });
    renderDoc(S.cur);
  }
}

function updateText() {
  var el = function(id){ return document.getElementById(id); };
  el('w-badge').textContent    = t('✦ AI פיננסי ישראלי','✦ Israeli Financial AI');
  el('w-title').textContent    = t('הבן את הכסף שלך תוך 30 שניות','Understand your money in 30 seconds');
  el('id-sub').textContent     = t('זה לוקח כמה שניות','This takes a few seconds');
  el('an-sub').textContent     = t('מחלץ מידע','Extracting data');
  el('w-sub').textContent      = t('העלה מסמכים פיננסיים וקבל הסבר פשוט וברור על כל שקל.','Upload financial documents and get a simple, clear explanation of every shekel.');
  el('ws1t').textContent       = t('העלה','Upload');
  el('ws1s').textContent       = t('עד 5 מסמכי PDF','Up to 5 PDFs');
  el('ws2t').textContent       = t('AI מנתח','AI Analyzes');
  el('ws2s').textContent       = t('מזהה ומחלץ הכל','Identifies everything');
  el('ws3t').textContent       = t('דשבורד','Dashboard');
  el('ws3s').textContent       = t('ברור ומיידי','Clear & instant');
  el('w-btn').textContent      = t('בואו נתחיל ←',"Let's start →");
  el('w-privacy').textContent  = t('🔒 נמחק תוך 60 שניות · אין גישה לבנק · פרטיות מוחלטת','🔒 Deleted in 60s · No bank access · Full privacy');
  el('u-title').textContent    = t('העלה את המסמכים שלך','Upload your documents');
  el('u-sub').textContent      = t('עד 5 קבצי PDF','Up to 5 PDFs');
  el('u-tip-title').textContent = t('מה אפשר להעלות?','What can I upload?');
  el('u-tip-body').textContent = t('תלוש שכר, ביטוח, חשבון בנק, משכנתא, פנסיה — כל PDF פיננסי.','Pay stub, insurance, bank statement, mortgage, pension — any financial PDF.');
  el('u-zone-title').textContent = t('לחץ כאן להעלאת PDF','Click here to upload PDF');
  el('u-zone-sub').textContent = t('או גרור לכאן','or drag here');
  el('u-disc').textContent     = t('🔒 מוצפן ונמחק תוך 60 שניות. אין חיבור לבנק.','🔒 Encrypted and deleted in 60 seconds. No bank connection.');
  el('cf-title').textContent   = t('זיהינו את המסמכים שלך','We identified your documents');
  el('cf-sub').textContent     = t('בדוק שזיהינו נכון. אם לא — אפשר לתקן.','Check we identified correctly. If not — easy to fix.');
  el('cf-btn').textContent     = t('נתח ←','Analyze →');
  el('change-link').textContent = t('זה לא נכון? שנה סוג מסמך','Not correct? Change document type');
  el('reset-btn').textContent  = t('העלה מסמכים חדשים','Upload new documents');
  el('dash-disc').textContent  = t('הנתונים מבוססים על המסמך שהועלה בלבד. CashPilot אינה ייעוץ פיננסי, ביטוחי, או משפטי. תמיד בדוק מול המסמך המקורי.','Data based solely on uploaded document. CashPilot is not financial, insurance, or legal advice. Always verify against the original document.');
  el('chat-fab-lbl').textContent = t('יש לך שאלה? שאל אותי','Have a question? Ask me');
  el('chat-title').textContent = t('שאל אותי על המסמך','Ask me about the document');
  el('chat-sub').textContent   = t('אסביר לך הכל בשפה פשוטה','I will explain everything simply');
  el('chat-send').textContent  = t('שלח','Send');
  el('chat-input').placeholder = t('למשל: כמה שילמתי מס הכנסה?','e.g. How much income tax did I pay?');
  el('chat-disc').textContent  = t('הנתונים מבוססים על המסמך שהועלה בלבד. CashPilot אינה ייעוץ פיננסי, ביטוחי, או משפטי.','Data based solely on uploaded document. Not financial advice.');
  el('modal-title').textContent = t('שנה סוג מסמך','Change document type');
  el('modal-cancel').textContent = t('ביטול','Cancel');
  renderSlots();
  if(S.files.length) renderChips();
}

function toggleWide() {
  S.wide = !S.wide;
  document.getElementById('wrap').classList.toggle('wide', S.wide);
  document.getElementById('view-btn').textContent = S.wide ? '📱' : '🖥';
}

// ============================================================
// PROGRESS BAR
// ============================================================
function renderProgress(active) {
  var labels = S.lang === 'he' ? LABELS_HE : LABELS_EN;
  var sid = active || 's-welcome';
  // Map real screens to 3-step progress
  var pidx = sid === 's-welcome' ? 0 : sid === 's-upload' ? 1 : sid === 's-dash' ? 2 : 1;
  var h = '';
  for(var i = 0; i < labels.length; i++) {
    var done = i < pidx, on = i === pidx;
    h += '<div class="pstep"><div class="pstep-circle' + (done?' done':on?' on':'') + '">' + (done?'✓':(i+1)) + '</div><div class="pstep-label' + (on?' on':'') + '">' + labels[i] + '</div></div>';
    if(i < labels.length - 1) h += '<div class="pline' + (i < pidx?' on':'') + '"></div>';
  }
  document.getElementById('prog-steps').innerHTML = h;
}

function goTo(id) {
  SCREENS.forEach(function(s){ document.getElementById(s).classList.toggle('active', s === id); });
  document.getElementById('chat-fab').classList.toggle('on', id === 's-dash');
  if(id !== 's-dash'){ document.getElementById('chat-panel').classList.remove('on'); S.chatOpen = false; }
  renderProgress(id);
  window.scrollTo(0, 0);
}

// ============================================================
// UPLOAD
// ============================================================
function renderSlots() {
  var h = '';
  for(var i = 0; i < 5; i++) {
    if(i < S.files.length) {
      var name = S.files[i].name.replace('.pdf','');
      var short = name.length > 8 ? name.substring(0,8) + '…' : name;
      h += '<div class="uslot filled" title="' + S.files[i].name + '"><span class="slot-num">' + (i+1) + '</span><span class="slot-name">' + short + '</span></div>';
    } else {
      h += '<div class="uslot">' + (i===0?'📄':'') + '</div>';
    }
  }
  document.getElementById('upload-slots').innerHTML = h;
}

function handleDrop(e) { e.preventDefault(); document.getElementById('uzone').classList.remove('drag'); addFiles(e.dataTransfer.files); }

function addFiles(fl) {
  for(var i = 0; i < fl.length; i++) {
    if(S.files.length >= 5) break;
    var f = fl[i];
    if(f.type !== 'application/pdf') { alert(t('הקובץ "' + f.name + '" אינו PDF','File "' + f.name + '" is not a PDF')); continue; }
    if(!S.files.find(function(x){ return x.name === f.name; })) S.files.push(f);
  }
  renderSlots(); renderChips();
}

function removeFile(i) { S.files.splice(i,1); renderSlots(); renderChips(); }

function renderChips() {
  document.getElementById('chips').innerHTML = S.files.map(function(f,i){
    return '<span class="chip"><span class="chip-x" onclick="removeFile(' + i + ')">×</span>' + f.name + '</span>';
  }).join('');
  var btn = document.getElementById('go-btn');
  var n = S.files.length;
  btn.style.display = n ? 'block' : 'none';
  btn.textContent = t('זהה ' + n + ' מסמכ' + (n!==1?'ים':'') + ' ←', 'Identify ' + n + ' document' + (n!==1?'s':'') + ' →');
}

// ============================================================
// STEP 1: IDENTIFY
// ============================================================
function startIdentify() {
  goTo('s-identify');
  S.b64s = []; S.types = []; S.results = new Array(S.files.length).fill(null); S.cur = 0; S.curPerson = 0; S.chat = [];
  Promise.all(S.files.map(toB64)).then(function(b64s){
    S.b64s = b64s;
    return identifyNext(0);
  });
}

function identifyNext(i) {
  if(i >= S.files.length) {
    document.getElementById('id-fill').style.width = '100%';
    return sleep(300).then(function(){ renderConfirm(); goTo('s-confirm'); });
  }
  document.getElementById('id-title').textContent = t('קורא מסמך ' + (i+1) + ' מתוך ' + S.files.length + '...', 'Reading document ' + (i+1) + ' of ' + S.files.length + '...');
  document.getElementById('id-step').textContent = S.files[i].name;
  document.getElementById('id-fill').style.width = Math.round((i / S.files.length) * 100) + '%';

  return callAI([
    {type:'document', source:{type:'base64', media_type:'application/pdf', data:S.b64s[i]}},
    {type:'text', text:'You are CashPilot. The file is named: "' + S.files[i].name + '".\nCRITICAL RULES — filename keywords override document content. You MUST apply these before reading anything else:\n- filename contains "ריסק" → MUST choose "ביטוח חיים" (term life/risk policy, NOT health insurance)\n- filename contains "דירה" or "בית" or "מבנה" → MUST choose "ביטוח מבנה/דירה"\n- filename contains "משכנתא" → MUST choose "משכנתא"\n- filename contains "פנסיה" → MUST choose "פנסיה"\n- filename contains "שכר" or "תלוש" → MUST choose "תלוש שכר"\nIf no keyword matches, read the document and choose EXACTLY one of these types verbatim:\n' + TYPES.join(' | ') + '\nAlso detect if this document covers MULTIPLE PEOPLE (e.g. a family insurance policy with different insured persons each paying different amounts).\nReply ONLY valid JSON: {"type":"EXACT type from list above","company":"company name","people":["name1","name2"] or []}'}
  ], 200).then(function(raw){
    var p = safeJSON(raw) || {};
    var aiType = p.type || TYPES[0];
    S.types[i] = filenameTypeOverride(S.files[i].name, aiType);
    S.results[i] = {_company: p.company || '', _people: p.people || []};
  }).catch(function(){
    S.types[i] = TYPES[0]; S.results[i] = {_company:'', _people:[]};
  }).then(function(){ return identifyNext(i+1); });
}

// ============================================================
// STEP 2: CONFIRM
// ============================================================
function renderConfirm() {
  document.getElementById('confirm-cards').innerHTML = S.files.map(function(f,i){
    return '<div class="confirm-card" id="cc-' + i + '">'
      + '<div class="confirm-file">📄 ' + f.name + '</div>'
      + '<div style="margin-bottom:10px;"><div class="confirm-type" id="ct-' + i + '">📋 ' + typeLabel(S.types[i]) + '</div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<button class="confirm-yes" onclick="confirmType(' + i + ')" id="yes-' + i + '">' + t('✓ כן, נכון','✓ Yes, correct') + '</button>'
      + '<button class="confirm-no" onclick="toggleSel(' + i + ')">' + t('לא, שנה','No, change') + '</button>'
      + '</div>'
      + '<div id="tsel-' + i + '" style="display:none;margin-top:12px;">'
      + '<p style="font-size:12px;color:#5f5e5a;margin-bottom:8px;">' + t('בחר סוג נכון:','Select correct type:') + '</p>'
      + '<div class="type-list">' + TYPES.map(function(tp){
          return '<button class="type-opt' + (S.types[i]===tp?' on':'') + '" onclick="selType(' + i + ',\'' + tp.replace(/'/g,"\\'") + '\')">' + tp + '</button>';
        }).join('') + '</div></div></div>';
  }).join('');
}

function confirmType(i) {
  S.results[i] = Object.assign({}, S.results[i], {_confirmed:true});
  document.getElementById('cc-' + i).classList.add('confirmed');
  document.getElementById('yes-' + i).textContent = t('✓ אושר','✓ Confirmed');
  document.getElementById('tsel-' + i).style.display = 'none';
}

function toggleSel(i) {
  var el = document.getElementById('tsel-' + i);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function selType(i, type) {
  S.types[i] = type;
  document.getElementById('ct-' + i).textContent = '📋 ' + typeLabel(type);
  document.getElementById('tsel-' + i).style.display = 'none';
  document.querySelectorAll('#tsel-' + i + ' .type-opt').forEach(function(b){ b.classList.toggle('on', b.textContent === type); });
  confirmType(i);
}

// ============================================================
// STEP 3: ANALYZE
// ============================================================
function startAnalyze() {
  goTo('s-analyze');
  S.results = new Array(S.files.length).fill(null);
  analyzeNext(0);
}

function analyzeNext(i) {
  if(i >= S.files.length) {
    document.getElementById('an-fill').style.width = '100%';
    return sleep(400).then(function(){ buildDash(); goTo('s-dash'); });
  }
  document.getElementById('an-title').textContent = t('מנתח מסמך ' + (i+1) + ' מתוך ' + S.files.length + '...', 'Analyzing document ' + (i+1) + ' of ' + S.files.length + '...');
  document.getElementById('an-step').textContent = S.files[i].name + ' — ' + S.types[i];
  document.getElementById('an-fill').style.width = Math.round((i / S.files.length) * 100) + '%';

  var hint = TYPE_HINTS[S.types[i]] || '';
  var langInstr = S.lang === 'he'
    ? 'Language: Hebrew (עברית פשוטה וברורה). All labels and values in Hebrew.'
    : 'Language: English ONLY. Translate ALL content including Hebrew names, coverage terms, document labels to English.';

  var prompt = 'You are CashPilot analyzing: "' + S.files[i].name + '" (' + S.types[i] + ').\n'
    + (hint ? 'Focus on: ' + hint + '\n' : '')
    + 'CRITICAL: If this document has MULTIPLE insured people (e.g. family policy with person A paying X and person B paying Y), detect their names and individual payments.\n'
    + 'Extract ALL real data from THIS document only.\n'
    + langInstr + '\n'
    + 'Reply ONLY this exact JSON structure, no markdown, no extra text:\n'
    + '{"company":"string","people":[{"name":"string","metrics":[{"label":"string","value":"string"}],"breakdown":[{"label":"string","amount":0}],"coverages":[{"label":"string","status":"yes|no|partial","detail":"string"}],"insights":[{"text":"string","type":"warning|tip|info"}]}]}\n'
    + 'Rules:\n'
    + '- metrics: 4-5 real figures\n'
    + '- breakdown: real cost breakdown if exists, [] otherwise\n'
    + '- coverages: 8-12 real items\n'
    + '- insights: 8-12 specific insights with real numbers\n'
    + '- ALL text must be in ' + (S.lang==='he'?'Hebrew':'English');

  return callAI([
    {type:'document', source:{type:'base64', media_type:'application/pdf', data:S.b64s[i]}},
    {type:'text', text:prompt}
  ], 4000).then(function(raw){
    var parsed = safeJSON(raw);
    if(parsed && parsed.people && parsed.people.length) {
      parsed.people = parsed.people.map(function(p){
        return {
          name: p.name || t('כולם','All'),
          metrics: Array.isArray(p.metrics) ? p.metrics : [],
          breakdown: Array.isArray(p.breakdown) ? p.breakdown : [],
          coverages: Array.isArray(p.coverages) ? p.coverages : [],
          insights: Array.isArray(p.insights) ? p.insights : []
        };
      });
      S.results[i] = parsed;
    } else if(parsed) {
      S.results[i] = {
        company: parsed.company || '',
        people: [{
          name: t('כולם','All'),
          metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
          breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown : [],
          coverages: Array.isArray(parsed.coverages) ? parsed.coverages : [],
          insights: Array.isArray(parsed.insights) ? parsed.insights : []
        }]
      };
    } else {
      S.results[i] = {company:'', people:[{name:t('כולם','All'), metrics:[], breakdown:[], coverages:[], insights:[{text:t('לא הצלחנו לקרוא. נסה שוב.','Could not read. Try again.'),type:'warning'}]}]};
    }
  }).catch(function(e){
    console.error('Analysis error:', e);
    S.results[i] = {company:'', people:[{name:t('כולם','All'), metrics:[], breakdown:[], coverages:[], insights:[{text:t('שגיאה. נסה שוב.','Error. Try again.'),type:'warning'}]}]};
  }).then(function(){ return analyzeNext(i+1); });
}

// ============================================================
// DASHBOARD
// ============================================================
function buildDash() {
  S.cur = 0; S.curPerson = 0;
  var sw = document.getElementById('pdf-sw');
  sw.innerHTML = S.files.length > 1 ? S.files.map(function(f,i){
    return '<button class="pdf-btn' + (i===0?' on':'') + '" id="psw-' + i + '" onclick="switchDoc(' + i + ')">' + f.name.replace('.pdf','').substring(0,20) + '</button>';
  }).join('') : '';
  renderDoc(0);
}

function switchDoc(i) {
  document.querySelectorAll('.pdf-btn').forEach(function(b,j){ b.classList.toggle('on', j===i); });
  S.cur = i; S.curPerson = 0; S.chat = [];
  document.getElementById('chat-msgs').innerHTML = '';
  renderDoc(i);
}

function switchPerson(idx) {
  S.curPerson = idx;
  document.querySelectorAll('.person-btn').forEach(function(b,j){ b.classList.toggle('on', j===idx); });
  renderPersonData(S.results[S.cur], idx);
}

function renderDoc(i) {
  var data = S.results[i];
  var type = S.types[i];

  document.getElementById('type-badge').textContent = typeLabel(type) || '—';
  document.getElementById('company-name').textContent = (data && data.company) || '';

  if(!data || !data.people || !data.people.length) {
    document.getElementById('dash').innerHTML = '<p style="color:#888780;padding:24px 0;text-align:center;">' + t('לא ניתן לטעון נתונים','Could not load data') + '</p>';
    return;
  }

  var people = data.people;
  var pgrid = document.getElementById('people-grid');
  if(people.length > 1) {
    pgrid.style.display = 'grid';
    pgrid.innerHTML = people.map(function(p){
      var payMetric = p.metrics && p.metrics.find(function(m){
        return m.label && (m.label.indexOf('חודש') > -1 || m.label.indexOf('month') > -1 || m.label.indexOf('עלות') > -1 || m.label.indexOf('cost') > -1 || m.label.toLowerCase().indexOf('premium') > -1 || m.label.indexOf('פרמיה') > -1);
      });
      var amount = payMetric ? payMetric.value : (p.metrics && p.metrics[0] ? p.metrics[0].value : '—');
      var label = payMetric ? payMetric.label : t('תשלום חודשי','Monthly payment');
      return '<div class="person-card"><div class="person-card-icon">👤</div><div class="person-card-name">' + p.name + '</div><div class="person-card-amount">' + amount + '</div><div class="person-card-label">' + label + '</div></div>';
    }).join('');
  } else {
    pgrid.style.display = 'none';
  }

  renderPersonData(data, 0);
}

function renderPersonData(data, personIdx) {
  var type = S.types[S.cur];
  var fileName = S.files[S.cur].name.replace('.pdf','');
  var person = data.people[personIdx] || data.people[0];
  if(!person) { document.getElementById('dash').innerHTML = ''; return; }

  var metrics = person.metrics || [];
  var breakdown = person.breakdown || [];
  var coverages = person.coverages || [];
  var insights = person.insights || [];
  var h = '';

  if(coverages.length) {
    var score = calcScore(coverages);
    if(score !== null) {
      var sCls = scoreClass(score);
      var sLbl = scoreLbl(score, S.lang);
      var ringColor = sCls === 'score-g' ? '#15803d' : sCls === 'score-o' ? '#d97706' : '#e24b4a';
      var ringBg    = sCls === 'score-g' ? '#dcfce7'  : sCls === 'score-o' ? '#fef3c7'  : '#fee2e2';
      var circ = 188.5; // 2π × r30
      var offset = Math.round((1 - score / 100) * circ * 10) / 10;
      h += '<div class="score-card">'
        + '<div class="score-ring-wrap">'
        + '<svg width="84" height="84" viewBox="0 0 84 84" style="display:block;">'
        + '<circle cx="42" cy="42" r="30" fill="' + ringBg + '" stroke="#e2e1db" stroke-width="7"/>'
        + '<circle cx="42" cy="42" r="30" fill="none" stroke="' + ringColor + '" stroke-width="7"'
        + ' stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"'
        + ' stroke-linecap="round" transform="rotate(-90 42 42)"'
        + ' style="transition:stroke-dashoffset .6s ease;"/>'
        + '<text x="42" y="47" text-anchor="middle" font-size="19" font-weight="800"'
        + ' fill="' + ringColor + '" font-family="-apple-system,sans-serif">' + score + '</text>'
        + '</svg>'
        + '</div>'
        + '<div class="score-info">'
        + '<div class="score-title">' + t('ציון בריאות פיננסי','Financial Health Score') + '</div>'
        + '<div class="score-lbl ' + sCls + '">' + sLbl + '</div>'
        + '<div class="score-sub">' + t('מבוסס על ' + coverages.length + ' סעיפים','Based on ' + coverages.length + ' items') + '</div>'
        + '</div>'
        + '</div>';
    }
  }

  if(metrics.length) {
    h += '<div class="section-header"><div class="section-title">' + t('המספרים החשובים שלך','Your key numbers') + '</div><div class="section-desc">' + t('הנתונים המרכזיים מהמסמך','Main figures from the document') + '</div></div>';
    h += '<div class="metrics-grid">' + metrics.map(function(m){
      return '<div class="metric-card"><div class="metric-label">' + m.label + '</div><div class="metric-value">' + m.value + '</div></div>';
    }).join('') + '</div>';
  }

  if(breakdown.length && breakdown.some(function(x){ return x.amount > 0; })) {
    var mx = Math.max.apply(null, breakdown.map(function(x){ return x.amount || 0; }));
    if(mx > 0) {
      h += '<div class="section-header"><div class="section-title">' + t('פירוט תשלומים','Payment breakdown') + '</div></div>';
      h += '<div style="background:#fff;border:0.5px solid #d3d1c7;border-radius:14px;padding:16px;margin-bottom:4px;">';
      h += breakdown.map(function(r){
        return '<div class="brow"><span class="blbl">' + r.label + '</span><div class="btr"><div class="bfill" style="width:' + Math.round((r.amount||0)/mx*100) + '%"></div></div><span class="bamt">' + fmt(r.amount) + '</span></div>';
      }).join('');
      h += '</div>';
    }
  }

  var notCovered = coverages.filter(function(c){ return c.status === 'no'; });
  if(notCovered.length) {
    h += '<div class="section-header"><div class="section-title">' + t('מה חסר לך','What you are missing') + '</div><div class="section-desc">' + t('פריטים שאינם מכוסים — שים לב!','Items NOT covered — pay attention!') + '</div></div>';
    h += '<div class="missing-box"><div class="missing-title">❌ ' + t('לא מכוסה אצלך:','Not covered:') + '</div>';
    h += notCovered.map(function(c){
      return '<div class="missing-item">❌ <div><div style="font-weight:600;">' + c.label + '</div>' + (c.detail ? '<div style="font-size:11px;opacity:.8;">' + c.detail + '</div>' : '') + '</div></div>';
    }).join('');
    h += '</div>';
  }

  if(coverages.length) {
    h += '<div class="section-header"><div class="section-title">' + t('מה מכוסה אצלך','What you are covered for') + '</div><div class="section-desc">' + t('ירוק = מכוסה · כתום = חלקי · אדום = לא מכוסה','Green = covered · Orange = partial · Red = not covered') + '</div></div>';
    h += '<div class="cov-card">';
    h += coverages.map(function(c){
      var cls = c.status === 'no' ? ' not-covered' : '';
      var badge = c.status === 'yes'
        ? '<span class="cy">' + t('מכוסה ✓','Covered ✓') + '</span>'
        : c.status === 'no'
        ? '<span class="cn">' + t('לא מכוסה ✗','Not covered ✗') + '</span>'
        : '<span class="cpar">' + t('חלקי ~','Partial ~') + '</span>';
      return '<div class="crow' + cls + '"><div><div class="cov-label">' + c.label + '</div>' + (c.detail ? '<div class="cov-detail' + (c.status==='no'?' danger':'') + '">' + c.detail + '</div>' : '') + '</div>' + badge + '</div>';
    }).join('');
    h += '</div>';
  }

  if(insights.length) {
    var order = {tip:0, info:1, warning:2};
    var sorted = insights.slice().sort(function(a,b){ return (order[a.type]||1) - (order[b.type]||1); });
    h += '<div class="section-header"><div class="section-title">' + t('מה חשוב שתדע','What you should know') + '</div><div class="section-desc">' + t('דברים חשובים מהמסמך שלך','Important things from your document') + '</div></div>';
    h += sorted.map(function(x){
      return '<div class="insight-card ' + x.type + '"><div class="insight-icon">' + (ICONS[x.type]||'ℹ️') + '</div><div class="insight-body"><div class="insight-text">' + x.text + '</div><div class="insight-source">' + t('מתוך:','From:') + ' ' + type + ' — ' + fileName + '</div><button class="flag-btn" onclick="this.textContent=\'' + t('תודה ✓','Thanks ✓') + '\'">' + t('לא נכון? דווח','Incorrect? Report') + '</button></div></div>';
    }).join('');
  }

  document.getElementById('dash').innerHTML = h;
}

// ============================================================
// CHANGE TYPE MODAL
// ============================================================
function openModal() {
  var i = S.cur;
  document.getElementById('modal-file').textContent = S.files[i].name;
  document.getElementById('modal-grid').innerHTML = TYPES.map(function(tp){
    return '<button class="modal-type-btn' + (S.types[i]===tp?' on':'') + '" onclick="changeType(' + i + ',\'' + tp.replace(/'/g,"\\'") + '\')">' + tp + '</button>';
  }).join('');
  document.getElementById('modal').classList.add('on');
}
function closeModal() { document.getElementById('modal').classList.remove('on'); }

function changeType(i, type) {
  closeModal();
  S.types[i] = type;
  document.getElementById('type-badge').textContent = type;
  document.getElementById('dash').innerHTML = '<div class="load-wrap"><div class="load-icon">🔄</div><div class="load-title">' + t('מנתח מחדש...','Re-analyzing...') + '</div></div>';
  var hint = TYPE_HINTS[type] || '';
  var langInstr = S.lang === 'he'
    ? 'Language: Hebrew (עברית פשוטה וברורה). All labels and values in Hebrew.'
    : 'Language: English ONLY. Translate ALL content including Hebrew names, coverage terms, document labels to English.';
  var prompt = 'You are CashPilot analyzing: "' + S.files[i].name + '" (' + type + ').\n'
    + (hint ? 'Focus on: ' + hint + '\n' : '')
    + 'CRITICAL: If this document has MULTIPLE insured people, detect their names and individual payments.\n'
    + 'Extract ALL real data from THIS document only.\n'
    + langInstr + '\n'
    + 'Reply ONLY this exact JSON structure, no markdown, no extra text:\n'
    + '{"company":"string","people":[{"name":"string","metrics":[{"label":"string","value":"string"}],"breakdown":[{"label":"string","amount":0}],"coverages":[{"label":"string","status":"yes|no|partial","detail":"string"}],"insights":[{"text":"string","type":"warning|tip|info"}]}]}\n'
    + '- metrics: 4-5 real figures\n- breakdown: real cost breakdown if exists, [] otherwise\n- coverages: 8-12 real items\n- insights: 8-12 specific insights with real numbers\n- ALL text in ' + (S.lang==='he'?'Hebrew':'English');
  callAI([
    {type:'document', source:{type:'base64', media_type:'application/pdf', data:S.b64s[i]}},
    {type:'text', text:prompt}
  ], 4000).then(function(raw){
    var parsed = safeJSON(raw);
    S.results[i] = (parsed && parsed.people) ? parsed : {company:'', people:[{name:t('כולם','All'),metrics:[],breakdown:[],coverages:[],insights:[]}]};
  }).catch(function(){
    S.results[i] = null;
  }).then(function(){ S.curPerson = 0; renderDoc(i); });
}

// ============================================================
// CHAT
// ============================================================
function toggleChat() { S.chatOpen = !S.chatOpen; document.getElementById('chat-panel').classList.toggle('on', S.chatOpen); }

function sendChat() {
  var inp = document.getElementById('chat-input');
  var q = inp.value.trim();
  if(!q) return;
  inp.value = '';
  var msgEl = document.getElementById('chat-msgs');
  var uid = 'ct' + Date.now();
  msgEl.innerHTML += '<div class="chat-msg user">' + q + '</div><div class="chat-msg ai" id="' + uid + '">' + t('חושב...','Thinking...') + '</div>';
  msgEl.scrollTop = 9999;
  S.chat.push({role:'user', content:q});
  var i = S.cur;
  var prev = S.chat.slice(0,-1).slice(-8).map(function(m){ return (m.role==='user'?'Q: ':'A: ') + m.content; }).join('\n');
  var langInstr = S.lang === 'he'
    ? 'Answer in simple clear Hebrew. Be specific about this document.'
    : 'Answer in simple clear English. Translate ALL Hebrew content to English. Be specific about this document.';
  var prompt = 'You are CashPilot, a friendly financial assistant.\nDocument: "' + S.files[i].name + '", Type: "' + S.types[i] + '".\n' + langInstr + (prev ? '\n\nPrevious conversation:\n' + prev : '') + '\n\nCurrent question: ' + q;

  callAI([
    {type:'document', source:{type:'base64', media_type:'application/pdf', data:S.b64s[i]}},
    {type:'text', text:prompt}
  ], 900).then(function(ans){
    document.getElementById(uid).textContent = ans;
    S.chat.push({role:'assistant', content:ans});
  }).catch(function(){
    document.getElementById(uid).textContent = t('מצטער, שגיאה. נסה שוב.','Sorry, error. Try again.');
  }).then(function(){ msgEl.scrollTop = 9999; });
}

// ============================================================
// EXPORT & RESET
// ============================================================
function doExport() {
  var i = S.cur;
  var d = S.results[i] || {};
  var person = (d.people && d.people[S.curPerson]) || {};
  var ins = person.insights || [];
  var covs = person.coverages || [];
  var txt = 'CashPilot — ' + S.types[i] + '\n' + S.files[i].name + '\n\n'
    + t('מה חשוב שתדע','What you should know') + ':\n'
    + ins.map(function(x,n){ return (n+1) + '. ' + x.text; }).join('\n')
    + '\n\n' + t('כיסויים','Coverages') + ':\n'
    + covs.map(function(c){ return '• ' + c.label + ': ' + (c.status==='yes'?t('מכוסה','Covered'):c.status==='no'?t('לא מכוסה','Not covered'):t('חלקי','Partial')); }).join('\n')
    + '\n\n' + t('לא ייעוץ פיננסי.','Not financial advice.');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain;charset=utf-8'}));
  a.download = 'cashpilot_' + S.types[i] + '.txt';
  a.click();
}

function doReset() {
  Object.assign(S, {files:[], b64s:[], types:[], results:[], cur:0, curPerson:0, chat:[], chatOpen:false});
  document.getElementById('chips').innerHTML = '';
  document.getElementById('go-btn').style.display = 'none';
  document.getElementById('id-fill').style.width = '0%';
  document.getElementById('an-fill').style.width = '0%';
  document.getElementById('chat-msgs').innerHTML = '';
  renderSlots();
  goTo('s-upload');
}

// ============================================================
// INIT
// ============================================================
renderProgress('s-welcome');
renderSlots();
setLang('he');
