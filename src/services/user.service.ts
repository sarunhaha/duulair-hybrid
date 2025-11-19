/**
 * User Service
 * จัดการ registration และ profile management
 */

import { supabase } from './supabase.service';
import { reminderService } from './reminder.service';
import QRCode from 'qrcode';
import {
  User,
  PatientProfile,
  CaregiverProfile,
  PatientCaregiver,
  LinkCode,
  PatientMedication,
  HealthGoals,
  NotificationSettings,
  PatientRegistrationForm,
  CaregiverRegistrationForm,
  RegistrationCheckResponse,
  PatientRegistrationResponse,
  CaregiverRegistrationResponse,
  LinkCodeResponse,
  LinkPatientResponse,
  ApproveCaregiverResponse
} from '../types/user.types';

export class UserService {
  /**
   * ตรวจสอบว่า user ลงทะเบียนแล้วหรือยัง
   */
  async checkUserExists(lineUserId: string): Promise<RegistrationCheckResponse> {
    console.log(`🔍 UserService.checkUserExists() - lineUserId: ${lineUserId}`);
    console.log('🔗 Supabase URL:', process.env.SUPABASE_URL ? 'Set ✅' : 'Missing ❌');
    console.log('🔑 Supabase Key:', process.env.SUPABASE_SERVICE_KEY ? 'Set ✅' : 'Missing ❌');

    // ✅ Step 1: Get user first
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (userError || !user) {
      console.log('📭 User not found - returning exists: false');
      return { exists: false };
    }

    console.log('📬 User found:', {
      id: user.id,
      role: user.role,
      line_user_id: user.line_user_id
    });

    // ✅ Step 2: Get profile separately based on role
    let profile = null;

    // Determine role by checking which profile exists
    let role: 'patient' | 'caregiver' | undefined = undefined;

    // Check patient profile first
    const { data: patientProfile, error: patientError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (patientProfile && !patientError) {
      profile = patientProfile;
      role = 'patient';
      console.log('📋 Patient profile found:', {
        profile_id: profile?.id,
        first_name: profile?.first_name
      });
    } else {
      // Check caregiver profile
      const { data: caregiverProfile, error: caregiverError } = await supabase
        .from('caregiver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (caregiverProfile && !caregiverError) {
        profile = caregiverProfile;
        role = 'caregiver';
        console.log('📋 Caregiver profile found:', {
          profile_id: profile?.id
        });

        // Get linked patient for caregiver
        const { data: linkedPatient, error: linkedError } = await supabase
          .from('patient_caregivers')
          .select('patient_id')
          .eq('caregiver_id', caregiverProfile.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (linkedPatient && !linkedError) {
          (profile as any).linked_patient_id = linkedPatient.patient_id;
          console.log('📋 Linked patient found:', linkedPatient.patient_id);
        }
      }
    }

    // ✅ Step 3: Validate that profile exists
    if (!profile || !role) {
      console.error('❌ Profile not found for user:', {
        user_id: user.id,
        role: role
      });
      return { exists: false };
    }

    console.log('✅ Profile found:', {
      profile_id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: role
    });

    return {
      exists: true,
      role: role,
      profile: {
        ...profile,
        profile_id: profile.id
      }
    };
  }

  /**
   * ลงทะเบียน Patient
   */
  async registerPatient(
    lineUserId: string,
    displayName: string,
    pictureUrl: string | undefined,
    form: PatientRegistrationForm
  ): Promise<PatientRegistrationResponse> {
    // ✅ 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, role, display_name')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing user:', checkError);
      throw new Error('เกิดข้อผิดพลาดในการตรวจสอบข้อมูล');
    }

    if (existingUser) {
      console.log('⚠️ User already exists:', existingUser);

      if (existingUser.role === 'patient') {
        throw new Error('คุณลงทะเบียนเป็นผู้ป่วยแล้ว กรุณาเข้าสู่ระบบ');
      } else if (existingUser.role === 'caregiver') {
        throw new Error('คุณลงทะเบียนเป็นผู้ดูแลแล้ว ไม่สามารถลงทะเบียนเป็นผู้ป่วยได้');
      } else {
        throw new Error(`คุณลงทะเบียนแล้วในบทบาท: ${existingUser.role}`);
      }
    }

    // 2. สร้าง user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url: pictureUrl,
        role: 'patient',
        language: 'th'
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error('ลงทะเบียน user ไม่สำเร็จ: ' + userError?.message);
    }

    // 3. สร้าง patient profile
    const { data: profile, error: profileError } = await supabase
      .from('patient_profiles')
      .insert({
        user_id: user.id,
        first_name: form.firstName,
        last_name: form.lastName,
        nickname: form.nickname,
        birth_date: form.birthDate,
        gender: form.gender,
        weight_kg: form.weightKg,
        height_cm: form.heightCm,
        blood_type: form.bloodType,
        chronic_diseases: form.chronicDiseases || [],
        drug_allergies: form.drugAllergies || [],
        food_allergies: form.foodAllergies || [],
        address: form.address,
        phone_number: form.phoneNumber,
        emergency_contact_name: form.emergencyContactName,
        emergency_contact_phone: form.emergencyContactPhone,
        emergency_contact_relation: form.emergencyContactRelation
      })
      .select()
      .single();

    if (profileError || !profile) {
      throw new Error('สร้าง profile ไม่สำเร็จ: ' + profileError?.message);
    }

    // 4. สร้าง medications
    if (form.medications && form.medications.length > 0) {
      const medications = form.medications.map(med => ({
        patient_id: profile.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        started_at: new Date()
      }));

      await supabase.from('patient_medications').insert(medications);
    }

    // 5. สร้าง health goals (ใช้ default หรือจากฟอร์ม)
    await supabase.from('health_goals').insert({
      patient_id: profile.id,
      ...form.healthGoals // ถ้ามีจากฟอร์ม จะ override defaults
    });

    // 6. สร้าง notification settings (default)
    await supabase.from('notification_settings').insert({
      patient_id: profile.id
    });

    // 7. สร้าง link code
    const linkCodeData = await this.generateLinkCode(profile.id);

    // Calculate age and BMI
    const age = this.calculateAge(new Date(form.birthDate));
    const bmi = form.weightKg && form.heightCm
      ? this.calculateBMI(form.weightKg, form.heightCm)
      : undefined;

    return {
      success: true,
      user: user as User,
      profile: {
        ...profile,
        age,
        bmi
      } as PatientProfile,
      linkCode: linkCodeData.code,
      qrCode: linkCodeData.qrCode
    };
  }

