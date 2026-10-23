import { describe, expect, it } from 'vitest';
import { isAdRequestAllowed, readAdsConfig, routeBlocksAds } from '../src/services/adsConfig';

describe('advertising gates', () => {
  it('keeps third-party ads disabled when no real configuration is provided', () => {
    const config = readAdsConfig({});
    expect(config.enabled).toBe(false);
    expect(isAdRequestAllowed(config, 'home', '/', true, true)).toBe(false);
  });

  it('requires a real slot, ad preference, route allowance, and CMP consent by default', () => {
    const config = readAdsConfig({
      VITE_ADS_ENABLED: 'true',
      VITE_AD_PROVIDER: 'adsense',
      VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
      VITE_AD_SLOT_HOME: '1234567890',
    });
    expect(isAdRequestAllowed(config, 'home', '/', false, true)).toBe(false);
    expect(isAdRequestAllowed(config, 'home', '/', true, false)).toBe(false);
    expect(isAdRequestAllowed(config, 'home', '/', true, true)).toBe(true);
    expect(isAdRequestAllowed(config, 'home', '/privacy', true, true)).toBe(false);
  });

  it('supports route-prefix blocks', () => {
    expect(routeBlocksAds('/reader/book-1', ['/reader'])).toBe(true);
    expect(routeBlocksAds('/reader', ['/reader'])).toBe(true);
    expect(routeBlocksAds('/readerly', ['/reader'])).toBe(false);
  });
});
