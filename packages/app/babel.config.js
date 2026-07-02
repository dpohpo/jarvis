/**
 * Babel config — v2-from-scratch.
 *
 * react-native-reanimated 4.x ships its own compiler pass via metro
 * (no app-side babel plugin needed). The babel-preset-expo auto-includes
 * the legacy reanimated/plugin, which crashes on reanimated 4 sources
 * ("Cannot read properties of undefined (reading 'length')"). We
 * explicitly drop the plugin from the inherit list to avoid the crash.
 *
 * unstable_transformImportMeta: required by Zustand 5 (uses import.meta.env).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          "react-native-reanimated": false, // disable legacy plugin path
        },
      ],
    ],
  };
};
