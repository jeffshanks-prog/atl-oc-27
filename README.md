# ATL OC 27 — Madden 27 Offensive Coordinator

A subscription PWA that works as a digital offensive coordinator: master Atlanta playbook database, scheme builder,
favorites, game plans, a situational play caller with transparent match scores, a screen-alert engine, opponent
tendencies, post-play results, and stats built only from your recorded results.

**Stack:** React + TypeScript (strict) + Tailwind (Vite) · Supabase (Postgres, Auth, row-level security) ·
Netlify (hosting + Functions) · Stripe (subscriptions — **off for now**) · Workbox PWA with an offline write queue.

---

> **Subscriptions are OFF right now.** Anyone who signs in gets the full app, so you can finish and test it first.
> Sections 1 and 2 are all you need today. Section 5 turns on paid subscriptions when you're ready to sell.
>
> **Keeping it private while you build:** after you create your own account, go to Supabase →
> **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Turn it back on at launch.

## 1. Supabase (about 15 minutes)

**Order matters:** Supabase needs your Netlify web address, and Netlify needs your Supabase keys.
Do steps 1–4, deploy to Netlify (section 2), then come back for steps 5–7.

### Step 1 — Create the project
1. Go to supabase.com and sign in. Click **New project**.
2. **Name:** `atl-oc-27`. **Database password:** click *Generate a password* and save it in your password manager.
3. **Region:** **East US** (closest to Georgia and most subscribers). **Plan:** Free for building; move to Pro before
   paying customers rely on it, because idle free projects can be paused.
4. Click **Create new project** and wait 1–2 minutes.

### Step 2 — Build the database
1. Sidebar → **SQL Editor → New query**. Paste all of `supabase/migrations/001_schema.sql` → **Run**.
   Expect *Success. No rows returned.* (tables, security rules, subscriber paywall, default scheme setup).
2. **New query** → paste all of `002_seed.sql` → **Run** (the full Madden 27 Atlanta playbook: 42 formations, 614 plays).
3. Check: run `select count(*) from plays;` → you should see **614**. **Table Editor** should list plays, formations,
   schemes, favorites, games, etc.
4. Run each file once, in order. If 001 errors partway, start a fresh project rather than re-running it.

### Step 3 — Turn on email login
**Authentication → Sign In / Providers** → make sure **Email** is enabled. Leave **Confirm email** on for real
customers (turn it off temporarily if you want to test without checking your inbox).

### Step 4 — Copy your keys
**Project Settings (gear) → API Keys.** Use one key style for both keys:
new style (`sb_publishable_…` + `sb_secret_…`) **or** the *Legacy API keys* tab (`anon` + `service_role`, both start `eyJ`).

| Copy this | Netlify variable | Who can see it |
|---|---|---|
| Project URL `https://xxxx.supabase.co` (the **Connect** button at the top) | `VITE_SUPABASE_URL` | Public |
| Publishable key *or* anon key | `VITE_SUPABASE_ANON_KEY` | Public — the security rules protect the data |
| Secret key *or* service_role key | `SUPABASE_SERVICE_ROLE_KEY` | **Private — never share, post, or put in app code.** Only needed once subscriptions are on |

The secret key bypasses every security rule; the app only uses it inside the Netlify billing functions.

**→ Deploy to Netlify now (section 2), then continue.**

### Step 5 — Tell Supabase your website address
**Authentication → URL Configuration.** *Site URL:* your Netlify address, e.g. `https://atloc27.netlify.app`
(no slash at the end). *Redirect URLs → Add URL:* the same address and `https://atloc27.netlify.app/**`. **Save.**
Skip this and confirmation / password-reset emails send people to `localhost`. If you add a custom domain later, update both.

### Step 6 — Create your account in the app
1. Open your Netlify address (e.g. `https://atloc27.netlify.app`). You should see the **ATL OC 27** sign-in card.
   ("Setup needed" instead? See Troubleshooting.)
