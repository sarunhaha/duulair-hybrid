import { useLiff } from '@/lib/liff/provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageCircleHeart,
  ArrowRight,
  Heart,
  Sparkles,
} from 'lucide-react';

/**
 * Welcome Page - Conversational Onboarding Entry Point
 *
 * This page replaces form-based registration with a friendly welcome
 * that directs users to chat with "น้องอุ่น" for conversational onboarding.
 *
 * Flow: User opens LIFF → Sees welcome → Clicks "เริ่มคุยกับน้องอุ่น" → Returns to LINE Chat
 */
export default function WelcomePage() {
  const { profile, isInClient, closeWindow } = useLiff();

  const handleStartChat = () => {
    // Close LIFF and return to LINE Chat
    if (isInClient) {
      closeWindow();
    } else {
      // If not in LINE, redirect to LINE OA
      window.location.href = 'https://lin.ee/oonjai';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      <div className="max-w-md mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Hero Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-none shadow-xl overflow-hidden relative mb-8">
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-white/5 rounded-full" />
          <CardContent className="pt-12 pb-12 text-center relative z-10">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 ring-4 ring-white/30">
              <MessageCircleHeart className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-3xl font-bold mb-2">สวัสดีค่ะ!</h1>
            <p className="text-white/90 text-lg mb-1">น้องอุ่นเองค่ะ</p>
            <p className="text-white/80 text-sm">ผู้ช่วยดูแลสุขภาพส่วนตัวของคุณ</p>
          </CardContent>
        </Card>

        {/* Welcome Message */}
        <div className="text-center mb-8 space-y-4">
          {profile?.displayName && (
            <p className="text-lg text-foreground">
              ยินดีต้อนรับ <span className="font-semibold text-primary">{profile.displayName}</span>
            </p>
          )}

          <p className="text-muted-foreground leading-relaxed">
            น้องอุ่นพร้อมช่วยดูแลสุขภาพของคุณและคนที่คุณรัก
            ผ่านการพูดคุยง่ายๆ ทุกวัน
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card p-4 rounded-2xl border shadow-sm text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">คุยแล้วเก็บ</p>
            <p className="text-xs text-muted-foreground mt-1">บันทึกสุขภาพง่ายๆ ผ่านการพูดคุย</p>
          </div>

          <div className="bg-card p-4 rounded-2xl border shadow-sm text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <p className="text-sm font-medium text-foreground">เข้าใจธรรมชาติ</p>
            <p className="text-xs text-muted-foreground mt-1">พิมพ์ยังไงก็ได้ เราเข้าใจ</p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleStartChat}
          size="lg"
          className="w-full h-14 text-lg gap-3 shadow-lg"
        >
          เริ่มคุยกับน้องอุ่น
          <ArrowRight className="w-5 h-5" />
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          กลับไป LINE Chat เพื่อเริ่มพูดคุย
        </p>
      </div>
    </div>
  );
}
