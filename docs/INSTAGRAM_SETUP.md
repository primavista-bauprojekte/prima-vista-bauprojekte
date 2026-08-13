# Instagram feed — setup guide

The homepage has an Instagram section that shows the latest posts from
[@primavista.bauprojekte](https://www.instagram.com/primavista.bauprojekte).
The code is already deployed, but the section stays **hidden** until an access
token is configured. This guide is the one-time job that turns it on.

**Time:** about 20 minutes. **Cost:** free. **Meta App Review:** not required —
reading your own account only needs Standard Access.

---

## What you get

Once connected, every new Instagram post appears on the homepage automatically,
usually within a day (and within 30 minutes for anyone who loads the page after
Instagram has it). Nothing needs to be copied over by hand.

Images are copied onto our own server the first time they are shown, so the feed
keeps working even though Instagram's own image links expire after a few hours.

---

## Before you start

**The Instagram account must be a Professional account.** Personal accounts
cannot be read by any Meta API — this is the single hard requirement.

In the Instagram app: profile → **☰** → **Settings and privacy** →
**Account type and tools** → **Switch to professional account** → pick a
category → choose **Business** or **Creator**. If it offers to connect a
Facebook Page you can **skip** that; this integration does not need one.

The account must also be **public**. Private accounts return no media.

---

## Step 1 — Create a Meta app

1. Go to <https://developers.facebook.com/apps/> and log in. (You need a
   Facebook *account* to own the app, but no Facebook *Page*.)
2. Click **Create App**.
3. **App details:** name it something like `Prima Vista Website Feed`, add a
   contact email → **Next**.
4. **Use cases:** choose **Manage messaging and content on Instagram**.
5. **Business:** choose *"I don't want to connect a business portfolio yet"* if
   you don't have one — it is not required.
6. Finish the wizard and click **Go to dashboard**.

If the Instagram product is not already in the left menu, click **Add product**
and set up **Instagram**.

---

## Step 2 — Configure the redirect URL

Left menu → **Instagram** → **API setup with Instagram login** → section
**3. Set up Instagram business login** → **Set up**.

Enter our live site as the redirect URL, and the same value for the two other
required fields in **Business login settings**:

```
https://primavista-bauprojekte.com/
```

The URL must be HTTPS, cannot contain wildcards, and must match byte-for-byte
later. Note whether the dashboard adds a trailing slash — it often does.

---

## Step 3 — Generate the token

Still under **Instagram → API setup with Instagram login**, go to section
**1. Generate access tokens**.

1. Click **Add account**, log in with the Instagram account, and click **Allow**.
2. Click **Generate token** next to the account.
3. Log in again in the popup if asked, then **copy the token**.

The token starts with `IGAA…` and is already long-lived — valid for 60 days.

> **Treat this token like a password.** Anyone holding it can read the account
> through the API. Do not paste it into email, chat, or a Git commit.

### Verify it works (optional)

```bash
curl -s "https://graph.instagram.com/v26.0/me?fields=user_id,username&access_token=YOUR_TOKEN"
```

You should see the account's username come back.

---

## Step 4 — Add the token to Netlify

In the Netlify dashboard for the site: **Site configuration → Environment
variables → Add a variable**.

| Key | Value |
| --- | --- |
| `INSTAGRAM_ACCESS_TOKEN` | the `IGAA…` token from Step 3 |

Set it for **all deploy contexts** so preview and production both work.

Optional extras:

| Key | Purpose |
| --- | --- |
| `INSTAGRAM_USERNAME` | Handle shown next to the follow button. Defaults to whatever the API reports. |
| `INSTAGRAM_POST_LIMIT` | How many posts to show. Default `12`, maximum `24`. |
| `INSTAGRAM_API_VERSION` | Graph API version override. Default `v26.0`. |

Then **redeploy** the site (Deploys → Trigger deploy → Deploy site). The
Instagram section appears on the homepage as soon as the first posts load.

---

## Step 5 — Confirm it is live

Open <https://primavista-bauprojekte.com/> and scroll to just above the final
call-to-action block. You should see the post grid.

To check the API directly:

```bash
curl -s https://primavista-bauprojekte.com/api/instagram | head -c 400
```

`"configured": true` with a non-empty `posts` array means everything is working.
If `configured` is `false`, the environment variable has not reached the
deployed build — re-check Step 4 and redeploy.

---

## The 60-day rule — and why you can ignore it

Instagram tokens expire 60 days after they are issued, **and a token that goes
60 days without being refreshed dies permanently** — the only recovery is
redoing Step 3.

The site handles this on its own. A scheduled function
(`netlify/functions/instagram-refresh.ts`) runs daily, swaps the current token
for a fresh 60-day one, and stores the replacement. The live token is therefore
never more than about a day old, and the 60-day deadline is never approached.
Missing a day — or a whole week — costs nothing.

This means **`INSTAGRAM_ACCESS_TOKEN` only seeds the process**. You do not need
to update it every 60 days. Leave it alone unless the feed actually stops.

### If the feed ever stops

Repeat Step 3 to generate a new token and paste it into the same Netlify
variable. The site detects that the value changed and restarts the refresh chain
from the new token automatically.

---

## Common errors

| Symptom | Cause and fix |
| --- | --- |
| `Invalid platform app` | You used the **Facebook** App ID instead of the **Instagram** App ID. They are different — the Instagram one is under **Instagram → API setup with Instagram login**. |
| `Invalid redirect_uri` | The URL does not exactly match the dashboard entry, usually a missing or extra trailing slash. |
| Scope errors | Old scope names (`instagram_basic`, `user_profile`, `user_media`) were retired in January 2025. The current one is `instagram_business_basic`. |
| Empty `posts` array, `configured: true` | The account is private, has no posts, or is still a personal account. |
| Section missing from the homepage | `configured: false` — the token never reached the deploy. Re-check Step 4 and redeploy. |

---

## How it works, briefly

| Piece | Role |
| --- | --- |
| `netlify/functions/_shared/instagram.ts` | Token lifecycle, feed fetching, image mirroring |
| `netlify/functions/instagram.ts` | `GET /api/instagram` and `/api/instagram/image/:id` |
| `netlify/functions/instagram-refresh.ts` | Daily token refresh + cache warm |
| `src/components/home/InstagramFeed.tsx` | The homepage section (renders nothing when unconfigured) |

The access token never reaches the browser: the site calls Instagram
server-side, and images are served from our own domain.
