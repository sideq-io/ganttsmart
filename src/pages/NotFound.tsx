import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-8xl font-bold text-accent/20 mb-4">404</div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Page not found</h1>
        <p className="text-sm text-text-secondary mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="px-6 py-2.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors"
          >
            Go home
          </Link>
          <Link
            to="/app"
            className="px-6 py-2.5 bg-bg-hover border border-border-secondary text-text-primary text-sm font-medium rounded-lg hover:bg-border-secondary transition-colors"
          >
            Open app
          </Link>
        </div>
      </div>
    </div>
  );
}
