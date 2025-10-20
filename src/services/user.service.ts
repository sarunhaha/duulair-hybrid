/**
 * User Service
 * จัดการ registration และ profile management
 */

import { supabase } from './supabase.service';
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
    const { data: user, error } = await supabase
      .from('users')
      .select('*, patient_profiles(*), caregiver_profiles(*)')
      .eq('line_user_id', lineUserId)
      .single();

    if (error || !user) {
      return { exists: false };
    }

    const profile = user.role === 'patient'
      ? user.patient_profiles[0]
      : user.caregiver_profiles[0];

    return {
      exists: true,
      role: user.role,
      profile
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
    // 1. สร้าง user
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

    // 2. สร้าง patient profile
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

    // 3. สร้าง medications
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

    // 4. สร้าง health goals (ใช้ default หรือจากฟอร์ม)
    await supabase.from('health_goals').insert({
      patient_id: profile.id,
      ...form.healthGoals // ถ้ามีจากฟอร์ม จะ override defaults
    });

    // 5. สร้าง notification settings (default)
    await supabase.from('notification_settings').insert({
      patient_id: profile.id
    });

    // 6. สร้าง link code
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
    // 1. สร้าง user
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

    // 2. สร้าง caregiver profile
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

    // 3. ถ้ามี link code ให้เชื่อมต่อกับ patient
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
      throw new Error('สร้างรหัสเชื่อมต่อไม่สำเร็จ: ' + error?.message);
    }

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(code, {
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

    // 2. สร้างความสัมพันธ์ (status: pending - รอการอนุมัติ)
    const { data: relationshipData, error: relationshipError } = await supabase
      .from('patient_caregivers')
      .insert({
        patient_id: linkCodeData.patient_id,
        caregiver_id: caregiverId,
        relationship,
        status: 'pending'
      })
      .select()
      .single();

    if (relationshipError || !relationshipData) {
      throw new Error('เชื่อมต่อไม่สำเร็จ: ' + relationshipError?.message);
    }

    // 3. Mark link code as used
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
   * แก้ไข patient profile
   */
  async updatePatientProfile(
    patientId: string,
    updates: Partial<PatientProfile>
  ): Promise<PatientProfile> {
    const { data, error } = await supabase
      .from('patient_profiles')
      .update(updates)
      .eq('id', patientId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('แก้ไข profile ไม่สำเร็จ: ' + error?.message);
    }

    return data as PatientProfile;
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
