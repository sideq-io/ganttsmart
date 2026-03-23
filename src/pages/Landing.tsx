import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

// Realistic mock data for the Gantt preview
const MOCK_TASKS = [
  { id: 'AUTH-12', title: 'Revamp OAuth flow', assignee: 'SK', priority: 'urgent', start: 0, width: 8, status: 'In Progress' },
  { id: 'API-45', title: 'Rate limiting middleware', assignee: 'MB', priority: 'high', start: 3, width: 12, status: 'Todo' },
  { id: 'UI-78', title: 'Dashboard redesign', assignee: 'AL', priority: 'medium', start: 6, width: 9, status: 'In Progress' },
  { id: 'DB-23', title: 'Migration scripts v2', assignee: 'SK', priority: 'urgent', start: 2, width: 6, status: 'Todo' },
  { id: 'INFRA-9', title: 'CDN configuration', assignee: 'JR', priority: 'low', start: 10, width: 7, status: 'Backlog' },
  { id: 'API-51', title: 'Webhook retry logic', assignee: 'MB', priority: 'high', start: 8, width: 10, status: 'Todo' },
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DATES = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5];

const priorityColors: Record<string, { bar: string; text: string; bg: string }> = {
  urgent: { bar: 'bg-urgent', text: 'text-urgent', bg: 'bg-urgent/12' },
  high: { bar: 'bg-high', text: 'text-high', bg: 'bg-high/12' },
  medium: { bar: 'bg-medium', text: 'text-medium', bg: 'bg-medium/12' },
  low: { bar: 'bg-low', text: 'text-low', bg: 'bg-low/12' },
};

const avatarColors = ['#f85149', '#58a6ff', '#d2992a', '#238636', '#ffa657'];

function MockAvatar({ initials, idx }: { initials: string; idx: number }) {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
      style={{ backgroundColor: avatarColors[idx % avatarColors.length] }}
    >
      {initials}
    </div>
  );
}

