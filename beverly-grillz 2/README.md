# Beverly Grillz

A web app for the Beverly Grillz desert event: password-gated lock screen, RSVP application, shift sign-up, packing checklist, and an admin panel.

Built with Vite + React. Backed by Supabase. Deployed on Cloudflare Pages.

---

## What you need before you start

- Node.js 18 or newer — install from <https://nodejs.org> if you don't have it
- A GitHub account
- A Supabase account — free, no credit card needed: <https://supabase.com>
- A Cloudflare account — free: <https://dash.cloudflare.com/sign-up>

---

## Step 1 — Set up Supabase (10 min)

1. Go to <https://supabase.com> and sign in.
2. Click **New project**. Name it `beverly-grillz` (or anything). Pick a region near you. Generate a database password and save it somewhere — you don't need it for the app, but Supabase wants it.
3. Wait ~2 minutes for the project to spin up.
4. In the left sidebar, click the **SQL Editor** icon (looks like a database). Click **New query**.
5. Open `supabase-schema.sql` from this project, copy the whole thing, paste into the editor, click **Run**. You should see "Success".
6. Now grab your credentials. In the left sidebar click **Project Settings** (gear icon) → **API**. You'll see:
   - **Project URL** — copy this
   - **anon public** key (under "Project API keys") — copy this
7. Keep that tab open for the next step.

---

## Step 2 — Run the app locally (5 min)

1. Open a terminal in this project folder.
2. Copy the env file:
   ```bash
   cp .env.example .env.local
   ```
3. Open `.env.local` in any editor and paste your Supabase **Project URL** and **anon key** from Step 1.
4. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
5. Open the URL it prints (usually `http://localhost:5173`). You should see the lock screen. Password: `hospitable`.
6. Try applying, claiming a shift, etc. Then refresh the page — your data should persist. (If it doesn't, check the browser console for Supabase errors.)
7. Open the Supabase dashboard → **Table Editor** → `kv_store`. You should see rows for `config`, `shifts`, etc. as you interact with the app. That's confirmation everything's wired up.

---

## Step 3 — Push to GitHub (5 min)

1. Go to <https://github.com/new> and create a new **empty** repo named `beverly-grillz`. Don't initialize with a README, .gitignore, or license — this project already has those.
2. Back in your terminal, in the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/beverly-grillz.git
   git push -u origin main
   ```
   Replace `YOUR-USERNAME` with your GitHub username.
3. Refresh the GitHub page — you should see all your files there. Verify `.env.local` is **not** in the repo (it should be hidden by `.gitignore`).

---

## Step 4 — Deploy on Cloudflare Pages (5 min)

1. Go to <https://dash.cloudflare.com/> and sign in.
2. In the left sidebar click **Workers & Pages**, then click **Create application** → **Pages** → **Connect to Git**.
3. Authorize Cloudflare to access your GitHub. Pick the `beverly-grillz` repo. Click **Begin setup**.
4. On the build configuration screen:
   - **Project name**: `beverly-grillz` (this becomes `beverly-grillz.pages.dev`)
   - **Production branch**: `main`
   - **Framework preset**: choose **Vite**
   - **Build command**: `npm run build` (auto-filled)
   - **Build output directory**: `dist` (auto-filled)
5. Expand **Environment variables (advanced)** and add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - These have to be set BEFORE the first build, otherwise the deployed site won't be able to reach Supabase.
6. Click **Save and Deploy**. Wait ~1–2 minutes for the build.
7. Click the deployment URL (something like `beverly-grillz.pages.dev`). Confirm the lock screen loads and the password works.

---

## Step 5 — Point permanentdisco.com at it (10 min, plus DNS propagation)

DNS is staying at GoDaddy. We're just adding a CNAME record there that aims at Cloudflare Pages.

### In Cloudflare Pages:

1. In your Pages project, go to **Custom domains** → **Set up a custom domain**.
2. Enter `www.permanentdisco.com` and click **Continue**.
3. Cloudflare will tell you to create a **CNAME record** at your DNS provider:
   - Type: `CNAME`
   - Name: `www`
   - Target: `beverly-grillz.pages.dev` (or whatever your project subdomain is)
   - Copy the exact target — Cloudflare shows you the right value.

### In GoDaddy:

1. Sign in to GoDaddy → **My Products** → next to `permanentdisco.com` click **DNS** (or "Manage DNS").
2. Find the existing `www` CNAME record (GoDaddy creates one by default pointing to `@`). Edit it:
   - **Type**: CNAME
   - **Name**: `www`
   - **Value**: `beverly-grillz.pages.dev` (paste exactly what Cloudflare gave you)
   - **TTL**: 1 hour (or default)
   - Save.
3. If you want the bare domain `permanentdisco.com` (no `www`) to also work, add a domain forwarding rule in GoDaddy: **Forwarding** → **Add forward** → forward `permanentdisco.com` to `https://www.permanentdisco.com` with a 301 redirect. (GoDaddy doesn't allow CNAME on the apex domain, which is why we have to use forwarding.)

### Verify:

1. Back in Cloudflare Pages → Custom domains, the status should change to **Active** within a few minutes (sometimes up to an hour for DNS propagation).
2. Visit <https://www.permanentdisco.com>. You should see the lock screen.
3. Cloudflare auto-provisions HTTPS — no extra steps needed.

---

## Daily use

### To update the app

Make changes locally, then:
```bash
git add .
git commit -m "describe what changed"
git push
```
Cloudflare Pages auto-detects the push and rebuilds. Live in 1–2 minutes.

### To manage event data

You have two options:
- **In the app** — log into Admin (default password `admin123`, change it!) and edit shifts, packing list, applications, etc.
- **In Supabase** — Dashboard → Table Editor → `kv_store`. Each key (`config`, `shifts`, etc.) is a row with a JSONB value you can edit directly.

### To change passwords

The lock-screen password and admin password live in `kv_store.config`. Either edit them in the admin panel inside the app, or directly in Supabase's Table Editor.

---

## Important things to know

**The lock-screen password is not real security.** Anyone who views page source can find it. It keeps strangers from stumbling onto your event app. It does not protect sensitive data.

**The Supabase anon key is also visible in the bundle.** It's designed to be — that's how the client talks to Supabase. The Row Level Security policies in `supabase-schema.sql` are what gate access. As written, those policies allow anyone with the anon key to read/write everything. That's fine for a friends-and-family event app and not fine for anything sensitive.

**Per-user data lives in localStorage.** When someone applies on their laptop, their identity is in their laptop's browser. If they open the app on their phone, they'll appear as a different person and have to apply again. Worth telling your guests.

**Race conditions exist on shift sign-ups.** If two people claim the last spot of a shift at the exact same second, one of them could overwrite the other. For a small event with capacity buffer this is extremely unlikely. If it ever matters, that's the moment to switch from the kv_store pattern to proper relational tables.

---

## Project layout

```
beverly-grillz/
├── .env.example         ← template; copy to .env.local
├── .gitignore
├── README.md            ← this file
├── index.html           ← Vite entry HTML
├── package.json
├── supabase-schema.sql  ← run once in Supabase SQL Editor
├── vite.config.js
└── src/
    ├── App.jsx          ← the whole app
    ├── main.jsx         ← React mount point
    └── storage.js       ← Supabase + localStorage layer
```
