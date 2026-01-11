import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';
import { useLiff } from '@/lib/liff/provider';
import { registrationApi } from '@/lib/api/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Link as LinkIcon,
  Lightbulb,
  Share2,
  Copy,
  X,
  Bell,
  UserCheck,
  Loader2,
} from 'lucide-react';

type SuccessType = 'patient' | 'caregiver' | 'already-registered';

export default function RegistrationSuccessPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const patientId = params.get('patient_id');
  const caregiverId = params.get('caregiver_id');
  const returning = params.get('returning') === 'true';

  const { closeWindow, shareTargetPicker, isInClient } = useLiff();
  const { toast } = useToast();

  const [successType, setSuccessType] = useState<SuccessType>('already-registered');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine success type based on URL params
  useEffect(() => {
    if (patientId) {
      setSuccessType('patient');
      generateLinkCode(patientId);
    } else if (caregiverId) {
      setSuccessType('caregiver');
    } else {
      setSuccessType('already-registered');
    }
  }, [patientId, caregiverId]);

  const generateLinkCode = async (id: string) => {
    setIsLoadingCode(true);
    try {
      const result = await registrationApi.generateLinkCode(id);
      setLinkCode(result.code);
    } catch (err) {
      console.error('Failed to generate link code:', err);
      setError('ไม่สามารถสร้างรหัสเชื่อมต่อได้');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleShare = async () => {
    if (!linkCode) return;

    const message = {
      type: 'text' as const,
      text: `รหัสเชื่อมต่อ OONJAI\n\nรหัส: ${linkCode}\n\nใช้รหัสนี้เพื่อเชื่อมต่อกับบัญชีผู้ป่วยของฉัน\n\nเปิด LINE → OONJAI → ลงทะเบียนผู้ดูแล → กรอกรหัสนี้`,
    };

    const success = await shareTargetPicker([message]);

    if (success) {
      toast({
        title: 'แชร์รหัสเรียบร้อย',
        description: 'รหัสถูกส่งไปยังผู้รับที่เลือกแล้ว',
      });
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  const handleCopy = async () => {
    if (!linkCode) return;

    try {
      await navigator.clipboard.writeText(linkCode);
      toast({
        title: 'คัดลอกรหัสเรียบร้อย',
        description: `รหัส ${linkCode} ถูกคัดลอกแล้ว`,
      });
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = linkCode;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        toast({
          title: 'คัดลอกรหัสเรียบร้อย',
          description: `รหัส ${linkCode} ถูกคัดลอกแล้ว`,
        });
      } catch {
        toast({
          title: 'ไม่สามารถคัดลอกได้',
          description: 'กรุณาคัดลอกรหัสด้วยตนเอง',
          variant: 'destructive',
        });
      }
      document.body.removeChild(input);
    }
  };

  const handleClose = () => {
    if (isInClient) {
      closeWindow();
    } else {
      window.close();
    }
  };

  const getTitle = () => {
    if (returning) return 'ยินดีต้อนรับกลับ!';
    if (successType === 'caregiver') return 'เชื่อมต่อสำเร็จ!';
    if (successType === 'already-registered') return 'คุณลงทะเบียนแล้ว';
    return 'ลงทะเบียนสำเร็จ!';
  };

  const getSubtitle = () => {
    if (returning) return 'คุณลงทะเบียนไว้แล้ว';
    if (successType === 'caregiver') return 'คุณสามารถติดตามสุขภาพของผู้ป่วยได้แล้ว';
    if (successType === 'already-registered') return 'ขอบคุณที่ใช้บริการ';
    return 'ขอบคุณที่ใช้บริการ OONJAI';
  };

  // Generate QR Code URL using a public QR code API
  const getQRCodeUrl = () => {
    if (!linkCode) return '';
    const qrData = encodeURIComponent(`OONJAI:${linkCode}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrData}&color=1E7B9C`;
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-success to-success/80 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-success/30 animate-in zoom-in-50 duration-500">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">{getTitle()}</h1>
          <p className="text-muted-foreground">{getSubtitle()}</p>
        </div>

        {/* Patient Success: Link Code & QR Code */}
        {successType === 'patient' && (
          <>
            <Card className="border shadow-sm overflow-hidden mb-6">
              <CardHeader className="bg-muted border-b p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <LinkIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">รหัสเชื่อมต่อของคุณ</h2>
                    <p className="text-xs text-muted-foreground">แชร์รหัสนี้กับผู้ดูแล</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  แชร์รหัสนี้กับผู้ดูแลเพื่อให้เขาเชื่อมต่อกับบัญชีของคุณ
                </p>

                {/* Link Code Display */}
                {isLoadingCode ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="text-destructive text-sm py-4">{error}</div>
                ) : (
                  <>
                    <div className="inline-block bg-muted px-6 py-4 rounded-xl border-2 border-dashed border-border">
                      <span className="text-3xl font-bold text-primary font-mono tracking-wider">
                        {linkCode}
                      </span>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-4 rounded-xl inline-block shadow-md">
                      <img
                        src={getQRCodeUrl()}
                        alt="QR Code"
                        width={180}
                        height={180}
                        className="block"
                      />
                    </div>

                    {/* Info Card */}
                    <div className="flex items-start gap-3 p-4 bg-primary/8 border border-primary/20 rounded-xl text-left">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        ผู้ดูแลสามารถสแกน QR Code หรือกรอกรหัส 6 หลักเพื่อเชื่อมต่อกับคุณ
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Share & Copy Buttons */}
            {linkCode && (
              <div className="space-y-3 mb-6">
                <Button onClick={handleShare} className="w-full gap-2 h-12">
                  <Share2 className="w-5 h-5" />
                  แชร์รหัส
                </Button>
                <Button onClick={handleCopy} variant="outline" className="w-full gap-2 h-12">
                  <Copy className="w-5 h-5" />
                  คัดลอกรหัส
                </Button>
              </div>
            )}
          </>
        )}

        {/* Caregiver Success */}
        {successType === 'caregiver' && (
          <Card className="border shadow-sm mb-6">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                <UserCheck className="w-8 h-8 text-success" />
              </div>
              <p className="text-muted-foreground">
                คุณได้เชื่อมต่อกับผู้ป่วยเรียบร้อยแล้ว
                <br />
                ตอนนี้คุณสามารถดูข้อมูลและติดตามสุขภาพของผู้ป่วยได้แล้ว
              </p>

              <div className="flex items-start gap-3 p-4 bg-primary/8 border border-primary/20 rounded-xl text-left">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  คุณจะได้รับแจ้งเตือนเกี่ยวกับสุขภาพของผู้ป่วยผ่าน LINE ทันที
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already Registered */}
        {successType === 'already-registered' && (
          <Card className="border shadow-sm mb-6">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">คุณได้ลงทะเบียนไว้แล้ว</p>
            </CardContent>
          </Card>
        )}

        {/* Close Button */}
        <Button onClick={handleClose} variant="outline" className="w-full gap-2 h-12 mb-6">
          <X className="w-5 h-5" />
          ปิด
        </Button>

        {/* Footer Note */}
        <p className="text-center text-sm text-muted-foreground leading-relaxed">
          คุณสามารถเริ่มใช้งานระบบได้ทันที
          <br />
          พิมพ์ &quot;สวัสดี&quot; ใน LINE Chat เพื่อทดสอบ
        </p>
      </div>
    </div>
  );
}
