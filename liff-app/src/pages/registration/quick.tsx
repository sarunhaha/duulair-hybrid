import { useState } from 'react';
import { useLocation } from 'wouter';
import { useLiff, useLiffContext } from '@/lib/liff/provider';
import { registrationApi, type QuickRegisterRequest } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HandHeart,
  User,
  HeartPulse,
  Check,
  Loader2,
  Info,
  ShieldCheck,
  Lightbulb,
} from 'lucide-react';

const RELATIONSHIPS = [
  { value: 'child', label: 'ลูก' },
  { value: 'grandchild', label: 'หลาน' },
  { value: 'sibling', label: 'พี่/น้อง' },
  { value: 'spouse', label: 'คู่สมรส' },
  { value: 'nurse', label: 'พยาบาล/ผู้ดูแลมืออาชีพ' },
  { value: 'other', label: 'อื่นๆ' },
];

interface FormData {
  caregiverFirstName: string;
  caregiverLastName: string;
  caregiverPhoneNumber: string;
  relationship: string;
  patientFirstName: string;
  patientLastName: string;
  patientBirthDate: string;
  patientConditions: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function QuickRegistrationPage() {
  const [, setLocation] = useLocation();
  const { profile } = useLiff();
  const { isGroup, groupId } = useLiffContext();
  const { setUser, setContext, setIsRegistered } = useAuthStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Initialize form with profile name if available
  const getInitialFormData = (): FormData => {
    const displayName = profile?.displayName || '';
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length >= 2 ? nameParts.slice(1).join(' ') : '';

    return {
      caregiverFirstName: firstName,
      caregiverLastName: lastName,
      caregiverPhoneNumber: '',
      relationship: '',
      patientFirstName: '',
      patientLastName: '',
      patientBirthDate: '',
      patientConditions: '',
    };
  };

  const [formData, setFormData] = useState<FormData>(getInitialFormData);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Caregiver validation
    if (!formData.caregiverFirstName.trim()) {
      newErrors.caregiverFirstName = 'กรุณากรอกชื่อ';
    }
    if (!formData.caregiverLastName.trim()) {
      newErrors.caregiverLastName = 'กรุณากรอกนามสกุล';
    }
    if (!formData.relationship) {
      newErrors.relationship = 'กรุณาเลือกความสัมพันธ์';
    }

    // Patient validation
    if (!formData.patientFirstName.trim()) {
      newErrors.patientFirstName = 'กรุณากรอกชื่อผู้ป่วย';
    }
    if (!formData.patientLastName.trim()) {
      newErrors.patientLastName = 'กรุณากรอกนามสกุลผู้ป่วย';
    }
    if (!formData.patientBirthDate) {
      newErrors.patientBirthDate = 'กรุณาเลือกวันเกิด';
    } else {
      // Validate age (18-120 years)
      const birthDate = new Date(formData.patientBirthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 120) {
        newErrors.patientBirthDate = 'วันเกิดไม่ถูกต้อง (อายุ 18-120 ปี)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!profile?.userId) {
      alert('ไม่สามารถระบุตัวตนได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    setIsSubmitting(true);

    try {
      const requestData: QuickRegisterRequest = {
        lineUserId: profile.userId,
        displayName: profile.displayName || '',
        pictureUrl: profile.pictureUrl || null,
        statusMessage: profile.statusMessage,
        contextType: isGroup ? 'group' : 'utou',
        groupId: isGroup && groupId ? groupId : null,
        caregiver: {
          firstName: formData.caregiverFirstName.trim(),
          lastName: formData.caregiverLastName.trim(),
          phoneNumber: formData.caregiverPhoneNumber.trim() || null,
          relationship: formData.relationship,
        },
        patient: {
          firstName: formData.patientFirstName.trim(),
          lastName: formData.patientLastName.trim(),
          birthDate: formData.patientBirthDate,
          medicalCondition: formData.patientConditions.trim() || null,
        },
      };

      const result = await registrationApi.quickRegister(requestData);

      if (result.success) {
        // Save context to store
        setUser({
          role: 'caregiver',
          profileId: result.caregiverId,
          lineUserId: profile.userId,
        });
        setContext({
          caregiverId: result.caregiverId,
          patientId: result.patientId,
          groupId: result.groupId || null,
        });
        setIsRegistered(true);

        // Save to localStorage for backwards compatibility
        const contextData = {
          caregiverId: result.caregiverId,
          patientId: result.patientId,
          role: 'caregiver',
          profile_id: result.patientId,
          groupId: result.groupId,
          contextType: isGroup ? 'group' : 'utou',
        };
        localStorage.setItem('oonjai_context', JSON.stringify(contextData));

        const userData = {
          role: 'caregiver',
          profile_id: result.caregiverId,
          line_user_id: profile.userId,
        };
        localStorage.setItem('oonjai_user', JSON.stringify(userData));

        // Redirect to success page
        setLocation(`/registration/success?caregiver_id=${result.caregiverId}`);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      alert(
        error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Welcome Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-none shadow-lg overflow-hidden relative mb-6">
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
          <CardContent className="pt-8 pb-8 text-center relative z-10">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
              <HandHeart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-1">ยินดีต้อนรับสู่ OONJAI</h1>
            <p className="text-white/90">กรุณากรอกข้อมูลเพื่อเริ่มใช้งาน</p>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Caregiver Info */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted border-b p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">ข้อมูลของคุณ (ผู้ดูแล)</h2>
                  <p className="text-xs text-muted-foreground">เชื่อมโยงกับบัญชี LINE โดยอัตโนมัติ</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caregiverFirstName">
                  ชื่อ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="caregiverFirstName"
                  value={formData.caregiverFirstName}
                  onChange={(e) => handleInputChange('caregiverFirstName', e.target.value)}
                  placeholder="กรอกชื่อของคุณ"
                  className={errors.caregiverFirstName ? 'border-destructive' : ''}
                />
                {errors.caregiverFirstName && (
                  <p className="text-xs text-destructive">{errors.caregiverFirstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="caregiverLastName">
                  นามสกุล <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="caregiverLastName"
                  value={formData.caregiverLastName}
                  onChange={(e) => handleInputChange('caregiverLastName', e.target.value)}
                  placeholder="กรอกนามสกุลของคุณ"
                  className={errors.caregiverLastName ? 'border-destructive' : ''}
                />
                {errors.caregiverLastName && (
                  <p className="text-xs text-destructive">{errors.caregiverLastName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="caregiverPhoneNumber">เบอร์โทรศัพท์</Label>
                <Input
                  id="caregiverPhoneNumber"
                  type="tel"
                  value={formData.caregiverPhoneNumber}
                  onChange={(e) => handleInputChange('caregiverPhoneNumber', e.target.value)}
                  placeholder="0XX-XXX-XXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">
                  ความสัมพันธ์กับผู้ป่วย <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => handleInputChange('relationship', value)}
                >
                  <SelectTrigger
                    className={errors.relationship ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder="-- เลือกความสัมพันธ์ --" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((rel) => (
                      <SelectItem key={rel.value} value={rel.value}>
                        {rel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.relationship && (
                  <p className="text-xs text-destructive">{errors.relationship}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Patient Info */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted border-b p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <HeartPulse className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">ข้อมูลผู้ป่วยที่ดูแล</h2>
                  <p className="text-xs text-muted-foreground">ไม่จำเป็นต้องมีบัญชี LINE</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientFirstName">
                  ชื่อผู้ป่วย <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientFirstName"
                  value={formData.patientFirstName}
                  onChange={(e) => handleInputChange('patientFirstName', e.target.value)}
                  placeholder="กรอกชื่อผู้ป่วย"
                  className={errors.patientFirstName ? 'border-destructive' : ''}
                />
                {errors.patientFirstName && (
                  <p className="text-xs text-destructive">{errors.patientFirstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientLastName">
                  นามสกุลผู้ป่วย <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientLastName"
                  value={formData.patientLastName}
                  onChange={(e) => handleInputChange('patientLastName', e.target.value)}
                  placeholder="กรอกนามสกุลผู้ป่วย"
                  className={errors.patientLastName ? 'border-destructive' : ''}
                />
                {errors.patientLastName && (
                  <p className="text-xs text-destructive">{errors.patientLastName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientBirthDate">
                  วันเกิดผู้ป่วย <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientBirthDate"
                  type="date"
                  value={formData.patientBirthDate}
                  onChange={(e) => handleInputChange('patientBirthDate', e.target.value)}
                  className={errors.patientBirthDate ? 'border-destructive' : ''}
                />
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>กรุณากรอกเป็น ค.ศ. (เช่น เกิดปี พ.ศ. 2496 = ค.ศ. 1953)</span>
                </div>
                {errors.patientBirthDate && (
                  <p className="text-xs text-destructive">{errors.patientBirthDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientConditions">โรคประจำตัว (ถ้ามี)</Label>
                <Textarea
                  id="patientConditions"
                  value={formData.patientConditions}
                  onChange={(e) => handleInputChange('patientConditions', e.target.value)}
                  placeholder="เช่น ความดันสูง, เบาหวาน"
                  rows={3}
                />
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>กรอกโรคประจำตัวสำคัญ สามารถเพิ่มรายละเอียดเพิ่มเติมได้ภายหลัง</span>
                </div>
              </div>

              {/* Info Card */}
              <div className="flex items-start gap-3 p-4 bg-primary/8 border border-primary/20 rounded-xl mt-4">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  คุณสามารถเพิ่มรายละเอียดอื่นๆ เช่น ข้อมูลสุขภาพ ยาที่ทาน และอื่นๆ ได้ภายหลังที่เมนูข้อมูลผู้ป่วย
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Section */}
          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full gap-2 h-12 text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  บันทึกและเริ่มใช้งาน
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ข้อมูลของท่านจะถูกเก็บเป็นความลับและปลอดภัย</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
