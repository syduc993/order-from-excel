# Hướng dẫn tích hợp SSO với Portal (operations-manage-sys)

Tài liệu này ghi lại kinh nghiệm tích hợp SSO từ portal vào app con (React + Vite + Cloud Run).
Dùng làm template cho các dự án sau.

---

## Tổng quan kiến trúc

```
Portal (operations-manage-sys)          App con (ví dụ: order-from-excel)
┌─────────────────────────┐             ┌──────────────────────────┐
│ Frontend (React)        │             │ React + Vite SPA         │
│  - Hiện icon app        │             │  - Nhận ?sso_token=      │
│  - Click → SSO redirect │             │  - Verify với portal BE  │
│                         │             │  - Lưu session localStorage│
│ Backend (Express)       │             │  - Phân quyền UI         │
│  - POST /api/sso/token  │  ──token──> │                          │
│  - POST /api/sso/verify │  <──verify──│                          │
└─────────────────────────┘             └──────────────────────────┘
```

**Flow SSO:**
1. User click icon app trên portal
2. Portal frontend gọi `POST /api/sso/token` với `{ app: 'ten-app' }`
3. Backend tạo HMAC-SHA256 token chứa: userId, email, role, permissions, timestamp
4. Portal redirect sang `{APP_URL}?sso_token={token}`
5. App nhận token → gọi `POST {PORTAL_BACKEND}/api/sso/verify` để xác thực
6. Backend verify chữ ký + hạn token → trả về user data + permissions
7. App lưu session vào localStorage, xóa token khỏi URL

---

## Bên App con cần làm gì

### 1. Thêm env var

```env
# .env (bake vào Docker build, repo private nên OK)
VITE_PORTAL_BACKEND_URL=https://operations-manage-backend-858039461446.asia-southeast1.run.app
```

```typescript
// src/config/env.ts
export const env = {
  // ... các env khác
  portal: {
    backendUrl: import.meta.env.VITE_PORTAL_BACKEND_URL || '',
  },
};
```

### 2. Tạo SSO service (`src/services/ssoAuth.ts`)

```typescript
import { env } from '@/config/env';

export interface SSOUser {
  userId: string;
  email: string;
  role: string | null;
  permissions: string[];
}

export type PermissionLevel = 'view' | 'create' | 'manage';

const SSO_TOKEN_KEY = 'sso_token';
const SSO_USER_KEY = 'sso_user';

// *** THAY ĐỔI CHO TỪNG APP ***
const PERMISSION_PREFIX = 'ten_app.module_name';  // ví dụ: 'order_excel.orders'

export function extractTokenFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('sso_token');
}

export function cleanTokenFromURL(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('sso_token');
  window.history.replaceState({}, '', url.toString());
}

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

    if (!response.ok) return null;

    const result = await response.json();
    if (!result.success || !result.data?.payload) return null;

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

export function parsePermissionLevel(permissions: string[]): PermissionLevel | null {
  const hasFullAccess = permissions.includes('system.full_access');
  const hasManage = permissions.includes(`${PERMISSION_PREFIX}.manage`);
  const hasCreate = permissions.includes(`${PERMISSION_PREFIX}.create`);
  const hasView = permissions.includes(`${PERMISSION_PREFIX}.view`);

  if (hasFullAccess || hasManage) return 'manage';
  if (hasCreate) return 'create';
  if (hasView) return 'view';
  return null;
}

export function hasRequiredLevel(
  userLevel: PermissionLevel | null,
  requiredLevel: PermissionLevel
): boolean {
  if (!userLevel) return false;
  const levels: PermissionLevel[] = ['view', 'create', 'manage'];
  return levels.indexOf(userLevel) >= levels.indexOf(requiredLevel);
}

export function saveSession(user: SSOUser, token: string): void {
  localStorage.setItem(SSO_USER_KEY, JSON.stringify(user));
  localStorage.setItem(SSO_TOKEN_KEY, token);
}

export function loadSession(): SSOUser | null {
  try {
    const userData = localStorage.getItem(SSO_USER_KEY);
    if (!userData) return null;
    return JSON.parse(userData) as SSOUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SSO_USER_KEY);
  localStorage.removeItem(SSO_TOKEN_KEY);
}
```

