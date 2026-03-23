interface Props {
  userEmail: string;
  onSignOut: () => void;
}

const LINEAR_CLIENT_ID = import.meta.env.VITE_LINEAR_CLIENT_ID;
const LINEAR_REDIRECT_URI = import.meta.env.VITE_LINEAR_REDIRECT_URI;

export default function LinearConnect({ userEmail, onSignOut }: Props) {
  const handleConnect = () => {
    if (!LINEAR_CLIENT_ID) {
      alert('Linear OAuth Client ID not configured. Set VITE_LINEAR_CLIENT_ID in .env');
      return;
    }

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('linear_oauth_state', state);

    const params = new URLSearchParams({
      client_id: LINEAR_CLIENT_ID,
      redirect_uri: LINEAR_REDIRECT_URI,
      response_type: 'code',
      scope: 'read,write',
      state,
    });

    window.location.href = `https://linear.app/oauth/authorize?${params}`;
  };

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center z-200">
      <div className="bg-bg-card border border-border-secondary rounded-2xl p-10 max-w-[480px] w-full text-center">
        <h2 className="text-xl font-bold text-white mb-2">Connect to Linear</h2>
        <p className="text-[13px] text-text-secondary mb-2 leading-relaxed">
          Signed in as <strong className="text-text-primary">{userEmail}</strong>
        </p>
        <p className="text-[13px] text-text-secondary mb-8 leading-relaxed">
          Connect your Linear account to view and manage your project issues in a Gantt chart.
        </p>

        <button
          onClick={handleConnect}
          className="w-full py-3.5 px-4 bg-[#5E6AD2] border-none rounded-lg text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[#4E5BBF] transition-colors mb-4"
        >
          <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
            <path d="M1.22541 61.5228c-.97507 8.4927-.22037 17.1198 2.40392 25.2792l21.2132-21.2132c-.8326-1.3665-1.3088-2.9647-1.3088-4.6712 0-4.9706 4.0294-9 9-9 4.9706 0 9 4.0294 9 9s-4.0294 9-9 9c-1.7065 0-3.3047-.4762-4.6712-1.3088L6.64846 89.8225c8.15934 2.6243 16.78664 3.3793 25.27924 2.4039 13.6881-1.5684 26.5858-7.982 36.4554-17.8516 12.4957-12.4958 18.4236-29.3788 16.7918-46.0742l-3.7746 3.7746c1.137 14.2529-3.847 28.7356-14.9542 39.8428-8.8218 8.8218-20.2834 14.4904-32.4592 15.884-7.6447.8763-15.358.237-22.6215-2.0106L32.533 64.5765C30.5565 65.4665 28.3546 65.9598 26.0332 65.9598c-9.38688 0-17-7.6131-17-17 0-2.3214.4933-4.5233 1.38325-6.4998L31.629 21.2472c-2.2476-7.2635-2.8869-14.97685-2.0106-22.62154C31.0127 7.05123 36.6813-4.41044 45.5031-13.2322c11.1072-11.1073 25.5899-16.0913 39.8428-14.9542l3.7746-3.7746c-16.6954-1.6318-33.5784 4.2961-46.0742 16.7918C33.1925 -5.31008 26.779 7.58758 25.2106 21.2757c-.9754 8.4926-.2204 17.1198 2.4039 25.2792" fill="currentColor"/>
          </svg>
          Connect Linear Account
        </button>

        <button
          onClick={onSignOut}
          className="text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
