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
import { Check, Clock, X } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm" format
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Generate array of numbers with padding
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

// Simple time input that opens the TimePicker
interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function TimeInput({ value, onChange, placeholder = 'เลือกเวลา', className }: TimeInputProps) {
  const [open, setOpen] = React.useState(false);

  const displayValue = value ? `${value} น.` : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full h-11 px-3 rounded-xl border border-input bg-muted/20 text-left text-sm',
          'flex items-center justify-between whitespace-nowrap',
          'hover:bg-muted/40 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <span className="truncate">{displayValue}</span>
        <Clock className="w-4 h-4 text-primary/60 shrink-0 ml-1.5" />
      </button>
      <TimePicker
        value={value || '00:00'}
        onChange={onChange}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function TimePicker({ value, onChange, open, onOpenChange }: TimePickerProps) {
  const [hour, minute] = value.split(':');
  const [tempHour, setTempHour] = React.useState(hour || '00');
  const [tempMinute, setTempMinute] = React.useState(minute || '00');

  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  // Reset temp values when opening
  React.useEffect(() => {
    if (open) {
      const [h, m] = value.split(':');
      setTempHour(h || '00');
      setTempMinute(m || '00');
    }
  }, [open, value]);

  // Scroll to selected value when opening
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hourIndex = hours.indexOf(tempHour);
        const minuteIndex = minutes.indexOf(tempMinute);

        if (hourRef.current && hourIndex >= 0) {
          const itemHeight = 48;
          hourRef.current.scrollTop = hourIndex * itemHeight - (hourRef.current.clientHeight / 2) + (itemHeight / 2);
        }
        if (minuteRef.current && minuteIndex >= 0) {
          const itemHeight = 48;
          minuteRef.current.scrollTop = minuteIndex * itemHeight - (minuteRef.current.clientHeight / 2) + (itemHeight / 2);
        }
      }, 100);
    }
  }, [open, tempHour, tempMinute]);

  const handleConfirm = () => {
    onChange(`${tempHour}:${tempMinute}`);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="flex items-center justify-between px-4 border-b border-border">
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
              <X className="w-5 h-5" />
            </Button>
          </DrawerClose>
          <DrawerTitle className="flex items-center gap-2 text-foreground">
            <Clock className="w-5 h-5 text-primary" />
            เลือกเวลา
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

        <div className="px-4 py-6">
          {/* Selected time display */}
          <div className="text-center mb-6">
            <span className="text-5xl font-bold font-mono text-foreground">
              {tempHour}:{tempMinute}
            </span>
            <p className="text-sm text-muted-foreground mt-2">น.</p>
          </div>

          {/* Time picker wheels */}
          <div className="flex items-center justify-center gap-4">
            {/* Hour picker */}
            <div className="relative">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 rounded-2xl pointer-events-none z-0 border border-primary/10" />
              <div
                ref={hourRef}
                className="h-[192px] overflow-y-auto scrollbar-hide snap-y snap-mandatory relative z-10"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="h-[72px]" /> {/* Spacer */}
                {hours.map((h) => (
                  <button
                    key={h}
                    onClick={() => setTempHour(h)}
                    className={cn(
                      'w-20 h-12 flex items-center justify-center text-2xl font-mono snap-center transition-all',
                      tempHour === h
                        ? 'text-primary font-bold scale-110'
                        : 'text-muted-foreground/40'
                    )}
                  >
                    {h}
                  </button>
                ))}
                <div className="h-[72px]" /> {/* Spacer */}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">ชั่วโมง</p>
            </div>

            {/* Separator */}
            <span className="text-4xl font-bold text-primary/30 mb-6">:</span>

            {/* Minute picker */}
            <div className="relative">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 rounded-2xl pointer-events-none z-0 border border-primary/10" />
              <div
                ref={minuteRef}
                className="h-[192px] overflow-y-auto scrollbar-hide snap-y snap-mandatory relative z-10"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="h-[72px]" /> {/* Spacer */}
                {minutes.map((m) => (
                  <button
                    key={m}
                    onClick={() => setTempMinute(m)}
                    className={cn(
                      'w-20 h-12 flex items-center justify-center text-2xl font-mono snap-center transition-all',
                      tempMinute === m
                        ? 'text-primary font-bold scale-110'
                        : 'text-muted-foreground/40'
                    )}
                  >
                    {m}
                  </button>
                ))}
                <div className="h-[72px]" /> {/* Spacer */}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">นาที</p>
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {[
              { label: 'ตอนนี้', action: () => {
                const now = new Date();
                setTempHour(now.getHours().toString().padStart(2, '0'));
                setTempMinute(now.getMinutes().toString().padStart(2, '0'));
              }},
              { label: '06:00', action: () => { setTempHour('06'); setTempMinute('00'); }},
              { label: '08:00', action: () => { setTempHour('08'); setTempMinute('00'); }},
              { label: '12:00', action: () => { setTempHour('12'); setTempMinute('00'); }},
              { label: '18:00', action: () => { setTempHour('18'); setTempMinute('00'); }},
              { label: '21:00', action: () => { setTempHour('21'); setTempMinute('00'); }},
            ].map((item) => (
              <Button
                key={item.label}
                variant="outline"
                size="sm"
                className="rounded-full text-xs border-primary/20 text-primary hover:bg-primary/5"
                onClick={item.action}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <div className="p-4 border-t border-border">
          <Button
            className="w-full h-12 rounded-xl font-bold"
            onClick={handleConfirm}
          >
            ยืนยันเวลา {tempHour}:{tempMinute} น.
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
