import { useState } from 'react';

interface Props {
  onAuthenticate: (key: string) => Promise<void>;
}

export default function AuthOverlay({ onAuthenticate }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!key.trim()) {
      setError('Please enter an API key.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onAuthenticate(key.trim());
    } catch {
      setError('Authentication failed. Check your API key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-primary/95 flex items-center justify-center z-200">
      <div className="bg-bg-card border border-border-secondary rounded-2xl p-10 max-w-[440px] w-full text-center">
        <h2 className="text-xl font-bold text-white mb-2">Connect to Linear</h2>
        <p className="text-[13px] text-text-secondary mb-6 leading-relaxed">
          Enter your Linear API key to fetch project issues. Your key is stored locally in your
          browser.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="lin_api_xxxxxxxxxxxxxxxx"
          autoComplete="off"
          className="w-full px-4 py-3 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm font-[Inter] mb-4 outline-none transition-colors focus:border-accent"
        />
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full py-3 bg-success border-none rounded-lg text-white text-sm font-semibold cursor-pointer transition-colors hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Connecting...' : 'Connect'}
        </button>
        {error && <div className="text-urgent text-xs mt-3">{error}</div>}
      </div>
    </div>
  );
}
