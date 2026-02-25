import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Plus,
  Pill,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  usePatientMedicationsAll,
  useAddMedication,
  useDeleteMedication,
} from '@/lib/api/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';

export default function MedicationsPage() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { toast } = useToast();
  const ensurePatient = useEnsurePatient();
  const patientId = ensurePatient.patientId;

  const [hasEnsured, setHasEnsured] = useState(false);
  const [newMedName, setNewMedName] = useState('');

  if (!auth.isLoading && !ensurePatient.isLoading && !patientId && !hasEnsured) {
    setHasEnsured(true);
    ensurePatient.ensurePatient();
  }

  const { data: medications, isLoading } = usePatientMedicationsAll(patientId);
  const addMedication = useAddMedication();
  const deleteMedication = useDeleteMedication();

  const handleAdd = async () => {
    if (!newMedName.trim()) {
      toast({ title: 'กรุณาระบุชื่อยา', variant: 'destructive' });
      return;
    }

    try {
      // Ensure patient profile exists (auto-create if needed)
      const resolvedPatientId = patientId || await ensurePatient.ensurePatient();
      if (!resolvedPatientId) {
        toast({ title: 'เกิดข้อผิดพลาด กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง', variant: 'destructive' });
        return;
      }

      await addMedication.mutateAsync({
        name: newMedName.trim(),
        patient_id: resolvedPatientId,
        active: true,
      });
      setNewMedName('');
      toast({ title: 'เพิ่มรายการยาเรียบร้อยแล้ว' });
    } catch {
      toast({ title: 'ไม่สามารถเพิ่มรายการยาได้', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!patientId) return;
    if (!confirm('ต้องการลบรายการยานี้หรือไม่?')) return;

    try {
      await deleteMedication.mutateAsync({ id, patientId });
      toast({ title: 'ลบรายการยาเรียบร้อยแล้ว' });
    } catch {
      toast({ title: 'ไม่สามารถลบรายการยาได้', variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !addMedication.isPending) {
      handleAdd();
    }
  };

  if (auth.isLoading || ensurePatient.isLoading) {
    return (
      <div className="min-h-screen pb-8 font-sans bg-background">
        <header className="bg-card pt-4 pb-1 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">รายการยา</h1>
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

  return (
    <div className="min-h-screen pb-8 font-sans bg-background">
      {/* Header */}
      <header className="bg-card pt-4 pb-1 px-6 sticky top-0 z-20 flex items-center gap-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">รายการยา</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Pill className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">ยาของฉัน</p>
                <p className="text-xs text-muted-foreground">จัดการรายการยาและเวลาเตือน</p>
              </div>
              {medications && medications.length > 0 && (
                <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                  {medications.length} รายการ
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
            {!isLoading && (!medications || medications.length === 0) && (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-12 h-12 mb-3 bg-muted/50 rounded-full flex items-center justify-center">
                  <Pill className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">ยังไม่มีรายการยา</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">เพิ่มชื่อยาด้านล่างได้เลย</p>
              </div>
            )}

            {/* Medication List */}
            {medications && medications.length > 0 && (
              <div className="space-y-3">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center justify-between bg-muted/20 p-3 rounded-xl"
                  >
                    <p className="text-sm font-bold text-foreground">{med.name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => handleDelete(med.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Medication */}
            <div className="pt-4 border-t space-y-3">
              <p className="text-xs font-bold text-foreground">เพิ่มรายการยาใหม่</p>
              <Input
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ชื่อยา และขนาด (เช่น Paracetamol 500mg)"
                className="bg-muted/20"
              />
              <Button
                className="w-full h-11 rounded-xl text-sm font-bold bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                onClick={handleAdd}
                disabled={addMedication.isPending || !newMedName.trim()}
              >
                {addMedication.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                เพิ่มยาของคุณ
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
