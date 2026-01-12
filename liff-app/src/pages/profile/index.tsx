import { useState } from 'react';
import { Link } from 'wouter';
import {
  User,
  Heart,
  ShieldAlert,
  Phone,
  MapPin,
  Calendar,
  Users,
  Edit3,
  Copy,
  Check,
  ArrowLeft,
  Pill,
  Hospital,
  AlertCircle,
  Ruler,
  Scale,
  Droplet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useAuthStore } from '@/stores/auth';
import { useLiff } from '@/lib/liff/provider';
import {
  usePatientProfile,
  useLinkCode,
  usePatientCaregivers,
  calculateAge,
  formatThaiDate,
  formatGender,
} from '@/lib/api/hooks/use-profile';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { context, user } = useAuthStore();
  const { profile: liffProfile } = useLiff();
  // Fallback to user.profileId if context.patientId is null (for patient role)
  const patientId = context.patientId || (user.role === 'patient' ? user.profileId : null);

  const { data: profile, isLoading } = usePatientProfile(patientId);
  const { data: linkCode } = useLinkCode(patientId);
  const { data: caregivers } = usePatientCaregivers(patientId);

  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (linkCode?.code) {
      await navigator.clipboard.writeText(linkCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const age = calculateAge(profile?.birth_date);

  return (
    <div className="min-h-screen pb-32 font-sans bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/80 pt-12 pb-8 px-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/profile/edit">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-2">
                <Edit3 className="w-4 h-4" />
                แก้ไข
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden ring-4 ring-white/30">
              {liffProfile?.pictureUrl ? (
                <img src={liffProfile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {profile?.nickname || profile?.first_name || liffProfile?.displayName || 'ผู้ใช้งาน'}
              </h1>
              <p className="text-white/80 text-sm mt-1">
                {profile?.first_name} {profile?.last_name}
              </p>
              {age && (
                <p className="text-white/70 text-xs mt-0.5">อายุ {age} ปี</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 -mt-4 space-y-4 relative z-10">
        {/* Link Code Card */}
        {linkCode && (
          <Card className="border-none shadow-lg bg-gradient-to-br from-accent to-accent/80 text-white overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 font-medium mb-1">รหัสเชื่อมผู้ดูแล</p>
                  <p className="text-2xl font-bold tracking-widest font-mono">{linkCode.code}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleCopyCode}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-[10px] text-white/70 mt-2">
                ให้ผู้ดูแลพิมพ์รหัสนี้ในแชทเพื่อเชื่อมต่อ
              </p>
            </CardContent>
          </Card>
        )}

        {/* Basic Info */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-bold text-foreground">ข้อมูลพื้นฐาน</h2>
            </div>
            <div className="p-4 space-y-4">
              <InfoRow icon={Calendar} label="วันเกิด" value={formatThaiDate(profile?.birth_date)} />
              <InfoRow icon={User} label="เพศ" value={formatGender(profile?.gender)} />
              <InfoRow icon={Phone} label="โทรศัพท์" value={profile?.phone_number || '-'} />
              <InfoRow icon={MapPin} label="ที่อยู่" value={profile?.address || '-'} multiline />
            </div>
          </CardContent>
        </Card>

        {/* Physical Stats */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="bg-green-500/10 p-2 rounded-xl">
                <Scale className="w-5 h-5 text-green-500" />
              </div>
              <h2 className="font-bold text-foreground">สถิติร่างกาย</h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <Scale className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{profile?.weight_kg || '-'}</p>
                  <p className="text-[10px] text-muted-foreground">กก.</p>
                </div>
              </div>
              <div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <Ruler className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{profile?.height_cm || '-'}</p>
                  <p className="text-[10px] text-muted-foreground">ซม.</p>
                </div>
              </div>
              <div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <Droplet className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{profile?.blood_type || '-'}</p>
                  <p className="text-[10px] text-muted-foreground">เลือด</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Info */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="bg-red-500/10 p-2 rounded-xl">
                <Heart className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="font-bold text-foreground">ข้อมูลสุขภาพ</h2>
            </div>
            <div className="p-4 space-y-4">
              <InfoRow
                icon={Heart}
                label="โรคประจำตัว"
                value={profile?.chronic_diseases?.join(', ') || '-'}
                multiline
              />
              <InfoRow
                icon={AlertCircle}
                label="อาการ/สภาพ"
                value={profile?.medical_condition || '-'}
                multiline
              />
              <InfoRow
                icon={Pill}
                label="หมายเหตุการรักษา"
                value={profile?.medical_notes || '-'}
                multiline
              />
            </div>
          </CardContent>
        </Card>

        {/* Allergies */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="bg-orange-500/10 p-2 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
              </div>
              <h2 className="font-bold text-foreground">การแพ้</h2>
            </div>
            <div className="p-4 space-y-4">
              {profile?.drug_allergies && profile.drug_allergies.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">
                    แพ้ยา
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.drug_allergies.map((drug, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium"
                      >
                        {drug}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile?.food_allergies && profile.food_allergies.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">
                    แพ้อาหาร
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.food_allergies.map((food, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium"
                      >
                        {food}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(!profile?.drug_allergies || profile.drug_allergies.length === 0) &&
                (!profile?.food_allergies || profile.food_allergies.length === 0) && (
                  <p className="text-sm text-muted-foreground">ไม่มีข้อมูลการแพ้</p>
                )}
            </div>
          </CardContent>
        </Card>

        {/* Hospital Info */}
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-xl">
                <Hospital className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="font-bold text-foreground">โรงพยาบาล/ผู้ติดต่อฉุกเฉิน</h2>
            </div>
            <div className="p-4 space-y-4">
              <InfoRow icon={Hospital} label="โรงพยาบาล" value={profile?.hospital_name || '-'} />
              <InfoRow icon={Phone} label="เบอร์โรงพยาบาล" value={profile?.hospital_phone || '-'} />
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-3">
                  ผู้ติดต่อฉุกเฉิน
                </p>
                <InfoRow icon={User} label="ชื่อ" value={profile?.emergency_contact_name || '-'} />
                <InfoRow
                  icon={Users}
                  label="ความสัมพันธ์"
                  value={profile?.emergency_contact_relation || '-'}
                />
                <InfoRow icon={Phone} label="เบอร์โทร" value={profile?.emergency_contact_phone || '-'} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Caregivers */}
        {caregivers && caregivers.length > 0 && (
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="bg-purple-500/10 p-2 rounded-xl">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <h2 className="font-bold text-foreground">ผู้ดูแล ({caregivers.length})</h2>
              </div>
              <div className="p-4 space-y-3">
                {caregivers.map((caregiver) => (
                  <div
                    key={caregiver.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 font-bold">
                      {(caregiver.first_name || 'U')[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">
                        {caregiver.first_name} {caregiver.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{caregiver.relationship || 'ผู้ดูแล'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  multiline?: boolean;
}

function InfoRow({ icon: Icon, label, value, multiline }: InfoRowProps) {
  return (
    <div className={cn('flex', multiline ? 'flex-col gap-1' : 'items-center justify-between')}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn('text-sm font-medium text-foreground', multiline && 'pl-6')}>{value}</p>
    </div>
  );
}
