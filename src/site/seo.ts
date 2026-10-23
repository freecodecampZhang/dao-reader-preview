export function isIndexingConfigured() {
  try {
    return import.meta.env.VITE_INDEXING_ENABLED === 'true'
      && new URL(import.meta.env.VITE_SITE_URL || '').protocol === 'https:';
  } catch { return false; }
}

export function publicCanonical(path: string) {
  if (!isIndexingConfigured()) return '';
  const normalized = path === '/' || path.endsWith('/') ? path : `${path}/`;
  return new URL(normalized, import.meta.env.VITE_SITE_URL).toString();
}

export function applySeo(title: string, description: string, path: string, indexable = true) {
  document.title = title;
  const setMeta = (name: string, content: string) => {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!tag) { tag = document.createElement('meta'); tag.name = name; document.head.append(tag); }
    tag.content = content;
  };
  const setProperty = (property: string, content: string) => {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute('property', property); document.head.append(tag); }
    tag.content = content;
  };
  setMeta('description', description);
  setMeta('robots', indexable && isIndexingConfigured() ? 'index,follow' : 'noindex,nofollow');
  setProperty('og:title', title);
  setProperty('og:description', description);
  const canonicalUrl = publicCanonical(path);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  if (canonicalUrl) canonical.href = canonicalUrl;
  else canonical.removeAttribute('href');
}
