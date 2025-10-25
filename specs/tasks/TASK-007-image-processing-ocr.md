# TASK-007: Image Processing & OCR

**Priority:** 🟢 Medium
**Status:** 📋 Ready to Start
**Owner:** Backend Developer / AI/Vision Specialist
**Estimated Time:** 6-8 hours
**Dependencies:** TASK-003 (Health Logging)

---

## 📝 Overview

พัฒนาระบบประมวลผลรูปภาพ:
- 🩺 **OCR สำหรับเครื่องวัดความดัน** (Blood Pressure Device OCR)
- 💊 **OCR สำหรับฉลากยา** (Medication Label OCR)
- 🍽️ **Image Classification สำหรับอาหาร** (Food Recognition - future)

ใช้ Claude Vision API เพื่อวิเคราะห์รูปภาพ

---

## 🎯 User Stories

### Story 1: Blood Pressure OCR
**As a** ผู้ป่วย
**I want** ส่งรูปเครื่องวัดความดันแทนการพิมพ์
**So that** บันทึกได้ง่ายและถูกต้อง

**Acceptance Criteria:**
- ✅ ส่งรูปเครื่องวัดความดัน → ระบบอ่านค่า SYS/DIA/HR อัตโนมัติ
- ✅ รองรับเครื่องวัดหลายยี่ห้อ (Omron, Beurer, etc.)
- ✅ Confirm ก่อนบันทึก
- ✅ แจ้งถ้าอ่านค่าไม่ได้

### Story 2: Medication Label OCR
**As a** ผู้ป่วย
**I want** ส่งรูปฉลากยาเพื่อเพิ่มยาในระบบ
**So that** ไม่ต้องพิมพ์ชื่อยาที่ยาว

**Acceptance Criteria:**
- ✅ ส่งรูปฉลากยา → อ่านชื่อยา, ขนาด, วิธีใช้
- ✅ Confirm ข้อมูลก่อนบันทึก
- ✅ เก็บรูปไว้ใน database

### Story 3: Food Recognition (Future)
**As a** ผู้ป่วย
**I want** ส่งรูปอาหารแล้วระบบวิเคราะห์โภชนาการ
**So that** รู้ว่ากินอาหารถูกหรือไม่

**Acceptance Criteria:**
- ✅ ส่งรูปอาหาร → ระบบบอกว่าเป็นอาหารอะไร
- ✅ ประมาณแคลอรี่และโภชนาการ
- ✅ แนะนำว่าเหมาะสมหรือไม่ (based on chronic diseases)

---

## 🛠 Technical Implementation

### 1. Database Schema

```sql
-- Image Uploads Table
CREATE TABLE image_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Image info
  image_type VARCHAR(50) NOT NULL, -- bp_device, medication_label, food, other
  image_url TEXT NOT NULL,
  original_filename VARCHAR(255),
  file_size_bytes INT,

  -- Processing status
  processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMPTZ,

  -- OCR/Vision results
  ocr_result JSONB,
  extracted_data JSONB,
  confidence_score DECIMAL(3,2), -- 0.00-1.00

  -- Link to health log (if confirmed)
  health_log_id UUID REFERENCES health_logs(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_image_type CHECK (image_type IN ('bp_device', 'medication_label', 'food', 'other')),
  CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_image_uploads_patient ON image_uploads(patient_id);
CREATE INDEX idx_image_uploads_type ON image_uploads(image_type);
CREATE INDEX idx_image_uploads_status ON image_uploads(processing_status);
CREATE INDEX idx_image_uploads_created ON image_uploads(created_at DESC);

-- RLS Policies
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;

-- Patients can manage their own images
CREATE POLICY "Patients can manage own images"
  ON image_uploads FOR ALL
  USING (patient_id IN (
    SELECT id FROM patients WHERE line_user_id = auth.uid()::text
  ))
  WITH CHECK (patient_id IN (
    SELECT id FROM patients WHERE line_user_id = auth.uid()::text
  ));

-- Service role can manage all
CREATE POLICY "Service can manage all images"
  ON image_uploads FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 2. Image Upload & Storage

**Setup Supabase Storage:**

```typescript
// Create storage bucket
const { data, error } = await supabase.storage.createBucket('health-images', {
  public: false,
  fileSizeLimit: 5242880, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png']
});
```

### 3. API Endpoints

**File:** `src/routes/image.routes.ts` (new file)

```typescript
import { Router } from 'express';
import multer from 'multer';
import { SupabaseService } from '../services/supabase.service';
import { ImageProcessingService } from '../services/image-processing.service';

const router = Router();
const supabase = new SupabaseService();
const imageProcessor = new ImageProcessingService();

// Multer config (memory storage for processing before upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images allowed'));
    }
  }
});

