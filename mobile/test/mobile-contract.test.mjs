import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const screen = read('mobile/app/index.tsx');
const law = read('src/domain/law.ts');
const appConfig = JSON.parse(read('mobile/app.json'));

test('native client runs the canonical law guard instead of wrapping the web app', () => {
  assert.match(screen, /evaluateVerifiedLaw/);
  assert.match(screen, /from '\.\.\/\.\.\/src\/domain\/law'/);
  assert.match(screen, /expo-haptics/);
  assert.match(screen, /\bShare\.share\(/);
  assert.doesNotMatch(screen, /WebView|react-native-webview|https?:\/\//i);
});

test('VERIFIED LAW remains fail-closed in the shared domain engine', () => {
  assert.match(law, /if \(!ctx\.jurisdictionId\) blockers\.push/);
  assert.match(law, /No qualifying primary-law source is attached/);
  assert.match(law, /No citation or official identifier recorded/);
  assert.match(law, /Official \/ authentic status of the primary source is not known/);
  assert.match(law, /Currentness \/ as-of status has not been checked/);
});

test('store identity is explicit without committed provider credentials', () => {
  assert.equal(appConfig.expo.ios.bundleIdentifier, 'com.jussray.truthweaver');
  assert.equal(appConfig.expo.android.package, 'com.jussray.truthweaver');
  assert.equal(appConfig.expo.updates.enabled, false);
  assert.doesNotMatch(JSON.stringify(appConfig), /appleId|ascAppId|appleTeamId|serviceAccountKey|api[_-]?key|secret/i);
});
