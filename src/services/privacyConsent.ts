const storageKey = 'classic-reader-privacy-preferences-v1';

export interface PrivacyPreferences {
  optionalAds: boolean;
  updatedAt: number;
}

export function readPrivacyPreferences(): PrivacyPreferences | null {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<PrivacyPreferences>;
    if (typeof value.optionalAds !== 'boolean') return null;
    return { optionalAds: value.optionalAds, updatedAt: Number(value.updatedAt) || 0 };
  } catch { return null; }
}

export function savePrivacyPreferences(optionalAds: boolean): PrivacyPreferences {
  const preferences = { optionalAds, updatedAt: Date.now() };
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* UI still reflects the current choice if storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent('reader-privacy-preferences-changed'));
  return preferences;
}

export function hasOptionalAdsPreference() {
  return readPrivacyPreferences()?.optionalAds === true;
}

export function hasRequiredCmpAdsConsent(cmpRequired: boolean) {
  if (!cmpRequired) return true;
  try { return window.readerPrivacyCmp?.hasRequiredAdsConsent() === true; }
  catch { return false; }
}
