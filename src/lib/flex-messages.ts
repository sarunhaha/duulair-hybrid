/**
 * Shared Flex Message builders
 * Reusable across index.ts and API routes
 */

import { FlexMessage } from '@line/bot-sdk';

// OONJAI Design System constants
export const OJ = {
  primary: '#0FA968',
  text: '#3B4C63',
  textMuted: '#7B8DA0',
  card: '#FFFFFF',
  border: '#E2E8F0',
  bg: '#F5F7FA',
  danger: '#EF4444',
};

function ojDot(color: string, size = '10px') {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    contents: [] as any[],
    width: size,
    height: size,
    backgroundColor: color,
    cornerRadius: '50px',
    flex: 0,
  };
}

export function onjaiHeader(title: string, subtitle?: string) {
  const brandingRow = {
    type: 'box' as const,
    layout: 'horizontal' as const,
    contents: [
      ojDot('#FFFFFF'),
      { type: 'text' as const, text: 'อุ่นใจ', size: 'xs' as const, color: '#FFFFFF', margin: 'sm' as const, weight: 'bold' as const, flex: 0 },
      ...(subtitle ? [{ type: 'text' as const, text: subtitle, size: 'xs' as const, color: '#FFFFFFB3', margin: 'md' as const }] : []),
    ],
    alignItems: 'center' as const,
  };

  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    contents: [
      brandingRow,
      {
        type: 'text' as const,
        text: title,
        weight: 'bold' as const,
        size: 'xl' as const,
        color: '#FFFFFF',
        margin: 'md' as const,
      },
    ],
    backgroundColor: OJ.primary,
    paddingAll: 'xl' as const,
    paddingBottom: 'lg' as const,
  };
}

function menuTile(emoji: string, label: string, text: string, bgColor: string) {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    backgroundColor: bgColor,
    cornerRadius: 'lg' as const,
    paddingAll: 'lg' as const,
    flex: 1,
    action: { type: 'message' as const, label, text },
    contents: [
      { type: 'text' as const, text: emoji, size: 'xxl' as const, align: 'center' as const },
      { type: 'text' as const, text: label, size: 'sm' as const, align: 'center' as const, weight: 'bold' as const, margin: 'sm' as const },
    ],
  };
}

function menuRow(...tiles: ReturnType<typeof menuTile>[]) {
  return {
    type: 'box' as const,
    layout: 'horizontal' as const,
    spacing: 'md' as const,
    contents: tiles,
  };
}

export function createHealthLogMenuFlexMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: '🩺 บันทึกสุขภาพวันนี้',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: onjaiHeader('บันทึกสุขภาพวันนี้', 'เลือกสิ่งที่ต้องการบันทึก'),
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          menuRow(
            menuTile('💊', 'กินยา', 'กินยาแล้ว', '#FEF3C7'),
            menuTile('💉', 'ความดัน', 'บันทึกความดัน', '#DBEAFE'),
          ),
          menuRow(
            menuTile('💧', 'ดื่มน้ำ', 'ดื่มน้ำ 1 แก้ว', '#D1FAE5'),
            menuTile('🏃', 'ออกกำลังกาย', 'ออกกำลังกายแล้ว', '#FCE7F3'),
          ),
          menuRow(
            menuTile('😴', 'การนอน', 'บันทึกการนอน', '#E0E7FF'),
            menuTile('🤒', 'อาการป่วย', 'บันทึกอาการ', '#FEE2E2'),
          ),
          menuRow(
            menuTile('😊', 'อารมณ์', 'บันทึกอารมณ์', '#FEF9C3'),
            menuTile('✏️', 'พิมพ์เอง', 'บันทึกอื่นๆ', '#F3F4F6'),
          ),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: 'หรือพิมพ์ตรงๆ ได้เลย เช่น "ความดัน 120/80"',
            size: 'xs',
            color: OJ.textMuted,
            align: 'center',
            wrap: true,
          },
        ],
      },
    },
  };
}

/**
 * Welcome onboarding messages — sent after consent accepted
 * Replicates the LINE OA greeting card template content
 */
export function createWelcomeOnboardingMessages(): Array<any> {
  const welcomeText = {
    type: 'text' as const,
    text: 'ยินดีต้อนรับค่ะ! 🌿\n\nอุ่นใจคือผู้ช่วยบันทึกสุขภาพผ่าน LINE ที่ช่วยเก็บข้อมูลให้เป็นระบบ\n\nเมื่อมีการบันทึกอย่างต่อเนื่อง คุณจะเห็นแนวโน้มสุขภาพได้ชัดเจน และตัดสินใจดูแลตัวเองได้ดีขึ้น\n\nดูวิธีใช้งานด้านล่างได้เลยค่ะ 👇',
  };

  const onboardingCard: FlexMessage = {
    type: 'flex',
    altText: 'บันทึกสุขภาพได้ครบใน LINE',
    contents: {
      type: 'carousel',
      contents: [
        // Card 1: บันทึกสุขภาพได้ครบใน LINE
        {
          type: 'bubble',
          size: 'mega',
          header: onjaiHeader('บันทึกสุขภาพได้ครบใน LINE'),
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'lg',
            spacing: 'md',
            contents: [
              { type: 'text', text: '💊 ค่าเลือด ค่าตับ ค่าไต', size: 'sm', color: OJ.text, wrap: true },
              { type: 'text', text: '💉 ความดัน น้ำตาล น้ำหนัก', size: 'sm', color: OJ.text, wrap: true },
              { type: 'text', text: '😴 การนอน อาหาร และอื่น ๆ', size: 'sm', color: OJ.text, wrap: true },
              { type: 'separator', margin: 'lg' },
              { type: 'text', text: 'พิมพ์เหมือนคุยปกติ\nระบบจะจัดเก็บให้เป็นระบบ', size: 'xs', color: OJ.textMuted, wrap: true, margin: 'lg' },
            ],
          },
        },
        // Card 2: ข้อมูลสุขภาพของคุณ
        {
          type: 'bubble',
          size: 'mega',
          header: onjaiHeader('ข้อมูลสุขภาพของคุณ'),
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'lg',
            spacing: 'md',
            contents: [
              { type: 'text', text: '📊 ดูสรุปและแนวโน้มสุขภาพ', size: 'sm', color: OJ.text, wrap: true },
              { type: 'text', text: '⏰ ตั้งเตือนกินยา / นัดหมอ', size: 'sm', color: OJ.text, wrap: true },
              { type: 'text', text: '📋 รายงานสุขภาพส่งหมอ', size: 'sm', color: OJ.text, wrap: true },
              { type: 'separator', margin: 'lg' },
              { type: 'text', text: 'กดเมนูด้านล่าง หรือพิมพ์ได้เลยค่ะ', size: 'xs', color: OJ.textMuted, wrap: true, margin: 'lg' },
            ],
          },
        },
      ],
    },
  };

  return [welcomeText, onboardingCard];
}
