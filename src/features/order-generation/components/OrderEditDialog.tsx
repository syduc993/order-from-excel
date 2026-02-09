import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/DatePicker';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface ProductRow {
    id: string;
    quantity: string;
    price: string;
}

interface OrderEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onSave: (orderId: number, updates: any) => Promise<void>;
}

export const OrderEditDialog = ({ open, onOpenChange, order, onSave }: OrderEditDialogProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
    const [scheduledTime, setScheduledTime] = useState('10:00');
    const [products, setProducts] = useState<ProductRow[]>([{ id: '', quantity: '1', price: '' }]);

    // Pre-fill form when order changes
    useEffect(() => {
        if (order && open) {
            setCustomerName(order.customer_name || '');
            setCustomerPhone(order.customer_phone || '');

            if (order.scheduled_time) {
                const d = new Date(order.scheduled_time);
                setScheduledDate(d);
                setScheduledTime(
                    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                );
            } else {
                setScheduledDate(undefined);
                setScheduledTime('10:00');
            }

            const orderProducts = order.order_data?.products;
            if (orderProducts && orderProducts.length > 0) {
                setProducts(
                    orderProducts.map((p: any) => ({
                        id: String(p.id ?? ''),
                        quantity: String(p.quantity ?? '1'),
                        price: String(p.price ?? ''),
                    }))
                );
            } else {
                setProducts([{ id: '', quantity: '1', price: '' }]);
            }
        }
    }, [order, open]);

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

    const handleSave = async () => {
        if (!customerName || !customerPhone) {
            return;
        }

        const validProducts = products.filter(p => p.id && Number(p.quantity) > 0 && Number(p.price) > 0);
        if (validProducts.length === 0) {
            return;
        }

        let scheduled_time: string | undefined;
        if (scheduledDate) {
            const [hours, minutes] = scheduledTime.split(':').map(Number);
            const scheduled = new Date(scheduledDate);
            scheduled.setHours(hours, minutes, 0, 0);
            scheduled_time = scheduled.toISOString();
        }

        const apiProducts = validProducts.map(p => ({
            id: Number(p.id),
            quantity: Number(p.quantity),
            price: Number(p.price),
        }));

        setIsSubmitting(true);
        try {
            await onSave(order.id, {
                customer_name: customerName,
                customer_phone: customerPhone,
                order_data: { ...order.order_data, products: apiProducts },
                scheduled_time,
                total_amount: totalAmount,
            });
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sửa Đơn Hàng #{order.order_index}</DialogTitle>
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
                    </div>

                    {/* Schedule */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Ngày giao</Label>
                            <DatePicker date={scheduledDate} onDateChange={(d) => setScheduledDate(d || undefined)} placeholder="Chọn ngày" />
                        </div>
                        <div className="space-y-1">
                            <Label>Giờ giao</Label>
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
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                        Lưu thay đổi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
