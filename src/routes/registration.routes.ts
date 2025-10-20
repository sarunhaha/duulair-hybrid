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
    const { lineUserId } = req.body;

    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: 'lineUserId is required'
      });
    }

    const result = await userService.checkUserExists(lineUserId);

    res.json(result);
  } catch (error: any) {
    console.error('Check user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ตรวจสอบผู้ใช้ไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/patient
 * ลงทะเบียน Patient
 */
router.post('/patient', async (req: Request, res: Response) => {
  try {
    const { lineUserId, displayName, pictureUrl, ...form } = req.body;

    // Validate required fields
    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: 'lineUserId is required'
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
      lineUserId,
      displayName,
      pictureUrl,
      form as PatientRegistrationForm
    );

    res.json(result);
  } catch (error: any) {
    console.error('Register patient error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ลงทะเบียนผู้ป่วยไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/registration/caregiver
 * ลงทะเบียน Caregiver
 */
router.post('/caregiver', async (req: Request, res: Response) => {
  try {
    const { lineUserId, displayName, pictureUrl, ...form } = req.body;

    // Validate required fields
    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        error: 'lineUserId is required'
      });
    }

    if (!form.firstName || !form.lastName) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลพื้นฐานไม่ครบถ้วน (ชื่อ, นามสกุล)'
      });
    }

    const result = await userService.registerCaregiver(
      lineUserId,
      displayName,
      pictureUrl,
      form as CaregiverRegistrationForm
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
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'patientId is required'
      });
    }

    const result = await userService.generateLinkCode(patientId);

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
    const { caregiverId, linkCode, relationship } = req.body;

    if (!caregiverId || !linkCode) {
      return res.status(400).json({
        success: false,
        error: 'caregiverId และ linkCode จำเป็น'
      });
    }

    if (!relationship) {
      return res.status(400).json({
        success: false,
        error: 'relationship จำเป็น'
      });
    }

    const result = await userService.linkPatientToCaregiver(
      caregiverId,
      linkCode,
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
        error: 'ไม่พบข้อมูลผู้ป่วย'
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

    const profile = await userService.updatePatientProfile(id, updates);

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
