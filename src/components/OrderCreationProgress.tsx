import { CheckCircle2, Loader2, Circle, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface OrderCreationStep {
    id: string;
    label: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    detail?: string;
}

interface OrderCreationProgressProps {
    steps: OrderCreationStep[];
    subProgress?: {
        current: number;
        total: number;
    };
}

export const OrderCreationProgress = ({ steps, subProgress }: OrderCreationProgressProps) => {
    if (steps.length === 0) return null;

    const currentStep = steps.find(s => s.status === 'in_progress');

    return (
        <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
            <div className="text-sm font-medium">Đang tạo đơn hàng...</div>
            <div className="space-y-1.5">
                {steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-2.5">
                        {step.status === 'completed' && (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        {step.status === 'in_progress' && (
                            <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                        )}
                        {step.status === 'pending' && (
                            <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        {step.status === 'error' && (
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        )}

                        <span className={cn(
                            "text-sm",
                            step.status === 'completed' && "text-green-700",
                            step.status === 'in_progress' && "text-blue-700 font-medium",
                            step.status === 'pending' && "text-muted-foreground/60",
                            step.status === 'error' && "text-red-700",
                        )}>
                            {step.label}
                        </span>

                        {step.detail && (
                            <span className="text-xs text-muted-foreground ml-auto">
                                {step.detail}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {subProgress && subProgress.total > 0 && currentStep && (
                <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{currentStep.label}</span>
                        <span>{Math.round((subProgress.current / subProgress.total) * 100)}%</span>
                    </div>
                    <Progress value={(subProgress.current / subProgress.total) * 100} className="h-2" />
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                Vui lòng không đóng trang trong khi đang xử lý...
            </p>
        </div>
    );
};
