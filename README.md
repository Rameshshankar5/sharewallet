# 1-1-1

A private expense-splitting app for you and your friends. Built with Expo
(React Native) and Firebase, with **no backend code and no paid services**.

Android and iOS, one codebase.

---

## What it does

- **Every person has their own account.** People sign themselves up with an
  email address they have to prove they own, or the superadmin creates the
  account for them. The superadmin can see and pause every account.
- **You only see people you are connected to.** Share your invite link; a
  friend who taps it and accepts is connected to you. Rooms have invite links
  too, and everyone in a room is connected to everyone else in it.
- **Person-to-person balances.** Your running total with each individual friend,
  kept separately, plus one overall figure.
- **Multiple payers on one expense.** Enter the full amount, then record that
  Kasun paid Rs 1,000 and Nimal paid Rs 200 for the same thing.
- **Editable splits.** Equally, exact amounts, shares, or percentages. Type over
  any person's share and the untouched rows absorb the remainder.
- **The total must balance before you can save.** Both what everyone paid and
  what everyone owes have to add up to the expense total. The Save button tells
  you exactly how much you are short or over until they do.
- **Rooms.** A fixed group of friends. Every expense inside a room is visible to
  every member of that room, and picking a room pre-selects everyone in it.
- **A full audit trail.** Every change records who made it, when, and the value
  before and after — right down to "Kasun owes: Rs 400.00 → Rs 500.00". The log
  is append-only at the database level, so nobody can quietly rewrite history.
- **Settle up.** Record cash changing hands; the app suggests the fewest
  payments that clear a whole room.

---

## Cost, honestly

| Piece | Cost |
|---|---|
| Firebase Auth + Firestore (Spark plan) | **Free.** A group of friends will not come near the free quotas. |
| Cloud Functions | **Not used** — deliberately. They now require a billing-enabled project, so everything runs client-side instead. |
| Expo / EAS | **Free tier is enough.** |
| Android app | **Free.** Build an `.apk`, friends install it once. |
| iOS app | Covered by your friend's Apple Developer account. |

