// ════════════════════════════════════════════════════════════
//  HealthHub · app.js
//  Vanilla JS SPA — no build step, no framework, no npm install.
//  Architecture: global state object + render-on-change pattern.
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
//  COLORS
// ─────────────────────────────────────────
const C = {
  teal: '#0F5B6E', tealLt: '#EFF8FA', tealMd: '#1A7A93',
  amber: '#D97706', rose: '#DC2626', emerald: '#059669', violet: '#7C3AED',
};
const MEMBER_COLORS = ['#0F5B6E', '#7C3AED', '#059669', '#D97706', '#DC2626', '#1A7A93'];

// ─────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────
let state = {
  session: null,
  authLoading: true,
  members: [],
  membersLoading: false,
  currentId: null,
  records: [],
  logs: [],
  metrics: [],
  page: 'dashboard',
  sidebarOpen: true,
  memberMenuOpen: false,
  moreSheetOpen: false,
  toast: null,
  uploadModal: null,        // { phase, file, ext, pct, progressMsg, errMsg, mismatchName, uploading }
  addMemberModal: false,
  authMode: 'login',        // login | signup | reset
  authError: '', authMessage: '', authLoading2: false,
  chatMsgs: [],
  chatLoading: false,
  recordFilter: 'all',
  recordSearch: '',
  recordSelectedId: null,
  recordDeleting: null,
  planTab: 'overview',
  dailyLogDraft: { feeling: 7, symptoms: [], note: '', bp: '', meds: false },
  dailyLogSaving: false,
  dailyLogSaved: false,
  metricsDraft: {},
  metricsSaving: false,
};
const chartRegistry = {}; // canvas id -> Chart.js instance, so we can destroy before re-render

function setState(patch, skipRender) {
  Object.assign(state, patch);
  if (!skipRender) render();
}

// ─────────────────────────────────────────
//  STATIC DATA (health plan content, sample spend)
// ─────────────────────────────────────────
const HEALTH_PLAN = {
  diet: [
    { item: 'DASH Diet – keep sodium <2 g/day', priority: 'high', cat: 'essential' },
    { item: 'Increase dietary fibre: whole grains, legumes, vegetables', priority: 'high', cat: 'essential' },
    { item: 'Cut refined carbs and sugar (pre-diabetic risk)', priority: 'high', cat: 'essential' },
    { item: 'Heart-healthy fats: olive oil, walnuts, avocado', priority: 'medium', cat: 'recommended' },
    { item: '2–3 L water daily', priority: 'medium', cat: 'recommended' },
    { item: 'Limit alcohol to max 1–2 units/week', priority: 'medium', cat: 'recommended' },
  ],
  exercise: [
    { item: '30-min brisk walk every morning – non-negotiable', priority: 'high', cat: 'essential' },
    { item: 'Yoga / stretching 15 min daily', priority: 'high', cat: 'essential' },
    { item: 'Resistance training 2×/week', priority: 'medium', cat: 'recommended' },
    { item: 'Break sitting every 45 min', priority: 'medium', cat: 'recommended' },
    { item: 'Pranayama 10 min/day', priority: 'medium', cat: 'recommended' },
  ],
  vitamins: [
    { item: 'Omega-3 Fish Oil – 1,000 mg/day (LDL management)', priority: 'medium', source: 'AI Rec.' },
    { item: 'Magnesium Glycinate – 400 mg at night (BP support)', priority: 'medium', source: 'AI Rec.' },
    { item: 'Coenzyme Q10 – 100 mg/day', priority: 'low', source: 'AI Rec.' },
  ],
  risks: [
    { risk: 'Cardiovascular – elevated LDL + hypertension', level: 'medium', action: 'Lifestyle changes + 6-month review' },
    { risk: 'Diabetes progression from pre-diabetic state', level: 'medium', action: 'HbA1c every 3 months. Low-GI diet.' },
    { risk: 'Family history – screen proactively', level: 'medium', action: 'Sustained lifestyle changes are your shield.' },
  ],
  ayurveda: [
    { tip: 'Methi seeds (1 tsp soaked overnight) on empty stomach – blood sugar control', cat: 'Blood Sugar', ev: '★★★ Clinical' },
    { tip: 'Amla juice 30 ml every morning – Vitamin C, heart & immunity', cat: 'General', ev: '★★★ Research' },
    { tip: 'Arjuna bark decoction – cardioprotective', cat: 'Heart', ev: '★★☆ Clinical' },
    { tip: 'Triphala at bedtime – digestion, antioxidant', cat: 'Digestion', ev: '★★☆ Research' },
    { tip: 'Turmeric milk at night – anti-inflammatory, mild BP benefit', cat: 'General', ev: '★★★ Research' },
  ],
};
const SPEND_SAMPLE = [
  { month: 'Nov', amount: 1200, medicines: 600, tests: 400, consult: 200 },
  { month: 'Dec', amount: 3800, medicines: 800, tests: 2400, consult: 600 },
  { month: 'Jan', amount: 2100, medicines: 700, tests: 800, consult: 600 },
  { month: 'Feb', amount: 1600, medicines: 700, tests: 500, consult: 400 },
  { month: 'Mar', amount: 2200, medicines: 800, tests: 900, consult: 500 },
  { month: 'Apr', amount: 4100, medicines: 900, tests: 2800, consult: 400 },
  { month: 'May', amount: 1800, medicines: 800, tests: 600, consult: 400 },
];
const SPEND_CATS = [
  { name: 'Lab Tests', value: 8400, color: C.teal },
  { name: 'Medicines', value: 5300, color: C.violet },
  { name: 'Consultations', value: 3100, color: C.amber },
  { name: 'Others', value: 1000, color: '#94a3b8' },
];

// ─────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────
const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };
const fmtINR = n => '₹' + Number(n).toLocaleString('en-IN');
const scoreColor = s => s >= 85 ? '#059669' : s >= 70 ? '#D97706' : '#DC2626';
const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_STYLE = {
  prescription: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Prescription', icon: 'pill' },
  report: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Report', icon: 'microscope' },
  bill: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Bill', icon: 'dollar-sign' },
  xray: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'X-Ray', icon: 'activity' },
  discharge: { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Discharge', icon: 'file-text' },
};
const typeStyle = t => TYPE_STYLE[t] || { bg: 'bg-stone-50', text: 'text-stone-600', label: 'Document', icon: 'file-text' };
const priBadge = p => ({ high: 'bg-rose-50 text-rose-600', medium: 'bg-amber-50 text-amber-600', low: 'bg-emerald-50 text-emerald-600' }[p] || 'bg-stone-100 text-stone-500');
const statusColor = s => ({ normal: 'text-emerald-600', borderline: 'text-amber-600', high: 'text-rose-600', low: 'text-rose-600' }[s] || 'text-stone-500');
const feelInfo = f => {
  if (f >= 9) return { e: '😄', l: 'Great', c: 'text-emerald-600' };
  if (f >= 7) return { e: '🙂', l: 'Good', c: 'text-teal-600' };
  if (f >= 5) return { e: '😐', l: 'Okay', c: 'text-amber-600' };
  if (f >= 3) return { e: '😕', l: 'Not great', c: 'text-orange-600' };
  return { e: '😟', l: 'Poor', c: 'text-rose-600' };
};
const fileToBase64 = file => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file);
});
const nameMatches = (extracted, current) => {
  if (!extracted || !current) return true;
  const clean = s => s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const eParts = clean(extracted).split(/\s+/).filter(Boolean);
  const cParts = clean(current).split(/\s+/).filter(Boolean);
  return eParts.some(ep => cParts.some(cp => cp === ep || cp.includes(ep) || ep.includes(cp)));
};

// ─────────────────────────────────────────
//  DATA LAYER  (Supabase CRUD)
// ─────────────────────────────────────────
const db = {
  async getMembers(userId) {
    const { data, error } = await supabaseClient.from('family_members').select('*').eq('owner_id', userId).order('created_at');
    if (error) throw error;
    return data.map(r => ({
      id: r.id, name: r.name, role: r.role, age: r.age, gender: r.gender,
      blood: r.blood_group, color: r.avatar_color || C.teal,
      avatar: (r.name || '?').charAt(0).toUpperCase(),
      score: r.health_score || 80, bmi: r.bmi, height: r.height, weight: r.weight,
      bp: r.bp || '—', sugar: r.sugar || '—', hba1c: r.hba1c || '—', vd: r.vitamin_d || '—',
      conditions: r.conditions || [], medications: r.medications || [],
      allergies: r.allergies || [], goals: r.goals || [], family: r.family_history || [],
      doctor: r.doctor, hospital: r.hospital, nextVisit: r.next_visit, insurance: r.insurance,
    }));
  },
  async addMember(userId, data) {
    const { data: row, error } = await supabaseClient.from('family_members').insert([{
      owner_id: userId, name: data.name, role: data.role || 'Self', age: data.age,
      gender: data.gender, blood_group: data.blood, height: data.height, weight: data.weight,
      bp: data.bp, hba1c: data.hba1c, vitamin_d: data.vd, bmi: data.bmi,
      health_score: data.score || 80, conditions: data.conditions || [],
      medications: data.medications || [], allergies: data.allergies || [],
      goals: data.goals || [], family_history: data.family || [],
      doctor: data.doctor, hospital: data.hospital, next_visit: data.nextVisit || null,
      insurance: data.insurance, avatar_color: data.color || MEMBER_COLORS[0],
    }]).select().single();
    if (error) throw error;
    return { ...data, id: row.id, avatar: (data.name || '?').charAt(0).toUpperCase(), score: data.score || 80 };
  },
  async getRecords(memberId) {
    const { data, error } = await supabaseClient.from('medical_records').select('*').eq('member_id', memberId).order('date', { ascending: false });
    if (error) throw error;
    return data.map(r => ({
      id: r.id, mid: r.member_id, date: r.date, type: r.type, title: r.title,
      doctor: r.doctor, hospital: r.hospital, amount: r.amount, summary: r.summary,
      tags: r.tags || [], priority: r.priority || 'medium', source: r.source || 'manual',
      uploadedFile: r.uploaded_file_name, filePath: r.file_path,
      patientNameOnDoc: r.patient_name_on_doc, extracted: r.extracted_data || {},
    }));
  },
  async addRecord(userId, rec) {
    const { data, error } = await supabaseClient.from('medical_records').insert([{
      owner_id: userId, member_id: rec.mid, date: rec.date, type: rec.type, title: rec.title,
      doctor: rec.doctor || null, hospital: rec.hospital || null, amount: rec.amount || null,
      summary: rec.summary, tags: rec.tags || [], priority: rec.priority || 'medium',
      source: rec.source || 'manual', uploaded_file_name: rec.uploadedFile || null,
      file_path: rec.filePath || null, extracted_data: rec.extracted || {},
      patient_name_on_doc: rec.patientNameOnDoc || null,
    }]).select().single();
    if (error) throw error;
    return { ...rec, id: data.id };
  },
  async deleteRecord(recordId) {
    const { error } = await supabaseClient.from('medical_records').delete().eq('id', recordId);
    if (error) throw error;
  },
  async uploadFile(file, userId) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from('medical-documents').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return path;
  },
  async getLogs(memberId) {
    const { data, error } = await supabaseClient.from('daily_logs').select('*').eq('member_id', memberId).order('date', { ascending: false }).limit(30);
    if (error) throw error;
    return data.map(r => ({ id: r.id, mid: r.member_id, date: r.date, feeling: r.feeling, symptoms: r.symptoms || [], note: r.note, bp: r.bp, meds: r.medications_taken }));
  },
  async addLog(userId, log) {
    const { data, error } = await supabaseClient.from('daily_logs').upsert([{
      owner_id: userId, member_id: log.mid, date: log.date, feeling: log.feeling,
      symptoms: log.symptoms || [], note: log.note || null, bp: log.bp || null,
      medications_taken: log.meds ?? true,
    }], { onConflict: 'member_id,date' }).select().single();
    if (error) throw error;
    return { ...log, id: data.id };
  },
  async getMetrics(memberId) {
    const { data, error } = await supabaseClient.from('health_metrics').select('*').eq('member_id', memberId).order('date').limit(60);
    if (error) throw error;
    return data;
  },
  async addMetric(userId, metric) {
    const { error } = await supabaseClient.from('health_metrics').insert([{
      owner_id: userId, member_id: metric.memberId, date: metric.date,
      systolic: metric.systolic || null, diastolic: metric.diastolic || null,
      weight_kg: metric.weight || null, heart_rate: metric.heartRate || null,
      steps: metric.steps || null, sleep_hours: metric.sleep || null,
    }]);
    if (error) throw error;
  },
};

