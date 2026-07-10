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

// AI requests go through our Supabase Edge Function (keeps the Anthropic key server-side).
// Derived automatically from the SUPABASE_URL you set in config.js.
const AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/ai`;
const AI_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY };

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
  page: 'home',
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
  recordsView: 'time',        // 'time' (month/year timeline) | 'episodes' (thread list)
  episodes: [],
  allRecords: [],             // family-wide records (all members) for the Records page
  allEpisodes: [],            // family-wide episodes
  allFollowups: [],           // family-wide follow-ups (dated next-actions)
  allMedicines: [],           // family-wide medicines
  allDoctors: [],             // family-wide doctors directory
  homeInsights: null,         // { content: {weeklyTip, members:[{mid,note,precautions}]}, generatedAt }
  homeGenerating: false,
  medicineEditor: null,       // add/edit medicine modal
  doctorEditor: null,         // add/edit doctor modal
  followupEditor: null,       // { id?, mid, title, kind, dueDate, notes } add/edit follow-up modal
  followupSaving: false,
  familyView: true,           // true = Whole Family (all pages); false = the single member in currentId
  lastUploadMemberId: null,   // remembers who the previous upload was filed to (default for next)
  uploadTargetId: null,       // the member selected in the upload "who is this for?" step
  memberEditor: null,         // { id?, name, role, age, gender, blood, ... } add/edit member modal
  memberSaving: false,
  memberMenuFor: null,        // memberId whose ⋯ menu is open on the Family page
  movePatientFor: null,       // recordId whose "change patient" picker is open
  editingRecordDate: null,    // recordId whose date is being edited inline
  editingRecordAmount: null,  // recordId whose amount is being edited inline
  spendFilter: 'all',         // Spending page claim-status filter
  compareModal: null,         // { canon } — trend comparison modal
  compareA: null, compareB: null,  // selected reading dates
  compareInsight: null, compareLoading: false,
  compareRepA: null, compareRepB: null,  // selected report ids for report-vs-report compare
  compareRun: false,          // whether to show the comparison result
  trendTest: null,            // selected test canon for the inline compare panel
  openEpisodeId: null,        // when viewing a single episode's detail
  fileModal: null,            // { recordId, proposedEpisodeId, proposedNewTitle, mode } for inline filing
  episodeEditor: null,        // { id?, mid, title, status, description } when creating/editing a thread
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
      archived: r.archived || false,
    }));
  },
  async updateMember(memberId, patch) {
    const upd = {};
    const map = { name:'name', role:'role', age:'age', gender:'gender', blood:'blood_group',
      height:'height', weight:'weight', bp:'bp', hba1c:'hba1c', vd:'vitamin_d', bmi:'bmi',
      doctor:'doctor', hospital:'hospital', insurance:'insurance', archived:'archived',
      conditions:'conditions', medications:'medications', allergies:'allergies', goals:'goals' };
    for (const k in patch) if (map[k]) upd[map[k]] = patch[k];
    const { error } = await supabaseClient.from('family_members').update(upd).eq('id', memberId);
    if (error) throw error;
  },
  async deleteMember(memberId) {
    // records, episodes, followups, lab_values referencing this member cascade-delete via FK.
    const { error } = await supabaseClient.from('family_members').delete().eq('id', memberId);
    if (error) throw error;
  },
  async getAllRecords(userId) {
    const { data, error } = await supabaseClient.from('medical_records').select('*').eq('owner_id', userId).order('date', { ascending: false });
    if (error) throw error;
    return data.map(r => ({
      id: r.id, mid: r.member_id, date: r.date, type: r.type, title: r.title,
      doctor: r.doctor, hospital: r.hospital, amount: r.amount, summary: r.summary,
      tags: r.tags || [], priority: r.priority || 'medium', source: r.source || 'manual',
      uploadedFile: r.uploaded_file_name, filePath: r.file_path,
      patientNameOnDoc: r.patient_name_on_doc, extracted: r.extracted_data || {},
      episodeId: r.episode_id || null, claimStatus: r.claim_status || 'none',
    }));
  },
  async getAllEpisodes(userId) {
    const { data, error } = await supabaseClient.from('episodes').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(e => ({
      id: e.id, mid: e.member_id, title: e.title, category: e.category,
      status: e.status || 'active', description: e.description,
      startedOn: e.started_on, color: e.color || C.teal,
    }));
  },
  // ── Follow-ups (dated next-actions) ──
  async getAllFollowups(userId) {
    const { data, error } = await supabaseClient.from('followups').select('*').eq('owner_id', userId).order('due_date', { ascending: true });
    if (error) throw error;
    return data.map(f => ({
      id: f.id, mid: f.member_id, episodeId: f.episode_id, title: f.title,
      kind: f.kind || 'test', dueDate: f.due_date, dateSource: f.date_source || 'explicit',
      status: f.status || 'pending', recurring: f.recurring || false, recurMonths: f.recur_months,
      completedOn: f.completed_on, completedRecordId: f.completed_record_id,
      notes: f.notes, sourceRecordId: f.source_record_id,
    }));
  },
  async addFollowup(userId, f) {
    const { data, error } = await supabaseClient.from('followups').insert([{
      owner_id: userId, member_id: f.mid, episode_id: f.episodeId || null, title: f.title,
      kind: f.kind || 'test', due_date: f.dueDate || null, date_source: f.dateSource || 'explicit',
      status: 'pending', recurring: f.recurring || false, recur_months: f.recurMonths || null,
      notes: f.notes || null, source_record_id: f.sourceRecordId || null,
    }]).select().single();
    if (error) throw error;
    return { id: data.id, mid: f.mid, episodeId: f.episodeId || null, title: f.title, kind: f.kind || 'test', dueDate: f.dueDate || null, dateSource: f.dateSource || 'explicit', status: 'pending', recurring: f.recurring || false, recurMonths: f.recurMonths || null, notes: f.notes || null, sourceRecordId: f.sourceRecordId || null };
  },
  async updateFollowup(id, patch) {
    const upd = {};
    const map = { title:'title', kind:'kind', dueDate:'due_date', status:'status', notes:'notes',
      recurring:'recurring', recurMonths:'recur_months', completedOn:'completed_on', completedRecordId:'completed_record_id' };
    for (const k in patch) if (map[k]) upd[map[k]] = patch[k];
    const { error } = await supabaseClient.from('followups').update(upd).eq('id', id);
    if (error) throw error;
  },
  async deleteFollowup(id) {
    const { error } = await supabaseClient.from('followups').delete().eq('id', id);
    if (error) throw error;
  },
  // ── Medicines ──
  async getAllMedicines(userId) {
    const { data, error } = await supabaseClient.from('medicines').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(m => ({ id:m.id, mid:m.member_id, name:m.name, dose:m.dose, freq:m.freq, timing:m.timing, purpose:m.purpose, active:m.active!==false, sourceRecordId:m.source_record_id }));
  },
  async addMedicine(userId, m) {
    const { data, error } = await supabaseClient.from('medicines').insert([{ owner_id:userId, member_id:m.mid, name:m.name, dose:m.dose||null, freq:m.freq||null, timing:m.timing||null, purpose:m.purpose||null, active:true, source_record_id:m.sourceRecordId||null }]).select().single();
    if (error) throw error;
    return { id:data.id, mid:m.mid, name:m.name, dose:m.dose, freq:m.freq, timing:m.timing, purpose:m.purpose, active:true };
  },
  async updateMedicine(id, patch) {
    const upd = {}; const map = { name:'name', dose:'dose', freq:'freq', timing:'timing', purpose:'purpose', active:'active' };
    for (const k in patch) if (map[k]) upd[map[k]] = patch[k];
    const { error } = await supabaseClient.from('medicines').update(upd).eq('id', id);
    if (error) throw error;
  },
  async deleteMedicine(id) {
    const { error } = await supabaseClient.from('medicines').delete().eq('id', id);
    if (error) throw error;
  },
  // ── Doctors ──
  async getAllDoctors(userId) {
    const { data, error } = await supabaseClient.from('doctors').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(d => ({ id:d.id, name:d.name, specialty:d.specialty, hospital:d.hospital, phone:d.phone, notes:d.notes }));
  },
  async addDoctor(userId, d) {
    const { data, error } = await supabaseClient.from('doctors').insert([{ owner_id:userId, name:d.name, specialty:d.specialty||null, hospital:d.hospital||null, phone:d.phone||null, notes:d.notes||null }]).select().single();
    if (error) throw error;
    return { id:data.id, name:d.name, specialty:d.specialty, hospital:d.hospital, phone:d.phone, notes:d.notes };
  },
  async updateDoctor(id, patch) {
    const upd = {}; const map = { name:'name', specialty:'specialty', hospital:'hospital', phone:'phone', notes:'notes' };
    for (const k in patch) if (map[k]) upd[map[k]] = patch[k];
    const { error } = await supabaseClient.from('doctors').update(upd).eq('id', id);
    if (error) throw error;
  },
  async deleteDoctor(id) {
    const { error } = await supabaseClient.from('doctors').delete().eq('id', id);
    if (error) throw error;
  },
  // ── Home weekly insights ──
  async getHomeInsights(userId) {
    const { data, error } = await supabaseClient.from('home_insights').select('*').eq('owner_id', userId).maybeSingle();
    if (error) throw error;
    return data ? { content: data.content, generatedAt: data.generated_at } : null;
  },
  async saveHomeInsights(userId, content) {
    const { error } = await supabaseClient.from('home_insights').upsert([{ owner_id: userId, content, generated_at: new Date().toISOString() }], { onConflict: 'owner_id' });
    if (error) throw error;
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
      episodeId: r.episode_id || null, claimStatus: r.claim_status || 'none',
    }));
  },
  async addRecord(userId, rec) {
    const { data, error } = await supabaseClient.from('medical_records').insert([{
      owner_id: userId, member_id: rec.mid, date: rec.date, type: rec.type, title: rec.title,
      doctor: rec.doctor || null, hospital: rec.hospital || null, amount: rec.amount || null,
      summary: rec.summary, tags: rec.tags || [], priority: rec.priority || 'medium',
      source: rec.source || 'manual', uploaded_file_name: rec.uploadedFile || null,
      file_path: rec.filePath || null, extracted_data: rec.extracted || {},
      patient_name_on_doc: rec.patientNameOnDoc || null, episode_id: rec.episodeId || null,
    }]).select().single();
    if (error) throw error;
    return { ...rec, id: data.id };
  },
  async deleteRecord(recordId) {
    const { error } = await supabaseClient.from('medical_records').delete().eq('id', recordId);
    if (error) throw error;
  },
  async setRecordEpisode(recordId, episodeId) {
    const { error } = await supabaseClient.from('medical_records').update({ episode_id: episodeId || null }).eq('id', recordId);
    if (error) throw error;
  },
  async setRecordMember(recordId, memberId) {
    // Threads are family-level folders, so moving a record to another person keeps its thread.
    const { error } = await supabaseClient.from('medical_records').update({ member_id: memberId }).eq('id', recordId);
    if (error) throw error;
  },
  async updateRecordFields(recordId, patch) {
    const upd = {};
    const map = { date:'date', title:'title', doctor:'doctor', hospital:'hospital', amount:'amount', summary:'summary', claimStatus:'claim_status' };
    for (const k in patch) if (map[k]) upd[map[k]] = patch[k];
    const { error } = await supabaseClient.from('medical_records').update(upd).eq('id', recordId);
    if (error) throw error;
  },
  // ── Episodes ──
  async getEpisodes(memberId) {
    const { data, error } = await supabaseClient.from('episodes').select('*').eq('member_id', memberId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(e => ({
      id: e.id, mid: e.member_id, title: e.title, category: e.category,
      status: e.status || 'active', description: e.description,
      startedOn: e.started_on, color: e.color || C.teal,
    }));
  },
  async addEpisode(userId, ep) {
    const { data, error } = await supabaseClient.from('episodes').insert([{
      owner_id: userId, member_id: null, title: ep.title, category: ep.category || null,
      status: ep.status || 'active', description: ep.description || null,
      color: ep.color || C.teal,
    }]).select().single();
    if (error) throw error;
    return { id: data.id, mid: null, title: ep.title, category: ep.category, status: ep.status || 'active', description: ep.description, startedOn: data.started_on, color: ep.color || C.teal };
  },
  async updateEpisode(episodeId, patch) {
    const upd = {};
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.description !== undefined) upd.description = patch.description;
    if (patch.category !== undefined) upd.category = patch.category;
    const { error } = await supabaseClient.from('episodes').update(upd).eq('id', episodeId);
    if (error) throw error;
  },
  async deleteEpisode(episodeId) {
    // records referencing it are set null automatically by the FK (on delete set null)
    const { error } = await supabaseClient.from('episodes').delete().eq('id', episodeId);
    if (error) throw error;
  },
  async uploadFile(file, userId) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from('medical-documents').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return path;
  },
  async getSignedUrl(filePath) {
    // Creates a temporary (1 hour) private link to view/download the original file
    const { data, error } = await supabaseClient.storage.from('medical-documents').createSignedUrl(filePath, 3600);
    if (error) throw error;
    return data.signedUrl;
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
  "threadTopic": "a short 1-3 word condition/topic folder name, person-agnostic and reusable across the family (e.g. 'Liver', 'Diabetes', 'Knee Replacement', 'Thyroid', 'Cardiac'). Prefer a broad ongoing topic over a one-time event. null if truly a one-off.",
  "medications": [{"name":"","dose":"","freq":"","duration":"","purpose":""}],
  "keyValues": [{"name":"","std":"standardized short test name so the same test matches across labs — use exactly one of: ALT, AST, GGT, ALP, Total Bilirubin, Direct Bilirubin, Creatinine, Urea, Uric Acid, HbA1c, Fasting Glucose, PP Glucose, Total Cholesterol, HDL, LDL, Triglycerides, TSH, T3, T4, Free T3, Free T4, Hemoglobin, Platelets, WBC, Vitamin D, Vitamin B12, ESR, CRP, INR — if none fit, repeat the test name as-is","value":"","status":"normal|high|low|critical|borderline","normal":""}],
  "advice": "lifestyle/diet instructions or null",
  "followup": "next visit/test instructions or null",
  "followUpDate": "YYYY-MM-DD if the document states or clearly implies a specific next date/deadline, else null",
  "followUpTitle": "short action label for the next step, e.g. 'Repeat LFT', 'Cardiology review', 'Echocardiogram' or null",
  "tags": ["2-3 short relevant tags, max 3"],
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
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST', headers: AI_HEADERS,
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
  setState({ uploadModal: { phase: 'select', uploadMode: 'ai', file: null, ext: null, pct: 0, progressMsg: '', errMsg: '', mismatchName: '', uploading: false } });
}
function closeUploadModal() { setState({ uploadModal: null }); }

async function runUploadAnalysis(file) {
  setState({ uploadModal: { ...state.uploadModal, phase: 'analysing', file, pct: 5, progressMsg: 'Reading your file…' } });
  let si = 0;
  const tick = setInterval(() => {
    si = Math.min(si + 1, PROGRESS_STEPS.length - 1);
    // Update only the progress DOM nodes in place — avoids a full re-render that makes the page jump
    state.uploadModal.pct = PROGRESS_STEPS[si].pct;
    state.uploadModal.progressMsg = PROGRESS_STEPS[si].msg;
    const bar = document.getElementById('upload-progress-bar');
    const msg = document.getElementById('upload-progress-msg');
    if (bar) bar.style.width = PROGRESS_STEPS[si].pct + '%';
    if (msg) msg.textContent = PROGRESS_STEPS[si].msg;
  }, 1000);
  try {
    const extracted = await analyseDocument(file);
    clearInterval(tick);
    // Smart default for "who is this for?": AI name match → last-used member → current
    let targetId = state.lastUploadMemberId || state.currentId;
    let aiMatchId = null;
    if (extracted.patientName) {
      const match = state.members.find(mm => nameMatches(extracted.patientName, mm.name));
      if (match) { aiMatchId = match.id; targetId = match.id; }
    }
    setState({ uploadModal: { ...state.uploadModal, phase: 'review', ext: extracted, pct: 100, aiMatchId }, uploadTargetId: targetId });
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
    // Remember this member as the default for the next upload
    state.lastUploadMemberId = memberId;
    // If the AI found a next-action, create a follow-up (marked suggested unless a firm date was given)
    if (ext.followUpTitle || ext.followUpDate || ext.followup) {
      try {
        await db.addFollowup(state.session.user.id, {
          mid: memberId,
          title: ext.followUpTitle || ext.followup || 'Follow-up',
          kind: 'review',
          dueDate: ext.followUpDate || null,
          dateSource: ext.followUpDate ? 'explicit' : 'suggested',
          notes: ext.followup && ext.followUpTitle ? ext.followup : null,
          sourceRecordId: saved.id,
        });
      } catch (e) { /* non-fatal */ }
    }
    // If the AI extracted medications, add them to this member's medicine list (dedupe by name)
    if (Array.isArray(ext.medications) && ext.medications.length) {
      try {
        const existing = (state.allMedicines || []).filter(x => x.mid === memberId).map(x => (x.name||'').toLowerCase().trim());
        for (const med of ext.medications) {
          const nm = (med.name || '').trim();
          if (!nm || existing.includes(nm.toLowerCase())) continue;
          await db.addMedicine(state.session.user.id, {
            mid: memberId, name: nm, dose: med.dose || null, freq: med.freq || null,
            timing: med.duration || null, purpose: med.purpose || null, sourceRecordId: saved.id,
          });
          existing.push(nm.toLowerCase());
        }
      } catch (e) { /* non-fatal */ }
    }
    // Switch active profile to the filed member so its episodes are in context for threading
    if (memberId !== state.currentId) { await switchMember(memberId); }
    // Refresh family-wide records so the Records page shows the new doc immediately
    await loadFamilyData();
    setState({ records: [saved, ...state.records.filter(r => r.id !== saved.id)], uploadModal: null });
    showToast(`"${saved.title}" saved ✓`);
    // AI proposes a thread: match against existing episodes, else propose new from diagnosis
    proposeEpisodeForRecord(saved, ext);
  } catch (e) {
    setState({ uploadModal: { ...um, uploading: false, phase: 'error', errMsg: e.message } });
  }
}

// Save a manually-entered record (no AI). Used when AI fails/credit is out, or the user chooses to type it.
async function handleSaveManual() {
  const um = state.uploadModal;
  const memberId = state.uploadTargetId;
  if (!memberId) { showToast('Please pick a person'); return; }
  const val = k => document.getElementById('man-' + k)?.value;
  const title = (val('title') || '').trim();
  const date = val('date');
  if (!title) { showToast('Please enter a title'); return; }
  if (!date) { showToast('Please enter a date'); return; }
  setState({ uploadModal: { ...um, uploading: true } });
  try {
    let filePath = null, fileName = null;
    if (um.file) {
      filePath = await db.uploadFile(um.file, state.session.user.id);
      fileName = um.file.name;
    }
    const amount = val('amount') ? parseFloat(val('amount')) : null;
    const type = val('type') || 'report';
    const rec = {
      mid: memberId, date, type, title,
      doctor: (val('doctor') || '').trim() || null, hospital: (val('hospital') || '').trim() || null,
      amount, summary: (val('summary') || '').trim(), tags: [], priority: 'medium',
      source: 'manual', uploadedFile: fileName, filePath, extracted: {},
    };
    const saved = await db.addRecord(state.session.user.id, rec);
    state.lastUploadMemberId = memberId;
    if (memberId !== state.currentId) { await switchMember(memberId); }
    await loadFamilyData();
    setState({ records: [saved, ...state.records.filter(r => r.id !== saved.id)], uploadModal: null });
    showToast(`"${title}" saved ✓`);
    // Offer to file into a thread
    proposeEpisodeForRecord(saved, { threadTopic: '', diagnosis: title, tags: [] });
  } catch (e) {
    setState({ uploadModal: { ...um, uploading: false, phase: 'error', errMsg: e.message || 'Could not save' } });
  }
}


// Match logic: if the diagnosis/tags/title strongly overlap an existing episode's
// title, pre-select it; otherwise propose creating a new thread named after the diagnosis.
function proposeEpisodeForRecord(saved, ext) {
  // Threads are family-level folders — match by name across ALL threads
  const eps = state.allEpisodes;
  const topic = (ext.threadTopic || '').trim();
  const hay = `${topic} ${ext.diagnosis || ''} ${(ext.tags || []).join(' ')} ${saved.title || ''}`.toLowerCase();
  // Prefer matching an existing folder by the clean topic, then by diagnosis/word overlap
  let match = null;
  if (topic) match = eps.find(ep => ep.title.toLowerCase() === topic.toLowerCase() || hay.includes(ep.title.toLowerCase()));
  if (!match) {
    match = eps.find(ep => {
      const words = ep.title.toLowerCase().split(/[\s/]+/).filter(w => w.length > 3);
      return words.some(w => hay.includes(w));
    });
  }
  if (match) {
    setState({ fileModal: { recordId: saved.id, proposedNewTitle: '', proposedMatchId: match.id } });
  } else {
    // Propose a clean folder name: threadTopic first, else a trimmed diagnosis
    let proposedNewTitle = topic;
    if (!proposedNewTitle && ext.diagnosis) proposedNewTitle = ext.diagnosis.length > 30 ? (ext.tags?.[0] || '') : ext.diagnosis;
    if (proposedNewTitle || eps.length) {
      setState({ fileModal: { recordId: saved.id, proposedNewTitle } });
    }
  }
}

function renderUploadModal() {
  const um = state.uploadModal;
  if (!um) return '';
  const m = currentMember();
  let body = '';

  if (um.phase === 'select') {
    const manual = um.uploadMode === 'manual';
    body = `
      <div class="space-y-3">
        <input type="file" id="upload-file-input" accept="image/*,.pdf,.heic,.heif" class="hidden"/>
        <input type="file" id="upload-camera-input" accept="image/*" capture="environment" class="hidden"/>

        <!-- AI vs Manual toggle -->
        <div class="inline-flex bg-stone-100 rounded-xl p-1 w-full">
          <button data-action="set-upload-mode" data-mode="ai" class="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5" style="${!manual?`background:white;color:${C.teal};box-shadow:0 1px 2px rgba(0,0,0,0.08)`:'color:#78716c'}">${iconHtml('sparkles',13)} AI reads it</button>
          <button data-action="set-upload-mode" data-mode="manual" class="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5" style="${manual?`background:white;color:${C.teal};box-shadow:0 1px 2px rgba(0,0,0,0.08)`:'color:#78716c'}">${iconHtml('pencil',13)} I'll enter details</button>
        </div>

        <div id="upload-dropzone" class="border-2 border-dashed border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer">
          <div class="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">${iconHtml('file-up', 28, 'text-stone-400')}</div>
          <div class="text-center"><p class="font-bold text-stone-800 text-sm">Tap to select · or drag a file here</p><p class="text-xs text-stone-400 mt-1">PDF, JPG, PNG, HEIC · Max 25 MB</p></div>
        </div>
        <button id="upload-camera-btn" class="w-full flex items-center justify-center gap-2.5 py-3.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors">
          ${iconHtml('camera', 18, 'text-teal-600')} Take a photo of document
        </button>
        ${manual
          ? `<div class="bg-teal-50 rounded-2xl p-4 border border-teal-100"><p class="text-xs text-teal-800 flex items-start gap-2">${iconHtml('info',13,'text-teal-600 flex-shrink-0 mt-0.5')} <span><strong>Manual mode:</strong> your file is stored, then you type the details yourself. AI won't run (saves cost, works even with no credit).</span></p>
              <button data-action="upload-manual" class="w-full text-center text-xs font-bold text-teal-700 hover:underline mt-2 pt-2 border-t border-teal-100">Skip file — just enter details</button>
            </div>`
          : `<div class="bg-stone-50 rounded-2xl p-4">
              <p class="text-xs font-bold text-stone-500 mb-3 flex items-center gap-1.5">${iconHtml('info',12)} AI reads any Indian medical document:</p>
              <div class="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-stone-500">
                ${['Handwritten prescriptions','Lab reports (any Indian lab)','Hospital bills & invoices','X-ray / MRI / CT reports','Discharge summaries','Hindi + English mixed text','iPhone photos at angle','Insurance documents'].map(x=>`<div class="flex items-start gap-1.5">${iconHtml('check',11,'text-emerald-500')}${x}</div>`).join('')}
              </div>
            </div>`
        }
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
        <div class="text-center"><p class="font-bold text-stone-900">AI is reading your document</p><p id="upload-progress-msg" class="text-sm text-stone-400 mt-1">${esc(um.progressMsg)}</p></div>
        <div class="w-full bg-stone-100 rounded-full h-2 overflow-hidden"><div id="upload-progress-bar" class="h-2 rounded-full transition-all duration-700" style="width:${um.pct}%;background:${C.teal}"></div></div>
        ${um.file ? `<div class="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-xl text-xs text-stone-500 w-full">${iconHtml('file-text',13)}<span class="truncate flex-1">${esc(um.file.name)}</span><span>${(um.file.size/1024).toFixed(0)} KB</span></div>` : ''}
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

        <!-- WHO IS THIS FOR? -->
        <div class="p-3 bg-white border-2 border-teal-200 rounded-2xl">
          <div class="flex items-center gap-1.5 mb-2">${iconHtml('user',13,'text-teal-600')}<p class="text-xs font-bold text-stone-700 uppercase tracking-wide">Who is this for?</p></div>
          ${um.ext.patientName ? `<p class="text-xs text-stone-400 mb-2">Document shows: <span class="font-semibold text-stone-600">${esc(um.ext.patientName)}</span>${um.aiMatchId?' · matched automatically':''}</p>` : ''}
          <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            ${activeMembers().map(mem => `<button data-action="set-upload-target" data-id="${mem.id}" class="flex items-center gap-2 px-3 py-2 rounded-xl border-2 whitespace-nowrap flex-shrink-0 ${state.uploadTargetId===mem.id?'border-teal-400 bg-teal-50':'border-stone-200 bg-white'}">
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${mem.color};font-size:10px;font-weight:800">${mem.avatar}</div>
              <span class="text-sm font-bold text-stone-800">${esc(mem.name.split(' ')[0])}</span>
              ${state.uploadTargetId===mem.id?iconHtml('check',13,'text-teal-600'):''}
            </button>`).join('')}
            <button data-action="upload-add-member" class="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 whitespace-nowrap flex-shrink-0">${iconHtml('plus',13)} <span class="text-sm font-bold">Add ${um.ext.patientName?esc(um.ext.patientName.split(' ')[0]):'member'}</span></button>
          </div>
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
          <button data-action="save-upload" data-member-id="${state.uploadTargetId||''}" ${um.uploading||!state.uploadTargetId?'disabled':''}
            class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}">
            ${um.uploading?spinnerHtml(15,'text-white'):''} ${um.uploading?'Saving…':(() => { const t = state.members.find(x=>x.id===state.uploadTargetId); return t?`Save to ${esc(t.name.split(' ')[0])}`:'Select a person'; })()}
          </button>
        </div>
      </div>`;
  } else if (um.phase === 'error') {
    body = `
      <div class="py-8 space-y-5 text-center">
        <div class="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">${iconHtml('alert-circle',28,'text-rose-500')}</div>
        <div><p class="font-bold text-stone-900">AI couldn't read this</p><p class="text-sm text-stone-400 mt-1.5 max-w-xs mx-auto">${esc(um.errMsg)}</p></div>
        <div class="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 text-left space-y-1">
          <p class="font-semibold">This can happen if the image is unclear, the file is large, or AI credit has run out. You can still save it — just type the details yourself.</p>
        </div>
        <div class="space-y-2">
          <button data-action="upload-manual" class="w-full py-3 text-white rounded-xl text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2" style="background:${C.teal}">${iconHtml('pencil',15)} Enter details manually</button>
          <div class="flex gap-3">
            <button data-action="close-upload" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
            <button data-action="retry-upload" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50">Retry AI</button>
          </div>
        </div>
      </div>`;
  } else if (um.phase === 'manual') {
    const d = um.manual || {};
    const fld = (id, label, ph='', type='text') => `<div><label class="block text-xs font-bold text-stone-500 mb-1">${label}</label><input id="man-${id}" type="${type}" value="${d[id]!=null?esc(String(d[id])):''}" placeholder="${ph}" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>`;
    body = `
      <div class="space-y-3">
        <input type="file" id="man-file-input" accept="image/*,.pdf,.heic,.heif" class="hidden"/>
        <input type="file" id="man-camera-input" accept="image/*" capture="environment" class="hidden"/>
        ${um.file
          ? `<div class="flex items-center gap-2 px-3 py-2.5 bg-teal-50 border border-teal-100 rounded-xl text-xs">${iconHtml('file-text',14,'text-teal-600')}<span class="truncate flex-1 font-semibold text-teal-800">${esc(um.file.name)}</span><span class="text-teal-600">${(um.file.size/1024).toFixed(0)} KB</span><button data-action="manual-remove-file" class="ml-1 text-stone-400 hover:text-rose-500">${iconHtml('x',14)}</button></div>`
          : `<div class="flex gap-2">
              <button id="man-file-btn" type="button" class="flex-1 flex items-center justify-center gap-2 py-2.5 border border-dashed border-stone-300 rounded-xl text-xs font-bold text-stone-500 hover:border-teal-400 hover:bg-teal-50">${iconHtml('paperclip',14)} Attach document</button>
              <button id="man-camera-btn" type="button" class="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-stone-300 rounded-xl text-xs font-bold text-stone-500 hover:border-teal-400 hover:bg-teal-50">${iconHtml('camera',14)}</button>
            </div>
            <p class="text-xs text-stone-400 -mt-1">Optional — the document is stored, but AI won't read it. You'll type the details below.</p>`
        }
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Who is this for? *</label>
          <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            ${activeMembers().map(mem => `<button data-action="set-upload-target" data-id="${mem.id}" class="flex items-center gap-2 px-3 py-2 rounded-xl border-2 whitespace-nowrap flex-shrink-0 ${state.uploadTargetId===mem.id?'border-teal-400 bg-teal-50':'border-stone-200 bg-white'}"><div class="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${mem.color};font-size:10px;font-weight:800">${mem.avatar}</div><span class="text-sm font-bold text-stone-800">${esc(mem.name.split(' ')[0])}</span>${state.uploadTargetId===mem.id?iconHtml('check',13,'text-teal-600'):''}</button>`).join('')}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${fld('title','Title *','e.g. LFT Report')}
          <div><label class="block text-xs font-bold text-stone-500 mb-1">Type</label>
            <select id="man-type" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
              ${[['report','Lab report'],['prescription','Prescription'],['bill','Bill / invoice'],['xray','X-ray / scan'],['discharge','Discharge'],['other','Consultation / other']].map(([v,l])=>`<option value="${v}" ${ (d.type||'report')===v?'selected':''}>${l}</option>`).join('')}
            </select></div>
          ${fld('date','Date *','','date')}
          ${fld('amount','Amount (₹)','e.g. 1250','number')}
          ${fld('doctor','Doctor','optional')}
          ${fld('hospital','Facility / lab','optional')}
        </div>
        <div><label class="block text-xs font-bold text-stone-500 mb-1">Note</label>
          <textarea id="man-summary" rows="2" placeholder="What is this document about?" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none">${esc(d.summary||'')}</textarea></div>
        <div class="flex gap-3 pt-1">
          <button data-action="close-upload" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
          <button id="man-save" ${um.uploading||!state.uploadTargetId?'disabled':''} class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}">${um.uploading?spinnerHtml(15,'text-white'):''} ${um.uploading?'Saving…':'Save Record'}</button>
        </div>
      </div>`;
  }

  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="upload-backdrop">
    <div class="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${C.teal}">${iconHtml('upload',16,'text-white')}</div>
          <div><p class="font-bold text-stone-900 text-sm">Upload Medical Record</p><p class="text-xs text-stone-400">AI reads it, then you choose who it's for</p></div>
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
function activeMembers() { return state.members.filter(x => !x.archived); }
function memberById(id) { return state.members.find(x => x.id === id); }

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

// ── Episode helpers ──
function episodeById(id) { return state.allEpisodes.find(e => e.id === id) || state.episodes.find(e => e.id === id); }
const EP_STATUS = {
  active:     { label: 'Active',     cls: 'bg-teal-50 text-teal-700' },
  monitoring: { label: 'Monitoring', cls: 'bg-amber-50 text-amber-700' },
  resolved:   { label: 'Resolved',   cls: 'bg-stone-100 text-stone-500' },
};
function epStatus(s) { return EP_STATUS[s] || EP_STATUS.active; }
// small pill shown on a document row indicating its thread (or "unfiled")
function episodeTagHtml(record) {
  const ep = record.episodeId ? episodeById(record.episodeId) : null;
  if (ep) {
    return `<button data-action="open-episode" data-id="${ep.id}" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold hover:opacity-80" style="background:${ep.color}1a;color:${ep.color}">${iconHtml('git-branch',10)}${esc(ep.title)}</button>`;
  }
  return `<button data-action="file-record" data-id="${record.id}" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-stone-100 text-stone-400 hover:bg-stone-200">${iconHtml('plus',10)} File to thread</button>`;
}
// group records by "Month YYYY"
function groupByMonth(records) {
  const groups = {};
  records.forEach(r => {
    const d = new Date(r.date);
    const key = isNaN(d) ? 'Undated' : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    (groups[key] = groups[key] || []).push(r);
  });
  return groups;
}

