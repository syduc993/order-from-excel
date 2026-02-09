import { useState, useEffect } from 'react';
import { useCustomerList } from '../hooks/useCustomerList';
import { ItemsTable } from './ItemsTable';
import { ItemEditDialog } from './ItemEditDialog';
import { DataImportDialog } from './DataImportDialog';
import { CustomerListItem, CustomerListItemInsert } from '@/types/dataManagement';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Plus, Trash2, RefreshCw, Users } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function CustomerListManager() {
    const { user } = useAuth();
    const { list, items, totalCount, isLoading, init, loadPage, reload, bulkImport, addItem, updateItem, deleteItem, deleteItems } = useCustomerList();

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingItem, setEditingItem] = useState<CustomerListItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    useEffect(() => {
        init(user?.email);
    }, [init, user?.email]);

    const handleEdit = (item: CustomerListItem) => {
        setEditingItem(item);
        setShowEditDialog(true);
    };

    const handleAdd = () => {
        setEditingItem(null);
        setShowEditDialog(true);
    };

    const handleDelete = (itemId: number) => {
        setDeletingItemId(itemId);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (deletingItemId) {
            await deleteItem(deletingItemId);
            setDeletingItemId(null);
        }
        setShowDeleteConfirm(false);
    };

    const handleBulkDelete = () => {
        if (selectedIds.length > 0) setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        await deleteItems(selectedIds);
        setSelectedIds([]);
        setShowBulkDeleteConfirm(false);
    };

    const handleSave = async (data: CustomerListItemInsert) => {
        await addItem(data);
    };

    const handleUpdate = async (itemId: number, data: Partial<CustomerListItemInsert>) => {
        await updateItem(itemId, data);
    };

    const handleImport = async (
        importItems: CustomerListItemInsert[],
        onProgress?: (processed: number, total: number) => void,
    ) => {
        return await bulkImport(importItems, onProgress);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <h2 className="text-lg font-semibold">Danh Sách Khách Hàng</h2>
                        <span className="text-sm text-muted-foreground">
                            {list ? (
                                <>
                                    <Badge variant="secondary" className="mr-1">{list.item_count}</Badge>
                                    khách hàng trong hệ thống
                                </>
                            ) : 'Đang tải...'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={reload} disabled={isLoading}>
                        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Tải lại
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        Import Excel
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Thêm KH
                    </Button>
                </div>
            </div>

            {/* Bulk actions bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">
                        Đã chọn <Badge>{selectedIds.length}</Badge> khách hàng
                    </span>
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Xóa đã chọn
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                        Bỏ chọn
                    </Button>
                </div>
            )}

            {/* Items table */}
            <ItemsTable
                items={items}
                totalItems={totalCount}
                isLoading={isLoading}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPageChange={loadPage}
            />

            {/* Dialogs */}
            <DataImportDialog
                open={showImportDialog}
                onOpenChange={setShowImportDialog}
                onImport={handleImport}
            />

            <ItemEditDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                item={editingItem}
                onSave={handleSave}
                onUpdate={handleUpdate}
            />

            {/* Delete confirmation */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Xóa</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk delete confirmation */}
            <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa {selectedIds.length} khách hàng?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmBulkDelete}>Xóa tất cả</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
