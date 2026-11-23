const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadProtection(platform, nativeModule) {
  const filename = path.join(__dirname, '../src/features/quizzes/protection.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react-native') return { Platform: platform };
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => nativeModule };
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports.protectTest;
}

test('browser and older Android cannot start an unprotected test', async () => {
  await assert.rejects(loadProtection({ OS: 'web' }, null)(() => {}), /Android.*iOS/);
  await assert.rejects(loadProtection({ OS: 'android', Version: 33 }, null)(() => {}), /Android 14/);
});

test('missing native protection rejects before questions are exposed', async () => {
  await assert.rejects(loadProtection({ OS: 'android', Version: 34 }, null)(() => {}), /модулу жок/);
});

test('capture is blocked, observed screenshot is reported, protection is released', async () => {
  const calls = [];
  let listener;
  const native = {
    preventScreenCapture: async () => calls.push('block'),
    allowScreenCapture: async () => calls.push('allow'),
    addListener(event, callback) { assert.equal(event, 'onScreenshot'); listener = callback; calls.push('listen'); return { remove: () => calls.push('remove') }; },
  };
  let screenshots = 0;
  const cleanup = await loadProtection({ OS: 'android', Version: 34 }, native)(() => screenshots++);
  assert.deepEqual(calls, ['block', 'listen']);
  listener();
  assert.equal(screenshots, 1);
  cleanup();
  assert.deepEqual(calls, ['block', 'listen', 'remove', 'allow']);
});

test('iOS app switcher protection is enabled and released', async () => {
  const calls = [];
  const native = {
    preventScreenCapture: async () => calls.push('block'), allowScreenCapture: async () => calls.push('allow'),
    enableAppSwitcherProtection: async intensity => { assert.equal(intensity, 1); calls.push('hide'); },
    disableAppSwitcherProtection: async () => calls.push('unhide'),
    addListener: () => ({ remove: () => {} }),
  };
  const cleanup = await loadProtection({ OS: 'ios', Version: '18.0' }, native)(() => {});
  assert.deepEqual(calls, ['block', 'hide']);
  cleanup();
  assert.deepEqual(calls, ['block', 'hide', 'allow', 'unhide']);
});

test('native protection failure rejects and cleans up', async () => {
  let released = false;
  const native = {
    preventScreenCapture: async () => { throw new Error('OS refused protection'); },
    allowScreenCapture: async () => { released = true; }, addListener: () => { throw new Error('Should not listen'); },
  };
  await assert.rejects(loadProtection({ OS: 'android', Version: 34 }, native)(() => {}), /OS refused/);
  assert.equal(released, true);
});
