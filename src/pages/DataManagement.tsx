import { CustomerListManager } from '@/features/data-management/components/CustomerListManager';

const DataManagement = () => {
    return (
        <div className="container mx-auto p-6 space-y-6 max-w-5xl">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Quản Lý Khách Hàng</h1>
                <p className="text-muted-foreground">
                    Quản lý danh sách khách hàng dùng cho tạo đơn hàng. Import từ Excel hoặc thêm thủ công.
                </p>
            </div>

            <CustomerListManager />
        </div>
    );
};

export default DataManagement;
