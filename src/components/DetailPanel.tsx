import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/types';
import type { TaskBaseline } from '@/hooks/usePlanningHistory';
import { Avatar } from '@/utils/avatar';
import { isSafeUrl } from '@/utils/url';
import { priorityColors, statusDotColors } from '@/utils/colors';
import { formatDateShort } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdown';

// Global state management
let globalOpenPanel: ((task: Task) => void) | null = null;
let globalClosePanel: (() => void) | null = null;
let globalRemoveRelation: ((sourceId: string, targetId: string) => Promise<void>) | null = null;
let globalBaselines: Map<string, TaskBaseline> = new Map();

export function setBaselinesForPanel(baselines: Map<string, TaskBaseline>) {
  globalBaselines = baselines;
}

export function openDetailPanel(task: Task) {
  globalOpenPanel?.(task);
}
export function closeDetailPanel() {
  globalClosePanel?.();
}
export function setRemoveRelationHandler(handler: ((sourceId: string, targetId: string) => Promise<void>) | null) {
  globalRemoveRelation = handler;
}

export default function DetailPanel() {
  const [task, setTask] = useState<Task | null>(null);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalOpenPanel = (t: Task) => {
      setTask(t);
      // Trigger animation on next frame
      requestAnimationFrame(() => setVisible(true));
    };
    globalClosePanel = () => {
      setVisible(false);
      setTimeout(() => setTask(null), 250); // Wait for slide-out animation
    };
    return () => {
      globalOpenPanel = null;
      globalClosePanel = null;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!task) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetailPanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [task]);

  // Close on click outside
  useEffect(() => {
    if (!task) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeDetailPanel();
      }
    };
    // Delay to prevent the click that opened the panel from closing it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [task]);

  if (!task) return null;

  const dueDate = new Date(task.due + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  const overdue = daysLeft < 0;
  const desc = task.description ? stripMarkdown(task.description) : '';
  const statusDotColor = statusDotColors[task.statusType] || '#484f58';
  const priorityColor = priorityColors[task.priority] || '#484f58';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[150] transition-opacity duration-250 ${visible ? 'bg-black/20 backdrop-blur-[2px]' : 'opacity-0 pointer-events-none'}`}
        onClick={() => closeDetailPanel()}
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
            <span className="text-xs font-bold tracking-wide" style={{ color: priorityColor }}>
              {task.id}
            </span>
            <span className="text-[10px] text-text-muted">·</span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${priorityColor}18`,
                color: priorityColor,
                border: `1px solid ${priorityColor}30`,
              }}
            >
              {task.priority}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={isSafeUrl(task.url) ? task.url : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
              title="Open in Linear"
            >
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
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <button
              onClick={() => closeDetailPanel()}
              className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Title section */}
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-base font-semibold text-text-primary leading-snug mb-4">{task.title}</h2>

            {/* Metadata */}
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Status</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusDotColor }} />
                  {task.status}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Priority</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${priorityColor}18`,
                    color: priorityColor,
                    border: `1px solid ${priorityColor}30`,
                  }}
                >
                  {task.priority}
                </span>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Assignee</span>
                <div className="flex items-center gap-2">
                  <Avatar name={task.assignee} size="sm" />
                  <span className="text-xs font-medium text-text-primary">{task.assignee}</span>
                </div>
              </div>

              {/* Dates */}
              {task.startDate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Start Date</span>
                  <span className="text-xs font-medium text-text-primary tabular-nums">
                    {formatDateShort(task.startDate)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Due Date</span>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: overdue ? '#f85149' : daysLeft <= 7 ? '#ffa657' : undefined }}
                >
                  {formatDateShort(task.due)}
                  <span className="ml-1.5 text-[11px]">
                    ({overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
                  </span>
                </span>
              </div>
            </div>

            {/* Baseline drift */}
            {(() => {
              const bl = globalBaselines.get(task.id);
              if (!bl) return null;
              const actualDue = new Date(task.due + 'T00:00:00');
              const plannedDue = new Date(bl.planned_due + 'T00:00:00');
              const dueDrift = Math.round((actualDue.getTime() - plannedDue.getTime()) / 86400000);
              const actualStart = task.startDate ? new Date(task.startDate + 'T00:00:00') : null;
              const plannedStart = bl.planned_start ? new Date(bl.planned_start + 'T00:00:00') : null;
              const startDrift = actualStart && plannedStart
                ? Math.round((actualStart.getTime() - plannedStart.getTime()) / 86400000)
                : null;
              if (dueDrift === 0 && (startDrift === null || startDrift === 0)) return null;
              return (
                <div className="mt-3 p-2.5 rounded-lg bg-bg-primary border border-border-primary">
                  <div className="text-[10px] font-medium text-text-muted mb-1.5">Baseline Drift</div>
                  {startDrift !== null && startDrift !== 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Start</span>
                      <span style={{ color: startDrift > 0 ? '#f0883e' : '#58a6ff' }}>
                        {formatDateShort(bl.planned_start!)} → {formatDateShort(task.startDate!)}
                        <span className="ml-1 font-semibold">({startDrift > 0 ? '+' : ''}{startDrift}d)</span>
                      </span>
                    </div>
                  )}
                  {dueDrift !== 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Due</span>
                      <span style={{ color: dueDrift > 0 ? '#f0883e' : '#58a6ff' }}>
                        {formatDateShort(bl.planned_due)} → {formatDateShort(task.due)}
                        <span className="ml-1 font-semibold">({dueDrift > 0 ? '+' : ''}{dueDrift}d)</span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Progress */}
          {task.totalChildren > 0 && (
            <div className="px-5 pb-4">
              <div className="p-3 rounded-lg bg-bg-primary border border-border-primary">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-text-muted font-medium">Sub-issue Progress</span>
                  <span className="text-text-secondary font-semibold">
                    {task.completedChildren}/{task.totalChildren} ({task.progress}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border-primary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${task.progress}%`,
                      background: task.progress === 100 ? '#238636' : 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dependencies */}
          {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
            <div className="px-5 pb-4">
              <div className="text-[11px] font-medium text-text-muted mb-2">Dependencies</div>
              <div className="flex flex-wrap gap-1.5">
                {task.blockedBy.map((blockerId) => (
                  <span
                    key={`by-${blockerId}`}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-urgent/10 text-urgent border border-urgent/20 font-medium"
                  >
                    Blocked by {blockerId}
                    {globalRemoveRelation && (
                      <button
                        className="ml-0.5 p-0.5 rounded hover:bg-urgent/20 transition-colors cursor-pointer"
                        title={`Remove dependency: ${blockerId} → ${task.id}`}
                        onClick={() => {
                          globalRemoveRelation?.(blockerId, task.id);
                          closeDetailPanel();
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
                {task.blocks.map((blockedId) => (
                  <span
                    key={`blocks-${blockedId}`}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-high/10 text-high border border-high/20 font-medium"
                  >
                    Blocks {blockedId}
                    {globalRemoveRelation && (
                      <button
                        className="ml-0.5 p-0.5 rounded hover:bg-high/20 transition-colors cursor-pointer"
                        title={`Remove dependency: ${task.id} → ${blockedId}`}
                        onClick={() => {
                          globalRemoveRelation?.(task.id, blockedId);
                          closeDetailPanel();
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
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
        </div>
      </div>
    </>
  );
}
