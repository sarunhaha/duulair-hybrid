import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Plus,
  Bell,
  Edit2,
  Trash2,
  Loader2,
  X,
  Save,
  Pill,
  Droplet,
  Heart,
  Utensils,
  Footprints,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  usePatientReminders,
  usePatientMedicationsAll,
  useAddReminder,
  useUpdateReminder,
  useDeleteReminder,
  type Reminder,
} from '@/lib/api/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

const REMINDER_TYPES = [
  { value: 'medication', label: 'กินยา', icon: Pill, color: 'bg-purple-500/10 text-purple-500' },
  { value: 'water', label: 'ดื่มน้ำ', icon: Droplet, color: 'bg-blue-500/10 text-blue-500' },
  { value: 'vitals', label: 'วัดความดัน', icon: Heart, color: 'bg-red-500/10 text-red-500' },
  { value: 'food', label: 'ทานอาหาร', icon: Utensils, color: 'bg-orange-500/10 text-orange-500' },
  { value: 'exercise', label: 'ออกกำลังกาย', icon: Footprints, color: 'bg-green-500/10 text-green-500' },
];

// Category tabs — no "ทั้งหมด", start from first category
const CATEGORY_TABS = REMINDER_TYPES.map(t => ({ value: t.value, label: t.label, icon: t.icon }));

const DAY_OPTIONS = [
  { value: 'monday', label: 'จ', fullLabel: 'จันทร์' },
  { value: 'tuesday', label: 'อ', fullLabel: 'อังคาร' },
  { value: 'wednesday', label: 'พ', fullLabel: 'พุธ' },
  { value: 'thursday', label: 'พฤ', fullLabel: 'พฤหัสบดี' },
  { value: 'friday', label: 'ศ', fullLabel: 'ศุกร์' },
  { value: 'saturday', label: 'ส', fullLabel: 'เสาร์' },
  { value: 'sunday', label: 'อา', fullLabel: 'อาทิตย์' },
];

// Preset time slots
const TIME_PRESETS = [
  { label: 'เช้า', time: '08:00' },
  { label: 'กลางวัน', time: '12:00' },
  { label: 'เย็น', time: '18:00' },
  { label: 'ก่อนนอน', time: '21:00' },
];

interface ReminderForm {
  type: string;
  title: string;
  time: string;
  note: string;
  frequency: 'daily' | 'specific_days';
  days_of_week: string[];
  is_active: boolean;
}

const defaultFormData: ReminderForm = {
  type: 'medication',
  title: '',
  time: '08:00',
  note: '',
  frequency: 'daily',
  days_of_week: [],
  is_active: true,
};

// Dynamic placeholder per category
const getPlaceholder = (cat: string) => {
  switch (cat) {
    case 'medication': return 'พิมพ์ชื่อยาอื่นๆ...';
    case 'water': return 'เช่น ดื่มน้ำ 1 แก้ว';
    case 'vitals': return 'เช่น วัดความดันเช้า';
    case 'food': return 'เช่น ทานอาหารเช้า';
    case 'exercise': return 'เช่น เดินออกกำลังกาย';
    default: return 'ชื่อกิจกรรม';
  }
};

// Category-specific empty state message
const getEmptyMessage = (cat: string) => {
  switch (cat) {
    case 'medication': return 'ยังไม่มีเตือนกินยา';
    case 'water': return 'ยังไม่มีเตือนดื่มน้ำ';
    case 'vitals': return 'ยังไม่มีเตือนวัดความดัน';
    case 'food': return 'ยังไม่มีเตือนทานอาหาร';
    case 'exercise': return 'ยังไม่มีเตือนออกกำลังกาย';
    default: return 'ยังไม่มีการเตือน';
  }
};

