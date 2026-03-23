import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@/index.css';
import App from '@/App';
import ErrorBoundary from '@/components/ErrorBoundary';

const Landing = lazy(() => import('@/pages/Landing'));
const Callback = lazy(() => import('@/pages/Callback'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const SharedView = lazy(() => import('@/pages/SharedView'));

const Spinner = () => (
  <div className="fixed inset-0 bg-bg-primary flex items-center justify-center">
    <div className="w-10 h-10 border-3 border-border-primary border-t-accent rounded-full animate-spin" />
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<Spinner />}>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<App />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/share/:shareToken" element={<SharedView />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
