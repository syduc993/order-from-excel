import { useLocation } from 'react-router-dom';
import { ShieldX, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { env } from '@/config/env';

const Unauthorized = () => {
  const location = useLocation();
  const insufficientPermission = location.state?.insufficientPermission;

  const portalUrl = env.portal.backendUrl
    ? env.portal.backendUrl.replace('/api', '').replace('backend', '')
    : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center max-w-md mx-auto p-8">
        <ShieldX className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />

        {insufficientPermission ? (
          <>
            <h1 className="mb-3 text-2xl font-bold">Không đủ quyền truy cập</h1>
            <p className="mb-6 text-muted-foreground">
              Bạn không có quyền truy cập tính năng này. Vui lòng liên hệ quản trị viên để được cấp quyền.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-2xl font-bold">Vui lòng đăng nhập từ Portal</h1>
            <p className="mb-6 text-muted-foreground">
              Ứng dụng này yêu cầu xác thực qua hệ thống Portal. Vui lòng truy cập Portal và mở ứng dụng từ trang chủ.
            </p>
          </>
        )}

        {portalUrl && (
          <Button asChild>
            <a href={portalUrl}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Đi tới Portal
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};

export default Unauthorized;
