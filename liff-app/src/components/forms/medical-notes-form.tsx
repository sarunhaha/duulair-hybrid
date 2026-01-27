import { useState } from 'react';
import {
  FileText,
  ClipboardCheck,
  Stethoscope,
  Building2,
  Scissors,
  Syringe,
  Pencil,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLogMedicalNote } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

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

const defaultFormData: MedicalNotesFormData = {
  event_date: new Date().toISOString().split('T')[0],
  event_type: '',
  custom_type: '',
  description: '',
  hospital_name: '',
  doctor_name: '',
};

interface MedicalNotesFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MedicalNotesForm({ onSuccess, onCancel }: MedicalNotesFormProps) {
  const { isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();
  const logMedicalNote = useLogMedicalNote();

  const [formData, setFormData] = useState<MedicalNotesFormData>(defaultFormData);

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

      await logMedicalNote.mutateAsync({
        patientId: resolvedPatientId,
        event_date: formData.event_date || undefined,
        event_type: eventType,
        description: formData.description,
        hospital_name: formData.hospital_name || undefined,
        doctor_name: formData.doctor_name || undefined,
      });

      toast({ title: 'บันทึกข้อมูลแพทย์เรียบร้อยแล้ว' });
      setFormData(defaultFormData);
      onSuccess?.();
    } catch (error) {
      console.error('Error logging medical note:', error);
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
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-5 text-white text-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full" />
        <div className="relative z-10 flex items-center justify-center gap-4">
          <FileText className="w-10 h-10" />
          <div>
            <p className="text-sm text-white/80">บันทึกแพทย์</p>
            <p className="text-2xl font-bold">
              {formData.event_type
                ? EVENT_TYPES.find(e => e.value === formData.event_type)?.label || formData.custom_type
                : 'เลือกประเภท'}
            </p>
          </div>
        </div>
      </div>

      {/* Event Date */}
      <div className="space-y-2">
        <Label className="text-base font-bold">วันที่</Label>
        <Input
          type="date"
          value={formData.event_date}
          onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
          className="h-12"
        />
      </div>

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
                  'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5',
                  formData.event_type === type.value
                    ? 'bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-700'
                    : 'bg-muted/50 border-transparent hover:bg-muted'
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
            className="h-12"
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
        />
      </div>

      {/* Hospital Name */}
      <div className="space-y-2">
        <Label className="text-base font-bold">โรงพยาบาล (ถ้ามี)</Label>
        <Input
          value={formData.hospital_name}
          onChange={(e) => setFormData(prev => ({ ...prev, hospital_name: e.target.value }))}
          placeholder="เช่น รพ.ศิริราช"
          className="h-12"
        />
      </div>

      {/* Doctor Name */}
      <div className="space-y-2">
        <Label className="text-base font-bold">แพทย์ (ถ้ามี)</Label>
        <Input
          value={formData.doctor_name}
          onChange={(e) => setFormData(prev => ({ ...prev, doctor_name: e.target.value }))}
          placeholder="เช่น นพ.สมชาย"
          className="h-12"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
          onClick={handleSubmit}
          disabled={logMedicalNote.isPending}
        >
          {logMedicalNote.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'บันทึกข้อมูล'
          )}
        </Button>
      </div>
    </div>
  );
}
