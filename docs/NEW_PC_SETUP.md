# Running ShareWallet on a new computer

Everything needed to go from a blank Windows or macOS computer to building
the Android app, publishing rules, and running the tests.

The secret files are **not** in this repository. They are in the private
**ShareWallet setup kit** folder (`secrets/`), kept off GitHub on purpose —
the repository is public.

---

## 0. What you need

### Accounts (log-ins you must know)

| Account | Used for | Needed for |
|---|---|---|
| **GitHub** `Rameshshankar5` | the code | cloning, pushing |
| **Google account that owns Firebase project `sharewallet-963b7`** | database, auth, rules, invite-link site | `firebase deploy`, console |
| **Expo** `rameshshankar` | push notification credentials | only when changing push setup |
| **Cloudinary** (cloud `szpl750m`) | profile pictures and receipts | only when changing image setup |

### Files from the private kit

| Kit file | Goes to (inside the project folder) | What it is | If lost |
|---|---|---|---|
| `secrets/.env` | `.env` | Firebase + Cloudinary settings for the app | Rebuildable from the Firebase and Cloudinary consoles |
| `secrets/google-services.json` | `google-services.json` | Android push (FCM) config | Re-download from Firebase console → Project settings → Android app |
| `secrets/credentials/sharewallet-release.keystore` | `credentials/sharewallet-release.keystore` | **The key that signs the Android app** | **Cannot be replaced.** Without it, new APKs will not install over the app on anyone's phone — every friend would have to uninstall first |
| `secrets/credentials/keystore-password.txt` | `credentials/keystore-password.txt` | Password for the keystore | Same as above |
| `secrets/credentials/fcm-service-account.json` | `credentials/fcm-service-account.json` | Admin key for Firebase (used by `scripts/push-test.mjs`) | Create a new key: Firebase console → Project settings → Service accounts |

Keep the kit on a USB stick or a **private** cloud folder. Never put any of it
in the repository, a public link, or a chat group.

---

## 1. Install the tools

Versions are what the project is built and tested with.

| Tool | Version | Why |
|---|---|---|
| **Git** | any recent | get the code |
| **Node.js** | **20 LTS** | runs Expo, the build, the tests |
| **JDK** | **17** | builds the Android app |
| **JDK** | **21 or newer** *(optional)* | only for `npm run test:rules` — the Firebase emulator needs it |
| **Android Studio** | latest | Android SDK, build tools, NDK |
| **Firebase CLI** | latest | publish rules and the invite-link site, run rule tests |

### Windows

1. **Git**: <https://git-scm.com/download/win> — keep the default options.
   This also gives you **Git Bash**; use it for the commands below (the test
   script is a shell script).
