import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.champcalc.app',
  appName: 'ダメージ計算のみがわり',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
};

export default config;