// ─────────────────────────────────────────
//  AI DOCUMENT ANALYSIS  (Claude API)
// ─────────────────────────────────────────
const EXTRACT_PROMPT = `You are a medical document AI for Indian healthcare. Extract all information from this document (prescription, lab report, bill, X-ray, discharge summary, insurance, or other medical doc).

Respond with ONLY valid JSON (no markdown fences):
{
  "patientName": "exact name as on document or null",
  "patientAge": "age string or null",
  "date": "YYYY-MM-DD",
  "docType": "prescription|report|bill|xray|discharge|other",
  "doctor": "doctor name + qualification or null",
  "hospital": "hospital/clinic/lab name or null",
  "title": "concise 4-7 word descriptive title",
  "summary": "one plain-English sentence summarising the key finding",
  "diagnosis": "primary diagnosis/impression or null",
  "medications": [{"name":"","dose":"","freq":"","duration":"","purpose":""}],
  "keyValues": [{"name":"","value":"","status":"normal|high|low|critical|borderline","normal":""}],
  "advice": "lifestyle/diet instructions or null",
  "followup": "next visit/test instructions or null",
  "tags": ["2-5 relevant tags"],
  "amount": null,
  "billItems": []
}

For BILLS: set amount as number, fill billItems array.
For LAB REPORTS: extract every test value with reference range, flag abnormals.
For PRESCRIPTIONS: extract every medication with full dosing instructions.
Handle: handwritten Rx, any Indian lab format (SRL, Lal Path, Metropolis, Apollo, Thyrocare etc.), Hindi+English mixed, angled photos, PDFs.`;

async function analyseDocument(file) {
  const isPDF = file.type === 'application/pdf';
  const isImg = file.type.startsWith('image/') || file.name?.toLowerCase().endsWith('.heic');
  if (!isPDF && !isImg) throw new Error('Please upload a PDF or image (JPG, PNG, HEIC)');
  if (file.size > 25 * 1024 * 1024) throw new Error('File too large (max 25 MB). Please compress and retry.');
  const b64 = await fileToBase64(file);
  const mediaType = isPDF ? 'application/pdf' : (file.type || 'image/jpeg');
  const block = isPDF
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: [block, { type: 'text', text: EXTRACT_PROMPT }] }] })
  });
  if (!res.ok) throw new Error(`AI error (${res.status})`);
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  const raw = (d.content?.[0]?.text || '').replace(/```json\n?|```\n?/g, '').trim();
  try { return JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('Could not parse AI response'); }
}

// ─────────────────────────────────────────
//  SMALL UI HELPERS (return HTML strings)
// ─────────────────────────────────────────
function iconHtml(name, size = 16, extraClass = '') {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px" class="${extraClass}"></i>`;
}
function badgeHtml(label, className = '') {
  return `<span class="text-xs px-2 py-0.5 rounded-full font-semibold ${className}">${esc(label)}</span>`;
}
function cardOpen(className = '', extra = '') {
  return `<div class="bg-white rounded-2xl border border-stone-100 shadow-sm ${className}" ${extra}>`;
}
function scoreArcSvg(score, size = 96) {
  const r = 36, cx = 48, cy = 50;
  const angle = Math.PI * (score / 100);
  const x = cx - r * Math.cos(angle), y = cy - r * Math.sin(angle);
  const col = scoreColor(score);
  return `<svg width="${size}" height="${size * 0.6}" viewBox="0 0 96 60">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#e7e5e4" stroke-width="8" stroke-linecap="round"/>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round"/>
    <text x="48" y="45" text-anchor="middle" fill="${col}" font-size="20" font-weight="800">${score}</text>
  </svg>`;
}
function spinnerHtml(size = 18, color = 'text-teal-600') {
  return `<i data-lucide="loader" class="spin ${color}" style="width:${size}px;height:${size}px"></i>`;
}

// ─────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), 3500);
}
function toastHtml() {
  if (!state.toast) return '';
  return `<div class="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap toast-anim">
    ${iconHtml('check-circle', 15, 'text-emerald-400')}${esc(state.toast)}
  </div>`;
}

// ─────────────────────────────────────────
//  AUTH SCREEN
// ─────────────────────────────────────────
function renderAuthScreen() {
  const m = state.authMode;
  return `
  <div class="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-5">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style="background:${C.teal}">
          ${iconHtml('heart', 30, 'text-white')}
        </div>
        <h1 class="text-3xl font-black text-stone-900">HealthHub</h1>
        <p class="text-stone-400 mt-1 text-sm">Your personal health intelligence</p>
      </div>
      ${cardOpen('p-6')}
        <h2 class="text-lg font-bold text-stone-900 mb-5">${m === 'login' ? 'Sign in' : m === 'signup' ? 'Create account' : 'Reset password'}</h2>
        ${state.authError ? `<div class="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">${esc(state.authError)}</div>` : ''}
        ${state.authMessage ? `<div class="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">${esc(state.authMessage)}</div>` : ''}
        <div class="space-y-3">
          ${m === 'signup' ? `<input id="auth-name" placeholder="Full name" class="w-full px-4 py-3.5 border border-stone-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-600"/>` : ''}
          <input id="auth-email" type="email" placeholder="Email address" class="w-full px-4 py-3.5 border border-stone-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-600"/>
          ${m !== 'reset' ? `<input id="auth-pw" type="password" placeholder="Password" class="w-full px-4 py-3.5 border border-stone-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-600"/>` : ''}
        </div>
        <button id="auth-submit" class="w-full mt-5 py-3.5 text-white font-bold rounded-xl text-base hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2" style="background:${C.teal}" ${state.authLoading2 ? 'disabled' : ''}>
          ${state.authLoading2 ? spinnerHtml(18, 'text-white') : ''}
          ${m === 'login' ? 'Sign In' : m === 'signup' ? 'Create Account' : 'Send Reset Link'}
        </button>
        <div class="mt-4 flex flex-col gap-2 text-center">
          ${m === 'login' ? `
            <button data-action="auth-mode" data-mode="signup" class="text-sm font-semibold hover:underline" style="color:${C.teal}">Don't have an account? Sign up</button>
            <button data-action="auth-mode" data-mode="reset" class="text-xs text-stone-400 hover:underline">Forgot password?</button>
          ` : `
            <button data-action="auth-mode" data-mode="login" class="text-sm font-semibold hover:underline" style="color:${C.teal}">Back to sign in</button>
          `}
        </div>
      </div>
      <p class="text-center text-xs text-stone-400 mt-5">🔒 Works on iPhone Safari, Chrome &amp; Desktop · Data stays private</p>
    </div>
  </div>`;
}

async function handleAuthSubmit() {
  const mode = state.authMode;
  const email = document.getElementById('auth-email')?.value.trim();
  const pw = document.getElementById('auth-pw')?.value;
  const name = document.getElementById('auth-name')?.value.trim();
  setState({ authError: '', authMessage: '', authLoading2: true });
  try {
    if (mode === 'login') {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
    } else if (mode === 'signup') {
      const { error } = await supabaseClient.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
      if (error) throw error;
      setState({ authMessage: 'Check your email to confirm your account, then sign in.', authMode: 'login', authLoading2: false });
      return;
    } else {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setState({ authMessage: 'Password reset link sent to your email.', authLoading2: false });
      return;
    }
  } catch (e) {
    setState({ authError: e.message || 'Something went wrong', authLoading2: false });
    return;
  }
  setState({ authLoading2: false });
}

// ─────────────────────────────────────────
//  ONBOARDING  (first-time: add yourself)
// ─────────────────────────────────────────
let onboardingError = '';
let onboardingSaving = false;
function renderOnboarding() {
  return `
  <div class="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-5">
    <div class="w-full max-w-lg">
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style="background:${C.teal}">${iconHtml('user-plus', 26, 'text-white')}</div>
        <h1 class="text-2xl font-black text-stone-900">Set up your profile</h1>
        <p class="text-stone-400 text-sm mt-1">Add yourself first — you can add family members later</p>
      </div>
      ${cardOpen('p-6')}
        ${onboardingError ? `<div class="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">${esc(onboardingError)}</div>` : ''}
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">${fieldHtml('Full Name *', 'ob-name', 'text', 'e.g. Rahul Sharma')}</div>
          <div>
            <label class="block text-xs font-bold text-stone-500 mb-1">Role</label>
            <select id="ob-role" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
              ${['Self','Spouse','Son','Daughter','Father','Mother','Sibling','Other'].map(r=>`<option ${r==='Self'?'selected':''}>${r}</option>`).join('')}
            </select>
          </div>
          ${fieldHtml('Age', 'ob-age', 'number', '48')}
          <div>
            <label class="block text-xs font-bold text-stone-500 mb-1">Gender</label>
            <select id="ob-gender" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
              ${['Male','Female','Other'].map(g=>`<option>${g}</option>`).join('')}
            </select>
          </div>
          ${fieldHtml('Blood Group', 'ob-blood', 'text', 'B+')}
          ${fieldHtml('Height', 'ob-height', 'text', "5'10\\u0022")}
          ${fieldHtml('Weight', 'ob-weight', 'text', '80 kg')}
          ${fieldHtml('Blood Pressure', 'ob-bp', 'text', '138/88')}
          ${fieldHtml('HbA1c', 'ob-hba1c', 'text', '5.9%')}
          <div class="col-span-2">${fieldHtml('Conditions (comma-separated)', 'ob-conditions', 'text', 'Hypertension, Pre-diabetic')}</div>
          <div class="col-span-2">${fieldHtml('Medications (comma-separated)', 'ob-medications', 'text', 'Amlodipine, Metformin')}</div>
          <div class="col-span-2">${fieldHtml('Allergies (comma-separated)', 'ob-allergies', 'text', 'Penicillin')}</div>
          ${fieldHtml('Primary Doctor', 'ob-doctor', 'text', 'Dr. Suresh Patel')}
          ${fieldHtml('Hospital / Clinic', 'ob-hospital', 'text', 'Apollo Hospitals')}
          <div class="col-span-2">${fieldHtml('Health Goals (comma-separated)', 'ob-goals', 'text', 'Lose 5 kg, Walk 8000 steps daily')}</div>
          <div class="col-span-2">${fieldHtml('Insurance', 'ob-insurance', 'text', 'Star Health – ₹5L')}</div>
        </div>
        <button id="ob-save" class="w-full mt-5 py-3.5 text-white font-bold rounded-xl text-base hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2" style="background:${C.teal}" ${onboardingSaving?'disabled':''}>
          ${onboardingSaving?spinnerHtml(18,'text-white'):''} Save &amp; Open Dashboard
        </button>
      </div>
      <p class="text-xs text-stone-400 text-center mt-4">You can edit this any time from your profile settings</p>
    </div>
  </div>`;
}
function fieldHtml(label, id, type, placeholder) {
  return `<div><label class="block text-xs font-bold text-stone-500 mb-1">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>`;
}
async function handleOnboardingSave() {
  const val = id => document.getElementById(id)?.value.trim() || '';
  const name = val('ob-name');
  if (!name) { onboardingError = 'Name is required'; render(); return; }
  onboardingError = ''; onboardingSaving = true; render();
  const splitList = s => s.split(',').map(x => x.trim()).filter(Boolean);
  try {
    await db.addMember(state.session.user.id, {
      name, role: val('ob-role') || 'Self', age: val('ob-age') ? +val('ob-age') : null,
      gender: val('ob-gender') || 'Male', blood: val('ob-blood'), height: val('ob-height'),
      weight: val('ob-weight'), bp: val('ob-bp'), hba1c: val('ob-hba1c'),
      conditions: splitList(val('ob-conditions')),
      medications: val('ob-medications') ? splitList(val('ob-medications')).map(s => ({ name: s, dose: '', freq: '', type: 'rx' })) : [],
      allergies: splitList(val('ob-allergies')),
      doctor: val('ob-doctor'), hospital: val('ob-hospital'),
      goals: splitList(val('ob-goals')), insurance: val('ob-insurance'),
      color: MEMBER_COLORS[0], score: 80,
    });
    const ms = await db.getMembers(state.session.user.id);
    setState({ members: ms, currentId: ms[0]?.id || null });
    onboardingSaving = false;
  } catch (e) {
    onboardingError = e.message; onboardingSaving = false; render();
  }
}

