import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FileSpreadsheet, LayoutDashboard, Settings, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Tạo Đơn', icon: FileSpreadsheet },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function AppLayout() {
  const { user, canManage, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          {/* Left: App name */}
          <div className="font-semibold text-lg">
            Tạo Đơn Hàng Tự Động
          </div>

          {/* Center: Nav tabs */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            {canManage && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                <Settings className="h-4 w-4" />
                Cài Đặt
              </NavLink>
            )}
          </nav>

          {/* Right: User info */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Thoát
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
