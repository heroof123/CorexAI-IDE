import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  startOAuthFlow,
  getStoredProfiles,
  signOut,
  isTokenExpired,
  refreshAccessToken,
  type UserProfile
} from '../services/auth';

export default function AccountsPanel() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const stored = await getStoredProfiles();
    setProfiles(stored);
  };

  const handleSignIn = async (provider: 'github' | 'microsoft') => {
    setIsAuthenticating(provider);
    setError(null);

    try {
      const profile = await startOAuthFlow(provider);
      console.log('✅ Signed in:', profile);
      loadProfiles();
    } catch (err) {
      console.error('❌ Sign in failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(null);
    }
  };

  const handleSignOut = async (provider: 'github' | 'microsoft') => {
    if (confirm(`Sign out from ${provider}?`)) {
      await signOut(provider);
      await loadProfiles();
    }
  };

  const handleRefreshToken = async (profile: UserProfile) => {
    try {
      const updated = await refreshAccessToken(profile);
      console.log('✅ Token refreshed:', updated);
      loadProfiles();
    } catch (err) {
      console.error('❌ Token refresh failed:', err);
      setError('Failed to refresh token. Please sign in again.');
    }
  };

  const getProfile = (provider: 'github' | 'microsoft') => {
    return profiles.find(p => p.provider === provider);
  };

  const AccountCard = ({
    provider,
    name,
    description,
    icon,
    color
  }: {
    provider: 'github' | 'microsoft';
    name: string;
    description: string;
    icon: string;
    color: string;
  }) => {
    const profile = getProfile(provider);
    const expired = profile ? isTokenExpired(profile) : false;

    return (
      <div className="p-4 border border-[var(--color-border)] rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-white font-semibold text-xl`}
          >
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--color-text)]">{name}</h3>
            <p className="text-sm text-[var(--color-textSecondary)]">{description}</p>
          </div>
        </div>

        {profile ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded">
              {profile.avatar && (
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{profile.username}</div>
                <div className="text-xs text-[var(--color-textSecondary)] truncate">
                  {profile.email}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${expired ? 'bg-red-500' : 'bg-green-500'}`}></div>
            </div>

            {/* Token Status */}
            {expired && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-600">
                ⚠️ Token expired. Please refresh or sign in again.
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {expired && profile.refreshToken && (
                <button
                  onClick={() => handleRefreshToken(profile)}
                  className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:opacity-80 transition-opacity"
                >
                  🔄 Refresh Token
                </button>
              )}
              <button
                onClick={() => handleSignOut(provider)}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:opacity-80 transition-opacity"
              >
                🚪 Sign Out
              </button>
            </div>

            {/* Token Info (for debugging) */}
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--color-textSecondary)] hover:text-[var(--color-text)]">
                Token Info
              </summary>
              <div className="mt-2 p-2 bg-[var(--color-background)] rounded font-mono">
                <div className="mb-1">
                  <span className="text-[var(--color-textSecondary)]">Access Token:</span>
                  <div className="truncate">{profile.accessToken.substring(0, 20)}...</div>
                </div>
                {profile.expiresAt && (
                  <div>
                    <span className="text-[var(--color-textSecondary)]">Expires:</span>
                    <div>{new Date(profile.expiresAt).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </details>
          </div>
        ) : (
          <button
            onClick={() => handleSignIn(provider)}
            disabled={isAuthenticating === provider}
            className={`w-full px-4 py-2 ${color} text-white rounded text-sm hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isAuthenticating === provider ? (
              <>⏳ Authenticating...</>
            ) : (
              <>🔐 Sign in with {name}</>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
          👤 {t('activity.accounts')}
        </h2>
        <p className="text-sm text-[var(--color-textSecondary)]">
          Connect your accounts to sync settings and access cloud features
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-600">
          <div className="flex items-start gap-2">
            <span>❌</span>
            <div className="flex-1">
              <div className="font-medium mb-1">Authentication Error</div>
              <div>{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <AccountCard
            provider="github"
            name="GitHub"
            description="Access your repositories and gists"
            icon="GH"
            color="bg-gray-800"
          />

          <AccountCard
            provider="microsoft"
            name="Microsoft"
            description="Sync settings across devices"
            icon="MS"
            color="bg-blue-600"
          />
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
          <h3 className="font-semibold text-sm mb-2">🔒 Privacy & Security</h3>
          <ul className="text-xs text-[var(--color-textSecondary)] space-y-1">
            <li>• Your credentials are stored locally and encrypted</li>
            <li>• We never store your passwords</li>
            <li>• OAuth tokens are used for authentication</li>
            <li>• You can revoke access anytime from your account settings</li>
          </ul>
        </div>

        {/* Connected Accounts Summary */}
        {profiles.length > 0 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded">
            <div className="text-sm font-medium text-green-600 mb-1">
              ✅ {profiles.length} account{profiles.length > 1 ? 's' : ''} connected
            </div>
            <div className="text-xs text-[var(--color-textSecondary)]">
              {profiles.map(p => p.provider).join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
