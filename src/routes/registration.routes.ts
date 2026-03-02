/**
 * Registration API Routes
 * API endpoints สำหรับการลงทะเบียนผู้ใช้
 */

import { Router, Request, Response } from 'express';
import { userService } from '../services/user.service';
import {
  PatientRegistrationForm,
  CaregiverRegistrationForm
} from '../types/user.types';

const router = Router();

/**
 * POST /api/registration/check
 * ตรวจสอบว่า user ลงทะเบียนแล้วหรือยัง
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    console.log('📨 POST /api/registration/check - Request body:', JSON.stringify(req.body));

    const { line_user_id } = req.body;

    if (!line_user_id) {
      console.error('❌ Missing line_user_id in request');
      return res.status(400).json({
        success: false,
        error: 'line_user_id is required'
      });
    }

    console.log(`🔍 Checking user exists: ${line_user_id}`);

    const result = await userService.checkUserExists(line_user_id);

    console.log('✅ Check user result:', JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    console.error('❌ Check user error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      error: error.message || 'ตรวจสอบผู้ใช้ไม่สำเร็จ',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/registration/accept-consent
 * Accept PDPA consent (Terms & Conditions + Privacy Notice)
 */
router.post('/accept-consent', async (req: Request, res: Response) => {
  try {
    const { line_user_id, consent_version, caregiver_share, marketing } = req.body;

    if (!line_user_id) {
      return res.status(400).json({
        success: false,
        error: 'line_user_id is required'
      });
    }

    const result = await userService.acceptConsent(line_user_id, {
      consentVersion: consent_version || '1.0',
      caregiverShare: caregiver_share || false,
      marketing: marketing || false,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Accept consent error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'บันทึกความยินยอมไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/auto-create
 * Auto-create minimal patient profile for LIFF health recording
 * สร้าง patient profile อัตโนมัติ เมื่อ user ต้องการบันทึกข้อมูลสุขภาพ
 */
router.post('/auto-create', async (req: Request, res: Response) => {
  try {
    const { line_user_id, display_name, picture_url } = req.body;

    if (!line_user_id || !display_name) {
      return res.status(400).json({
        success: false,
        error: 'line_user_id and display_name are required'
      });
    }

    const result = await userService.autoCreatePatient(
      line_user_id,
      display_name,
      picture_url
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Auto-create patient error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'สร้าง patient profile ไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/patient
 * ลงทะเบียน Patient
 */
router.post('/patient', async (req: Request, res: Response) => {
  try {
    const { line_user_id, display_name, picture_url, ...form } = req.body;

    // Validate required fields
    if (!line_user_id) {
      return res.status(400).json({
        success: false,
        error: 'line_user_id is required'
      });
    }

    if (!form.firstName || !form.lastName || !form.birthDate || !form.gender) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลพื้นฐานไม่ครบถ้วน (ชื่อ, นามสกุล, วันเกิด, เพศ)'
      });
    }

    if (!form.emergencyContactName || !form.emergencyContactPhone) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลติดต่อฉุกเฉินไม่ครบถ้วน'
      });
    }

    const result = await userService.registerPatient(
      line_user_id,
      display_name,
      picture_url,
      form as PatientRegistrationForm
    );

    res.json(result);
  } catch (error: any) {
    console.error('Register patient error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ลงทะเบียนสมาชิกไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/caregiver
 * ลงทะเบียน Caregiver
 */
router.post('/caregiver', async (req: Request, res: Response) => {
  try {
    const { line_user_id, display_name, picture_url, first_name, last_name, phone_number, ...form } = req.body;

    // Validate required fields
    if (!line_user_id) {
      return res.status(400).json({
        success: false,
        error: 'line_user_id is required'
      });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลพื้นฐานไม่ครบถ้วน (ชื่อ, นามสกุล)'
      });
    }

    // Prepare caregiver form with camelCase for service
    const caregiverForm: CaregiverRegistrationForm = {
      firstName: first_name,
      lastName: last_name,
      phoneNumber: phone_number,
      ...form
    };

    const result = await userService.registerCaregiver(
      line_user_id,
      display_name,
      picture_url,
      caregiverForm
    );

    res.json(result);
  } catch (error: any) {
    console.error('Register caregiver error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ลงทะเบียนผู้ดูแลไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/generate-link-code
 * สร้างรหัสเชื่อมต่อ 6 หลัก (สำหรับ patient)
 */
router.post('/generate-link-code', async (req: Request, res: Response) => {
  try {
    const { patient_id } = req.body;

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id is required'
      });
    }

    const result = await userService.generateLinkCode(patient_id);

    res.json(result);
  } catch (error: any) {
    console.error('Generate link code error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'สร้างรหัสเชื่อมต่อไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/link-patient
 * เชื่อมต่อ caregiver กับ patient ผ่านรหัส 6 หลัก
 */
router.post('/link-patient', async (req: Request, res: Response) => {
  try {
    const { caregiver_id, link_code, relationship } = req.body;

    if (!caregiver_id || !link_code) {
      return res.status(400).json({
        success: false,
        error: 'caregiver_id และ link_code จำเป็น'
      });
    }

    if (!relationship) {
      return res.status(400).json({
        success: false,
        error: 'relationship จำเป็น'
      });
    }

    const result = await userService.linkPatientToCaregiver(
      caregiver_id,
      link_code,
      relationship
    );

    res.json(result);
  } catch (error: any) {
    console.error('Link patient error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'เชื่อมต่อไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/approve-caregiver
 * อนุมัติหรือปฏิเสธ caregiver (สำหรับ patient)
 */
router.post('/approve-caregiver', async (req: Request, res: Response) => {
  try {
    const { relationshipId, approved } = req.body;

    if (!relationshipId || typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'relationshipId และ approved จำเป็น'
      });
    }

    const result = await userService.approveCaregiver(
      relationshipId,
      approved
    );

    res.json(result);
  } catch (error: any) {
    console.error('Approve caregiver error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'อนุมัติไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/profile/patient/:id
 * ดึงข้อมูล patient profile
 */
router.get('/profile/patient/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const profile = await userService.getPatientProfile(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลสมาชิก'
      });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('Get patient profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * PUT /api/profile/patient/:id
 * แก้ไข patient profile
 */
router.put('/profile/patient/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`📝 [PUT /profile/patient/${id}] Received update request:`, updates);

    const profile = await userService.updatePatientProfile(id, updates);

    console.log(`✅ [PUT /profile/patient/${id}] Updated profile:`, profile);

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('Update patient profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'แก้ไขข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/profile/caregiver/:id
 * ดึงข้อมูล caregiver profile
 */
router.get('/profile/caregiver/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const profile = await userService.getCaregiverProfile(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลผู้ดูแล'
      });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('Get caregiver profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * PUT /api/profile/caregiver/:id
 * แก้ไข caregiver profile
 */
router.put('/profile/caregiver/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const profile = await userService.updateCaregiverProfile(id, updates);

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('Update caregiver profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'แก้ไขข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/health-goals/:patientId
 * ดึงข้อมูล health goals
 */
router.get('/health-goals/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const goals = await userService.getHealthGoals(patientId);

    res.json({
      success: true,
      goals
    });
  } catch (error: any) {
    console.error('Get health goals error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * PUT /api/health-goals/:patientId
 * แก้ไข health goals
 */
router.put('/health-goals/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const updates = req.body;

    const goals = await userService.updateHealthGoals(patientId, updates);

    res.json({
      success: true,
      goals
    });
  } catch (error: any) {
    console.error('Update health goals error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'แก้ไขเป้าหมายไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/notification-settings/:patientId
 * ดึงข้อมูล notification settings
 */
router.get('/notification-settings/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const settings = await userService.getNotificationSettings(patientId);

    res.json({
      success: true,
      settings
    });
  } catch (error: any) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * PUT /api/notification-settings/:patientId
 * แก้ไข notification settings
 */
router.put('/notification-settings/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const updates = req.body;

    const settings = await userService.updateNotificationSettings(patientId, updates);

    res.json({
      success: true,
      settings
    });
  } catch (error: any) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'แก้ไขการตั้งค่าไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/medications/:patientId
 * ดึงรายการยาของ patient
 */
router.get('/medications/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const medications = await userService.getPatientMedications(patientId);

    res.json({
      success: true,
      medications
    });
  } catch (error: any) {
    console.error('Get medications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/medications/:patientId
 * เพิ่มยา
 */
router.post('/medications/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const medication = req.body;

    const result = await userService.addMedication(patientId, medication);

    res.json({
      success: true,
      medication: result
    });
  } catch (error: any) {
    console.error('Add medication error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เพิ่มยาไม่สำเร็จ'
    });
  }
});

/**
 * PUT /api/medications/:medicationId
 * แก้ไขยา
 */
router.put('/medications/:medicationId', async (req: Request, res: Response) => {
  try {
    const { medicationId } = req.params;
    const updates = req.body;

    const medication = await userService.updateMedication(medicationId, updates);

    res.json({
      success: true,
      medication
    });
  } catch (error: any) {
    console.error('Update medication error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'แก้ไขยาไม่สำเร็จ'
    });
  }
});

/**
 * DELETE /api/medications/:medicationId
 * ลบยา (soft delete)
 */
router.delete('/medications/:medicationId', async (req: Request, res: Response) => {
  try {
    const { medicationId } = req.params;

    await userService.deleteMedication(medicationId);

    res.json({
      success: true,
      message: 'ลบยาสำเร็จ'
    });
  } catch (error: any) {
    console.error('Delete medication error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ลบยาไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/patient/:patientId/caregivers
 * ดึงรายชื่อ caregivers ของ patient
 */
router.get('/patient/:patientId/caregivers', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const caregivers = await userService.getPatientCaregivers(patientId);

    res.json({
      success: true,
      caregivers
    });
  } catch (error: any) {
    console.error('Get caregivers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/caregiver/:caregiverId/patients
 * ดึงรายชื่อ patients ของ caregiver
 */
router.get('/caregiver/:caregiverId/patients', async (req: Request, res: Response) => {
  try {
    const { caregiverId } = req.params;

    const patients = await userService.getCaregiverPatients(caregiverId);

    res.json({
      success: true,
      patients
    });
  } catch (error: any) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลไม่สำเร็จ'
    });
  }
});

export default router;
