import type { ReaderSettings } from '../types';

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'paper',
  fontSize: 20,
  lineHeight: 1.9,
  fontFamily: 'serif',
  pageMargin: 8,
};

const SETTINGS_KEY = 'classic-txt-reader-settings';

export function readReaderSettings(): ReaderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') as Partial<ReaderSettings> | null;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeReaderSettings(settings: ReaderSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private browsing may disable storage */ }
}
