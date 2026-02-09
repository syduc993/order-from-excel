import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/DatePicker';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { getSupabaseService } from '@/services/supabase';
import { useSettings } from '@/contexts/SettingsContext';

interface ManualOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    batchId: string;
    onSuccess: () => void;
}

interface ProductRow {
    id: string;
    quantity: string;
    price: string;
}

export const ManualOrderDialog = ({ open, onOpenChange, batchId, onSuccess }: ManualOrderDialogProps) => {
    const { settings } = useSettings();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    const [scheduledTime, setScheduledTime] = useState('10:00');
    const [products, setProducts] = useState<ProductRow[]>([{ id: '', quantity: '1', price: '' }]);

    const addProduct = () => {
        setProducts([...products, { id: '', quantity: '1', price: '' }]);
    };

    const removeProduct = (index: number) => {
        if (products.length <= 1) return;
        setProducts(products.filter((_, i) => i !== index));
    };

    const updateProduct = (index: number, field: keyof ProductRow, value: string) => {
        const updated = [...products];
        updated[index] = { ...updated[index], [field]: value };
        setProducts(updated);
    };

    const totalAmount = products.reduce((sum, p) => {
        return sum + (Number(p.quantity) || 0) * (Number(p.price) || 0);
    }, 0);

    const resetForm = () => {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerId('');
        setScheduledDate(new Date());
        setScheduledTime('10:00');
        setProducts([{ id: '', quantity: '1', price: '' }]);
    };

    const handleSubmit = async () => {
        if (!customerName || !customerPhone) {
            toast.error('Vui lòng nhập tên và SĐT khách hàng');
            return;
        }

        const validProducts = products.filter(p => p.id && Number(p.quantity) > 0 && Number(p.price) > 0);
        if (validProducts.length === 0) {
            toast.error('Vui lòng thêm ít nhất 1 sản phẩm hợp lệ');
            return;
        }

        if (totalAmount < settings.orderRules.minTotalAmount) {
            toast.error(`Tổng tiền phải >= ${settings.orderRules.minTotalAmount.toLocaleString()} VNĐ`);
            return;
        }

        if (!customerId || !Number(customerId)) {
            toast.error('Vui lòng nhập Customer ID (NhanhVN)');
            return;
        }

        if (!scheduledDate) {
            toast.error('Vui lòng chọn ngày giao');
            return;
        }

        setIsSubmitting(true);
        try {
            const service = getSupabaseService();
            if (!service) { toast.error('Supabase chưa cấu hình'); return; }
            const [hours, minutes] = scheduledTime.split(':').map(Number);
            const scheduled = new Date(scheduledDate);
            scheduled.setHours(hours, minutes, 0, 0);

            const custId = Number(customerId);
            const apiProducts = validProducts.map(p => ({
                id: Number(p.id),
                quantity: Number(p.quantity),
                price: Number(p.price),
            }));

            await service.saveOrdersToQueue(batchId, [{
                customerId: custId,
                customerName,
                customerPhone,
                orderData: {
                    depotId: settings.apiConfig.depotId,
                    customer: { id: custId },
                    products: apiProducts,
                    payment: { customerAmount: totalAmount },
                },
                scheduledTime: scheduled,
                totalAmount,
            }]);

            toast.success('Đã tạo đơn hàng thủ công (trạng thái: Nháp)');
            resetForm();
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tạo Đơn Hàng Thủ Công</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Customer info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Tên khách hàng *</Label>
                            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nguyễn Văn A" />
                        </div>
                        <div className="space-y-1">
                            <Label>SĐT *</Label>
                            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0901234567" />
                        </div>
                        <div className="space-y-1">
                            <Label>Customer ID (NhanhVN) *</Label>
                            <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="ID NhanhVN" type="number" />
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Ngày giao *</Label>
                            <DatePicker date={scheduledDate} onDateChange={(d) => setScheduledDate(d || undefined)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Giờ giao *</Label>
                            <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                        </div>
                    </div>

                    {/* Products */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Sản phẩm</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={addProduct}>
                                <Plus className="mr-1 h-3 w-3" /> Thêm SP
                            </Button>
                        </div>
                        {products.map((p, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <Input placeholder="ID SP" value={p.id} onChange={(e) => updateProduct(i, 'id', e.target.value)} className="w-28" />
                                <Input placeholder="SL" type="number" value={p.quantity} onChange={(e) => updateProduct(i, 'quantity', e.target.value)} className="w-20" />
                                <Input placeholder="Giá" type="number" value={p.price} onChange={(e) => updateProduct(i, 'price', e.target.value)} className="flex-1" />
                                {products.length > 1 && (
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(i)} className="h-8 w-8">
                                        <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">Tổng tiền:</span>
                        <span className="text-lg font-bold">{totalAmount.toLocaleString('vi-VN')} ₫</span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                        Tạo đơn nháp
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
