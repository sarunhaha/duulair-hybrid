/**
 * Group API Routes (TASK-002)
 * API endpoints สำหรับ Group-based care model
 */

import { Router, Request, Response } from 'express';
import { groupService } from '../services/group.service';
import { GroupRegistrationForm, AddGroupMemberRequest } from '../types/user.types';

const router = Router();

/**
 * POST /api/groups/check
 * ตรวจสอบว่า group ลงทะเบียนแล้วหรือยัง
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { line_group_id } = req.body;

    if (!line_group_id) {
      return res.status(400).json({
        success: false,
        error: 'line_group_id is required'
      });
    }

    console.log(`🔍 Checking group: ${line_group_id}`);

    const result = await groupService.checkGroupExists(line_group_id);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Check group error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ตรวจสอบกลุ่มไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/groups/register
 * ลงทะเบียนกลุ่มใหม่ (Caregiver + Patient)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const form: GroupRegistrationForm = req.body;

    // Validate required fields
    if (!form.lineGroupId) {
      return res.status(400).json({
        success: false,
        error: 'lineGroupId is required'
      });
    }

    if (!form.caregiver || !form.caregiver.lineUserId || !form.caregiver.firstName || !form.caregiver.lastName) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูล caregiver ไม่ครบถ้วน'
      });
    }

    if (!form.patient || !form.patient.firstName || !form.patient.lastName || !form.patient.birthDate || !form.patient.gender) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูล patient ไม่ครบถ้วน (ชื่อ, นามสกุล, วันเกิด, เพศ)'
      });
    }

    console.log('📝 Registering new group:', form.lineGroupId);

    const result = await groupService.registerGroup(form);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Register group error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ลงทะเบียนกลุ่มไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/groups/:id
 * ดึงข้อมูลกลุ่มพร้อมสมาชิก
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`📖 Getting group: ${id}`);

    const result = await groupService.getGroup(id);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Get group error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลกลุ่มไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/groups/by-line-id/:lineGroupId
 * ดึงข้อมูลกลุ่มจาก LINE Group ID
 */
router.get('/by-line-id/:lineGroupId', async (req: Request, res: Response) => {
  try {
    const { lineGroupId } = req.params;

    console.log(`📖 Getting group by LINE ID: ${lineGroupId}`);

    const result = await groupService.getGroupByLineId(lineGroupId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบกลุ่ม'
      });
    }

    res.json(result);

  } catch (error: any) {
    console.error('❌ Get group by LINE ID error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลกลุ่มไม่สำเร็จ'
    });
  }
});

/**
 * POST /api/groups/:id/members
 * เพิ่มสมาชิกในกลุ่ม
 */
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: AddGroupMemberRequest = req.body;

    if (!request.lineUserId || !request.displayName || !request.role) {
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลสมาชิกไม่ครบถ้วน'
      });
    }

    console.log(`👥 Adding member to group: ${id}`);

    const result = await groupService.addMember(id, request);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Add member error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'เพิ่มสมาชิกไม่สำเร็จ'
    });
  }
});

/**
 * GET /api/groups/:id/members
 * ดึงรายชื่อสมาชิกในกลุ่ม
 */
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    console.log(`👥 Getting members of group: ${id}`);

    const members = await groupService.getMembers(id);

    res.json({
      success: true,
      members
    });

  } catch (error: any) {
    console.error('❌ Get members error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ดึงข้อมูลสมาชิกไม่สำเร็จ'
    });
  }
});

export default router;
