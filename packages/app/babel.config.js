/**
 * Babel config — v2-from-scratch (Phase 15 simplified).
 *
 * Previous attempt added "react-native-reanimated": false to disable
 * the legacy plugin path; that key isn't a real babel-preset-expo
 * option and silently broke the preset (caused metro's
 * `Cannot read properties of undefined (reading 'transformFile')`
 * during export:embed).
 *
 * unstable_transformImportMeta: required by Zustand 5 (uses
 * import.meta.env).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
