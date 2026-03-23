import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast, toastError, toastSuccess } from './Toast';

async function invokeShareFn(action: string, body: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-roadmap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

interface ShareRecord {
  id: string;
  shareToken: string;
  projectName: string;
  expiresAt: string;
  cachedAt: string;
  hasPassword: boolean;
  createdAt: string;
}

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function ShareDialog({ projectId, projectName, onClose }: Props) {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState(3);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeShareFn('list', { projectId });
      setShares(data.shares || []);
    } catch (e) {
      toastError(`Failed to load shares: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await invokeShareFn('create', {
        projectId,
        password: password || undefined,
        expiresInDays: expiryDays,
      });

      const url = `${window.location.origin}/share/${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      toastSuccess('Share link created and copied to clipboard!');
      setPassword('');
      loadShares();
    } catch (e) {
      toastError(`Failed to create share: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRefresh = async (shareId: string) => {
    setRefreshingId(shareId);
    try {
      await invokeShareFn('refresh', { shareId });
      toastSuccess('Share data refreshed');
      loadShares();
    } catch (e) {
      toastError(`Refresh failed: ${(e as Error).message}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (shareId: string) => {
    try {
      await invokeShareFn('delete', { shareId });
      toastSuccess('Share link deleted');
      loadShares();
    } catch (e) {
      toastError(`Delete failed: ${(e as Error).message}`);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast('Link copied to clipboard', 'info');
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-secondary rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <div>
            <h2 className="text-base font-bold text-text-primary">Share Roadmap</h2>
            <p className="text-xs text-text-secondary mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer text-lg">
            ×
          </button>
        </div>

        {/* Create new share */}
        <div className="px-6 py-4 border-b border-border-primary">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Create New Link</h3>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-text-muted mb-1 block">Password (optional)</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for public access"
                  className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-xs outline-none focus:border-accent"
                />
              </div>
              <div className="w-28">
                <label className="text-[11px] text-text-muted mb-1 block">Expires in</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-xs outline-none focus:border-accent cursor-pointer"
                >
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create & Copy Link'}
            </button>
          </div>
        </div>

        {/* Existing shares */}
        <div className="px-6 py-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Active Links ({shares.filter((s) => !isExpired(s.expiresAt)).length})
          </h3>

          {loading ? (
            <div className="text-center py-6">
              <div className="w-5 h-5 border-2 border-border-primary border-t-accent rounded-full animate-spin mx-auto" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">No shared links yet</p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => {
                const expired = isExpired(share.expiresAt);
                return (
                  <div
                    key={share.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${expired ? 'border-border-primary opacity-50' : 'border-border-secondary'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-primary truncate">
                          /share/{share.shareToken.slice(0, 8)}...
                        </span>
                        {share.hasPassword && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                            Password
                          </span>
                        )}
                        {expired && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-urgent/10 text-urgent font-medium">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        Expires {new Date(share.expiresAt).toLocaleDateString()}
                        {share.cachedAt && ` · Updated ${new Date(share.cachedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!expired && (
                        <>
                          <button
                            onClick={() => copyLink(share.shareToken)}
                            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                            title="Copy link"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRefresh(share.id)}
                            disabled={refreshingId === share.id}
                            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary cursor-pointer transition-colors disabled:opacity-50"
                            title="Refresh cached data"
                          >
                            {refreshingId === share.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(share.id)}
                        className="p-1.5 rounded hover:bg-urgent/10 text-text-muted hover:text-urgent cursor-pointer transition-colors"
                        title="Delete share"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
