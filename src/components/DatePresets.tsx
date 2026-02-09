import { Button } from '@/components/ui/button';
import { startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth } from 'date-fns';

interface DatePresetsProps {
  onSelect: (startDate: Date, endDate: Date, presetKey: string) => void;
  activePreset?: string | null;
}

export function DatePresets({ onSelect, activePreset }: DatePresetsProps) {
  const today = new Date();

  const presets = [
    {
      key: 'this-week',
      label: 'Tuần này',
      getRange: () => ({
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      }),
    },
    {
      key: 'next-week',
      label: 'Tuần sau',
      getRange: () => {
        const nextWeek = addWeeks(today, 1);
        return {
          start: startOfWeek(nextWeek, { weekStartsOn: 1 }),
          end: endOfWeek(nextWeek, { weekStartsOn: 1 }),
        };
      },
    },
    {
      key: 'this-month',
      label: 'Tháng này',
      getRange: () => ({
        start: startOfMonth(today),
        end: endOfMonth(today),
      }),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.key}
          variant={activePreset === preset.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            const { start, end } = preset.getRange();
            onSelect(start, end, preset.key);
          }}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
