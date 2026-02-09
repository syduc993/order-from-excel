import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type SSOUser,
  type PermissionLevel,
  extractTokenFromURL,
  cleanTokenFromURL,
  verifyToken,
  parsePermissionLevel,
  hasRequiredLevel,
  saveSession,
  loadSession,
  clearSession,
} from '@/services/ssoAuth';

interface AuthContextValue {
  user: SSOUser | null;
  permissionLevel: PermissionLevel | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  canView: boolean;
  canCreate: boolean;
  canManage: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SSOUser | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      // DEV BYPASS: Skip SSO when VITE_DEV_BYPASS_AUTH=true in dev mode
      if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
        const devUser: SSOUser = {
          userId: 'dev-local',
          email: import.meta.env.VITE_DEV_USER_EMAIL || 'dev@localhost',
          role: 'admin',
          permissions: ['system.full_access'],
        };
        setUser(devUser);
        setPermissionLevel('manage');
        setIsLoading(false);
        return;
      }

      // Step 1: Check for SSO token in URL (new login from portal)
      const token = extractTokenFromURL();
      if (token) {
        const ssoUser = await verifyToken(token);
        if (ssoUser) {
          const level = parsePermissionLevel(ssoUser.permissions);
          if (level) {
            setUser(ssoUser);
            setPermissionLevel(level);
            saveSession(ssoUser, token);
            cleanTokenFromURL();
            return;
          }
        }
        // Token invalid, clean it
        cleanTokenFromURL();
      }

      // Step 2: Check localStorage for existing session
      const savedUser = loadSession();
      if (savedUser) {
        const level = parsePermissionLevel(savedUser.permissions);
        if (level) {
          setUser(savedUser);
          setPermissionLevel(level);
          return;
        }
      }

      // No valid session found
      setUser(null);
      setPermissionLevel(null);
    } catch (error) {
      console.error('Auth initialization error:', error);
      setUser(null);
      setPermissionLevel(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setPermissionLevel(null);
  }, []);

  const isAuthenticated = user !== null && permissionLevel !== null;

  const value: AuthContextValue = {
    user,
    permissionLevel,
    isAuthenticated,
    isLoading,
    canView: hasRequiredLevel(permissionLevel, 'view'),
    canCreate: hasRequiredLevel(permissionLevel, 'create'),
    canManage: hasRequiredLevel(permissionLevel, 'manage'),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