  /**
   * ลงทะเบียน Caregiver
   */
  async registerCaregiver(
    lineUserId: string,
    displayName: string,
    pictureUrl: string | undefined,
    form: CaregiverRegistrationForm
  ): Promise<CaregiverRegistrationResponse> {
    // ✅ 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, role, display_name')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing user:', checkError);
      throw new Error('เกิดข้อผิดพลาดในการตรวจสอบข้อมูล');
    }

    if (existingUser) {
      console.log('⚠️ User already exists:', existingUser);

      if (existingUser.role === 'caregiver') {
        throw new Error('คุณลงทะเบียนเป็นผู้ดูแลแล้ว กรุณาเข้าสู่ระบบ');
      } else if (existingUser.role === 'patient') {
        throw new Error('คุณลงทะเบียนเป็นผู้ป่วยแล้ว ไม่สามารถลงทะเบียนเป็นผู้ดูแลได้');
      } else {
        throw new Error(`คุณลงทะเบียนแล้วในบทบาท: ${existingUser.role}`);
      }
    }

    // 2. สร้าง user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url: pictureUrl,
        role: 'caregiver',
        language: 'th'
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error('ลงทะเบียน user ไม่สำเร็จ: ' + userError?.message);
    }

    // 3. สร้าง caregiver profile
    const { data: profile, error: profileError } = await supabase
      .from('caregiver_profiles')
      .insert({
        user_id: user.id,
        first_name: form.firstName,
        last_name: form.lastName,
        phone_number: form.phoneNumber
      })
      .select()
      .single();

    if (profileError || !profile) {
      throw new Error('สร้าง profile ไม่สำเร็จ: ' + profileError?.message);
    }

    // 4. ถ้ามี link code ให้เชื่อมต่อกับ patient
    let linkedPatients: PatientProfile[] = [];
    if (form.linkCode) {
      try {
        const linkResult = await this.linkPatientToCaregiver(
          profile.id,
          form.linkCode,
          form.relationship
        );
        linkedPatients = [linkResult.patient];
      } catch (error) {
        console.error('เชื่อมต่อกับ patient ไม่สำเร็จ:', error);
        // ไม่ throw error เพราะ caregiver ลงทะเบียนสำเร็จแล้ว
      }
    }

    return {
      success: true,
      user: user as User,
      profile: profile as CaregiverProfile,
      linkedPatients
    };
  }

  /**
   * สร้างรหัสเชื่อมต่อ 6 หลัก
   */
  async generateLinkCode(patientId: string): Promise<LinkCodeResponse> {
    console.log('🔗 generateLinkCode() called for patient:', patientId);

    // ✅ 1. Check if there's an existing valid link code
    const { data: existingCode, error: checkError } = await supabase
      .from('link_codes')
      .select('*')
      .eq('patient_id', patientId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())  // Not expired yet
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();  // Use maybeSingle() to avoid error when no rows found

    // ✅ 2. If valid link code exists, return it
    if (existingCode && !checkError) {
      console.log('✅ Found existing valid link code:', {
        code: existingCode.code,
        expires_at: existingCode.expires_at,
        created_at: existingCode.created_at
      });

      // Generate QR code for existing code
      const qrCodeDataUrl = await QRCode.toDataURL(`DUULAIR:${existingCode.code}`, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2
      });

      return {
        code: existingCode.code,
        qrCode: qrCodeDataUrl,
        expiresAt: new Date(existingCode.expires_at)
      };
    }

    // ✅ 3. No valid code found or expired, generate new one
    console.log('📝 No valid link code found, generating new one...');

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save to database
    const { data, error } = await supabase
      .from('link_codes')
      .insert({
        patient_id: patientId,
        code,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error || !data) {
      console.error('❌ Error inserting new link code:', error);
      throw new Error('สร้างรหัสเชื่อมต่อไม่สำเร็จ: ' + error?.message);
    }

    console.log('✅ New link code created:', {
      code: data.code,
      expires_at: data.expires_at
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(`DUULAIR:${code}`, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2
    });

    return {
      code,
      qrCode: qrCodeDataUrl,
      expiresAt
    };
  }

  /**
   * เชื่อมต่อ caregiver กับ patient ผ่าน link code
   */
  async linkPatientToCaregiver(
    caregiverId: string,
    linkCode: string,
    relationship: string
  ): Promise<LinkPatientResponse> {
    // 1. ตรวจสอบ link code
    const { data: linkCodeData, error: linkCodeError } = await supabase
      .from('link_codes')
      .select('*, patient_profiles(*)')
      .eq('code', linkCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (linkCodeError || !linkCodeData) {
      throw new Error('รหัสเชื่อมต่อไม่ถูกต้องหรือหมดอายุ');
    }

    // 2. ตรวจสอบว่าเชื่อมต่อกันอยู่แล้วหรือไม่
    const { data: existingRelationship, error: checkError } = await supabase
      .from('patient_caregivers')
      .select('*, patient_profiles(*)')
      .eq('patient_id', linkCodeData.patient_id)
      .eq('caregiver_id', caregiverId)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing relationship:', checkError);
    }

    if (existingRelationship) {
      console.log('⚠️ Relationship already exists:', existingRelationship);

      if (existingRelationship.status === 'active') {
        throw new Error('คุณได้เชื่อมต่อกับผู้ป่วยท่านนี้แล้ว');
      } else if (existingRelationship.status === 'pending') {
        // Auto-approve old pending relationships (from before we removed approval requirement)
        console.log('🔄 Updating old pending relationship to active...');
        const { data: updatedRelationship, error: updateError } = await supabase
          .from('patient_caregivers')
          .update({
            status: 'active',
            approved_at: new Date().toISOString()
          })
          .eq('id', existingRelationship.id)
          .select('*, patient_profiles(*)')
          .single();

        if (updateError || !updatedRelationship) {
          throw new Error('อัพเดตการเชื่อมต่อไม่สำเร็จ: ' + updateError?.message);
        }

        console.log('✅ Updated pending → active:', updatedRelationship);

        // Mark link code as used
        await supabase
          .from('link_codes')
          .update({ used: true })
          .eq('code', linkCode);

        return {
          success: true,
          relationship: updatedRelationship as PatientCaregiver,
          patient: updatedRelationship.patient_profiles as PatientProfile
        };
      } else if (existingRelationship.status === 'rejected') {
        throw new Error('คำขอเชื่อมต่อของคุณถูกปฏิเสธแล้ว กรุณาติดต่อผู้ป่วย');
      }
    }

    // 3. สร้างความสัมพันธ์ (auto-approve - รหัสถูกต้องก็เชื่อมต่อทันที)
    const { data: relationshipData, error: relationshipError } = await supabase
      .from('patient_caregivers')
      .insert({
        patient_id: linkCodeData.patient_id,
        caregiver_id: caregiverId,
        relationship,
        status: 'active',
        approved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (relationshipError || !relationshipData) {
      throw new Error('เชื่อมต่อไม่สำเร็จ: ' + relationshipError?.message);
    }

    // 4. Mark link code as used
    await supabase
      .from('link_codes')
      .update({ used: true })
      .eq('id', linkCodeData.id);

    return {
      success: true,
      relationship: relationshipData as PatientCaregiver,
      patient: linkCodeData.patient_profiles as PatientProfile
    };
  }

  /**
   * อนุมัติหรือปฏิเสธ caregiver
   */
  async approveCaregiver(
    relationshipId: string,
    approved: boolean
  ): Promise<ApproveCaregiverResponse> {
    const status = approved ? 'active' : 'rejected';
    const approvedAt = approved ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from('patient_caregivers')
      .update({
        status,
        approved_at: approvedAt
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('อนุมัติไม่สำเร็จ: ' + error?.message);
    }

    return {
      success: true,
      relationship: data as PatientCaregiver
    };
  }

  /**
   * ดึงข้อมูล patient profile
   */
  async getPatientProfile(patientId: string): Promise<PatientProfile | null> {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    // Calculate age and BMI
    const age = this.calculateAge(new Date(data.birth_date));
    const bmi = data.weight_kg && data.height_cm
      ? this.calculateBMI(data.weight_kg, data.height_cm)
      : undefined;

    return {
      ...data,
      age,
      bmi
    } as PatientProfile;
  }

  /**
   * List all patients (for testing)
   */
  async listPatients(): Promise<any[]> {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('id, first_name, last_name, nickname, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error listing patients:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update patient profile
   */
  async updatePatientProfile(patientId: string, updateData: Partial<PatientProfile>): Promise<PatientProfile | null> {
    console.log(`📝 Updating patient profile: ${patientId}`, updateData);

    // Remove fields that shouldn't be updated
    const { id, user_id, created_at, ...safeData } = updateData as any;

    // Add updated_at timestamp
    const dataToUpdate = {
      ...safeData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('patient_profiles')
      .update(dataToUpdate)
      .eq('id', patientId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating patient profile:', error);
      throw new Error(error.message);
    }

    console.log('✅ Patient profile updated successfully');
    return data as PatientProfile;
  }

  /**
   * ดึงข้อมูล caregiver profile
   */
  async getCaregiverProfile(caregiverId: string): Promise<CaregiverProfile | null> {
    const { data, error } = await supabase
      .from('caregiver_profiles')
      .select('*')
      .eq('id', caregiverId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as CaregiverProfile;
  }

  /**
   * ดึงรายชื่อ caregivers ของ patient
   */
  async getPatientCaregivers(patientId: string): Promise<PatientCaregiver[]> {
    const { data, error } = await supabase
      .from('patient_caregivers')
      .select('*, caregiver_profiles(*)')
      .eq('patient_id', patientId)
      .eq('status', 'active');

    if (error || !data) {
      return [];
    }

    return data as PatientCaregiver[];
  }

  /**
   * ดึงรายชื่อ patients ของ caregiver
   */
  async getCaregiverPatients(caregiverId: string): Promise<PatientProfile[]> {
    const { data, error } = await supabase
      .from('patient_caregivers')
      .select('*, patient_profiles(*)')
      .eq('caregiver_id', caregiverId)
      .eq('status', 'active');

    if (error || !data) {
      return [];
    }

    return data.map(item => item.patient_profiles) as PatientProfile[];
  }

  /**
   * แก้ไข caregiver profile
   */
  async updateCaregiverProfile(
    caregiverId: string,
    updates: Partial<CaregiverProfile>
  ): Promise<CaregiverProfile> {
    const { data, error } = await supabase
      .from('caregiver_profiles')
      .update(updates)
      .eq('id', caregiverId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('แก้ไข profile ไม่สำเร็จ: ' + error?.message);
    }

    return data as CaregiverProfile;
  }

  /**
   * ดึงข้อมูล health goals
   */
  async getHealthGoals(patientId: string): Promise<HealthGoals | null> {
    const { data, error } = await supabase
      .from('health_goals')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as HealthGoals;
  }

  /**
   * แก้ไข health goals
   */
  async updateHealthGoals(
    patientId: string,
    updates: Partial<HealthGoals>
  ): Promise<HealthGoals> {
    const { data, error } = await supabase
      .from('health_goals')
      .update(updates)
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('แก้ไขเป้าหมายไม่สำเร็จ: ' + error?.message);
    }

    return data as HealthGoals;
  }

  /**
   * ดึงข้อมูล notification settings
   */
  async getNotificationSettings(patientId: string): Promise<NotificationSettings | null> {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as NotificationSettings;
  }

  /**
   * แก้ไข notification settings
   */
  async updateNotificationSettings(
    patientId: string,
    updates: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const { data, error } = await supabase
      .from('notification_settings')
      .update(updates)
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('แก้ไขการตั้งค่าไม่สำเร็จ: ' + error?.message);
    }

    return data as NotificationSettings;
  }

  /**
   * ดึงรายการยาของ patient
   */
  async getPatientMedications(patientId: string): Promise<PatientMedication[]> {
    const { data, error } = await supabase
      .from('patient_medications')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as PatientMedication[];
  }

  /**
   * เพิ่มยา
   */
  async addMedication(
    patientId: string,
    medication: Omit<PatientMedication, 'id' | 'patientId' | 'isActive' | 'createdAt' | 'updatedAt'>
  ): Promise<PatientMedication> {
    const { data, error } = await supabase
      .from('patient_medications')
      .insert({
        patient_id: patientId,
        ...medication
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('เพิ่มยาไม่สำเร็จ: ' + error?.message);
    }

    return data as PatientMedication;
  }

  /**
   * แก้ไขยา
   */
  async updateMedication(
    medicationId: string,
    updates: Partial<PatientMedication>
  ): Promise<PatientMedication> {
    const { data, error } = await supabase
      .from('patient_medications')
      .update(updates)
      .eq('id', medicationId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('แก้ไขยาไม่สำเร็จ: ' + error?.message);
    }

    return data as PatientMedication;
  }

  /**
   * ลบยา (soft delete)
   */
  async deleteMedication(medicationId: string): Promise<void> {
    const { error } = await supabase
      .from('patient_medications')
      .update({ is_active: false })
      .eq('id', medicationId);

    if (error) {
      throw new Error('ลบยาไม่สำเร็จ: ' + error.message);
    }
  }

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * คำนวณอายุจากวันเกิด
   */
  calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * คำนวณ BMI
   */
  calculateBMI(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  }

  /**
   * Create patient profile without LINE account
   * สร้าง patient profile สำหรับผู้ป่วยที่ไม่มีบัญชี LINE
   */
  async createPatientProfile(data: {
    firstName: string;
    lastName: string;
    birthDate: string;
    conditions?: string | null;
    groupId?: string | null;
  }): Promise<{ success: boolean; patientId: string; error?: string }> {
    try {
      console.log(`📝 Creating patient profile: ${data.firstName} ${data.lastName}`);

      // Insert into patient_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('patient_profiles')
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          birth_date: data.birthDate,
          // Convert conditions string to array for chronic_diseases field
          chronic_diseases: data.conditions ? [data.conditions] : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
          // Note: user_id is now NULLABLE (Migration 002) to support patients without LINE accounts
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ Error creating patient profile:', profileError);
        throw new Error(profileError.message);
      }

      console.log(`✅ Patient profile created: ${profile.id}`);

      // Create default reminders for the new patient
      try {
        await reminderService.createDefaultReminders(profile.id);
      } catch (reminderError) {
        console.error('⚠️ Failed to create default reminders (non-critical):', reminderError);
        // Don't fail the registration if reminders fail
      }

      return {
        success: true,
        patientId: profile.id
      };
    } catch (error: any) {
      console.error('❌ Create patient profile error:', error);
      return {
        success: false,
        patientId: '',
        error: error.message || 'Failed to create patient profile'
      };
    }
  }

  /**
   * Link caregiver to patient directly (without link code)
   * เชื่อมต่อ caregiver กับ patient โดยตรง
   */
  async linkCaregiverToPatient(
    caregiverId: string,
    patientId: string,
    relationship: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔗 Linking caregiver ${caregiverId} to patient ${patientId} with relationship: ${relationship}`);

      // Insert into patient_caregivers table (schema uses patient_caregivers not patient_caregiver_links)
      const { error: linkError } = await supabase
        .from('patient_caregivers')
        .insert({
          patient_id: patientId,
          caregiver_id: caregiverId,
          relationship: relationship,
          status: 'active', // Auto-approve for simplified registration (schema uses status not is_approved)
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (linkError) {
        console.error('❌ Error linking caregiver to patient:', linkError);
        throw new Error(linkError.message);
      }

      console.log(`✅ Caregiver linked to patient successfully`);

      return { success: true };
    } catch (error: any) {
      console.error('❌ Link caregiver to patient error:', error);
      return {
        success: false,
        error: error.message || 'Failed to link caregiver to patient'
      };
    }
  }

  /**
   * Format Thai date
   */
  formatThaiDate(date: Date): string {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543; // Buddhist Era

    return `${day} ${month} ${year}`;
  }
}

// Export singleton instance
export const userService = new UserService();