// ─────────────────────────────────────────
//  ADD MEMBER MODAL
// ─────────────────────────────────────────
let addMemberSaving = false;
function renderAddMemberModal() {
  if (!state.addMemberModal) return '';
  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="addmember-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-stone-900 text-lg">Add Family Member</h3>
        <button data-action="close-addmember">${iconHtml('x', 18, 'text-stone-400')}</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">${fieldHtml('Full Name *', 'am-name', 'text', 'Name')}</div>
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Role</label>
          <select id="am-role" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
            ${['Spouse','Son','Daughter','Father','Mother','Sibling','Other'].map(r=>`<option>${r}</option>`).join('')}
          </select>
        </div>
        ${fieldHtml('Age', 'am-age', 'number', 'Age')}
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Gender</label>
          <select id="am-gender" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
            ${['Male','Female','Other'].map(g=>`<option>${g}</option>`).join('')}
          </select>
        </div>
        ${fieldHtml('Blood Group', 'am-blood', 'text', 'B+')}
        <div class="col-span-2">${fieldHtml('Conditions (comma-separated)', 'am-conditions', 'text', 'Hypothyroidism, Anaemia')}</div>
        ${fieldHtml('Doctor', 'am-doctor', 'text', '')}
        ${fieldHtml('Hospital', 'am-hospital', 'text', '')}
      </div>
      <div class="flex gap-3 mt-5">
        <button data-action="close-addmember" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
        <button id="am-save" class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}" ${addMemberSaving?'disabled':''}>
          ${addMemberSaving?spinnerHtml(15,'text-white'):''} Add Member
        </button>
      </div>
    </div>
  </div>`;
}
async function handleAddMemberSave() {
  const val = id => document.getElementById(id)?.value.trim() || '';
  const name = val('am-name');
  if (!name) return;
  addMemberSaving = true; render();
  try {
    const splitList = s => s.split(',').map(x => x.trim()).filter(Boolean);
    const m = await db.addMember(state.session.user.id, {
      name, role: val('am-role') || 'Spouse', age: val('am-age') ? +val('am-age') : null,
      gender: val('am-gender') || 'Female', blood: val('am-blood'),
      conditions: splitList(val('am-conditions')), doctor: val('am-doctor'), hospital: val('am-hospital'),
      color: MEMBER_COLORS[state.members.length % MEMBER_COLORS.length], score: 80,
    });
    addMemberSaving = false;
    setState({ members: [...state.members, m], addMemberModal: false, currentId: state.currentId || m.id });
  } catch { addMemberSaving = false; render(); }
}

// ─────────────────────────────────────────
//  UPLOAD MODAL
// ─────────────────────────────────────────
const PROGRESS_STEPS = [
  { pct: 10, msg: 'Reading your file…' }, { pct: 30, msg: 'Identifying document type…' },
  { pct: 55, msg: 'Extracting medical data with AI…' }, { pct: 75, msg: 'Parsing values and medications…' },
  { pct: 90, msg: 'Verifying patient name…' }, { pct: 98, msg: 'Almost done…' },
];
function openUploadModal() {
  setState({ uploadModal: { phase: 'select', file: null, ext: null, pct: 0, progressMsg: '', errMsg: '', mismatchName: '', uploading: false } });
}
function closeUploadModal() { setState({ uploadModal: null }); }

async function runUploadAnalysis(file) {
  setState({ uploadModal: { ...state.uploadModal, phase: 'analysing', file, pct: 5, progressMsg: 'Reading your file…' } });
  let si = 0;
  const tick = setInterval(() => {
    si = Math.min(si + 1, PROGRESS_STEPS.length - 1);
    setState({ uploadModal: { ...state.uploadModal, pct: PROGRESS_STEPS[si].pct, progressMsg: PROGRESS_STEPS[si].msg } });
  }, 1000);
  try {
    const extracted = await analyseDocument(file);
    clearInterval(tick);
    const m = currentMember();
    if (extracted.patientName && !nameMatches(extracted.patientName, m.name)) {
      setState({ uploadModal: { ...state.uploadModal, phase: 'mismatch', ext: extracted, pct: 100, mismatchName: extracted.patientName } });
    } else {
      setState({ uploadModal: { ...state.uploadModal, phase: 'review', ext: extracted, pct: 100 } });
    }
  } catch (e) {
    clearInterval(tick);
    setState({ uploadModal: { ...state.uploadModal, phase: 'error', errMsg: e.message || 'Upload failed' } });
  }
}

async function saveUploadRecord(memberId) {
  const um = state.uploadModal;
  setState({ uploadModal: { ...um, uploading: true } });
  try {
    let filePath = null;
    try { filePath = await db.uploadFile(um.file, state.session.user.id); } catch {}
    const ext = um.ext;
    const rec = {
      mid: memberId, date: ext.date || new Date().toISOString().split('T')[0],
      type: ext.docType || 'report', title: ext.title || um.file?.name || 'Uploaded Document',
      doctor: ext.doctor || null, hospital: ext.hospital || null, amount: ext.amount || null,
      summary: ext.summary || 'Document analysed by AI', tags: ext.tags || [],
      source: 'upload', uploadedFile: um.file?.name, filePath, patientNameOnDoc: ext.patientName,
      priority: (ext.keyValues?.some(k => k.status === 'critical' || k.status === 'high')) ? 'high'
        : (ext.keyValues?.some(k => k.status === 'borderline' || k.status === 'low')) ? 'medium' : 'low',
      extracted: {
        diagnosis: ext.diagnosis,
        meds: ext.medications?.length ? ext.medications.map(x => `${x.name} ${x.dose} – ${x.freq}${x.duration ? ` (${x.duration})` : ''}`) : undefined,
        keyValues: ext.keyValues?.length ? ext.keyValues : undefined,
        advice: ext.advice, followup: ext.followup,
        items: ext.billItems?.length ? ext.billItems.map(b => ({ name: b.name, amt: b.amount })) : undefined,
      }
    };
    const saved = await db.addRecord(state.session.user.id, rec);
    setState({ records: [saved, ...state.records], uploadModal: null });
    showToast(`"${saved.title}" saved ✓`);
  } catch (e) {
    setState({ uploadModal: { ...um, uploading: false, phase: 'error', errMsg: e.message } });
  }
}

function renderUploadModal() {
  const um = state.uploadModal;
  if (!um) return '';
  const m = currentMember();
  let body = '';

  if (um.phase === 'select') {
    body = `
      <div class="space-y-3">
        <input type="file" id="upload-file-input" accept="image/*,.pdf,.heic,.heif" class="hidden"/>
        <input type="file" id="upload-camera-input" accept="image/*" capture="environment" class="hidden"/>
        <div id="upload-dropzone" class="border-2 border-dashed border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer">
          <div class="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">${iconHtml('file-up', 28, 'text-stone-400')}</div>
          <div class="text-center"><p class="font-bold text-stone-800 text-sm">Tap to select · or drag a file here</p><p class="text-xs text-stone-400 mt-1">PDF, JPG, PNG, HEIC · Max 25 MB</p></div>
        </div>
        <button id="upload-camera-btn" class="w-full flex items-center justify-center gap-2.5 py-3.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors">
          ${iconHtml('camera', 18, 'text-teal-600')} Take a photo of document
        </button>
        <div class="bg-stone-50 rounded-2xl p-4">
          <p class="text-xs font-bold text-stone-500 mb-3 flex items-center gap-1.5">${iconHtml('info',12)} AI reads any Indian medical document:</p>
          <div class="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-stone-500">
            ${['Handwritten prescriptions','Lab reports (any Indian lab)','Hospital bills & invoices','X-ray / MRI / CT reports','Discharge summaries','Hindi + English mixed text','iPhone photos at angle','Insurance documents'].map(x=>`<div class="flex items-start gap-1.5">${iconHtml('check',11,'text-emerald-500')}${x}</div>`).join('')}
          </div>
        </div>
        <p class="text-xs text-stone-400 text-center">🔒 Files stored privately in your Supabase vault · Never shared</p>
      </div>`;
  } else if (um.phase === 'analysing') {
    body = `
      <div class="py-10 flex flex-col items-center gap-5">
        <div class="relative w-20 h-20">
          <div class="absolute inset-0 rounded-full border-4 border-stone-100"></div>
          <div class="absolute inset-0 rounded-full border-4 spin" style="border-color:${C.teal} transparent transparent transparent"></div>
          <div class="absolute inset-0 flex items-center justify-center">${iconHtml('brain',26)}</div>
        </div>
        <div class="text-center"><p class="font-bold text-stone-900">AI is reading your document</p><p class="text-sm text-stone-400 mt-1">${esc(um.progressMsg)}</p></div>
        <div class="w-full bg-stone-100 rounded-full h-2 overflow-hidden"><div class="h-2 rounded-full transition-all duration-700" style="width:${um.pct}%;background:${C.teal}"></div></div>
        ${um.file ? `<div class="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-xl text-xs text-stone-500 w-full">${iconHtml('file-text',13)}<span class="truncate flex-1">${esc(um.file.name)}</span><span>${(um.file.size/1024).toFixed(0)} KB</span></div>` : ''}
      </div>`;
  } else if (um.phase === 'mismatch') {
    const ext = um.ext;
    body = `
      <div class="space-y-4">
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div class="flex items-start gap-3">${iconHtml('alert-triangle',20,'text-amber-500')}
            <div>
              <p class="font-bold text-amber-900 text-sm">Different patient name on document</p>
              <p class="text-sm text-amber-800 mt-1">Document shows: <strong>"${esc(um.mismatchName)}"</strong></p>
              <p class="text-sm text-amber-700">Current profile: <strong>"${esc(m.name)}"</strong></p>
              <p class="text-xs text-amber-600 mt-2">This may be a family member's record. Choose who to add it to:</p>
            </div>
          </div>
        </div>
        ${ext ? `<div class="p-3 bg-stone-50 rounded-xl"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Document</p>${ext.title?`<p class="font-semibold text-stone-800 text-sm">${esc(ext.title)}</p>`:''}${ext.summary?`<p class="text-xs text-stone-500 mt-1">${esc(ext.summary)}</p>`:''}</div>` : ''}
        <div class="space-y-2">
          ${state.members.map(mem => `
            <button data-action="save-upload" data-member-id="${mem.id}" ${um.uploading?'disabled':''}
              class="w-full flex items-center gap-3 p-3.5 border-2 rounded-2xl transition-colors text-left ${mem.id===m.id?'border-teal-400 bg-teal-50':'border-stone-200 bg-white hover:border-stone-300'}">
              <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div>
              <div class="flex-1"><p class="font-bold text-stone-900 text-sm">${esc(mem.name)}</p><p class="text-xs text-stone-400">${esc(mem.role)}</p></div>
              ${um.uploading && mem.id===m.id ? spinnerHtml(15) : mem.id===m.id ? iconHtml('check-circle',15) : ''}
            </button>`).join('')}
          <button data-action="close-upload" class="w-full py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-400">Cancel – this file doesn't belong here</button>
        </div>
      </div>`;
  } else if (um.phase === 'review') {
    const ext = um.ext;
    const infoRows = [
      { l: 'Document type', v: ext.docType }, { l: 'Date', v: ext.date ? fmtDate(ext.date) : null },
      { l: 'Patient name', v: ext.patientName }, { l: 'Doctor', v: ext.doctor },
      { l: 'Hospital / Lab', v: ext.hospital }, { l: 'Amount', v: ext.amount ? fmtINR(ext.amount) : null },
    ].filter(x => x.v);
    body = `
      <div class="space-y-4">
        <div class="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          ${iconHtml('check-circle',15,'text-emerald-600')}<p class="text-sm font-bold text-emerald-800">AI extraction complete</p>
          ${um.file ? `<span class="ml-auto text-xs text-stone-400 truncate max-w-36">${esc(um.file.name)}</span>` : ''}
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          ${infoRows.map(x=>`<div class="bg-stone-50 rounded-xl p-2.5"><p class="text-xs text-stone-400">${x.l}</p><p class="text-sm font-semibold text-stone-800 mt-0.5 capitalize">${esc(x.v)}</p></div>`).join('')}
        </div>
        ${ext.summary?`<div class="p-3 bg-teal-50 rounded-xl border border-teal-100"><p class="text-xs font-bold text-teal-700 mb-0.5">Summary</p><p class="text-sm text-teal-800">${esc(ext.summary)}</p></div>`:''}
        ${ext.keyValues?.length>0?`<div><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Lab Values (${ext.keyValues.length})</p>
          <div class="space-y-1.5 max-h-44 overflow-y-auto">
            ${ext.keyValues.map(kv=>`<div class="flex items-center justify-between px-3 py-2 rounded-xl ${kv.status==='critical'?'bg-rose-100':kv.status==='high'||kv.status==='low'?'bg-rose-50':kv.status==='borderline'?'bg-amber-50':'bg-stone-50'}">
              <span class="text-xs text-stone-600">${esc(kv.name)}</span>
              <div class="text-right"><span class="text-sm font-bold ${statusColor(kv.status)}">${esc(kv.value)}</span>${kv.normal?`<p class="text-xs text-stone-400">ref: ${esc(kv.normal)}</p>`:''}</div>
            </div>`).join('')}
          </div></div>`:''}
        ${ext.medications?.length>0?`<div><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Medications (${ext.medications.length})</p>
          <div class="space-y-1.5">${ext.medications.map(med=>`<div class="flex items-start gap-2 p-2.5 bg-teal-50 rounded-xl">${iconHtml('pill',13,'text-teal-600')}
            <div><p class="text-sm font-bold text-stone-800">${esc(med.name)} <span class="font-normal">${esc(med.dose)}</span></p><p class="text-xs text-stone-500">${esc(med.freq)}${med.duration?` · ${esc(med.duration)}`:''}</p></div>
          </div>`).join('')}</div></div>`:''}
        <div class="flex gap-3 pt-1">
          <button data-action="close-upload" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
          <button data-action="save-upload" data-member-id="${m.id}" ${um.uploading?'disabled':''}
            class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}">
            ${um.uploading?spinnerHtml(15,'text-white'):''} ${um.uploading?'Saving…':`Save to ${esc(m.name.split(' ')[0])}'s Records`}
          </button>
        </div>
      </div>`;
  } else if (um.phase === 'error') {
    body = `
      <div class="py-8 space-y-5 text-center">
        <div class="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">${iconHtml('alert-circle',28,'text-rose-500')}</div>
        <div><p class="font-bold text-stone-900">Upload failed</p><p class="text-sm text-stone-400 mt-1.5 max-w-xs mx-auto">${esc(um.errMsg)}</p></div>
        <div class="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 text-left space-y-1">
          <p class="font-semibold">Tips:</p><p>• Good lighting, document fills the frame</p><p>• PDF must not be password-protected</p><p>• Max 25 MB</p>
        </div>
        <div class="flex gap-3">
          <button data-action="close-upload" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
          <button data-action="retry-upload" class="flex-1 py-3 text-white rounded-xl text-sm font-bold hover:opacity-90" style="background:${C.teal}">Try Again</button>
        </div>
      </div>`;
  }

  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="upload-backdrop">
    <div class="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${C.teal}">${iconHtml('upload',16,'text-white')}</div>
          <div><p class="font-bold text-stone-900 text-sm">Upload Medical Record</p><p class="text-xs text-stone-400">Adding to <span class="font-semibold">${esc(m.name)}</span></p></div>
        </div>
        <button data-action="close-upload" class="p-2 rounded-xl hover:bg-stone-100">${iconHtml('x',18,'text-stone-400')}</button>
      </div>
      <div class="overflow-y-auto flex-1 p-5">${body}</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function currentMember() { return state.members.find(x => x.id === state.currentId); }

// ─────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────
function renderDashboard() {
  const m = currentMember();
  const myRecs = state.records.slice(0, 4);
  const latest = state.logs[0];
  const fi = latest ? feelInfo(latest.feeling) : null;
  return `
  <div class="space-y-4 fade-in">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl md:text-2xl font-bold text-stone-900">Hey, ${esc(m.name.split(' ')[0])} 👋</h1>
        <p class="text-xs text-stone-400 mt-0.5">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p></div>
      <button data-action="goto" data-page="dailylog" class="flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('pencil',13)} Log today</button>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${cardOpen('p-4 flex flex-col items-center col-span-2 lg:col-span-1')}
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Health Score</p>
        ${scoreArcSvg(m.score, 100)}
        <p class="text-xs font-semibold mt-1" style="color:${scoreColor(m.score)}">${m.score>=85?'Excellent':m.score>=70?'Good – room to improve':'Needs attention'}</p>
      </div>
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Blood Pressure</p><p class="text-2xl font-black text-stone-900">${esc(m.bp)}</p></div>
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">HbA1c</p><p class="text-2xl font-black text-stone-900">${esc(m.hba1c)}</p></div>
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">BMI</p><p class="text-2xl font-black text-stone-900">${m.bmi||'—'}</p></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      ${cardOpen('p-4')}
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">Active Conditions</p>
        ${m.conditions.length===0?'<p class="text-sm text-stone-400">No conditions added</p>':m.conditions.map(c=>`<div class="flex items-center gap-2 mb-1.5"><div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div><span class="text-sm text-stone-700">${esc(c)}</span></div>`).join('')}
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2 mt-4">Medications</p>
        ${m.medications.filter(x=>x.type==='rx').map(med=>`<div class="flex items-center gap-2 mb-1">${iconHtml('pill',12,'text-teal-600')}<span class="text-sm text-stone-700">${esc(med.name)} <span class="font-bold">${esc(med.dose)}</span></span></div>`).join('')}
      </div>
      ${cardOpen('p-4')}
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">Upcoming</p>
        ${m.nextVisit?`<div class="p-3 bg-teal-50 rounded-xl flex items-start gap-2.5 mb-2">${iconHtml('calendar',14,'text-teal-700')}<div><p class="text-sm font-bold text-stone-800">${esc(m.doctor||'Doctor visit')}</p><p class="text-xs text-stone-500">${fmtDate(m.nextVisit)}</p></div></div>`:''}
        ${HEALTH_PLAN.risks.slice(0,2).map(r=>`<div class="p-3 bg-amber-50 rounded-xl flex items-start gap-2 mb-2">${iconHtml('alert-circle',13,'text-amber-600')}<p class="text-xs text-stone-700">${esc(r.action)}</p></div>`).join('')}
      </div>
      ${cardOpen('p-4')}
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">Today's Checklist</p>
        ${m.medications.map(med=>`<label class="flex items-center gap-3 mb-2.5 cursor-pointer"><div class="w-5 h-5 rounded-md border-2 border-stone-200 flex-shrink-0"></div><span class="text-sm text-stone-700">${esc(med.name)} ${esc(med.dose)}</span></label>`).join('')}
        <div class="border-t border-stone-100 my-2"></div>
        <label class="flex items-center gap-3 mb-2 cursor-pointer"><div class="w-5 h-5 rounded-md border-2 border-stone-200 flex-shrink-0"></div><span class="text-sm text-stone-700">30-min morning walk</span></label>
        ${latest?`<div class="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2"><span class="text-xl">${fi.e}</span><span class="text-xs text-stone-400">Yesterday: ${fi.l} (${latest.feeling}/10)</span></div>`:''}
        <button data-action="goto" data-page="dailylog" class="mt-3 w-full py-2.5 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">+ Add Today's Log</button>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      ${cardOpen('p-4')}
        <div class="flex items-center justify-between mb-3"><p class="font-bold text-stone-900 text-sm">Recent Records</p><button data-action="goto" data-page="records" class="text-xs font-bold hover:underline" style="color:${C.teal}">View all</button></div>
        ${myRecs.length===0?`<div class="text-center py-6 text-stone-400">${iconHtml('file-text',28,'mx-auto mb-2 opacity-30')}<p class="text-sm">No records yet</p><button data-action="goto" data-page="records" class="text-xs font-bold mt-2 hover:underline" style="color:${C.teal}">Upload your first document →</button></div>`
          : myRecs.map(r => { const ts = typeStyle(r.type); return `<div class="flex items-start gap-3 mb-2.5"><div class="p-2 rounded-lg ${ts.bg} ${ts.text} flex-shrink-0">${iconHtml(ts.icon,16)}</div><div class="flex-1 min-w-0"><p class="text-sm font-semibold text-stone-800 truncate">${esc(r.title)}</p><p class="text-xs text-stone-400">${fmtDate(r.date)}${r.source==='upload'?' · AI analysed':''}</p></div>${badgeHtml(r.priority, priBadge(r.priority))}</div>`; }).join('')}
      </div>
      ${cardOpen('p-4')}
        <div class="flex items-center justify-between mb-3"><p class="font-bold text-stone-900 text-sm">Health Spending</p><button data-action="goto" data-page="spending" class="text-xs font-bold hover:underline" style="color:${C.teal}">Details</button></div>
        <div class="flex items-center gap-4 mb-3"><div><p class="text-xs text-stone-400">This Month</p><p class="text-xl font-black text-stone-900">₹1,800</p></div><div class="h-8 w-px bg-stone-100"></div><div><p class="text-xs text-stone-400">This Year</p><p class="text-xl font-black text-stone-900">₹17,800</p></div></div>
        <canvas id="chart-dash-spend" height="55"></canvas>
      </div>
    </div>
  </div>`;
}
function mountDashboardCharts() {
  const ctx = document.getElementById('chart-dash-spend');
  if (!ctx) return;
  destroyChart('chart-dash-spend');
  chartRegistry['chart-dash-spend'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: SPEND_SAMPLE.slice(-5).map(d=>d.month), datasets: [{ data: SPEND_SAMPLE.slice(-5).map(d=>d.amount), backgroundColor: C.teal, borderRadius: 4 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtINR(c.raw)}}}, scales:{x:{display:false},y:{display:false}} }
  });
}

// ─────────────────────────────────────────
//  MEDICAL RECORDS
// ─────────────────────────────────────────
const RECORD_TABS = [{id:'all',label:'All'},{id:'prescription',label:'Prescriptions'},{id:'report',label:'Reports'},{id:'bill',label:'Bills'},{id:'xray',label:'X-Rays'},{id:'discharge',label:'Discharge'}];

function renderRecords() {
  const m = currentMember();
  const filtered = state.records.filter(r =>
    (state.recordFilter === 'all' || r.type === state.recordFilter) &&
    (!state.recordSearch || r.title?.toLowerCase().includes(state.recordSearch.toLowerCase()) || r.summary?.toLowerCase().includes(state.recordSearch.toLowerCase()))
  );
  const sel = state.records.find(r => r.id === state.recordSelectedId);

  const listHtml = filtered.length === 0 ? `
    <div class="text-center py-16 text-stone-400">
      ${iconHtml('file-text',36,'mx-auto mb-3 opacity-30')}
      <p class="font-semibold">${state.recordSearch?'No records match':'No records yet'}</p>
      ${!state.recordSearch?`<button data-action="open-upload" class="mt-4 px-5 py-2.5 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:opacity-90" style="background:${C.teal}">${iconHtml('upload',14)} Upload First Record</button>`:''}
    </div>` : filtered.map(r => {
      const ts = typeStyle(r.type); const isSel = state.recordSelectedId === r.id;
      let mobileExpand = '';
      if (isSel && r.extracted) {
        mobileExpand = `<div class="mt-3 pt-3 border-t border-stone-100 lg:hidden space-y-2">
          ${r.extracted.diagnosis?`<p class="text-xs text-stone-600"><span class="font-bold">Dx:</span> ${esc(r.extracted.diagnosis)}</p>`:''}
          ${(r.extracted.keyValues||[]).slice(0,4).map(kv=>`<div class="flex justify-between text-xs px-2 py-1.5 rounded-lg ${kv.status==='high'||kv.status==='low'?'bg-rose-50':kv.status==='borderline'?'bg-amber-50':'bg-stone-50'}"><span class="text-stone-500">${esc(kv.name)}</span><span class="font-bold ${statusColor(kv.status)}">${esc(kv.value)}</span></div>`).join('')}
          ${r.extracted.advice?`<div class="p-2 bg-teal-50 rounded-lg text-xs text-teal-700">${esc(r.extracted.advice)}</div>`:''}
          <button data-action="delete-record" data-id="${r.id}" class="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1">${state.recordDeleting===r.id?spinnerHtml(12):''} Delete record</button>
        </div>`;
      }
      return `<div class="bg-white rounded-2xl p-4 border cursor-pointer transition-all hover:shadow-md ${isSel?'border-teal-400 shadow-md':'border-stone-100 shadow-sm'}" data-action="select-record" data-id="${r.id}">
        <div class="flex items-start gap-3">
          <div class="p-2.5 rounded-xl ${ts.bg} ${ts.text} flex-shrink-0">${iconHtml(ts.icon,18)}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-bold text-stone-900 text-sm">${esc(r.title)}</p>
              ${r.source==='upload'?badgeHtml('AI analysed','bg-teal-50 text-teal-700'):''}
              ${badgeHtml(r.priority, priBadge(r.priority)+' ml-auto')}
            </div>
            <p class="text-xs text-stone-400 mt-0.5 mb-1">${fmtDate(r.date)}${r.doctor?` · ${esc(r.doctor)}`:''}${r.hospital?` · ${esc(r.hospital)}`:''}${r.amount?` · ${fmtINR(r.amount)}`:''}</p>
            <p class="text-sm text-stone-600 line-clamp-2">${esc(r.summary)}</p>
            <div class="flex gap-1.5 mt-2 flex-wrap">${(r.tags||[]).map(tag=>`<span class="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">${esc(tag)}</span>`).join('')}</div>
          </div>
        </div>
        ${mobileExpand}
      </div>`;
    }).join('');

  const sidePanel = sel ? `
    <div class="hidden lg:block w-80 flex-shrink-0">
      ${cardOpen('p-5 sticky top-0 max-h-screen overflow-y-auto')}
        <div class="flex items-center justify-between mb-4"><p class="font-bold text-stone-900">Record Details</p><button data-action="deselect-record">${iconHtml('x',15,'text-stone-400')}</button></div>
        ${(() => { const ts = typeStyle(sel.type); return `<div class="flex items-center gap-2 px-3 py-2 rounded-xl ${ts.bg} ${ts.text} text-sm font-bold mb-4">${iconHtml(ts.icon,16)}<span>${ts.label}</span>${sel.source==='upload'?badgeHtml('AI','ml-auto bg-teal-100 text-teal-700 text-xs'):''}</div>`; })()}
        <div class="space-y-2.5 text-sm">
          ${[{l:'Date',v:fmtDate(sel.date)},{l:'Doctor',v:sel.doctor},{l:'Facility',v:sel.hospital},{l:'Amount',v:sel.amount?fmtINR(sel.amount):null},{l:'File',v:sel.uploadedFile}].filter(x=>x.v).map(x=>`<div><p class="text-xs text-stone-400">${x.l}</p><p class="font-semibold text-stone-800">${esc(x.v)}</p></div>`).join('')}
        </div>
        ${sel.extracted ? `<div class="mt-4 pt-4 border-t border-stone-100 space-y-3">
          <p class="text-xs font-bold text-stone-400 uppercase tracking-wider">AI Extracted</p>
          ${sel.extracted.diagnosis?`<div><p class="text-xs text-stone-400">Diagnosis</p><p class="text-sm text-stone-800">${esc(sel.extracted.diagnosis)}</p></div>`:''}
          ${sel.extracted.keyValues?`<div class="space-y-1.5">${sel.extracted.keyValues.map(kv=>`<div class="flex items-baseline justify-between px-2 py-1.5 rounded-lg ${kv.status==='critical'?'bg-rose-100':kv.status==='high'||kv.status==='low'?'bg-rose-50':kv.status==='borderline'?'bg-amber-50':'bg-stone-50'}"><span class="text-xs text-stone-500">${esc(kv.name)}</span><div class="text-right"><span class="text-sm font-bold ${statusColor(kv.status)}">${esc(kv.value)}</span>${kv.normal?`<p class="text-xs text-stone-400">${esc(kv.normal)}</p>`:''}</div></div>`).join('')}</div>`:''}
          ${sel.extracted.meds?`<div><p class="text-xs text-stone-400 mb-1">Medications</p>${sel.extracted.meds.map(med=>`<div class="flex items-center gap-2 text-sm mb-1">${iconHtml('pill',12,'text-teal-600')}<span class="text-stone-700">${esc(med)}</span></div>`).join('')}</div>`:''}
          ${sel.extracted.advice?`<div class="p-2.5 bg-teal-50 rounded-xl"><p class="text-xs font-bold text-teal-700 mb-0.5">Advice</p><p class="text-xs text-teal-600">${esc(sel.extracted.advice)}</p></div>`:''}
          ${sel.extracted.followup?`<div class="p-2.5 bg-amber-50 rounded-xl"><p class="text-xs font-bold text-amber-700 mb-0.5">Follow-up</p><p class="text-xs text-amber-700">${esc(sel.extracted.followup)}</p></div>`:''}
          ${sel.extracted.items?`<div class="space-y-1">${sel.extracted.items.map(it=>`<div class="flex justify-between text-xs"><span class="text-stone-500">${esc(it.name)}</span><span class="font-semibold">${fmtINR(it.amt)}</span></div>`).join('')}${sel.amount?`<div class="flex justify-between text-sm font-bold border-t pt-1"><span>Total</span><span>${fmtINR(sel.amount)}</span></div>`:''}</div>`:''}
        </div>` : ''}
        <div class="mt-4 flex gap-2">
          <button data-action="delete-record" data-id="${sel.id}" class="flex-1 py-2 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 flex items-center justify-center gap-1">${state.recordDeleting===sel.id?spinnerHtml(12):''} Delete</button>
          <button data-action="goto" data-page="aidoctor" class="flex-1 py-2 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:opacity-90" style="background:${C.teal}">${iconHtml('brain',12)} Ask AI</button>
        </div>
      </div>
    </div>` : '';

  return `
  <div class="fade-in">
    ${renderUploadModal()}
    <div class="flex gap-5">
      <div class="flex-1 min-w-0 space-y-4">
        <div class="flex items-center justify-between">
          <div><h1 class="text-xl md:text-2xl font-bold text-stone-900">Medical Records</h1><p class="text-xs text-stone-400 mt-0.5">${state.records.length} records · ${esc(m.name)}</p></div>
          <button data-action="open-upload" class="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('upload',15)}<span class="hidden sm:inline">Upload Record</span><span class="sm:hidden">Upload</span></button>
        </div>
        <div class="relative">${iconHtml('search',15,'absolute left-3.5 top-3 text-stone-400')}
          <input id="record-search-input" value="${esc(state.recordSearch)}" placeholder="Search records…" class="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"/>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          ${RECORD_TABS.map(t=>`<button data-action="filter-records" data-filter="${t.id}" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors" style="${state.recordFilter===t.id?`background:${C.teal};color:white`:'background:white;color:#78716c;border:1px solid #e7e5e4'}">${t.label}</button>`).join('')}
        </div>
        <div class="space-y-3">${listHtml}</div>
      </div>
      ${sidePanel}
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  HEALTH PLAN
// ─────────────────────────────────────────
const PLAN_TABS = [{id:'overview',l:'Overview',icon:'target'},{id:'diet',l:'Diet',icon:'apple'},{id:'exercise',l:'Exercise',icon:'dumbbell'},{id:'medications',l:'Meds',icon:'pill'},{id:'vitamins',l:'Supplements',icon:'zap'},{id:'risks',l:'Risks',icon:'shield'},{id:'ayurveda',l:'Ayurveda',icon:'leaf'}];
function priIcon(p) {
  if (p==='high') return iconHtml('alert-circle',13,'text-rose-500 flex-shrink-0 mt-0.5');
  if (p==='medium') return iconHtml('alert-triangle',13,'text-amber-500 flex-shrink-0 mt-0.5');
  return iconHtml('check-circle',13,'text-emerald-500 flex-shrink-0 mt-0.5');
}
function catCls(c) { return {essential:'bg-rose-50 text-rose-600',recommended:'bg-amber-50 text-amber-600',optional:'bg-stone-100 text-stone-500'}[c]||'bg-stone-100 text-stone-500'; }

