import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  Settings,
  ExternalLink,
  HelpCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof FileSpreadsheet;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppLayout() {
  const { user, canManage, canCreate, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navGroups: NavGroup[] = [
    ...(canCreate ? [{
      label: 'Tạo & Quản Lý',
      items: [
        { to: '/', label: 'Tạo Đơn', icon: FileSpreadsheet },
        { to: '/customers', label: 'Khách Hàng', icon: Users },
      ],
    }] : []),
    {
      label: 'Phân Tích',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/batches', label: 'Quản Lý Batch', icon: Layers },
      ],
    },
    {
      label: 'Hệ Thống',
      items: [
        ...(canManage ? [
          { to: '/audit', label: 'Nhật ký', icon: FileText },
          { to: '/settings', label: 'Cài Đặt', icon: Settings },
        ] : []),
        { to: '/help', label: 'Hướng dẫn', icon: HelpCircle },
      ],
    },
  ];

  const renderNavLink = ({ to, label, icon: Icon }: NavItem) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          collapsed && 'justify-center px-0'
        )
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r bg-background sticky top-0 h-screen transition-all duration-200 z-50',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo / App name */}
        <div className="flex items-center h-14 border-b px-3 gap-2">
          <FileSpreadsheet className="h-6 w-6 shrink-0 text-primary" />
          {!collapsed && (
            <span className="font-semibold text-sm truncate">Tạo Đơn Tự Động</span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 p-2">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && (
                <div className={cn('my-2 border-t', collapsed && 'mx-2')} />
              )}
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </div>
              )}
              {group.items.map(renderNavLink)}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t p-2 space-y-1">
          {user && !collapsed && (
            <div className="px-3 py-1 text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className={cn('w-full justify-start gap-2', collapsed && 'justify-center px-0')}
            title={collapsed ? 'Thoát' : undefined}
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && 'Thoát'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-8"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