// POST /api/images/upload
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { patient_id, image_type } = req.body;

    if (!patient_id || !image_type) {
      return res.status(400).json({ error: 'patient_id and image_type required' });
    }

    // Upload to Supabase Storage
    const fileName = `${patient_id}/${Date.now()}-${req.file.originalname}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('health-images')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('health-images')
      .getPublicUrl(fileName);

    // Create image record
    const { data: imageRecord, error: dbError } = await supabase.client
      .from('image_uploads')
      .insert({
        patient_id,
        image_type,
        image_url: urlData.publicUrl,
        original_filename: req.file.originalname,
        file_size_bytes: req.file.size,
        processing_status: 'pending'
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Process image asynchronously
    processImageAsync(imageRecord.id, urlData.publicUrl, image_type);

    res.json({
      success: true,
      data: imageRecord,
      message: 'Image uploaded, processing...'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/images/:image_id/status
router.get('/:image_id/status', async (req, res) => {
  try {
    const { image_id } = req.params;

    const { data, error } = await supabase.client
      .from('image_uploads')
      .select('*')
      .eq('id', image_id)
      .single();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/images/:image_id/confirm
router.post('/:image_id/confirm', async (req, res) => {
  try {
    const { image_id } = req.params;
    const { confirmed_data } = req.body; // User-confirmed extracted data

    // Get image record
    const { data: image } = await supabase.client
      .from('image_uploads')
      .select('*')
      .eq('id', image_id)
      .single();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Create health log based on image type
    let healthLog;

    if (image.image_type === 'bp_device') {
      const { data } = await supabase.client
        .from('health_logs')
        .insert({
          patient_id: image.patient_id,
          log_type: 'vitals',
          log_data: {
            systolic: confirmed_data.systolic,
            diastolic: confirmed_data.diastolic,
            heart_rate: confirmed_data.heart_rate,
            measurement_method: 'ocr'
          },
          logged_at: new Date()
        })
        .select()
        .single();

      healthLog = data;
    }

    // Link image to health log
    await supabase.client
      .from('image_uploads')
      .update({ health_log_id: healthLog?.id })
      .eq('id', image_id);

    res.json({ success: true, health_log: healthLog });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process image asynchronously
async function processImageAsync(imageId: string, imageUrl: string, imageType: string) {
  try {
    // Update status
    await supabase.client
      .from('image_uploads')
      .update({ processing_status: 'processing' })
      .eq('id', imageId);

    // Process with Claude Vision
    const result = await imageProcessor.processImage(imageUrl, imageType);

    // Update with results
    await supabase.client
      .from('image_uploads')
      .update({
        processing_status: 'completed',
        processed_at: new Date(),
        ocr_result: result.raw,
        extracted_data: result.extracted,
        confidence_score: result.confidence
      })
      .eq('id', imageId);

    console.log(`✅ Image ${imageId} processed successfully`);

  } catch (error) {
    console.error('Error processing image:', error);

    await supabase.client
      .from('image_uploads')
      .update({
        processing_status: 'failed',
        processed_at: new Date()
      })
      .eq('id', imageId);
  }
}

export default router;
```

### 4. Image Processing Service

**File:** `src/services/image-processing.service.ts` (new file)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

export class ImageProcessingService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async processImage(imageUrl: string, imageType: string) {
    // Download image as base64
    const imageData = await this.downloadImageAsBase64(imageUrl);

    switch (imageType) {
      case 'bp_device':
        return this.processBPDevice(imageData);
      case 'medication_label':
        return this.processMedicationLabel(imageData);
      case 'food':
        return this.processFood(imageData);
      default:
        throw new Error('Unknown image type');
    }
  }

  private async processBPDevice(imageData: { base64: string, mediaType: string }) {
    const systemPrompt = `You are analyzing a blood pressure monitor display.

Extract these values:
- Systolic (SYS): top number
- Diastolic (DIA): bottom number
- Heart Rate (HR/Pulse): if visible

Common formats:
- "SYS 120 / DIA 80 / HR 72"
- "120 / 80  72"
- Thai displays may use "ค่าบน/ค่าล่าง"

Return JSON only:
{
  "systolic": number,
  "diastolic": number,
  "heart_rate": number or null,
  "confidence": 0.0-1.0,
  "raw_text": "what you see"
}

If unable to read clearly, set confidence < 0.7`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mediaType,
              data: imageData.base64
            }
          },
          {
            type: 'text',
            text: 'Extract blood pressure readings from this device display.'
          }
        ]
      }],
      system: systemPrompt
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);

    return {
      raw: result,
      extracted: {
        systolic: result.systolic,
        diastolic: result.diastolic,
        heart_rate: result.heart_rate
      },
      confidence: result.confidence
    };
  }

  private async processMedicationLabel(imageData: { base64: string, mediaType: string }) {
    const systemPrompt = `You are analyzing a medication label (Thai or English).

Extract:
- Medication name
- Dosage (e.g., "5mg", "500mg")
- Frequency (e.g., "1x daily", "2x daily", "before meals")
- Special instructions

Return JSON:
{
  "medication_name": "string",
  "dosage": "string",
  "frequency": "string",
  "instructions": "string",
  "confidence": 0.0-1.0,
  "raw_text": "full label text"
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mediaType,
              data: imageData.base64
            }
          },
          {
            type: 'text',
            text: 'Extract medication information from this label.'
          }
        ]
      }],
      system: systemPrompt
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);

    return {
      raw: result,
      extracted: {
        medication_name: result.medication_name,
        dosage: result.dosage,
        frequency: result.frequency,
        instructions: result.instructions
      },
      confidence: result.confidence
    };
  }

  private async processFood(imageData: { base64: string, mediaType: string }) {
    const systemPrompt = `You are analyzing a food image for a Thai elderly patient.

Identify:
- Food items visible
- Estimated calories
- Nutritional highlights (high sodium, high sugar, healthy, etc.)
- Suitability for common chronic conditions (diabetes, hypertension)

Return JSON:
{
  "food_items": ["item1", "item2"],
  "estimated_calories": number,
  "nutrition_notes": "string",
  "health_score": 1-10,
  "warnings": ["warning1"] or [],
  "confidence": 0.0-1.0
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mediaType,
              data: imageData.base64
            }
          },
          {
            type: 'text',
            text: 'Analyze this food image for nutritional information.'
          }
        ]
      }],
      system: systemPrompt
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);

    return {
      raw: result,
      extracted: result,
      confidence: result.confidence
    };
  }

  private async downloadImageAsBase64(imageUrl: string): Promise<{ base64: string, mediaType: string }> {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mediaType = response.headers['content-type'] || 'image/jpeg';

    return { base64, mediaType };
  }
}
```

### 5. Handle Image Messages in Webhook

**File:** `src/index.ts`

```typescript
// In webhook handler
events.map(async (event) => {
  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        return handleTextMessage(event);
      } else if (event.message.type === 'image') {
        return handleImageMessage(event);
      }
      break;
  }
});

