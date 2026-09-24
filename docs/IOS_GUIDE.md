# ShareWallet on iPhone — the full guide

This takes ShareWallet from this repository to an app your friends install
from **TestFlight** on their iPhones. It is written for the Mac that belongs
to the friend with the Apple Developer account, and it assumes nothing is
installed on it yet.

Plan for **one afternoon** on the Mac, then **a day or two** waiting for
Apple to review the first TestFlight build.

Nothing secret is in this file. The secret files (`.env` and friends) come
separately from Ramesh — see [Step 3](#3-get-the-code-and-the-private-files).

---

## Contents

1. [What you need before starting](#1-what-you-need-before-starting)
2. [Set up the Mac](#2-set-up-the-mac)
3. [Get the code and the private files](#3-get-the-code-and-the-private-files)
4. [Apple Developer account: one-time setup](#4-apple-developer-account-one-time-setup)
5. [Code changes that need the Team ID](#5-code-changes-that-need-the-team-id)
6. [Push notifications on iPhone](#6-push-notifications-on-iphone)
7. [Build and try it on an iPhone](#7-build-and-try-it-on-an-iphone)
8. [Upload to TestFlight](#8-upload-to-testflight)
9. [Invite testers](#9-invite-testers)
10. [Check everything works](#10-check-everything-works)
11. [Shipping an update later](#11-shipping-an-update-later)
12. [When something goes wrong](#12-when-something-goes-wrong)

---

## 1. What you need before starting

### The Mac

- A Mac that can run **the current version of Xcode** from the Mac App Store
  (Apple Silicon or a recent Intel Mac). Expo SDK 57 needs a recent Xcode;
  if Xcode says it is too old for the project, update macOS and Xcode first.
- About **40 GB free** disk space (Xcode alone is huge).
- An iPhone and its cable, to test on a real device before TestFlight.

### The data to collect — fill this in first

| # | What | Where it comes from | Who |
|---|---|---|---|
| 1 | **Apple ID email** of the developer account | The friend's Apple account | Friend |
| 2 | **Account type**: Individual or Organization | developer.apple.com → Account → Membership details | Friend |
| 3 | **Team ID** (10 characters, e.g. `A1B2C3D4E5`) | developer.apple.com → Account → Membership details | Friend |
| 4 | **APNs key file** (`AuthKey_XXXXXXXXXX.p8`) | Created in [Step 6](#6-push-notifications-on-iphone) — downloadable **once only** | Friend |
| 5 | **APNs Key ID** (10 characters) | Shown next to the key, and in the file name | Friend |
| 6 | **App name** on the App Store (must be unique worldwide) | You choose; "ShareWallet" may be taken — try "ShareWallet LK" etc. | Both |
| 7 | **Tester emails** (the Apple IDs of friends who will install) | Your friends | Ramesh |
| 8 | **A demo account** for Apple's reviewer (email + password) | Create one in the app | Ramesh |
| 9 | `.env` file | Ramesh's private setup kit | Ramesh |
| 10 | **Expo account login** (account `rameshshankar`) — only to upload the APNs key | Ramesh | Ramesh |
| 11 | **Firebase login** — only to publish the file in Step 5b | Ramesh | Ramesh |

Items 3, 4 and 5 are the ones only the Apple account owner can get. Items 10
and 11 can be done by Ramesh on Ramesh's own computer — they do not need the Mac.

**Keep the `.p8` file safe.** Apple lets you download it exactly once. Never
put it in the repository (`*.p8` is already in `.gitignore`).

---

## 2. Set up the Mac

Open **Terminal** and run these one block at a time.

### 2a. Xcode

1. Install **Xcode** from the Mac App Store and open it once. Accept the
   licence and let it install its extra components.
2. In Xcode → **Settings → Platforms**, make sure an **iOS** platform is
   installed.
3. In Xcode → **Settings → Accounts**, press **+** and sign in with the Apple
   ID from item 1.
4. Command-line tools:

   ```bash
   xcode-select --install          # if it says "already installed", fine
   sudo xcodebuild -license accept
   ```

### 2b. Homebrew, Node, CocoaPods, Watchman

```bash
# Homebrew — the Mac package manager (skip if `brew -v` already works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# Follow the two "Next steps" lines it prints to add brew to your PATH.

brew install git watchman cocoapods

# Node 20 via nvm, the version this project is built with
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# close and reopen Terminal, then:
nvm install 20
nvm alias default 20
node -v      # v20.x
```

### 2c. Tools used later

```bash
npm install -g eas-cli            # only needed for Option B builds and Expo login
```

---

## 3. Get the code and the private files

```bash
cd ~
git clone https://github.com/Rameshshankar5/sharewallet.git
cd sharewallet
npm ci
```

Now copy in the private files Ramesh sends you (by USB, AirDrop, or a private
link — **never** by committing them):

| File from Ramesh | Put it at |
|---|---|
| `.env` | `sharewallet/.env` (project root) |
| `google-services.json` *(Android only, but harmless)* | `sharewallet/google-services.json` |

Check it is picked up:

```bash
grep EXPO_PUBLIC_FIREBASE_PROJECT_ID .env
# EXPO_PUBLIC_FIREBASE_PROJECT_ID=sharewallet-963b7
```

Run the checks once so you know the clone is healthy:

```bash
npx tsc --noEmit        # no output = good
npm test                # all tests pass
```

---

## 4. Apple Developer account: one-time setup

Signed in at **developer.apple.com** with the account from item 1.

### 4a. If the account is an Organization

You can invite Ramesh (**Users and Access** in App Store Connect, role *App
Manager* or higher) so Ramesh can build under Ramesh's own Apple ID. With an
**Individual** account that is not possible — the account owner signs in to
Xcode on this Mac and does the steps personally. Either way works.

### 4b. Register the app's identifier

1. **Certificates, Identifiers & Profiles → Identifiers → +**
2. **App IDs → App**. Description: `ShareWallet`.
   Bundle ID: **Explicit**, `com.sharewallet.app`.
3. Under **Capabilities** tick:
   - **Push Notifications**
   - **Associated Domains** (makes invite links open the app)
4. **Continue → Register.**

If `com.sharewallet.app` is refused as already taken, pick another (for
example `com.<yourname>.sharewallet`) and change `ios.bundleIdentifier` in
`app.json` to match. Do **not** change `android.package` — the Android app
already exists under that name.

### 4c. Create the app in App Store Connect

1. **appstoreconnect.apple.com → Apps → + → New App**
2. Platform **iOS**, Name (item 6), Primary language English,
   Bundle ID `com.sharewallet.app`, SKU `sharewallet-001`,
   User access **Full Access**.

Nothing here publishes anything. TestFlight builds are only visible to the
testers you add.

---

## 5. Code changes that need the Team ID

Replace `TEAMID` below with item 3 (e.g. `A1B2C3D4E5`).

### 5a. `app.json` — claim the invite-link domain on iOS

Inside `"ios": { … }` add `associatedDomains` and a `buildNumber`:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.sharewallet.app",
  "buildNumber": "1",
  "associatedDomains": ["applinks:sharewallet-963b7.web.app"],
  "infoPlist": { "ITSAppUsesNonExemptEncryption": false },
  "icon": "./assets/images/icon.png"
}
```

### 5b. Publish the Apple link file (Ramesh does this — needs Ramesh's Firebase login)

Create **`hosting/.well-known/apple-app-site-association`** (no file
extension):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.sharewallet.app"],
        "components": [{ "/": "/i/*", "comment": "Invite links" }]
      }
    ]
  }
}
```

In `firebase.json`, add a second entry to `hosting.headers` so Apple gets it
as JSON:

```json
{
  "source": "/.well-known/apple-app-site-association",
  "headers": [{ "key": "Content-Type", "value": "application/json" }]
}
```

Publish and check:

```bash
firebase deploy --only hosting --project sharewallet-963b7
curl -sI https://sharewallet-963b7.web.app/.well-known/apple-app-site-association | grep -i content-type
# content-type: application/json
```

Commit both changes and push, then `git pull` on the Mac.

---

## 6. Push notifications on iPhone

Android notifications go through Firebase; iPhone ones go through Apple
(APNs). The app sends both through **Expo's push service**, which needs an
Apple key to talk to APNs. No code changes — just the key.

### 6a. Create the key (account owner)

1. developer.apple.com → **Certificates, Identifiers & Profiles → Keys → +**
2. Name `ShareWallet Push`, tick **Apple Push Notifications service (APNs)**.
   If asked, choose **Sandbox & Production**.
3. **Continue → Register → Download.** You get `AuthKey_XXXXXXXXXX.p8`.
   This is item 4; the `XXXXXXXXXX` part is the Key ID (item 5).
   **This is the only time it can be downloaded.**

### 6b. Give it to Expo (Ramesh — works from any computer)

Easiest in the browser:

1. Sign in at **expo.dev** as `rameshshankar`.
2. Project **sharewallet → Credentials → iOS → `com.sharewallet.app`**.
3. **Push Notifications → Add a push key → upload the `.p8`**, enter the Key
   ID and the Team ID.

(Alternative in Terminal: `eas login`, then `eas credentials -p ios` →
*Push Notifications: Manage your Apple Push Notifications Key* → *Add a new
push key*.)

---

## 7. Build and try it on an iPhone

### 7a. Generate the iOS project

```bash
cd ~/sharewallet
npx expo prebuild --platform ios --clean
```

This creates the `ios/` folder (it is gitignored and regenerated every time,
so never hand-edit it) and runs `pod install` for you. If that last part
fails, run `cd ios && pod install && cd ..`.

### 7b. Open it in Xcode

```bash
xed ios
```

1. In the left sidebar click the blue project icon, then the **app target**.
2. **Signing & Capabilities** tab:
   - Tick **Automatically manage signing**.
   - **Team**: choose the developer team.
   - Bundle Identifier must read `com.sharewallet.app`.
   - Check **Push Notifications** and **Associated Domains**
     (`applinks:sharewallet-963b7.web.app`) are listed. Prebuild adds them
     from `app.json`; if one is missing, press **+ Capability** and add it.

### 7c. Run on a real iPhone

1. Plug the iPhone in, unlock it, tap **Trust**.
2. On the iPhone: **Settings → Privacy & Security → Developer Mode → On**
   (it restarts).
3. In Xcode's top bar, choose **Product → Scheme → Edit Scheme… → Run →
   Build Configuration: Release**. (Release has the app code built in; Debug
   would need `npx expo start` running on the Mac.)
4. Pick the iPhone as the destination and press **▶ Run**.
5. First time only: iPhone **Settings → General → VPN & Device Management**
   → trust the developer.

Sign in and try it. If this works, the TestFlight build will too.

---

## 8. Upload to TestFlight

### Option A — Xcode on this Mac (free, recommended)

1. Xcode top bar destination: **Any iOS Device (arm64)**.
2. **Product → Archive.** Takes several minutes.
3. The **Organizer** window opens → select the archive → **Distribute App →
   App Store Connect → Upload**. Accept the defaults.
4. In App Store Connect → your app → **TestFlight**, the build shows as
   *Processing* for 10–30 minutes, then becomes available.

Export compliance is already answered in the app
(`ITSAppUsesNonExemptEncryption: false`), so it will not ask.

### Option B — EAS cloud build (no Xcode needed, uses Expo's free quota)

```bash
eas login                        # as rameshshankar
eas build --platform ios --profile production
eas submit --platform ios --latest
```

EAS asks for the Apple ID from item 1 and creates the certificates itself.
Useful if the Mac is not available, but builds queue behind paying users.

---

## 9. Invite testers

In App Store Connect → your app → **TestFlight**:

- **Internal testing** — people who are members of the developer team in
  App Store Connect. Up to 100, no review, available immediately. Good for
  the two of you.
- **External testing** — anyone with an email address. Create a group (e.g.
  *Friends*), add the build, add tester emails (item 7) or turn on a
  **public link** and share it. The **first** build for external testers
  goes through **Beta App Review** (usually within a day or two); later
  builds are normally quicker.

For Beta App Review, fill in **Test Information**:

- Feedback email and contact details.
- What to test: "Split expenses between friends: add an expense, settle up."
- **Sign-in required: Yes**, with the demo account from item 8. Without a
  working login, Apple rejects the build.

Testers install **TestFlight** from the App Store, then accept the invite.
Each build works for **90 days**; after that upload a new one.

---

## 10. Check everything works

On an iPhone with the TestFlight build:

- [ ] Sign in with an existing account; balances load.
- [ ] Sign up with a new email; the verification email arrives; setting the
      password gets you in.
- [ ] Accept the notification prompt. Account tab shows **Notifications: On**.
- [ ] From another phone, add an expense that includes this person — a
      notification arrives. (Ramesh can also send one by hand:
      `node scripts/push-test.mjs send <email>` on Ramesh's computer.)
- [ ] Send an invite link to this iPhone (e.g. via WhatsApp) and tap it — it
      should open **the app**, not Safari. (If Safari opens, see below.)
- [ ] Camera / photo picker for a profile picture and a receipt.
- [ ] Calculator on the amount fields.

---

## 11. Shipping an update later

1. `git pull` on the Mac, `npm ci`.
2. In `app.json`, raise `"version"` (e.g. `1.11.0`) and `ios.buildNumber`
   (e.g. `"2"`). **Every upload needs a higher `buildNumber`** than the last.
3. `npx expo prebuild --platform ios --clean`
4. Xcode → **Product → Archive → Distribute App** (step 8).
5. In TestFlight, add the new build to the testers' group.

---

## 12. When something goes wrong

**`pod install` fails**
: `cd ios && pod repo update && pod install`. If it still fails,
  `sudo gem install cocoapods` or `brew upgrade cocoapods`, then retry.

**"No profiles for 'com.sharewallet.app' were found" / signing errors**
: Signing & Capabilities → pick the Team again with *Automatically manage
  signing* on. Make sure Xcode → Settings → Accounts shows the developer
  account, and that Step 4b was done.

**"Xcode version too old" or Swift errors during build**
: Update Xcode from the App Store, then `npx expo prebuild --platform ios --clean`.

**The app shows "Firebase isn't connected yet"**
: `.env` is missing or in the wrong place. It must be in the project root.
  Then `npx expo prebuild --platform ios --clean` and rebuild.

**Invite links open Safari instead of the app**
: - Check the file: `curl https://sharewallet-963b7.web.app/.well-known/apple-app-site-association`
    shows your `TEAMID.com.sharewallet.app`.
  - Apple caches that file. Check Apple's copy:
    `https://app-site-association.cdn-apple.com/a/v1/sharewallet-963b7.web.app`.
    It can take a day to refresh; deleting and reinstalling the app forces a
    re-check.
  - Tapping a link inside Safari's own address bar never opens apps — test
    from Notes, Messages or WhatsApp.
  - The in-page **Open in ShareWallet** button always works as a fallback.

**Notifications never arrive on iPhone**
: - The APNs key is uploaded to Expo for bundle `com.sharewallet.app` (6b).
  - The Push Notifications capability is on the target (7b).
  - iPhone Settings → ShareWallet → Notifications is allowed.
  - Run `node scripts/push-test.mjs send <email>` on Ramesh's computer; the
    receipt it prints names the problem (for example `InvalidCredentials`
    means the key, Key ID or Team ID is wrong).

**Apple rejects the TestFlight build**
: The email explains why. The most common: the demo account does not work,
  or the reviewer could not find how to use the app. Fix and resubmit the
  same build from TestFlight.
