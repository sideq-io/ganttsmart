import { useEffect, useState } from 'react';
import AuthPage from './components/AuthPage';
import FilterBar from './components/FilterBar';
import GanttChart from './components/GanttChart';
import Header from './components/Header';
import Legend from './components/Legend';
import LinearConnect from './components/LinearConnect';
import Onboarding from './components/Onboarding';
import StatsRow from './components/StatsRow';
import ToastContainer from './components/Toast';
import Toolbar from './components/Toolbar';
import DetailPanel from './components/DetailPanel';
import { useAuth } from './hooks/useAuth';
import { useLinearData } from './hooks/useLinearData';
import { useTheme } from './hooks/useTheme';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function GanttView({ linearToken, onDisconnectLinear, onSignOut }: { linearToken: string; onDisconnectLinear: () => void; onSignOut: () => void }) {
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
  } = useLinearData(linearToken);

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

  const title = projectName ? `${projectName} Roadmap` : 'GanttSmart';

  let subtitle = 'Loading...';
  if (!loading && filteredTasks.length > 0) {
    subtitle = `${filteredTasks.length} active tasks \u00B7 ${formatDate(filteredTasks[0].due)} \u2013 ${formatDate(filteredTasks[filteredTasks.length - 1].due)}`;
  } else if (!loading && tasks.length > 0) {
    subtitle = `${tasks.length} tasks total \u00B7 0 matching filters`;
  } else if (!loading && !error) {
    subtitle = 'No tasks with due dates';
  } else if (error) {
    subtitle = 'Error loading data';
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 print:p-4">
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}

      <Header title={title} subtitle={subtitle} />
      <Toolbar
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
        projectName={projectName}
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
      <Legend />
      <GanttChart
        tasks={filteredTasks}
        doneTasks={doneTasks}
        milestones={milestones}
        loading={loading}
        error={error}
        dayWidth={dayWidth}
        groupBy={groupBy}
        onReschedule={reschedule}
        onRescheduleStart={rescheduleStart}
        onCycleStatus={cycleStatus}
      />
      <DetailPanel />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  const {
    user,
    loading,
    linearToken,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    disconnectLinear,
  } = useAuth();

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

  return (
    <GanttView
      linearToken={linearToken}
      onDisconnectLinear={disconnectLinear}
      onSignOut={signOut}
    />
  );
}
