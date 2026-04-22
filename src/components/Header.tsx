import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Theme } from '@/hooks/useTheme';
import type { Task } from '@/types';
import { exportAsPng, exportAsPdf } from '@/utils/export';
import { toastError, toastSuccess } from './Toast';
import ShareDialog from './ShareDialog';

interface Props {
  projectName: string;
  loading: boolean;
  lastSynced: string;
  onRefresh: () => void;
  onDisconnectLinear: () => void | Promise<void>;
  onSignOut: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  dayWidth: number;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  projectId: string;
  tasks: Task[];
}

const iconBtn =
  'flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer';

const ghostBtn =
  'flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer';

function formatRangeLabel(tasks: Task[]): string | null {
  const dates: number[] = [];
  for (const t of tasks) {
    if (t.startDate) {
      const d = new Date(t.startDate).getTime();
      if (!Number.isNaN(d)) dates.push(d);
    }
    if (t.due) {
      const d = new Date(t.due).getTime();
      if (!Number.isNaN(d)) dates.push(d);
    }
  }
  if (dates.length < 2) return null;
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(min)} – ${fmt(max)}`;
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default memo(function Header({
  projectName,
  loading,
  lastSynced,
  onRefresh,
  onDisconnectLinear,
  onSignOut,
  onZoomIn,
  onZoomOut,
  dayWidth,
  theme,
  onThemeChange,
  projectId,
  tasks,
}: Props) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setShowAccountMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rangeLabel = useMemo(() => formatRangeLabel(tasks), [tasks]);

  const handleExport = async (format: 'png' | 'pdf') => {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const el = document.getElementById('gantt-export-target');
      if (!el) {
        toastError('Nothing to export — load a project first.');
        return;
      }
      if (format === 'png') await exportAsPng(el);
      else await exportAsPdf(el);
      toastSuccess(`Exported as ${format.toUpperCase()}`);
    } catch (e) {
      toastError(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const toggleTheme = () => {
    onThemeChange(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-[52px] shrink-0 border-b border-border-primary bg-bg-header flex items-center px-4 gap-3 print:hidden">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <rect x="3" y="11" width="12" height="4" rx="1" />
            <rect x="3" y="18" width="15" height="3" rx="1" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-text-primary tracking-tight">Ganttsmart</span>
        {projectName && (
          <>
            <span className="text-text-muted text-sm">/</span>
            <span className="text-sm text-text-secondary truncate max-w-[240px]" title={projectName}>
              {projectName}
            </span>
            <span className="text-text-muted text-sm">/</span>
            <span className="text-sm text-text-primary font-medium">Roadmap</span>
          </>
        )}
      </div>

      {/* Center: sprint/date range badge */}
      {rangeLabel && (
        <div className="hidden md:flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-bg-hover border border-border-primary text-[11px] font-medium text-text-secondary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="font-mono tabular-nums">{rangeLabel}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {lastSynced && (
          <span className="hidden lg:inline text-[11px] text-text-muted mr-1">
            Synced <span className="font-mono tabular-nums">{lastSynced}</span>
          </span>
        )}

        {/* Refresh */}
        <button onClick={onRefresh} className={ghostBtn} title="Refresh (R)">
          {loading ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          )}
          <span className="hidden md:inline">Sync</span>
        </button>

        {/* Zoom controls */}
        <div className="flex items-center h-8 rounded-md bg-bg-hover/50 border border-border-primary">
          <button onClick={onZoomOut} className={iconBtn} title="Zoom out (−)" style={{ width: 28 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span className="text-[11px] text-text-muted w-7 text-center font-mono tabular-nums">{dayWidth}</span>
          <button onClick={onZoomIn} className={iconBtn} title="Zoom in (+)" style={{ width: 28 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Export */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu((v) => !v)}
            className={ghostBtn}
            disabled={exporting}
            title="Export roadmap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden md:inline">{exporting ? 'Exporting…' : 'Export'}</span>
          </button>
          {showExportMenu && (
            <div className="absolute top-full mt-1 right-0 bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 min-w-[160px] py-1">
              <button
                onClick={() => handleExport('png')}
                className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Export as PNG
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Export as PDF
              </button>
              <div className="border-t border-border-primary my-0.5" />
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  window.print();
                }}
                className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Print
              </button>
            </div>
          )}
        </div>

        {/* Share */}
        <button
          onClick={() => setShowShareDialog(true)}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors cursor-pointer"
          title="Share roadmap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="11.49" />
          </svg>
          Share
        </button>

        {showShareDialog && (
          <ShareDialog projectId={projectId} projectName={projectName} onClose={() => setShowShareDialog(false)} />
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-border-primary mx-1" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={iconBtn}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Account menu */}
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setShowAccountMenu((v) => !v)}
            className={iconBtn}
            title="Account"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          {showAccountMenu && (
            <div className="absolute top-full mt-1 right-0 bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 min-w-[180px] py-1">
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onDisconnectLinear();
                }}
                className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Disconnect Linear
              </button>
              <div className="border-t border-border-primary my-0.5" />
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onSignOut();
                }}
                className="w-full text-left px-3 py-2 text-xs text-urgent hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
