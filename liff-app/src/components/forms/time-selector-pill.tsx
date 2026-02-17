import { useState } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { TimePicker } from '@/components/ui/time-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';

interface TimeSelectorPillProps {
  time: string; // "HH:mm" format
  onTimeChange: (time: string) => void;
  date?: string; // "YYYY-MM-DD" format
  onDateChange?: (date: string) => void;
  showDate?: boolean;
  className?: string;
}

function formatThaiDate(dateStr: string): string {
  const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  const d = new Date(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}

export function TimeSelectorPill({
  time,
  onTimeChange,
  date,
  onDateChange,
  showDate = false,
  className,
}: TimeSelectorPillProps) {
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleNow = () => {
    const now = new Date();
    onTimeChange(
      `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    );
    if (onDateChange) {
      const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      onDateChange(today);
    }
  };

  return (
    <>
      <div
        className={cn(
          'bg-muted/30 p-4 rounded-3xl flex items-center justify-between gap-3',
          className
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Time button */}
          <button
            type="button"
            onClick={() => setTimePickerOpen(true)}
            className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
          >
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <span className="text-lg font-bold font-mono">{time}</span>
            <span className="text-sm text-muted-foreground">น.</span>
          </button>

          {/* Date button (optional) */}
          {showDate && date && onDateChange && (
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{formatThaiDate(date)}</span>
            </button>
          )}
        </div>

        {/* "ตอนนี้" button */}
        <button
          type="button"
          onClick={handleNow}
          className="text-primary font-bold bg-white dark:bg-card shadow-sm rounded-xl px-4 h-9 text-sm hover:shadow-md transition-shadow shrink-0"
        >
          ตอนนี้
        </button>
      </div>

      {/* Drawers */}
      <TimePicker
        value={time}
        onChange={onTimeChange}
        open={timePickerOpen}
        onOpenChange={setTimePickerOpen}
      />
      {showDate && date && onDateChange && (
        <DatePicker
          value={date}
          onChange={onDateChange}
          open={datePickerOpen}
          onOpenChange={setDatePickerOpen}
        />
      )}
    </>
  );
}
