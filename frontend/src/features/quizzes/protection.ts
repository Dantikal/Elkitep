import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type CaptureModule = {
  preventScreenCapture: () => Promise<void>;
  allowScreenCapture: () => Promise<void>;
  addListener: (event: string, listener: () => void) => { remove: () => void };
  enableAppSwitcherProtection?: (intensity: number) => Promise<void>;
  disableAppSwitcherProtection?: () => Promise<void>;
};

// Use the native API so Expo Go can also supply the module. Custom builds must
// install expo-screen-capture; never start a test without capture protection.
export async function protectTest(onScreenshot: () => void): Promise<() => void> {
  if (Platform.OS === 'web') throw new Error('Корголгон тестти Android же iOS тиркемесинен өтүңүз.');
  if (Platform.OS === 'android' && Number(Platform.Version) < 34) {
    throw new Error('Скриншотту аныктоо үчүн Android 14 же андан жаңы версия керек.');
  }
  if (Platform.OS === 'ios' && Number.parseFloat(String(Platform.Version)) < 13) {
    throw new Error('Экранды коргоо үчүн iOS 13 же андан жаңы версия керек.');
  }
  const capture = requireOptionalNativeModule<CaptureModule>('ExpoScreenCapture');
  if (!capture?.preventScreenCapture || !capture.allowScreenCapture || !capture.addListener) {
    throw new Error('Экранды коргоо модулу жок. Тиркеменин корголгон жаңы сборкасын орнотуңуз.');
  }
  let subscription: { remove: () => void } | undefined;
  const release = () => {
    subscription?.remove();
    void capture.allowScreenCapture().catch(() => {});
    if (capture.disableAppSwitcherProtection) void capture.disableAppSwitcherProtection().catch(() => {});
  };
  try {
    await capture.preventScreenCapture();
    if (capture.enableAppSwitcherProtection) await capture.enableAppSwitcherProtection(1);
    subscription = capture.addListener('onScreenshot', onScreenshot);
    return release;
  } catch (error) { release(); throw error; }
}
