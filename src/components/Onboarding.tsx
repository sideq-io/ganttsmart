import { useState } from 'react';

interface Props {
  onComplete: () => void;
}

const steps = [
  {
    title: 'Welcome to GanttSmart! 🎉',
    description:
      'Your Gantt chart companion for Linear. Visualize project timelines, track progress, and manage tasks — all in one view.',
    tip: null,
  },
  {
    title: 'Switch Projects',
    description:
      'Use the project dropdown in the filter bar to switch between any of your Linear projects.',
    tip: 'Your last selected project is remembered automatically.',
  },
  {
    title: 'Filter & Search',
    description:
      'Filter tasks by assignee, status, or priority. Use the search box to quickly find specific tasks by name or ID.',
    tip: 'Click priority chips to toggle them on/off.',
  },
  {
    title: 'Interact with Tasks',
    description:
      'Click a task ID to open it in Linear. Drag bar edges to reschedule. Click the status badge to cycle through states.',
    tip: 'Hover over bars to see full details in a tooltip.',
  },
  {
    title: 'Zoom & Export',
    description:
      'Use the + / − buttons (or keyboard shortcuts) to zoom the timeline. Export your Gantt chart as PNG or PDF for meetings.',
    tip: 'Press R to refresh, + / − to zoom.',
  },
];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4">
      <div className="bg-bg-card border border-border-secondary rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step
                  ? 'bg-accent w-6'
                  : i < step
                    ? 'bg-accent/50'
                    : 'bg-border-secondary'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h2 className="text-lg font-bold text-text-primary mb-3 text-center">{current.title}</h2>
        <p className="text-sm text-text-secondary leading-relaxed text-center mb-4">
          {current.description}
        </p>

        {current.tip && (
          <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-2.5 mb-6">
            <p className="text-xs text-accent">
              💡 {current.tip}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onComplete}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 bg-bg-hover border border-border-secondary rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) onComplete();
                else setStep(step + 1);
              }}
              className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
