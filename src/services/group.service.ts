/**
 * Group Service (TASK-002)
 * จัดการ LINE Group-based care model
 */

import { supabase } from './supabase.service';
import { UserService } from './user.service';
import {
  Group,
  GroupMember,
  GroupRegistrationForm,
  GroupRegistrationResponse,
  GroupInfoResponse,
  GroupCheckResponse,
  AddGroupMemberRequest,
  AddGroupMemberResponse,
  PatientProfile,
  CaregiverProfile
} from '../types/user.types';

const userService = new UserService();

export class GroupService {
  /**
   * ตรวจสอบว่า group ลงทะเบียนแล้วหรือยัง
   */
  async checkGroupExists(lineGroupId: string): Promise<GroupCheckResponse> {
    console.log(`🔍 GroupService.checkGroupExists() - lineGroupId: ${lineGroupId}`);

    const { data: group, error } = await supabase
      .from('groups')
      .select('*, patient_profiles(*), caregiver_profiles(*)')
      .eq('line_group_id', lineGroupId)
      .single();

    if (error || !group) {
      console.log('📭 Group not found');
      return { exists: false };
    }

    console.log('📬 Group found:', { id: group.id, group_name: group.group_name });

    return {
      exists: true,
      group: this.mapToGroup(group),
      patient: group.patient_profiles,
      primaryCaregiver: group.caregiver_profiles
    };
  }

  /**
   * ลงทะเบียนกลุ่มใหม่ (1 Caregiver + 1 Patient)
   */
  async registerGroup(form: GroupRegistrationForm): Promise<GroupRegistrationResponse> {
    console.log('📝 GroupService.registerGroup()');

    try {
      // Step 1: สร้าง/เช็ค User สำหรับ Caregiver
      let caregiverUserId: string;
      let caregiverProfileId: string;

      const existingCaregiver = await userService.checkUserExists(form.caregiver.lineUserId);

      if (existingCaregiver.exists && existingCaregiver.role === 'caregiver') {
        // ใช้ caregiver ที่มีอยู่
        caregiverUserId = existingCaregiver.profile!.id;
        caregiverProfileId = existingCaregiver.profile!.id;
        console.log('✅ Using existing caregiver:', caregiverProfileId);
      } else {
        // สร้าง caregiver ใหม่
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            line_user_id: form.caregiver.lineUserId,
            display_name: form.caregiver.displayName,
            picture_url: form.caregiver.pictureUrl,
            role: 'caregiver'
          })
          .select()
          .single();

        if (userError || !newUser) {
          throw new Error('ไม่สามารถสร้าง user สำหรับ caregiver ได้');
        }

        caregiverUserId = newUser.id;

        // สร้าง caregiver profile
        const { data: newProfile, error: profileError } = await supabase
          .from('caregiver_profiles')
          .insert({
            user_id: caregiverUserId,
            first_name: form.caregiver.firstName,
            last_name: form.caregiver.lastName,
            phone_number: form.caregiver.phoneNumber
          })
          .select()
          .single();

        if (profileError || !newProfile) {
          throw new Error('ไม่สามารถสร้าง caregiver profile ได้');
        }

        caregiverProfileId = newProfile.id;
        console.log('✅ Created new caregiver:', caregiverProfileId);
      }

      // Step 2: สร้าง User สำหรับ Patient (ถ้ามี LINE)
      let patientUserId: string | null = null;

      if (form.patient.lineUserId) {
        const { data: patientUser, error: userError } = await supabase
          .from('users')
          .insert({
            line_user_id: form.patient.lineUserId,
            display_name: form.patient.displayName || `${form.patient.firstName} ${form.patient.lastName}`,
            picture_url: form.patient.pictureUrl,
            role: 'patient'
          })
          .select()
          .single();

        if (!userError && patientUser) {
          patientUserId = patientUser.id;
        }
      }