function renderHealthPlan() {
  const m = currentMember();
  const t = state.planTab;
  let content = '';
  if (t === 'overview') {
    content = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">🎯 Goals</p>
        ${m.goals.length===0?'<p class="text-sm text-stone-400">Add goals in your profile</p>':m.goals.map(g=>`<div class="flex items-start gap-2 mb-2"><div class="w-4 h-4 rounded border-2 border-teal-300 flex-shrink-0 mt-0.5"></div><span class="text-sm text-stone-700">${esc(g)}</span></div>`).join('')}
      </div>
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">⚡ High Priority</p>
        ${[...HEALTH_PLAN.diet,...HEALTH_PLAN.exercise].filter(x=>x.priority==='high').slice(0,5).map(x=>`<div class="flex items-start gap-2 mb-2">${priIcon('high')}<span class="text-sm text-stone-700">${esc(x.item)}</span></div>`).join('')}
      </div>
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">⚠️ Risk Flags</p>
        ${HEALTH_PLAN.risks.map(r=>`<div class="p-2.5 bg-amber-50 rounded-xl mb-2"><p class="text-xs font-bold text-stone-800">${esc(r.risk)}</p><p class="text-xs text-stone-500 mt-0.5">${esc(r.action)}</p></div>`).join('')}
      </div>
      ${cardOpen('p-4')}<p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">💊 Current Medications</p>
        ${m.medications.length===0?'<p class="text-sm text-stone-400">No medications added</p>':m.medications.map(med=>`<div class="flex items-center gap-2 mb-2">${iconHtml('pill',13,'text-teal-600')}<span class="text-sm text-stone-700">${esc(med.name)} ${esc(med.dose)}</span></div>`).join('')}
      </div>
    </div>`;
  } else if (t === 'diet') {
    content = `${cardOpen('p-4')}<p class="font-bold text-stone-900 mb-3">Dietary Recommendations</p>${HEALTH_PLAN.diet.map(d=>`<div class="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 mb-1">${priIcon(d.priority)}<span class="text-sm text-stone-700 flex-1">${esc(d.item)}</span>${badgeHtml(d.cat,catCls(d.cat))}</div>`).join('')}</div>`;
  } else if (t === 'exercise') {
    content = `${cardOpen('p-4')}<p class="font-bold text-stone-900 mb-3">Exercise Plan</p>${HEALTH_PLAN.exercise.map(e=>`<div class="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 mb-1">${priIcon(e.priority)}<span class="text-sm text-stone-700 flex-1">${esc(e.item)}</span>${badgeHtml(e.cat,catCls(e.cat))}</div>`).join('')}</div>`;
  } else if (t === 'medications') {
    content = m.medications.length===0 ? `${cardOpen('p-8 text-center text-stone-400')}${iconHtml('pill',28,'mx-auto mb-2 opacity-30')}<p class="text-sm">No medications in your profile yet</p></div>`
      : `<div class="space-y-3">${m.medications.map(med=>`${cardOpen('p-4 flex items-center gap-3')}<div class="p-2.5 bg-teal-50 rounded-xl">${iconHtml('pill',20,'text-teal-700')}</div><div class="flex-1"><p class="font-bold text-stone-900">${esc(med.name)} <span style="color:${C.teal}">${esc(med.dose)}</span></p><p class="text-xs text-stone-500">${esc(med.freq)}</p></div>${badgeHtml(med.type==='rx'?'Prescription':'Supplement', med.type==='rx'?'bg-teal-50 text-teal-700':'bg-violet-50 text-violet-700')}</div>`).join('')}</div>`;
  } else if (t === 'vitamins') {
    content = `<div class="space-y-2">${HEALTH_PLAN.vitamins.map(v=>`${cardOpen('p-3.5 flex items-start gap-2.5')}${priIcon(v.priority)}<span class="text-sm text-stone-700 flex-1">${esc(v.item)}</span>${badgeHtml(v.source,'bg-violet-50 text-violet-600')}</div>`).join('')}</div>`;
  } else if (t === 'risks') {
    content = `<div class="space-y-3">${HEALTH_PLAN.risks.map(r=>`${cardOpen('p-4')}<div class="flex items-start gap-3">${iconHtml('shield',17,'text-amber-500')}<div><p class="font-bold text-stone-900">${esc(r.risk)}</p><p class="text-sm text-stone-600 mt-1">${esc(r.action)}</p></div></div></div>`).join('')}</div>`;
  } else if (t === 'ayurveda') {
    content = `<div class="space-y-3"><div class="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-800">🌿 <strong>Evidence-backed</strong> Ayurvedic tips — complement your treatment. Always discuss with your doctor.</div>
      ${HEALTH_PLAN.ayurveda.map(a=>`${cardOpen('p-4')}<div class="flex items-start gap-3"><div class="p-2 bg-emerald-50 rounded-xl flex-shrink-0">${iconHtml('leaf',15,'text-emerald-700')}</div><div><p class="text-sm text-stone-800">${esc(a.tip)}</p><div class="flex gap-2 mt-2">${badgeHtml(a.cat,'bg-emerald-50 text-emerald-700')}<span class="text-xs text-stone-400">${a.ev}</span></div></div></div></div>`).join('')}
    </div>`;
  }
  return `<div class="space-y-4 fade-in">
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Health Plan</h1>
    <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
      ${PLAN_TABS.map(tb=>`<button data-action="plan-tab" data-tab="${tb.id}" class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border" style="${t===tb.id?`background:${C.teal};color:white;border:1px solid ${C.teal}`:'background:white;color:#78716c;border:1px solid #e7e5e4'}">${iconHtml(tb.icon,12)}${tb.l}</button>`).join('')}
    </div>
    ${content}
  </div>`;
}

// ─────────────────────────────────────────
//  DAILY LOG
// ─────────────────────────────────────────
const SYMS = ['Headache','Fatigue','Nausea','Joint pain','Dizziness','Chest discomfort','Breathlessness','Back pain','Eye strain','Palpitations','Anxiety','Poor sleep','Swelling','Knee pain','Hair fall','Bloating','Low energy'];

function renderDailyLog() {
  const d = state.dailyLogDraft;
  const fi = feelInfo(d.feeling);
  const historyHtml = state.logs.length === 0
    ? `${cardOpen('p-10 text-center text-stone-400')}${iconHtml('pencil',32,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No logs yet</p></div>`
    : state.logs.map(log => { const li = feelInfo(log.feeling); return `
      ${cardOpen('p-4')}
        <div class="flex items-start justify-between mb-2">
          <div><p class="font-bold text-stone-900 text-sm">${fmtDate(log.date)}</p><div class="flex items-center gap-2 mt-0.5"><span class="text-xl">${li.e}</span><span class="text-sm font-bold ${li.c}">${li.l} (${log.feeling}/10)</span></div></div>
          ${log.bp?`<div class="text-right"><p class="text-xs text-stone-400">BP</p><p class="font-bold text-stone-900 text-sm">${esc(log.bp)}</p></div>`:''}
        </div>
        ${log.symptoms?.length>0?`<div class="flex flex-wrap gap-1.5 mb-2">${log.symptoms.map(s=>`<span class="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">${esc(s)}</span>`).join('')}</div>`:''}
        ${log.note?`<p class="text-sm text-stone-500 italic">"${esc(log.note)}"</p>`:''}
        <div class="mt-2 pt-2 border-t border-stone-100"><span class="text-xs font-bold ${log.meds?'text-emerald-600':'text-rose-600'}">${log.meds?'✓ Medications taken':'✗ Medications missed'}</span></div>
      </div>`; }).join('');

  return `<div class="space-y-4 fade-in">
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Daily Log</h1>
    ${state.dailyLogSaved?`<div class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-sm text-emerald-700 font-semibold">${iconHtml('check-circle',15)} Log saved!</div>`:''}
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div class="lg:col-span-2">
        ${cardOpen('p-5')}
          <p class="font-bold text-stone-900 mb-1">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</p>
          <p class="text-xs text-stone-400 mb-5">Logs feed the AI Doctor with real health patterns</p>
          <div class="mb-5">
            <p class="text-sm font-bold text-stone-700 mb-3">How are you feeling?</p>
            <div class="text-center mb-3"><span class="text-5xl">${fi.e}</span><p class="text-sm font-bold mt-1 ${fi.c}">${fi.l} · ${d.feeling}/10</p></div>
            <input type="range" id="dl-feeling" min="1" max="10" value="${d.feeling}" class="w-full"/>
            <div class="flex justify-between text-xs text-stone-400 mt-1"><span>😟 Poor</span><span>😄 Great</span></div>
          </div>
          <div class="mb-4">
            <p class="text-sm font-bold text-stone-700 mb-2">Symptoms</p>
            <div class="flex flex-wrap gap-1.5" id="dl-symptoms">${SYMS.map(s=>`<button data-action="toggle-symptom" data-symptom="${s}" class="text-xs px-2.5 py-1.5 rounded-full border ${d.symptoms.includes(s)?'border-rose-300 bg-rose-50 text-rose-700 font-bold':'border-stone-200 text-stone-500'}">${s}</button>`).join('')}</div>
          </div>
          <div class="mb-4"><p class="text-sm font-bold text-stone-700 mb-1.5">Blood Pressure</p><input id="dl-bp" value="${esc(d.bp)}" placeholder="e.g. 135/85" class="w-full px-4 py-3 border border-stone-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>
          <label class="flex items-center gap-3 cursor-pointer mb-4"><input type="checkbox" id="dl-meds" ${d.meds?'checked':''} class="w-4 h-4 rounded accent-teal-600"/><span class="text-sm text-stone-700">Took all medications today</span></label>
          <div class="mb-5"><p class="text-sm font-bold text-stone-700 mb-1.5">Notes</p><textarea id="dl-note" rows="3" placeholder="e.g. Knee pain after walk, hair fall noticed…" class="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none">${esc(d.note)}</textarea></div>
          <button id="dl-save" class="w-full py-3.5 text-white font-bold rounded-xl text-base hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" style="background:${C.teal}" ${state.dailyLogSaving?'disabled':''}>${state.dailyLogSaving?spinnerHtml(18,'text-white'):''}${state.dailyLogSaving?'Saving…':"Save Today's Log"}</button>
        </div>
      </div>
      <div class="lg:col-span-3 space-y-3"><p class="font-bold text-stone-800 text-lg">Log History</p>${historyHtml}</div>
    </div>
  </div>`;
}

async function handleSaveDailyLog() {
  const d = state.dailyLogDraft;
  d.feeling = +document.getElementById('dl-feeling').value;
  d.bp = document.getElementById('dl-bp').value;
  d.note = document.getElementById('dl-note').value;
  d.meds = document.getElementById('dl-meds').checked;
  setState({ dailyLogSaving: true });
  try {
    const m = currentMember();
    const log = { mid: m.id, date: new Date().toISOString().split('T')[0], feeling: d.feeling, symptoms: d.symptoms, note: d.note, bp: d.bp, meds: d.meds };
    const saved = await db.addLog(state.session.user.id, log);
    const without = state.logs.filter(l => l.date !== log.date || l.mid !== m.id);
    setState({ logs: [saved, ...without], dailyLogSaving: false, dailyLogSaved: true, dailyLogDraft: { feeling: 7, symptoms: [], note: '', bp: '', meds: false } });
    setTimeout(() => setState({ dailyLogSaved: false }), 3000);
  } catch { setState({ dailyLogSaving: false }); }
}

// ─────────────────────────────────────────
//  SPENDING
// ─────────────────────────────────────────
function renderSpending() {
  return `<div class="space-y-4 fade-in">
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Health Spending</h1>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${[{l:'This Month',v:'₹1,800',s:'↓ 56% vs April',sc:'text-emerald-600'},{l:'This Year',v:'₹17,800',s:'7 months tracked',sc:'text-stone-400'},{l:'Monthly Avg',v:'₹2,371',s:'All months',sc:'text-stone-400'},{l:'Claim Pending',v:'₹2,800',s:'File today – urgent',sc:'text-amber-600',hi:true}].map(st=>`
        <div class="bg-white rounded-2xl border shadow-sm p-4 ${st.hi?'bg-amber-50/40 border-amber-100':'border-stone-100'}">
          <p class="text-xs font-bold uppercase tracking-wide mb-2 ${st.hi?'text-amber-600':'text-stone-400'}">${st.l}</p>
          <p class="text-2xl font-black ${st.hi?'text-amber-700':'text-stone-900'}">${st.v}</p>
          <p class="text-xs font-semibold mt-1 ${st.sc}">${st.s}</p>
        </div>`).join('')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">${cardOpen('p-4')}<p class="font-bold text-stone-900 mb-4">Monthly Breakdown (₹)</p><canvas id="chart-spend-monthly" height="200"></canvas></div></div>
      ${cardOpen('p-4')}<p class="font-bold text-stone-900 mb-3">Category Split</p><canvas id="chart-spend-cats" height="150"></canvas>
        <div class="space-y-1.5 mt-2">${SPEND_CATS.map(c=>`<div class="flex items-center justify-between text-sm"><div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background:${c.color}"></div><span class="text-stone-600">${c.name}</span></div><span class="font-bold">${fmtINR(c.value)}</span></div>`).join('')}</div>
      </div>
    </div>
    ${cardOpen('p-4')}
      <div class="flex items-center gap-2 mb-4">${iconHtml('star',16,'text-amber-500')}<p class="font-bold text-stone-900">Savings Opportunities</p></div>
      ${[{t:'Switch to generic Amlodipine – same molecule, ~60% cheaper',s:200},{t:'Annual preventive health package vs individual tests – saves ~30%',s:840},{t:'File insurance claim for April lab tests (₹2,800 eligible) – Urgent!',s:2800},{t:'Bulk 3-month Metformin from Jan Aushadhi store',s:360}].map((item,i)=>`
        <div class="flex items-start gap-3 p-3.5 bg-amber-50 rounded-xl mb-2"><div class="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-xs font-black text-amber-800 flex-shrink-0">${i+1}</div><span class="text-sm text-stone-800 flex-1">${item.t}</span><p class="text-sm font-black text-emerald-600 flex-shrink-0">Save ${fmtINR(item.s)}</p></div>`).join('')}
      <div class="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between"><p class="text-sm font-bold text-emerald-800">Total potential savings</p><p class="text-lg font-black text-emerald-700">₹4,200</p></div>
    </div>
  </div>`;
}
function destroyChart(id) { if (chartRegistry[id]) { chartRegistry[id].destroy(); delete chartRegistry[id]; } }
function mountSpendingCharts() {
  const c1 = document.getElementById('chart-spend-monthly');
  if (c1) {
    destroyChart('chart-spend-monthly');
    chartRegistry['chart-spend-monthly'] = new Chart(c1, {
      type: 'bar',
      data: { labels: SPEND_SAMPLE.map(d=>d.month), datasets: [
        { label:'Medicines', data: SPEND_SAMPLE.map(d=>d.medicines), backgroundColor: C.violet },
        { label:'Lab Tests', data: SPEND_SAMPLE.map(d=>d.tests), backgroundColor: C.teal },
        { label:'Consultations', data: SPEND_SAMPLE.map(d=>d.consult), backgroundColor: C.amber },
      ]},
      options: { responsive:true, maintainAspectRatio:false, scales:{x:{stacked:true},y:{stacked:true}}, plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmtINR(c.raw)}`}}} }
    });
  }
  const c2 = document.getElementById('chart-spend-cats');
  if (c2) {
    destroyChart('chart-spend-cats');
    chartRegistry['chart-spend-cats'] = new Chart(c2, {
      type: 'doughnut',
      data: { labels: SPEND_CATS.map(c=>c.name), datasets: [{ data: SPEND_CATS.map(c=>c.value), backgroundColor: SPEND_CATS.map(c=>c.color) }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtINR(c.raw)}}} }
    });
  }
}

