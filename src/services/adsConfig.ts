export type AdPlacement = 'home' | 'bookDetail' | 'chapterEnd';
export type AdProvider = 'adsense' | 'domestic';

export interface AdsConfig {
  enabled: boolean;
  provider: AdProvider | null;
  cmpRequired: boolean;
  clientId: string;
  scriptUrl: string;
  allowedHosts: string[];
  blockedRoutes: string[];
  slots: Record<AdPlacement, string>;
}

type Env = Record<string, string | boolean | undefined>;

const slotKeys: Record<AdPlacement, string> = {
  home: 'VITE_AD_SLOT_HOME',
  bookDetail: 'VITE_AD_SLOT_BOOK_DETAIL',
  chapterEnd: 'VITE_AD_SLOT_CHAPTER_END',
};
const domesticSlotKeys: Record<AdPlacement, string> = {
  home: 'VITE_DOMESTIC_AD_SLOT_HOME',
  bookDetail: 'VITE_DOMESTIC_AD_SLOT_BOOK_DETAIL',
  chapterEnd: 'VITE_DOMESTIC_AD_SLOT_CHAPTER_END',
};

function split(value: string | boolean | undefined) {
  return typeof value === 'string' ? value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean) : [];
}

export function readAdsConfig(env: Env = import.meta.env): AdsConfig {
  const providerText = typeof env.VITE_AD_PROVIDER === 'string' ? env.VITE_AD_PROVIDER.toLowerCase() : '';
  const provider = providerText === 'adsense' || providerText === 'domestic' ? providerText : null;
  const allowedHosts = split(env.VITE_AD_ALLOWED_HOSTS);
  const slots: Record<AdPlacement, string> = {
    home: String(env[(provider === 'domestic' ? domesticSlotKeys : slotKeys).home] || ''),
    bookDetail: String(env[(provider === 'domestic' ? domesticSlotKeys : slotKeys).bookDetail] || ''),
    chapterEnd: String(env[(provider === 'domestic' ? domesticSlotKeys : slotKeys).chapterEnd] || ''),
  };
  const clientId = String(env.VITE_ADSENSE_CLIENT || '');
  const scriptUrl = String(env.VITE_DOMESTIC_AD_SCRIPT_URL || '');
  const cmpText = String(env.VITE_CMP_REQUIRED ?? 'true').toLowerCase();

  const blockedRoutes = typeof env.VITE_AD_BLOCKED_ROUTES === 'string' && env.VITE_AD_BLOCKED_ROUTES.trim()
    ? split(env.VITE_AD_BLOCKED_ROUTES)
    : ['/shelf', '/privacy', '/terms', '/contact'];

  return {
    enabled: String(env.VITE_ADS_ENABLED || '').toLowerCase() === 'true',
    provider,
    cmpRequired: cmpText !== 'false',
    clientId,
    scriptUrl,
    allowedHosts,
    blockedRoutes,
    slots,
  };
}

export function configuredPlacement(config: AdsConfig, placement: AdPlacement) {
  if (!config.enabled || !config.provider || !config.slots[placement]) return false;
  if (config.provider === 'adsense') return /^ca-pub-\d{16}$/.test(config.clientId);
  if (!/^https:\/\//i.test(config.scriptUrl)) return false;
  try {
    const host = new URL(config.scriptUrl).hostname.toLowerCase();
    return config.allowedHosts.includes(host);
  } catch { return false; }
}

export function routeBlocksAds(pathname: string, patterns: string[]) {
  return patterns.some((pattern) => pattern === '*' || pathname === pattern || pathname.startsWith(`${pattern.replace(/\/$/, '')}/`));
}

export function isAdRequestAllowed(config: AdsConfig, placement: AdPlacement, pathname: string, consent: boolean, cmpConsent: boolean) {
  return configuredPlacement(config, placement) && !routeBlocksAds(pathname, config.blockedRoutes) && consent && (!config.cmpRequired || cmpConsent);
}
