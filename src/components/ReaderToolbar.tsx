import { CircleDot, Compass, Menu, Sun, Type } from 'lucide-react';
import styles from './ReaderToolbar.module.css';

export type ReaderTool = 'directory' | 'bookmarks' | 'progress' | 'theme' | 'type' | 'search';

interface ReaderToolbarProps {
  activeTool: ReaderTool;
  onSelect: (tool: ReaderTool) => void;
}

const TOOLS = [
  { id: 'directory', label: '目录', Icon: Menu },
  { id: 'bookmarks', label: '书签与导航', Icon: Compass },
  { id: 'progress', label: '阅读进度', Icon: CircleDot },
  { id: 'theme', label: '阅读主题', Icon: Sun },
  { id: 'type', label: '字体排版', Icon: Type },
] as const;

export default function ReaderToolbar({ activeTool, onSelect }: ReaderToolbarProps) {
  return (
    <nav className={styles.toolbar} aria-label="阅读工具">
      {TOOLS.map(({ id, label, Icon }) => <button
        className={`${styles.tool} ${activeTool === id || (id === 'directory' && activeTool === 'search') ? styles.active : ''}`}
        key={id}
        type="button"
        aria-label={label}
        aria-pressed={activeTool === id || (id === 'directory' && activeTool === 'search')}
        title={label}
        onClick={() => onSelect(id)}
      ><Icon size={25} strokeWidth={1.6} /></button>)}
    </nav>
  );
}
