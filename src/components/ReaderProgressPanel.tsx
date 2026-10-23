import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Chapter } from '../types';
import styles from './ReaderProgressPanel.module.css';

interface ReaderProgressPanelProps {
  chapters: Chapter[];
  chapterIndex: number;
  chapterProgress: number;
  overallProgress: number;
  onJump: (chapterIndex: number) => void;
}

export default function ReaderProgressPanel({ chapters, chapterIndex, chapterProgress, overallProgress, onJump }: ReaderProgressPanelProps) {
  const chapter = chapters[chapterIndex];
  return <section className={styles.panel} aria-label="阅读进度">
    <div className={styles.panelTitle}><span>阅读进度</span><strong>{overallProgress}%</strong></div>
    <div className={styles.overallTrack}><span style={{ width: `${overallProgress}%` }} /></div>
    <p className={styles.chapterName}>{chapter?.title || '正文'}</p>
    <div className={styles.chapterTrack}><span style={{ width: `${chapterProgress}%` }} /></div>
    <p className={styles.chapterInfo}>本章 {chapterProgress}% · 全书 {overallProgress}%</p>
    <p className={styles.pageHint}>导入 TXT 的目录页码按每 800 字估算，用于快速定位。</p>
    <div className={styles.jumpRow}><button onClick={() => onJump(Math.max(0, chapterIndex - 1))} disabled={chapterIndex <= 0} aria-label="上一章"><ChevronLeft size={17} />上一章</button><select value={chapterIndex} onChange={(event) => onJump(Number(event.target.value))} aria-label="跳转到章节">{chapters.map((item, index) => <option key={item.id} value={index} disabled={item.locked}>{item.title}{item.locked ? '（演示内容缺失）' : ''}</option>)}</select><button onClick={() => onJump(Math.min(chapters.length - 1, chapterIndex + 1))} disabled={chapterIndex >= chapters.length - 1} aria-label="下一章">下一章<ChevronRight size={17} /></button></div>
    <label className={styles.rangeLabel}>全书章节位置<input type="range" min="0" max={Math.max(0, chapters.length - 1)} step="1" value={chapterIndex} onChange={(event) => onJump(Number(event.target.value))} aria-label="选择章节位置" /></label>
  </section>;
}
