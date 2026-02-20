import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Link2, Copy, Check, RefreshCw, Users, QrCode, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { useLinkCode, usePatientCaregivers } from '@/lib/api/hooks/use-profile';
import { useLiff } from '@/lib/liff/provider';

export default function LinkPage() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const { shareTargetPicker } = useLiff();
  const patientId = user.role === 'patient' ? user.profileId : null;

  const { data: linkCode, refetch: regenerateCode, isLoading: isLoadingCode } = useLinkCode(patientId);
  const { data: caregivers = [] } = usePatientCaregivers(patientId);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (linkCode?.code) {
      await navigator.clipboard.writeText(linkCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (linkCode?.code) {
      try {
        await shareTargetPicker([
          {
            type: 'text',
            text: `เชิญคุณเป็นผู้ดูแลของฉันใน OONJAI\n\nรหัสเชื่อมต่อ: ${linkCode.code}\n\nกรอกรหัสนี้ในแอป OONJAI เพื่อเชื่อมต่อ`,
          },
        ]);
      } catch {
        // Fallback to native share if available
        if (navigator.share) {
          navigator.share({
            title: 'เชื่อมต่อผู้ดูแล OONJAI',
            text: `เชิญคุณเป็นผู้ดูแลของฉันใน OONJAI\n\nรหัสเชื่อมต่อ: ${linkCode.code}`,
          });
        }
      }
    }
  };

  const handleRegenerate = () => {
    regenerateCode();
  };

  const getExpiryTime = () => {
    if (!linkCode?.expires_at) return null;
    const expiry = new Date(linkCode.expires_at);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours > 0) {
      return `${diffHours} ชม. ${diffMinutes} นาที`;
    }
    return `${diffMinutes} นาที`;
  };

  return (
    <div className="min-h-screen bg-background pb-8 font-sans">
      {/* Header */}
      <header className="bg-card pt-4 pb-1 px-4 sticky top-0 z-20 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">เชื่อมต่อผู้ดูแล</h1>
            <p className="text-xs text-muted-foreground">แชร์รหัสให้ผู้ดูแลเพื่อเชื่อมต่อ</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Link Code Card */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-accent/10 to-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" />
              รหัสเชื่อมต่อของคุณ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingCode ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : (
              <>
                <div className="bg-card rounded-2xl p-6 text-center mb-4">
                  <p className="text-4xl font-mono font-bold tracking-[0.3em] text-accent">
                    {linkCode?.code || '------'}
                  </p>
                  {linkCode?.expires_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      หมดอายุใน {getExpiryTime()}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 rounded-2xl"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500 mb-1" />
                    ) : (
                      <Copy className="w-5 h-5 mb-1" />
                    )}
                    <span className="text-xs">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 rounded-2xl"
                    onClick={handleShare}
                  >
                    <Share2 className="w-5 h-5 mb-1" />
                    <span className="text-xs">แชร์</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-col h-auto py-3 rounded-2xl"
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className="w-5 h-5 mb-1" />
                    <span className="text-xs">สร้างใหม่</span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <QrCode className="w-4 h-4 text-muted-foreground" />
              วิธีเชื่อมต่อ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                1
              </div>
              <p className="text-sm text-muted-foreground">
                แชร์รหัสนี้ให้ผู้ดูแลของคุณ (ลูก/หลาน/ญาติ)
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                2
              </div>
              <p className="text-sm text-muted-foreground">
                ผู้ดูแลเปิดแอป OONJAI และเลือก &quot;เป็นผู้ดูแล&quot;
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                3
              </div>
              <p className="text-sm text-muted-foreground">
                ผู้ดูแลกรอกรหัสนี้เพื่อเชื่อมต่อกับคุณ
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Connected Caregivers */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              ผู้ดูแลที่เชื่อมต่อแล้ว ({caregivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caregivers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ยังไม่มีผู้ดูแลเชื่อมต่อ
              </p>
            ) : (
              <div className="space-y-2">
                {caregivers.map((caregiver) => (
                  <div
                    key={caregiver.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/20"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                      {caregiver.first_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {caregiver.first_name} {caregiver.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {caregiver.relationship || 'ผู้ดูแล'}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500" title="เชื่อมต่อแล้ว" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
