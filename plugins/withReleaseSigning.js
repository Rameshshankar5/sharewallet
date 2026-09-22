const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Teaches the generated Android project to sign release builds with our own
 * key instead of the debug one.
 *
 * This exists because `expo prebuild` regenerates android/ from scratch, and
 * that folder is gitignored. Every hand edit made there — the signing config
 * most of all — is one prebuild away from vanishing, and losing the release
 * key's wiring means the next APK is signed with the debug key and refuses to
 * install over anybody's existing app.
 *
 * The keystore itself lives in credentials/ at the project root, outside
 * android/, so a prebuild cannot destroy it. The password is read from a
 * chmod-600 file at build time rather than written into any build config.
 */
const RELEASE_SIGNING_CONFIG = `        release {
            def keystore = rootProject.file('../credentials/sharewallet-release.keystore')
            def passwordFile = rootProject.file('../credentials/keystore-password.txt')
            if (keystore.exists() && passwordFile.exists()) {
                def password = passwordFile.getText('UTF-8').trim()
                storeFile keystore
                storePassword password
                keyAlias 'sharewallet'
                keyPassword password
            }
        }
`;

const RELEASE_SIGNING_REF = `            // Signed with the real release key when credentials/ is present;
            // falls back to the debug key so a fresh clone can still build.
            signingConfig rootProject.file('../credentials/sharewallet-release.keystore').exists()
                ? signingConfigs.release
                : signingConfigs.debug`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // 1. Declare the release signing config, right after the debug one.
    if (!contents.includes('sharewallet-release.keystore')) {
      const debugBlockEnd = /(signingConfigs \{[\s\S]*?keyPassword 'android'\n\s*\}\n)/;
      if (!debugBlockEnd.test(contents)) {
        throw new Error(
          'withReleaseSigning: could not find the debug signingConfig block. '
          + 'The Expo template changed — update this plugin rather than editing '
          + 'android/app/build.gradle by hand, which prebuild would discard.',
        );
      }
      contents = contents.replace(debugBlockEnd, `$1${RELEASE_SIGNING_CONFIG}`);
    }

    // 2. Point the release build type at it. The debug build type contains the
    //    same line, so anchor on the release block specifically.
    const releaseUsesDebugKey =
      /(buildTypes \{[\s\S]*?release \{\n)(\s*\/\/[^\n]*\n)*(\s*signingConfig signingConfigs\.debug)/;
    if (releaseUsesDebugKey.test(contents)) {
      contents = contents.replace(releaseUsesDebugKey, `$1${RELEASE_SIGNING_REF}`);
    } else if (!contents.includes('signingConfigs.release')) {
      throw new Error(
        'withReleaseSigning: the release build type no longer points at '
        + 'signingConfigs.debug, and nothing points at signingConfigs.release. '
        + 'Check android/app/build.gradle before shipping an APK.',
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
