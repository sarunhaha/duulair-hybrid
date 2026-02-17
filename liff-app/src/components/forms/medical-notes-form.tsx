import { useState } from 'react';
import {
  FileText,
  ClipboardCheck,
  Stethoscope,
  Building2,
  Scissors,
  Syringe,
  Loader2,
  History,
  Clock,
  Trash2,
  X,
  Check,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useLogMedicalNote, useTodayMedicalNotes, useDeleteMedicalNote, useUpdateMedicalNote } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { TimeSelectorPill } from './time-selector-pill';

interface MedicalNoteLog {
  id: string;
  patient_id: string;
  event_date?: string;
  event_type: string;
  description: string;
  hospital_name?: string;
  doctor_name?: string;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'checkup', label: 'ตรวจสุขภาพ', icon: ClipboardCheck },
  { value: 'doctor_visit', label: 'พบแพทย์', icon: Stethoscope },
  { value: 'hospitalization', label: 'นอน รพ.', icon: Building2 },
  { value: 'surgery', label: 'ผ่าตัด', icon: Scissors },
  { value: 'vaccination', label: 'ฉีดวัคซีน', icon: Syringe },
  { value: 'other', label: 'อื่นๆ', icon: Pencil },
];

interface MedicalNotesFormData {
  event_date: string;
  event_type: string;
  custom_type: string;
  description: string;
  hospital_name: string;
  doctor_name: string;
}

const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

const defaultFormData: MedicalNotesFormData = {
  event_date: getLocalDateString(),
  event_type: '',
  custom_type: '',
  description: '',
  hospital_name: '',
  doctor_name: '',
};

interface MedicalNotesFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: MedicalNoteLog;
}

