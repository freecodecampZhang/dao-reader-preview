import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { hasOptionalAdsPreference, hasRequiredCmpAdsConsent } from '../services/privacyConsent';
import { isAdRequestAllowed, readAdsConfig, type AdPlacement, type AdsConfig } from '../services/adsConfig';
import styles from './AdSlot.module.css';

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(config: AdsConfig) {
  const url = config.provider === 'adsense'
    ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.clientId)}`
    : config.scriptUrl;
  const existing = loadedScripts.get(url);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const current = [...document.querySelectorAll<HTMLScriptElement>('script[data-reader-ad-src]')].find((item) => item.dataset.readerAdSrc === url);
    if (current?.dataset.loaded === 'true') { resolve(); return; }
    const script = current || document.createElement('script');
    if (!current) {
      script.src = url;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.readerAdSrc = url;
      script.dataset.readerAdProvider = config.provider || '';
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => { loadedScripts.delete(url); reject(new Error('广告脚本加载失败')); };
      document.head.append(script);
    } else {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('广告脚本加载失败')), { once: true });
    }
  });
  loadedScripts.set(url, promise);
  return promise;
}

export default function AdSlot({ placement }: { placement: AdPlacement }) {
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setConsentRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const config = useMemo(() => readAdsConfig(), []);
  const consent = hasOptionalAdsPreference();
  const cmpConsent = hasRequiredCmpAdsConsent(config.cmpRequired);
  const allowed = isAdRequestAllowed(config, placement, pathname, consent, cmpConsent);

  useEffect(() => {
    const update = () => setConsentRevision((revision) => revision + 1);
    window.addEventListener('reader-privacy-preferences-changed', update);
    window.addEventListener('reader-cmp-consent-changed', update);
    return () => {
      window.removeEventListener('reader-privacy-preferences-changed', update);
      window.removeEventListener('reader-cmp-consent-changed', update);
    };
  }, []);

  useEffect(() => {
    setFailed(false);
    if (import.meta.env.DEV || !allowed || !containerRef.current) return undefined;
    let active = true;
    let unmount: void | (() => void);
    void loadScript(config).then(() => {
      if (!active || !containerRef.current) return;
      if (config.provider === 'adsense') {
        const slot = document.createElement('ins');
        slot.className = `adsbygoogle ${styles.adSense}`;
        slot.setAttribute('data-ad-client', config.clientId);
        slot.setAttribute('data-ad-slot', config.slots[placement]);
        slot.setAttribute('data-ad-format', 'auto');
        slot.setAttribute('data-full-width-responsive', 'true');
        containerRef.current.append(slot);
        try { (window.adsbygoogle ||= []).push({}); }
        catch { setFailed(true); }
      } else if (config.provider === 'domestic' && window.readerDomesticAdAdapter) {
        unmount = window.readerDomesticAdAdapter.mount({ slotId: config.slots[placement], placement, container: containerRef.current });
      } else {
        setFailed(true);
      }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; unmount?.(); if (containerRef.current) containerRef.current.replaceChildren(); };
  }, [allowed, config, placement]);

  if (config.blockedRoutes.some((route) => route === '*' || pathname === route || pathname.startsWith(`${route.replace(/\/$/, '')}/`))) return null;
  if (import.meta.env.DEV) return <aside className={styles.preview} aria-label="广告位开发预览"><span>广告</span><p>{placement === 'chapterEnd' ? '章节结束广告位 · 开发占位，不加载第三方脚本' : '广告位 · 开发占位，不加载第三方脚本'}</p></aside>;
  if (!allowed) return null;

  return <aside className={styles.slot} aria-label="广告">
    <span className={styles.label}>广告</span>
    {failed && <p className={styles.failure}>广告暂时无法显示。</p>}
    <div ref={containerRef} className={styles.mountPoint} />
  </aside>;
}
