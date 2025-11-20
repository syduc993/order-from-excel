import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  label: string;
  description: string;
  onFileUpload: (file: File) => void;
  uploadedFile: File | null;
  accept?: Record<string, string[]>;
}

export const FileUploadZone = ({
  label,
  description,
  onFileUpload,
  uploadedFile,
  accept = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  },
}: FileUploadZoneProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileUpload(acceptedFiles[0]);
      }
    },
    [onFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
  });

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
          'hover:border-primary hover:bg-secondary/50',
          isDragActive && 'border-primary bg-secondary/50',
          uploadedFile && 'border-accent bg-accent/5'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          {uploadedFile ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-accent" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-2 justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? 'Thả file tại đây...' : 'Kéo thả file hoặc nhấp để chọn'}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
