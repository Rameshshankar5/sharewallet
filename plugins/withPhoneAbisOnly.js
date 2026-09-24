const { withGradleProperties } = require('expo/config-plugins');

/**
 * Build native code for real phones only.
 *
 * The Expo template compiles every native library four times: two ARM
 * flavours that phones use, and two x86 ones that only emulators use. Those
 * x86 copies roughly doubled the APK — 51 MB to 117 MB — for devices nobody
 * installs this on. arm64-v8a covers every phone from the last decade;
 * armeabi-v7a is kept for the older, cheaper 32-bit ones.
 *
 * A plugin rather than an edit to android/gradle.properties, because
 * `expo prebuild` regenerates that file and would quietly put them back.
 */
const ABIS = 'armeabi-v7a,arm64-v8a';

module.exports = function withPhoneAbisOnly(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter(
      (p) => !(p.type === 'property' && p.key === 'reactNativeArchitectures'),
    );
    props.push({ type: 'property', key: 'reactNativeArchitectures', value: ABIS });
    cfg.modResults = props;
    return cfg;
  });
};