Both platforms build to real, installable apps. See
[Getting it onto your friends' phones](#getting-it-onto-your-friends-phones).

---

## Setup

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and create a project.
   Turn Google Analytics **off** — you don't need it.
2. **Build → Authentication → Get started → Email/Password → Enable.**
   Leave "Email link" off.
3. **Build → Firestore Database → Create database.** Pick a region near you
   (e.g. `asia-south1`). Start in **production mode** — we ship our own rules.
4. **Project settings → General → Your apps → Web (`</>`)**. Register an app
   (any nickname). Copy the config values it shows you.

### 2. Point the app at it

```bash
cp .env.example .env
```

Fill in `.env` with the values from step 1.4. These are not secrets — every
Firebase client app ships them — and `firestore.rules` is what actually protects
your data. `.env` is gitignored anyway.

### 3. Publish the security rules, indexes and invite-link site

```bash
npm install -g firebase-tools     # one time
firebase login
firebase use --add                # pick your project
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Do not skip this. Without it your database is either wide open or completely
shut, and the app's queries will fail for want of indexes.

`hosting` publishes `hosting/` to `https://<project>.web.app`, which is where
invite links point. It also serves `/.well-known/assetlinks.json`, which is
what lets Android open those links straight in the app. That file names the
release signing certificate's SHA-256, so it has to change if the keystore
ever does. iOS needs an `apple-app-site-association` file there as well, which
needs the Apple Team ID.

### 4. Create the first superadmin by hand

This is the only manual step. Anybody can sign themselves up, but only as a
plain member. There is deliberately no self-service path to becoming an
admin, because that path would be open to anyone.

1. **Authentication → Users → Add user.** Enter your email and a password.
   Copy the **User UID** it creates.
2. **Firestore Database → Start collection**, collection ID `users`.
3. Create a document whose **Document ID is exactly that UID**, with these
   fields:

   | Field | Type | Value |
   |---|---|---|
   | `uid` | string | *the same UID* |
   | `email` | string | your email, lowercase |
   | `displayName` | string | your name |
   | `role` | string | `superadmin` |
   | `active` | boolean | `true` |
   | `mustChangePassword` | boolean | `false` |
   | `createdAt` | number | `0` |
   | `createdBy` | string | *(leave empty)* |

From now on you create everyone else from inside the app:
**Account → Manage members → Create an account.**

### 5. Run it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator.
If you change `.env`, restart with `npx expo start -c` to clear the cache.

---

## Getting it onto your friends' phones

### Android — free, a real app

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

You get a download link to an `.apk`. Send it to your friends; they tap it,
allow "install from unknown sources" once, and it's a normal app with its own
icon. It never expires.

To avoid EAS build credits entirely you can build locally instead
(`eas build --platform android --profile preview --local`), which needs Android
Studio installed.

### iOS — using your friend's Apple Developer account

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

EAS asks for the Apple ID that owns the developer account and handles the
certificates and provisioning profiles for you. Then add your friends as testers
in **TestFlight** — they install it like any other app, up to 100 people.

Two things to check with your friend first:

- **Is the account an Organization or an Individual one?** An Organization
  account can invite you to the team in App Store Connect (App Manager is
  enough), so you build under your own Apple ID. An Individual account cannot
  add members at all — in that case your friend has to run the two commands
  above themselves, or you use their Apple ID directly.
- **The bundle identifier is `com.sharewallet.app`.** It has to be unique across
  the whole App Store. If it is taken, change `ios.bundleIdentifier` and
  `android.package` in `app.json` to something based on a domain your friend
  owns, before the first build.

Builds are free on the EAS free tier, just queued behind paying users.

---

## How it works

### Money is stored as integers

Every amount is an integer number of **cents**. `0.1 + 0.2 !== 0.3` in floating
point, and in a splitting app those errors compound across participants until a
balance is off by a cent and nobody can settle. Conversion to a decimal happens
only when parsing input and rendering.

### Splits always add up

Dividing Rs 10.00 three ways gives 333.33 cents each, which doesn't exist. The
leftover cents are handed out one at a time by largest fractional remainder,
ties broken by user ID — so the parts always sum to exactly the total, and the
same input always produces the same output. (A jittery algorithm would show
phantom "changes" in the audit log.)

### Balances

Each expense reduces to person-to-person debts:

1. `net[person] = what they paid − what they owe`
2. Greedily match the biggest creditor against the biggest debtor.

That gives the fewest edges, deterministically. A settlement is recorded as cash
flowing the opposite way to a debt, so it cancels out rather than deleting
anything.

### Visibility

Every expense, settlement and audit row carries a `viewerIds` array — the
participants, plus the members of its room if it has one. Security rules and
queries both key off that single array, so "can this person see this" is one
indexed check rather than a chain of lookups. Changing a room's membership
re-syncs `viewerIds` across that room's expenses.

### Concurrent edits

Each expense has a `version`. Saving an edit requires the version you loaded to
still be current; if someone else saved in the meantime, you get a clear prompt
instead of a silent overwrite. Security rules enforce the version increment, so
this can't be bypassed by a stale app.

### Accounts without a backend

Creating a Firebase user normally signs that user in, which would kick the
admin out of their own session. Instead the app opens a **second, temporary**
Firebase Auth connection, creates the account there, signs it out, and discards
it. The admin's session is untouched, and no Cloud Function (and therefore no
billing account) is needed.

---

## Project layout

```
src/
  app/                 Screens (expo-router: the file path is the route)
    (tabs)/            Balances · Rooms · Activity · Account
    expense/           new.tsx (create + edit), [id].tsx (detail + history)
    room/              [id].tsx, new.tsx (create + edit)
    friend/[uid].tsx   Your ledger with one person
    settle/new.tsx     Record a payment
    admin/             Superadmin-only member management
  components/          UI kit — one Text, one Button, one Card, etc.
  context/             AuthContext (session), DataContext (live Firestore data)
  services/            All Firestore writes, each paired with its audit entry
  lib/                 Pure logic: money, split, balance, diff, time
  theme/               Design tokens and the light/dark provider
  types/               Shared TypeScript shapes
firestore.rules        The real security boundary — read this one
firestore.indexes.json Composite indexes the queries need
tests/math.test.js     Tests for the money maths
```

## Checks

```bash
npm test          # money, splitting and balance logic
npm run typecheck # TypeScript
```

`npm test` covers the awkward cases: indivisible splits, hand-edited shares,
multiple payers, settlements cancelling debts, and a brute-force sweep proving
no total is ever lost or invented.

---

## Design

Dark and light themes, following the phone's setting. All colours come from
`src/theme/tokens.ts` — never hardcoded in a component, so both themes stay
correct. Icons are vector (Lucide) at one stroke weight; empty states are flat
SVG illustrations drawn from theme tokens, so they recolour properly instead of
being PNGs that look wrong in one mode. Every tap target is at least 48pt, money
figures use tabular digits so columns don't jitter, and status is never conveyed
by colour alone.