// ─────────────────────────────────────────
//  AI DOCTOR
// ─────────────────────────────────────────
const QUICK_QUESTIONS = ['Explain my HbA1c result','Best foods for pre-diabetes?','Lower LDL naturally','Exercise with hypertension?','What does Vitamin D deficiency feel like?','Ayurvedic tips for my conditions','Questions for my next doctor visit','Interpret my latest lab values'];

function initChatIfNeeded() {
  if (state.chatMsgs.length > 0) return;
  const m = currentMember();
  const uploaded = state.records.filter(r => r.source === 'upload');
  state.chatMsgs = [{ role: 'assistant', content: `Hello ${m.name.split(' ')[0]}! I'm your AI Health Assistant.\n\nI know your full profile: ${m.conditions.join(', ') || 'conditions not added yet'}${uploaded.length>0?`, and I've reviewed ${uploaded.length} uploaded document(s)`:''}.\n\nAsk me anything about your health, test results, diet, symptoms, or what to ask your doctor.` }];
}

function renderAIDoctor() {
  initChatIfNeeded();
  const m = currentMember();
  const uploaded = state.records.filter(r => r.source === 'upload');
  const msgsHtml = state.chatMsgs.map(msg => msg.role === 'user'
    ? `<div class="flex justify-end"><div class="max-w-sm md:max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap text-white rounded-tr-sm" style="background:${C.teal}">${esc(msg.content)}</div></div>`
    : `<div class="flex justify-start"><div class="w-7 h-7 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1" style="background:${C.teal}">${iconHtml('brain',13,'text-white')}</div><div class="max-w-sm md:max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-stone-50 text-stone-800 rounded-tl-sm">${esc(msg.content)}</div></div>`
  ).join('');
  const typingHtml = state.chatLoading ? `<div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full flex items-center justify-center" style="background:${C.teal}">${iconHtml('brain',13,'text-white')}</div><div class="bg-stone-50 px-4 py-3 rounded-2xl flex gap-1">${[0,1,2].map(i=>`<span class="w-2 h-2 bg-stone-400 rounded-full bounce-dot" style="animation-delay:${i*0.1}s"></span>`).join('')}</div></div>` : '';

  return `<div class="flex flex-col fade-in" style="height:calc(100dvh - 8rem)">
    <div class="flex items-center gap-3 mb-4 flex-shrink-0">
      <div class="p-2.5 rounded-2xl flex-shrink-0" style="background:${C.teal}">${iconHtml('brain',20,'text-white')}</div>
      <div><h1 class="text-lg md:text-2xl font-bold text-stone-900">AI Doctor</h1><p class="text-xs text-stone-400">Personalised · Reads your uploaded documents · Not a substitute for medical care</p></div>
    </div>
    ${uploaded.length>0?`<div class="flex items-center gap-2 mb-3 p-2.5 bg-teal-50 border border-teal-100 rounded-xl flex-shrink-0">${iconHtml('check-circle',13,'text-teal-600')}<p class="text-xs text-teal-700 font-medium">${uploaded.length} uploaded document${uploaded.length>1?'s':''} in context: ${uploaded.map(r=>esc(r.title)).join(', ')}</p></div>`:''}
    <div class="flex gap-4 flex-1 min-h-0">
      <div class="flex-1 flex flex-col bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div class="flex-1 overflow-y-auto p-4 space-y-3" id="chat-scroll">${msgsHtml}${typingHtml}</div>
        <div class="border-t border-stone-100 p-3 flex-shrink-0">
          <div class="flex gap-2">
            <input id="chat-input" placeholder="Ask about your health, reports, symptoms…" class="flex-1 px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-base"/>
            <button id="chat-send" ${state.chatLoading?'disabled':''} class="px-4 py-3 text-white rounded-xl hover:opacity-90 disabled:opacity-40 flex-shrink-0" style="background:${C.teal}">${iconHtml('send',17)}</button>
          </div>
        </div>
      </div>
      <div class="hidden md:flex flex-col w-52 gap-2 flex-shrink-0">
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide">Quick Questions</p>
        <div class="flex-1 overflow-y-auto space-y-1.5">${QUICK_QUESTIONS.map(q=>`<button data-action="quick-question" data-q="${esc(q)}" class="w-full text-left text-xs p-2.5 bg-white border border-stone-100 rounded-xl hover:border-teal-300 hover:bg-teal-50 text-stone-600 transition-colors shadow-sm leading-relaxed">${q}</button>`).join('')}</div>
        <div class="p-3 bg-amber-50 rounded-xl border border-amber-100 flex-shrink-0"><p class="text-xs font-bold text-amber-800">⚠️ Remember</p><p class="text-xs text-amber-700 mt-1">Consult your doctor before changing medications.</p></div>
      </div>
    </div>
  </div>`;
}

async function sendChatMessage(text) {
  if (!text || !text.trim() || state.chatLoading) return;
  const m = currentMember();
  const uploaded = state.records.filter(r => r.source === 'upload');
  const recentDocs = uploaded.slice(0,5).map(r => `• ${r.title} (${fmtDate(r.date)}): ${r.summary}${r.extracted?.keyValues?.length?` — ${r.extracted.keyValues.slice(0,3).map(k=>`${k.name}: ${k.value} (${k.status})`).join(', ')}`:''}`).join('\n');
  const SYSTEM = `You are a warm AI health assistant (not a doctor).
Patient: ${m.name}, ${m.age}y ${m.gender||''}, Blood: ${m.blood||'unknown'}
Conditions: ${m.conditions.join(', ')||'none specified'}
Medications: ${m.medications.map(x=>`${x.name} ${x.dose} ${x.freq}`).join('; ')||'none'}
Allergies: ${m.allergies.join(', ')||'none'}
Vitals: BP ${m.bp} | Sugar ${m.sugar} | HbA1c ${m.hba1c} | Vit D ${m.vd} | BMI ${m.bmi||'?'}
Goals: ${m.goals.join('; ')||'none set'}
Location: India (Bangalore context)
${recentDocs?`\nUploaded documents:\n${recentDocs}`:'\nNo uploaded documents yet.'}

Style: Warm, practical, 2-4 short paragraphs max. Plain English. Indian food/brand context. 🌿 for Ayurvedic tips. Always recommend doctor for treatment changes.`;

  state.chatMsgs.push({ role: 'user', content: text });
  setState({ chatLoading: true });
  scrollChatToBottom();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: SYSTEM, messages: state.chatMsgs.map(x => ({ role: x.role, content: x.content })) })
    });
    const d = await res.json();
    state.chatMsgs.push({ role: 'assistant', content: d.content?.[0]?.text || 'Sorry, please try again.' });
  } catch {
    state.chatMsgs.push({ role: 'assistant', content: 'Connection error. Please retry.' });
  }
  setState({ chatLoading: false });
  scrollChatToBottom();
}
function scrollChatToBottom() { setTimeout(() => { const el = document.getElementById('chat-scroll'); if (el) el.scrollTop = el.scrollHeight; }, 50); }