2. Tap **Create an account** under the Sign in button.
3. **Name:** what the app calls you (changeable later in Account). **Email:** the owner email — this becomes your
   admin account, so use one you'll keep. **Password:** at least 6 characters; save it in your password manager.
4. Tap **Create account**.
   - **Confirm email ON:** the card says *"Check your email to confirm your account, then sign in."* Open the
     email from Supabase (subject like "Confirm your signup"; check spam/promotions) → tap **Confirm your mail**.
     It opens your site already confirmed. Return to the sign-in card → enter email + password → **Sign in**.
   - **Confirm email OFF:** you're signed in immediately.
5. Brief **"Loading playbook…"** screen, then the **Game Caller**:
   top bar reads **ATL OC 27 · Active scheme: JEFF'S ATL SPACING OFFENSE**; the big red **🧠 WHAT SHOULD I CALL?** button.
6. Check: **Playbook** tab → *614 plays in the master database*. Tap **What should I call?** → you get a primary call
   with a match score.

Behind the scenes, signing up automatically created your profile, a blank subscription record (unused while
subscriptions are off) and your default scheme with the 30/20/20/10/8/7/5 weights.

### Step 7 — Make yourself admin
Every account starts as a regular user. Admin adds the **Admin** area: CSV/JSON import, bulk tagging, adding and
editing master-playbook plays. There's deliberately no button for this — it can only be granted from the database,
so nobody can make themselves admin from the app.

1. Supabase → **SQL Editor → New query**. Paste, replacing the email with the exact one from step 6 (keep the quotes):
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```
2. **Run.** Expect **Success · 1 row affected**. (0 rows → see Troubleshooting.)
3. Confirm:
   ```sql
   select u.email, p.display_name, p.is_admin
   from auth.users u join public.profiles p on p.id = u.id;
   ```
   Your row should show `is_admin = true`.
4. In the app, refresh the page (computer) or swipe the installed app closed and reopen it (phone).
   - **Computer / tablet:** **ADMIN** appears in the top bar next to the 👤 icon.
   - **Phone:** the top bar is too narrow, so tap **👤 → Admin & import**.
5. Check: Admin shows three tabs — **Import**, **Bulk tagging**, **All plays** — and a red **+ Add play** button.
   Play pages now show **Edit play**.

Admins always have access, even after subscriptions are turned on. Make only your own account admin.
To remove admin from someone: same query with `false`.

### Troubleshooting
| What you see | Cause | Fix |
|---|---|---|
| **"Setup needed"** screen | Netlify doesn't have the Supabase values, or they weren't in the build | Check `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (exact spelling, no spaces/quotes) → **Deploys → Trigger deploy** → wait for *Published* → hard-refresh |
| Stuck on **"Loading playbook…"** | Wrong Supabase URL/key, or the project is paused | Compare values with Supabase **Connect**; on Free, check the dashboard for a **Restore project** button |
| **"Invalid login credentials"** | Wrong password, or the account was never created | **Forgot password?** on the sign-in card, or **Create an account** again |
| **"Email not confirmed"** | You haven't clicked the confirmation link | Click it (check spam), or temporarily turn off **Confirm email** and sign in |
| Confirmation link opens **localhost** / "can't reach this page" | Site URL not set (Supabase step 5) | Fix step 5. Your email is usually confirmed anyway — just go to your site and sign in |
| No confirmation email | Spam folder, or the built-in sender's limit (a few emails per hour) | Wait and resend, or turn off **Confirm email** while testing. Before launch add your own sender: **Authentication → Emails → SMTP Settings** (Resend or SendGrid) |
| Playbook shows **0 plays** | `002_seed.sql` didn't run | Run it again (step 2.2) — safe to repeat; then refresh the app |
| Admin query says **0 rows** | Email typo / different capitalization, or the account was made before `001_schema.sql` ran | Copy the email exactly from **Authentication → Users**. If the check query shows no row, run: `insert into public.profiles (id, display_name) select id, split_part(email,'@',1) from auth.users where email = 'YOUR_EMAIL' on conflict do nothing;` then repeat step 7 |
| **Admin** still missing after 1 row | App is showing saved data from before | Refresh/reopen while online. On a phone it's under **👤 → Admin & import** |
| Amber **"Offline"** or **"Syncing"** badge | No connection, or changes still uploading | Normal — results save on the device and sync automatically. **👤 → Sync now** forces it |

