import { useEffect, useState } from 'react';
import { BookOpenText, ChevronRight, Library, Settings2 } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { readPrivacyPreferences, savePrivacyPreferences } from '../services/privacyConsent';
import { applySeo } from './seo';
import styles from './SiteLayout.module.css';

export function SeoMeta({ title, description, path, indexable = true }: { title: string; description: string; path: string; indexable?: boolean }) {
  useEffect(() => { applySeo(title, description, path, indexable); }, [title, description, path, indexable]);
  return null;
}

export default function SiteLayout() {
  const [needsChoice, setNeedsChoice] = useState(() => readPrivacyPreferences() === null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setNeedsChoice(readPrivacyPreferences() === null);
    window.addEventListener('reader-privacy-preferences-changed', refresh);
    return () => window.removeEventListener('reader-privacy-preferences-changed', refresh);
  }, []);

  const chooseAds = (allow: boolean) => {
    savePrivacyPreferences(allow);
    setNeedsChoice(false);
    setPrivacyOpen(false);
  };

  return <div className={styles.site}>
    <a className={styles.skipLink} href="#main-content">跳到主要内容</a>
    <header className={styles.header}>
      <Link className={styles.brand} to="/" aria-label="古籍阅读首页"><span className={styles.brandIcon}><BookOpenText size={20} /></span><span>古籍阅读<small>本地优先 · 安心阅读</small></span></Link>
      <nav className={styles.nav} aria-label="主导航">
        <NavLink to="/category">公共书库</NavLink>
        <NavLink to="/guide">阅读指南</NavLink>
        <NavLink to="/about">关于</NavLink>
      </nav>
      <Link className={styles.shelfButton} to="/shelf"><Library size={17} />我的书架</Link>
    </header>

    {needsChoice && <aside className={styles.consentBanner} aria-label="隐私偏好提示">
      <p><strong>隐私偏好</strong><span>本站本地阅读不依赖广告。可选广告默认关闭。</span></p>
      <div><button onClick={() => chooseAds(false)}>仅必要功能</button><button onClick={() => chooseAds(true)}>允许可选广告</button><Link to="/privacy">了解隐私</Link></div>
    </aside>}

    {privacyOpen && <aside className={styles.privacyPanel} aria-label="本站隐私偏好设置">
      <div><strong><Settings2 size={17} />本站隐私偏好</strong><p>此面板只记录此设备上的广告偏好，不是认证 CMP，也不替代适用地区的 CMP。</p></div>
      <div><button onClick={() => chooseAds(false)}>关闭可选广告</button><button onClick={() => chooseAds(true)}>允许可选广告</button><button className={styles.closePrivacy} onClick={() => setPrivacyOpen(false)}>关闭</button></div>
    </aside>}

    <div id="main-content"><Outlet /></div>
    <footer className={styles.footer}>
      <div className={styles.footerBrand}><BookOpenText size={19} /><span>古籍阅读<small>把喜欢的文字，留在自己的设备上。</small></span></div>
      <nav aria-label="页脚导航"><Link to="/guide">阅读指南</Link><Link to="/about">关于我们</Link><Link to="/contact">联系我们</Link><Link to="/privacy">隐私政策</Link><Link to="/terms">服务条款</Link></nav>
      <button className={styles.privacyLink} onClick={() => setPrivacyOpen(true)}>隐私偏好 <ChevronRight size={15} /></button>
      <small className={styles.footerNote}>本地导入内容仅保存在你的浏览器中。公共书库只展示经审核的内容。</small>
    </footer>
  </div>;
}