// ─────────────────────────────────────────
//  HEALTH METRICS
// ─────────────────────────────────────────
function renderMetrics() {
  const m = currentMember();
  const chartData = state.metrics.map(r => ({ date: r.date?.slice(5), sys: r.systolic, dia: r.diastolic })).filter(r => r.sys || r.dia);
  return `<div class="space-y-4 fade-in">
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Health Metrics</h1>
    <div class="rounded-2xl p-4 text-white" style="background:linear-gradient(135deg,${C.teal},${C.tealMd})">
      <p class="font-bold text-base mb-1">Connect Health Apps</p><p class="text-xs mb-3" style="color:#b2e0eb">Auto-sync steps, heart rate, sleep — coming soon</p>
      <div class="flex gap-2"><button class="px-3.5 py-2 bg-white font-bold rounded-xl text-xs hover:bg-stone-50" style="color:${C.teal}">🍎 Apple Health</button><button class="px-3.5 py-2 font-bold rounded-xl text-xs border" style="border-color:rgba(255,255,255,0.4);color:white">🤖 Google Fit</button></div>
    </div>
    ${cardOpen('p-4')}
      <p class="font-bold text-stone-900 mb-3">Log Today's Vitals</p>
      <div class="grid grid-cols-3 gap-2 mb-3">
        ${[{l:'Systolic BP',k:'systolic',ph:'e.g. 135'},{l:'Diastolic BP',k:'diastolic',ph:'e.g. 85'},{l:'Weight (kg)',k:'weight',ph:'e.g. 79'},{l:'Steps',k:'steps',ph:'e.g. 7500'},{l:'Sleep (hrs)',k:'sleep',ph:'e.g. 7'},{l:'Heart Rate',k:'heartRate',ph:'e.g. 72'}].map(f=>`
          <div><label class="text-xs font-bold text-stone-400 mb-1 block">${f.l}</label><input id="metric-${f.k}" type="number" placeholder="${f.ph}" class="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>`).join('')}
      </div>
      <button id="metric-save" class="w-full py-2.5 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}" ${state.metricsSaving?'disabled':''}>${state.metricsSaving?spinnerHtml(15,'text-white'):''}${state.metricsSaving?'Saving…':'Save Vitals'}</button>
    </div>
    ${chartData.length>0?`${cardOpen('p-4')}<p class="font-bold text-stone-900 mb-3">Blood Pressure Trend</p><canvas id="chart-metrics-bp" height="180"></canvas></div>`
      : `${cardOpen('p-8 text-center text-stone-400')}${iconHtml('activity',32,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No metrics yet</p><p class="text-sm mt-1">Log your vitals above to see trends</p></div>`}
    ${cardOpen('p-4')}
      <div class="flex items-center gap-2 mb-3">${iconHtml('star',16,'text-amber-500')}<p class="font-bold text-stone-900">Must-Track at Age ${m.age||'—'}</p></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${[{m:'Blood Pressure – daily',r:'Critical for hypertension management',lv:'critical'},{m:'HbA1c – every 3 months',r:'Pre-diabetic monitoring',lv:'critical'},{m:'LDL Cholesterol – every 6m',r:'Cardiovascular risk',lv:'important'},{m:'Sleep quality – nightly',r:'Affects BP + insulin sensitivity',lv:'recommended'},{m:'Waist circumference – monthly',r:'Metabolic syndrome risk',lv:'recommended'},{m:'Resting heart rate – weekly',r:'Cardiac fitness proxy',lv:'recommended'}].map(it=>`
          <div class="p-3 rounded-xl border ${it.lv==='critical'?'bg-rose-50 border-rose-100':it.lv==='important'?'bg-amber-50 border-amber-100':'bg-stone-50 border-stone-100'}"><p class="text-sm font-bold text-stone-800">${it.m}</p><p class="text-xs text-stone-500 mt-0.5">${it.r}</p></div>`).join('')}
      </div>
    </div>
  </div>`;
}
function mountMetricsChart() {
  const ctx = document.getElementById('chart-metrics-bp');
  if (!ctx) return;
  destroyChart('chart-metrics-bp');
  const chartData = state.metrics.map(r => ({ date: r.date?.slice(5), sys: r.systolic, dia: r.diastolic })).filter(r => r.sys || r.dia);
  chartRegistry['chart-metrics-bp'] = new Chart(ctx, {
    type: 'line',
    data: { labels: chartData.map(d=>d.date), datasets: [
      { label:'Systolic', data: chartData.map(d=>d.sys), borderColor:'#DC2626', backgroundColor:'#DC2626', tension:0.3 },
      { label:'Diastolic', data: chartData.map(d=>d.dia), borderColor:C.teal, backgroundColor:C.teal, tension:0.3 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, scales:{y:{min:60,max:170}} }
  });
}
async function handleSaveMetric() {
  const val = id => { const v = document.getElementById(id)?.value; return v ? +v : null; };
  setState({ metricsSaving: true });
  try {
    const m = currentMember();
    await db.addMetric(state.session.user.id, { memberId: m.id, date: new Date().toISOString().split('T')[0], systolic: val('metric-systolic'), diastolic: val('metric-diastolic'), weight: val('metric-weight'), steps: val('metric-steps'), sleep: val('metric-sleep'), heartRate: val('metric-heartRate') });
    const metrics = await db.getMetrics(m.id);
    setState({ metrics, metricsSaving: false });
    showToast('Vitals saved ✓');
  } catch { setState({ metricsSaving: false }); }
}

// ─────────────────────────────────────────
//  FAMILY OVERVIEW
// ─────────────────────────────────────────
function renderFamily() {
  return `<div class="space-y-4 fade-in">
    ${renderAddMemberModal()}
    <div class="flex items-center justify-between"><h1 class="text-xl md:text-2xl font-bold text-stone-900">Family Health</h1><button data-action="open-addmember" class="flex items-center gap-2 px-3 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Add Member</button></div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${state.members.map(m => `
        <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow" data-action="switch-member" data-id="${m.id}">
          <div class="flex items-center gap-3 mb-4"><div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-black flex-shrink-0" style="background:${m.color}">${m.avatar}</div><div><p class="font-bold text-stone-900">${esc(m.name)}</p><p class="text-xs text-stone-400">${esc(m.role)} · ${m.age||'?'}y · ${m.blood||'?'}</p></div></div>
          <div class="flex items-center gap-3 mb-3">${scoreArcSvg(m.score,80)}<div class="text-sm"><p class="text-xs text-stone-400">BP</p><p class="font-bold text-stone-900">${esc(m.bp)}</p><p class="text-xs text-stone-400 mt-1">BMI</p><p class="font-bold text-stone-900">${m.bmi||'—'}</p></div></div>
          ${m.conditions.length>0?`<div class="space-y-1 mb-3">${m.conditions.slice(0,3).map(c=>`<div class="flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div><span class="text-xs text-stone-600">${esc(c)}</span></div>`).join('')}</div>`:''}
          ${m.nextVisit?`<div class="pt-3 border-t border-stone-100"><p class="text-xs text-stone-400">Next visit: <span class="font-bold text-stone-700">${fmtDate(m.nextVisit)}</span></p></div>`:''}
          <button class="mt-3 w-full py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90" style="background:${m.color}">Open Dashboard →</button>
        </div>`).join('')}
      <div class="border-2 border-dashed border-stone-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-teal-300 hover:bg-teal-50 transition-all cursor-pointer min-h-48" data-action="open-addmember">
        <div class="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">${iconHtml('plus',22,'text-stone-400')}</div>
        <div class="text-center"><p class="font-bold text-stone-600">Add Family Member</p><p class="text-xs text-stone-400 mt-1">Parents, siblings, children</p></div>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────
const NAV = [
  { id:'dashboard', label:'Dashboard', icon:'home' },
  { id:'records', label:'Medical Records', icon:'file-text' },
  { id:'healthplan', label:'Health Plan', icon:'target' },
  { id:'dailylog', label:'Daily Log', icon:'book-open' },
  { id:'spending', label:'Spending', icon:'dollar-sign' },
  { id:'aidoctor', label:'AI Doctor', icon:'brain', badge:'AI' },
  { id:'metrics', label:'Metrics', icon:'activity' },
  { id:'family', label:'Family', icon:'user' },
];
const MOBILE_MAIN = [
  { id:'dashboard', label:'Home', icon:'home' },
  { id:'records', label:'Records', icon:'file-text' },
  { id:'aidoctor', label:'AI Doctor', icon:'brain' },
  { id:'dailylog', label:'Log', icon:'pencil' },
];
const MOBILE_MORE = [
  { id:'healthplan', label:'Health Plan', icon:'target', desc:'Diet, meds, tests' },
  { id:'spending', label:'Spending', icon:'dollar-sign', desc:'Bills, savings' },
  { id:'metrics', label:'Metrics', icon:'activity', desc:'BP, weight, steps' },
  { id:'family', label:'Family', icon:'user', desc:'All members' },
];

function renderSidebar() {
  const open = state.sidebarOpen;
  return `<aside class="hidden md:flex flex-col flex-shrink-0 bg-white border-r border-stone-100 transition-all duration-200 z-20" style="width:${open?'13rem':'4rem'}">
    <div class="flex items-center gap-2.5 px-4 py-4 border-b border-stone-100 ${!open&&'justify-center'}">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${C.teal}">${iconHtml('heart',16,'text-white')}</div>
      ${open?'<span class="font-black text-stone-900 tracking-tight">HealthHub</span>':''}
    </div>
    <nav class="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
      ${NAV.map(n => `<button data-action="goto" data-page="${n.id}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${!open&&'justify-center'}" style="${state.page===n.id?`background:${C.teal};color:white`:'color:#a8a29e'}">
        ${iconHtml(n.icon,17)}${open?`<span>${n.label}</span>`:''}${open&&n.badge?`<span class="ml-auto text-white px-1.5 py-0.5 rounded-full font-black" style="background:#14b8a6;font-size:9px">${n.badge}</span>`:''}
      </button>`).join('')}
    </nav>
    <div class="p-2.5 border-t border-stone-100 space-y-0.5">
      <button data-action="toggle-sidebar" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-400 hover:bg-stone-50 text-sm ${!open&&'justify-center'}">${iconHtml('menu',16)}${open?'<span class="font-bold">Collapse</span>':''}</button>
      <button data-action="sign-out" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-300 hover:bg-stone-50 text-sm ${!open&&'justify-center'}">${iconHtml('log-out',16)}${open?'<span class="font-bold">Sign Out</span>':''}</button>
    </div>
  </aside>`;
}

function renderBottomNav() {
  return `<nav class="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100 flex md:hidden">
    ${MOBILE_MAIN.map(n => `<button data-action="goto" data-page="${n.id}" class="flex-1 flex flex-col items-center gap-0.5 py-2.5" style="color:${state.page===n.id?C.teal:'#94a3b8'}">${iconHtml(n.icon,20)}<span class="text-xs font-bold">${n.label}</span></button>`).join('')}
    <button data-action="open-more" class="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-stone-400">${iconHtml('more-horizontal',20)}<span class="text-xs font-bold">More</span></button>
  </nav>`;
}

function renderMoreSheet() {
  if (!state.moreSheetOpen) return '';
  return `<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:hidden" data-action="close-more">
    <div class="bg-white w-full rounded-t-3xl shadow-2xl p-5" onclick="event.stopPropagation()">
      <div class="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5"></div>
      <div class="space-y-2">${MOBILE_MORE.map(it => `<button data-action="goto-close-more" data-page="${it.id}" class="w-full flex items-center gap-4 p-3.5 rounded-2xl transition-colors ${state.page===it.id?'text-white':'bg-stone-50 hover:bg-stone-100'}" style="${state.page===it.id?`background:${C.teal}`:''}">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center ${state.page===it.id?'bg-white/20':'bg-white'}">${iconHtml(it.icon,18, state.page===it.id?'text-white':'')}</div>
        <div class="text-left"><p class="text-sm font-bold ${state.page===it.id?'text-white':'text-stone-800'}">${it.label}</p><p class="text-xs ${state.page===it.id?'text-white/70':'text-stone-400'}">${it.desc}</p></div>
      </button>`).join('')}</div>
      <button data-action="close-more" class="mt-4 w-full py-3 bg-stone-100 rounded-2xl text-sm font-bold text-stone-500">Close</button>
    </div>
  </div>`;
}

function renderHeader() {
  const m = currentMember();
  const memberMenuHtml = state.memberMenuOpen ? `
    <div class="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 z-50 w-72" onclick="event.stopPropagation()">
      <p class="text-xs font-black text-stone-400 uppercase tracking-wider px-3 py-1.5 mb-1">Family Members</p>
      ${state.members.map(mem => `<button data-action="switch-member" data-id="${mem.id}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors ${state.currentId===mem.id?'bg-teal-50':''}">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div>
        <div class="flex-1 text-left"><p class="text-sm font-bold text-stone-900">${esc(mem.name)}</p><p class="text-xs text-stone-400">${esc(mem.role)} · ${mem.age||'?'}y · Score ${mem.score}</p></div>
        ${state.currentId===mem.id?iconHtml('check-circle',15):''}
      </button>`).join('')}
      <div class="border-t border-stone-100 mt-2 pt-2"><button data-action="goto-close-membermenu" data-page="family" class="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl hover:bg-stone-50" style="color:${C.teal}">${iconHtml('plus',14)} Add Family Member</button></div>
    </div>` : '';
  return `<header class="bg-white border-b border-stone-100 px-4 md:px-5 h-14 flex items-center justify-between flex-shrink-0 z-20">
    <div class="relative" onclick="event.stopPropagation()">
      <button data-action="toggle-membermenu" class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style="background:${m.color}">${m.avatar}</div>
        <div class="text-left hidden sm:block"><p class="text-sm font-black text-stone-900 leading-tight">${esc(m.name)}</p><p class="text-xs text-stone-400 leading-tight">${esc(m.role)} · Score ${m.score}/100</p></div>
        <p class="text-sm font-black text-stone-900 sm:hidden">${esc(m.name.split(' ')[0])}</p>
        ${iconHtml('chevron-down',13,'text-stone-400')}
      </button>
      ${memberMenuHtml}
    </div>
    <div class="flex items-center gap-1">
      <button class="relative p-2.5 rounded-xl hover:bg-stone-50">${iconHtml('bell',18,'text-stone-400')}<span class="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"></span></button>
      <button class="p-2.5 rounded-xl hover:bg-stone-50 hidden md:flex">${iconHtml('settings',18,'text-stone-400')}</button>
      <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black ml-1" style="background:${m.color}">${m.avatar}</div>
    </div>
  </header>`;
}

function renderPageContent() {
  switch (state.page) {
    case 'dashboard': return renderDashboard();
    case 'records': return renderRecords();
    case 'healthplan': return renderHealthPlan();
    case 'dailylog': return renderDailyLog();
    case 'spending': return renderSpending();
    case 'aidoctor': return renderAIDoctor();
    case 'metrics': return renderMetrics();
    case 'family': return renderFamily();
    default: return renderDashboard();
  }
}

function renderMainApp() {
  return `<div class="flex h-screen bg-stone-50 overflow-hidden" id="app-root">
    ${renderSidebar()}
    <div class="flex-1 flex flex-col overflow-hidden">
      ${renderHeader()}
      <main class="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">${renderPageContent()}</main>
    </div>
    ${renderBottomNav()}
    ${renderMoreSheet()}
    ${toastHtml()}
  </div>`;
}

// ─────────────────────────────────────────
//  MASTER RENDER
// ─────────────────────────────────────────
function render() {
  const root = document.getElementById('root');
  if (state.authLoading) {
    root.innerHTML = `<div class="min-h-screen bg-stone-50 flex items-center justify-center"><div class="text-center"><div class="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style="background:${C.teal}">${iconHtml('heart',24,'text-white')}</div>${spinnerHtml(24)}<p class="text-stone-400 text-sm mt-3">Loading HealthHub…</p></div></div>`;
  } else if (!state.session) {
    root.innerHTML = renderAuthScreen();
  } else if (state.membersLoading) {
    root.innerHTML = `<div class="min-h-screen bg-stone-50 flex items-center justify-center"><div class="text-center">${spinnerHtml(28)}<p class="text-stone-400 text-sm mt-3">Loading your profile…</p></div></div>`;
  } else if (state.members.length === 0) {
    root.innerHTML = renderOnboarding();
  } else if (!currentMember()) {
    root.innerHTML = '';
  } else {
    root.innerHTML = renderMainApp();
  }
  if (window.lucide) lucide.createIcons();
  mountChartsForCurrentPage();
}

