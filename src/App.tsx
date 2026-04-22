import { useCallback, useEffect, useState } from 'react';
import AuthPage from '@/components/AuthPage';
import FilterBar from '@/components/FilterBar';
import GanttChart from '@/components/GanttChart';
import Header from '@/components/Header';
import LinearConnect from '@/components/LinearConnect';
import Onboarding from '@/components/Onboarding';
import StatsRow from '@/components/StatsRow';
import ToastContainer from '@/components/Toast';
import DetailPanel, { setRemoveRelationHandler, setBaselinesForPanel } from '@/components/DetailPanel';
import { useAuth } from '@/hooks/useAuth';
import { useLinearData } from '@/hooks/useLinearData';
import { usePlanningHistory } from '@/hooks/usePlanningHistory';
import { useTheme } from '@/hooks/useTheme';

function GanttView({
  linearToken,
  onDisconnectLinear,
  onSignOut,
}: {
  linearToken: string;
  onDisconnectLinear: () => void | Promise<void>;
  onSignOut: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('gantt_onboarding_done');
  });

  const {
    projects,
    selectedProjectId,
    projectName,
    tasks,
    doneTasks,
    filteredTasks,
    milestones,
    assignees,
    statuses,
    loading,
    error,
    lastSynced,
    dayWidth,
    groupBy,
    filters,
    setFilters,
    setGroupBy,
    selectProject,
    refresh,
    zoomIn,
    zoomOut,
    reschedule,
    rescheduleStart,
    cycleStatus,
    createRelation,
    removeRelation,
  } = useLinearData(linearToken, onDisconnectLinear);

  // Planning history: track baselines and log changes
  const { baselines, syncBaselines, logChange, logStatusTransition } = usePlanningHistory(selectedProjectId);

  // Sync baselines whenever tasks load
  useEffect(() => {
    if (tasks.length > 0) syncBaselines(tasks);
  }, [tasks, syncBaselines]);

  // Wrap reschedule to log due date changes
  const rescheduleWithHistory = useCallback(
    async (taskUuid: string, newDueDate: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (task) logChange(task.id, 'due_date', task.due, newDueDate);
      return reschedule(taskUuid, newDueDate);
    },
    [reschedule, tasks, logChange],
  );

  // Wrap rescheduleStart to log start date changes
  const rescheduleStartWithHistory = useCallback(
    async (taskUuid: string, newStartDate: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (task) logChange(task.id, 'start_date', task.startDate, newStartDate);
      return rescheduleStart(taskUuid, newStartDate);
    },
    [rescheduleStart, tasks, logChange],
  );

  // Wrap cycleStatus to log status transitions
  const cycleStatusWithHistory = useCallback(
    async (taskUuid: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (task) logStatusTransition(task.id, task.status, '(next)');
      return cycleStatus(taskUuid);
    },
    [cycleStatus, tasks, logStatusTransition],
  );

  // Register the remove handler for DetailPanel's × buttons
  useEffect(() => {
    setRemoveRelationHandler(removeRelation);
    return () => setRemoveRelationHandler(null);
  }, [removeRelation]);

  // Keep DetailPanel's baselines in sync
  useEffect(() => {
    setBaselinesForPanel(baselines);
  }, [baselines]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          setFilters({ ...filters, search: '' });
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) refresh();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [refresh, filters, setFilters, zoomIn, zoomOut]);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('gantt_onboarding_done', '1');
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden print:h-auto print:block print:overflow-visible">
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}

      <Header
        projectName={projectName}
        loading={loading}
        lastSynced={lastSynced}
        onRefresh={refresh}
        onDisconnectLinear={onDisconnectLinear}
        onSignOut={onSignOut}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        dayWidth={dayWidth}
        theme={theme}
        onThemeChange={setTheme}
        projectId={selectedProjectId}
        tasks={filteredTasks}
      />

      <FilterBar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={selectProject}
        assignees={assignees}
        statuses={statuses}
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={tasks.length}
        filteredCount={filteredTasks.length}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      <StatsRow tasks={filteredTasks} />

      <div className="flex-1 min-h-0 overflow-hidden print:overflow-visible">
        <GanttChart
          tasks={filteredTasks}
          doneTasks={doneTasks}
          milestones={milestones}
          loading={loading}
          error={error}
          dayWidth={dayWidth}
          groupBy={groupBy}
          onReschedule={rescheduleWithHistory}
          onRescheduleStart={rescheduleStartWithHistory}
          onCycleStatus={cycleStatusWithHistory}
          onCreateRelation={createRelation}
          baselines={baselines}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
        />
      </div>

      <DetailPanel />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  const { user, loading, linearToken, signUp, signIn, signInWithGoogle, signOut, disconnectLinear } = useAuth();

  // Initialize theme on app load (applies class to <html> even on auth pages)
  useTheme();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-border-primary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} onGoogleSignIn={signInWithGoogle} />;
  }

  if (!linearToken) {
    return <LinearConnect userEmail={user.email || ''} onSignOut={signOut} />;
  }

  return <GanttView linearToken={linearToken} onDisconnectLinear={disconnectLinear} onSignOut={signOut} />;
}
