interface Props {
  loading: boolean;
  lastSynced: string;
  onRefresh: () => void;
  onLogout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  dayWidth: number;
}

const btnClass =
  'flex items-center gap-1.5 px-3.5 py-[7px] bg-bg-hover border border-border-secondary rounded-md text-text-secondary text-xs font-medium cursor-pointer transition-all hover:bg-border-secondary hover:text-text-primary';

export default function Toolbar({ loading, lastSynced, onRefresh, onLogout, onZoomIn, onZoomOut, dayWidth }: Props) {
  return (
    <div className="flex items-center gap-3 mb-2 flex-wrap">
      <button onClick={onRefresh} className={btnClass}>
        {loading && (
          <span className="inline-block w-3 h-3 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        )}
        Refresh
      </button>
      <button
        onClick={onLogout}
        className="px-3.5 py-[7px] bg-bg-hover border border-border-secondary rounded-md text-text-secondary text-xs font-medium cursor-pointer transition-all hover:bg-urgent/15 hover:text-urgent hover:border-urgent/30"
      >
        Disconnect
      </button>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 ml-2">
        <button onClick={onZoomOut} className={btnClass} title="Zoom out (-)">
          &minus;
        </button>
        <span className="text-[10px] text-text-muted w-8 text-center">{dayWidth}px</span>
        <button onClick={onZoomIn} className={btnClass} title="Zoom in (+)">
          +
        </button>
      </div>

      {lastSynced && (
        <span className="text-[11px] text-text-muted ml-auto">Last synced: {lastSynced}</span>
      )}
    </div>
  );
}
