import { useEffect, useRef, useState } from 'react';
import type { Milestone, Task } from '@/types';
import { formatDateShort } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdown';
import { priorityColors } from '@/utils/colors';
import { openDetailPanel } from './DetailPanel';

// Global handles — mirrors the DetailPanel pattern so any component can open the
// drawer without prop-drilling through the chart.
let globalOpenPanel: ((milestone: Milestone, issues: Task[]) => void) | null = null;
let globalClosePanel: (() => void) | null = null;
let globalUpdateDate: ((milestoneId: string, targetDate: string) => Promise<void>) | null = null;

export function openMilestonePanel(milestone: Milestone, issues: Task[] = []) {
  globalOpenPanel?.(milestone, issues);
}

export function closeMilestonePanel() {
  globalClosePanel?.();
}

/** Register the handler used by the panel's date picker. Pass null for read-only views. */
export function setMilestoneDateHandler(
  handler: ((milestoneId: string, targetDate: string) => Promise<void>) | null,
) {
  globalUpdateDate = handler;
}

export default function MilestonePanel() {
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [issues, setIssues] = useState<Task[]>([]);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalOpenPanel = (m: Milestone, list: Task[]) => {
      setMilestone(m);
      setIssues(list);
      requestAnimationFrame(() => setVisible(true));
    };
    globalClosePanel = () => {
      setVisible(false);
      setTimeout(() => setMilestone(null), 250); // wait for slide-out
    };
    return () => {
      globalOpenPanel = null;
      globalClosePanel = null;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!milestone) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMilestonePanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [milestone]);

  // Close on click outside
  useEffect(() => {
    if (!milestone) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeMilestonePanel();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [milestone]);

  if (!milestone) return null;

  const targetDate = milestone.targetDate ? new Date(milestone.targetDate + 'T00:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = targetDate ? Math.round((targetDate.getTime() - today.getTime()) / 86400000) : null;
  const overdue = daysLeft !== null && daysLeft < 0;
  const desc = milestone.description ? stripMarkdown(milestone.description) : '';

  const completed = issues.filter((t) => t.statusType === 'completed' || t.completedAt).length;
  const progress = issues.length > 0 ? Math.round((completed / issues.length) * 100) : 0;

  const handleDateChange = async (value: string) => {
    if (!value || !globalUpdateDate) return;
    setSaving(true);
    try {
      await globalUpdateDate(milestone.id, value);
      setMilestone((prev) => (prev ? { ...prev, targetDate: value } : prev));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[150] transition-opacity duration-250 ${visible ? 'bg-black/20 backdrop-blur-[2px]' : 'opacity-0 pointer-events-none'}`}
        onClick={() => closeMilestonePanel()}
      />

      {/* Panel — bottom sheet on mobile, side panel on desktop */}
      <div
        ref={panelRef}
        className={`fixed z-[151] bg-bg-card shadow-2xl flex flex-col transition-transform duration-250 ease-out print:hidden
          inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl border-t border-border-secondary
          md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:rounded-none md:border-t-0 md:border-l md:w-[420px] md:max-w-[90vw]
          ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rotate-45 border-2 border-amber-500 bg-amber-500/30 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Milestone</span>
          </div>
          <button
            onClick={() => closeMilestonePanel()}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-base font-semibold text-text-primary leading-snug mb-4">{milestone.name}</h2>

            <div className="space-y-3">
              {/* Target date — editable when a handler is registered */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted shrink-0">Target Date</span>
                {globalUpdateDate ? (
                  <input
                    type="date"
                    value={milestone.targetDate ?? ''}
                    disabled={saving}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-bg-primary border border-border-primary rounded-md text-text-primary text-xs px-2 py-1 outline-none hover:border-border-secondary focus:border-accent disabled:opacity-50 tabular-nums"
                  />
                ) : (
                  <span className="text-xs font-medium text-text-primary tabular-nums">
                    {milestone.targetDate ? formatDateShort(milestone.targetDate) : 'Not set'}
                  </span>
                )}
              </div>

              {daysLeft !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Status</span>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{
                      color: overdue
                        ? 'var(--color-urgent)'
                        : daysLeft <= 7
                          ? 'var(--color-high)'
                          : 'var(--color-text-secondary)',
                    }}
                  >
                    {overdue
                      ? `${Math.abs(daysLeft)}d overdue`
                      : daysLeft === 0
                        ? 'Due today'
                        : `${daysLeft}d remaining`}
                  </span>
                </div>
              )}

              {milestone.updatedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Last updated</span>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {new Date(milestone.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress across linked issues */}
          {issues.length > 0 && (
            <div className="px-5 pb-4">
              <div className="p-3 rounded-lg bg-bg-primary border border-border-primary">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-text-muted font-medium">Issue Progress</span>
                  <span className="text-text-secondary font-semibold">
                    {completed}/{issues.length} ({progress}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border-primary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      background: progress === 100 ? 'var(--color-success)' : 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mx-5 border-t border-border-primary" />

          {/* Description */}
          <div className="px-5 py-4">
            <div className="text-[11px] font-medium text-text-muted mb-2.5">Description</div>
            {desc ? (
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words">{desc}</div>
            ) : (
              <p className="text-xs text-text-muted italic">No description</p>
            )}
          </div>

          {/* Linked issues */}
          {issues.length > 0 && (
            <>
              <div className="mx-5 border-t border-border-primary" />
              <div className="px-5 py-4">
                <div className="text-[11px] font-medium text-text-muted mb-2.5">
                  Issues ({issues.length})
                </div>
                <div className="space-y-1.5">
                  {issues.map((t) => {
                    const color = priorityColors[t.priority] || '#52525b';
                    const done = t.statusType === 'completed' || !!t.completedAt;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          closeMilestonePanel();
                          setTimeout(() => openDetailPanel(t), 260);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-md border border-border-primary hover:border-border-secondary hover:bg-bg-hover transition-colors cursor-pointer text-left"
                      >
                        <span className="font-mono text-[10px] shrink-0" style={{ color }}>
                          {t.id}
                        </span>
                        <span
                          className={`text-[12px] text-text-primary truncate flex-1 ${done ? 'line-through opacity-60' : ''}`}
                        >
                          {t.title}
                        </span>
                        <span className="text-[10px] text-text-muted tabular-nums shrink-0">
                          {formatDateShort(t.due)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