function mountChartsForCurrentPage() {
  if (!state.session || state.members.length === 0) return;
  if (state.page === 'dashboard') mountDashboardCharts();
  if (state.page === 'spending') mountSpendingCharts();
  if (state.page === 'metrics') mountMetricsChart();
}

// ─────────────────────────────────────────
//  EVENT DELEGATION  (single listener handles all clicks)
// ─────────────────────────────────────────
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    // close dropdowns when clicking outside
    if (state.memberMenuOpen && !e.target.closest('header')) setState({ memberMenuOpen: false });
    return;
  }
  const action = el.dataset.action;

  switch (action) {
    case 'auth-mode':
      setState({ authMode: el.dataset.mode, authError: '', authMessage: '' });
      break;
    case 'goto':
      setState({ page: el.dataset.page, memberMenuOpen: false, moreSheetOpen: false, recordSelectedId: null });
      break;
    case 'goto-close-more':
      setState({ page: el.dataset.page, moreSheetOpen: false });
      break;
    case 'goto-close-membermenu':
      setState({ page: el.dataset.page, memberMenuOpen: false });
      break;
    case 'toggle-sidebar':
      setState({ sidebarOpen: !state.sidebarOpen });
      break;
    case 'toggle-membermenu':
      setState({ memberMenuOpen: !state.memberMenuOpen });
      break;
    case 'switch-member':
      await switchMember(el.dataset.id);
      setState({ memberMenuOpen: false, page: 'dashboard' });
      break;
    case 'open-more':
      setState({ moreSheetOpen: true });
      break;
    case 'close-more':
      setState({ moreSheetOpen: false });
      break;
    case 'sign-out':
      await supabaseClient.auth.signOut();
      break;

    // ── Add Member ──
    case 'open-addmember':
      setState({ addMemberModal: true });
      break;
    case 'close-addmember':
      setState({ addMemberModal: false });
      break;

    // ── Upload Modal ──
    case 'open-upload':
      openUploadModal();
      setTimeout(wireUploadModalInputs, 30);
      break;
    case 'close-upload':
      closeUploadModal();
      break;
    case 'retry-upload':
      setState({ uploadModal: { phase: 'select', file: null, ext: null, pct: 0, progressMsg: '', errMsg: '', mismatchName: '', uploading: false } });
      setTimeout(wireUploadModalInputs, 30);
      break;
    case 'save-upload':
      saveUploadRecord(el.dataset.memberId);
      break;

    // ── Records ──
    case 'select-record':
      setState({ recordSelectedId: state.recordSelectedId === el.dataset.id ? null : el.dataset.id });
      break;
    case 'deselect-record':
      setState({ recordSelectedId: null });
      break;
    case 'filter-records':
      setState({ recordFilter: el.dataset.filter });
      break;
    case 'delete-record':
      await handleDeleteRecord(el.dataset.id);
      break;

    // ── Health Plan ──
    case 'plan-tab':
      setState({ planTab: el.dataset.tab });
      break;

    // ── Daily Log ──
    case 'toggle-symptom': {
      const s = el.dataset.symptom;
      const list = state.dailyLogDraft.symptoms;
      state.dailyLogDraft.symptoms = list.includes(s) ? list.filter(x => x !== s) : [...list, s];
      render();
      break;
    }

    // ── AI Doctor ──
    case 'quick-question': {
      const input = document.getElementById('chat-input');
      if (input) { input.value = el.dataset.q; input.focus(); }
      break;
    }

    default: break;
  }
});