      // Step 3: สร้าง patient profile
      const { data: newPatient, error: patientError } = await supabase
        .from('patient_profiles')
        .insert({
          user_id: patientUserId, // NULL ถ้าไม่มี LINE
          first_name: form.patient.firstName,
          last_name: form.patient.lastName,
          nickname: form.patient.nickname,
          birth_date: form.patient.birthDate,
          gender: form.patient.gender,
          weight_kg: form.patient.weightKg,
          height_cm: form.patient.heightCm,
          blood_type: form.patient.bloodType,
          chronic_diseases: form.patient.chronicDiseases || [],
          drug_allergies: form.patient.drugAllergies || [],
          food_allergies: form.patient.foodAllergies || [],
          address: form.patient.address,
          phone_number: form.patient.phoneNumber,
          emergency_contact_name: form.patient.emergencyContactName,
          emergency_contact_phone: form.patient.emergencyContactPhone,
          emergency_contact_relation: form.patient.emergencyContactRelation
        })
        .select()
        .single();

      if (patientError || !newPatient) {
        throw new Error('ไม่สามารถสร้าง patient profile ได้');
      }

      const patientProfileId = newPatient.id;
      console.log('✅ Created patient:', patientProfileId);

      // Step 4: สร้าง group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          line_group_id: form.lineGroupId,
          group_name: form.groupName,
          patient_id: patientProfileId,
          primary_caregiver_id: caregiverProfileId
        })
        .select()
        .single();

      if (groupError || !newGroup) {
        throw new Error('ไม่สามารถสร้าง group ได้');
      }

      console.log('✅ Created group:', newGroup.id);

      // Step 5: เพิ่ม caregiver เป็น member
      await this.addMember(newGroup.id, {
        lineUserId: form.caregiver.lineUserId,
        displayName: form.caregiver.displayName,
        pictureUrl: form.caregiver.pictureUrl,
        role: 'caregiver'
      });

      // Step 6: เพิ่ม patient เป็น member (ถ้ามี LINE)
      if (form.patient.lineUserId) {
        await this.addMember(newGroup.id, {
          lineUserId: form.patient.lineUserId,
          displayName: form.patient.displayName || `${form.patient.firstName} ${form.patient.lastName}`,
          pictureUrl: form.patient.pictureUrl,
          role: 'patient'
        });
      }

      return {
        success: true,
        group: this.mapToGroup(newGroup),
        message: 'ลงทะเบียนกลุ่มสำเร็จ!'
      };

    } catch (error) {
      console.error('❌ GroupService.registerGroup() error:', error);
      throw error;
    }
  }

  /**
   * ดึงข้อมูลกลุ่มพร้อมสมาชิก
   */
  async getGroup(groupId: string): Promise<GroupInfoResponse> {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        patient_profiles(*),
        caregiver_profiles(*),
        group_members(*)
      `)
      .eq('id', groupId)
      .single();

    if (error || !data) {
      throw new Error('ไม่พบข้อมูลกลุ่ม');
    }

    return {
      success: true,
      group: this.mapToGroup(data),
      patient: data.patient_profiles,
      primaryCaregiver: data.caregiver_profiles,
      members: data.group_members.map(this.mapToGroupMember)
    };
  }

  /**
   * ดึงข้อมูลกลุ่มจาก LINE Group ID
   */
  async getGroupByLineId(lineGroupId: string): Promise<GroupInfoResponse | null> {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        patient_profiles(*),
        caregiver_profiles(*),
        group_members(*)
      `)
      .eq('line_group_id', lineGroupId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      success: true,
      group: this.mapToGroup(data),
      patient: data.patient_profiles,
      primaryCaregiver: data.caregiver_profiles,
      members: data.group_members.map(this.mapToGroupMember)
    };
  }

  /**
   * ดึงข้อมูลกลุ่มจาก Patient ID
   */
  async getGroupByPatientId(patientId: string): Promise<GroupInfoResponse | null> {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        patient_profiles(*),
        caregiver_profiles(*),
        group_members(*)
      `)
      .eq('patient_id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      success: true,
      group: this.mapToGroup(data),
      patient: data.patient_profiles,
      primaryCaregiver: data.caregiver_profiles,
      members: data.group_members.map(this.mapToGroupMember)
    };
  }

  /**
   * เพิ่มสมาชิกในกลุ่ม
   */
  async addMember(groupId: string, request: AddGroupMemberRequest): Promise<AddGroupMemberResponse> {
    const { data, error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        line_user_id: request.lineUserId,
        display_name: request.displayName,
        picture_url: request.pictureUrl,
        role: request.role
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('ไม่สามารถเพิ่มสมาชิกได้');
    }

    return {
      success: true,
      member: this.mapToGroupMember(data)
    };
  }

  /**
   * ดึงรายชื่อสมาชิกในกลุ่ม
   */
  async getMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (error) {
      throw new Error('ไม่สามารถดึงข้อมูลสมาชิกได้');
    }

    return data.map(this.mapToGroupMember);
  }

  /**
   * Auto-link group with patient from registered caregiver
   * Called when caregiver sends first message in group
   */
  async autoLinkGroupWithPatient(lineGroupId: string, caregiverLineUserId: string): Promise<{
    success: boolean;
    group?: Group;
    patientId?: string;
    message: string;
  }> {
    console.log(`🔗 Auto-linking group ${lineGroupId} for caregiver ${caregiverLineUserId}`);

    try {
      // 1. Check if group already registered
      const existingGroup = await this.checkGroupExists(lineGroupId);
      if (existingGroup.exists) {
        console.log('✅ Group already registered');
        return {
          success: true,
          group: existingGroup.group,
          patientId: existingGroup.patient?.id,
          message: 'กลุ่มลงทะเบียนแล้ว'
        };
      }

      // 2. Check if user is registered caregiver with linked patient
      const caregiverCheck = await userService.checkUserExists(caregiverLineUserId);

      if (!caregiverCheck.exists || caregiverCheck.role !== 'caregiver') {
        console.log('❌ User is not a registered caregiver');
        return {
          success: false,
          message: 'กรุณาลงทะเบียนผ่าน LINE OA ก่อนใช้งานในกลุ่ม'
        };
      }

      // 3. Get caregiver's linked patient
      const caregiverProfile: any = caregiverCheck.profile;
      if (!caregiverProfile || !caregiverProfile.linkedPatientId) {
        console.log('❌ Caregiver has no linked patient');
        return {
          success: false,
          message: 'ไม่พบข้อมูลผู้ป่วยที่เชื่อมต่อ กรุณาลงทะเบียนผู้ป่วยก่อน'
        };
      }

      const patientId = caregiverProfile.linkedPatientId;

      // 4. Get patient info
      const { data: patient, error: patientError } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError || !patient) {
        console.log('❌ Patient not found');
        return {
          success: false,
          message: 'ไม่พบข้อมูลผู้ป่วย'
        };
      }

      // 5. Create group linked to patient
      const groupName = `กลุ่มดูแล ${patient.first_name} ${patient.last_name}`;

      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          line_group_id: lineGroupId,
          group_name: groupName,
          patient_id: patientId,
          primary_caregiver_id: caregiverProfile.id
        })
        .select()
        .single();

      if (groupError || !newGroup) {
        console.error('❌ Failed to create group:', groupError);
        return {
          success: false,
          message: 'ไม่สามารถสร้างกลุ่มได้'
        };
      }

      console.log('✅ Created group:', newGroup.id);

      // 6. Add caregiver as member
      await this.addMember(newGroup.id, {
        lineUserId: caregiverLineUserId,
        displayName: caregiverProfile.firstName + ' ' + caregiverProfile.lastName,
        role: 'caregiver'
      });

      return {
        success: true,
        group: this.mapToGroup(newGroup),
        patientId: patientId,
        message: `เชื่อมต่อกลุ่มกับ ${patient.first_name} ${patient.last_name} สำเร็จ!`
      };

    } catch (error) {
      console.error('❌ Auto-link error:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกลุ่ม'
      };
    }
  }

  /**
   * Map database record to Group type
   */
  private mapToGroup(record: any): Group {
    return {
      id: record.id,
      lineGroupId: record.line_group_id,
      groupName: record.group_name,
      patientId: record.patient_id,
      primaryCaregiverId: record.primary_caregiver_id,
      isActive: record.is_active,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at)
    };
  }

  /**
   * Map database record to GroupMember type
   */
  private mapToGroupMember(record: any): GroupMember {
    return {
      id: record.id,
      groupId: record.group_id,
      lineUserId: record.line_user_id,
      displayName: record.display_name,
      pictureUrl: record.picture_url,
      role: record.role,
      isActive: record.is_active,
      joinedAt: new Date(record.joined_at),
      leftAt: record.left_at ? new Date(record.left_at) : undefined
    };
  }
}

export const groupService = new GroupService();
