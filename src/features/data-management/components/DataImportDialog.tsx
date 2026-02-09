import { useState } from 'react';
import ExcelJS from 'exceljs';
import { FileUploadZone } from '@/components/FileUploadZone';
import { parseCustomerFile } from '@/utils/excelProcessor';
import { validateCustomers } from '@/utils/validation';
import { customerToListItem } from '@/utils/dataConversion';
import { CustomerListItemInsert } from '@/types/dataManagement';
import { useSettings } from '@/contexts/SettingsContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, Loader2, Download } from 'lucide-react';

interface DataImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: CustomerListItemInsert[], onProgress?: (processed: number, total: number) => void) => Promise<number>;
}

export function DataImportDialog({ open, onOpenChange, onImport }: DataImportDialogProps) {
    const { settings } = useSettings();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isParsed, setIsParsed] = useState(false);
    const [parsedItems, setParsedItems] = useState<CustomerListItemInsert[]>([]);
    const [parseError, setParseError] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 });

    const reset = () => {
        setFile(null);
        setIsParsed(false);
        setParsedItems([]);
        setParseError('');
        setIsImporting(false);
        setIsLoading(false);
        setImportProgress({ processed: 0, total: 0 });
    };

    const handleFileUpload = async (uploadedFile: File) => {
        setFile(uploadedFile);
        setIsLoading(true);
        setParseError('');

        try {
            const customers = await parseCustomerFile(uploadedFile, settings.excelConfig.customerSheetName);
            const validation = validateCustomers(customers);

            if (!validation.valid) {
                setParseError(
                    `Lỗi validation (${validation.errors.length}): ${validation.errors.slice(0, 3).join('; ')}${validation.errors.length > 3 ? '...' : ''}`
                );
                return;
            }

            const items = customers.map(customerToListItem);
            setParsedItems(items);
            setIsParsed(true);
        } catch (error) {
            setParseError(`Lỗi đọc file: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        setIsImporting(true);
        setImportProgress({ processed: 0, total: parsedItems.length });
        try {
            const count = await onImport(parsedItems, (processed, total) => {
                setImportProgress({ processed, total });
            });
            if (count > 0) {
                onOpenChange(false);
                reset();
            }
        } finally {
            setIsImporting(false);
        }
    };

    const handleClose = (isOpen: boolean) => {
        if (isImporting) return;
        if (!isOpen) reset();
        onOpenChange(isOpen);
    };

    const handleDownloadTemplate = async () => {
        const sheetName = settings.excelConfig.customerSheetName;
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet(sheetName);

        ws.columns = [
            { header: 'ID', key: 'id', width: 12 },
            { header: 'Tên khách hàng', key: 'name', width: 30 },
            { header: 'Số điện thoại', key: 'phone', width: 18 },
        ];

        // Style header row
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add sample rows
        ws.addRow({ id: '1001', name: 'Nguyễn Văn A', phone: '0901234567' });
        ws.addRow({ id: '1002', name: 'Trần Thị B', phone: '0912345678' });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Template_${sheetName}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="sm:max-w-lg"
                onInteractOutside={(e) => { if (isImporting) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (isImporting) e.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle>Import Khách Hàng từ Excel</DialogTitle>
                    <DialogDescription>
                        Upload file Excel chứa danh sách khách hàng (sheet "{settings.excelConfig.customerSheetName}")
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <FileUploadZone
                        label="File Excel"
                        description="Cần có cột: ID, Tên, Điện thoại"
                        onFileUpload={handleFileUpload}
                        uploadedFile={file}
                        isLoading={isLoading}
                    />

                    {parseError && (
                        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{parseError}</span>
                        </div>
                    )}

                    {isParsed && parsedItems.length > 0 && !isImporting && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>
                                Đã đọc <Badge variant="secondary" className="mx-1">{parsedItems.length}</Badge> khách hàng.
                                Khách hàng trùng ID sẽ được cập nhật thông tin mới.
                            </span>
                        </div>
                    )}

                    {isImporting && (
                        <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                <span>
                                    Đang import... {importProgress.processed.toLocaleString()} / {importProgress.total.toLocaleString()} khách hàng
                                </span>
                            </div>
                            <Progress
                                value={importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}
                                className="h-2"
                            />
                            <p className="text-xs text-blue-500 text-right">
                                {importProgress.total > 0 ? Math.round((importProgress.processed / importProgress.total) * 100) : 0}%
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mr-auto text-muted-foreground"
                        onClick={handleDownloadTemplate}
                        disabled={isImporting}
                    >
                        <Download className="h-4 w-4 mr-1" />
                        Tải template mẫu
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>Hủy</Button>
                        <Button
                            onClick={handleImport}
                            disabled={!isParsed || parsedItems.length === 0 || isImporting}
                        >
                            {isImporting ? 'Đang import...' : `Import ${parsedItems.length} khách hàng`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