## 2. Netlify (about 20 minutes)

Netlify hosts the app (and later runs the three billing functions). Functions only deploy from **GitHub** (or the Netlify CLI);
**drag-and-drop deploys skip them**. Use GitHub now so subscriptions work later without redoing anything.

### Step 1 — Put the code on GitHub
1. Unzip `atl-oc-27.zip`. You get a folder `atl-oc-27` with `package.json`, `netlify.toml`, `src`, `supabase`, etc.
2. At github.com → **+ → New repository**. Name `atl-oc-27`, **Private** (this is your product's source code).
   Don't add a README, .gitignore, or license. **Create repository.**
3. Upload — pick one:
   - **Browser:** on the empty repo click **uploading an existing file**. Open the `atl-oc-27` folder, select
     **everything inside it** (not the folder itself) and drag it in. Commit message "Initial upload" → **Commit changes**.
   - **GitHub Desktop (easier for future updates):** **File → Add local repository** → choose the folder → create the
     repository when prompted → **Publish repository** with **Keep this code private** checked.
4. Check: the repo's top level shows `netlify.toml`, `package.json` and `src` — not a single `atl-oc-27` folder.
   (If it does show one folder, set **Base directory** to `atl-oc-27` in step 2.)
5. Never upload a `.env` file with real keys. Keys go only into Netlify (step 3).

### Step 2 — Create the Netlify project
1. app.netlify.com → **Add new project → Import an existing project** (older screens: *Add new site*).
2. **GitHub** → authorize Netlify → grant it access to the `atl-oc-27` repo → select it.
3. Netlify reads `netlify.toml` and fills in the settings. Confirm:

| Setting | Value |
|---|---|
| Branch to deploy | `main` |
| Base directory | blank (or `atl-oc-27` — see step 1.4) |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

4. **Project name:** this becomes your address. Name it `atloc27` → `https://atloc27.netlify.app`. Change it later under
   **Project configuration → General → Change project name** (then update Supabase and Stripe with the new address).
5. **Deploy.** The first build works even without keys; the app shows "setup needed" until step 3.

### Step 3 — Add the environment variables
**Project configuration → Environment variables → Add a variable → Add a single variable**, once per row.
Leave **Scopes** on *all* and **Deploy contexts** on *same value for all*. For **private** keys, tick
**Contains secret values** so Netlify hides and scans for them.

| Key (type exactly — capitals and underscores matter) | Value from | Private? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase **Connect** → Project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase → API Keys → publishable (or legacy anon) | No |
| `VITE_BILLING_ENABLED` | `false` for now (subscriptions off) | No |

**Add later, when you turn on subscriptions (section 5):**

| Key | Value from | Private? |
|---|---|---|
| `VITE_BILLING_ENABLED` | change to `true` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → secret (or legacy service_role) | **Yes** |
| `STRIPE_SECRET_KEY` | Stripe → API keys → Secret key `sk_…` | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | Stripe → your webhook → Signing secret `whsec_…` | **Yes** |
| `STRIPE_PRICE_MONTHLY` | Stripe → monthly price `price_…` | No |
| `STRIPE_PRICE_YEARLY` | Stripe → yearly price `price_…` | No |
| `STRIPE_TRIAL_DAYS` | Free-trial days, e.g. `7` (`0` = no trial) | No |
| `SITE_URL` | `https://atloc27.netlify.app` — no slash at the end (optional; defaults to the Netlify address) | No |

Watch for: spaces before/after pasted values, quotes around values, a cut-off key (keys are long — copy with the
copy button), and sandbox and live keys mixed together.

### Step 4 — Redeploy (required after every variable change)
The two `VITE_` values are built *into* the app, so saving them does nothing until a new build.
**Deploys → Trigger deploy → Deploy project** (or *Clear cache and deploy project*). Wait for **Published** (1–2 min).

### Step 5 — Finish the other services
- Supabase **steps 5–7** (Site URL, your account, admin).

### Step 6 — Check the deploy
1. Open your address: you should see the **ATL OC 27** sign-in screen. ("Setup needed" = step 3/4 not done.)
2. **Logs → Functions** (or the Functions tab): `create-checkout`, `customer-portal`, `stripe-webhook` are listed
   (unused until subscriptions are on). Missing = drag-and-drop deploy or wrong Functions directory.
3. Sign in → the Game Caller loads, and **Playbook** shows all 42 formations / 614 plays.

### Step 7 — Install it like an app
- **iPhone (Safari):** Share → **Add to Home Screen** → Add.
- **Android (Chrome):** ⋮ → **Install app** (or *Add to Home screen*).
- **Desktop (Chrome / Edge):** install icon at the right end of the address bar.

It opens full-screen like a normal app. The app shell, playbook, favorites and current game plan stay available
offline; results logged without a connection sync automatically when you're back online.

### Step 8 — Custom domain (optional, recommended before selling)
**Domain management → Add a domain** → buy one through Netlify or enter one you own and follow its DNS steps.
Netlify adds free HTTPS automatically. Then update: `SITE_URL`, Supabase **Site URL + Redirect URLs**, and (once
subscriptions are on) the Stripe **webhook endpoint URL** → **Trigger deploy**.

### Updating the app later
Every change pushed to GitHub (`main`) redeploys automatically in about a minute. Turn off **Deploy Previews**
(Project configuration → Build & deploy → Branches and deploy contexts) if you don't want preview links built.

### If a deploy fails
Open the failed deploy → **Deploy log**, scroll to the first red line:
- *"Exposed secrets detected"* → the secret scanner flagged something in the output. The two public Supabase values
  are already excluded in `netlify.toml`. For another false positive, add a variable
  `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` with the flagged value, then redeploy. Never put real secrets in code.
- *"Could not find package.json"* → set **Base directory** (Step 1.4).
- *TypeScript errors* → a file was edited or only partly uploaded; re-upload the original from the zip.

### Running it on your own computer (optional)
Install Node.js 20+ from nodejs.org. In the project folder: `npm install`, then `npm install -g netlify-cli`,
`netlify login`, `netlify link` (pick the project), and `netlify dev`. That uses your Netlify variables and runs the
billing functions locally at `http://localhost:8888`. For just the screens: copy `.env.example` to `.env`, fill in
the two `VITE_` values, `npm run dev`.

## 3. The Atlanta playbook

The database comes loaded with the **entire Madden 27 Atlanta offensive playbook — 42 formations, 614 plays**
(Gun 383, Singleback 87, Pistol 81, I Form 36, Goal Line 12, Weak 9, Split Backs 6).

- **Play and formation names are real.** Everything else — play type (Pass / Run / Screen / RPO / Play Action),
  concept, schemes, best-vs / weak-vs, beater flags and situation ratings — was **auto-tagged from the play name**
  with football-concept rules. Those plays show an amber **Auto-tagged** badge. Spot-check the ones you call most
  and fix anything off in **Edit play** or **Admin → Bulk tagging**.
- **Read progressions and personnel are blank on purpose** — add them as you learn each play in-game.
- The whole list is also in `data/atlanta-playbook.csv` (import-template format). The generator is
  `scripts/build_atlanta_seed.py` if you ever want to retune the auto-tagging rules and rebuild `002_seed.sql`.

- **Admin → Import → Download import template** (CSV). One row per play; list fields use `|`.
- Required: `playName`, `formation`, `playType` (Pass, Run, Screen, RPO, Play Action).
- Duplicates match on **Playbook + Formation + Set + Play Name** → changed rows *update*, identical rows *skip*.
  The report shows Added / Updated / Skipped / Errors with row numbers.
- **Admin → Bulk tagging:** filter, select many plays, add a tag / scheme / best-vs / beater flags in one save.
- **+ Add play** for one-offs (e.g. a play added in a Madden update). Non-admin users can add private custom plays; only admins edit the master playbook.
- Once you've verified a play, saving it in **Edit play** keeps your changes; re-importing a matching row also clears the badge.

## 4. How the recommendation engine scores a play

| Factor | Range | Driven by |
|---|---|---|
| Situation Match | 0–25 | Yardage needed for a *successful* play (40% on 1st, 60% on 2nd, all on 3rd/4th), field zone, 2-min/4-min ratings |
| Coverage Match | 0–20 | Best/weak-vs tags, man/zone/blitz beater flags, pressure + box/press alignment |
| Scheme Match | 0–15 | Active scheme's concept weights, preferred plays & formations |
| Favorite Boost | 0–10 | Only when the play already fits (≥55% of situation+coverage); roles that match the moment add more |
| Historical Success | 0–10 | Your recorded success for the play (and vs this coverage), confidence-weighted |
| Opponent Tendency | 0–10 | This game's coverage mix, blitz rate, flat/screen/middle jumpers, box counts |
| Game Situation | 0–5 | Score, quarter, clock, 4th down, change-up after a failed call |
| Repetition Penalty | 0 to −15 | Same play / same concept called recently |
| Risk Penalty | 0 to −10 | Risk level × context (backed up, protecting a lead, 4th down) |

Factors with no data yet (unknown coverage, no history, <3 opponent snaps) are shown but left out of the
percentage, so early-game scores aren't dragged down by blanks. **Why this play?** shows every factor and note.
Counters follow SPACING → SCREEN → RUN → MESH → RPO → PLAY ACTION → SHOT, overridden by what the defense is showing.

Run `npm run test:engine` (13-play scenario checks) or `node --experimental-strip-types scripts/engine-full.ts`
(scenarios against all 614 plays).

## 4b. Linking the game screen (PC)

On a desktop browser the Game Caller shows **🎮 Link Madden screen**. Click **Link game screen** and pick your Madden window (or the whole screen) in Chrome's share prompt. From then on, every play-call screen is read automatically:

| Read from the screen | Used for |
|---|---|
| Down & distance (incl. *Inches* and *Goal*) | Situation, success rate |
| Ball spot (▼ = your side of the 50, ▲ = theirs) | Field position, red zone, yards gained |
| Quarter, game clock, score | 2-minute / 4-minute logic, game score |
| Possession arrow | Only your snaps are used |
| **Previous Play** box (defense call + your call) | Logs the result and the coverage they called, so opponent tendencies fill in |

How to use it:

1. Run Madden **full screen or borderless** at any 16:9 size (1080p, 1440p and 4K tested). Keep the app open in Chrome on a second monitor, or on a phone/tablet (sharing only works from the PC's browser).
2. Set **My team on scoreboard**: *Right* when you're the home team (right side of the score bug), *Left* when you're away.
3. Call plays from the app or straight in Madden. After each snap the app logs the play it sees in *Previous Play*, matches it to your playbook, and records the yards (from the ball-spot change), TD, coverage and blitz. Logged results are tagged **Auto-logged**; tap a result in *Recent plays* to fix it.
4. Turnovers, punts, kicks and the end of a half are skipped. Log those by hand if you want them.

Privacy and rules: frames are read in your browser and thrown away. Nothing is uploaded, and the app never touches the game (no memory reading, no inputs). Some organized tournaments ban outside tools during matches, so check their rules.

Under the hood: `src/vision/` holds a small digit reader trained on Madden 27's scoreboard font (`scripts/fixtures/*.png`, rebuilt with `npm run build:glyphs`) and a text reader for the Previous Play names (served from `/tesseract`, copied in at build time). `npm run test:vision` checks every fixture at five screen sizes, the defense-name mapping and the auto-log rules. If Madden changes the scoreboard in an update, add a labelled screenshot to `scripts/fixtures`, list it in `scripts/build-glyphs.ts`, and rebuild.

## 5. Turning on subscriptions (later, about 25 minutes)

When the app is finished and you're ready to charge:

**A. Flip the two switches**
1. Supabase → SQL Editor → run:
   ```sql
   update public.app_settings set value = 'true' where key = 'billing_enabled';
   ```
2. Netlify → Environment variables → set `VITE_BILLING_ENABLED` to `true`, and add `SUPABASE_SERVICE_ROLE_KEY`.
   Do steps B below first so the Stripe values are ready, then **Trigger deploy**.

Until both are flipped, nobody is charged. Admin accounts always keep access. Existing users will see the
Subscribe screen after the switch, so announce it first (or give early users a promo code).

**B. Set up Stripe**


#### Step 1 — Account and test environment
1. Sign up at stripe.com. You can build everything before finishing business verification.
2. Work in a **sandbox** (or **Test mode** on older accounts) — switch it from the account menu at the top left.
   Sandbox money is fake; nothing charges a real card. Everything below is done **twice**: once in the sandbox now,
   and again in live mode at launch, because products, prices, keys and webhooks don't carry over.

#### Step 2 — Product and prices
1. **Product catalog → + Add product.** Name: `ATL OC 27`. Description: e.g. "Madden 27 offensive coordinator — play
   caller, game plans, opponent tendencies and stats." Optionally upload the app icon (`public/icons/icon-512.png`).
2. Pricing: **Recurring**, **Monthly**, your price (e.g. $9.99). Save.
3. On the product page, **+ Add another price** → **Recurring**, **Yearly**, your price (e.g. $79.99 — a discount
   encourages annual plans). Save.
4. Click each price and copy its **price ID** (`price_…`) — not the product ID (`prod_…`).

| Copy this | Netlify variable |
|---|---|
| Monthly price ID `price_…` | `STRIPE_PRICE_MONTHLY` |
| Yearly price ID `price_…` | `STRIPE_PRICE_YEARLY` |

The free trial is set by `STRIPE_TRIAL_DAYS` (default 7; 0 = none), not in Stripe. Promo codes are already allowed
at checkout — create them under **Product catalog → Coupons**.

#### Step 3 — Customer portal
**Settings → Billing → Customer portal.** Turn on: update payment method, view invoices, cancel subscriptions
(choose *at end of billing period* so subscribers keep access through what they paid for), and optionally switch
plans (add both prices). Add your business name, support email, and links to your Terms and Privacy Policy. **Save.**
This powers **Account → Manage billing**, so you never handle cancellations by hand.

#### Step 4 — API key
**Developers → API keys** (or **Workbench → API keys**). Reveal the **Secret key** (`sk_test_…` in the sandbox,
`sk_live_…` in live) → Netlify variable `STRIPE_SECRET_KEY`. **Private** — it can move money; never share it.
The *publishable* key (`pk_…`) is not used by this app.



#### Step 5 — Webhook (how Stripe tells the app someone paid)
1. **Developers → Webhooks** (or **Workbench → Webhooks**) → **Create new destination** (*Add endpoint* on older screens).
2. **Events on your account**. Any API version works (the function re-reads subscriptions with its own pinned version).
3. Select exactly these four events, then **Continue**:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
4. Destination type: **Webhook endpoint**. Endpoint URL:
   `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook` (description: "ATL OC 27 subscriptions") →
   **Create destination**.
5. Open the destination → **Signing secret → Reveal** → copy `whsec_…` → Netlify variable `STRIPE_WEBHOOK_SECRET`.
   **Private.** Each destination has its own secret; sandbox and live secrets differ.
6. Netlify: add the Stripe variables from section 2 Step 3, set `VITE_BILLING_ENABLED=true` → **Trigger deploy**.

#### Step 6 — Test a full purchase
1. Sign up in the app with a **second email** (not your admin account).
2. On **Subscribe**, tap **Subscribe monthly**. On Stripe's page use test card **4242 4242 4242 4242**, any future
   expiry, any 3-digit CVC, any ZIP.
3. You return to the app; within a few seconds the playbook unlocks.
4. Confirm: Stripe → your webhook → **Event deliveries** shows the four events **Delivered** (200). Supabase →
   Table Editor → `subscriptions` shows `trialing` or `active`.
5. **Account → Manage billing → Cancel** → `subscriptions` gets *cancel_at_period_end = true*, access continues to
   the period end, then the status becomes `canceled` and the paywall returns.

**If the playbook doesn't unlock:** open the failed delivery's response. *400 signature* = wrong `STRIPE_WEBHOOK_SECRET`
(or you didn't redeploy). *500* = `SUPABASE_SERVICE_ROLE_KEY` missing/wrong. *404* = wrong URL — it must include
`/.netlify/functions/stripe-webhook`. Fix it and click **Resend** on the event. *"Pricing is not configured yet"* at
checkout = price ID variables missing.

#### Step 7 — Going live
1. Finish **business verification** (business type, tax ID, payout bank account).
2. Switch to **live mode** and repeat steps 2–5: new product and prices, live portal settings, `sk_live_…` key,
   new webhook destination and its `whsec_…`.
3. In Netlify replace `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
   with the live values → **Trigger deploy**.
4. Run one real purchase on your own card, confirm it unlocks, then refund it from **Payments**.


## 6. Project layout

```
data/                  atlanta-plays.txt (names) · atlanta-playbook.csv (auto-tagged, import format)
scripts/               build_atlanta_seed.py · engine-smoke.ts · engine-full.ts · build-glyphs.ts · vision-test.ts · fixtures/
supabase/migrations/   001_schema.sql (tables, RLS, access gate + billing switch, triggers, views) · 002_seed.sql (614 plays)
netlify/functions/     create-checkout · customer-portal · stripe-webhook   (shared code in netlify/lib)
src/engine/            classify · situation · recommend · tendencies · screenAlert   (pure logic, no UI)
src/vision/            scoreboard reader · Previous Play reader · defense-call mapping · auto-log · link controller
src/analytics/         stats (from stored results only)
src/data/              api (loading) · plays (master writes) · mappers (DB ↔ app)
src/offline/           queue (offline-safe writes, auto-sync on reconnect)
src/import/            CSV/JSON parse, validate, dedupe, import, export
src/state/             zustand store (+ IndexedDB snapshot) · engine context hook
src/components/        PlayCard, FavoriteHeart, PlayRecommendation, SituationSelector, CoverageSelector,
                       QuickCallButton, SchemeCard, GamePlanCard, OpponentTendencyCard, PlayResultModal,
                       PlayFilters, PlaySearch, ScreenAlert, RecommendationExplanation, …
src/pages/             GameCaller, Playbook, ScreenCenter, PlayDetail, Favorites, Schemes, SchemeEditor,
                       GamePlans, GamePlanEditor, Stats, GameDetail, Admin, PlayEditor, Account, Login, Subscribe
```

## 7. Before you sell it

"Madden" and "NFL" are trademarks and the Falcons name/logos belong to the team. The app uses original artwork only and
shows a non-affiliation notice. For a paid product, have an attorney review your app name ("ATL"), marketing copy, and
use of EA play names before launch. You'll also want Terms of Service and a Privacy Policy linked from the sign-up screen.