export default function RemindersPage() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { toast } = useToast();
  const ensurePatient = useEnsurePatient();

  const patientId = ensurePatient.patientId;

  // Auto-ensure patient on mount
  const [hasEnsured, setHasEnsured] = useState(false);
  if (!auth.isLoading && !ensurePatient.isLoading && !patientId && !hasEnsured) {
    setHasEnsured(true);
    ensurePatient.ensurePatient();
  }

  const { data: reminders, isLoading } = usePatientReminders(patientId);
  const { data: medications } = usePatientMedicationsAll(patientId);
  const addReminder = useAddReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  // Category tab state — default to first category (medication)
  const [activeCategory, setActiveCategory] = useState<string>('medication');

  // Inline add form state
  const [addTitle, setAddTitle] = useState('');
  const [addTimes, setAddTimes] = useState<string[]>(['08:00']);
  const [selectedMedId, setSelectedMedId] = useState<string>(''); // for medication picker
  const [showMedPicker, setShowMedPicker] = useState(false);

  // Edit drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ReminderForm>(defaultFormData);

  // Filtered reminders by active category
  const filteredReminders = useMemo(() => {
    if (!reminders) return [];
    return reminders.filter(r => r.type === activeCategory);
  }, [reminders, activeCategory]);

  // Count per category for badge
  const categoryCounts = useMemo(() => {
    if (!reminders) return {};
    const counts: Record<string, { active: number; total: number }> = {};
    for (const r of reminders) {
      if (!counts[r.type]) counts[r.type] = { active: 0, total: 0 };
      counts[r.type].total++;
      if (r.is_active) counts[r.type].active++;
    }
    return counts;
  }, [reminders]);

  // Active medications list for the picker
  const activeMeds = useMemo(() => {
    if (!medications) return [];
    return medications.filter(m => m.active);
  }, [medications]);

  // Add time slot
  const handleAddTimeSlot = () => {
    // Add next logical time
    const lastTime = addTimes[addTimes.length - 1];
    const [h] = lastTime.split(':').map(Number);
    const nextHour = Math.min(h + 4, 23);
    const nextTime = `${nextHour.toString().padStart(2, '0')}:00`;
    if (!addTimes.includes(nextTime)) {
      setAddTimes([...addTimes, nextTime]);
    }
  };

  // Remove time slot
  const handleRemoveTimeSlot = (index: number) => {
    if (addTimes.length <= 1) return;
    setAddTimes(addTimes.filter((_, i) => i !== index));
  };

  // Select medication from list
  const handleSelectMed = (medName: string) => {
    setAddTitle(medName);
    setSelectedMedId('');
    setShowMedPicker(false);
  };

  // Inline add handler — creates one reminder per time slot
  const handleInlineAdd = async () => {
    if (!patientId || !addTitle.trim() || addTimes.length === 0) return;
    try {
      // Create one reminder for each time slot
      for (const time of addTimes) {
        await addReminder.mutateAsync({
          type: activeCategory,
          title: addTitle.trim(),
          time: time,
          custom_time: time,
          patient_id: patientId,
          is_active: true,
          frequency: 'daily',
        });
      }
      setAddTitle('');
      setAddTimes(['08:00']);
      setSelectedMedId('');
      toast({
        title: addTimes.length > 1
          ? `เพิ่ม ${addTimes.length} การเตือนเรียบร้อยแล้ว`
          : 'เพิ่มการเตือนเรียบร้อยแล้ว',
      });
    } catch {
      toast({ title: 'ไม่สามารถเพิ่มการเตือนได้', variant: 'destructive' });
    }
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setFormData({
      type: reminder.type,
      title: reminder.title,
      time: reminder.custom_time || reminder.time || '08:00',
      note: reminder.note || '',
      frequency: reminder.frequency === 'specific_days' ? 'specific_days' : 'daily',
      days_of_week: reminder.days_of_week || [],
      is_active: reminder.is_active,
    });
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    if (!confirm('ต้องการลบการเตือนนี้หรือไม่?')) return;

    try {
      await deleteReminder.mutateAsync({ id, patientId });
      toast({ title: 'ลบการเตือนเรียบร้อยแล้ว' });
    } catch {
      toast({ title: 'ไม่สามารถลบการเตือนได้', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (reminder: Reminder) => {
    if (!patientId) return;

    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        data: { is_active: !reminder.is_active, patient_id: patientId },
      });
    } catch {
      toast({ title: 'ไม่สามารถเปลี่ยนสถานะได้', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!patientId) {
      toast({ title: 'กรุณาคุยกับน้องอุ่นใน LINE Chat ก่อนนะคะ', variant: 'destructive' });
      return;
    }
    if (!formData.title.trim()) {
      toast({ title: 'กรุณาระบุชื่อเตือน', variant: 'destructive' });
      return;
    }
    if (!formData.time) {
      toast({ title: 'กรุณาระบุเวลาเตือน', variant: 'destructive' });
      return;
    }
    if (formData.frequency === 'specific_days' && formData.days_of_week.length === 0) {
      toast({ title: 'กรุณาเลือกวันที่ต้องการเตือน', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await updateReminder.mutateAsync({
          id: editingId,
          data: {
            ...formData,
            custom_time: formData.time,
            days_of_week: formData.frequency === 'specific_days' ? formData.days_of_week : undefined,
            patient_id: patientId,
          },
        });
        toast({ title: 'แก้ไขการเตือนเรียบร้อยแล้ว' });
      }
      setDrawerOpen(false);
    } catch {
      toast({ title: 'ไม่สามารถบันทึกการเตือนได้', variant: 'destructive' });
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const getTypeConfig = (type: string) => {
    return REMINDER_TYPES.find((t) => t.value === type) || REMINDER_TYPES[0];
  };

  // Show minimal loading state only while auth is checking
  if (auth.isLoading) {
    return (
      <div className="min-h-screen pb-8 font-sans bg-background">
        <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">ตั้งเวลาเตือน</h1>
        </header>

        <main className="max-w-md mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        </main>
      </div>
    );
  }

  const activeTypeConfig = getTypeConfig(activeCategory);

  return (
    <div className="min-h-screen pb-8 font-sans bg-background">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">ตั้งเวลาเตือน</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Category Tabs — scrollable pills (no "ทั้งหมด") */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.value;
            const count = categoryCounts[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => setActiveCategory(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                    : 'bg-card text-muted-foreground border-border'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {count && count.total > 0 && (
                  <span className={cn(
                    'ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none',
                    isActive ? 'bg-white/20' : 'bg-muted'
                  )}>
                    {count.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Card */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', activeTypeConfig.color)}>
                <activeTypeConfig.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">เตือน{activeTypeConfig.label}</p>
                <p className="text-xs text-muted-foreground">
                  {activeCategory === 'medication' && 'ตั้งเตือนเวลากินยา'}
                  {activeCategory === 'water' && 'ตั้งเตือนดื่มน้ำระหว่างวัน'}
                  {activeCategory === 'vitals' && 'ตั้งเตือนวัดความดัน ชีพจร'}
                  {activeCategory === 'food' && 'ตั้งเตือนเวลาทานอาหาร'}
                  {activeCategory === 'exercise' && 'ตั้งเตือนเวลาออกกำลังกาย'}
                </p>
              </div>
              {filteredReminders.length > 0 && (
                <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                  {filteredReminders.filter(r => r.is_active).length}/{filteredReminders.length}
                </span>
              )}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredReminders.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-12 h-12 mb-3 bg-muted/50 rounded-full flex items-center justify-center">
                  <activeTypeConfig.icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{getEmptyMessage(activeCategory)}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">เพิ่มการเตือนด้านล่างได้เลย</p>
              </div>
            )}

            {/* Reminder List */}
            {filteredReminders.length > 0 && (
              <div className="space-y-2">
                {filteredReminders.map((reminder) => {
                  const typeConfig = getTypeConfig(reminder.type);
                  const Icon = typeConfig.icon;
                  const displayTime = reminder.custom_time || reminder.time;
                  const freqText = reminder.frequency === 'daily'
                    ? 'ทุกวัน'
                    : reminder.frequency === 'specific_days' && reminder.days_of_week
                      ? reminder.days_of_week.map(d => DAY_OPTIONS.find(opt => opt.value === d)?.label).join(' ')
                      : 'ตามกำหนด';

                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'bg-muted/20 p-3 rounded-xl space-y-2 transition-opacity',
                        !reminder.is_active && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('p-1.5 rounded-lg shrink-0', typeConfig.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{reminder.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-semibold text-primary">{displayTime} น.</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-xs text-muted-foreground">{freqText}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={reminder.is_active}
                            onCheckedChange={() => handleToggleActive(reminder)}
                            className="scale-75"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => handleOpenEdit(reminder)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleDelete(reminder.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {reminder.note && (
                        <div className="text-[11px] text-muted-foreground bg-accent/5 border-l-2 border-accent/30 px-2 py-1 rounded ml-9">
                          {reminder.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Inline Add Form ── */}
            <div className="border-t border-border pt-4 space-y-3">

              {/* Medication picker — only for กินยา tab */}
              {activeCategory === 'medication' && (
                <div className="space-y-2">
                  {/* Medication selector from patient's list */}
                  {activeMeds.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowMedPicker(!showMedPicker)}
                        className={cn(
                          'w-full h-10 px-3 rounded-xl border border-input bg-muted/20 text-left text-sm',
                          'flex items-center justify-between',
                          'hover:bg-muted/40 transition-colors',
                          !addTitle && 'text-muted-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4 text-purple-500" />
                          <span>{addTitle || 'เลือกยาจากรายการ...'}</span>
                        </div>
                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showMedPicker && 'rotate-180')} />
                      </button>

                      {/* Dropdown */}
                      {showMedPicker && (
                        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                          <div className="max-h-[180px] overflow-y-auto">
                            {activeMeds.map((med) => (
                              <button
                                key={med.id}
                                type="button"
                                onClick={() => handleSelectMed(med.name)}
                                className={cn(
                                  'w-full px-3 py-2.5 text-left text-sm hover:bg-muted/40 transition-colors flex items-center gap-2',
                                  addTitle === med.name && 'bg-primary/5 text-primary font-bold'
                                )}
                              >
                                <Pill className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="truncate">{med.name}</span>
                                  {med.dosage && (
                                    <span className="text-[11px] text-muted-foreground ml-1.5">{med.dosage}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                          {/* "อื่นๆ" option to type custom */}
                          <div className="border-t border-border">
                            <button
                              type="button"
                              onClick={() => {
                                setAddTitle('');
                                setShowMedPicker(false);
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40 transition-colors flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5 shrink-0" />
                              พิมพ์ชื่อยาอื่นๆ...
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Free-text input for medication — shown when no meds list or after selecting "อื่นๆ" */}
                  {(activeMeds.length === 0 || (!showMedPicker && !addTitle)) && (
                    <Input
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      placeholder={getPlaceholder(activeCategory)}
                      className="h-10 rounded-xl text-sm"
                    />
                  )}
                </div>
              )}

              {/* Title input — for non-medication categories */}
              {activeCategory !== 'medication' && (
                <Input
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder={getPlaceholder(activeCategory)}
                  className="h-10 rounded-xl text-sm"
                />
              )}

              {/* Time slots section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    เวลาเตือน ({addTimes.length} รอบ/วัน)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary/80 px-2 shrink-0 whitespace-nowrap"
                    onClick={handleAddTimeSlot}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    เพิ่มรอบ
                  </Button>
                </div>

                {/* Time slot list */}
                <div className="flex flex-wrap gap-2">
                  {addTimes.map((time, index) => (
                    <div key={index} className="flex items-center bg-muted/30 rounded-xl pr-1.5">
                      <TimeInput
                        value={time}
                        onChange={(newTime) => {
                          const updated = [...addTimes];
                          updated[index] = newTime;
                          setAddTimes(updated);
                        }}
                        className="w-auto min-w-0 h-9 text-xs border-none bg-transparent px-2.5"
                      />
                      {addTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeSlot(index)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick preset buttons */}
                <div className="flex gap-1.5">
                  {TIME_PRESETS.map((preset) => {
                    const isIncluded = addTimes.includes(preset.time);
                    return (
                      <button
                        key={preset.time}
                        type="button"
                        onClick={() => {
                          if (isIncluded) {
                            if (addTimes.length > 1) {
                              setAddTimes(addTimes.filter(t => t !== preset.time));
                            }
                          } else {
                            setAddTimes([...addTimes, preset.time].sort());
                          }
                        }}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all border',
                          isIncluded
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'text-muted-foreground border-transparent hover:bg-muted/40'
                        )}
                      >
                        {preset.label}
                        <span className="block text-[10px] font-normal opacity-70">{preset.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add button */}
              <Button
                className="w-full h-11 rounded-xl text-sm font-bold gap-2"
                onClick={handleInlineAdd}
                disabled={!addTitle.trim() || addTimes.length === 0 || addReminder.isPending}
              >
                {addReminder.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                เพิ่มเตือน{activeTypeConfig.label}
                {addTimes.length > 1 && ` (${addTimes.length} รอบ)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Edit Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                แก้ไขการเตือน
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder_title">ชื่อเตือน *</Label>
              {formData.type === 'medication' && activeMeds.length > 0 && (
                <Select
                  value={activeMeds.some(m => m.name === formData.title) ? formData.title : '__custom__'}
                  onValueChange={(v) => {
                    if (v === '__custom__') {
                      setFormData((p) => ({ ...p, title: '' }));
                    } else {
                      setFormData((p) => ({ ...p, title: v }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกยา" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMeds.map((med) => (
                      <SelectItem key={med.id} value={med.name}>
                        {med.name} {med.dosage ? `(${med.dosage})` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">อื่นๆ (พิมพ์เอง)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {/* Text input: shown for non-medication, no meds list, or when "อื่นๆ" is selected */}
              {(formData.type !== 'medication' || activeMeds.length === 0 || !activeMeds.some(m => m.name === formData.title)) && (
                <Input
                  id="reminder_title"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder={formData.type === 'medication' ? 'พิมพ์ชื่อยา' : 'เช่น กินยาความดัน'}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>เวลาเตือน *</Label>
              <TimeInput
                value={formData.time}
                onChange={(value) => setFormData((p) => ({ ...p, time: value }))}
                placeholder="เลือกเวลา"
              />
            </div>

            <div className="space-y-2">
              <Label>ความถี่</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.frequency === 'daily' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData((p) => ({ ...p, frequency: 'daily' }))}
                >
                  ทุกวัน
                </Button>
                <Button
                  type="button"
                  variant={formData.frequency === 'specific_days' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData((p) => ({ ...p, frequency: 'specific_days' }))}
                >
                  เลือกวัน
                </Button>
              </div>
            </div>

            {formData.frequency === 'specific_days' && (
              <div className="space-y-2">
                <Label>เลือกวันที่ต้องการเตือน</Label>
                <div className="flex gap-2 justify-center">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                        formData.days_of_week.includes(day.value)
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                placeholder="เพิ่มรายละเอียดเพิ่มเติม"
                rows={2}
              />
            </div>
          </div>

          <DrawerFooter className="border-t border-border">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={updateReminder.isPending}
              >
                {updateReminder.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Save className="w-4 h-4" />
                บันทึก
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
