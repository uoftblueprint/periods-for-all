// Lets Node's test runner import app modules: resolves the `@/` alias and stubs
// the CSS and react-native imports that only the Expo bundler can load.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
