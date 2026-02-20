import { useState } from 'react';
import { FlaskConical, Check, Loader2, ChevronDown, ChevronUp, Trash2, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useEnsurePatient } from '@/hooks/use-ensure-patient';
import { useTodayLabResults, useSaveLabResults, useUpdateLabResult, useDeleteLabResult } from '@/lib/api/hooks/use-health';
import type { LabResultLog } from '@/lib/api/hooks/use-health';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '@/components/ui/date-picker';

// Lab test definitions per panel
interface TestDef {
  test_name: string;
  label_th: string;
  unit: string;
  normal_min: number;
  normal_max: number;
}

interface Panel {
  id: string;
  label: string;
  label_th: string;
  tests: TestDef[];
}

const LAB_PANELS: Panel[] = [
  {
    id: 'cbc', label: 'CBC', label_th: 'ความสมบูรณ์ของเลือด',
    tests: [
      { test_name: 'Platelet', label_th: 'เกล็ดเลือด', unit: 'x10³/µL', normal_min: 150, normal_max: 400 },
      { test_name: 'WBC', label_th: 'เม็ดเลือดขาว', unit: 'x10³/µL', normal_min: 4.0, normal_max: 11.0 },
      { test_name: 'Hemoglobin', label_th: 'ฮีโมโกลบิน (Hb)', unit: 'g/dL', normal_min: 12.0, normal_max: 17.5 },
      { test_name: 'Hematocrit', label_th: 'ฮีมาโตคริต (Hct)', unit: '%', normal_min: 36, normal_max: 54 },
    ],
  },
  {
    id: 'liver', label: 'Liver', label_th: 'ค่าตับ',
    tests: [
      { test_name: 'ALT', label_th: 'ค่าตับ ALT', unit: 'U/L', normal_min: 0, normal_max: 40 },
      { test_name: 'AST', label_th: 'ค่าตับ AST', unit: 'U/L', normal_min: 0, normal_max: 40 },
      { test_name: 'ALP', label_th: 'ค่าตับ ALP', unit: 'U/L', normal_min: 40, normal_max: 130 },
      { test_name: 'Albumin', label_th: 'อัลบูมิน', unit: 'g/dL', normal_min: 3.5, normal_max: 5.0 },
    ],
  },
  {
    id: 'kidney', label: 'Kidney', label_th: 'ค่าไต',
    tests: [
      { test_name: 'Creatinine', label_th: 'ครีเอตินิน', unit: 'mg/dL', normal_min: 0.6, normal_max: 1.2 },
      { test_name: 'BUN', label_th: 'ยูเรียไนโตรเจน (BUN)', unit: 'mg/dL', normal_min: 7, normal_max: 20 },
      { test_name: 'eGFR', label_th: 'อัตราการกรองไต (eGFR)', unit: 'mL/min', normal_min: 90, normal_max: 999 },
      { test_name: 'Uric Acid', label_th: 'กรดยูริก', unit: 'mg/dL', normal_min: 2.5, normal_max: 7.0 },
    ],
  },
  {
    id: 'lipid', label: 'Lipid', label_th: 'ไขมันในเลือด',
    tests: [
      { test_name: 'Total Cholesterol', label_th: 'คอเลสเตอรอลรวม', unit: 'mg/dL', normal_min: 0, normal_max: 200 },
      { test_name: 'LDL', label_th: 'ไขมันร้าย (LDL)', unit: 'mg/dL', normal_min: 0, normal_max: 100 },
      { test_name: 'HDL', label_th: 'ไขมันดี (HDL)', unit: 'mg/dL', normal_min: 40, normal_max: 999 },
      { test_name: 'Triglycerides', label_th: 'ไตรกลีเซอไรด์', unit: 'mg/dL', normal_min: 0, normal_max: 150 },
    ],
  },
  {
    id: 'diabetes', label: 'Diabetes', label_th: 'เบาหวาน',
    tests: [
      { test_name: 'HbA1c', label_th: 'น้ำตาลสะสม (HbA1c)', unit: '%', normal_min: 4.0, normal_max: 5.6 },
    ],
  },
  {
    id: 'thyroid', label: 'Thyroid', label_th: 'ไทรอยด์',
    tests: [
      { test_name: 'TSH', label_th: 'ฮอร์โมนกระตุ้นไทรอยด์ (TSH)', unit: 'mIU/L', normal_min: 0.4, normal_max: 4.0 },
      { test_name: 'FT4', label_th: 'ไทรอกซินอิสระ (FT4)', unit: 'ng/dL', normal_min: 0.8, normal_max: 1.8 },
    ],
  },
];

function getStatus(value: number, min: number, max: number): 'normal' | 'high' | 'low' | 'critical' {
  // Critical thresholds: >2x high or <0.5x low
  if (max < 999 && value > max * 2) return 'critical';
  if (min > 0 && value < min * 0.5) return 'critical';
  if (max < 999 && value > max) return 'high';
  if (min > 0 && value < min) return 'low';
  return 'normal';
}

