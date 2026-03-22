import { useEffect } from 'react';
import AuthOverlay from './components/AuthOverlay';
import FilterBar from './components/FilterBar';
import GanttChart from './components/GanttChart';
import Header from './components/Header';
import Legend from './components/Legend';
import StatsRow from './components/StatsRow';
import Toolbar from './components/Toolbar';
import Tooltip from './components/Tooltip';
import { useLinearData } from './hooks/useLinearData';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function App() {
  const {
    isAuthenticated,
    projects,
    selectedProjectId,
    projectName,
    tasks,
    filteredTasks,
    milestones,
    assignees,
    statuses,
    loading,
    error,
    lastSynced,
    dayWidth,
    filters,
    setFilters,
    authenticate,
    logout,
    selectProject,
    refresh,
    zoomIn,
    zoomOut,
  } = useLinearData();

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

  const title = projectName ? `${projectName} Roadmap` : 'Linear Gantt';

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
    <div className="p-10">
      {!isAuthenticated && <AuthOverlay onAuthenticate={authenticate} />}

      <Header title={title} subtitle={subtitle} />
      <Toolbar
        loading={loading}
        lastSynced={lastSynced}
        onRefresh={refresh}
        onLogout={logout}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        dayWidth={dayWidth}
      />

      {isAuthenticated && (
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
        />
      )}

      <StatsRow tasks={filteredTasks} />
      <Legend />
      <GanttChart
        tasks={filteredTasks}
        milestones={milestones}
        loading={loading}
        error={error}
        dayWidth={dayWidth}
      />
      <Tooltip />
    </div>
  );
}
