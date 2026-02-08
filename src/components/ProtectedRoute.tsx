import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasRequiredLevel, type PermissionLevel } from '@/services/ssoAuth';

interface ProtectedRouteProps {
  requiredLevel?: PermissionLevel;
  children?: React.ReactNode;
}

export function ProtectedRoute({ requiredLevel = 'view', children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, permissionLevel } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!hasRequiredLevel(permissionLevel, requiredLevel)) {
    return <Navigate to="/unauthorized" state={{ insufficientPermission: true }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
