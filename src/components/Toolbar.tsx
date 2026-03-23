import { useState } from 'react';
import type { Theme } from '@/hooks/useTheme';
import { toastError, toastSuccess } from './Toast';
import { exportAsPng, exportAsPdf } from '@/utils/export';
import ShareDialog from './ShareDialog';
import ThemeToggle from './ThemeToggle';

interface Props {
  loading: boolean;
  lastSynced: string;
  onRefresh: () => void;
  onDisconnectLinear: () => void;
  onSignOut: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  dayWidth: number;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  projectId: string;
  projectName: string;
}

const btnClass =
  'flex items-center gap-1.5 px-3.5 py-[7px] bg-bg-hover border border-border-secondary rounded-md text-text-secondary text-xs font-medium cursor-pointer transition-all hover:bg-border-secondary hover:text-text-primary active:scale-[0.98]';

export default function Toolbar({
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
  projectName,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

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

  return (
    <div className="flex items-center gap-3 mb-2 flex-wrap print:hidden">
      {/* Refresh - accent tinted */}
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3.5 py-[7px] bg-accent/10 border border-accent/20 rounded-md text-accent text-xs font-medium cursor-pointer transition-all hover:bg-accent/15 active:scale-[0.98]"
      >
        {loading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        )}
        Refresh
      </button>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 bg-bg-hover/50 rounded-lg px-1.5 py-0.5">
        <button onClick={onZoomOut} className={btnClass} title="Zoom out (-)">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <span className="text-[11px] text-text-muted w-8 text-center font-mono">{dayWidth}</span>
        <button onClick={onZoomIn} className={btnClass} title="Zoom in (+)">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
      </div>

      {/* Export */}
      <div className="relative">
        <button onClick={() => setShowExportMenu(!showExportMenu)} className={btnClass} disabled={exporting}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Exporting...' : 'Export'}
        </button>
        {showExportMenu && (
          <div className="absolute top-full mt-1 left-0 bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 min-w-[140px] py-1">
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
      <button onClick={() => setShowShareDialog(true)} className={btnClass} title="Share roadmap">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share
      </button>

      {showShareDialog && (
        <ShareDialog projectId={projectId} projectName={projectName} onClose={() => setShowShareDialog(false)} />
      )}

      {/* Theme toggle */}
      <ThemeToggle theme={theme} onThemeChange={onThemeChange} />

      {/* Right side: account actions */}
      <div className="flex items-center gap-2 ml-auto">
        {lastSynced && (
          <span className="bg-bg-hover text-text-muted text-[11px] px-3 py-1 rounded-full">Synced {lastSynced}</span>
        )}
        <button
          onClick={onDisconnectLinear}
          className="flex items-center gap-1.5 px-3.5 py-[7px] bg-bg-hover border border-border-secondary rounded-md text-text-secondary text-xs font-medium cursor-pointer transition-all hover:bg-high/15 hover:text-high hover:border-high/30 active:scale-[0.98]"
          title="Disconnect Linear account"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Disconnect
        </button>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 px-3.5 py-[7px] bg-bg-hover border border-border-secondary rounded-md text-text-secondary text-xs font-medium cursor-pointer transition-all hover:bg-urgent/15 hover:text-urgent hover:border-urgent/30 active:scale-[0.98]"
          title="Sign out"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
