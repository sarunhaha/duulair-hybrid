import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Check,
  Crown,
  Sparkles,
  Heart,
  Zap,
  Shield,
  Users,
  BarChart3,
  FileText,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Package {
  id: string;
  name: string;
  nameTh: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  icon: typeof Crown;
  color: string;
}

const packages: Package[] = [
  {
    id: 'free',
    name: 'Free',
    nameTh: 'ฟรี',
    price: 0,
    period: 'ตลอดชีพ',
    description: 'เริ่มต้นดูแลสุขภาพ',
    features: [
      'บันทึกความดัน, ชีพจร',
      'บันทึกการกินยา',
      'แจ้งเตือนพื้นฐาน',
      'ดูประวัติ 7 วันย้อนหลัง',
      'เชื่อมต่อผู้ดูแล 1 คน',
    ],
    icon: Heart,
    color: 'text-green-500',
  },
  {
    id: 'plus',
    name: 'Plus',
    nameTh: 'พลัส',
    price: 99,
    period: '/เดือน',
    description: 'สำหรับการดูแลที่ครบครัน',
    features: [
      'ทุกอย่างใน Free',
      'ดูประวัติไม่จำกัด',
      'รายงาน PDF',
      'กราฟวิเคราะห์แนวโน้ม',
      'เชื่อมต่อผู้ดูแล 3 คน',
      'แจ้งเตือนขั้นสูง',
    ],
    popular: true,
    icon: Sparkles,
    color: 'text-accent',
  },
  {
    id: 'premium',
    name: 'Premium',
    nameTh: 'พรีเมียม',
    price: 199,
    period: '/เดือน',
    description: 'สำหรับครอบครัว',
    features: [
      'ทุกอย่างใน Plus',
      'ดูแลได้หลายคนในครอบครัว',
      'เชื่อมต่อผู้ดูแลไม่จำกัด',
      'แชร์ข้อมูลกับแพทย์',
      'ปรึกษา AI ขั้นสูง',
      'สรุปรายสัปดาห์อัตโนมัติ',
      'Priority Support',
    ],
    icon: Crown,
    color: 'text-purple-500',
  },
];

const featureIcons: Record<string, typeof Check> = {
  'บันทึกความดัน, ชีพจร': Heart,
  'บันทึกการกินยา': Zap,
  'แจ้งเตือนพื้นฐาน': Clock,
  'ดูประวัติ 7 วันย้อนหลัง': BarChart3,
  'เชื่อมต่อผู้ดูแล 1 คน': Users,
  'ดูประวัติไม่จำกัด': BarChart3,
  'รายงาน PDF': FileText,
  'กราฟวิเคราะห์แนวโน้ม': BarChart3,
  'เชื่อมต่อผู้ดูแล 3 คน': Users,
  'แจ้งเตือนขั้นสูง': Clock,
  'ดูแลได้หลายคนในครอบครัว': Users,
  'เชื่อมต่อผู้ดูแลไม่จำกัด': Users,
  'แชร์ข้อมูลกับแพทย์': Shield,
  'ปรึกษา AI ขั้นสูง': Sparkles,
  'สรุปรายสัปดาห์อัตโนมัติ': FileText,
  'Priority Support': Shield,
};

export default function PackagePage() {
  const [, navigate] = useLocation();
  const [selectedPackage, setSelectedPackage] = useState<string>('free');
  const [isYearly, setIsYearly] = useState(false);

  const handleSubscribe = (packageId: string) => {
    if (packageId === 'free') {
      // Already on free plan
      return;
    }
    // TODO: Implement subscription flow
    alert(`สมัครแพ็กเกจ ${packages.find(p => p.id === packageId)?.nameTh} กำลังพัฒนา`);
  };

  const getPrice = (pkg: Package) => {
    if (pkg.price === 0) return 'ฟรี';
    const price = isYearly ? Math.floor(pkg.price * 10) : pkg.price;
    return `฿${price}`;
  };

  const getPeriod = (pkg: Package) => {
    if (pkg.price === 0) return pkg.period;
    return isYearly ? '/ปี' : '/เดือน';
  };

  return (
    <div className="min-h-screen bg-background pb-8 font-sans">
      {/* Header */}
      <header className="bg-card pt-12 pb-4 px-4 sticky top-0 z-20 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">แพ็กเกจ</h1>
            <p className="text-xs text-muted-foreground">เลือกแพ็กเกจที่เหมาะกับคุณ</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 bg-muted/20 p-2 rounded-2xl">
          <button
            onClick={() => setIsYearly(false)}
            className={cn(
              'flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors',
              !isYearly ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            รายเดือน
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={cn(
              'flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors relative',
              isYearly ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            )}
          >
            รายปี
            <span className="absolute -top-2 -right-2 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              -17%
            </span>
          </button>
        </div>

        {/* Package Cards */}
        <div className="space-y-4">
          {packages.map((pkg) => {
            const Icon = pkg.icon;
            const isSelected = selectedPackage === pkg.id;

            return (
              <Card
                key={pkg.id}
                className={cn(
                  'border-2 transition-all cursor-pointer relative overflow-hidden',
                  isSelected ? 'border-accent shadow-lg' : 'border-transparent',
                  pkg.popular && 'ring-2 ring-accent/20'
                )}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    แนะนำ
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-xl bg-muted/20', pkg.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">{pkg.nameTh}</CardTitle>
                        <p className="text-xs text-muted-foreground">{pkg.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{getPrice(pkg)}</p>
                      <p className="text-xs text-muted-foreground">{getPeriod(pkg)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {pkg.features.map((feature, idx) => {
                      const FeatureIcon = featureIcons[feature] || Check;
                      return (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                            <FeatureIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe(pkg.id);
                    }}
                    className={cn(
                      'w-full mt-4 rounded-2xl h-11',
                      pkg.id === 'free'
                        ? 'bg-muted text-muted-foreground hover:bg-muted'
                        : pkg.popular
                          ? 'bg-accent hover:bg-accent/90'
                          : ''
                    )}
                    disabled={pkg.id === 'free'}
                  >
                    {pkg.id === 'free' ? 'แพ็กเกจปัจจุบัน' : 'สมัครเลย'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">คำถามที่พบบ่อย</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">ยกเลิกได้เมื่อไหร่?</p>
              <p className="text-xs text-muted-foreground mt-1">
                คุณสามารถยกเลิกได้ทุกเมื่อ และจะใช้งานได้จนครบรอบบิล
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">ข้อมูลจะหายไหมถ้ายกเลิก?</p>
              <p className="text-xs text-muted-foreground mt-1">
                ไม่หาย ข้อมูลทั้งหมดจะยังคงอยู่ แต่คุณจะใช้ได้เฉพาะฟีเจอร์ Free
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">ชำระเงินอย่างไร?</p>
              <p className="text-xs text-muted-foreground mt-1">
                รองรับบัตรเครดิต, LINE Pay, และ QR PromptPay
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
