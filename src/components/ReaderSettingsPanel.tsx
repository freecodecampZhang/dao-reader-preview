import { Minus, Plus, Type } from 'lucide-react';
import type { ReaderSettings, ThemeName } from '../types';
import styles from './ReaderSettingsPanel.module.css';

interface ReaderSettingsPanelProps {
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
}

const THEMES: Array<{ id: ThemeName; label: string; color: string }> = [
  { id: 'paper', label: '日间纸张', color: '#ede7d6' },
  { id: 'light', label: '浅色', color: '#fafaf7' },
  { id: 'night', label: '夜间', color: '#23221f' },
];

export function ThemePanel({ settings, onChange }: ReaderSettingsPanelProps) {
  return <section className={styles.panel} aria-label="阅读主题">
    <div className={styles.panelTitle}><span>阅读主题</span><small>只调整阅读器显示</small></div>
    <div className={styles.themeOptions}>
      {THEMES.map((theme) => <button key={theme.id} className={`${styles.themeOption} ${settings.theme === theme.id ? styles.selected : ''}`} onClick={() => onChange({ ...settings, theme: theme.id })} aria-pressed={settings.theme === theme.id}>
        <i style={{ background: theme.color }} /><span>{theme.label}</span>
      </button>)}
    </div>
  </section>;
}

export function TypographyPanel({ settings, onChange }: ReaderSettingsPanelProps) {
  const update = (patch: Partial<ReaderSettings>) => onChange({ ...settings, ...patch });
  return <section className={styles.panel} aria-label="字体与排版设置">
    <div className={styles.panelTitle}><span>字体排版</span><small>设置会自动保存</small></div>
    <div className={styles.settingRow}>
      <label htmlFor="font-size-control">字号</label>
      <div className={styles.stepper}><button onClick={() => update({ fontSize: Math.max(14, settings.fontSize - 2) })} aria-label="缩小字号"><Minus size={16} /></button><output>{settings.fontSize}px</output><button onClick={() => update({ fontSize: Math.min(32, settings.fontSize + 2) })} aria-label="放大字号"><Plus size={16} /></button></div>
      <input id="font-size-control" className={styles.range} type="range" min="14" max="32" step="2" value={settings.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} aria-label="字号" />
    </div>
    <div className={styles.settingRow}>
      <label htmlFor="line-height-control">行间距</label>
      <select id="line-height-control" value={settings.lineHeight} onChange={(event) => update({ lineHeight: Number(event.target.value) })}><option value="1.6">紧凑</option><option value="1.9">舒适</option><option value="2.2">宽松</option></select>
    </div>
    <div className={styles.settingRow}>
      <span>字体</span>
      <div className={styles.choiceGroup}><button className={settings.fontFamily === 'serif' ? styles.choiceActive : ''} onClick={() => update({ fontFamily: 'serif' })}><Type size={14} />衬线</button><button className={settings.fontFamily === 'sans' ? styles.choiceActive : ''} onClick={() => update({ fontFamily: 'sans' })}>无衬线</button></div>
    </div>
    <div className={styles.settingRow}>
      <label htmlFor="margin-control">两侧留白</label><input id="margin-control" className={styles.range} type="range" min="3" max="16" step="1" value={settings.pageMargin} onChange={(event) => update({ pageMargin: Number(event.target.value) })} aria-label="正文两侧留白" /><output>{settings.pageMargin}%</output>
    </div>
  </section>;
}
