import { useState, useEffect } from 'react';
import { CustomerListItem, CustomerListItemInsert } from '@/types/dataManagement';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ItemEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Null = adding new, otherwise editing existing */
    item: CustomerListItem | null;
    onSave: (data: CustomerListItemInsert) => void;
    onUpdate: (itemId: number, data: Partial<CustomerListItemInsert>) => void;
}

export function ItemEditDialog({ open, onOpenChange, item, onSave, onUpdate }: ItemEditDialogProps) {
    const [customerId, setCustomerId] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');

    const isEditing = !!item;

    useEffect(() => {
        if (open) {
            if (item) {
                setCustomerId(item.customer_ext_id);
                setName(item.name);
                setPhone(item.phone);
            } else {
                setCustomerId('');
                setName('');
                setPhone('');
            }
            setError('');
        }
    }, [open, item]);

    const handleSubmit = () => {
        if (!customerId.trim() || !name.trim() || !phone.trim()) {
            setError('Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (isEditing && item?.id) {
            onUpdate(item.id, {
                customer_ext_id: customerId.trim(),
                name: name.trim(),
                phone: phone.trim(),
            });
        } else {
            onSave({
                customer_ext_id: customerId.trim(),
                name: name.trim(),
                phone: phone.trim(),
            });
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Sửa Khách Hàng' : 'Thêm Khách Hàng'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="cust-id">ID Khách Hàng</Label>
                        <Input
                            id="cust-id"
                            placeholder="VD: 12345"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cust-name">Họ Tên</Label>
                        <Input
                            id="cust-name"
                            placeholder="VD: Nguyễn Văn A"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cust-phone">Số Điện Thoại</Label>
                        <Input
                            id="cust-phone"
                            placeholder="VD: 0901234567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleSubmit}>{isEditing ? 'Lưu' : 'Thêm'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
