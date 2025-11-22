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
  CaregiverProfile,
  SetDefaultPatientRequest,
  SetDefaultPatientResponse,
  GetDefaultPatientResponse
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
      .select(`
        *,
        caregiver_profiles(*)
      `)
      .eq('line_group_id', lineGroupId)
      .single();

    if (error || !group) {
      console.log('📭 Group not found');
      return { exists: false };
    }

    // Get all patients in this group
    const { data: groupPatients } = await supabase
      .from('group_patients')
      .select('*, patient_profiles(*)')
      .eq('group_id', group.id)
      .eq('is_active', true);

    const patients = groupPatients?.map((gp: any) => gp.patient_profiles) || [];

    console.log('📬 Group found:', { id: group.id, group_name: group.group_name, patient_count: patients.length });

    return {
      exists: true,
      group: this.mapToGroup(group),
      patient: patients[0], // For backward compatibility
      patients: patients,
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

      // Step 4: สร้าง group (ไม่มี patient_id แล้ว - ใช้ group_patients)
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          line_group_id: form.lineGroupId,
          group_name: form.groupName,
          primary_caregiver_id: caregiverProfileId
        })
        .select()
        .single();

      if (groupError || !newGroup) {
        throw new Error('ไม่สามารถสร้าง group ได้');
      }

      console.log('✅ Created group:', newGroup.id);

      // Step 4.5: เพิ่ม patient เข้า group_patients table
      const { error: groupPatientError } = await supabase
        .from('group_patients')
        .insert({
          group_id: newGroup.id,
          patient_id: patientProfileId,
          added_by_caregiver_id: caregiverProfileId
        });

      if (groupPatientError) {
        console.error('⚠️ Failed to add patient to group:', groupPatientError);
      }

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
        caregiver_profiles(*),
        group_members(*)
      `)
      .eq('line_group_id', lineGroupId)
      .single();

    if (error || !data) {
      return null;
    }

    // Get all patients in this group
    const patients = await this.getGroupPatients(data.id);

    return {
      success: true,
      group: this.mapToGroup(data),
      patient: patients[0], // For backward compatibility
      patients: patients,
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
      if (existingGroup.exists && existingGroup.group) {
        console.log('✅ Group already exists, checking if we need to add patient');

        // Get caregiver info
        const caregiverCheck = await userService.checkUserExists(caregiverLineUserId);
        if (!caregiverCheck.exists || caregiverCheck.role !== 'caregiver') {
          return {
            success: false,
            message: 'กรุณาลงทะเบียนผ่าน LINE OA ก่อนใช้งานในกลุ่ม'
          };
        }

        const caregiverProfile: any = caregiverCheck.profile;
        const linkedPatientId = caregiverProfile.linked_patient_id;

        if (!linkedPatientId) {
          return {
            success: false,
            message: 'ไม่พบข้อมูลผู้ป่วยที่เชื่อมต่อ'
          };
        }

        // Check if this patient is already in group
        const existingPatients = existingGroup.patients || [];
        const patientExists = existingPatients.some((p: any) => p.id === linkedPatientId);

        if (!patientExists) {
          // Add new patient to existing group
          console.log(`📝 Adding patient ${linkedPatientId} to existing group`);
          await this.addPatientToGroup(existingGroup.group.id, linkedPatientId, caregiverProfile.id);

          // Get patient name for response
          const { data: patient } = await supabase
            .from('patient_profiles')
            .select('first_name, last_name')
            .eq('id', linkedPatientId)
            .single();

          return {
            success: true,
            group: existingGroup.group,
            patientId: linkedPatientId,
            message: `เพิ่ม ${patient?.first_name} ${patient?.last_name} เข้ากลุ่มสำเร็จ!`
          };
        }

        // Patient already in group
        return {
          success: true,
          group: existingGroup.group,
          patientId: linkedPatientId,
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
      if (!caregiverProfile || !caregiverProfile.linked_patient_id) {
        console.log('❌ Caregiver has no linked patient');
        return {
          success: false,
          message: 'ไม่พบข้อมูลผู้ป่วยที่เชื่อมต่อ กรุณาลงทะเบียนผู้ป่วยก่อน'
        };
      }

      const patientId = caregiverProfile.linked_patient_id;

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

      // 5. Create group (without patient_id - will use group_patients table)
      const groupName = `กลุ่มดูแล ${patient.first_name} ${patient.last_name}`;

      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          line_group_id: lineGroupId,
          group_name: groupName,
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

      // 5.5. Add patient to group_patients table
      const { error: groupPatientError } = await supabase
        .from('group_patients')
        .insert({
          group_id: newGroup.id,
          patient_id: patientId,
          added_by_caregiver_id: caregiverProfile.id
        });

      if (groupPatientError) {
        console.error('⚠️ Failed to add patient to group:', groupPatientError);
      }

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
   * เพิ่ม patient เข้ากลุ่ม (สำหรับ caregiver คนที่ 2, 3, ... ที่มาใช้กลุ่มเดียวกัน)
   */
  async addPatientToGroup(
    groupId: string,
    patientId: string,
    caregiverId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('group_patients')
        .insert({
          group_id: groupId,
          patient_id: patientId,
          added_by_caregiver_id: caregiverId
        });

      if (error) {
        // Check if it's duplicate
        if (error.code === '23505') {
          return {
            success: true,
            message: 'ผู้ป่วยอยู่ในกลุ่มแล้ว'
          };
        }
        throw error;
      }

      console.log(`✅ Added patient ${patientId} to group ${groupId}`);
      return {
        success: true,
        message: 'เพิ่มผู้ป่วยเข้ากลุ่มสำเร็จ'
      };
    } catch (error) {
      console.error('❌ Failed to add patient to group:', error);
      return {
        success: false,
        message: 'ไม่สามารถเพิ่มผู้ป่วยเข้ากลุ่มได้'
      };
    }
  }

  /**
   * ดึงรายชื่อผู้ป่วยทั้งหมดในกลุ่ม
   */
  async getGroupPatients(groupId: string): Promise<PatientProfile[]> {
    const { data, error } = await supabase
      .from('group_patients')
      .select('*, patient_profiles(*)')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('added_at', { ascending: true });

    if (error || !data) {
      console.error('❌ Error getting group patients:', error);
      return [];
    }

    return data.map((gp: any) => gp.patient_profiles as PatientProfile);
  }

  /**
   * Switch active patient in group
   */
  async switchActivePatient(
    groupId: string,
    patientId: string
  ): Promise<{ success: boolean; message: string; patientName?: string }> {
    try {
      // Use database function
      const { data, error } = await supabase.rpc('switch_active_patient', {
        p_group_id: groupId,
        p_patient_id: patientId
      });

      if (error) {
        console.error('❌ Error switching patient:', error);
        return {
          success: false,
          message: 'ไม่สามารถเปลี่ยนผู้ป่วยได้'
        };
      }

      const result = data?.[0];
      if (!result?.success) {
        return {
          success: false,
          message: result?.message || 'ผู้ป่วยไม่อยู่ในกลุ่มนี้'
        };
      }

      console.log(`✅ Switched active patient to: ${result.patient_name}`);
      return {
        success: true,
        message: result.message,
        patientName: result.patient_name
      };
    } catch (error) {
      console.error('❌ Failed to switch patient:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาด'
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
      primaryCaregiverId: record.primary_caregiver_id,
      activePatientId: record.active_patient_id,
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

  // ============================================================
  // CAREGIVER PATIENT PREFERENCES (Phase 4)
  // ============================================================

  /**
   * Get caregiver's default patient for a group
   */
  async getCaregiverDefaultPatient(
    groupId: string,
    caregiverLineUserId: string
  ): Promise<GetDefaultPatientResponse> {
    console.log(`🔍 GroupService.getCaregiverDefaultPatient() - groupId: ${groupId}, caregiver: ${caregiverLineUserId}`);

    const { data, error } = await supabase
      .from('caregiver_patient_preferences')
      .select('default_patient_id, patient_profiles(id, first_name, last_name, nickname)')
      .eq('group_id', groupId)
      .eq('caregiver_line_user_id', caregiverLineUserId)
      .single();

    if (error || !data) {
      console.log('📭 No default patient set for this caregiver');
      return { hasDefault: false };
    }

    const patient = (data as any).patient_profiles;
    return {
      hasDefault: true,
      patientId: data.default_patient_id,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : undefined
    };
  }

  /**
   * Set caregiver's default patient
   */
  async setDefaultPatient(request: SetDefaultPatientRequest): Promise<SetDefaultPatientResponse> {
    console.log(`💾 GroupService.setDefaultPatient() - groupId: ${request.groupId}, caregiver: ${request.caregiverLineUserId}, patient: ${request.patientId}`);

    try {
      // Verify patient exists in group
      const { data: groupPatient, error: verifyError } = await supabase
        .from('group_patients')
        .select('id')
        .eq('group_id', request.groupId)
        .eq('patient_id', request.patientId)
        .eq('is_active', true)
        .single();

      if (verifyError || !groupPatient) {
        return {
          success: false,
          message: 'ไม่พบผู้ป่วยในกลุ่มนี้'
        };
      }

      // Insert or update preference
      const { data, error } = await supabase
        .from('caregiver_patient_preferences')
        .upsert({
          group_id: request.groupId,
          caregiver_line_user_id: request.caregiverLineUserId,
          default_patient_id: request.patientId,
          updated_at: new Date()
        }, {
          onConflict: 'group_id,caregiver_line_user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error setting default patient:', error);
        return {
          success: false,
          message: 'เกิดข้อผิดพลาดในการตั้งค่า'
        };
      }

      console.log('✅ Default patient set successfully');
      return {
        success: true,
        message: 'ตั้งค่าผู้ป่วยหลักเรียบร้อยแล้ว',
        preference: {
          id: data.id,
          groupId: data.group_id,
          caregiverLineUserId: data.caregiver_line_user_id,
          defaultPatientId: data.default_patient_id,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        }
      };
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาด'
      };
    }
  }

  /**
   * Remove caregiver's default patient preference
   */
  async removeDefaultPatient(
    groupId: string,
    caregiverLineUserId: string
  ): Promise<{ success: boolean; message: string }> {
    console.log(`🗑️ GroupService.removeDefaultPatient() - groupId: ${groupId}, caregiver: ${caregiverLineUserId}`);

    const { error } = await supabase
      .from('caregiver_patient_preferences')
      .delete()
      .eq('group_id', groupId)
      .eq('caregiver_line_user_id', caregiverLineUserId);

    if (error) {
      console.error('❌ Error removing default patient:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบการตั้งค่า'
      };
    }

    console.log('✅ Default patient preference removed');
    return {
      success: true,
      message: 'ลบการตั้งค่าเรียบร้อยแล้ว'
    };
  }
}

export const groupService = new GroupService();
