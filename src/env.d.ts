/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_SITE_URL?: string;
  readonly VITE_INDEXING_ENABLED?: string;
  readonly VITE_ADS_ENABLED?: string;
  readonly VITE_AD_PROVIDER?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_AD_SLOT_HOME?: string;
  readonly VITE_AD_SLOT_BOOK_DETAIL?: string;
  readonly VITE_AD_SLOT_CHAPTER_END?: string;
  readonly VITE_DOMESTIC_AD_SCRIPT_URL?: string;
  readonly VITE_AD_ALLOWED_HOSTS?: string;
  readonly VITE_DOMESTIC_AD_SLOT_HOME?: string;
  readonly VITE_DOMESTIC_AD_SLOT_BOOK_DETAIL?: string;
  readonly VITE_DOMESTIC_AD_SLOT_CHAPTER_END?: string;
  readonly VITE_AD_BLOCKED_ROUTES?: string;
  readonly VITE_CMP_REQUIRED?: string;
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta { readonly env: ImportMetaEnv }

interface Window {
  readerPrivacyCmp?: { hasRequiredAdsConsent: () => boolean };
  readerDomesticAdAdapter?: {
    mount: (input: { slotId: string; placement: string; container: HTMLElement }) => void | (() => void);
  };
  adsbygoogle?: Array<Record<string, unknown>>;
}