// Click handlers that need direct binding after render (buttons identified by id, since they need .value reads)
document.addEventListener('click', async (e) => {
  if (e.target.id === 'auth-submit') handleAuthSubmit();
  if (e.target.id === 'ob-save') handleOnboardingSave();
  if (e.target.id === 'am-save') handleAddMemberSave();
  if (e.target.id === 'dl-save') handleSaveDailyLog();
  if (e.target.id === 'metric-save') handleSaveMetric();
  if (e.target.id === 'chat-send') {
    const input = document.getElementById('chat-input');
    if (input && input.value.trim()) { const text = input.value; input.value = ''; sendChatMessage(text); }
  }
});

// Enter-key handlers
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (e.target.id === 'auth-pw' || e.target.id === 'auth-email') { e.preventDefault(); handleAuthSubmit(); }
    if (e.target.id === 'chat-input' && !e.shiftKey) {
      e.preventDefault();
      const input = e.target;
      if (input.value.trim()) { const text = input.value; input.value = ''; sendChatMessage(text); }
    }
  }
});

// Live search input for records (debounced via input event)
document.addEventListener('input', (e) => {
  if (e.target.id === 'record-search-input') {
    state.recordSearch = e.target.value;
    // Light re-render: only update list, but for simplicity just re-render fully.
    // To preserve focus, we manually restore it after render.
    const cursorPos = e.target.selectionStart;
    render();
    const newInput = document.getElementById('record-search-input');
    if (newInput) { newInput.focus(); newInput.setSelectionRange(cursorPos, cursorPos); }
  }
  if (e.target.id === 'dl-feeling') {
    state.dailyLogDraft.feeling = +e.target.value;
    // Update just the emoji/label without full re-render to keep slider smooth
    const fi = feelInfo(state.dailyLogDraft.feeling);
    const container = e.target.closest('.mb-5');
    if (container) {
      const emojiEl = container.querySelector('.text-5xl');
      const labelEl = container.querySelector('p.text-sm.font-bold');
      if (emojiEl) emojiEl.textContent = fi.e;
      if (labelEl) { labelEl.textContent = `${fi.l} · ${state.dailyLogDraft.feeling}/10`; labelEl.className = `text-sm font-bold mt-1 ${fi.c}`; }
    }
  }
});

// Wire upload modal file inputs (dropzone click + camera + drag/drop)
function wireUploadModalInputs() {
  const fileInput = document.getElementById('upload-file-input');
  const camInput = document.getElementById('upload-camera-input');
  const dropzone = document.getElementById('upload-dropzone');
  const camBtn = document.getElementById('upload-camera-btn');
  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();
    dropzone.ondragover = (e) => e.preventDefault();
    dropzone.ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) runUploadAnalysis(f); };
  }
  if (fileInput) fileInput.onchange = (e) => { const f = e.target.files?.[0]; if (f) runUploadAnalysis(f); };
  if (camBtn && camInput) camBtn.onclick = () => camInput.click();
  if (camInput) camInput.onchange = (e) => { const f = e.target.files?.[0]; if (f) runUploadAnalysis(f); };
}

// ─────────────────────────────────────────
//  MEMBER / RECORD / LOG ACTIONS
// ─────────────────────────────────────────
async function switchMember(memberId) {
  setState({ currentId: memberId, records: [], logs: [], metrics: [] });
  await loadMemberData(memberId);
}
async function loadMemberData(memberId) {
  try {
    const [records, logs, metrics] = await Promise.all([db.getRecords(memberId), db.getLogs(memberId), db.getMetrics(memberId)]);
    setState({ records, logs, metrics });
  } catch (e) { console.error(e); }
}
async function handleDeleteRecord(id) {
  if (!confirm('Delete this record?')) return;
  setState({ recordDeleting: id });
  try {
    await db.deleteRecord(id);
    setState({ records: state.records.filter(r => r.id !== id), recordDeleting: null, recordSelectedId: state.recordSelectedId === id ? null : state.recordSelectedId });
  } catch { setState({ recordDeleting: null }); }
}

// ─────────────────────────────────────────
//  APP INITIALISATION
// ─────────────────────────────────────────
async function initApp() {
  render(); // show loading state immediately

  // Auth state listener
  supabaseClient.auth.onAuthStateChange((event, session) => {
    const wasLoggedIn = !!state.session;
    state.session = session;
    if (!wasLoggedIn && session) {
      loadMembersForSession(session);
    }
    if (!session) {
      setState({ members: [], currentId: null, records: [], logs: [], metrics: [], chatMsgs: [] });
    }
    render();
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  state.session = session;
  state.authLoading = false;
  if (session) {
    await loadMembersForSession(session);
  } else {
    render();
  }
}

async function loadMembersForSession(session) {
  setState({ membersLoading: true }, true);
  render();
  try {
    const members = await db.getMembers(session.user.id);
    state.members = members;
    state.membersLoading = false;
    if (members.length > 0) {
      state.currentId = members[0].id;
      await loadMemberData(members[0].id);
    }
  } catch (e) {
    console.error(e);
    state.membersLoading = false;
  }
  render();
}

// Boot the app
initApp();