2. **Node 20**: install **nvm-windows** (<https://github.com/coreybutler/nvm-windows/releases>),
   then in a new terminal: `nvm install 20` and `nvm use 20`.
3. **JDK 17**: Eclipse Temurin 17 from <https://adoptium.net> — tick
   *Set JAVA_HOME* during install.
4. **Android Studio**: <https://developer.android.com/studio>. Then do
   [the SDK step](#android-sdk-both-systems) below.
5. Environment variables (Start → "Edit the system environment variables" →
   Environment Variables → *User variables*):
   - `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
   - add `%ANDROID_HOME%\platform-tools` to `Path`
6. **Firebase CLI**: `npm install -g firebase-tools`

### macOS

```bash
# Homebrew (skip if `brew -v` works), then:
brew install git openjdk@17 watchman
brew install --cask android-studio

# Node 20
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# reopen Terminal
nvm install 20 && nvm alias default 20

npm install -g firebase-tools
```

Add to `~/.zshrc`, then reopen Terminal:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

### Android SDK (both systems)

Open Android Studio → **More Actions → SDK Manager**:

- **SDK Platforms**: Android **16 (API 36)**.
- **SDK Tools** (tick *Show Package Details*): **Android SDK Build-Tools 36**,
  **NDK (Side by side) 27.1.12297006**, **CMake 3.22.1**,
  **Android SDK Platform-Tools**.

Gradle downloads anything else it needs on the first build.

### Check

```bash
git --version
node -v          # v20.x
java -version    # 17.x
adb version
firebase --version
```

---

## 2. Get the project

```bash
git clone https://github.com/Rameshshankar5/sharewallet.git
cd sharewallet
npm ci
```

Copy the private files in (from the kit's `secrets/` folder) so the project
looks like this:

```
sharewallet/
├── .env
├── google-services.json
├── credentials/
│   ├── sharewallet-release.keystore
│   ├── keystore-password.txt
│   └── fcm-service-account.json
├── app.json
└── …
```

On macOS/Linux, protect them:

```bash
chmod 600 .env credentials/*
```

Check the clone is healthy:

```bash
npx tsc --noEmit     # no output = good
npm test             # money maths and calculator: all pass
```

---

## 3. Build the Android app (APK)

```bash
# 1. Raise the version FIRST — prebuild copies it into the Android project.
#    In app.json: "version" (e.g. 1.11.0) and android.versionCode (+1, e.g. 18).

# 2. Generate the Android project from app.json (android/ is not in git)
npx expo prebuild --platform android --clean

# 3. Build
cd android
./gradlew assembleRelease          # Windows (cmd/PowerShell): gradlew.bat assembleRelease
cd ..
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk`
(about 68 MB). The first build takes 10–20 minutes; later ones a few minutes.

**Check it is signed with the real key**, not the debug one — otherwise it
will not install over the existing app on anyone's phone:

```bash
# apksigner comes with the Android SDK build tools (Windows: apksigner.bat)
"$ANDROID_HOME"/build-tools/36.0.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk | grep SHA-256
# Signer #1 certificate SHA-256 digest: 3b4fe97f838863bb…   ← must start like this
```

(`keytool -printcert -jarfile` prints nothing for these APKs — they use the
newer signature format it cannot read.)

If it shows a different fingerprint, `credentials/` is missing or in the
wrong place.

### Put it on a phone

- **Cable**: enable *Developer options → USB debugging* on the phone, then
  `adb install -r android/app/build/outputs/apk/release/app-release.apk`
- **Friends**: send them the APK file (WhatsApp as a document, Google Drive).
  They allow *Install unknown apps* once.

### Run while developing

```bash
npx expo run:android      # debug build on a connected phone, reloads as you edit
```

---

## 4. Firebase: rules and the invite-link site

```bash
firebase login                                  # the Google account that owns the project
npm run test:rules                              # 13 security tests (needs JDK 21+)
firebase deploy --only firestore:rules,firestore:indexes,hosting --project sharewallet-963b7
```

- **Always run `npm run test:rules` before deploying rules.** The rules are
  the app's only backend; a mistake exposes people's data.
- `hosting` publishes `hosting/` to <https://sharewallet-963b7.web.app>, which
  serves invite links and the Android App Links file. That file contains the
  release key's SHA-256, so it only changes if the keystore changes.
- The project id is passed explicitly because `.firebaserc` is not committed.

If `test:rules` complains about Java, point it at a JDK 21+ just for that
command, e.g. on macOS:
`PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules`.

---

## 5. Useful tools

```bash
node scripts/push-test.mjs                 # list users and their push tokens
node scripts/push-test.mjs send <email>    # send yourself a test notification
```

Uses `credentials/fcm-service-account.json`, which bypasses the security
rules — keep it to your own computer.

---

## 6. Troubleshooting

**`npm test` fails on Windows with "sh is not recognized"**
: Run it from **Git Bash**, not cmd or PowerShell.

**Build fails with a missing `.so` file, "immutable workspace … modified", or
Android resource linking errors inside `.gradle/caches`**
: Gradle's cache was damaged (a full disk or a cleanup tool). Fix:
  ```bash
  cd android && ./gradlew --stop && cd ..
  # delete the transforms cache — it is rebuilt automatically:
  #   macOS/Linux: ~/.gradle/caches/<version>/transforms
  #   Windows:     C:\Users\<you>\.gradle\caches\<version>\transforms
  find node_modules -type d -path "*/android/.cxx" -prune -exec rm -rf {} +
  cd android && ./gradlew clean && ./gradlew assembleRelease
  ```

**`SDK location not found`**
: `ANDROID_HOME` is not set. Or create `android/local.properties` with
  `sdk.dir=/path/to/Android/sdk` (Windows: `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`).

**The app says "Firebase isn't connected yet"**
: `.env` is missing or not in the project root. Rebuild after adding it.

**The APK will not install over the old one ("App not installed")**
: It was signed with a different key — see the SHA256 check in step 3.

**Windows: build fails on a very long path**
: Clone into a short folder such as `C:\dev\sharewallet`.

---

## 7. iPhone

See **[IOS_GUIDE.md](IOS_GUIDE.md)** — it needs a Mac with Xcode and the
friend's Apple Developer account.
