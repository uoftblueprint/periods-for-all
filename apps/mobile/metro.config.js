const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Allow Metro to bundle expo-sqlite's WASM file.
config.resolver.assetExts.push('wasm');

module.exports = config;
