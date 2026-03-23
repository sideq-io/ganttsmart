import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting to Linear...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = sessionStorage.getItem('linear_oauth_state');

    if (!code) {
      setError('No authorization code received from Linear.');
      return;
    }

    if (state !== savedState) {
      setError('Invalid state parameter. Please try connecting again.');
      return;
    }

    sessionStorage.removeItem('linear_oauth_state');
    exchangeToken(code);
  }, [searchParams]);

  const exchangeToken = async (code: string) => {
    try {
      setStatus('Exchanging authorization code...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please sign in first.');
        return;
      }

      // Call Edge Function to exchange code for token
      const res = await fetch(`${SUPABASE_URL}/functions/v1/linear-oauth-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setStatus('Connected! Redirecting...');
      // Small delay so user sees success
      setTimeout(() => navigate('/', { replace: true }), 500);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center">
      <div className="bg-bg-card border border-border-secondary rounded-2xl p-10 max-w-[440px] w-full text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold text-white mb-3">Connection Failed</h2>
            <p className="text-sm text-urgent mb-6">{error}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-6 py-2.5 bg-bg-hover border border-border-secondary rounded-lg text-text-primary text-sm font-medium cursor-pointer hover:bg-border-secondary transition-colors"
            >
              Back to App
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-3 border-border-primary border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