### 3. Tạo AuthContext (`src/contexts/AuthContext.tsx`)

```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type SSOUser, type PermissionLevel,
  extractTokenFromURL, cleanTokenFromURL, verifyToken,
  parsePermissionLevel, hasRequiredLevel,
  saveSession, loadSession, clearSession,
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
      // 1. Check URL token (mới login từ portal)
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
        cleanTokenFromURL();
      }

      // 2. Check localStorage (session cũ)
      const savedUser = loadSession();
      if (savedUser) {
        const level = parsePermissionLevel(savedUser.permissions);
        if (level) {
          setUser(savedUser);
          setPermissionLevel(level);
          return;
        }
      }

      // Không có session
      setUser(null);
      setPermissionLevel(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setPermissionLevel(null);
  }, []);

  const isAuthenticated = user !== null && permissionLevel !== null;

  return (
    <AuthContext.Provider value={{
      user, permissionLevel, isAuthenticated, isLoading,
      canView: hasRequiredLevel(permissionLevel, 'view'),
      canCreate: hasRequiredLevel(permissionLevel, 'create'),
      canManage: hasRequiredLevel(permissionLevel, 'manage'),
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### 4. Tạo ProtectedRoute (`src/components/ProtectedRoute.tsx`)

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { PermissionLevel } from '@/services/ssoAuth';
import { hasRequiredLevel } from '@/services/ssoAuth';

interface Props {
  requiredLevel?: PermissionLevel;
}

export function ProtectedRoute({ requiredLevel = 'view' }: Props) {
  const { isAuthenticated, isLoading, permissionLevel } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/unauthorized" replace />;
  if (!hasRequiredLevel(permissionLevel, requiredLevel)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
```

### 5. Tạo trang Unauthorized (`src/pages/Unauthorized.tsx`)

Trang hiển thị khi chưa đăng nhập hoặc không đủ quyền.

### 6. Setup routes (`src/App.tsx`)

```typescript
<AuthProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route element={<ProtectedRoute requiredLevel="view" />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<MainPage />} />
          {/* Route cần quyền cao hơn */}
          <Route element={<ProtectedRoute requiredLevel="manage" />}>
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
</AuthProvider>
```

### 7. Dùng permission trong UI

```typescript
const { canCreate, canManage, user } = useAuth();

// Ẩn nút nếu không đủ quyền
{canCreate && <Button>Tạo mới</Button>}
{canManage && <Link to="/settings">Cài đặt</Link>}
```

---

## Bên Portal cần làm gì

### 1. SQL Migration — Đăng ký permissions + app

```sql
-- 1. Tạo permissions (pattern: {module}.{submodule}.{level})
INSERT INTO public.permissions (code, name, module, description) VALUES
  ('ten_app.module.view', 'Xem ...', 'ten_app', 'Mo ta...'),
  ('ten_app.module.create', 'Tao ...', 'ten_app', 'Mo ta...'),
  ('ten_app.module.manage', 'Quan ly ...', 'ten_app', 'Mo ta...')
ON CONFLICT (code) DO NOTHING;

-- 2. Tạo module trên portal
INSERT INTO public.app_modules (name, icon_name, sort_order, is_visible)
SELECT 'Tên Module', 'IconName', 60, true
WHERE NOT EXISTS (SELECT 1 FROM public.app_modules WHERE name = 'Tên Module');

-- 3. Đăng ký app (URL dùng prefix sso:// để trigger SSO flow)
INSERT INTO public.portal_apps (name, icon_name, url, module_id, sort_order, is_visible, open_in_new_tab)
SELECT 'Tên App', 'IconName', 'sso://ten-app', id, 1, true, true
FROM public.app_modules WHERE name = 'Tên Module'
AND NOT EXISTS (SELECT 1 FROM public.portal_apps WHERE name = 'Tên App');

-- 4. Gán permissions cho roles
INSERT INTO public.role_permissions (role_code, permission_code)
SELECT 'store.manager', code
FROM (VALUES ('ten_app.module.view'), ('ten_app.module.create'), ('ten_app.module.manage')) AS v(code)
WHERE EXISTS (SELECT 1 FROM public.roles WHERE code = 'store.manager')
ON CONFLICT (role_code, permission_code) DO NOTHING;
```

