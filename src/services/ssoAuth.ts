import { env } from '@/config/env';

// SSO User data extracted from portal token
export interface SSOUser {
  userId: string;
  email: string;
  role: string | null;
  permissions: string[];
}

export type PermissionLevel = 'view' | 'create' | 'manage';

const SSO_TOKEN_KEY = 'sso_token';
const SSO_USER_KEY = 'sso_user';

// Permission codes for this app (must match portal's permission codes)
const PERMISSION_PREFIX = 'order_excel.orders';

/**
 * Extract SSO token from URL query parameter
 */
export function extractTokenFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('sso_token');
}

/**
 * Remove SSO token from URL without page reload
 */
export function cleanTokenFromURL(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('sso_token');
  window.history.replaceState({}, '', url.toString());
}

/**
 * Verify SSO token with portal backend
 */
export async function verifyToken(token: string): Promise<SSOUser | null> {
  const portalUrl = env.portal.backendUrl;
  if (!portalUrl) {
    console.error('VITE_PORTAL_BACKEND_URL is not configured');
    return null;
  }

  try {
    const response = await fetch(`${portalUrl}/api/sso/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      console.error('SSO verify failed with status:', response.status);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data?.payload) {
      console.error('SSO verify failed:', result.error);
      return null;
    }

    const payload = result.data.payload;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  } catch (error) {
    console.error('SSO verify error:', error);
    return null;
  }
}

/**
 * Determine highest permission level from permission codes
 * manage > create > view (higher levels include lower levels)
 */
export function parsePermissionLevel(permissions: string[]): PermissionLevel | null {
  const hasManage = permissions.includes(`${PERMISSION_PREFIX}.manage`);
  const hasCreate = permissions.includes(`${PERMISSION_PREFIX}.create`);
  const hasView = permissions.includes(`${PERMISSION_PREFIX}.view`);

  // Also check system.full_access (admin bypass)
  const hasFullAccess = permissions.includes('system.full_access');

  if (hasFullAccess || hasManage) return 'manage';
  if (hasCreate) return 'create';
  if (hasView) return 'view';
  return null;
}

/**
 * Check if user has at least the required permission level
 */
export function hasRequiredLevel(
  userLevel: PermissionLevel | null,
  requiredLevel: PermissionLevel
): boolean {
  if (!userLevel) return false;
  const levels: PermissionLevel[] = ['view', 'create', 'manage'];
  return levels.indexOf(userLevel) >= levels.indexOf(requiredLevel);
}

/**
 * Save user session to localStorage
 */
export function saveSession(user: SSOUser, token: string): void {
  localStorage.setItem(SSO_USER_KEY, JSON.stringify(user));
  localStorage.setItem(SSO_TOKEN_KEY, token);
}

/**
 * Load user session from localStorage
 */
export function loadSession(): SSOUser | null {
  try {
    const userData = localStorage.getItem(SSO_USER_KEY);
    if (!userData) return null;
    return JSON.parse(userData) as SSOUser;
  } catch {
    return null;
  }
}

/**
 * Clear user session from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(SSO_USER_KEY);
  localStorage.removeItem(SSO_TOKEN_KEY);
}
