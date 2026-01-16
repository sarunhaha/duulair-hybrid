-- ========================================
-- Update Vitals Source Constraint
-- Migration: 010
-- Created: 2026-01-16
-- Description: อัปเดต check constraint ของ source column ใน vitals_logs
--              เพื่อรองรับแหล่งข้อมูลหลากหลาย
-- ========================================

-- Drop existing constraint (if exists)
ALTER TABLE vitals_logs DROP CONSTRAINT IF EXISTS vitals_logs_source_check;

-- Add new constraint with all valid source values
-- manual: บันทึกผ่าน LIFF form
-- text: บันทึกผ่าน LINE chat/conversation
-- conversation: บันทึกผ่าน LINE chat (alias)
-- image: บันทึกจาก OCR รูปภาพ
-- ocr: บันทึกจาก OCR (alias)
-- device: บันทึกจากอุปกรณ์วัด
ALTER TABLE vitals_logs ADD CONSTRAINT vitals_logs_source_check
  CHECK (source IN ('manual', 'text', 'conversation', 'image', 'ocr', 'device'));

-- Update comment
COMMENT ON COLUMN vitals_logs.source IS 'แหล่งข้อมูล: manual (LIFF/พิมพ์เอง), text/conversation (LINE chat), image/ocr (OCR รูปภาพ), device (อุปกรณ์)';

-- ========================================
-- End of Migration
-- ========================================