Chạy migration: `supabase db push`

### 2. SSO Service — Thêm URL mapping

File: `backend/src/features/sso/sso.service.ts`

```typescript
// Trong hàm getAppUrl(), thêm vào appUrls:
const appUrls: Record<string, string> = {
  'hr-system': process.env.HR_SYSTEM_URL || '...',
  'ten-app': process.env.TEN_APP_URL || 'https://ten-app-xxx.asia-southeast1.run.app',
};
```

### 3. Backend .env — Thêm config

```env
SSO_ALLOWED_APPS=hr-system,ten-app          # thêm app mới vào danh sách
TEN_APP_URL=https://ten-app-xxx.run.app     # URL Cloud Run của app
```

### 4. Frontend — Thêm permission flags

File: `frontend/client/src/features/auth/hooks/usePermission.ts`

```typescript
// Trong PERMISSIONS object:
TEN_APP: {
  MODULE: {
    VIEW: 'ten_app.module.view',
    CREATE: 'ten_app.module.create',
    MANAGE: 'ten_app.module.manage',
  },
},

// Trong return object:
canViewTenApp: checkAccess('ten_app.module', 'view'),
canCreateTenApp: checkAccess('ten_app.module', 'create'),
canManageTenApp: checkAccess('ten_app.module', 'manage'),
```

File: `frontend/client/src/features/auth/types.ts` — thêm vào MODULE_CONFIG

File: `frontend/client/src/features/portal/config/appPermissions.ts`

```typescript
// APP_PERMISSION_RULES:
'Tên App': (p) => p.canViewTenApp,

// MODULE_PERMISSION_RULES:
'Tên Module': (p) => p.canViewTenApp,
```

---

## Deploy checklist

### App con:
- [ ] Code SSO auth (ssoAuth.ts, AuthContext, ProtectedRoute, Unauthorized)
- [ ] Set `VITE_PORTAL_BACKEND_URL` trong `.env`
- [ ] Dockerfile + nginx.conf (SPA fallback `try_files $uri /index.html`)
- [ ] Git push → Cloud Build auto deploy

### Portal:
- [ ] SQL migration: permissions + app_modules + portal_apps + role_permissions
- [ ] `supabase db push`
- [ ] `sso.service.ts`: thêm URL mapping
- [ ] `usePermission.ts`: thêm PERMISSIONS + return flags
- [ ] `types.ts`: thêm MODULE_CONFIG
- [ ] `appPermissions.ts`: thêm APP + MODULE rules
- [ ] `backend/.env`: thêm SSO_ALLOWED_APPS + APP_URL
- [ ] Git push → Cloud Build auto deploy

---

## Lưu ý quan trọng

1. **Vite bake env lúc build**: `VITE_*` vars được nhúng vào JS bundle lúc `npm run build`. Đặt trong `.env` là đủ (repo private).

2. **URL app trên portal dùng prefix `sso://`**: Portal frontend nhận diện URL bắt đầu bằng `sso://` để trigger SSO flow thay vì redirect thẳng.

3. **Permission hierarchy**: `manage > create > view`. User có `manage` tự động có `create` và `view`. Code trong `hasRequiredLevel()` xử lý logic này.

4. **system.full_access**: Admin portal có permission `system.full_access` — app nên check cái này để auto-grant quyền cao nhất.

5. **Token 1 lần**: SSO token chỉ dùng 1 lần, hết hạn sau vài phút. Sau khi verify thành công, lưu user data vào localStorage.

6. **CORS**: Portal backend đã config CORS cho phép tất cả origins. Nếu gặp lỗi CORS, check backend CORS config.

7. **Cloud Run region**: Dùng `asia-southeast1` cho tất cả services. Tránh tạo ở region khác (có thể bị quota exceeded).