// Handle image message
async function handleImageMessage(event: any) {
  try {
    const messageId = event.message.id;
    const userId = event.source?.userId;
    const replyToken = event.replyToken;

    // Get patient
    const { data: patient } = await supabase.client
      .from('patients')
      .select('id')
      .eq('line_user_id', userId)
      .single();

    if (!patient) {
      await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: 'กรุณาลงทะเบียนก่อนใช้งานค่ะ'
      });
      return;
    }

    // Get image content from LINE
    const stream = await lineClient.getMessageContent(messageId);
    const chunks: any[] = [];

    await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);

    // Ask user what type of image
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: 'ได้รับรูปภาพแล้วค่ะ นี่คือรูปอะไรคะ?',
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '🩺 เครื่องวัดความดัน',
              data: `action=upload_image&type=bp_device&message_id=${messageId}`
            }
          },
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '💊 ฉลากยา',
              data: `action=upload_image&type=medication_label&message_id=${messageId}`
            }
          },
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '🍽️ อาหาร',
              data: `action=upload_image&type=food&message_id=${messageId}`
            }
          }
        ]
      }
    });

    // Store buffer temporarily (or upload immediately)
    // ... implementation depends on architecture

  } catch (error) {
    console.error('Error handling image:', error);
  }
}

// Handle postback for image type selection
async function handlePostback(event: any) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'upload_image') {
    const imageType = data.get('type');
    const messageId = data.get('message_id');

    // Upload and process image
    // ... (call /api/images/upload)

    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '⏳ กำลังประมวลผลรูปภาพ กรุณารอสักครู่ค่ะ...'
    });
  }
}
```

---

## 📂 Files to Create/Modify

### New Files:
1. `src/routes/image.routes.ts` - Image upload & processing API
2. `src/services/image-processing.service.ts` - Claude Vision integration
3. `database/migrations/007_image_uploads.sql` - Image uploads table

### Modified Files:
1. `src/index.ts` - Handle image messages, postback for image types

### Dependencies to Install:
```bash
npm install multer @types/multer axios
```

---

## ✅ Testing Checklist

### OCR Accuracy Tests
- [ ] Test BP device OCR (Omron, Beurer, generic)
- [ ] Test medication label OCR (Thai, English)
- [ ] Test food recognition
- [ ] Test low-quality images
- [ ] Test confidence scoring

### API Tests
- [ ] POST /api/images/upload
- [ ] GET /api/images/:image_id/status
- [ ] POST /api/images/:image_id/confirm

### LINE Bot Tests
- [ ] ส่งรูปเครื่องวัดความดัน → แสดง Quick Reply
- [ ] เลือกประเภท → ประมวลผล → แสดงผลลัพธ์
- [ ] Confirm ข้อมูล → บันทึกลง health_logs

---

## 🚀 Deployment

```bash
# Install dependencies
npm install multer @types/multer axios

# Create Supabase storage bucket (via UI or API)
# Bucket name: health-images
# Public: false
# Max file size: 5MB

# Create migration
cat > database/migrations/007_image_uploads.sql << 'EOF'
-- (SQL code from above)
EOF

# Run migration
psql $SUPABASE_DB_URL -f database/migrations/007_image_uploads.sql

# Build and deploy
npm run build
git add .
git commit -m "Add image processing and OCR with Claude Vision"
git push origin master
```

---

## 📊 Success Metrics

- ✅ OCR accuracy > 90%
- ✅ Processing time < 5 seconds
- ✅ User confirmation rate > 80%
- ✅ Image upload success rate > 95%

---

**Created:** 2025-10-25
**Last Updated:** 2025-10-25
**Version:** 1.0.0
