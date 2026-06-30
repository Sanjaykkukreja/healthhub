# HealthHub

Your personal health intelligence platform — prescriptions, lab reports, bills, AI doctor chat, daily health log, and family dashboard, all in one place. Built the same way as Pattern Lab: plain HTML/JS/CSS files, no build tools, hosted free on GitHub Pages, backed by Supabase.

---

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | App shell — loads Tailwind, Supabase, Chart.js, Lucide icons from CDN |
| `config.js` | **You edit this** — your Supabase URL + key go here |
| `app.js` | The entire app logic |
| `styles.css` | Small supplementary styles |
| `schema.sql` | Database setup — paste into Supabase once |

No `npm install`, no Node.js, no build step. Open `index.html` in a browser and it runs.

---

## Part 1 — Create your Supabase backend (~5 minutes)

1. Go to **[supabase.com](https://supabase.com)** → Sign up free → **New Project**
   - Name: `HealthHub`
   - Database password: pick a strong one, save it somewhere safe
   - Region: **South Asia (Singapore)** — closest to India
2. Wait ~2 minutes for the project to finish setting up

3. In the left sidebar, click **SQL Editor** → **New Query**
4. Open `schema.sql` from this folder, copy everything, paste it in, click **Run**
5. You should see "Success. No rows returned" — that's correct

6. Click **Settings** (gear icon, bottom left) → **API**
7. Copy two values — you'll need them in a moment:
   - **Project URL**
   - **anon public** key

---

## Part 2 — Add your Supabase keys

1. Open `config.js` in any text editor (Notes, TextEdit, VS Code — anything)
2. Replace the two placeholder lines:

```js
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";
```

with your real values from Part 1, e.g.:

```js
const SUPABASE_URL = "https://abcdefgh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

3. Save the file

---

## Part 3 — Put it on GitHub

1. Go to **[github.com](https://github.com)** → sign in (or create a free account)
2. Click the **+** icon top-right → **New repository**
   - Name: `healthhub`
   - Keep it **Public** (required for free GitHub Pages)
   - Don't check any of the "initialize with" boxes
   - Click **Create repository**

3. On the next page, click **uploading an existing file**
4. Drag in all 5 files from this folder: `index.html`, `config.js`, `app.js`, `styles.css`, `schema.sql`
5. Scroll down, click **Commit changes**

---

## Part 4 — Turn on GitHub Pages

1. In your new repo, click **Settings** (top tab)
2. In the left sidebar, click **Pages**
3. Under "Build and deployment" → Source: select **Deploy from a branch**
4. Branch: select **main** and folder **/ (root)** → click **Save**
5. Wait ~1 minute, then refresh the page — you'll see a green box with your live URL:

```
https://yourusername.github.io/healthhub/
```

That's it — open that link on your iPhone, your laptop, anywhere. It's your permanent app URL.

---

## Part 5 — First-time use

1. Open your GitHub Pages URL
2. **Sign up** with your email and a password
3. Check your email for a confirmation link, click it
4. Come back and **sign in**
5. Fill in your profile (name, age, conditions, medications)
6. You're in

### Add to iPhone Home Screen (feels like a native app)
1. Open your URL in **Safari** on iPhone
2. Tap the **Share** button → **Add to Home Screen** → **Add**
3. Now it opens full-screen with its own icon, just like an app

---

## How the AI document upload works

Tap **Upload Record** → choose a file or take a photo → Claude reads the document and extracts patient name, date, doctor, hospital, every lab value with reference ranges, all medications with dosing, doctor's advice, and follow-up instructions.

If the name on the document doesn't match the current profile, you'll be asked which family member it actually belongs to, with a clear option to cancel if it's not relevant.

**Supported:** PDF, JPG, PNG, HEIC (iPhone photos). Handles handwritten prescriptions, any Indian lab format (SRL, Lal Path, Metropolis, Apollo, Thyrocare, etc.), and Hindi+English mixed text.

---

## Making changes later

Whenever you want to update the app:

1. Edit the file locally (e.g. `app.js`)
2. Go to your GitHub repo in the browser
3. Click on the file → pencil (edit) icon → paste your changes → **Commit changes**
4. GitHub Pages auto-redeploys in under a minute

No build step, no terminal commands needed for day-to-day updates.

---

## Security notes

- Every user's data is isolated via Supabase Row Level Security — nobody can see another user's records, even though they share the same database
- Uploaded files are stored in a **private** Supabase Storage bucket, accessible only to the uploader
- Your Supabase **anon key** is safe to expose in this public repo — it only allows the specific access defined by the RLS policies in `schema.sql`
- Never put your Supabase **service_role** key anywhere in this app (we don't use it)

---

## Troubleshooting

**Blank page / nothing loads**
→ Open browser console (F12 or right-click → Inspect → Console) and check for errors. Usually means `config.js` wasn't filled in correctly.

**"Invalid API key"**
→ Double check you copied the `anon public` key, not `service_role`, from Supabase Settings → API.

**"relation does not exist"**
→ The schema wasn't run yet. Go to Supabase → SQL Editor → paste `schema.sql` → Run.

**File upload fails**
→ Check Supabase → Storage — you should see a `medical-documents` bucket. If missing, re-run the storage section of `schema.sql`.

**GitHub Pages shows 404**
→ Make sure Settings → Pages → Source is set to your `main` branch and `/ (root)` folder, and that `index.html` is at the top level of the repo (not inside a subfolder).

---

## Roadmap

- [ ] Apple Health / Google Fit sync
- [ ] Push notifications for medicine reminders
- [ ] Appointment scheduling with calendar
- [ ] PDF export of health summary for doctor visits
- [ ] Shared family access (invite links)

---

Built with HTML, vanilla JavaScript, Tailwind CDN, Supabase, Chart.js, and Claude AI — same lightweight architecture as Pattern Lab.
