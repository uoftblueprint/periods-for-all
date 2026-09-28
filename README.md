# Periods for All

Expo app for iPhone and iPad. TypeScript, React Native, SDK 57.

## Structure

- `apps/mobile` is the Expo app. Routes live in `src/app`.
- The root `package.json` is an npm workspace for `apps/*`.

## iPad

`apps/mobile/app.json` sets `ios.supportsTablet` and allows rotation, so iPad runs the app at full size instead of a scaled iPhone layout.

## Run

Use Node 22 (`nvm use 22`).

```bash
cd apps/mobile
npm run ios
```

In the Expo terminal, press `i` and choose an iPad simulator. Check both an iPad Pro 13-inch and an iPad mini.