function getStatusColor(status: string | null) {
  switch (status) {
    case 'normal': return 'text-emerald-600 dark:text-emerald-400';
    case 'high': return 'text-orange-600 dark:text-orange-400';
    case 'low': return 'text-blue-600 dark:text-blue-400';
    case 'critical': return 'text-red-600 dark:text-red-400';
    default: return 'text-muted-foreground';
  }
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'normal': return { label: 'ปกติ', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' };
    case 'high': return { label: 'สูง', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' };
    case 'low': return { label: 'ต่ำ', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' };
    case 'critical': return { label: 'วิกฤต', className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' };
    default: return null;
  }
}

interface LabResultsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialEditData?: LabResultLog;
}

export function LabResultsForm({ onSuccess, onCancel, initialEditData }: LabResultsFormProps) {
  const { patientId, isLoading: authLoading, ensurePatient } = useEnsurePatient();
  const { toast } = useToast();

  const { data: todayResults, isLoading: resultsLoading, refetch } = useTodayLabResults(patientId);
  const saveLabResults = useSaveLabResults();
  const updateLabResult = useUpdateLabResult();
  const deleteLabResult = useDeleteLabResult();

  const now = new Date();
  const nowDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

  // Pre-fill from initialEditData when editing
  const [editingLog] = useState<LabResultLog | null>(() => initialEditData || null);

  const [labDate, setLabDate] = useState(() => {
    if (initialEditData?.lab_date) return initialEditData.lab_date;
    return nowDate;
  });
  const [labName, setLabName] = useState(() => initialEditData?.lab_name || '');

  // Pre-fill the specific test value when editing a single result
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(() => {
    if (initialEditData?.test_type) return new Set([initialEditData.test_type]);
    return new Set();
  });
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (initialEditData) {
      const key = `${initialEditData.test_type}:${initialEditData.test_name}`;
      return { [key]: String(initialEditData.value) };
    }
    return {};
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const togglePanel = (panelId: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  };

  const setTestValue = (panelId: string, testName: string, value: string) => {
    const key = `${panelId}:${testName}`;
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const getTestValue = (panelId: string, testName: string) => {
    return values[`${panelId}:${testName}`] || '';
  };

  // Count filled values per panel
  const getFilledCount = (panel: Panel) => {
    return panel.tests.filter(t => getTestValue(panel.id, t.test_name).trim() !== '').length;
  };

  // Total filled across all panels
  const totalFilled = LAB_PANELS.reduce((sum, p) => sum + getFilledCount(p), 0);

  const handleSubmit = async () => {
    if (!patientId) {
      try {
        await ensurePatient();
      } catch {
        toast({ description: 'ไม่สามารถยืนยันตัวตนได้ กรุณาลองใหม่', variant: 'destructive' });
        return;
      }
    }

    if (totalFilled === 0) {
      toast({ description: 'กรุณากรอกอย่างน้อย 1 ค่า', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    // Build results array from filled values
    const results: Array<{
      test_type: string;
      test_name: string;
      value: number;
      unit: string;
      normal_min: number;
      normal_max: number;
      status: string;
      lab_date: string;
      lab_name?: string;
    }> = [];

    for (const panel of LAB_PANELS) {
      for (const test of panel.tests) {
        const raw = getTestValue(panel.id, test.test_name).trim();
        if (raw === '') continue;

        const numVal = parseFloat(raw);
        if (isNaN(numVal)) continue;

        results.push({
          test_type: panel.id,
          test_name: test.test_name,
          value: numVal,
          unit: test.unit,
          normal_min: test.normal_min,
          normal_max: test.normal_max,
          status: getStatus(numVal, test.normal_min, test.normal_max),
          lab_date: labDate,
          ...(labName ? { lab_name: labName } : {}),
        });
      }
    }

    try {
      if (editingLog && results.length === 1) {
        // Update existing single record
        const r = results[0];
        await updateLabResult.mutateAsync({
          id: editingLog.id,
          patientId: patientId!,
          value: r.value,
          unit: r.unit,
          normal_min: r.normal_min,
          normal_max: r.normal_max,
          status: r.status,
          lab_date: r.lab_date,
          lab_name: r.lab_name,
        });
        toast({ description: 'อัปเดตผลแล็บเรียบร้อย' });
      } else {
        await saveLabResults.mutateAsync({ patientId: patientId!, results });
        toast({ description: `บันทึกผลแล็บ ${results.length} รายการเรียบร้อย` });
      }
      refetch();
      onSuccess?.();
    } catch (error) {
      console.error('Save lab results error:', error);
      toast({ description: 'ไม่สามารถบันทึกได้ กรุณาลองใหม่', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteResult = async (id: string) => {
    if (!patientId) return;
    try {
      await deleteLabResult.mutateAsync({ id, patientId });
      toast({ description: 'ลบข้อมูลเรียบร้อย' });
      setDeleteConfirmId(null);
      refetch();
    } catch {
      toast({ description: 'ไม่สามารถลบได้ กรุณาลองใหม่', variant: 'destructive' });
    }
  };

  // Group today's results by test_type for display
  const groupedResults: Record<string, LabResultLog[]> = {};
  (todayResults || []).forEach(r => {
    if (!groupedResults[r.test_type]) groupedResults[r.test_type] = [];
    groupedResults[r.test_type].push(r);
  });

  const panelLabels: Record<string, string> = {
    cbc: 'ความสมบูรณ์ของเลือด', liver: 'ค่าตับ', kidney: 'ค่าไต', lipid: 'ไขมันในเลือด', diabetes: 'เบาหวาน', thyroid: 'ไทรอยด์',
  };

  // Map test_name → label_th for display
  const testNameToTh: Record<string, string> = {};
  for (const panel of LAB_PANELS) {
    for (const test of panel.tests) {
      testNameToTh[test.test_name] = test.label_th;
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Edit mode banner */}
      {editingLog && (
        <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/30 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-bold text-teal-700 dark:text-teal-400">กำลังแก้ไขผลตรวจ</p>
          <p className="text-sm font-bold text-foreground">
            {testNameToTh[editingLog.test_name] || editingLog.test_name}: {editingLog.value} {editingLog.unit || ''}
          </p>
        </div>
      )}

      {/* Date & Lab Name */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary/60" />
            <Label className="text-sm font-medium">วันที่ตรวจ</Label>
          </div>
          <DateInput
            value={labDate}
            onChange={setLabDate}
            maxDate={nowDate}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">ชื่อ รพ./แล็บ (ไม่บังคับ)</Label>
          <Input
            placeholder="เช่น รพ.ศิริราช"
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
      </div>

      {/* Panel Accordions */}
      <div className="space-y-3">
        {LAB_PANELS.map((panel) => {
          const isExpanded = expandedPanels.has(panel.id);
          const filledCount = getFilledCount(panel);

          return (
            <div key={panel.id} className="bg-card rounded-2xl shadow-sm overflow-hidden border border-border/50">
              {/* Panel Header */}
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => togglePanel(panel.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{panel.label_th}</p>
                    <p className="text-[11px] text-muted-foreground">{panel.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {filledCount > 0 && (
                    <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full">
                      {filledCount}/{panel.tests.length}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Panel Fields */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                  {panel.tests.map((test) => {
                    const raw = getTestValue(panel.id, test.test_name);
                    const numVal = raw ? parseFloat(raw) : null;
                    const status = numVal !== null && !isNaN(numVal)
                      ? getStatus(numVal, test.normal_min, test.normal_max)
                      : null;
                    const badge = getStatusBadge(status);

                    return (
                      <div key={test.test_name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-muted-foreground">
                            {test.label_th}
                          </Label>
                          {badge && (
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', badge.className)}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="any"
                            placeholder={`${test.normal_min}–${test.normal_max === 999 ? '∞' : test.normal_max}`}
                            value={raw}
                            onChange={(e) => setTestValue(panel.id, test.test_name, e.target.value)}
                            className={cn(
                              'h-11 rounded-xl flex-1',
                              numVal !== null && !isNaN(numVal) && getStatusColor(status)
                            )}
                          />
                          <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                            {test.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
          onClick={onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20"
          onClick={handleSubmit}
          disabled={isSaving || totalFilled === 0}
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Check className="w-5 h-5 mr-2" />
          )}
          {editingLog ? 'อัปเดต' : `บันทึก (${totalFilled} ค่า)`}
        </Button>
      </div>

      {/* Today's Results List */}
      {(todayResults || []).length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border/50">
          <h4 className="text-sm font-bold text-muted-foreground">ผลแล็บวันนี้</h4>
          {Object.entries(groupedResults).map(([testType, results]) => (
            <div key={testType} className="bg-muted/50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-foreground">{panelLabels[testType] || testType}</p>
              {results.map((r) => {
                const badge = getStatusBadge(r.status);
                return (
                  <div key={r.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">{testNameToTh[r.test_name] || r.test_name}:</span>
                      <span className={cn('text-sm font-bold', getStatusColor(r.status))}>
                        {r.value}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{r.unit}</span>
                      {badge && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', badge.className)}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {deleteConfirmId === r.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => handleDeleteResult(r.id)}
                          disabled={deleteLabResult.isPending}
                        >
                          {deleteLabResult.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ลบ'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          ยกเลิก
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-40 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => setDeleteConfirmId(r.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
