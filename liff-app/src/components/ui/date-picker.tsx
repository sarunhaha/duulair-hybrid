import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from './drawer';
import { Calendar, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" format
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minDate?: string;
  maxDate?: string;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543; // Convert to Buddhist Era
  return `${day} ${month} ${year}`;
}

export function DatePicker({ value, onChange, open, onOpenChange, minDate, maxDate }: DatePickerProps) {
  const today = new Date();
  const initialDate = value ? new Date(value) : today;

  const [viewYear, setViewYear] = React.useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = React.useState(value);

  // Reset view when opening
  React.useEffect(() => {
    if (open) {
      const date = value ? new Date(value) : today;
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
      setSelectedDate(value);
    }
  }, [open, value]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDate = (day: number) => {
    const dateStr = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onChange(selectedDate);
    }
    onOpenChange(false);
  };

  const handleToday = () => {
    const todayStr = today.toISOString().split('T')[0];
    setSelectedDate(todayStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const handleYesterday = () => {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    setSelectedDate(yesterdayStr);
    setViewYear(yesterday.getFullYear());
    setViewMonth(yesterday.getMonth());
  };

  // Generate calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const days: (number | null)[] = [];

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  // Check if a date is selectable
  const isDateSelectable = (day: number): boolean => {
    const dateStr = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    if (minDate && dateStr < minDate) return false;
    if (maxDate && dateStr > maxDate) return false;
    return true;
  };

  // Check if a date is today
  const isToday = (day: number): boolean => {
    return viewYear === today.getFullYear() &&
           viewMonth === today.getMonth() &&
           day === today.getDate();
  };

  // Check if a date is selected
  const isSelected = (day: number): boolean => {
    if (!selectedDate) return false;
    const dateStr = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex items-center justify-between px-4 border-b">
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </DrawerClose>
          <DrawerTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            เลือกวันที่
          </DrawerTitle>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-primary"
            onClick={handleConfirm}
          >
            <Check className="w-5 h-5" />
          </Button>
        </DrawerHeader>

        <div className="px-4 py-4">
          {/* Selected date display */}
          <div className="text-center mb-4">
            <span className="text-2xl font-bold text-foreground">
              {selectedDate ? formatThaiDate(selectedDate) : 'เลือกวันที่'}
            </span>
          </div>

          {/* Quick select buttons */}
          <div className="flex justify-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={handleToday}
            >
              วันนี้
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={handleYesterday}
            >
              เมื่อวาน
            </Button>
          </div>

          {/* Month/Year navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-semibold">
              {THAI_MONTHS[viewMonth]} {viewYear + 543}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleNextMonth}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {THAI_DAYS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  'text-center text-xs font-medium py-2',
                  i === 0 ? 'text-red-500' : 'text-muted-foreground'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const selectable = isDateSelectable(day);
              const selected = isSelected(day);
              const todayDate = isToday(day);
              const isSunday = (firstDay + day - 1) % 7 === 0;

              return (
                <button
                  key={day}
                  onClick={() => selectable && handleSelectDate(day)}
                  disabled={!selectable}
                  className={cn(
                    'aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    'active:scale-95',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : todayDate
                        ? 'bg-primary/20 text-primary font-bold'
                        : selectable
                          ? isSunday
                            ? 'text-red-500 hover:bg-muted'
                            : 'text-foreground hover:bg-muted'
                          : 'text-muted-foreground/30 cursor-not-allowed'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confirm button */}
        <div className="p-4 border-t">
          <Button
            className="w-full h-12 rounded-xl font-bold"
            onClick={handleConfirm}
            disabled={!selectedDate}
          >
            ยืนยันวันที่
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Simple date input that opens the DatePicker
interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
}

export function DateInput({ value, onChange, label, placeholder = 'เลือกวันที่', className, minDate, maxDate }: DateInputProps) {
  const [open, setOpen] = React.useState(false);

  const displayValue = value ? formatThaiDate(value) : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full h-11 px-3 rounded-md border border-input bg-background text-left text-sm',
          'flex items-center justify-between',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <span>{displayValue}</span>
        <Calendar className="w-4 h-4 text-muted-foreground" />
      </button>
      <DatePicker
        value={value}
        onChange={onChange}
        open={open}
        onOpenChange={setOpen}
        minDate={minDate}
        maxDate={maxDate}
      />
    </>
  );
}
