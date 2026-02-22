// OAuth Authentication Service
import { invoke } from '@tauri-apps/api/core';

export interface AuthProvider {
  id: 'github' | 'microsoft';
  name: string;
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface UserProfile {
  id: string;
  provider: 'github' | 'microsoft';
  username: string;
  email: string;
  avatar?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

// OAuth Providers Configuration
const providers: Record<string, AuthProvider> = {
  github: {
    id: 'github',
    name: 'GitHub',
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['user:email', 'repo']
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'YOUR_MICROSOFT_CLIENT_ID',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['user.read', 'openid', 'profile', 'email']
  }
};

/**
 * Start OAuth flow - Opens browser for authentication
 */
export async function startOAuthFlow(providerId: 'github' | 'microsoft'): Promise<UserProfile> {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  try {
    // Generate random state for CSRF protection
    const state = generateRandomState();

    // Build authorization URL
    const authUrl = buildAuthUrl(provider, state);

    // Open browser and wait for callback
    const authCode = await invoke<string>('oauth_authenticate', {
      authUrl,
      callbackUrl: `http://localhost:1420/auth/${providerId}/callback`,
      state
    });

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(provider, authCode);

    // Get user profile
    const profile = await getUserProfile(provider, tokenData.access_token);

    // Save to storage
    const userProfile: UserProfile = {
      id: profile.id,
      provider: providerId,
      username: profile.login || profile.displayName,
      email: profile.email,
      avatar: profile.avatar_url || profile.photo,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined
    };

    await saveUserProfile(userProfile);

    return userProfile;
  } catch (error) {
    console.error('OAuth flow failed:', error);
    throw error;
  }
}

/**
 * Build OAuth authorization URL
 */
function buildAuthUrl(provider: AuthProvider, state: string): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: `http://localhost:1420/auth/${provider.id}/callback`,
    scope: provider.scopes.join(' '),
    state,
    response_type: 'code'
  });

  return `${provider.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * ⚠️ SECURITY: Token exchange now happens in backend (Rust)
 * Client secret never exposed to frontend!
 */
async function exchangeCodeForToken(provider: AuthProvider, code: string): Promise<any> {
  try {
    // Call Tauri backend command instead of direct API call
    const tokenData = await invoke('exchange_oauth_token', {
      code,
      provider: provider.id,
      redirectUri: `http://localhost:1420/auth/${provider.id}/callback`
    });

    return tokenData;
  } catch (error) {
    console.error('Token exchange failed:', error);
    throw new Error('Failed to exchange authorization code for token');
  }
}

/**
 * Get user profile from provider
 */
async function getUserProfile(provider: AuthProvider, accessToken: string): Promise<any> {
  let apiUrl = '';

  if (provider.id === 'github') {
    apiUrl = 'https://api.github.com/user';
  } else if (provider.id === 'microsoft') {
    apiUrl = 'https://graph.microsoft.com/v1.0/me';
  }

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get user profile');
  }

  return response.json();
}

/**
 * Generate random state for CSRF protection
 */
function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

import { storage } from './storage';

/**
 * Save user profile to storage
 */
async function saveUserProfile(profile: UserProfile): Promise<void> {
  const profiles = await getStoredProfiles();
  const existingIndex = profiles.findIndex(p => p.provider === profile.provider);

  if (existingIndex >= 0) {
    profiles[existingIndex] = profile;
  } else {
    profiles.push(profile);
  }

  await storage.setSecure('user_profiles', profiles);
}

/**
 * Get stored user profiles
 */
export async function getStoredProfiles(): Promise<UserProfile[]> {
  const stored = await storage.getSecure<UserProfile[]>('user_profiles');
  return stored || [];
}

/**
 * Get profile by provider
 */
export async function getProfileByProvider(providerId: 'github' | 'microsoft'): Promise<UserProfile | null> {
  const profiles = await getStoredProfiles();
  return profiles.find(p => p.provider === providerId) || null;
}

/**
 * Sign out from provider
 */
export async function signOut(providerId: 'github' | 'microsoft'): Promise<void> {
  const profiles = await getStoredProfiles();
  const filtered = profiles.filter(p => p.provider !== providerId);
  await storage.setSecure('user_profiles', filtered);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(profile: UserProfile): boolean {
  if (!profile.expiresAt) return false;
  return Date.now() >= profile.expiresAt;
}

/**
 * Refresh access token (for providers that support it)
 * ⚠️ SECURITY: Token refresh now happens in backend (Rust)
 */
export async function refreshAccessToken(profile: UserProfile): Promise<UserProfile> {
  if (!profile.refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    // Call Tauri backend command
    const tokenData = await invoke<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
    }>('refresh_oauth_token', {
      refreshToken: profile.refreshToken,
      provider: profile.provider
    });

    const updatedProfile: UserProfile = {
      ...profile,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || profile.refreshToken,
      expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined
    };

    saveUserProfile(updatedProfile);

    return updatedProfile;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }
}