export default function Landing() {
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--color-text-muted) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-muted) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-bg-primary/90 backdrop-blur-xl border-b border-border-primary' : ''}`}>
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="8" x2="16" y2="8" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="16" x2="12" y2="16" />
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight">GanttSmart</span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/sideq-io/linear-gantt"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Star on GitHub
            </a>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              )}
            </button>
            <Link
              to="/app"
              className="px-4 py-1.5 bg-text-primary text-bg-primary text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              Open App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — product first */}
      <section className="pt-24 sm:pt-28 px-6">
        <div className="max-w-[1200px] mx-auto">
          {/* Tight headline */}
          <div className="max-w-2xl mb-8 sm:mb-12">
            <p className="text-xs font-mono text-accent tracking-wider uppercase mb-4">For Linear users</p>
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] mb-5">
              See your roadmap.<br />
              Not just a list of tickets.
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-lg">
              GanttSmart turns your Linear projects into an interactive timeline you can
              actually drag around. No setup, no configuration — connect and go.
            </p>
          </div>

          {/* CTA row */}
          <div className="flex items-center gap-4 mb-10 sm:mb-14 flex-wrap">
            <Link
              to="/app"
              className="group flex items-center gap-2 px-6 py-2.5 bg-text-primary text-bg-primary text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
            >
              Start using it
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
            <span className="text-xs text-text-muted">Free. No credit card.</span>
          </div>

          {/* The product mock — this IS the hero */}
          <div className="rounded-xl border border-border-secondary bg-bg-card overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-header border-b border-border-primary">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-urgent/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-medium/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-3 py-0.5 rounded bg-bg-primary/50 text-[10px] text-text-muted">
                  ganttsmart.app
                </div>
              </div>
              <div className="w-12" />
            </div>

            {/* Mock toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border-primary text-[10px]">
              <div className="px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">sprint-q1</div>
              <div className="h-3 w-px bg-border-secondary" />
              <span className="text-text-muted">6 tasks</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="px-1.5 py-0.5 rounded bg-urgent/10 text-urgent font-medium">Urgent</div>
                <div className="px-1.5 py-0.5 rounded bg-high/10 text-high font-medium">High</div>
                <div className="px-1.5 py-0.5 rounded bg-medium/10 text-medium font-medium">Medium</div>
              </div>
            </div>

            {/* Gantt table */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: 700 }}>
                {/* Calendar header */}
                <div className="flex border-b border-border-primary">
                  <div className="w-[240px] shrink-0" />
                  <div className="flex-1 flex">
                    {DATES.map((d, i) => {
                      const isToday = d === 21;
                      const isWeekend = DAYS[i] === 'S';
                      return (
                        <div
                          key={i}
                          className={`flex-1 text-center py-1.5 text-[9px] leading-tight border-r border-border-primary/30 ${isWeekend ? 'bg-text-muted/5' : ''} ${isToday ? 'bg-accent/8' : ''}`}
                        >
                          <div className={`font-medium ${isToday ? 'text-accent' : 'text-text-muted'}`}>{d}</div>
                          <div className={`${isToday ? 'text-accent/60' : 'text-text-muted/60'}`}>{DAYS[i]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Task rows */}
                {MOCK_TASKS.map((task, idx) => {
                  const colors = priorityColors[task.priority];
                  const isHovered = hoveredTask === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center border-b border-border-primary/50 transition-colors duration-150 ${isHovered ? 'bg-accent/[0.03]' : ''}`}
                      onMouseEnter={() => setHoveredTask(task.id)}
                      onMouseLeave={() => setHoveredTask(null)}
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      {/* Task info */}
                      <div className="w-[240px] shrink-0 px-3 py-2.5 flex items-center gap-2 border-r border-border-primary/30">
                        <MockAvatar initials={task.assignee} idx={idx} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold ${colors.text}`}>{task.id}</span>
                            <span className={`text-[8px] px-1 py-px rounded ${colors.bg} ${colors.text} font-medium`}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-primary truncate">{task.title}</div>
                          <div className="text-[9px] text-text-muted">{task.status}</div>
                        </div>
                      </div>

                      {/* Bar area */}
                      <div className="flex-1 relative h-10 flex items-center">
                        {DATES.map((d, i) => {
                          const isWeekend = DAYS[i] === 'S';
                          const isToday = d === 21;
                          return (
                            <div
                              key={i}
                              className={`flex-1 h-full border-r border-border-primary/20 ${isWeekend ? 'bg-text-muted/[0.03]' : ''} ${isToday ? 'bg-accent/[0.04] border-r-accent/20' : ''}`}
                            />
                          );
                        })}
                        {/* The bar */}
                        <div
                          className={`absolute h-6 rounded ${colors.bar} transition-all duration-300 ${isHovered ? 'brightness-110 scale-y-[1.12]' : ''}`}
                          style={{
                            left: `${(task.start / 20) * 100}%`,
                            width: `${(task.width / 20) * 100}%`,
                            opacity: 0.85,
                          }}
                        >
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-white/80">
                            {task.width}d
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — inline, not a grid */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-xs font-mono text-accent tracking-wider uppercase mb-12">How it works</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-0">
            {[
              { num: '01', title: 'Connect', desc: 'Sign in and authorize with Linear OAuth. Takes about ten seconds. Your tokens are stored encrypted — never in the browser.' },
              { num: '02', title: 'Visualize', desc: 'Pick a project. Every issue with a due date becomes a bar on the timeline. Start dates, dependencies, milestones — all there.' },
              { num: '03', title: 'Manage', desc: 'Drag bars to reschedule. Click to cycle status. Filter, group, zoom, export. Changes sync back to Linear instantly.' },
            ].map((step, i) => (
              <div key={i} className="py-8 lg:py-0 lg:px-8 border-b lg:border-b-0 lg:border-r border-border-primary last:border-0">
                <span className="text-[11px] font-mono text-text-muted">{step.num}</span>
                <h3 className="text-xl font-bold mt-1 mb-3">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — alternating layout */}
      <section className="pb-24 sm:pb-32 px-6">
        <div className="max-w-[1200px] mx-auto space-y-20">
          {/* Drag to reschedule */}
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-16">
            <div className="flex-1 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-urgent/10 text-urgent text-[10px] font-semibold mb-4">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Interactive
              </div>
              <h3 className="text-2xl font-bold mb-3">Drag. Drop. Done.</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Grab any bar edge to change due dates, drag the left edge for start dates,
                or move the entire bar to shift both. Every change writes back to Linear via API.
              </p>
              <p className="text-xs text-text-muted">Ctrl+Z to undo. Always.</p>
            </div>
            <div className="flex-1 rounded-lg border border-border-primary bg-bg-card p-6">
              <div className="space-y-3">
                {['AUTH-12 → Mar 24', 'API-45 → Apr 2', 'DB-23 → Mar 28'].map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`h-5 rounded ${i === 0 ? 'bg-urgent' : i === 1 ? 'bg-high' : 'bg-medium'} cursor-grab`} style={{ width: `${50 + i * 15}%` }} />
                    <span className="text-[10px] text-text-muted whitespace-nowrap font-mono">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filtering */}
          <div className="flex flex-col lg:flex-row-reverse items-start gap-8 lg:gap-16">
            <div className="flex-1 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-semibold mb-4">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filters
              </div>
              <h3 className="text-2xl font-bold mb-3">Find anything in seconds</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Filter by assignee, status, priority. Group by team member to see workload.
                Type to search across all task titles. Priority chips toggle on/off instantly.
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-border-primary bg-bg-card p-4">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {['Urgent', 'High', 'Medium', 'Low'].map((p, i) => (
                  <div key={i} className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${i < 3 ? 'border-accent/30 text-accent bg-accent/8' : 'border-border-secondary text-text-muted'}`}>
                    {p}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 px-2.5 py-1.5 rounded bg-bg-primary border border-border-primary text-[10px] text-text-muted">All Assignees</div>
                <div className="flex-1 px-2.5 py-1.5 rounded bg-bg-primary border border-border-primary text-[10px] text-text-muted">All Statuses</div>
                <div className="flex-1 px-2.5 py-1.5 rounded bg-bg-primary border border-border-primary text-[10px] text-text-muted flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Search...
                </div>
              </div>
            </div>
          </div>

          {/* Sync + Export */}
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-16">
            <div className="flex-1 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-success/10 text-success text-[10px] font-semibold mb-4">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Always fresh
              </div>
              <h3 className="text-2xl font-bold mb-3">Auto-syncs every 30 seconds</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                No manual refresh needed. When someone updates a task in Linear, it appears on your
                timeline within half a minute. Export as PNG or PDF for your next standup.
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-border-primary bg-bg-card p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-secondary">Last synced</span>
                <span className="text-[11px] text-accent font-mono">just now</span>
              </div>
              <div className="h-px bg-border-primary" />
              <div className="flex gap-2">
                <div className="flex-1 text-center py-2 rounded border border-border-primary text-[10px] text-text-secondary hover:border-accent hover:text-accent transition-colors cursor-default">PNG</div>
                <div className="flex-1 text-center py-2 rounded border border-border-primary text-[10px] text-text-secondary hover:border-accent hover:text-accent transition-colors cursor-default">PDF</div>
                <div className="flex-1 text-center py-2 rounded border border-border-primary text-[10px] text-text-secondary hover:border-accent hover:text-accent transition-colors cursor-default">Print</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Your Linear data.<br />
            <span className="text-text-secondary">On a timeline.</span>
          </h2>
          <p className="text-sm text-text-muted mb-8">
            Connect in 10 seconds. No vendor lock-in, no hidden fees.
          </p>
          <Link
            to="/app"
            className="group inline-flex items-center gap-2 px-8 py-3 bg-text-primary text-bg-primary text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
          >
            Open GanttSmart
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-primary px-6 py-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">
              Built by{' '}
              <a href="https://sideq.io" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary transition-colors">
                sideq.io
              </a>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/sideq-io/linear-gantt" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
