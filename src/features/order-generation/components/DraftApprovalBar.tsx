import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, FileCheck, Loader2, Trash2 } from 'lucide-react';

interface DraftApprovalBarProps {
    draftCount: number;
    selectedIds: number[];
    batchId: string;
    isLoading: boolean;
    onApproveAll: (batchId: string) => Promise<number>;
    onApproveSelected: (ids: number[]) => Promise<number>;
    onDeleteSelected?: (ids: number[]) => Promise<number>;
}

export const DraftApprovalBar = ({
    draftCount,
    selectedIds,
    batchId,
    isLoading,
    onApproveAll,
    onApproveSelected,
    onDeleteSelected,
}: DraftApprovalBarProps) => {
    if (draftCount <= 0) return null;

    return (
        <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">
                    {draftCount} đơn nháp đang chờ duyệt
                </span>
                {selectedIds.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                        Đã chọn: {selectedIds.length}
                    </Badge>
                )}
            </div>

            <div className="flex gap-2">
                {selectedIds.length > 0 && onDeleteSelected && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                                Xóa đã chọn ({selectedIds.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bạn sẽ xóa vĩnh viễn {selectedIds.length} đơn. Hành động này không thể hoàn tác.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => onDeleteSelected(selectedIds)}
                                >
                                    Xóa {selectedIds.length} đơn
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}

                {selectedIds.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                                Duyệt đã chọn ({selectedIds.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận duyệt đơn hàng</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bạn sắp duyệt {selectedIds.length} đơn hàng đã chọn. Các đơn này sẽ chuyển sang trạng thái "Đang chờ" và được Cloud Run xử lý tự động.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onApproveSelected(selectedIds)}>
                                    Duyệt {selectedIds.length} đơn
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700">
                            {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                            Duyệt tất cả
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Xác nhận duyệt tất cả</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bạn sắp duyệt tất cả {draftCount} đơn nháp trong batch này. Các đơn sẽ chuyển sang trạng thái "Đang chờ" và được Cloud Run xử lý tự động theo lịch trình.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onApproveAll(batchId)}>
                                Duyệt tất cả {draftCount} đơn
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};
