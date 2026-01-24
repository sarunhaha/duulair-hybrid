import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Save, Loader2, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { useAuthStore } from '@/stores/auth';
import { usePatientProfile, useUpdatePatientProfile, type PatientProfile } from '@/lib/api/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';

export default function ProfileEditPage() {
  const [, navigate] = useLocation();
  const { context, user } = useAuthStore();
  // Fallback to user.profileId if context.patientId is null (for patient role)
  const patientId = context.patientId || (user.role === 'patient' ? user.profileId : null);
  const { toast } = useToast();

  const { data: profile, isLoading } = usePatientProfile(patientId);
  const updateProfile = useUpdatePatientProfile();

  const [formData, setFormData] = useState<Partial<PatientProfile>>({});
  const [newDrugAllergy, setNewDrugAllergy] = useState('');
  const [newFoodAllergy, setNewFoodAllergy] = useState('');
  const [newChronicDisease, setNewChronicDisease] = useState('');

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;

    try {
      await updateProfile.mutateAsync({ patientId, data: formData });
      toast({
        title: 'บันทึกสำเร็จ',
        description: 'อัพเดทข้อมูลโปรไฟล์เรียบร้อยแล้ว',
      });
      navigate('/settings');
    } catch {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (field: keyof PatientProfile, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addToArray = (field: 'drug_allergies' | 'food_allergies' | 'chronic_diseases', value: string) => {
    if (!value.trim()) return;
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), value.trim()],
    }));
  };

  const removeFromArray = (field: 'drug_allergies' | 'food_allergies' | 'chronic_diseases', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8 font-sans bg-background">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">แก้ไขโปรไฟล์</h1>
        <Button
          onClick={handleSubmit}
          disabled={updateProfile.isPending}
          className="gap-2"
        >
          {updateProfile.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          บันทึก
        </Button>
      </header>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Basic Info */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold text-foreground border-b border-border pb-2">ข้อมูลพื้นฐาน</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">ชื่อ</Label>
                <Input
                  id="first_name"
                  value={formData.first_name || ''}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="ชื่อจริง"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">นามสกุล</Label>
                <Input
                  id="last_name"
                  value={formData.last_name || ''}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="นามสกุล"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">ชื่อเล่น</Label>
              <Input
                id="nickname"
                value={formData.nickname || ''}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                placeholder="ชื่อเล่น"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth_date">วันเกิด</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date || ''}
                  onChange={(e) => handleInputChange('birth_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">เพศ</Label>
                <Select
                  value={formData.gender || undefined}
                  onValueChange={(v) => handleInputChange('gender', v as PatientProfile['gender'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเพศ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ชาย</SelectItem>
                    <SelectItem value="female">หญิง</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">เบอร์โทรศัพท์</Label>
              <Input
                id="phone_number"
                type="tel"
                value={formData.phone_number || ''}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                placeholder="081-234-5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">ที่อยู่</Label>
              <Textarea
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="ที่อยู่"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Physical Stats */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold text-foreground border-b border-border pb-2">สถิติร่างกาย</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight_kg">น้ำหนัก (กก.)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.1"
                  value={formData.weight_kg || ''}
                  onChange={(e) => handleInputChange('weight_kg', parseFloat(e.target.value) || undefined)}
                  placeholder="65"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height_cm">ส่วนสูง (ซม.)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  value={formData.height_cm || ''}
                  onChange={(e) => handleInputChange('height_cm', parseInt(e.target.value) || undefined)}
                  placeholder="168"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blood_type">กรุ๊ปเลือด</Label>
                <Select
                  value={formData.blood_type || undefined}
                  onValueChange={(v) => handleInputChange('blood_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="AB">AB</SelectItem>
                    <SelectItem value="O">O</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Info */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold text-foreground border-b border-border pb-2">ข้อมูลสุขภาพ</h2>

            {/* Chronic Diseases */}
            <div className="space-y-2">
              <Label>โรคประจำตัว</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.chronic_diseases || []).map((disease, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium"
                  >
                    {disease}
                    <button type="button" onClick={() => removeFromArray('chronic_diseases', i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newChronicDisease}
                  onChange={(e) => setNewChronicDisease(e.target.value)}
                  placeholder="เพิ่มโรคประจำตัว"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('chronic_diseases', newChronicDisease);
                      setNewChronicDisease('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    addToArray('chronic_diseases', newChronicDisease);
                    setNewChronicDisease('');
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical_condition">อาการ/สภาพ</Label>
              <Textarea
                id="medical_condition"
                value={formData.medical_condition || ''}
                onChange={(e) => handleInputChange('medical_condition', e.target.value)}
                placeholder="อาการหรือสภาพปัจจุบัน"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical_notes">หมายเหตุการรักษา</Label>
              <Textarea
                id="medical_notes"
                value={formData.medical_notes || ''}
                onChange={(e) => handleInputChange('medical_notes', e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Allergies */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold text-foreground border-b border-border pb-2">การแพ้</h2>

            {/* Drug Allergies */}
            <div className="space-y-2">
              <Label>แพ้ยา</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.drug_allergies || []).map((drug, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium"
                  >
                    {drug}
                    <button type="button" onClick={() => removeFromArray('drug_allergies', i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newDrugAllergy}
                  onChange={(e) => setNewDrugAllergy(e.target.value)}
                  placeholder="เพิ่มยาที่แพ้"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('drug_allergies', newDrugAllergy);
                      setNewDrugAllergy('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    addToArray('drug_allergies', newDrugAllergy);
                    setNewDrugAllergy('');
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Food Allergies */}
            <div className="space-y-2">
              <Label>แพ้อาหาร</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.food_allergies || []).map((food, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium"
                  >
                    {food}
                    <button type="button" onClick={() => removeFromArray('food_allergies', i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newFoodAllergy}
                  onChange={(e) => setNewFoodAllergy(e.target.value)}
                  placeholder="เพิ่มอาหารที่แพ้"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('food_allergies', newFoodAllergy);
                      setNewFoodAllergy('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    addToArray('food_allergies', newFoodAllergy);
                    setNewFoodAllergy('');
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hospital & Emergency Contact */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-bold text-foreground border-b border-border pb-2">โรงพยาบาล/ผู้ติดต่อฉุกเฉิน</h2>

            <div className="space-y-2">
              <Label htmlFor="hospital_name">ชื่อโรงพยาบาล</Label>
              <Input
                id="hospital_name"
                value={formData.hospital_name || ''}
                onChange={(e) => handleInputChange('hospital_name', e.target.value)}
                placeholder="โรงพยาบาลที่ดูแล"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hospital_phone">เบอร์โรงพยาบาล</Label>
              <Input
                id="hospital_phone"
                type="tel"
                value={formData.hospital_phone || ''}
                onChange={(e) => handleInputChange('hospital_phone', e.target.value)}
                placeholder="02-XXX-XXXX"
              />
            </div>

            <div className="pt-4 border-t border-border space-y-4">
              <p className="text-sm font-bold text-muted-foreground">ผู้ติดต่อฉุกเฉิน</p>

              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">ชื่อผู้ติดต่อ</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name || ''}
                  onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                  placeholder="ชื่อผู้ติดต่อฉุกเฉิน"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_relation">ความสัมพันธ์</Label>
                  <Input
                    id="emergency_contact_relation"
                    value={formData.emergency_contact_relation || ''}
                    onChange={(e) => handleInputChange('emergency_contact_relation', e.target.value)}
                    placeholder="เช่น ลูกสาว"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">เบอร์โทร</Label>
                  <Input
                    id="emergency_contact_phone"
                    type="tel"
                    value={formData.emergency_contact_phone || ''}
                    onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                    placeholder="081-XXX-XXXX"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              บันทึกข้อมูล
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