export function MedicalNotesForm({ onSuccess, onCancel, initialEditData }: MedicalNotesFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logMedicalNote = useLogMedicalNote();
  const updateMedicalNote = useUpdateMedicalNote();
  const deleteMedicalNote = useDeleteMedicalNote();
  const { data: todayNotes, refetch: refetchNotes } = useTodayMedicalNotes(patientId);

  // Initialize form data - use initialEditData if provided (component is re-mounted via key prop)
  const [formData, setFormData] = useState<MedicalNotesFormData>(() => {
    if (initialEditData) {
      const isPreset = EVENT_TYPES.some(t => t.value === initialEditData.event_type);
      return {
        event_date: initialEditData.event_date || getLocalDateString(),
        event_type: isPreset ? initialEditData.event_type : 'other',
        custom_type: isPreset ? '' : initialEditData.event_type,
        description: initialEditData.description || '',
        hospital_name: initialEditData.hospital_name || '',
        doctor_name: initialEditData.doctor_name || '',
      };
    }
    return defaultFormData;
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<MedicalNoteLog | null>(() => initialEditData ?? null);

  // Drawer-based edit state
  const [editDrawerItem, setEditDrawerItem] = useState<MedicalNoteLog | null>(null);
  const [editDrawerSuccess, setEditDrawerSuccess] = useState(false);

  // Open edit drawer
  const handleEditDrawer = (log: MedicalNoteLog) => {
    setEditDrawerItem(log);
    setEditDrawerSuccess(false);
  };

  // Close edit drawer
  const handleCloseEditDrawer = () => {
    setEditDrawerItem(null);
    setEditDrawerSuccess(false);
    refetchNotes();
  };

  // Handle edit drawer success
  const handleEditDrawerSuccess = () => {
    setEditDrawerSuccess(true);
    setTimeout(() => {
      handleCloseEditDrawer();
    }, 1500);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingLog(null);
    setFormData(defaultFormData);
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteMedicalNote.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อยแล้ว' });
      setDeleteConfirmId(null);
      refetchNotes();
    } catch {
      toast({ description: 'เกิดข้อผิดพลาดในการลบข้อมูล', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    const eventType = formData.event_type === 'other' ? formData.custom_type : formData.event_type;
    if (!eventType) {
      toast({ title: 'กรุณาเลือกประเภทเหตุการณ์', variant: 'destructive' });
      return;
    }
    if (!formData.description.trim()) {
      toast({ title: 'กรุณาระบุรายละเอียด', variant: 'destructive' });
      return;
    }

    try {
      const resolvedPatientId = await ensurePatient();
      if (!resolvedPatientId) {
        toast({ title: 'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      if (editingLog) {
        // Update existing medical note
        await updateMedicalNote.mutateAsync({
          id: editingLog.id,
          patientId: resolvedPatientId,
          event_date: formData.event_date || undefined,
          event_type: eventType,
          description: formData.description,
          hospital_name: formData.hospital_name || undefined,
          doctor_name: formData.doctor_name || undefined,
        });
        toast({ title: 'อัปเดตข้อมูลแพทย์เรียบร้อยแล้ว' });
      } else {
        // Create new medical note
        await logMedicalNote.mutateAsync({
          patientId: resolvedPatientId,
          event_date: formData.event_date || undefined,
          event_type: eventType,
          description: formData.description,
          hospital_name: formData.hospital_name || undefined,
          doctor_name: formData.doctor_name || undefined,
        });
        toast({ title: 'บันทึกข้อมูลแพทย์เรียบร้อยแล้ว' });
      }

      setFormData(defaultFormData);
      refetchNotes();
      onSuccess?.();
    } catch {
      toast({ title: 'ไม่สามารถบันทึกได้', variant: 'destructive' });
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Edit Drawer */}
      {editDrawerItem && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseEditDrawer()}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="flex items-center justify-between px-6">
              <DrawerTitle className="text-xl font-bold">แก้ไขบันทึกแพทย์</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </DrawerHeader>

            <div className="px-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {editDrawerSuccess ? (
                <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded-full flex items-center justify-center">
                    <Check className="w-10 h-10 stroke-[3px]" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">อัปเดตเรียบร้อย!</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed px-8">
                      ข้อมูลบันทึกแพทย์ของคุณถูกอัปเดตแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <MedicalNotesForm
                  key={editDrawerItem.id}
                  onSuccess={handleEditDrawerSuccess}
                  onCancel={handleCloseEditDrawer}
                  initialEditData={editDrawerItem}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Time Selector Pill with Date */}
      <TimeSelectorPill
        time=""
        onTimeChange={() => {}}
        date={formData.event_date}
        onDateChange={(value) => setFormData(prev => ({ ...prev, event_date: value }))}
        showDate
      />

      {/* Event Type */}
      <div className="space-y-3">
        <Label className="text-base font-bold">ประเภท</Label>
        <div className="grid grid-cols-3 gap-2">
          {EVENT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, event_type: type.value }))}
                className={cn(
                  'p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5',
                  formData.event_type === type.value
                    ? 'bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-700'
                    : 'bg-white dark:bg-card border-muted shadow-sm hover:bg-muted/50'
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Type Input */}
      {formData.event_type === 'other' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">ระบุประเภท</Label>
          <Input
            value={formData.custom_type}
            onChange={(e) => setFormData(prev => ({ ...prev, custom_type: e.target.value }))}
            placeholder="เช่น กายภาพบำบัด, ทำฟัน"
            className="h-12 rounded-2xl bg-muted/20 border border-muted"
          />
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-base font-bold">รายละเอียด *</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="เช่น ตรวจเลือด ผลปกติ, พบแพทย์เรื่องปวดหลัง"
          rows={3}
          className="rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Hospital Name */}
      <div className="space-y-2">
        <Label className="text-base font-bold">โรงพยาบาล (ถ้ามี)</Label>
        <Input
          value={formData.hospital_name}
          onChange={(e) => setFormData(prev => ({ ...prev, hospital_name: e.target.value }))}
          placeholder="เช่น รพ.ศิริราช"
          className="h-12 rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Doctor Name */}
      <div className="space-y-2">
        <Label className="text-base font-bold">แพทย์ (ถ้ามี)</Label>
        <Input
          value={formData.doctor_name}
          onChange={(e) => setFormData(prev => ({ ...prev, doctor_name: e.target.value }))}
          placeholder="เช่น นพ.สมชาย"
          className="h-12 rounded-2xl bg-muted/20 border border-muted"
        />
      </div>

      {/* Today's Logged Notes */}
      {todayNotes && todayNotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="w-4 h-4 text-primary" />
            บันทึกวันนี้ ({todayNotes.length} รายการ)
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {todayNotes.map((note) => {
              const typeInfo = EVENT_TYPES.find(t => t.value === note.event_type);
              const TypeIcon = typeInfo?.icon || FileText;
              const isDeleting = deleteConfirmId === note.id;
              return (
                <div
                  key={note.id}
                  className="flex items-center gap-3 bg-white dark:bg-card border border-muted shadow-sm rounded-2xl p-3 group cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => !isDeleting && handleEditDrawer(note)}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                    <TypeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {typeInfo?.label || note.event_type}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{note.description}</p>
                  </div>
                  {isDeleting ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(note.id);
                        }}
                        disabled={deleteMedicalNote.isPending}
                      >
                        {deleteMedicalNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ลบ'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(note.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
          onClick={editingLog ? handleCancelEdit : onCancel}
        >
          {editingLog ? 'ยกเลิกแก้ไข' : 'ยกเลิก'}
        </Button>
        <Button
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
          onClick={handleSubmit}
          disabled={logMedicalNote.isPending || updateMedicalNote.isPending}
        >
          {(logMedicalNote.isPending || updateMedicalNote.isPending) ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            editingLog ? 'อัปเดต' : 'บันทึกข้อมูล'
          )}
        </Button>
      </div>
    </div>
  );
}