function renderRecords() {
  // When a single episode is open, show its detail view instead of the list.
  if (state.openEpisodeId) return renderEpisodeDetail();
  const m = currentMember();
  // Single control: Whole Family shows everyone; otherwise the selected member
  const scopeId = state.familyView ? null : state.currentId;
  const baseRecords = scopeId ? state.allRecords.filter(r => r.mid === scopeId) : state.allRecords;
  const filtered = baseRecords.filter(r =>
    (state.recordFilter === 'all' || r.type === state.recordFilter) &&
    (!state.recordSearch || r.title?.toLowerCase().includes(state.recordSearch.toLowerCase()) || r.summary?.toLowerCase().includes(state.recordSearch.toLowerCase()))
  );
  const sel = state.allRecords.find(r => r.id === state.recordSelectedId);
  const filterName = scopeId ? (memberById(scopeId)?.name || '') : 'Whole family';

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
        ${(() => { const mem = state.members.find(x => x.id === sel.mid); const ep = sel.episodeId ? episodeById(sel.episodeId) : null; return mem ? `<div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div><span class="text-sm font-bold text-stone-700">${esc(mem.name)}</span>${ep?`<span class="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style="background:${ep.color}1a;color:${ep.color}">${iconHtml('git-branch',10)}${esc(ep.title)}</span>`:''}</div>` : ''; })()}
        ${(() => { const ts = typeStyle(sel.type); return `<div class="flex items-center gap-2 px-3 py-2 rounded-xl ${ts.bg} ${ts.text} text-sm font-bold mb-3">${iconHtml(ts.icon,16)}<span>${ts.label}</span>${sel.source==='upload'?badgeHtml('AI','ml-auto bg-teal-100 text-teal-700 text-xs'):''}</div>`; })()}
        ${sel.filePath ? `<button data-action="view-original" data-id="${sel.id}" class="w-full mb-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white hover:opacity-90" style="background:${C.teal}">${iconHtml('file-text',15)} View original document</button>` : ''}
        <div class="space-y-2.5 text-sm">
          ${dateEditRowHtml(sel)}${amountEditRowHtml(sel)}${claimRowHtml(sel)}${[{l:'Doctor',v:sel.doctor},{l:'Facility',v:sel.hospital},{l:'File',v:sel.uploadedFile}].filter(x=>x.v).map(x=>`<div><p class="text-xs text-stone-400">${x.l}</p><p class="font-semibold text-stone-800">${esc(x.v)}</p></div>`).join('')}
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

  // Build the month/year grouped timeline (time view)
  const grouped = groupByMonth(filtered);
  const monthKeys = Object.keys(grouped);
  const timeListHtml = filtered.length === 0
    ? `<div class="text-center py-16 text-stone-400">${iconHtml('file-text',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">${state.recordSearch?'No records match':'No records yet'}</p>${!state.recordSearch?`<button data-action="open-upload" class="mt-4 px-5 py-2.5 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:opacity-90" style="background:${C.teal}">${iconHtml('upload',14)} Upload First Record</button>`:''}</div>`
    : monthKeys.map(month => `
      <div class="mb-5">
        <div class="flex items-center gap-2 mb-2 sticky top-0 bg-stone-50 py-1 z-10">
          <p class="text-xs font-black text-stone-400 uppercase tracking-wider">${month}</p>
          <div class="flex-1 h-px bg-stone-200"></div>
          <span class="text-xs text-stone-400">${grouped[month].length}</span>
        </div>
        <div class="space-y-3">
          ${grouped[month].map(r => {
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
            return `<div class="bg-white rounded-2xl p-3 border transition-all hover:shadow-md ${isSel?'border-teal-400 shadow-md':'border-stone-100 shadow-sm'}">
              <div class="flex items-start gap-3">
                <div class="p-2 rounded-xl ${ts.bg} ${ts.text} flex-shrink-0 cursor-pointer" data-action="select-record" data-id="${r.id}">${iconHtml(ts.icon,17)}</div>
                <div class="flex-1 min-w-0 cursor-pointer" data-action="select-record" data-id="${r.id}">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-bold text-stone-900 text-sm">${esc(r.title)}</p>
                    ${badgeHtml(r.priority, priBadge(r.priority)+' ml-auto')}
                  </div>
                  ${(() => { const mem = state.members.find(x => x.id === r.mid); return mem ? `<div class="flex items-center gap-1.5 mt-0.5"><div class="w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${mem.color};font-size:9px;font-weight:800">${mem.avatar}</div><span class="text-xs font-semibold text-stone-500">${esc(mem.name.split(' ')[0])}</span><span class="text-stone-300 text-xs">·</span><span class="text-xs text-stone-400">${fmtDate(r.date)}</span>${r.amount?`<span class="text-stone-300 text-xs">·</span><span class="text-xs text-stone-400">${fmtINR(r.amount)}</span>`:''}</div>` : ''; })()}
                  <p class="text-sm text-stone-600 line-clamp-1 mt-0.5">${esc(r.summary)}</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5 mt-2 flex-wrap pl-11">${episodeTagHtml(r)}${(r.tags||[]).slice(0,2).map(tag=>`<span class="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">${esc(tag)}</span>`).join('')}${(r.tags||[]).length>2?`<span class="text-xs text-stone-400 px-1">+${r.tags.length-2}</span>`:''}</div>
              ${mobileExpand}
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');

  // Episodes view: list of threads for this member
  // Threads are family folders. When filtered to a person, show only threads that contain
  // at least one of that person's documents; counts reflect the active scope.
  const threadDocs = (epId) => state.allRecords.filter(r => r.episodeId === epId && (!scopeId || r.mid === scopeId));
  const baseEpisodes = scopeId
    ? state.allEpisodes.filter(ep => state.allRecords.some(r => r.episodeId === ep.id && r.mid === scopeId))
    : state.allEpisodes;
  const episodesListHtml = baseEpisodes.length === 0
    ? `<div class="text-center py-16 text-stone-400">${iconHtml('git-branch',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No threads${scopeId?' for '+esc((memberById(scopeId)?.name||'').split(' ')[0]):' yet'}</p><p class="text-sm mt-1">Threads are shared folders — e.g. "Liver Management", "Diabetes" — that hold the whole family's documents on a topic.</p><button data-action="new-episode" class="mt-4 px-5 py-2.5 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Create First Thread</button></div>`
    : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${baseEpisodes.map(ep => {
        const docs = threadDocs(ep.id);
        const count = docs.length;
        const st = epStatus(ep.status);
        // distinct members with docs in this thread (family view shows who's involved)
        const memberIds = [...new Set(state.allRecords.filter(r => r.episodeId === ep.id).map(r => r.mid))];
        const avatars = memberIds.map(id => memberById(id)).filter(Boolean).slice(0, 4);
        return `<div class="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm hover:shadow-md cursor-pointer transition-all" data-action="open-episode" data-id="${ep.id}">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${ep.color}1a">${iconHtml('folder',17,'')}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2"><p class="font-bold text-stone-900 text-sm">${esc(ep.title)}</p>${badgeHtml(st.label, st.cls + ' ml-auto')}</div>
              ${!scopeId && avatars.length?`<div class="flex items-center gap-1 mt-1.5">${avatars.map(a=>`<div class="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0 ring-2 ring-white -ml-1 first:ml-0" style="background:${a.color};font-size:9px;font-weight:800" title="${esc(a.name)}">${a.avatar}</div>`).join('')}${memberIds.length>4?`<span class="text-xs text-stone-400 ml-1">+${memberIds.length-4}</span>`:''}</div>`:''}
              <p class="text-xs text-stone-400 mt-1.5">${count} document${count!==1?'s':''}${!scopeId&&memberIds.length>1?` · ${memberIds.length} people`:''}</p>
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;

  const isTime = state.recordsView === 'time';

  return `
  <div class="fade-in">
    ${sel ? `<div class="lg:hidden">${renderRecordDetailModal(sel)}</div>` : ''}
    <div class="flex gap-5">
      <div class="flex-1 min-w-0 space-y-4">
        <div class="flex items-center justify-between">
          <div><h1 class="text-xl md:text-2xl font-bold text-stone-900">Medical Records</h1><p class="text-xs text-stone-400 mt-0.5">${filtered.length} records · ${baseEpisodes.length} threads · ${esc(filterName)}</p></div>
          <button data-action="open-upload" class="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('upload',15)}<span class="hidden sm:inline">Upload Record</span><span class="sm:hidden">Upload</span></button>
        </div>

        <!-- Time / Episodes toggle -->
        <div class="flex items-center gap-2">
          <div class="inline-flex bg-stone-100 rounded-xl p-1">
            <button data-action="records-view" data-view="time" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors" style="${isTime?`background:white;color:${C.teal};box-shadow:0 1px 2px rgba(0,0,0,0.08)`:'color:#78716c'}">${iconHtml('calendar',13,'inline mr-1')} By Time</button>
            <button data-action="records-view" data-view="episodes" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors" style="${!isTime?`background:white;color:${C.teal};box-shadow:0 1px 2px rgba(0,0,0,0.08)`:'color:#78716c'}">${iconHtml('git-branch',13,'inline mr-1')} By Thread</button>
          </div>
          ${!isTime?`<button data-action="new-episode" class="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-stone-200 text-stone-600 hover:bg-stone-50">${iconHtml('plus',13)} New Thread</button>`:''}
        </div>

        ${isTime ? `
          <div class="relative">${iconHtml('search',15,'absolute left-3.5 top-3 text-stone-400')}
            <input id="record-search-input" value="${esc(state.recordSearch)}" placeholder="Search records…" class="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"/>
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            ${RECORD_TABS.map(t=>`<button data-action="filter-records" data-filter="${t.id}" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors" style="${state.recordFilter===t.id?`background:${C.teal};color:white`:'background:white;color:#78716c;border:1px solid #e7e5e4'}">${t.label}</button>`).join('')}
          </div>
          <div>${timeListHtml}</div>
        ` : `<div>${episodesListHtml}</div>`}
      </div>
      ${sidePanel}
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  EPISODE DETAIL VIEW  (the deep per-thread lens)
// ─────────────────────────────────────────
function renderEpisodeDetail() {
  const ep = episodeById(state.openEpisodeId);
  if (!ep) { state.openEpisodeId = null; return renderRecords(); }
  const scopeId = state.familyView ? null : state.currentId;
  // Family folder: all docs in the thread, narrowed to the person filter when one is active
  const docs = state.allRecords.filter(r => r.episodeId === ep.id && (!scopeId || r.mid === scopeId));
  const totalInThread = state.allRecords.filter(r => r.episodeId === ep.id).length;
  const memberIds = [...new Set(state.allRecords.filter(r => r.episodeId === ep.id).map(r => r.mid))];
  const scopeLabel = scopeId ? (memberById(scopeId)?.name.split(' ')[0] || '') : 'Whole family';
  const st = epStatus(ep.status);
  const grouped = groupByMonth(docs);

  const timelineHtml = docs.length === 0
    ? `<div class="text-center py-12 text-stone-400">${iconHtml('file-text',32,'mx-auto mb-2 opacity-30')}<p class="text-sm">No documents${scopeId?' for '+esc(scopeLabel):''} in this thread yet</p><p class="text-xs mt-1">File documents here from the "By Time" view, or on upload</p></div>`
    : Object.keys(grouped).map(month => `
      <div class="mb-4">
        <p class="text-xs font-black text-stone-400 uppercase tracking-wider mb-2">${month}</p>
        <div class="space-y-2">
          ${grouped[month].map(r => { const ts = typeStyle(r.type); const rm = memberById(r.mid); return `
            <div class="bg-white rounded-xl p-3 border border-stone-100 shadow-sm flex items-start gap-3">
              <div class="p-2 rounded-lg ${ts.bg} ${ts.text} flex-shrink-0 cursor-pointer" data-action="select-record" data-id="${r.id}">${iconHtml(ts.icon,15)}</div>
              <div class="flex-1 min-w-0 cursor-pointer" data-action="select-record" data-id="${r.id}">
                <p class="font-bold text-stone-900 text-sm">${esc(r.title)}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  ${rm?`<span class="inline-flex items-center gap-1"><span class="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${rm.color};font-size:8px;font-weight:800">${rm.avatar}</span><span class="text-xs font-semibold text-stone-500">${esc(rm.name.split(' ')[0])}</span></span><span class="text-stone-300 text-xs">·</span>`:''}
                  <span class="text-xs text-stone-400">${fmtDate(r.date)}</span>
                </div>
                <p class="text-xs text-stone-600 mt-0.5 line-clamp-1">${esc(r.summary)}</p>
              </div>
              <button data-action="unfile-record" data-id="${r.id}" title="Remove from thread" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-300 hover:text-rose-500">${iconHtml('x',14)}</button>
            </div>`; }).join('')}
        </div>
      </div>`).join('');

  return `
  <div class="fade-in max-w-3xl">
    ${(() => { const sel = anyRecord(state.recordSelectedId); return sel ? renderRecordDetailModal(sel) : ''; })()}
    <button data-action="close-episode" class="flex items-center gap-1.5 text-sm font-bold text-stone-400 hover:text-stone-600 mb-4">${iconHtml('arrow-left',15)} Back to records</button>

    <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-4">
      <div class="flex items-start gap-3">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${ep.color}1a">${iconHtml('folder',20,'')}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-lg font-bold text-stone-900">${esc(ep.title)}</h1>
            ${badgeHtml(st.label, st.cls)}
          </div>
          <p class="text-xs text-stone-400 mt-0.5">${scopeId?`${esc(scopeLabel)} · ${docs.length} of ${totalInThread} document${totalInThread!==1?'s':''}`:`${totalInThread} document${totalInThread!==1?'s':''}${memberIds.length>1?` · ${memberIds.length} people`:''}`}</p>
          ${ep.description?`<p class="text-sm text-stone-600 mt-2">${esc(ep.description)}</p>`:''}
        </div>
        <button data-action="edit-episode" data-id="${ep.id}" class="p-2 rounded-lg hover:bg-stone-100 text-stone-400" title="Edit thread">${iconHtml('pencil',15)}</button>
      </div>
      <div class="flex gap-2 mt-4 pt-4 border-t border-stone-100">
        <button data-action="edit-episode" data-id="${ep.id}" class="flex-1 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-1">${iconHtml('settings',13)} Edit / Status</button>
        <button data-action="delete-episode" data-id="${ep.id}" class="flex-1 py-2 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 flex items-center justify-center gap-1">${iconHtml('trash-2',13)} Delete Thread</button>
      </div>
    </div>

    <div class="mb-2 flex items-center gap-2">
      <p class="text-sm font-bold text-stone-700">Documents${scopeId?` · ${esc(scopeLabel)}`:''}</p>
      <div class="flex-1 h-px bg-stone-100"></div>
    </div>
    ${timelineHtml}
  </div>`;
}

// Editable document-date row (used in record detail). Lets you correct a mis-read date.
function dateEditRowHtml(sel) {
  if (state.editingRecordDate === sel.id) {
    return `<div class="p-2.5 bg-teal-50 rounded-xl">
      <p class="text-xs font-bold text-teal-700 mb-1.5">Edit document date</p>
      <div class="flex gap-2">
        <input id="record-date-input" type="date" value="${sel.date || ''}" class="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/>
        <button data-action="save-record-date" data-id="${sel.id}" class="px-3 py-2 rounded-lg text-xs font-bold text-white" style="background:${C.teal}">Save</button>
        <button data-action="cancel-record-date" class="px-3 py-2 rounded-lg text-xs font-bold border border-stone-200 text-stone-500">Cancel</button>
      </div>
    </div>`;
  }
  return `<div class="flex items-center justify-between"><div><p class="text-xs text-stone-400">Date</p><p class="font-semibold text-stone-800">${fmtDate(sel.date)}</p></div><button data-action="edit-record-date" data-id="${sel.id}" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400" title="Edit date">${iconHtml('pencil',13)}</button></div>`;
}

// Editable amount row (correct a mis-read bill, or add one manually — feeds Spending)
function amountEditRowHtml(sel) {
  if (state.editingRecordAmount === sel.id) {
    return `<div class="p-2.5 bg-teal-50 rounded-xl">
      <p class="text-xs font-bold text-teal-700 mb-1.5">Edit amount (₹)</p>
      <div class="flex gap-2">
        <input id="record-amount-input" type="number" value="${sel.amount!=null?sel.amount:''}" placeholder="e.g. 1250" class="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/>
        <button data-action="save-record-amount" data-id="${sel.id}" class="px-3 py-2 rounded-lg text-xs font-bold text-white" style="background:${C.teal}">Save</button>
        <button data-action="cancel-record-amount" class="px-3 py-2 rounded-lg text-xs font-bold border border-stone-200 text-stone-500">Cancel</button>
      </div>
      ${sel.amount!=null?`<button data-action="clear-record-amount" data-id="${sel.id}" class="text-xs font-bold text-rose-500 hover:underline mt-2">Remove from spending (keep document)</button>`:''}
    </div>`;
  }
  return `<div class="flex items-center justify-between"><div><p class="text-xs text-stone-400">Amount</p><p class="font-semibold text-stone-800">${sel.amount!=null?fmtINR(sel.amount):'—'}</p></div><button data-action="edit-record-amount" data-id="${sel.id}" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400" title="Edit amount">${iconHtml('pencil',13)}</button></div>`;
}

// Claim-status row for the record detail (only meaningful when there's an amount)
function claimRowHtml(sel) {
  if (sel.amount == null || sel.amount <= 0) return '';
  const cs = CLAIM_STATES[sel.claimStatus || 'none'];
  return `<div class="flex items-center justify-between">
    <div><p class="text-xs text-stone-400">Insurance</p><p class="font-semibold text-stone-800">${cs.label}</p></div>
    <button data-action="cycle-claim" data-id="${sel.id}" class="text-xs font-bold px-2.5 py-1 rounded-full ${cs.cls}" title="Tap to change">${cs.short === '—' ? 'Mark to claim' : 'Change'}</button>
  </div>`;
}

// A lightweight record-detail modal (used from episode view where there's no side panel)
function renderRecordDetailModal(sel) {
  const ts = typeStyle(sel.type);
  const mem = state.members.find(x => x.id === sel.mid);
  const ep = sel.episodeId ? episodeById(sel.episodeId) : null;
  const ex = sel.extracted || {};
  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="record-detail-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
      <div class="flex items-center justify-between mb-3"><p class="font-bold text-stone-900">Record Details</p><button data-action="deselect-record">${iconHtml('x',18,'text-stone-400')}</button></div>

      ${mem ? `<div class="flex items-center gap-2 mb-3">
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div>
        <span class="text-sm font-bold text-stone-700">${esc(mem.name)}</span>
        ${ep?`<span class="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style="background:${ep.color}1a;color:${ep.color}">${iconHtml('git-branch',10)}${esc(ep.title)}</span>`:''}
      </div>`:''}

      <div class="flex items-center gap-2 px-3 py-2 rounded-xl ${ts.bg} ${ts.text} text-sm font-bold mb-3">${iconHtml(ts.icon,16)}<span>${ts.label}</span>${sel.source==='upload'?badgeHtml('AI','ml-auto bg-teal-100 text-teal-700 text-xs'):''}</div>

      ${sel.filePath ? `<button data-action="view-original" data-id="${sel.id}" class="w-full mb-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white hover:opacity-90" style="background:${C.teal}">${iconHtml('file-text',15)} View original document</button>` : ''}

      <div class="space-y-2.5 text-sm">
        ${dateEditRowHtml(sel)}${amountEditRowHtml(sel)}${claimRowHtml(sel)}${[{l:'Doctor',v:sel.doctor},{l:'Facility',v:sel.hospital},{l:'File',v:sel.uploadedFile}].filter(x=>x.v).map(x=>`<div><p class="text-xs text-stone-400">${x.l}</p><p class="font-semibold text-stone-800">${esc(x.v)}</p></div>`).join('')}
      </div>
      ${sel.summary?`<div class="mt-3 p-3 bg-teal-50 rounded-xl"><p class="text-xs font-bold text-teal-700 mb-0.5">Summary</p><p class="text-sm text-teal-800">${esc(sel.summary)}</p></div>`:''}
      ${ex.diagnosis?`<div class="mt-3"><p class="text-xs text-stone-400">Diagnosis</p><p class="text-sm text-stone-800">${esc(ex.diagnosis)}</p></div>`:''}
      ${ex.keyValues?`<div class="mt-3"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1.5">Lab Values</p><div class="space-y-1.5">${ex.keyValues.map(kv=>`<div class="flex items-baseline justify-between px-2 py-1.5 rounded-lg ${kv.status==='critical'?'bg-rose-100':kv.status==='high'||kv.status==='low'?'bg-rose-50':kv.status==='borderline'?'bg-amber-50':'bg-stone-50'}"><span class="text-xs text-stone-500">${esc(kv.name)}</span><div class="text-right"><span class="text-sm font-bold ${statusColor(kv.status)}">${esc(kv.value)}</span>${kv.normal?`<p class="text-xs text-stone-400">ref: ${esc(kv.normal)}</p>`:''}</div></div>`).join('')}</div></div>`:''}
      ${ex.meds?`<div class="mt-3"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1.5">Medications</p>${ex.meds.map(med=>`<div class="flex items-center gap-2 text-sm mb-1">${iconHtml('pill',12,'text-teal-600')}<span class="text-stone-700">${esc(med)}</span></div>`).join('')}</div>`:''}
      ${ex.advice?`<div class="mt-3 p-2.5 bg-teal-50 rounded-xl"><p class="text-xs font-bold text-teal-700 mb-0.5">Advice</p><p class="text-xs text-teal-700">${esc(ex.advice)}</p></div>`:''}
      ${ex.followup?`<div class="mt-3 p-2.5 bg-amber-50 rounded-xl"><p class="text-xs font-bold text-amber-700 mb-0.5">Follow-up</p><p class="text-xs text-amber-700">${esc(ex.followup)}</p></div>`:''}
      ${ex.items?`<div class="mt-3 space-y-1">${ex.items.map(it=>`<div class="flex justify-between text-xs"><span class="text-stone-500">${esc(it.name)}</span><span class="font-semibold">${fmtINR(it.amt)}</span></div>`).join('')}${sel.amount?`<div class="flex justify-between text-sm font-bold border-t pt-1 mt-1"><span>Total</span><span>${fmtINR(sel.amount)}</span></div>`:''}</div>`:''}

      <div class="mt-4 flex gap-2">
        <button data-action="file-record" data-id="${sel.id}" class="flex-1 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-1">${iconHtml('git-branch',13)} Change thread</button>
        <button data-action="move-patient" data-id="${sel.id}" class="flex-1 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-1">${iconHtml('user',13)} Change person</button>
      </div>
      ${state.movePatientFor === sel.id ? `<div class="mt-2 p-2 bg-stone-50 rounded-xl">
        <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1.5 px-1">Move to</p>
        <div class="space-y-1">
          ${activeMembers().map(mm => `<button data-action="do-move-patient" data-record="${sel.id}" data-member="${mm.id}" class="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-white ${mm.id===sel.mid?'opacity-40 pointer-events-none':''}">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${mm.color};font-size:10px;font-weight:800">${mm.avatar}</div>
            <span class="text-sm font-semibold text-stone-700">${esc(mm.name)}</span>${mm.id===sel.mid?'<span class="text-xs text-stone-400 ml-auto">current</span>':''}
          </button>`).join('')}
        </div>
        <p class="text-xs text-stone-400 px-1 mt-1.5">The document keeps its thread — threads are shared family folders.</p>
      </div>` : ''}
      <div class="mt-2">
        <button data-action="delete-record" data-id="${sel.id}" class="w-full py-2 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 flex items-center justify-center gap-1">${state.recordDeleting===sel.id?spinnerHtml(12):iconHtml('trash-2',13)} Delete record</button>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  EPISODE EDITOR MODAL  (create / edit a thread)
// ─────────────────────────────────────────
function renderEpisodeEditor() {
  const ed = state.episodeEditor;
  if (!ed) return '';
  const isEdit = !!ed.id;
  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="episode-editor-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-stone-900 text-lg">${isEdit?'Edit Thread':'New Thread'}</h3>
        <button data-action="close-episode-editor">${iconHtml('x',18,'text-stone-400')}</button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Thread name *</label>
          <input id="ep-title" value="${esc(ed.title||'')}" placeholder="e.g. Liver Treatment, RHD / Cardiac, Knee Replacement" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/>
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Status</label>
          <div class="flex gap-2">
            ${['active','monitoring','resolved'].map(s=>`<button data-action="ep-editor-status" data-status="${s}" class="flex-1 py-2 rounded-xl text-xs font-bold border capitalize" style="${(ed.status||'active')===s?`background:${C.teal};color:white;border-color:${C.teal}`:'background:white;color:#78716c;border-color:#e7e5e4'}">${epStatus(s).label}</button>`).join('')}
          </div>
          <p class="text-xs text-stone-400 mt-1">Active = ongoing treatment · Monitoring = routine follow-ups · Resolved = closed</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Notes (optional)</label>
          <textarea id="ep-description" rows="2" placeholder="A short note about this thread" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none">${esc(ed.description||'')}</textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button data-action="close-episode-editor" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
        <button id="ep-save" class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90" style="background:${C.teal}">${isEdit?'Save Changes':'Create Thread'}</button>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  FILE-TO-THREAD MODAL  (assign a record to an episode)
// ─────────────────────────────────────────
function renderFileModal() {
  const fm = state.fileModal;
  if (!fm) return '';
  const rec = anyRecord(fm.recordId);
  if (!rec) return '';
  const owner = memberById(rec.mid);
  // Threads are family-level folders — any document can go in any thread
  const memberEpisodes = state.allEpisodes;
  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="file-modal-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl max-h-[85dvh] flex flex-col">
      <div class="flex items-center justify-between mb-1 flex-shrink-0">
        <h3 class="font-bold text-stone-900 text-lg">File to a thread</h3>
        <button data-action="close-file-modal">${iconHtml('x',18,'text-stone-400')}</button>
      </div>
      <p class="text-xs text-stone-400 mb-4 flex-shrink-0 truncate">${esc(rec.title)}${owner?` · ${esc(owner.name.split(' ')[0])}`:''}</p>
      <div class="overflow-y-auto flex-1 space-y-2">
        ${fm.proposedNewTitle ? `
          <p class="text-xs font-bold text-stone-400 uppercase tracking-wide">Suggested</p>
          <button data-action="file-to-new" class="w-full flex items-center gap-3 p-3 border-2 border-teal-400 bg-teal-50 rounded-xl text-left">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${C.teal}">${iconHtml('plus',15,'text-white')}</div>
            <div><p class="font-bold text-stone-900 text-sm">Create "${esc(fm.proposedNewTitle)}"</p><p class="text-xs text-stone-500">New thread</p></div>
          </button>
        ` : ''}
        <button data-action="file-to-new-blank" class="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-xl text-left hover:bg-stone-50">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${C.teal}">${iconHtml('plus',15,'text-white')}</div>
          <div><p class="font-bold text-stone-900 text-sm">${fm.proposedNewTitle ? 'Create a different thread…' : 'Create a new thread…'}</p><p class="text-xs text-stone-500">Name it yourself</p></div>
        </button>
        ${memberEpisodes.length ? `<p class="text-xs font-bold text-stone-400 uppercase tracking-wide pt-2">${fm.proposedMatchId?'Suggested & existing threads':'Existing threads'}</p>` : ''}
        ${[...memberEpisodes].sort((a,b) => (b.id===fm.proposedMatchId?1:0)-(a.id===fm.proposedMatchId?1:0)).map(ep => {
          const isSuggested = ep.id === fm.proposedMatchId;
          return `
          <button data-action="file-to-episode" data-id="${ep.id}" class="w-full flex items-center gap-3 p-3 border-2 rounded-xl text-left hover:bg-stone-50 ${isSuggested?'border-teal-400 bg-teal-50':rec.episodeId===ep.id?'border-teal-400 bg-teal-50':'border-stone-200'}">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${ep.color}1a">${iconHtml('git-branch',15,'')}</div>
            <div class="flex-1"><p class="font-bold text-stone-900 text-sm">${esc(ep.title)}</p><p class="text-xs text-stone-400">${epStatus(ep.status).label}</p></div>
            ${isSuggested?badgeHtml('Suggested','bg-teal-100 text-teal-700'):rec.episodeId===ep.id?iconHtml('check-circle',15):''}
          </button>`;}).join('')}
        <button data-action="file-to-none" class="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-xl text-left hover:bg-stone-50 text-stone-500">
          <div class="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">${iconHtml('minus',15,'text-stone-400')}</div>
          <div><p class="font-bold text-sm">No thread</p><p class="text-xs">Keep as a standalone document</p></div>
        </button>
      </div>
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
const CLAIM_STATES = {
  none:     { label:'Not insurance', short:'—',        cls:'bg-stone-100 text-stone-400', next:'to_claim' },
  to_claim: { label:'To claim',      short:'To claim', cls:'bg-amber-100 text-amber-700', next:'claimed' },
  claimed:  { label:'Claimed',       short:'Claimed',  cls:'bg-emerald-100 text-emerald-700', next:'none' },
};
const SPEND_FILTERS = [
  { id:'all', label:'All' },
  { id:'to_claim', label:'To claim' },
  { id:'claimed', label:'Claimed' },
  { id:'none', label:'Not insurance' },
];

function renderSpending() {
  const scopeId = state.familyView ? null : state.currentId;
  const scopeLabel = scopeId ? (memberById(scopeId)?.name.split(' ')[0] || '') : 'Whole family';
  // Only records that carry an amount are transactions
  let txns = state.allRecords.filter(r => r.amount != null && r.amount > 0 && (!scopeId || r.mid === scopeId));
  const filter = state.spendFilter || 'all';
  if (filter !== 'all') txns = txns.filter(r => (r.claimStatus || 'none') === filter);
  txns = txns.slice().sort((a,b) => new Date(b.date) - new Date(a.date));

  // Totals from the scope (before the claim filter, so the cards stay stable)
  const scoped = state.allRecords.filter(r => r.amount != null && r.amount > 0 && (!scopeId || r.mid === scopeId));
  const total = scoped.reduce((s,r) => s + r.amount, 0);
  const toClaim = scoped.filter(r => r.claimStatus === 'to_claim').reduce((s,r) => s + r.amount, 0);
  const now = new Date();
  const thisMonth = scoped.filter(r => { const d = new Date(r.date); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); }).reduce((s,r)=>s+r.amount,0);

  const grouped = {};
  txns.forEach(r => {
    const d = new Date(r.date);
    const key = isNaN(d) ? 'Undated' : d.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
    (grouped[key] = grouped[key] || []).push(r);
  });

  const listHtml = txns.length === 0
    ? `<div class="text-center py-16 text-stone-400">${iconHtml('receipt',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No spending recorded${filter!=='all'?' in this filter':''}</p><p class="text-sm mt-1">Amounts from your bills show here. Add or edit an amount on any record.</p></div>`
    : Object.keys(grouped).map(month => {
        const items = grouped[month];
        const monthTotal = items.reduce((s,r)=>s+r.amount,0);
        return `<div class="mb-4">
          <div class="flex items-center gap-2 mb-2">
            <p class="text-xs font-black text-stone-400 uppercase tracking-wider">${month}</p>
            <div class="flex-1 h-px bg-stone-100"></div>
            <p class="text-xs font-bold text-stone-500">${fmtINR(monthTotal)}</p>
          </div>
          <div class="space-y-2">
            ${items.map(r => { const mem = memberById(r.mid); const cs = CLAIM_STATES[r.claimStatus||'none']; const ts = typeStyle(r.type); return `
              <div class="bg-white rounded-xl p-3 border border-stone-100 shadow-sm flex items-center gap-3">
                <div class="p-2 rounded-lg ${ts.bg} ${ts.text} flex-shrink-0 cursor-pointer" data-action="select-record" data-id="${r.id}">${iconHtml(ts.icon,15)}</div>
                <div class="flex-1 min-w-0 cursor-pointer" data-action="select-record" data-id="${r.id}">
                  <p class="font-bold text-stone-900 text-sm truncate flex items-center gap-1.5">${esc(r.title)}${r.filePath?iconHtml('paperclip',11,'text-stone-300 flex-shrink-0'):''}</p>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    ${mem?`<span class="inline-flex items-center gap-1"><span class="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${mem.color};font-size:8px;font-weight:800">${mem.avatar}</span><span class="text-xs font-semibold text-stone-500">${esc(mem.name.split(' ')[0])}</span></span><span class="text-stone-300 text-xs">·</span>`:''}
                    <span class="text-xs text-stone-400">${fmtDate(r.date)}</span>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="font-black text-stone-900 text-sm">${fmtINR(r.amount)}</p>
                  <button data-action="cycle-claim" data-id="${r.id}" class="mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${cs.cls}" title="Tap to change claim status">${(r.claimStatus||'none')==='none'?'+ To claim?':cs.short}</button>
                </div>
              </div>`; }).join('')}
          </div>
        </div>`;
      }).join('');

  return `<div class="fade-in max-w-2xl">
    ${(() => { const sel = anyRecord(state.recordSelectedId); return sel ? renderRecordDetailModal(sel) : ''; })()}
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Health Spending</h1>
    <p class="text-xs text-stone-400 mb-4">${esc(scopeLabel)} · tap a claim tag to mark it</p>

    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-3"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Total</p><p class="text-lg font-black text-stone-900">${fmtINR(total)}</p></div>
      <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-3"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">This month</p><p class="text-lg font-black text-stone-900">${fmtINR(thisMonth)}</p></div>
      <div class="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-3"><p class="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">To claim</p><p class="text-lg font-black text-amber-700">${fmtINR(toClaim)}</p></div>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar mb-3">
      ${SPEND_FILTERS.map(f=>`<button data-action="spend-filter" data-id="${f.id}" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors" style="${filter===f.id?`background:${C.teal};color:white`:'background:white;color:#78716c;border:1px solid #e7e5e4'}">${f.label}</button>`).join('')}
    </div>

    ${listHtml}
  </div>`;
}
function destroyChart(id) { if (chartRegistry[id]) { chartRegistry[id].destroy(); delete chartRegistry[id]; } }
function mountSpendingCharts() { /* Spending is now a transaction list — no charts */ }

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
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST', headers: AI_HEADERS,
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
  const active = activeMembers();
  const archived = state.members.filter(x => x.archived);
  return `<div class="space-y-4 fade-in">
    <div class="flex items-center justify-between"><h1 class="text-xl md:text-2xl font-bold text-stone-900">Family Health</h1><button data-action="open-member-add" class="flex items-center gap-2 px-3 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Add Member</button></div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${active.map(m => {
        const recCount = state.allRecords.filter(r => r.mid === m.id).length;
        return `
        <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-black flex-shrink-0" style="background:${m.color}">${m.avatar}</div>
            <div class="flex-1 min-w-0"><p class="font-bold text-stone-900">${esc(m.name)}</p><p class="text-xs text-stone-400">${esc(m.role)}${m.age?` · ${m.age}y`:''}${m.blood?` · ${m.blood}`:''}</p></div>
            <button data-action="member-menu" data-id="${m.id}" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">${iconHtml('more-horizontal',16)}</button>
          </div>
          ${state.memberMenuFor===m.id?`<div class="mb-3 p-2 bg-stone-50 rounded-xl space-y-1">
            <button data-action="open-member-edit" data-id="${m.id}" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-stone-700 hover:bg-white flex items-center gap-2">${iconHtml('pencil',14)} Edit / Rename</button>
            <button data-action="archive-member" data-id="${m.id}" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-stone-700 hover:bg-white flex items-center gap-2">${iconHtml('eye-off',14)} Hide member</button>
            <button data-action="delete-member" data-id="${m.id}" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-rose-600 hover:bg-white flex items-center gap-2">${iconHtml('trash-2',14)} Delete permanently</button>
          </div>`:''}
          <div class="flex items-center gap-4 mb-3 text-sm">
            <div><p class="text-xs text-stone-400">Records</p><p class="font-bold text-stone-900">${recCount}</p></div>
            <div><p class="text-xs text-stone-400">BP</p><p class="font-bold text-stone-900">${esc(m.bp)}</p></div>
            <div><p class="text-xs text-stone-400">BMI</p><p class="font-bold text-stone-900">${m.bmi||'—'}</p></div>
          </div>
          ${m.conditions.length>0?`<div class="space-y-1 mb-3">${m.conditions.slice(0,3).map(c=>`<div class="flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div><span class="text-xs text-stone-600">${esc(c)}</span></div>`).join('')}</div>`:''}
          <div class="flex gap-2 mt-3">
            <button data-action="view-member-records" data-id="${m.id}" class="flex-1 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50">View Records</button>
            <button data-action="switch-member" data-id="${m.id}" class="flex-1 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${m.color}">Dashboard</button>
          </div>
        </div>`;
      }).join('')}
      <div class="border-2 border-dashed border-stone-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-teal-300 hover:bg-teal-50 transition-all cursor-pointer min-h-48" data-action="open-member-add">
        <div class="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">${iconHtml('plus',22,'text-stone-400')}</div>
        <div class="text-center"><p class="font-bold text-stone-600">Add Family Member</p><p class="text-xs text-stone-400 mt-1">Parents, siblings, children</p></div>
      </div>
    </div>
    ${archived.length?`<div><p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2 mt-4">Hidden (${archived.length})</p>
      <div class="space-y-2">${archived.map(m=>`<div class="flex items-center gap-3 bg-stone-50 rounded-xl p-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0 opacity-60" style="background:${m.color}">${m.avatar}</div>
        <span class="text-sm font-semibold text-stone-500 flex-1">${esc(m.name)}</span>
        <button data-action="unarchive-member" data-id="${m.id}" class="text-xs font-bold text-teal-600 hover:underline">Unhide</button>
        <button data-action="delete-member" data-id="${m.id}" class="text-xs font-bold text-rose-500 hover:underline">Delete</button>
      </div>`).join('')}</div></div>`:''}
  </div>`;
}

// ── Member editor modal (add / edit / rename + health values) ──
function renderMemberEditor() {
  const ed = state.memberEditor;
  if (!ed) return '';
  const isEdit = !!ed.id;
  const f = (label, key, ph='', type='text') => `<div><label class="block text-xs font-bold text-stone-500 mb-1">${label}</label><input id="me-${key}" type="${type}" value="${ed[key]!=null?esc(String(ed[key])):''}" placeholder="${ph}" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>`;
  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="member-editor-backdrop">
    <div class="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-stone-900 text-lg">${isEdit?'Edit Member':(ed.fromUpload?`Add ${ed.name?esc(ed.name):'Member'}`:'Add Family Member')}</h3>
        <button data-action="close-member-editor">${iconHtml('x',18,'text-stone-400')}</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">${f('Full name *','name','e.g. Shreya Kukreja')}</div>
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Relationship</label>
          <select id="me-role" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
            ${['Self','Spouse','Father','Mother','Son','Daughter','Brother','Sister','Family'].map(r=>`<option ${ed.role===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        ${f('Age','age','','number')}
        <div>
          <label class="block text-xs font-bold text-stone-500 mb-1">Gender</label>
          <select id="me-gender" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
            ${['Female','Male','Other'].map(g=>`<option ${ed.gender===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        ${f('Blood group','blood','e.g. B+')}
        <div class="col-span-2 pt-1"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide">Health values (optional)</p></div>
        ${f('Height (cm)','height','','number')}
        ${f('Weight (kg)','weight','','number')}
        ${f('Blood pressure','bp','e.g. 120/80')}
        ${f('HbA1c','hba1c','e.g. 5.6')}
        <div class="col-span-2">${f('Conditions (comma-separated)','conditionsText','Hypertension, Diabetes')}</div>
      </div>
      <div class="flex gap-3 mt-5">
        <button data-action="close-member-editor" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
        <button id="me-save" class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}" ${state.memberSaving?'disabled':''}>${state.memberSaving?spinnerHtml(15,'text-white'):''} ${isEdit?'Save Changes':'Add Member'}</button>
      </div>
    </div>
  </div>`;
}

// ═════════════════════════════════════════
//  LAYER 3 — FOLLOW-UPS (dated next-actions)
// ═════════════════════════════════════════
const FU_KINDS = { test:{label:'Test',icon:'flask-conical'}, review:{label:'Review',icon:'stethoscope'}, medication:{label:'Medication',icon:'pill'}, procedure:{label:'Procedure',icon:'activity'}, other:{label:'Other',icon:'bell'} };
function fuKind(k){ return FU_KINDS[k] || FU_KINDS.other; }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); if (isNaN(d)) return null;
  const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function fmtRelDate(dateStr) {
  const n = daysUntil(dateStr);
  if (n === null) return 'No date set';
  if (n < 0) return `${Math.abs(n)} day${Math.abs(n)!==1?'s':''} overdue`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n <= 7) return `In ${n} days`;
  if (n <= 31) return `In ${Math.round(n/7)} week${Math.round(n/7)!==1?'s':''}`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function fuBucket(dateStr) {
  const n = daysUntil(dateStr);
  if (n === null) return 'nodate';
  if (n < 0) return 'overdue';
  if (n <= 7) return 'week';
  if (n <= 31) return 'month';
  return 'later';
}
// Google Calendar template URL (zero-setup: opens a prefilled event to save)
function gcalUrl(f, member) {
  const d = f.dueDate ? new Date(f.dueDate) : new Date();
  const y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
  const start = `${y}${mo}${da}`;
  const d2 = new Date(d); d2.setDate(d2.getDate()+1);
  const end = `${d2.getFullYear()}${String(d2.getMonth()+1).padStart(2,'0')}${String(d2.getDate()).padStart(2,'0')}`;
  const text = encodeURIComponent(`${f.title}${member?` — ${member.name.split(' ')[0]}`:''} (HealthHub)`);
  const details = encodeURIComponent(`${fuKind(f.kind).label} for ${member?member.name:'family member'}.${f.notes?'\n'+f.notes:''}\n\nvia HealthHub`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}

const FU_BUCKETS = [
  { id:'overdue', label:'Overdue', cls:'text-rose-600' },
  { id:'week', label:'This week', cls:'text-amber-600' },
  { id:'month', label:'This month', cls:'text-teal-700' },
  { id:'later', label:'Later', cls:'text-stone-500' },
  { id:'nodate', label:'No date yet', cls:'text-stone-400' },
];

function renderUpcoming() {
  const scopeId = state.familyView ? null : state.currentId;
  const pending = state.allFollowups.filter(f => f.status === 'pending' && (!scopeId || f.mid === scopeId));
  const scopeLabel = scopeId ? (memberById(scopeId)?.name.split(' ')[0] || '') : 'the whole family';

  const fuCard = (f) => {
    const mem = memberById(f.mid);
    const k = fuKind(f.kind);
    const rel = fmtRelDate(f.dueDate);
    const overdue = fuBucket(f.dueDate) === 'overdue';
    return `<div class="bg-white rounded-2xl p-3.5 border border-stone-100 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${C.teal}1a">${iconHtml(k.icon,17,'')}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2"><p class="font-bold text-stone-900 text-sm">${esc(f.title)}</p>${f.dateSource==='suggested'?badgeHtml('AI suggested','bg-amber-50 text-amber-700 ml-auto text-xs'):''}</div>
          <div class="flex items-center gap-1.5 mt-1">
            ${mem?`<span class="inline-flex items-center gap-1"><span class="w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${mem.color};font-size:9px;font-weight:800">${mem.avatar}</span><span class="text-xs font-semibold text-stone-500">${esc(mem.name.split(' ')[0])}</span></span><span class="text-stone-300 text-xs">·</span>`:''}
            <span class="text-xs font-semibold ${overdue?'text-rose-600':'text-stone-500'}">${rel}</span>
          </div>
          ${f.notes?`<p class="text-xs text-stone-500 mt-1 line-clamp-1">${esc(f.notes)}</p>`:''}
          ${f.dateSource==='suggested'?`<p class="text-xs text-amber-600 mt-1">Confirm this with the doctor</p>`:''}
          ${(() => { const src = f.sourceRecordId ? anyRecord(f.sourceRecordId) : null; return src ? `<button data-action="select-record" data-id="${src.id}" class="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-teal-600 hover:underline">${iconHtml('file-text',11)} From: ${esc(src.title)}</button>` : (f.sourceRecordId ? '' : `<p class="text-xs text-stone-300 mt-1.5">Added manually</p>`); })()}
        </div>
      </div>
      <div class="flex gap-2 mt-2.5 pl-12">
        <button data-action="followup-done" data-id="${f.id}" class="flex-1 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90" style="background:${C.teal}">${iconHtml('check',12,'inline mr-1')}Mark done</button>
        <button data-action="followup-calendar" data-id="${f.id}" class="flex-1 py-1.5 rounded-lg text-xs font-bold border border-stone-200 text-stone-600 hover:bg-stone-50">${iconHtml('calendar',12,'inline mr-1')}Calendar</button>
        <button data-action="followup-edit" data-id="${f.id}" class="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50">${iconHtml('pencil',12)}</button>
      </div>
    </div>`;
  };

  const body = pending.length === 0
    ? `<div class="text-center py-16 text-stone-400">${iconHtml('calendar-check',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">Nothing coming up</p><p class="text-sm mt-1">Follow-ups from your documents show here, or add one manually.</p></div>`
    : FU_BUCKETS.map(b => {
        const items = pending.filter(f => fuBucket(f.dueDate) === b.id);
        if (items.length === 0) return '';
        return `<div class="mb-5">
          <div class="flex items-center gap-2 mb-2"><p class="text-xs font-black uppercase tracking-wider ${b.cls}">${b.label}</p><span class="text-xs text-stone-300">${items.length}</span><div class="flex-1 h-px bg-stone-100"></div></div>
          <div class="space-y-2.5">${items.map(fuCard).join('')}</div>
        </div>`;
      }).join('');

  return `<div class="fade-in max-w-2xl">
    ${(() => { const sel = anyRecord(state.recordSelectedId); return sel ? renderRecordDetailModal(sel) : ''; })()}
    <div class="flex items-center justify-between mb-1">
      <h1 class="text-xl md:text-2xl font-bold text-stone-900">What's Coming Up</h1>
      <button data-action="followup-add" class="flex items-center gap-2 px-3 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Add</button>
    </div>
    <p class="text-xs text-stone-400 mb-4">${pending.length} pending for ${esc(scopeLabel)}</p>
    ${body}
  </div>`;
}

function renderFollowupEditor() {
  const ed = state.followupEditor;
  if (!ed) return '';
  const isEdit = !!ed.id;
  return `
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="followup-editor-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4"><h3 class="font-bold text-stone-900 text-lg">${isEdit?'Edit Follow-up':'New Follow-up'}</h3><button data-action="close-followup-editor">${iconHtml('x',18,'text-stone-400')}</button></div>
      <div class="space-y-3">
        <div><label class="block text-xs font-bold text-stone-500 mb-1">What needs doing? *</label>
          <input id="fu-title" value="${esc(ed.title||'')}" placeholder="e.g. Repeat LFT, Cardiology review" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>
        <div><label class="block text-xs font-bold text-stone-500 mb-1">For whom *</label>
          <select id="fu-member" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
            ${activeMembers().map(mm=>`<option value="${mm.id}" ${ed.mid===mm.id?'selected':''}>${esc(mm.name)}</option>`).join('')}
          </select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-stone-500 mb-1">Due date <span class="font-normal text-stone-400">(optional)</span></label>
            <input id="fu-date" type="date" value="${ed.dueDate||''}" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>
          <div><label class="block text-xs font-bold text-stone-500 mb-1">Type</label>
            <select id="fu-kind" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white">
              ${Object.keys(FU_KINDS).map(k=>`<option value="${k}" ${ (ed.kind||'review')===k?'selected':''}>${FU_KINDS[k].label}</option>`).join('')}
            </select></div>
        </div>
        <div><label class="block text-xs font-bold text-stone-500 mb-1">Notes (optional)</label>
          <textarea id="fu-notes" rows="2" placeholder="Any detail" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none">${esc(ed.notes||'')}</textarea></div>
      </div>
      <div class="flex gap-3 mt-5">
        ${isEdit?`<button data-action="followup-delete" data-id="${ed.id}" class="py-3 px-4 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-50">${iconHtml('trash-2',15)}</button>`:''}
        <button data-action="close-followup-editor" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
        <button id="fu-save" class="flex-1 py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}" ${state.followupSaving?'disabled':''}>${state.followupSaving?spinnerHtml(15,'text-white'):''} ${isEdit?'Save':'Add Follow-up'}</button>
      </div>
    </div>
  </div>`;
}

// ═════════════════════════════════════════
//  LAYER 4 — TRENDS (same lab value over time)
// ═════════════════════════════════════════
// Canonical names so the same test lines up across labs (SGPT=ALT, etc.)
// ═════════════════════════════════════════
//  HOME — age/gender preventive-care milestones (rule-based, stable — not AI-generated)
//  General, widely-published preventive guidance. Not personalized medical advice.
// ═════════════════════════════════════════
const AGE_MILESTONES = [
  { min:0, max:17, items: ['Annual growth & vision/hearing check', 'Vaccination schedule up to date', 'Dental check-up twice a year'] },
  { min:18, max:29, items: ['BP check every 2 years if normal', 'Dental check-up yearly', 'Eye check every 2 years', 'Skin self-check for new/changing moles'] },
  { min:30, max:39, items: ['BP + blood sugar (fasting) yearly', 'Lipid profile every 2–3 years', 'Dental cleaning yearly', 'Women: cervical screening per doctor schedule'] },
  { min:40, max:49, items: ['BP, fasting sugar, lipid profile — annually', 'ECG baseline if not done', 'Eye check yearly (presbyopia range begins)', 'Women: discuss mammogram baseline timing with doctor', 'Men: discuss prostate screening timing with doctor'] },
  { min:50, max:59, items: ['Full annual health check (BP, sugar, lipids, kidney, liver)', 'Discuss colonoscopy screening window with doctor', 'Bone density discussion, especially post-menopause', 'Eye check yearly incl. glaucoma screening', 'Hearing check every 2–3 years'] },
  { min:60, max:120, items: ['6-monthly BP, sugar, kidney & liver function', 'Annual ECG / cardiac check-in', 'Bone density (DEXA) periodically', 'Vision + hearing check yearly', 'Fall-risk & mobility check', 'Vaccination review (flu, pneumonia per doctor)'] },
];
function milestonesForAge(age) {
  const bracket = AGE_MILESTONES.find(b => age >= b.min && age <= b.max) || AGE_MILESTONES[AGE_MILESTONES.length-1];
  return bracket.items;
}

const LAB_ALIASES = {
  'sgpt':'ALT (SGPT)', 'alt':'ALT (SGPT)', 'alanine transaminase':'ALT (SGPT)', 'alanine aminotransferase':'ALT (SGPT)',
  'sgot':'AST (SGOT)', 'ast':'AST (SGOT)', 'aspartate transaminase':'AST (SGOT)', 'aspartate aminotransferase':'AST (SGOT)',
  'ggt':'GGT', 'gamma gt':'GGT', 'gamma glutamyl transferase':'GGT', 'ggtp':'GGT',
  'total bilirubin':'Total Bilirubin', 'bilirubin total':'Total Bilirubin', 'bilirubin':'Total Bilirubin', 'serum bilirubin':'Total Bilirubin',
  'direct bilirubin':'Direct Bilirubin', 'bilirubin direct':'Direct Bilirubin',
  'alkaline phosphatase':'ALP', 'alp':'ALP',
  'creatinine':'Creatinine', 'sr creatinine':'Creatinine', 'sr. creatinine':'Creatinine', 'serum creatinine':'Creatinine',
  'urea':'Urea', 'blood urea':'Urea', 'bun':'Urea',
  'uric acid':'Uric Acid', 'sr uric acid':'Uric Acid',
  'hba1c':'HbA1c', 'glycated haemoglobin':'HbA1c', 'glycosylated hemoglobin':'HbA1c', 'hb a1c':'HbA1c',
  'fasting blood sugar':'Fasting Glucose', 'fbs':'Fasting Glucose', 'glucose fasting':'Fasting Glucose', 'fasting glucose':'Fasting Glucose', 'blood sugar fasting':'Fasting Glucose',
  'post prandial blood sugar':'PP Glucose', 'ppbs':'PP Glucose', 'glucose pp':'PP Glucose',
  'total cholesterol':'Total Cholesterol', 'cholesterol total':'Total Cholesterol', 'cholesterol':'Total Cholesterol',
  'hdl':'HDL', 'hdl cholesterol':'HDL', 'ldl':'LDL', 'ldl cholesterol':'LDL',
  'triglycerides':'Triglycerides', 'tg':'Triglycerides',
  'tsh':'TSH', 't3':'T3', 't4':'T4', 'free t4':'Free T4', 'free t3':'Free T3',
  'hemoglobin':'Hemoglobin', 'haemoglobin':'Hemoglobin', 'hb':'Hemoglobin',
  'platelet count':'Platelets', 'platelets':'Platelets', 'platelet':'Platelets',
  'wbc':'WBC', 'total wbc count':'WBC', 'tlc':'WBC',
  'vitamin d':'Vitamin D', '25-oh vitamin d':'Vitamin D', 'vitamin d3':'Vitamin D', '25 hydroxy vitamin d':'Vitamin D',
  'vitamin b12':'Vitamin B12', 'b12':'Vitamin B12',
  'esr':'ESR', 'crp':'CRP',
  'pt inr':'INR', 'inr':'INR', 'prothrombin time':'PT',
};
function canonicalTest(name) {
  if (!name) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  if (LAB_ALIASES[key]) return LAB_ALIASES[key];
  // Match a known alias as a whole word — longest aliases first so 'total cholesterol'
  // beats 'cholesterol' and 'hba1c' beats 'hb'. Handles 'AST (SGOT)', 'SGOT (AST)', etc.
  const aliasKeys = Object.keys(LAB_ALIASES).sort((a,b) => b.length - a.length);
  for (const ak of aliasKeys) {
    const re = new RegExp('\\b' + ak.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b');
    if (re.test(key)) return LAB_ALIASES[ak];
  }
  return name.replace(/\s+/g,' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}
function parseNum(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g,'').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function parseUnit(v) {
  if (v == null) return '';
  const m = String(v).match(/[a-zA-Z%\/µ]+.*/);
  return m ? m[0].trim() : '';
}
function parseRange(normal) {
  if (!normal) return { low: null, high: null };
  const s = String(normal).replace(/,/g,'');
  let m = s.match(/(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)/i);
  if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) };
  m = s.match(/[<≤]\s*(-?\d+(?:\.\d+)?)/); if (m) return { low: null, high: parseFloat(m[1]) };
  m = s.match(/[>≥]\s*(-?\d+(?:\.\d+)?)/); if (m) return { low: parseFloat(m[1]), high: null };
  return { low: null, high: null };
}

// Build trends for a member from all their records' extracted keyValues
function computeTrends(memberId) {
  const recs = state.allRecords.filter(r => r.mid === memberId && r.date && r.extracted?.keyValues?.length);
  const buckets = {};
  recs.forEach(r => {
    r.extracted.keyValues.forEach(kv => {
      const num = parseNum(kv.value);
      if (num == null) return;
      const canon = canonicalTest(kv.std || kv.name);
      if (!canon) return;
      (buckets[canon] = buckets[canon] || []).push({
        date: r.date, value: num, unit: parseUnit(kv.value), status: kv.status,
        range: parseRange(kv.normal), recordId: r.id,
      });
    });
  });
  const trends = [];
  Object.keys(buckets).forEach(canon => {
    const pts = buckets[canon].sort((a,b) => new Date(a.date) - new Date(b.date));
    if (pts.length < 2) return; // need at least 2 readings to trend
    const latest = pts[pts.length-1], prev = pts[pts.length-2];
    const range = pts.map(p => p.range).find(r => r.low != null || r.high != null) || { low:null, high:null };
    let dir = 'flat';
    if (latest.value > prev.value) dir = 'up';
    else if (latest.value < prev.value) dir = 'down';
    const outOfRange = (range.high != null && latest.value > range.high) || (range.low != null && latest.value < range.low);
    trends.push({ canon, pts, unit: latest.unit, latest, prev, range, dir, outOfRange });
  });
  // out-of-range first, then most readings
  trends.sort((a,b) => (b.outOfRange?1:0)-(a.outOfRange?1:0) || b.pts.length - a.pts.length);
  return trends;
}

function computeAllTests(memberId) {
  const recs = state.allRecords.filter(r => r.mid === memberId && r.date && r.extracted?.keyValues?.length);
  const buckets = {};
  recs.forEach(r => {
    r.extracted.keyValues.forEach(kv => {
      const num = parseNum(kv.value); if (num == null) return;
      const canon = canonicalTest(kv.std || kv.name); if (!canon) return;
      (buckets[canon] = buckets[canon] || []).push({ date: r.date, value: num, unit: parseUnit(kv.value), status: kv.status, range: parseRange(kv.normal) });
    });
  });
  const out = [];
  Object.keys(buckets).forEach(canon => {
    const pts = buckets[canon].sort((a,b) => new Date(a.date) - new Date(b.date));
    const latest = pts[pts.length-1];
    const range = pts.map(p => p.range).find(r => r.low != null || r.high != null) || { low:null, high:null };
    const outOfRange = (range.high != null && latest.value > range.high) || (range.low != null && latest.value < range.low);
    out.push({ canon, pts, unit: latest.unit, latest, range, outOfRange });
  });
  out.sort((a,b) => (b.outOfRange?1:0)-(a.outOfRange?1:0) || b.pts.length - a.pts.length);
  return out;
}

// Reports (records with lab values) for a member, newest first — used for report-vs-report compare
function reportsWithLabs(memberId) {
  return state.allRecords
    .filter(r => r.mid === memberId && r.date && r.extracted?.keyValues?.some(kv => parseNum(kv.value) != null))
    .map(r => {
      const vals = {};
      r.extracted.keyValues.forEach(kv => {
        const num = parseNum(kv.value); if (num == null) return;
        const canon = canonicalTest(kv.std || kv.name); if (!canon) return;
        vals[canon] = { value: num, unit: parseUnit(kv.value), range: parseRange(kv.normal) };
      });
      return { id: r.id, date: r.date, title: r.title, vals };
    })
    .sort((a,b) => new Date(b.date) - new Date(a.date));
}

function renderTrends() {
  const m = currentMember();
  const reports = reportsWithLabs(state.currentId);

  if (reports.length === 0) {
    return `<div class="fade-in max-w-2xl">
      <h1 class="text-xl md:text-2xl font-bold text-stone-900">Compare Reports</h1>
      <p class="text-xs text-stone-400 mb-4">${esc(m.name)}</p>
      <div class="text-center py-16 text-stone-400">${iconHtml('git-compare',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No lab reports yet</p><p class="text-sm mt-1 max-w-xs mx-auto">Upload ${esc(m.name.split(' ')[0])}'s lab reports and you'll be able to compare any two side by side.</p></div>
    </div>`;
  }

  const label = r => `${esc(r.title)} · ${fmtDate(r.date)}`;
  const RA = state.compareRepA ? reports.find(r => r.id === state.compareRepA) : null;
  // Filter 2 offers only reports of the SAME kind as A (sharing ≥2 parameters) — LFT vs LFT, not LFT vs lipid
  const compatible = RA ? reports.filter(r => r.id !== RA.id && Object.keys(r.vals).filter(k => RA.vals[k]).length >= 2) : reports;
  const RB = state.compareRepB ? reports.find(r => r.id === state.compareRepB) : null;

  const optionsA = [`<option value="">None</option>`, ...reports.map(r => `<option value="${r.id}" ${state.compareRepA===r.id?'selected':''}>${label(r)}</option>`)].join('');
  const optionsB = [`<option value="">None</option>`, ...compatible.map(r => `<option value="${r.id}" ${state.compareRepB===r.id?'selected':''}>${label(r)}</option>`)].join('');

  // Build the comparison table only after Run, and only when both are chosen
  let resultHtml = '';
  const ready = RA && RB;
  if (state.compareRun && ready) {
    const shared = Object.keys(RA.vals).filter(k => RB.vals[k]);
    const params = shared.length ? shared : [...new Set([...Object.keys(RA.vals), ...Object.keys(RB.vals)])];
    if (!shared.length) {
      resultHtml = `<div class="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mt-3">${iconHtml('info',13,'inline mr-1')}These two reports don't share any common tests — pick two of the same kind (e.g. two LFTs) to compare like-for-like.</div>`;
    } else {
      const rowsHtml = params.map(p => {
        const a = RA.vals[p], b = RB.vals[p];
        const range = (a&&(a.range.low!=null||a.range.high!=null))?a.range:(b?b.range:{low:null,high:null});
        const oor = v => v!=null && ((range.high!=null&&v>range.high)||(range.low!=null&&v<range.low));
        const delta = (a&&b)?Math.round((b.value-a.value)*100)/100:null;
        const rangeTxt = range.low!=null&&range.high!=null?`${range.low}–${range.high}`:range.high!=null?`< ${range.high}`:range.low!=null?`> ${range.low}`:'';
        return `<tr class="border-b border-stone-50 last:border-0 align-top">
          <td class="px-3 py-2.5 font-semibold text-stone-700 text-xs">${esc(p)}${rangeTxt?`<span class="block text-stone-400 font-normal">${rangeTxt}</span>`:''}</td>
          <td class="px-2 py-2.5 text-right font-bold ${oor(a?.value)?'text-rose-600':'text-stone-800'}">${a?a.value:'—'}</td>
          <td class="px-3 py-2.5 text-right">
            <span class="font-bold ${oor(b?.value)?'text-rose-600':'text-stone-800'}">${b?b.value:'—'}</span>
            ${delta!=null&&delta!==0?`<span class="block text-xs font-bold ${delta>0?'text-rose-400':'text-teal-500'}">${delta>0?'▲ +':'▼ '}${delta}</span>`:''}
          </td>
        </tr>`;
      }).join('');
      resultHtml = `
        <button data-action="compare-insight" ${state.compareLoading?'disabled':''} class="w-full py-2.5 mt-4 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60" style="background:${C.teal}">${state.compareLoading?spinnerHtml(15,'text-white'):iconHtml('sparkles',15)} ${state.compareLoading?'Reading the reports…':(state.compareInsight?'Re-read with AI':'Ask AI to summarise these reports')}</button>
        ${state.compareInsight ? `<div class="p-3 bg-teal-50 border border-teal-100 rounded-xl mt-3"><div class="flex items-center gap-1.5 mb-1.5">${iconHtml('sparkles',14,'text-teal-600')}<p class="text-xs font-bold text-teal-700">AI summary</p></div><p class="text-sm text-teal-900 whitespace-pre-line">${esc(state.compareInsight)}</p><p class="text-xs text-teal-600 mt-2">General information — confirm with ${esc(m.name.split(' ')[0])}'s doctor.</p></div>` : ''}
        <div class="rounded-xl border border-stone-100 overflow-hidden mt-3">
          <table class="w-full text-sm table-fixed">
            <thead><tr class="text-xs text-stone-400 border-b border-stone-100 bg-stone-50/50">
              <th class="text-left font-bold px-3 py-2 w-[44%]">Parameter</th>
              <th class="text-right font-bold px-2 py-2">${fmtDate(RA.date)}</th>
              <th class="text-right font-bold px-3 py-2">${fmtDate(RB.date)}</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="flex gap-2 mt-3">
          <button data-action="share-comparison" class="flex-1 py-2.5 rounded-xl text-sm font-bold border border-stone-200 text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-1.5">${iconHtml('share-2',14)} Share</button>
          <button data-action="print-comparison" class="flex-1 py-2.5 rounded-xl text-sm font-bold border border-stone-200 text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-1.5">${iconHtml('printer',14)} Print / PDF</button>
        </div>`;
    }
  }

  return `<div class="fade-in max-w-2xl">
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Compare Reports</h1>
    <p class="text-xs text-stone-400 mb-4">${esc(m.name)} · pick two reports of the same kind to compare</p>
    <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div class="mb-3">
        <label class="block text-xs font-bold text-stone-500 mb-1">First report</label>
        <select id="cmp-a" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600">${optionsA}</select>
      </div>
      <div class="mb-3">
        <label class="block text-xs font-bold text-stone-500 mb-1">Second report ${RA?'<span class="font-normal text-stone-400">(same kind as first)</span>':''}</label>
        <select id="cmp-b" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600" ${!RA?'disabled':''}>${optionsB}</select>
        ${RA&&compatible.length===0?`<p class="text-xs text-amber-600 mt-1">No other report of the same kind yet — upload another ${esc(RA.title.split(' ')[0])} to compare.</p>`:''}
      </div>
      <button data-action="run-compare" ${!ready?'disabled':''} class="w-full py-2.5 rounded-xl text-sm font-bold border-2 disabled:opacity-50 ${ready?'text-white hover:opacity-90':'text-stone-400 border-stone-200'}" style="${ready?`background:${C.teal};border-color:${C.teal}`:''}">${iconHtml('git-compare',15,'inline mr-1')} Run comparison</button>
      ${resultHtml}
    </div>
  </div>`;
}

function mountTrendsCharts() { /* Trends is now a table — no charts */ }

// Gather the currently-selected comparison (or null) for share/print
function currentComparison() {
  const reports = reportsWithLabs(state.currentId);
  if (reports.length < 2) return null;
  const RA = state.compareRepA ? reports.find(r => r.id === state.compareRepA) : null;
  const RB = state.compareRepB ? reports.find(r => r.id === state.compareRepB) : null;
  if (!RA || !RB) return null;
  const shared = Object.keys(RA.vals).filter(k => RB.vals[k]);
  const params = shared.length ? shared : [...new Set([...Object.keys(RA.vals), ...Object.keys(RB.vals)])];
  const rows = params.map(p => {
    const a = RA.vals[p], b = RB.vals[p];
    const range = (a&&(a.range.low!=null||a.range.high!=null))?a.range:(b?b.range:{low:null,high:null});
    const rangeTxt = range.low!=null&&range.high!=null?`${range.low}-${range.high}`:range.high!=null?`<${range.high}`:range.low!=null?`>${range.low}`:'';
    const oor = v => v!=null && ((range.high!=null&&v>range.high)||(range.low!=null&&v<range.low));
    return { p, a: a?a.value:null, b: b?b.value:null, unit: a?.unit||b?.unit||'', rangeTxt, aOor: oor(a?.value), bOor: oor(b?.value) };
  });
  return { m: currentMember(), RA, RB, rows, insight: state.compareInsight };
}

function comparisonPlainText() {
  const c = currentComparison(); if (!c) return '';
  const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
  let t = `LFT comparison — ${c.m.name}\n`;
  t += `${fmtDate(c.RA.date)}  vs  ${fmtDate(c.RB.date)}\n\n`;
  t += `${pad('Parameter',18)} ${pad(fmtDate(c.RA.date),9)} ${pad(fmtDate(c.RB.date),9)} ref\n`;
  c.rows.forEach(r => {
    const flag = r.bOor ? ' *' : '';
    t += `${pad(r.p,18)} ${pad(r.a??'-',9)} ${pad((r.b??'-')+flag,9)} ${r.rangeTxt}\n`;
  });
  if (c.insight) t += `\nAI summary:\n${c.insight}\n`;
  t += `\n(* = outside reference range · general info, confirm with the doctor)\n— via HealthHub`;
  return t;
}

async function handleShareComparison() {
  const text = comparisonPlainText();
  if (!text) { showToast('Run a comparison first'); return; }
  try {
    if (navigator.share) { await navigator.share({ title: 'Lab comparison', text }); }
    else { await navigator.clipboard.writeText(text); showToast('Copied to clipboard ✓'); }
  } catch (e) { /* user cancelled share — ignore */ }
}

function handlePrintComparison() {
  const c = currentComparison();
  if (!c) { showToast('Run a comparison first'); return; }
  const rowsHtml = c.rows.map(r => `<tr>
    <td class="p">${esc(r.p)}${r.rangeTxt?`<span class="ref">ref ${esc(r.rangeTxt)}</span>`:''}</td>
    <td class="v ${r.aOor?'oor':''}">${r.a??'—'}</td>
    <td class="v ${r.bOor?'oor':''}">${r.b??'—'} ${esc(r.unit||'')}</td>
  </tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lab comparison — ${esc(c.m.name)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;max-width:640px;margin:0 auto;padding:16px}
      h1{font-size:20px;margin:0 0 2px} .sub{color:#78716c;font-size:13px;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:14px} th,td{padding:8px 6px;border-bottom:1px solid #eee;text-align:right}
      th:first-child,td.p{text-align:left} th{color:#78716c;font-size:12px;border-bottom:2px solid #ddd}
      td.p{font-weight:600} .ref{display:block;color:#a8a29e;font-weight:400;font-size:11px} .v{font-weight:700} .oor{color:#e11d48}
      .ai{margin-top:18px;padding:12px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;font-size:13px;white-space:pre-line}
      .ai b{display:block;margin-bottom:4px;color:#0f766e} .foot{margin-top:16px;color:#a8a29e;font-size:11px}
      .bar{position:sticky;top:0;background:#fff;padding:10px 0 12px;margin-bottom:8px;display:flex;gap:8px;border-bottom:1px solid #eee}
      .bar button{flex:1;padding:12px;border-radius:10px;font-size:14px;font-weight:700;border:1px solid #d6d3d1;background:#fff;color:#44403c}
      .bar .pr{background:#0d9488;color:#fff;border-color:#0d9488}
      @media print{.bar{display:none} body{margin:0;padding:0}}
    </style></head><body>
    <div class="bar">
      <button class="pr" onclick="window.print()">Print / Save PDF</button>
      <button onclick="window.close()">Close</button>
    </div>
    <h1>Lab comparison — ${esc(c.m.name)}</h1>
    <p class="sub">${esc(c.RA.title)} · ${fmtDate(c.RA.date)}  →  ${fmtDate(c.RB.date)}</p>
    <table><thead><tr><th>Parameter</th><th>${fmtDate(c.RA.date)}</th><th>${fmtDate(c.RB.date)}</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    ${c.insight?`<div class="ai"><b>AI summary</b>${esc(c.insight)}</div>`:''}
    <p class="foot">Values in red are outside the reference range. This is general information to discuss with a doctor, not a diagnosis. Generated by HealthHub.</p>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to open the printable page'); return; }
  w.document.write(html); w.document.close();
}

async function handleCompareInsight() {
  const reports = reportsWithLabs(state.currentId);
  if (reports.length < 2) return;
  const m = currentMember();
  const bId = state.compareRepB && reports.some(r=>r.id===state.compareRepB) ? state.compareRepB : reports[0].id;
  const aId = state.compareRepA && reports.some(r=>r.id===state.compareRepA) ? state.compareRepA : reports[1].id;
  const RA = reports.find(r => r.id === aId), RB = reports.find(r => r.id === bId);
  const params = [...new Set([...Object.keys(RA.vals), ...Object.keys(RB.vals)])];
  const lines = params.map(p => {
    const a = RA.vals[p], b = RB.vals[p];
    const range = (a&&(a.range.low!=null||a.range.high!=null))?a.range:(b?b.range:{low:null,high:null});
    const rangeTxt = range.low!=null&&range.high!=null?`ref ${range.low}-${range.high}`:range.high!=null?`ref <${range.high}`:range.low!=null?`ref >${range.low}`:'';
    return `${p}: ${a?a.value:'—'} -> ${b?b.value:'—'} ${a?.unit||b?.unit||''} ${rangeTxt}`;
  }).join('\n');

  const prompt = `You are a careful health explainer for a family caregiver in India. Two lab reports for the same person are shown below. Give a brief, holistic reading of how things changed between the two dates. Be factual, calm and non-alarming. Do NOT diagnose. Point out which values moved meaningfully and in which direction, note anything now out of range, and give 1-3 practical, safe next steps. End by noting it's worth discussing with the doctor. Keep it under 150 words, plain English.

Person: ${m.name}, ${m.age||'?'}y ${m.gender||''}. Known conditions: ${(m.conditions||[]).join(', ')||'none noted'}.
Earlier report — ${fmtDate(RA.date)} (${esc(RA.title)})
Later report — ${fmtDate(RB.date)} (${esc(RB.title)})

Values (earlier -> later):
${lines}`;

  setState({ compareLoading: true });
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST', headers: AI_HEADERS,
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await res.json();
    setState({ compareLoading: false, compareInsight: d.content?.[0]?.text || 'Could not generate a reading. Please try again.' });
  } catch {
    setState({ compareLoading: false, compareInsight: 'Connection error — please try again.' });
  }
}

// ═════════════════════════════════════════
//  MEDICINES  (per-person list + reminders)
// ═════════════════════════════════════════
function medReminderUrl(med, member) {
  const today = new Date();
  const start = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const d2 = new Date(today); d2.setDate(d2.getDate()+1);
  const end = `${d2.getFullYear()}${String(d2.getMonth()+1).padStart(2,'0')}${String(d2.getDate()).padStart(2,'0')}`;
  const text = encodeURIComponent(`💊 ${med.name}${med.dose?` (${med.dose})`:''}${member?` — ${member.name.split(' ')[0]}`:''}`);
  const details = encodeURIComponent(`${med.freq||''}${med.timing?` · ${med.timing}`:''}${med.purpose?`\nFor: ${med.purpose}`:''}\n\nvia HealthHub`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&recur=RRULE:FREQ=DAILY`;
}

function renderMedicines() {
  const m = currentMember();
  const meds = state.allMedicines.filter(x => x.mid === state.currentId && x.active);
  const body = meds.length === 0
    ? `<div class="text-center py-16 text-stone-400">${iconHtml('pill',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No medicines yet</p><p class="text-sm mt-1 max-w-xs mx-auto">Add ${esc(m.name.split(' ')[0])}'s medicines to keep a clear list and set daily reminders.</p><button data-action="medicine-add" class="mt-4 px-5 py-2.5 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Add Medicine</button></div>`
    : `<div class="space-y-2.5">${meds.map(md => `
        <div class="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${C.teal}1a">${iconHtml('pill',18,'')}</div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-stone-900 text-sm">${esc(md.name)}${md.dose?` · ${esc(md.dose)}`:''}</p>
              <p class="text-xs text-stone-500 mt-0.5">${[md.freq,md.timing].filter(Boolean).map(esc).join(' · ')||'No schedule set'}</p>
              ${md.purpose?`<p class="text-xs text-stone-400 mt-0.5">For: ${esc(md.purpose)}</p>`:''}
            </div>
            <button data-action="medicine-edit" data-id="${md.id}" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">${iconHtml('pencil',14)}</button>
          </div>
          <div class="flex gap-2 mt-3 pl-13">
            <a href="${medReminderUrl(md, m)}" target="_blank" class="flex-1 py-1.5 rounded-lg text-xs font-bold border border-stone-200 text-stone-600 hover:bg-stone-50 text-center flex items-center justify-center gap-1">${iconHtml('bell',12)} Daily reminder</a>
            <button data-action="medicine-delete" data-id="${md.id}" class="px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">${iconHtml('trash-2',12)}</button>
          </div>
        </div>`).join('')}</div>`;
  return `<div class="fade-in max-w-2xl">
    <div class="flex items-center justify-between mb-1"><h1 class="text-xl md:text-2xl font-bold text-stone-900">Medicines</h1>${meds.length?`<button data-action="medicine-add" class="flex items-center gap-2 px-3 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Add</button>`:''}</div>
    <p class="text-xs text-stone-400 mb-4">${esc(m.name)} · ${meds.length} active</p>
    ${body}
  </div>`;
}

function renderMedicineEditor() {
  const ed = state.medicineEditor; if (!ed) return '';
  const isEdit = !!ed.id;
  const f = (id,label,ph='') => `<div><label class="block text-xs font-bold text-stone-500 mb-1">${label}</label><input id="med-${id}" value="${ed[id]!=null?esc(String(ed[id])):''}" placeholder="${ph}" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>`;
  return `<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="medicine-editor-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4"><h3 class="font-bold text-stone-900 text-lg">${isEdit?'Edit Medicine':'Add Medicine'}</h3><button data-action="close-medicine-editor">${iconHtml('x',18,'text-stone-400')}</button></div>
      <div class="space-y-3">
        ${f('name','Medicine name *','e.g. Metformin')}
        <div class="grid grid-cols-2 gap-3">${f('dose','Dose','e.g. 500mg')}${f('freq','Frequency','e.g. Twice a day')}</div>
        ${f('timing','Timing','e.g. After food · 8am, 8pm')}
        ${f('purpose','For (condition)','e.g. Diabetes')}
      </div>
      <div class="flex gap-3 mt-5">
        ${isEdit?`<button data-action="medicine-delete" data-id="${ed.id}" class="py-3 px-4 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold">${iconHtml('trash-2',15)}</button>`:''}
        <button data-action="close-medicine-editor" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
        <button id="med-save" class="flex-1 py-3 text-white rounded-xl text-sm font-bold hover:opacity-90" style="background:${C.teal}">${isEdit?'Save':'Add'}</button>
      </div>
    </div>
  </div>`;
}

// ═════════════════════════════════════════
//  DOCTORS  (family directory, auto-built)
// ═════════════════════════════════════════
function renderDoctors() {
  const saved = state.allDoctors;
  const savedNames = new Set(saved.map(d => (d.name||'').toLowerCase().trim()));
  // Auto-suggest doctors seen in records that aren't saved yet
  const seen = {};
  state.allRecords.forEach(r => {
    const n = (r.doctor||'').trim();
    if (n && !savedNames.has(n.toLowerCase())) {
      if (!seen[n]) seen[n] = { name:n, hospital:r.hospital||'', count:0 };
      seen[n].count++;
    }
  });
  const suggestions = Object.values(seen).sort((a,b)=>b.count-a.count).slice(0,10);

  const savedHtml = saved.length === 0 ? '' : `<div class="space-y-2.5 mb-5">${saved.map(d => `
    <div class="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:${C.teal}1a">${iconHtml('stethoscope',18,'')}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-stone-900 text-sm">${esc(d.name)}</p>
          <p class="text-xs text-stone-500 mt-0.5">${[d.specialty,d.hospital].filter(Boolean).map(esc).join(' · ')||'—'}</p>
          ${d.notes?`<p class="text-xs text-stone-400 mt-0.5">${esc(d.notes)}</p>`:''}
        </div>
        <button data-action="doctor-edit" data-id="${d.id}" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">${iconHtml('pencil',14)}</button>
      </div>
      ${d.phone?`<div class="flex gap-2 mt-3"><a href="tel:${esc(d.phone)}" class="flex-1 py-1.5 rounded-lg text-xs font-bold text-white text-center flex items-center justify-center gap-1 hover:opacity-90" style="background:${C.teal}">${iconHtml('phone',12)} ${esc(d.phone)}</a></div>`:`<button data-action="doctor-edit" data-id="${d.id}" class="text-xs font-bold text-teal-600 hover:underline mt-2">+ Add phone number</button>`}
    </div>`).join('')}</div>`;

  const suggestHtml = suggestions.length === 0 ? '' : `
    <p class="text-xs font-black text-stone-400 uppercase tracking-wider mb-2">Found in your records</p>
    <div class="space-y-2 mb-5">${suggestions.map(s => `
      <div class="bg-white rounded-2xl p-4 border border-dashed border-stone-200 shadow-sm">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:${C.teal}1a">${iconHtml('stethoscope',18,'')}</div>
          <div class="flex-1 min-w-0"><p class="font-bold text-stone-900 text-sm truncate">${esc(s.name)}</p><p class="text-xs text-stone-400 mt-0.5">${s.hospital?esc(s.hospital)+' · ':''}${s.count} record${s.count!==1?'s':''} · not saved yet</p></div>
          <button data-action="doctor-add-suggested" data-name="${esc(s.name)}" data-hospital="${esc(s.hospital)}" class="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400" title="Save & edit">${iconHtml('pencil',14)}</button>
        </div>
      </div>`).join('')}</div>`;

  const empty = saved.length === 0 && suggestions.length === 0
    ? `<div class="text-center py-16 text-stone-400">${iconHtml('stethoscope',36,'mx-auto mb-3 opacity-30')}<p class="font-semibold">No doctors yet</p><p class="text-sm mt-1">As you upload documents, doctors are detected here. Or add one manually.</p></div>` : '';

  return `<div class="fade-in max-w-2xl">
    <div class="flex items-center justify-between mb-1"><h1 class="text-xl md:text-2xl font-bold text-stone-900">Doctors</h1><button data-action="doctor-add" class="flex items-center gap-2 px-3 py-2 text-white rounded-xl text-xs font-bold hover:opacity-90" style="background:${C.teal}">${iconHtml('plus',14)} Add</button></div>
    <p class="text-xs text-stone-400 mb-4">${saved.length} saved${suggestions.length?` · ${suggestions.length} found in records`:''}</p>
    ${savedHtml}${suggestHtml}${empty}
  </div>`;
}

function renderDoctorEditor() {
  const ed = state.doctorEditor; if (!ed) return '';
  const isEdit = !!ed.id;
  const f = (id,label,ph='',type='text') => `<div><label class="block text-xs font-bold text-stone-500 mb-1">${label}</label><input id="doc-${id}" type="${type}" value="${ed[id]!=null?esc(String(ed[id])):''}" placeholder="${ph}" class="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"/></div>`;
  return `<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" id="doctor-editor-backdrop">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4"><h3 class="font-bold text-stone-900 text-lg">${isEdit?'Edit Doctor':'Add Doctor'}</h3><button data-action="close-doctor-editor">${iconHtml('x',18,'text-stone-400')}</button></div>
      <div class="space-y-3">
        ${f('name','Name *','e.g. Dr. Sayantani Sarkar')}
        <div class="grid grid-cols-2 gap-3">${f('specialty','Specialty','e.g. Cardiology')}${f('phone','Phone','e.g. 98xxxxxxxx','tel')}</div>
        ${f('hospital','Hospital / clinic','e.g. Manipal Hospital')}
        ${f('notes','Notes','optional')}
      </div>
      <div class="flex gap-3 mt-5">
        ${isEdit?`<button data-action="doctor-delete" data-id="${ed.id}" class="py-3 px-4 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold">${iconHtml('trash-2',15)}</button>`:''}
        <button data-action="close-doctor-editor" class="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-500">Cancel</button>
        <button id="doc-save" class="flex-1 py-3 text-white rounded-xl text-sm font-bold hover:opacity-90" style="background:${C.teal}">${isEdit?'Save':'Add'}</button>
      </div>
    </div>
  </div>`;
}

// ═════════════════════════════════════════
//  HOME  (weekly AI health card + family precautions + quick links)
// ═════════════════════════════════════════
function daysSince(iso) { if (!iso) return Infinity; return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function renderHome() {
  const insights = state.homeInsights;
  const content = insights?.content;
  const staleDays = insights ? daysSince(insights.generatedAt) : Infinity;
  const members = activeMembers();

  const dueCount = state.allFollowups.filter(f => f.status==='pending' && ['overdue','week'].includes(fuBucket(f.dueDate))).length;
  const toClaim = state.allRecords.filter(r => (r.claimStatus||'none')==='to_claim').length;
  const threadCount = state.allEpisodes.length;

  const quickLinks = [
    { page:'records', icon:'file-text', label:'Records', sub:`${state.allRecords.length} documents · ${threadCount} threads` },
    { page:'upcoming', icon:'calendar-check', label:'Upcoming', sub: dueCount ? `${dueCount} due soon` : 'All caught up', hi: dueCount>0 },
    { page:'trends', icon:'trending-up', label:'Compare Reports', sub:'Track lab values over time' },
    { page:'spending', icon:'dollar-sign', label:'Spending', sub: toClaim ? `${toClaim} to claim` : 'Track family spend', hi: toClaim>0 },
    { page:'medicines', icon:'pill', label:'Medicines', sub:`${state.allMedicines.filter(x=>x.active).length} active` },
    { page:'doctors', icon:'stethoscope', label:'Doctors', sub:`${state.allDoctors.length} saved` },
  ];

  const memberCards = members.map(mem => {
    const mi = content?.members?.find(x => x.mid === mem.id);
    const stable = mem.age ? milestonesForAge(mem.age) : [];
    return `<div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-black flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div>
        <div><p class="font-bold text-stone-900 text-sm">${esc(mem.name)}</p><p class="text-xs text-stone-400">${mem.age?`${mem.age}y · `:''}${esc(mem.role)}${(mem.conditions||[]).length?` · ${esc(mem.conditions.slice(0,2).join(', '))}`:''}</p></div>
      </div>
      ${mi?.note ? `<p class="text-sm text-stone-700 mb-3">${esc(mi.note)}</p>` : ''}
      ${mi?.precautions?.length ? `<div class="mb-3"><p class="text-xs font-black text-stone-400 uppercase tracking-wide mb-1.5">Worth watching, given their history</p><div class="space-y-1">${mi.precautions.map(p=>`<div class="flex items-start gap-1.5 text-xs text-stone-600"><span class="text-teal-500 mt-0.5">${iconHtml('circle-dot',10)}</span>${esc(p)}</div>`).join('')}</div></div>` : ''}
      ${stable.length ? `<div><p class="text-xs font-black text-stone-400 uppercase tracking-wide mb-1.5">${mem.age?`${mem.age >= 60 ? 'Age 60+' : mem.age >= 50 ? '50s' : mem.age >= 40 ? '40s' : mem.age >= 30 ? '30s' : 'Standard'} checklist`:'General checklist'}</p><div class="grid grid-cols-1 gap-1">${stable.map(s=>`<div class="flex items-start gap-1.5 text-xs text-stone-500"><span class="text-stone-300 mt-0.5">${iconHtml('check',10)}</span>${esc(s)}</div>`).join('')}</div></div>` : `<p class="text-xs text-stone-300">Add ${esc(mem.name.split(' ')[0])}'s age in Family settings to see age-appropriate checks.</p>`}
    </div>`;
  }).join('');

  return `<div class="fade-in max-w-2xl">
    <!-- Weekly tip banner (illustration-style, not a photo) -->
    <div class="rounded-2xl p-5 mb-4 relative overflow-hidden" style="background:linear-gradient(135deg,${C.teal}15,${C.violet}12)">
      <div class="flex items-start gap-3">
        <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:${C.teal}">${iconHtml('sparkles',20,'text-white')}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-xs font-black uppercase tracking-wide" style="color:${C.teal}">Tip of the week</p>
            ${state.homeGenerating?badgeHtml('Updating…','bg-white/60 text-stone-500'):''}
          </div>
          <p class="font-bold text-stone-900 mt-0.5">${content?.weeklyTip?.title ? esc(content.weeklyTip.title) : (state.homeGenerating ? "Putting together your family's weekly update…" : 'Tap refresh to generate your first weekly update')}</p>
          ${content?.weeklyTip?.text ? `<p class="text-sm text-stone-600 mt-1">${esc(content.weeklyTip.text)}</p>` : ''}
        </div>
      </div>
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-stone-900/5">
        <p class="text-xs text-stone-400">${insights ? `Updated ${staleDays===0?'today':staleDays===1?'yesterday':staleDays+' days ago'}` : 'Not generated yet'}</p>
        <button data-action="refresh-home" ${state.homeGenerating?'disabled':''} class="flex items-center gap-1.5 text-xs font-bold hover:underline disabled:opacity-50" style="color:${C.teal}">${iconHtml('refresh-cw',12,state.homeGenerating?'animate-spin':'')} Refresh</button>
      </div>
    </div>

    <!-- Quick links -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
      ${quickLinks.map(l => `<button data-action="goto" data-page="${l.page}" class="text-left bg-white rounded-xl border ${l.hi?'border-amber-200':'border-stone-100'} shadow-sm p-3 hover:shadow-md transition-shadow">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style="background:${l.hi?'#fef3c7':C.teal+'1a'}">${iconHtml(l.icon,15,l.hi?'text-amber-600':'')}</div>
        <p class="text-xs font-bold text-stone-800">${l.label}</p>
        <p class="text-xs ${l.hi?'text-amber-600 font-semibold':'text-stone-400'} mt-0.5">${l.sub}</p>
      </button>`).join('')}
    </div>

    <!-- Per-person precautions -->
    <p class="text-xs font-black text-stone-400 uppercase tracking-wider mb-2">For your family</p>
    <div class="space-y-3">${memberCards}</div>
    <p class="text-xs text-stone-300 text-center mt-4">General preventive-care information, personalized to what's on file — always confirm with a doctor.</p>
  </div>`;
}

async function maybeRefreshHomeInsights() {
  if (state.homeGenerating) return;
  const staleDays = state.homeInsights ? daysSince(state.homeInsights.generatedAt) : Infinity;
  if (staleDays >= 7) await generateHomeInsights();
}

async function generateHomeInsights() {
  if (!state.session || activeMembers().length === 0) return;
  setState({ homeGenerating: true });
  const members = activeMembers().map(mem => {
    // Pull any currently out-of-range test names for this member (grounds the AI in real data)
    const flags = [];
    try {
      const recs = state.allRecords.filter(r => r.mid === mem.id && r.extracted?.keyValues?.length);
      const seen = {};
      recs.forEach(r => r.extracted.keyValues.forEach(kv => {
        if (kv.status === 'high' || kv.status === 'low' || kv.status === 'critical') {
          const nm = kv.std || kv.name; if (nm && !seen[nm]) { seen[nm] = true; flags.push(nm); }
        }
      }));
    } catch (e) {}
    return { mid: mem.id, name: mem.name, age: mem.age || null, gender: mem.gender || null, conditions: mem.conditions || [], recentFlags: flags.slice(0,6) };
  });

  const prompt = `You are a calm, knowledgeable family-health guide writing a weekly card for a caregiver in India managing multiple family members' health. For EACH person below, using ONLY their age, gender, known conditions, and recently-flagged lab values, write:
- "note": one warm, specific sentence connecting their profile to what to focus on right now (not generic filler)
- "precautions": 2-4 short bullet points of things worth watching or asking a doctor about, tied to THEIR actual conditions/flags where possible (may include general Indian-context options like yoga/walking/diet patterns, or specific tests). Never invent conditions they don't have. Never give drug names, dosages, or diagnoses.

Also write ONE shared "weeklyTip": {"title": short catchy title, "text": one practical, general wellness tip (1-2 sentences) suitable for the whole family, India-appropriate (diet, movement, sleep, seasonal, or preventive-care awareness). Vary the theme each time — do not always pick the same topic.

Respond with ONLY this JSON, no markdown, no commentary:
{"weeklyTip":{"title":"","text":""},"members":[{"mid":"...","note":"...","precautions":["...","..."]}]}

Family:
${JSON.stringify(members, null, 0)}`;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST', headers: AI_HEADERS,
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await res.json();
    let text = (d.content?.[0]?.text || '').trim();
    text = text.replace(/^```json\s*|^```\s*|```$/g, '').trim();
    const parsed = JSON.parse(text);
    await db.saveHomeInsights(state.session.user.id, parsed);
    setState({ homeGenerating: false, homeInsights: { content: parsed, generatedAt: new Date().toISOString() } });
  } catch (e) {
    console.error('Home insight generation failed', e);
    setState({ homeGenerating: false });
    showToast('Could not refresh the weekly update — try again');
  }
}

// ── Settings page ──
function renderSettings() {
  const email = state.session?.user?.email || '';
  // App-side AI usage estimate: count AI-analysed docs + chat messages
  const aiDocs = state.allRecords.filter(r => r.source === 'upload').length;
  const chatMsgs = Math.floor((state.chatMsgs?.length || 0) / 2);
  const estCost = (aiDocs * 3 + chatMsgs * 1.5); // rough ₹ estimate per call
  return `<div class="space-y-5 fade-in max-w-2xl">
    <h1 class="text-xl md:text-2xl font-bold text-stone-900">Settings</h1>

    <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
      <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">Account</p>
      <div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-black" style="background:${C.teal}">${esc((email[0]||'?').toUpperCase())}</div><div><p class="font-bold text-stone-800 text-sm">${esc(email)}</p><p class="text-xs text-stone-400">Super-owner · manages all members</p></div></div>
      <button data-action="sign-out" class="w-full py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-2">${iconHtml('log-out',15)} Sign Out</button>
    </div>

    <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
      <div class="flex items-center justify-between mb-3"><p class="text-xs font-bold text-stone-400 uppercase tracking-wide">Family Members (${activeMembers().length})</p><button data-action="open-member-add" class="text-xs font-bold text-teal-600 hover:underline flex items-center gap-1">${iconHtml('plus',12)} Add</button></div>
      <div class="space-y-2">
        ${activeMembers().map(m=>`<div class="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0" style="background:${m.color}">${m.avatar}</div>
          <div class="flex-1 min-w-0"><p class="font-semibold text-stone-800 text-sm">${esc(m.name)}</p><p class="text-xs text-stone-400">${esc(m.role)}</p></div>
          <button data-action="open-member-edit" data-id="${m.id}" class="p-1.5 rounded-lg hover:bg-white text-stone-400" title="Edit">${iconHtml('pencil',14)}</button>
          <button data-action="archive-member" data-id="${m.id}" class="p-1.5 rounded-lg hover:bg-white text-stone-400" title="Hide">${iconHtml('eye-off',14)}</button>
          <button data-action="delete-member" data-id="${m.id}" class="p-1.5 rounded-lg hover:bg-white text-rose-400" title="Delete">${iconHtml('trash-2',14)}</button>
        </div>`).join('')}
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
      <p class="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">AI Usage (this device)</p>
      <div class="flex items-center gap-4">
        <div><p class="text-2xl font-black text-stone-900">${aiDocs}</p><p class="text-xs text-stone-400">Documents analysed</p></div>
        <div class="h-10 w-px bg-stone-100"></div>
        <div><p class="text-2xl font-black text-stone-900">${chatMsgs}</p><p class="text-xs text-stone-400">AI Doctor chats</p></div>
        <div class="h-10 w-px bg-stone-100"></div>
        <div><p class="text-2xl font-black text-stone-900">≈₹${estCost}</p><p class="text-xs text-stone-400">Est. spend</p></div>
      </div>
      <p class="text-xs text-stone-400 mt-3">A rough estimate based on activity in this session. For your exact API balance, check console.anthropic.com → Billing.</p>
    </div>
  </div>`;
}

// ─────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────
const NAV = [
  { id:'home', label:'Home', icon:'home' },
  { id:'records', label:'Medical Records', icon:'file-text' },
  { id:'upcoming', label:'Upcoming', icon:'calendar-check' },
  { id:'trends', label:'Trends', icon:'trending-up' },
  { id:'medicines', label:'Medicines', icon:'pill' },
  { id:'spending', label:'Spending', icon:'dollar-sign' },
  { id:'doctors', label:'Doctors', icon:'stethoscope' },
  { id:'aidoctor', label:'AI Doctor', icon:'brain', badge:'AI' },
  { id:'family', label:'Family', icon:'user' },
  { id:'settings', label:'Settings', icon:'settings' },
];
const MOBILE_MAIN = [
  { id:'home', label:'Home', icon:'home' },
  { id:'records', label:'Records', icon:'file-text' },
  { id:'upcoming', label:'Upcoming', icon:'calendar-check' },
  { id:'trends', label:'Trends', icon:'trending-up' },
  { id:'spending', label:'Spending', icon:'dollar-sign' },
];
const MOBILE_MORE = [
  { id:'medicines', label:'Medicines', icon:'pill', desc:'Per-person + reminders' },
  { id:'doctors', label:'Doctors', icon:'stethoscope', desc:'Directory + phone numbers' },
  { id:'aidoctor', label:'AI Doctor', icon:'brain', desc:'Ask about your records' },
  { id:'family', label:'Family', icon:'user', desc:'All members' },
  { id:'settings', label:'Settings', icon:'settings', desc:'Account, AI usage' },
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
  const onMore = MOBILE_MORE.some(n => n.id === state.page);
  return `<nav class="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100 flex md:hidden">
    ${MOBILE_MAIN.map(n => `<button data-action="goto" data-page="${n.id}" class="flex-1 flex flex-col items-center gap-0.5 py-2 min-w-0 px-0.5" style="color:${state.page===n.id?C.teal:'#94a3b8'}">${iconHtml(n.icon,18)}<span class="text-[10px] font-bold truncate">${n.label}</span></button>`).join('')}
    <button data-action="open-more" class="flex-1 flex flex-col items-center gap-0.5 py-2 min-w-0 px-0.5" style="color:${onMore?C.teal:'#94a3b8'}">${iconHtml('more-horizontal',18)}<span class="text-[10px] font-bold">More</span></button>
  </nav>`;
}

function renderMoreSheet() {
  if (!state.moreSheetOpen) return '';
  return `<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:hidden" id="more-sheet-backdrop">
    <div class="bg-white w-full rounded-t-3xl shadow-2xl p-5">
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
  const label = state.familyView ? 'Whole Family' : (m ? m.name : '');
  const sublabel = state.familyView ? `${activeMembers().length} members` : (m ? m.role : '');
  const memberMenuHtml = state.memberMenuOpen ? `
    <div class="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 z-50 w-72">
      <button data-action="view-family" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors ${state.familyView?'bg-teal-50':''}">
        <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:${C.teal}1a">${iconHtml('users',18,'')}</div>
        <div class="flex-1 text-left"><p class="text-sm font-bold text-stone-900">Whole Family</p><p class="text-xs text-stone-400">Everyone together</p></div>
        ${state.familyView?iconHtml('check-circle',15):''}
      </button>
      <div class="border-t border-stone-100 my-1"></div>
      <p class="text-xs font-black text-stone-400 uppercase tracking-wider px-3 py-1.5">Individuals</p>
      ${activeMembers().map(mem => `<button data-action="switch-member" data-id="${mem.id}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors ${!state.familyView && state.currentId===mem.id?'bg-teal-50':''}">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div>
        <div class="flex-1 text-left"><p class="text-sm font-bold text-stone-900">${esc(mem.name)}</p><p class="text-xs text-stone-400">${esc(mem.role)}${mem.age?` · ${mem.age}y`:''}</p></div>
        ${!state.familyView && state.currentId===mem.id?iconHtml('check-circle',15):''}
      </button>`).join('')}
      <div class="border-t border-stone-100 mt-2 pt-2"><button data-action="open-member-add" class="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl hover:bg-stone-50" style="color:${C.teal}">${iconHtml('plus',14)} Add Family Member</button></div>
    </div>` : '';
  return `<header class="bg-white border-b border-stone-100 px-4 md:px-5 h-14 flex items-center justify-between flex-shrink-0 z-20">
    <div class="relative">
      <button data-action="toggle-membermenu" class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style="background:${state.familyView?C.teal:(m?m.color:C.teal)}">${state.familyView?iconHtml('users',14,'text-white'):(m?m.avatar:'?')}</div>
        <div class="text-left hidden sm:block"><p class="text-sm font-black text-stone-900 leading-tight">${esc(label)}</p><p class="text-xs text-stone-400 leading-tight">${esc(sublabel)}</p></div>
        <p class="text-sm font-black text-stone-900 sm:hidden">${esc(state.familyView?'Family':label.split(' ')[0])}</p>
        ${iconHtml('chevron-down',13,'text-stone-400')}
      </button>
      ${memberMenuHtml}
    </div>
    <div class="flex items-center gap-1">
      <button data-action="goto" data-page="upcoming" class="relative p-2.5 rounded-xl hover:bg-stone-50" title="What's coming up">${iconHtml('bell',18,'text-stone-400')}${(() => { const due = (state.allFollowups||[]).filter(f => f.status==='pending' && ['overdue','week'].includes(fuBucket(f.dueDate))).length; return due ? `<span class="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-rose-500 rounded-full text-white text-[10px] font-black flex items-center justify-center">${due>9?'9+':due}</span>` : ''; })()}</button>
      <button data-action="goto" data-page="settings" class="p-2.5 rounded-xl hover:bg-stone-50 hidden md:flex">${iconHtml('settings',18,'text-stone-400')}</button>
      <button data-action="goto" data-page="settings" class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black ml-1" style="background:${C.teal}">${esc((state.session?.user?.email?.[0]||'S').toUpperCase())}</button>
    </div>
  </header>`;
}

function renderPageContent() {
  // Per-person pages need a selected member. In Whole-Family view, prompt to pick one (Option A).
  const perPersonPages = ['dashboard', 'healthplan', 'dailylog', 'metrics', 'trends', 'medicines'];
  if (state.familyView && perPersonPages.includes(state.page)) {
    return renderPickPerson();
  }
  switch (state.page) {
    case 'dashboard': return renderDashboard();
    case 'home': return renderHome();
    case 'records': return renderRecords();
    case 'upcoming': return renderUpcoming();
    case 'trends': return renderTrends();
    case 'medicines': return renderMedicines();
    case 'doctors': return renderDoctors();
    case 'healthplan': return renderHealthPlan();
    case 'dailylog': return renderDailyLog();
    case 'spending': return renderSpending();
    case 'aidoctor': return renderAIDoctor();
    case 'metrics': return renderMetrics();
    case 'family': return renderFamily();
    case 'settings': return renderSettings();
    default: return renderRecords();
  }
}

function renderPickPerson() {
  const pageLabel = { dashboard: 'Dashboard', healthplan: 'Health Plan', dailylog: 'Daily Log', metrics: 'Metrics' }[state.page] || 'This view';
  return `<div class="fade-in max-w-md mx-auto pt-8 text-center">
    <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background:${C.teal}1a">${iconHtml('users',26,'')}</div>
    <h1 class="text-xl font-bold text-stone-900">${pageLabel} is per person</h1>
    <p class="text-sm text-stone-500 mt-1 mb-6">You're viewing the whole family. Pick a person to see their ${pageLabel.toLowerCase()}.</p>
    <div class="space-y-2 text-left">
      ${activeMembers().map(mem => `<button data-action="pick-person" data-id="${mem.id}" class="w-full flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-black flex-shrink-0" style="background:${mem.color}">${mem.avatar}</div>
        <div class="flex-1 text-left"><p class="font-bold text-stone-900 text-sm">${esc(mem.name)}</p><p class="text-xs text-stone-400">${esc(mem.role)}${mem.age?` · ${mem.age}y`:''}</p></div>
        ${iconHtml('chevron-right',16,'text-stone-300')}
      </button>`).join('')}
    </div>
  </div>`;
}

function renderMainApp() {
  // Modals rendered at top level so they appear regardless of which page is active
  // (fixes filing UI vanishing when upload completes from any page).
  const globalModals = `
    ${state.uploadModal ? renderUploadModal() : ''}
    ${state.fileModal ? renderFileModal() : ''}
    ${state.episodeEditor ? renderEpisodeEditor() : ''}
    ${state.memberEditor ? renderMemberEditor() : ''}
    ${state.followupEditor ? renderFollowupEditor() : ''}
    ${state.medicineEditor ? renderMedicineEditor() : ''}
    ${state.doctorEditor ? renderDoctorEditor() : ''}
  `;
  return `<div class="flex h-screen bg-stone-50 overflow-hidden" id="app-root">
    ${renderSidebar()}
    <div class="flex-1 flex flex-col overflow-hidden">
      ${renderHeader()}
      <main class="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">${renderPageContent()}</main>
    </div>
    ${renderBottomNav()}
    ${renderMoreSheet()}
    ${globalModals}
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
  // Keep upload file inputs wired across re-renders (select + manual phases)
  const ph = state.uploadModal?.phase;
  if (ph === 'select' || ph === 'manual') wireUploadModalInputs();
}

function mountChartsForCurrentPage() {
  if (!state.session || state.members.length === 0) return;
  if (state.page === 'dashboard') mountDashboardCharts();
  if (state.page === 'spending') mountSpendingCharts();
  if (state.page === 'metrics') mountMetricsChart();
  if (state.page === 'trends') mountTrendsCharts();
}

// ─────────────────────────────────────────
//  EVENT DELEGATION  (single listener handles all clicks)
// ─────────────────────────────────────────
document.addEventListener('change', (e) => {
  if (e.target.id === 'cmp-a') {
    setState({ compareRepA: e.target.value || null, compareRepB: null, compareRun: false, compareInsight: null });
  } else if (e.target.id === 'cmp-b') {
    setState({ compareRepB: e.target.value || null, compareRun: false, compareInsight: null });
  }
});
document.addEventListener('click', async (e) => {
  // Outside-click-to-close for modals that use the backdrop-id pattern
  // (clicking the backdrop itself closes; clicks on inner content don't reach here)
  if (e.target.id === 'record-detail-backdrop') { setState({ recordSelectedId: null }); return; }
  if (e.target.id === 'more-sheet-backdrop') { setState({ moreSheetOpen: false }); return; }
  if (e.target.id === 'compare-backdrop') { setState({ compareModal: null, compareInsight: null }); return; }

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
      if (el.dataset.page === 'home') maybeRefreshHomeInsights();
      break;
    case 'refresh-home':
      await generateHomeInsights();
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
      state.familyView = false;
      await switchMember(el.dataset.id);
      setState({ memberMenuOpen: false });
      break;
    case 'view-family':
      setState({ familyView: true, memberMenuOpen: false });
      break;
    // ── Follow-ups (Layer 3) ──
    case 'followup-add':
      setState({ followupEditor: { mid: state.familyView ? (activeMembers()[0]?.id) : state.currentId, kind: 'review', title: '', dueDate: '', notes: '' } });
      break;
    case 'followup-edit': {
      const f = state.allFollowups.find(x => x.id === el.dataset.id);
      if (f) setState({ followupEditor: { id: f.id, mid: f.mid, kind: f.kind, title: f.title, dueDate: f.dueDate || '', notes: f.notes || '' } });
      break;
    }
    case 'close-followup-editor':
      setState({ followupEditor: null });
      break;
    case 'followup-done':
      await handleFollowupDone(el.dataset.id);
      break;
    case 'followup-delete':
      await handleFollowupDelete(el.dataset.id);
      break;
    case 'followup-calendar': {
      const f = state.allFollowups.find(x => x.id === el.dataset.id);
      if (f) { window.open(gcalUrl(f, memberById(f.mid)), '_blank'); }
      break;
    }
    case 'pick-person':
      state.familyView = false;
      await switchMember(el.dataset.id);
      setState({ memberMenuOpen: false });
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

    // ── Add Member (legacy modal, still supported) ──
    case 'open-addmember':
      setState({ addMemberModal: true });
      break;
    case 'close-addmember':
      setState({ addMemberModal: false });
      break;

    // ── Member management (new) ──
    case 'open-member-add':
      setState({ memberEditor: { name: '', role: 'Family', gender: 'Female' }, memberMenuFor: null, moreSheetOpen: false });
      break;
    case 'open-member-edit': {
      const mem = memberById(el.dataset.id);
      if (mem) setState({ memberEditor: { id: mem.id, name: mem.name, role: mem.role, age: mem.age, gender: mem.gender, blood: mem.blood, height: mem.height, weight: mem.weight, bp: mem.bp==='—'?'':mem.bp, hba1c: mem.hba1c==='—'?'':mem.hba1c, conditionsText: (mem.conditions||[]).join(', ') }, memberMenuFor: null });
      break;
    }
    case 'close-member-editor':
      setState({ memberEditor: null });
      break;
    case 'member-menu':
      setState({ memberMenuFor: state.memberMenuFor === el.dataset.id ? null : el.dataset.id });
      break;
    case 'archive-member':
      await handleArchiveMember(el.dataset.id, true);
      break;
    case 'unarchive-member':
      await handleArchiveMember(el.dataset.id, false);
      break;
    case 'delete-member':
      await handleDeleteMember(el.dataset.id);
      break;
    case 'view-member-records':
      state.familyView = false;
      await switchMember(el.dataset.id);
      setState({ page: 'records', memberMenuFor: null, recordsView: 'time' });
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
      if (state.uploadModal?.file) {
        // Re-run AI on the same file
        setState({ uploadModal: { ...state.uploadModal, phase: 'analysing', pct: 5, progressMsg: 'Reading your file…' } });
        runUploadAnalysis(state.uploadModal.file);
      } else {
        setState({ uploadModal: { phase: 'select', file: null, ext: null, pct: 0, progressMsg: '', errMsg: '', mismatchName: '', uploading: false } });
        setTimeout(wireUploadModalInputs, 30);
      }
      break;
    case 'upload-manual': {
      // Switch to manual entry, prefilling anything the AI managed to read; keep any selected file
      const um = state.uploadModal || {};
      const ext = um.ext || {};
      const manual = { title: ext.title || '', type: ext.docType || 'report', date: ext.date || new Date().toISOString().slice(0,10), amount: ext.amount || '', doctor: ext.doctor || '', hospital: ext.hospital || '', summary: ext.summary || '' };
      const target = state.uploadTargetId || state.lastUploadMemberId || state.currentId;
      setState({ uploadModal: { ...um, phase: 'manual', manual, uploading: false }, uploadTargetId: target });
      setTimeout(wireUploadModalInputs, 30);
      break;
    }
    case 'manual-remove-file': {
      const cur = captureManualFields();
      setState({ uploadModal: { ...state.uploadModal, file: null, manual: { ...state.uploadModal.manual, ...cur } } });
      setTimeout(wireUploadModalInputs, 30);
      break;
    }
    case 'save-upload':
      saveUploadRecord(el.dataset.memberId);
      break;
    case 'set-upload-mode':
      setState({ uploadModal: { ...state.uploadModal, uploadMode: el.dataset.mode } });
      setTimeout(wireUploadModalInputs, 30);
      break;
    case 'set-upload-target':
      // In manual phase, capture typed fields first so tapping a member chip doesn't wipe them
      if (state.uploadModal?.phase === 'manual') {
        const cur = captureManualFields();
        setState({ uploadTargetId: el.dataset.id, uploadModal: { ...state.uploadModal, manual: { ...state.uploadModal.manual, ...cur } } });
      } else {
        setState({ uploadTargetId: el.dataset.id });
      }
      break;
    case 'upload-add-member': {
      // open member editor prefilled with the AI-detected name; on save it becomes the upload target
      const detected = state.uploadModal?.ext?.patientName || '';
      setState({ memberEditor: { name: detected, role: 'Family', gender: 'Female', fromUpload: true } });
      break;
    }

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
    case 'view-original':
      await handleViewOriginal(el.dataset.id);
      break;

    // ── Episodes / threads ──
    case 'records-view':
      setState({ recordsView: el.dataset.view });
      if (el.dataset.view === 'episodes') { silentCleanupEmptyThreads(); }
      break;
    case 'open-episode':
      setState({ openEpisodeId: el.dataset.id, recordSelectedId: null });
      break;
    case 'close-episode':
      setState({ openEpisodeId: null });
      break;
    case 'new-episode':
      setState({ episodeEditor: { title: '', status: 'active', description: '' } });
      break;
    case 'edit-episode': {
      const ep = episodeById(el.dataset.id);
      if (ep) setState({ episodeEditor: { id: ep.id, mid: ep.mid, title: ep.title, status: ep.status, description: ep.description || '' } });
      break;
    }
    case 'close-episode-editor':
      setState({ episodeEditor: null });
      break;
    case 'ep-editor-status':
      state.episodeEditor.status = el.dataset.status;
      render();
      break;
    case 'delete-episode':
      await handleDeleteEpisode(el.dataset.id);
      break;
    case 'file-record':
      openFileModal(el.dataset.id);
      break;
    case 'move-patient':
      setState({ movePatientFor: state.movePatientFor === el.dataset.id ? null : el.dataset.id });
      break;
    case 'edit-record-date':
      setState({ editingRecordDate: el.dataset.id });
      break;
    case 'cancel-record-date':
      setState({ editingRecordDate: null });
      break;
    case 'save-record-date':
      await handleSaveRecordDate(el.dataset.id);
      break;
    case 'edit-record-amount':
      setState({ editingRecordAmount: el.dataset.id });
      break;
    case 'cancel-record-amount':
      setState({ editingRecordAmount: null });
      break;
    case 'save-record-amount':
      await handleSaveRecordAmount(el.dataset.id);
      break;
    case 'clear-record-amount':
      await handleClearRecordAmount(el.dataset.id);
      break;
    case 'spend-filter':
      setState({ spendFilter: el.dataset.id });
      break;
    case 'run-compare':
      setState({ compareRun: true, compareInsight: null });
      break;
    case 'share-comparison':
      await handleShareComparison();
      break;
    case 'print-comparison':
      handlePrintComparison();
      break;
    case 'compare-insight':
      await handleCompareInsight();
      break;
    // ── Medicines ──
    case 'medicine-add':
      setState({ medicineEditor: { mid: state.currentId, name:'', dose:'', freq:'', timing:'', purpose:'' } });
      break;
    case 'medicine-edit': {
      const md = state.allMedicines.find(x => x.id === el.dataset.id);
      if (md) setState({ medicineEditor: { ...md } });
      break;
    }
    case 'close-medicine-editor':
      setState({ medicineEditor: null });
      break;
    case 'medicine-delete':
      await handleDeleteMedicine(el.dataset.id);
      break;
    // ── Doctors ──
    case 'doctor-add':
      setState({ doctorEditor: { name:'', specialty:'', hospital:'', phone:'', notes:'' } });
      break;
    case 'doctor-add-suggested':
      setState({ doctorEditor: { name: el.dataset.name, hospital: el.dataset.hospital || '', specialty:'', phone:'', notes:'' } });
      break;
    case 'doctor-edit': {
      const dc = state.allDoctors.find(x => x.id === el.dataset.id);
      if (dc) setState({ doctorEditor: { ...dc } });
      break;
    }
    case 'close-doctor-editor':
      setState({ doctorEditor: null });
      break;
    case 'doctor-delete':
      await handleDeleteDoctor(el.dataset.id);
      break;
    case 'cycle-claim':
      await handleCycleClaim(el.dataset.id);
      break;
    case 'do-move-patient':
      await handleMovePatient(el.dataset.record, el.dataset.member);
      break;
    case 'close-file-modal':
      setState({ fileModal: null });
      break;
    case 'file-to-episode':
      await handleFileRecord(state.fileModal.recordId, el.dataset.id);
      break;
    case 'file-to-none':
      await handleFileRecord(state.fileModal.recordId, null);
      break;
    case 'file-to-new':
      await handleFileToNewEpisode(state.fileModal.recordId, state.fileModal.proposedNewTitle);
      break;
    case 'file-to-new-blank':
      // close file modal, open episode editor; after creating, the record stays selected for filing
      setState({ episodeEditor: { title: '', status: 'active', description: '', fileRecordId: state.fileModal.recordId }, fileModal: null });
      break;
    case 'unfile-record':
      await handleFileRecord(el.dataset.id, null);
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
  if (e.target.id === 'me-save') handleSaveMember();
  if (e.target.id === 'fu-save') handleSaveFollowup();
  if (e.target.id === 'man-save') handleSaveManual();
  if (e.target.id === 'med-save') handleSaveMedicine();
  if (e.target.id === 'doc-save') handleSaveDoctor();
  if (e.target.id === 'dl-save') handleSaveDailyLog();
  if (e.target.id === 'metric-save') handleSaveMetric();
  if (e.target.id === 'ep-save') handleSaveEpisode();
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
    dropzone.ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePickedFile(f); };
  }
  if (fileInput) fileInput.onchange = (e) => { const f = e.target.files?.[0]; if (f) handlePickedFile(f); };
  if (camBtn && camInput) camBtn.onclick = () => camInput.click();
  if (camInput) camInput.onchange = (e) => { const f = e.target.files?.[0]; if (f) handlePickedFile(f); };
  // Manual-phase attach (stores the file WITHOUT triggering AI)
  const manFile = document.getElementById('man-file-input');
  const manCam = document.getElementById('man-camera-input');
  const manFileBtn = document.getElementById('man-file-btn');
  const manCamBtn = document.getElementById('man-camera-btn');
  if (manFileBtn && manFile) manFileBtn.onclick = () => manFile.click();
  if (manFile) manFile.onchange = (e) => { const f = e.target.files?.[0]; if (f) attachManualFile(f); };
  if (manCamBtn && manCam) manCamBtn.onclick = () => manCam.click();
  if (manCam) manCam.onchange = (e) => { const f = e.target.files?.[0]; if (f) attachManualFile(f); };
}

// A file was picked on the select screen — route by mode: AI reads it, or open the manual form with it attached.
function handlePickedFile(f) {
  if (state.uploadModal?.uploadMode === 'manual') {
    openManualWithFile(f);
  } else {
    runUploadAnalysis(f);
  }
}
// Open the manual details form with a file already attached (no AI).
function openManualWithFile(f) {
  const um = state.uploadModal || {};
  const manual = { title: '', type: 'report', date: new Date().toISOString().slice(0,10), amount: '', doctor: '', hospital: '', summary: '' };
  const target = state.uploadTargetId || state.lastUploadMemberId || state.currentId;
  setState({ uploadModal: { ...um, phase: 'manual', file: f, manual, uploading: false }, uploadTargetId: target });
  setTimeout(wireUploadModalInputs, 30);
}

// Attach (or replace) a file in the manual entry form. Preserves whatever fields are already typed.
function attachManualFile(f) {
  const cur = captureManualFields();
  setState({ uploadModal: { ...state.uploadModal, file: f, manual: { ...state.uploadModal.manual, ...cur } } });
  setTimeout(wireUploadModalInputs, 30);
}
// Read the manual form fields from the DOM so they survive a re-render
function captureManualFields() {
  const g = k => document.getElementById('man-' + k)?.value;
  return { title: g('title'), type: g('type'), date: g('date'), amount: g('amount'), doctor: g('doctor'), hospital: g('hospital'), summary: g('summary') };
}

// ─────────────────────────────────────────
//  MEMBER / RECORD / LOG ACTIONS
// ─────────────────────────────────────────
async function switchMember(memberId) {
  setState({ currentId: memberId, records: [], logs: [], metrics: [], episodes: [], openEpisodeId: null });
  await loadMemberData(memberId);
}
async function loadMemberData(memberId) {
  try {
    const [records, logs, metrics, episodes] = await Promise.all([db.getRecords(memberId), db.getLogs(memberId), db.getMetrics(memberId), db.getEpisodes(memberId)]);
    setState({ records, logs, metrics, episodes });
  } catch (e) { console.error(e); }
}
// Family-wide records + episodes (all members) for the Records page
async function loadFamilyData() {
  if (!state.session) return;
  try {
    const [allRecords, allEpisodes, allFollowups, allMedicines, allDoctors, homeInsights] = await Promise.all([
      db.getAllRecords(state.session.user.id),
      db.getAllEpisodes(state.session.user.id),
      db.getAllFollowups(state.session.user.id),
      db.getAllMedicines(state.session.user.id).catch(() => []),
      db.getAllDoctors(state.session.user.id).catch(() => []),
      db.getHomeInsights(state.session.user.id).catch(() => null),
    ]);
    setState({ allRecords, allEpisodes, allFollowups, allMedicines, allDoctors, homeInsights });
  } catch (e) { console.error(e); }
}
// Look up a record family-wide (falls back to current-member list)
function anyRecord(id) { return state.allRecords.find(r => r.id === id) || state.records.find(r => r.id === id); }

async function handleDeleteRecord(id) {
  if (!confirm('Delete this record?')) return;
  setState({ recordDeleting: id });
  try {
    await db.deleteRecord(id);
    await loadFamilyData();
    setState({
      records: state.records.filter(r => r.id !== id),
      recordDeleting: null,
      recordSelectedId: state.recordSelectedId === id ? null : state.recordSelectedId,
    });
  } catch { setState({ recordDeleting: null }); }
}

async function handleViewOriginal(id) {
  const rec = anyRecord(id);
  if (!rec || !rec.filePath) { showToast('No original file stored for this record'); return; }
  showToast('Opening document…');
  try {
    const url = await db.getSignedUrl(rec.filePath);
    window.open(url, '_blank');
  } catch (e) {
    showToast('Could not open the file — try again');
  }
}

async function handleMovePatient(recordId, memberId) {
  try {
    await db.setRecordMember(recordId, memberId);
    await loadFamilyData();
    const mem = memberById(memberId);
    setState({ movePatientFor: null, recordSelectedId: null, records: state.records.filter(r => r.id !== recordId) });
    showToast(`Moved to ${mem ? mem.name.split(' ')[0] : 'member'} ✓`);
  } catch (e) { showToast('Could not move — try again'); }
}

async function handleSaveRecordDate(recordId) {
  const newDate = document.getElementById('record-date-input')?.value;
  if (!newDate) { showToast('Please pick a date'); return; }
  try {
    await db.updateRecordFields(recordId, { date: newDate });
    await loadFamilyData();
    // keep local per-member list in sync
    const patch = r => r.id === recordId ? { ...r, date: newDate } : r;
    setState({ editingRecordDate: null, records: state.records.map(patch) });
    showToast('Date updated ✓');
  } catch (e) { showToast('Could not update date — try again'); }
}

async function handleSaveRecordAmount(recordId) {
  const raw = document.getElementById('record-amount-input')?.value;
  const amount = raw === '' || raw == null ? null : parseFloat(raw);
  try {
    await db.updateRecordFields(recordId, { amount });
    await loadFamilyData();
    const patch = r => r.id === recordId ? { ...r, amount } : r;
    setState({ editingRecordAmount: null, records: state.records.map(patch) });
    showToast('Amount updated ✓');
  } catch (e) { showToast('Could not update amount — try again'); }
}

async function handleClearRecordAmount(recordId) {
  try {
    await db.updateRecordFields(recordId, { amount: null, claimStatus: 'none' });
    await loadFamilyData();
    const patch = r => r.id === recordId ? { ...r, amount: null, claimStatus: 'none' } : r;
    setState({ editingRecordAmount: null, records: state.records.map(patch) });
    showToast('Removed from spending');
  } catch (e) { showToast('Could not update — try again'); }
}

async function handleCycleClaim(recordId) {
  const rec = anyRecord(recordId);
  if (!rec) return;
  const next = (CLAIM_STATES[rec.claimStatus || 'none'] || CLAIM_STATES.none).next;
  try {
    await db.updateRecordFields(recordId, { claimStatus: next });
    await loadFamilyData();
    const patch = r => r.id === recordId ? { ...r, claimStatus: next } : r;
    setState({ records: state.records.map(patch) });
    showToast(next === 'none' ? 'Marked not-insurance' : next === 'to_claim' ? 'Marked to claim' : 'Marked claimed ✓');
  } catch (e) { showToast('Could not update — try again'); }
}

// Silently remove empty (0-document) threads. Runs automatically when you ENTER the thread view,
// so leftover/duplicate empty threads clear themselves. A thread you create while already in the
// thread view stays until you navigate away and back (giving you time to file documents into it).
async function silentCleanupEmptyThreads() {
  const empties = state.allEpisodes.filter(ep => !state.allRecords.some(r => r.episodeId === ep.id));
  if (empties.length === 0) return;
  try {
    for (const ep of empties) { await db.deleteEpisode(ep.id); }
    await loadFamilyData();
    setState({});
  } catch (e) { /* silent — cleanup is best-effort */ }
}

// ── Episode / filing actions ──
function openFileModal(recordId) {
  const rec = anyRecord(recordId);
  // Propose a new-thread name from the diagnosis if it doesn't match an existing family thread
  let proposedNewTitle = '';
  const dx = rec?.extracted?.diagnosis;
  if (dx && !state.allEpisodes.some(e => e.title.toLowerCase() === dx.toLowerCase())) {
    proposedNewTitle = dx.length > 40 ? (rec.tags?.[0] || '') : dx;
  }
  setState({ fileModal: { recordId, proposedNewTitle }, recordSelectedId: null });
}

async function handleFileRecord(recordId, episodeId) {
  try {
    await db.setRecordEpisode(recordId, episodeId);
    const patch = r => r.id === recordId ? { ...r, episodeId: episodeId || null } : r;
    await loadFamilyData();
    setState({ records: state.records.map(patch), fileModal: null });
    showToast(episodeId ? 'Filed to thread ✓' : 'Removed from thread');
  } catch (e) { showToast('Could not file — try again'); }
}

async function handleFileToNewEpisode(recordId, title) {
  try {
    // Dedupe family-wide: if a thread with this name already exists, reuse it
    const existing = state.allEpisodes.find(e => e.title.trim().toLowerCase() === title.trim().toLowerCase());
    let epId;
    if (existing) {
      epId = existing.id;
    } else {
      const ep = await db.addEpisode(state.session.user.id, { title, status: 'active' });
      epId = ep.id;
    }
    await db.setRecordEpisode(recordId, epId);
    await loadFamilyData();
    const patch = r => r.id === recordId ? { ...r, episodeId: epId } : r;
    setState({ records: state.records.map(patch), fileModal: null });
    showToast(existing ? `Filed to "${title}" ✓` : `Created "${title}" ✓`);
  } catch (e) { showToast('Could not create thread — try again'); }
}

async function handleSaveEpisode() {
  const ed = state.episodeEditor;
  const title = document.getElementById('ep-title')?.value.trim();
  const description = document.getElementById('ep-description')?.value.trim();
  if (!title) { showToast('Please enter a thread name'); return; }
  try {
    if (ed.id) {
      await db.updateEpisode(ed.id, { title, status: ed.status, description });
      await loadFamilyData();
      setState({ episodes: state.episodes.map(e => e.id === ed.id ? { ...e, title, status: ed.status, description } : e), episodeEditor: null });
      showToast('Thread updated ✓');
    } else {
      // Dedupe family-wide by name
      const existing = state.allEpisodes.find(e => e.title.trim().toLowerCase() === title.toLowerCase());
      const ep = existing || await db.addEpisode(state.session.user.id, { title, status: ed.status, description });
      if (ed.fileRecordId) await db.setRecordEpisode(ed.fileRecordId, ep.id);
      await loadFamilyData();
      setState({ episodeEditor: null });
      showToast(existing ? `Filed to "${title}" ✓` : `Created "${title}" ✓`);
    }
  } catch (e) { showToast('Could not save — try again'); }
}

async function handleDeleteEpisode(id) {
  if (!confirm('Delete this thread? The documents in it will remain, just un-filed.')) return;
  try {
    await db.deleteEpisode(id);
    await loadFamilyData();
    setState({
      episodes: state.episodes.filter(e => e.id !== id),
      records: state.records.map(r => r.episodeId === id ? { ...r, episodeId: null } : r),
      openEpisodeId: state.openEpisodeId === id ? null : state.openEpisodeId,
    });
    showToast('Thread deleted');
  } catch { showToast('Could not delete — try again'); }
}

// ── Member management ──
async function handleSaveMember() {
  const ed = state.memberEditor;
  const val = k => document.getElementById('me-' + k)?.value?.trim() || '';
  const name = val('name');
  if (!name) { showToast('Please enter a name'); return; }
  const splitList = s => s.split(',').map(x => x.trim()).filter(Boolean);
  const patch = {
    name, role: val('role') || 'Family', gender: val('gender') || 'Female',
    age: val('age') ? +val('age') : null, blood: val('blood'),
    height: val('height') ? +val('height') : null, weight: val('weight') ? +val('weight') : null,
    bp: val('bp'), hba1c: val('hba1c'), conditions: splitList(val('conditionsText')),
  };
  setState({ memberSaving: true });
  try {
    if (ed.id) {
      await db.updateMember(ed.id, patch);
      await Promise.all([reloadMembers(), loadFamilyData()]);
      setState({ memberSaving: false, memberEditor: null });
      showToast('Member updated ✓');
    } else {
      await db.addMember(state.session.user.id, { ...patch, color: MEMBER_COLORS[state.members.length % MEMBER_COLORS.length], score: 80 });
      await reloadMembers();
      const added = state.members.find(x => x.name === name && x.role === patch.role) || state.members[state.members.length - 1];
      const wasFromUpload = ed.fromUpload;
      setState({ memberSaving: false, memberEditor: null, currentId: state.currentId || (added && added.id), uploadTargetId: wasFromUpload && added ? added.id : state.uploadTargetId });
      showToast(`${name.split(' ')[0]} added ✓`);
    }
  } catch (e) { setState({ memberSaving: false }); showToast('Could not save — try again'); }
}

async function reloadMembers() {
  try { state.members = await db.getMembers(state.session.user.id); } catch (e) { console.error(e); }
}

// ── Medicine handlers ──
async function handleSaveMedicine() {
  const ed = state.medicineEditor;
  const val = k => document.getElementById('med-' + k)?.value?.trim() || '';
  const name = val('name');
  if (!name) { showToast('Please enter a medicine name'); return; }
  const patch = { name, dose: val('dose'), freq: val('freq'), timing: val('timing'), purpose: val('purpose') };
  try {
    if (ed.id) await db.updateMedicine(ed.id, patch);
    else await db.addMedicine(state.session.user.id, { ...patch, mid: ed.mid });
    await loadFamilyData();
    setState({ medicineEditor: null });
    showToast(ed.id ? 'Medicine updated ✓' : 'Medicine added ✓');
  } catch (e) { showToast('Could not save — try again'); }
}
async function handleDeleteMedicine(id) {
  if (!confirm('Delete this medicine?')) return;
  try {
    await db.deleteMedicine(id);
    await loadFamilyData();
    setState({ medicineEditor: null });
    showToast('Medicine deleted');
  } catch (e) { showToast('Could not delete — try again'); }
}

// ── Doctor handlers ──
async function handleSaveDoctor() {
  const ed = state.doctorEditor;
  const val = k => document.getElementById('doc-' + k)?.value?.trim() || '';
  const name = val('name');
  if (!name) { showToast('Please enter a name'); return; }
  const patch = { name, specialty: val('specialty'), hospital: val('hospital'), phone: val('phone'), notes: val('notes') };
  try {
    if (ed.id) await db.updateDoctor(ed.id, patch);
    else await db.addDoctor(state.session.user.id, patch);
    await loadFamilyData();
    setState({ doctorEditor: null });
    showToast(ed.id ? 'Doctor updated ✓' : 'Doctor added ✓');
  } catch (e) { showToast('Could not save — try again'); }
}
async function handleDeleteDoctor(id) {
  if (!confirm('Delete this doctor?')) return;
  try {
    await db.deleteDoctor(id);
    await loadFamilyData();
    setState({ doctorEditor: null });
    showToast('Doctor deleted');
  } catch (e) { showToast('Could not delete — try again'); }
}

// ── Follow-up handlers (Layer 3) ──
async function handleSaveFollowup() {
  const ed = state.followupEditor;
  const val = k => document.getElementById('fu-' + k)?.value;
  const title = (val('title') || '').trim();
  const mid = val('member');
  if (!title) { showToast('Please enter what needs doing'); return; }
  if (!mid) { showToast('Please pick a person'); return; }
  setState({ followupSaving: true });
  try {
    if (ed.id) {
      await db.updateFollowup(ed.id, { title, kind: val('kind'), dueDate: val('date') || null, notes: (val('notes') || '').trim() });
    } else {
      await db.addFollowup(state.session.user.id, { mid, title, kind: val('kind') || 'review', dueDate: val('date') || null, dateSource: 'explicit', notes: (val('notes') || '').trim() });
    }
    await loadFamilyData();
    setState({ followupSaving: false, followupEditor: null });
    showToast(ed.id ? 'Follow-up updated ✓' : 'Follow-up added ✓');
  } catch (e) { setState({ followupSaving: false }); showToast('Could not save — try again'); }
}

async function handleFollowupDone(id) {
  const f = state.allFollowups.find(x => x.id === id);
  try {
    await db.updateFollowup(id, { status: 'done', completedOn: new Date().toISOString().slice(0,10) });
    // Recurring follow-up → schedule the next occurrence automatically
    if (f && f.recurring && f.recurMonths && f.dueDate) {
      const next = new Date(f.dueDate); next.setMonth(next.getMonth() + f.recurMonths);
      await db.addFollowup(state.session.user.id, { mid: f.mid, title: f.title, kind: f.kind, dueDate: next.toISOString().slice(0,10), dateSource: 'explicit', recurring: true, recurMonths: f.recurMonths, episodeId: f.episodeId });
    }
    await loadFamilyData();
    setState({});
    showToast('Marked done ✓');
  } catch (e) { showToast('Could not update — try again'); }
}

async function handleFollowupDelete(id) {
  try {
    await db.deleteFollowup(id);
    await loadFamilyData();
    setState({ followupEditor: null });
    showToast('Follow-up removed');
  } catch (e) { showToast('Could not remove — try again'); }
}

async function handleArchiveMember(id, archived) {
  try {
    await db.updateMember(id, { archived });
    await reloadMembers();
    // If we archived the active/filter member, reset
    const patch = {};
    if (archived && !state.familyView && state.currentId === id) patch.familyView = true;
    if (archived && state.currentId === id) { const first = activeMembers()[0]; if (first) { await switchMember(first.id); } }
    setState({ memberMenuFor: null, ...patch });
    showToast(archived ? 'Member hidden' : 'Member unhidden');
  } catch { showToast('Could not update — try again'); }
}

async function handleDeleteMember(id) {
  const mem = memberById(id);
  if (!mem) return;
  const recCount = state.allRecords.filter(r => r.mid === id).length;
  if (!confirm(`Permanently delete ${mem.name} and ALL their data (${recCount} record${recCount!==1?'s':''}, threads, follow-ups)? This cannot be undone.`)) return;
  try {
    await db.deleteMember(id);
    await Promise.all([reloadMembers(), loadFamilyData()]);
    const patch = { memberMenuFor: null };
    if (!state.familyView && state.currentId === id) patch.familyView = true;
    if (state.currentId === id) { const first = activeMembers()[0]; if (first) { await switchMember(first.id); } }
    setState(patch);
    showToast(`${mem.name} deleted`);
  } catch { showToast('Could not delete — try again'); }
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
      // Default the active profile to "Self" if present, else the first member
      const self = members.find(x => x.role === 'Self') || members[0];
      state.currentId = self.id;
      state.lastUploadMemberId = self.id;
      await loadMemberData(self.id);
      await loadFamilyData();
      if (state.page === 'home') maybeRefreshHomeInsights();
    }
  } catch (e) {
    console.error(e);
    state.membersLoading = false;
  }
  render();
}

// Boot the app
initApp();
