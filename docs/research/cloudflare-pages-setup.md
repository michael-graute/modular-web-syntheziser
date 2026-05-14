# Cloudflare Pages — Setup Guide

This app deploys automatically to Cloudflare Pages via GitHub Actions on every push to `main`.  
The `_headers` file in `public/` sets the COOP/COEP headers required for AudioWorklet / SharedArrayBuffer support.

---

## What was added to the repo

| File | Purpose |
|---|---|
| `public/_headers` | Instructs Cloudflare Pages to add COOP/COEP headers on every response |
| `.github/workflows/deploy.yml` | GitHub Actions workflow — builds and deploys to Cloudflare Pages on push to `main` |

---

## One-time Cloudflare setup

### Step 1 — Create a Cloudflare account

Go to [cloudflare.com](https://cloudflare.com) and sign up for a free account if you don't have one.

---

### Step 2 — Create a Cloudflare Pages project

1. In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar.
2. Click **Create** → **Pages** → **Connect to Git** — but then click **Cancel** (we deploy via GitHub Actions, not direct Git integration).
3. Instead, click **Create** → **Pages** → **Upload assets** — give the project the name **`modular-web-synthesizer`** — and click **Create project**. You can ignore the upload step; the GitHub Actions workflow will handle all deploys.

> The project name `modular-web-synthesizer` must match exactly what is in `.github/workflows/deploy.yml` (`--project-name=modular-web-synthesizer`). If you use a different name, update the workflow file to match.

---

### Step 3 — Create a Cloudflare API Token

1. Click your profile icon (top right) → **My Profile** → **API Tokens**.
2. Click **Create Token**.
3. Use the template **"Edit Cloudflare Workers"** — or create a custom token with these permissions:
   - **Account** → `Cloudflare Pages` → `Edit`
4. Under **Account Resources**, select your account.
5. Click **Continue to summary** → **Create Token**.
6. Copy the token — you will not see it again.

---

### Step 4 — Find your Cloudflare Account ID

1. In the Cloudflare dashboard, click **Workers & Pages** in the sidebar.
2. Your **Account ID** is shown in the right-hand sidebar under "Account ID". Copy it.

---

### Step 5 — Add secrets to GitHub

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add both:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The token you created in Step 3 |
| `CLOUDFLARE_ACCOUNT_ID` | The account ID from Step 4 |

---

### Step 6 — Push to main and confirm the deploy

Push any commit to `main` (or just merge the current changes). The Actions workflow will:

1. Install dependencies
2. Run `npm run build`
3. Deploy the `dist/` folder to Cloudflare Pages

You can watch it live under your repository → **Actions** tab.

Once complete, Cloudflare Pages assigns a URL in the format:

```
https://modular-web-synthesizer.pages.dev
```

You'll find the exact URL in the Cloudflare dashboard under **Workers & Pages** → **modular-web-synthesizer** → **Deployments**.

---

## Optional — Add a custom domain

1. In the Cloudflare dashboard → **Workers & Pages** → **modular-web-synthesizer** → **Custom domains**.
2. Click **Set up a custom domain** and follow the prompts.
3. If your domain is already on Cloudflare DNS, it activates immediately. Otherwise follow the nameserver instructions.

---

## Verifying COOP/COEP headers

After the first deploy, open the app URL in Chrome and run this in DevTools console:

```js
typeof SharedArrayBuffer !== 'undefined'   // should return true
```

Or check the response headers in the **Network** tab — you should see:

```
cross-origin-opener-policy: same-origin
cross-origin-embedder-policy: require-corp
```
