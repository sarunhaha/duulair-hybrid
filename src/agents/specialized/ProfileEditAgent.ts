/**
 * ProfileEditAgent
 *
 * Chat-based profile editing agent for OONJAI.
 * Allows users to edit patient profile, medications, and reminders via LINE chat.
 *
 * @version 1.0.0
 */

import { BaseAgent, Message, Response, Config } from '../core/BaseAgent';
import { AGENT_MODELS } from '../../services/openrouter.service';
import { userService } from '../../services/user.service';
import { medicationService, Medication, DosageForm, DosageUnit, Frequency, DayOfWeek } from '../../services/medication.service';
import { reminderService, Reminder, ReminderType } from '../../services/reminder.service';

// Validation rules for profile fields
const VALIDATION_RULES = {
  weight_kg: { min: 20, max: 200, unit: 'กก.' },
  height_cm: { min: 50, max: 250, unit: 'ซม.' },
  phone_number: { pattern: /^0\d{8,9}$/, format: '0XX-XXX-XXXX' },
  blood_type: { valid: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'A', 'B', 'AB', 'O'] }
};

// Field name mappings (Thai to DB field)
const FIELD_MAPPINGS: Record<string, string> = {
  'weight': 'weight_kg',
  'height': 'height_cm',
  'phone': 'phone_number',
  'firstname': 'first_name',
  'lastname': 'last_name',
  'nickname': 'nickname',
  'address': 'address',
  'bloodtype': 'blood_type',
  'condition': 'medical_condition',
  'drugallergy': 'drug_allergies',
  'foodallergy': 'food_allergies',
  'emergencyname': 'emergency_contact_name',
  'emergencyphone': 'emergency_contact_phone',
  'emergencyrelation': 'emergency_contact_relation'
};

export class ProfileEditAgent extends BaseAgent {
  constructor(config?: Partial<Config>) {
    super({
      name: 'profile_edit',
      role: 'Handle profile and data editing via chat',
      ...AGENT_MODELS.profile_edit,
      ...config
    });
  }

  async initialize(): Promise<boolean> {
    this.log('info', 'ProfileEditAgent initialized');
    await this.loadState();
    return true;
  }

  async process(message: Message): Promise<Response> {
    const startTime = Date.now();
    const intent = message.metadata?.intent as string;
    const patientId = message.context.patientId;

    this.log('info', `Processing edit intent: ${intent}`, { patientId });

    // Check if patientId exists
    if (!patientId) {
      return this.createErrorResponse(
        'ไม่พบข้อมูลสมาชิก กรุณาลงทะเบียนก่อนค่ะ',
        startTime
      );
    }

    try {
      // Route to appropriate handler based on intent
      switch (intent) {
        // Profile edits
        case 'edit_weight':
          return await this.handleEditWeight(message, patientId, startTime);
        case 'edit_height':
          return await this.handleEditHeight(message, patientId, startTime);
        case 'edit_phone':
          return await this.handleEditPhone(message, patientId, startTime);
        case 'edit_name':
          return await this.handleEditName(message, patientId, startTime);
        case 'edit_address':
          return await this.handleEditAddress(message, patientId, startTime);
        case 'edit_blood_type':
          return await this.handleEditBloodType(message, patientId, startTime);
        case 'edit_medical_condition':
          return await this.handleEditMedicalCondition(message, patientId, startTime);
        case 'edit_allergies':
          return await this.handleEditAllergies(message, patientId, startTime);
        case 'edit_emergency_contact':
          return await this.handleEditEmergencyContact(message, patientId, startTime);
        case 'edit_profile':
          return await this.handleGenericEdit(message, patientId, startTime);

        // Medication CRUD
        case 'add_medication':
          return await this.handleAddMedication(message, patientId, startTime);
        case 'edit_medication':
          return await this.handleEditMedication(message, patientId, startTime);
        case 'delete_medication':
          return await this.handleDeleteMedication(message, patientId, startTime);

        // Reminder CRUD
        case 'add_reminder':
          return await this.handleAddReminder(message, patientId, startTime);
        case 'edit_reminder':
          return await this.handleEditReminder(message, patientId, startTime);
        case 'delete_reminder':
          return await this.handleDeleteReminder(message, patientId, startTime);

        default:
          return await this.handleGenericEdit(message, patientId, startTime);
      }
    } catch (error: any) {
      this.log('error', 'Profile edit failed', { error: error.message });
      return this.createErrorResponse(
        `เกิดข้อผิดพลาด: ${error.message}`,
        startTime
      );
    }
  }

  // ========================================
  // Profile Edit Handlers
  // ========================================

  private async handleEditWeight(message: Message, patientId: string, startTime: number): Promise<Response> {
    const weight = this.extractNumber(message.content);

    if (!weight) {
      return this.askForValue('น้ำหนัก', 'กก.', 'เช่น "น้ำหนัก 65 กิโล"', startTime);
    }

    // Validate
    if (weight < VALIDATION_RULES.weight_kg.min || weight > VALIDATION_RULES.weight_kg.max) {
      return this.invalidValue(
        'น้ำหนัก',
        `${VALIDATION_RULES.weight_kg.min}-${VALIDATION_RULES.weight_kg.max} ${VALIDATION_RULES.weight_kg.unit}`,
        startTime
      );
    }

    // Update
    await userService.updatePatientProfile(patientId, { weight_kg: weight } as any);

    return this.successResponse('น้ำหนัก', `${weight} กก.`, startTime);
  }

  private async handleEditHeight(message: Message, patientId: string, startTime: number): Promise<Response> {
    const height = this.extractNumber(message.content);

    if (!height) {
      return this.askForValue('ส่วนสูง', 'ซม.', 'เช่น "สูง 165 ซม."', startTime);
    }

    // Validate
    if (height < VALIDATION_RULES.height_cm.min || height > VALIDATION_RULES.height_cm.max) {
      return this.invalidValue(
        'ส่วนสูง',
        `${VALIDATION_RULES.height_cm.min}-${VALIDATION_RULES.height_cm.max} ${VALIDATION_RULES.height_cm.unit}`,
        startTime
      );
    }

    // Update
    await userService.updatePatientProfile(patientId, { height_cm: height } as any);

    return this.successResponse('ส่วนสูง', `${height} ซม.`, startTime);
  }

  private async handleEditPhone(message: Message, patientId: string, startTime: number): Promise<Response> {
    const phone = this.extractPhoneNumber(message.content);

    if (!phone) {
      return this.askForValue('เบอร์โทร', '', 'เช่น "เบอร์ 0891234567"', startTime);
    }

    // Validate
    if (!VALIDATION_RULES.phone_number.pattern.test(phone)) {
      return this.invalidValue('เบอร์โทร', VALIDATION_RULES.phone_number.format, startTime);
    }

    // Format and update
    const formattedPhone = this.formatPhoneNumber(phone);
    await userService.updatePatientProfile(patientId, { phone_number: formattedPhone } as any);

    return this.successResponse('เบอร์โทร', formattedPhone, startTime);
  }

  private async handleEditName(message: Message, patientId: string, startTime: number): Promise<Response> {
    // Try to extract name using Claude
    const extracted = await this.extractWithClaude(message.content, 'name');

    if (!extracted || (!extracted.first_name && !extracted.last_name && !extracted.nickname)) {
      return this.askForValue('ชื่อ', '', 'เช่น "ชื่อใหม่คือ สมศรี มงคล" หรือ "ชื่อเล่น แม่"', startTime);
    }

    const updateData: any = {};
    if (extracted.first_name) updateData.first_name = extracted.first_name;
    if (extracted.last_name) updateData.last_name = extracted.last_name;
    if (extracted.nickname) updateData.nickname = extracted.nickname;

    await userService.updatePatientProfile(patientId, updateData);

    const updatedFields = Object.entries(updateData)
      .map(([key, value]) => {
        if (key === 'first_name') return `ชื่อ: ${value}`;
        if (key === 'last_name') return `นามสกุล: ${value}`;
        if (key === 'nickname') return `ชื่อเล่น: ${value}`;
        return '';
      })
      .filter(Boolean)
      .join(', ');

    return this.successResponse('ชื่อ', updatedFields, startTime);
  }

  private async handleEditAddress(message: Message, patientId: string, startTime: number): Promise<Response> {
    const extracted = await this.extractWithClaude(message.content, 'address');

    if (!extracted || !extracted.address) {
      return this.askForValue('ที่อยู่', '', 'เช่น "ที่อยู่ใหม่ 123/45 หมู่บ้านสุขใจ"', startTime);
    }

    await userService.updatePatientProfile(patientId, { address: extracted.address } as any);

    return this.successResponse('ที่อยู่', extracted.address, startTime);
  }

  private async handleEditBloodType(message: Message, patientId: string, startTime: number): Promise<Response> {
    const bloodType = this.extractBloodType(message.content);

    if (!bloodType) {
      return this.askForValue('กรุ๊ปเลือด', '', 'เช่น "กรุ๊ปเลือด O+" หรือ "เลือด AB"', startTime);
    }

    // Validate
    if (!VALIDATION_RULES.blood_type.valid.includes(bloodType)) {
      return this.invalidValue('กรุ๊ปเลือด', 'A, B, AB, O (+ หรือ -)', startTime);
    }

    await userService.updatePatientProfile(patientId, { blood_type: bloodType } as any);

    return this.successResponse('กรุ๊ปเลือด', bloodType, startTime);
  }

  private async handleEditMedicalCondition(message: Message, patientId: string, startTime: number): Promise<Response> {
    const extracted = await this.extractWithClaude(message.content, 'medical_condition');

    if (!extracted || !extracted.condition) {
      return this.askForValue('โรคประจำตัว', '', 'เช่น "โรคประจำตัวคือ ความดันสูง เบาหวาน"', startTime);
    }

    await userService.updatePatientProfile(patientId, { medical_condition: extracted.condition } as any);

    return this.successResponse('โรคประจำตัว', extracted.condition, startTime);
  }

  private async handleEditAllergies(message: Message, patientId: string, startTime: number): Promise<Response> {
    const extracted = await this.extractWithClaude(message.content, 'allergies');

    if (!extracted || (!extracted.drug_allergies && !extracted.food_allergies)) {
      return this.askForValue('การแพ้', '', 'เช่น "แพ้ยาเพนนิซิลิน" หรือ "แพ้อาหารทะเล"', startTime);
    }

    const updateData: any = {};

    // Get current profile to merge allergies
    const currentProfile = await userService.getPatientProfile(patientId);

    if (extracted.drug_allergies) {
      const currentDrugAllergies = (currentProfile as any)?.drug_allergies || currentProfile?.drugAllergies || [];
      const newAllergies = [...new Set([...currentDrugAllergies, ...extracted.drug_allergies])];
      updateData.drug_allergies = newAllergies;
    }

    if (extracted.food_allergies) {
      const currentFoodAllergies = (currentProfile as any)?.food_allergies || currentProfile?.foodAllergies || [];
      const newAllergies = [...new Set([...currentFoodAllergies, ...extracted.food_allergies])];
      updateData.food_allergies = newAllergies;
    }

    await userService.updatePatientProfile(patientId, updateData);

    const allergiesList = [
      ...(extracted.drug_allergies || []).map((a: string) => `ยา: ${a}`),
      ...(extracted.food_allergies || []).map((a: string) => `อาหาร: ${a}`)
    ].join(', ');

    return this.successResponse('การแพ้', allergiesList, startTime);
  }

  private async handleEditEmergencyContact(message: Message, patientId: string, startTime: number): Promise<Response> {
    const extracted = await this.extractWithClaude(message.content, 'emergency_contact');

    if (!extracted || (!extracted.name && !extracted.phone && !extracted.relation)) {
      return this.askForValue(
        'ผู้ติดต่อฉุกเฉิน',
        '',
        'เช่น "ผู้ติดต่อฉุกเฉิน คุณสมชาย 0891234567 ลูกชาย"',
        startTime
      );
    }

    const updateData: any = {};
    if (extracted.name) updateData.emergency_contact_name = extracted.name;
    if (extracted.phone) updateData.emergency_contact_phone = extracted.phone;
    if (extracted.relation) updateData.emergency_contact_relation = extracted.relation;

    await userService.updatePatientProfile(patientId, updateData);

    const contactInfo = [
      extracted.name,
      extracted.phone,
      extracted.relation ? `(${extracted.relation})` : ''
    ].filter(Boolean).join(' ');

    return this.successResponse('ผู้ติดต่อฉุกเฉิน', contactInfo, startTime);
  }

  private async handleGenericEdit(message: Message, patientId: string, startTime: number): Promise<Response> {
    // Use Claude to understand what field user wants to edit
    const extracted = await this.extractWithClaude(message.content, 'generic');

    if (!extracted || !extracted.field) {
      return this.createResponse(
        true,
        {
          text: 'คุณต้องการแก้ไขข้อมูลอะไรคะ?\n\n' +
            '📝 ข้อมูลที่แก้ไขได้:\n' +
            '• น้ำหนัก - พิมพ์ "น้ำหนัก 65 กก."\n' +
            '• ส่วนสูง - พิมพ์ "สูง 165 ซม."\n' +
            '• เบอร์โทร - พิมพ์ "เบอร์ 0891234567"\n' +
            '• ชื่อ/ชื่อเล่น - พิมพ์ "ชื่อใหม่คือ..."\n' +
            '• กรุ๊ปเลือด - พิมพ์ "กรุ๊ปเลือด O+"\n' +
            '• โรคประจำตัว - พิมพ์ "เพิ่มโรค..."\n' +
            '• การแพ้ยา/อาหาร - พิมพ์ "แพ้ยา..."\n' +
            '• ผู้ติดต่อฉุกเฉิน - พิมพ์ "เปลี่ยนผู้ติดต่อฉุกเฉิน..."',
          requiresFollowUp: true
        },
        startTime
      );
    }

    // If Claude extracted field and value, update directly
    if (extracted.value) {
      const updateData: any = {};
      updateData[extracted.field] = extracted.value;
      await userService.updatePatientProfile(patientId, updateData);
      return this.successResponse(extracted.fieldThai || extracted.field, extracted.value, startTime);
    }

    return this.askForValue(extracted.fieldThai || extracted.field, '', '', startTime);
  }

  // ========================================
  // Medication Handlers
  // ========================================

  private async handleAddMedication(message: Message, patientId: string, startTime: number): Promise<Response> {
    // Try to extract medication info from single message
    const extracted = await this.extractMedicationInfo(message.content);

    if (!extracted || !extracted.name) {
      return this.createResponse(
        true,
        {
          text: 'กรุณาบอกรายละเอียดยาค่ะ\n\n' +
            '💊 ตัวอย่าง:\n' +
            '• "เพิ่มยาเมทฟอร์มิน 500mg เช้าเย็น"\n' +
            '• "ยาใหม่ แอสไพริน 1 เม็ด เช้า หลังอาหาร"\n' +
            '• "เพิ่มยาลดความดัน โลซาร์แทน 50mg ก่อนนอน"',
          requiresFollowUp: true
        },
        startTime
      );
    }

    // Create medication
    const medication: Medication = {
      patient_id: patientId,
      name: extracted.name,
      dosage_amount: extracted.dosage_amount || 1,
      dosage_form: (extracted.dosage_form || 'tablet') as DosageForm,
      dosage_unit: (extracted.dosage_unit || 'tablet') as DosageUnit,
      frequency: (extracted.frequency || 'daily') as Frequency,
      times: extracted.times || ['08:00'],
      instructions: extracted.instructions,
      reminder_enabled: true
    };

    const result = await medicationService.addMedication(medication);

    if (!result.success) {
      return this.createErrorResponse(`เพิ่มยาไม่สำเร็จ: ${result.error}`, startTime);
    }

    const dosageText = `${medication.dosage_amount} ${this.formatDosageUnit(medication.dosage_unit)}`;
    const timesText = this.formatTimes(medication.times);

    return this.createResponse(
      true,
      {
        text: `✅ เพิ่มยา ${medication.name} เรียบร้อยแล้วค่ะ\n\n` +
          `💊 ${medication.name}\n` +
          `• ขนาด: ${dosageText}\n` +
          `• เวลา: ${timesText}\n` +
          (medication.instructions ? `• หมายเหตุ: ${medication.instructions}\n` : '') +
          `• เตือนทานยา: เปิด ✓`
      },
      startTime
    );
  }

  private async handleEditMedication(message: Message, patientId: string, startTime: number): Promise<Response> {
    // Get current medications
    const medications = await medicationService.getPatientMedications(patientId);

    if (medications.length === 0) {
      return this.createResponse(
        true,
        { text: 'ไม่พบรายการยาที่บันทึกไว้ค่ะ กรุณาเพิ่มยาก่อน' },
        startTime
      );
    }

    // Try to extract which medication to edit
    const extracted = await this.extractMedicationInfo(message.content);

    if (!extracted || !extracted.name) {
      const medList = medications.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
      return this.createResponse(
        true,
        {
          text: `ต้องการแก้ไขยาตัวไหนคะ?\n\n💊 รายการยา:\n${medList}\n\n` +
            'พิมพ์ชื่อยาที่ต้องการแก้ไขพร้อมข้อมูลใหม่ค่ะ\n' +
            'เช่น "แก้ยา [ชื่อยา] เป็น [ข้อมูลใหม่]"',
          requiresFollowUp: true
        },
        startTime
      );
    }

    // Find matching medication
    const matchedMed = medications.find(m =>
      m.name.toLowerCase().includes(extracted.name.toLowerCase())
    );

    if (!matchedMed) {
      return this.createResponse(
        true,
        { text: `ไม่พบยา "${extracted.name}" ในรายการค่ะ กรุณาตรวจสอบชื่อยา` },
        startTime
      );
    }

    // Update medication
    const updates: Partial<Medication> = {};
    if (extracted.dosage_amount) updates.dosage_amount = extracted.dosage_amount;
    if (extracted.times) updates.times = extracted.times;
    if (extracted.instructions !== undefined) updates.instructions = extracted.instructions;

    if (Object.keys(updates).length === 0) {
      return this.createResponse(
        true,
        { text: 'กรุณาระบุข้อมูลที่ต้องการแก้ไขค่ะ เช่น ขนาดยา หรือเวลาทาน' },
        startTime
      );
    }

    const result = await medicationService.updateMedication(matchedMed.id!, updates);

    if (!result.success) {
      return this.createErrorResponse(`แก้ไขยาไม่สำเร็จ: ${result.error}`, startTime);
    }

    return this.createResponse(
      true,
      { text: `✅ แก้ไขยา ${matchedMed.name} เรียบร้อยแล้วค่ะ` },
      startTime
    );
  }

  private async handleDeleteMedication(message: Message, patientId: string, startTime: number): Promise<Response> {
    // Get current medications
    const medications = await medicationService.getPatientMedications(patientId);

    if (medications.length === 0) {
      return this.createResponse(
        true,
        { text: 'ไม่พบรายการยาที่บันทึกไว้ค่ะ' },
        startTime
      );
    }

    // Try to extract which medication to delete
    const extracted = await this.extractMedicationInfo(message.content);

    if (!extracted || !extracted.name) {
      const medList = medications.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
      return this.createResponse(
        true,
        {
          text: `ต้องการลบยาตัวไหนคะ?\n\n💊 รายการยา:\n${medList}\n\n` +
            'พิมพ์ชื่อยาที่ต้องการลบค่ะ เช่น "ลบยา [ชื่อยา]"',
          requiresFollowUp: true,
          quickReplies: medications.map(m => ({
            type: 'action',
            action: {
              type: 'message',
              label: m.name.substring(0, 20),
              text: `ลบยา ${m.name}`
            }
          }))
        },
        startTime
      );
    }

    // Find matching medication
    const matchedMed = medications.find(m =>
      m.name.toLowerCase().includes(extracted.name.toLowerCase())
    );

    if (!matchedMed) {
      return this.createResponse(
        true,
        { text: `ไม่พบยา "${extracted.name}" ในรายการค่ะ` },
        startTime
      );
    }

    // Delete medication
    const result = await medicationService.deleteMedication(matchedMed.id!);

    if (!result.success) {
      return this.createErrorResponse(`ลบยาไม่สำเร็จ: ${result.error}`, startTime);
    }

    return this.createResponse(
      true,
      { text: `✅ ลบยา ${matchedMed.name} เรียบร้อยแล้วค่ะ` },
      startTime
    );
  }

  // ========================================
  // Reminder Handlers
  // ========================================

  private async handleAddReminder(message: Message, patientId: string, startTime: number): Promise<Response> {
    const extracted = await this.extractReminderInfo(message.content);

    if (!extracted || !extracted.title || !extracted.time) {
      return this.createResponse(
        true,
        {
          text: 'กรุณาบอกรายละเอียดการเตือนค่ะ\n\n' +
            '🔔 ตัวอย่าง:\n' +
            '• "ตั้งเตือนกินยาเช้า 8 โมง"\n' +
            '• "เพิ่มเตือนวัดความดัน 09:00"\n' +
            '• "ตั้งเตือนดื่มน้ำ 10:00 14:00 16:00"',
          requiresFollowUp: true
        },
        startTime
      );
    }

    const reminder: Reminder = {
      patient_id: patientId,
      title: extracted.title,
      custom_time: extracted.time,
      reminder_type: extracted.type || 'custom',
      frequency: 'daily',
      is_active: true,
      notification_enabled: true
    };

    const result = await reminderService.createReminder(reminder);

    if (!result.success) {
      return this.createErrorResponse(`ตั้งเตือนไม่สำเร็จ: ${result.error}`, startTime);
    }

    return this.createResponse(
      true,
      {
        text: `✅ ตั้งเตือน "${reminder.title}" เวลา ${reminder.custom_time} เรียบร้อยแล้วค่ะ`
      },
      startTime
    );
  }

  private async handleEditReminder(message: Message, patientId: string, startTime: number): Promise<Response> {
    const reminders = await reminderService.getPatientReminders(patientId);

    if (reminders.length === 0) {
      return this.createResponse(
        true,
        { text: 'ไม่พบรายการเตือนที่ตั้งไว้ค่ะ กรุณาเพิ่มการเตือนก่อน' },
        startTime
      );
    }

    const extracted = await this.extractReminderInfo(message.content);

    if (!extracted || !extracted.title) {
      const reminderList = reminders.map((r, i) =>
        `${i + 1}. ${r.title} (${r.custom_time || r.type})`
      ).join('\n');

      return this.createResponse(
        true,
        {
          text: `ต้องการแก้ไขการเตือนไหนคะ?\n\n🔔 รายการเตือน:\n${reminderList}`,
          requiresFollowUp: true
        },
        startTime
      );
    }

    // Find matching reminder
    const matchedReminder = reminders.find(r =>
      r.title.toLowerCase().includes(extracted.title.toLowerCase())
    );

    if (!matchedReminder) {
      return this.createResponse(
        true,
        { text: `ไม่พบการเตือน "${extracted.title}" ค่ะ` },
        startTime
      );
    }

    // Update reminder
    const updates: Partial<Reminder> = {};
    if (extracted.time) updates.custom_time = extracted.time;
    if (extracted.title && extracted.title !== matchedReminder.title) updates.title = extracted.title;

    const result = await reminderService.updateReminder(matchedReminder.id!, updates);

    if (!result.success) {
      return this.createErrorResponse(`แก้ไขการเตือนไม่สำเร็จ: ${result.error}`, startTime);
    }

    return this.createResponse(
      true,
      { text: `✅ แก้ไขการเตือน "${matchedReminder.title}" เรียบร้อยแล้วค่ะ` },
      startTime
    );
  }

  private async handleDeleteReminder(message: Message, patientId: string, startTime: number): Promise<Response> {
    const reminders = await reminderService.getPatientReminders(patientId);

    if (reminders.length === 0) {
      return this.createResponse(
        true,
        { text: 'ไม่พบรายการเตือนที่ตั้งไว้ค่ะ' },
        startTime
      );
    }

    const extracted = await this.extractReminderInfo(message.content);

    if (!extracted || !extracted.title) {
      const reminderList = reminders.map((r, i) =>
        `${i + 1}. ${r.title} (${r.custom_time || r.type})`
      ).join('\n');

      return this.createResponse(
        true,
        {
          text: `ต้องการลบการเตือนไหนคะ?\n\n🔔 รายการเตือน:\n${reminderList}\n\n` +
            'พิมพ์ชื่อการเตือนที่ต้องการลบค่ะ',
          requiresFollowUp: true
        },
        startTime
      );
    }

    // Find matching reminder
    const matchedReminder = reminders.find(r =>
      r.title.toLowerCase().includes(extracted.title.toLowerCase())
    );

    if (!matchedReminder) {
      return this.createResponse(
        true,
        { text: `ไม่พบการเตือน "${extracted.title}" ค่ะ` },
        startTime
      );
    }

    const result = await reminderService.deleteReminder(matchedReminder.id!);

    if (!result.success) {
      return this.createErrorResponse(`ลบการเตือนไม่สำเร็จ: ${result.error}`, startTime);
    }

    return this.createResponse(
      true,
      { text: `✅ ลบการเตือน "${matchedReminder.title}" เรียบร้อยแล้วค่ะ` },
      startTime
    );
  }

  // ========================================
  // Extraction Helpers
  // ========================================

  private extractNumber(text: string): number | null {
    // Match Thai and Arabic numerals
    const match = text.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  private extractPhoneNumber(text: string): string | null {
    const match = text.match(/0\d{8,9}/);
    return match ? match[0] : null;
  }

  private formatPhoneNumber(phone: string): string {
    if (phone.length === 10) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  }

  private extractBloodType(text: string): string | null {
    const patterns = [
      /กรุ๊ป\s*(A|B|AB|O)\s*([+-])?/i,
      /เลือด\s*(A|B|AB|O)\s*([+-])?/i,
      /(A|B|AB|O)\s*([+-])/i,
      /^(A|B|AB|O)$/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const type = match[1].toUpperCase();
        const sign = match[2] || '';
        return type + sign;
      }
    }
    return null;
  }

  private async extractWithClaude(text: string, extractType: string): Promise<any> {
    const systemPrompt = `คุณเป็น entity extractor สำหรับระบบ OONJAI
Extract ข้อมูลจากข้อความภาษาไทย

ประเภทการ extract: ${extractType}

สำหรับ name:
- first_name: ชื่อจริง
- last_name: นามสกุล
- nickname: ชื่อเล่น

สำหรับ address:
- address: ที่อยู่แบบเต็ม

สำหรับ medical_condition:
- condition: โรคประจำตัว/โรคเรื้อรัง

สำหรับ allergies:
- drug_allergies: array ของยาที่แพ้
- food_allergies: array ของอาหารที่แพ้

สำหรับ emergency_contact:
- name: ชื่อผู้ติดต่อ
- phone: เบอร์โทร
- relation: ความสัมพันธ์ (ลูก, หลาน, พี่น้อง, etc.)

สำหรับ generic:
- field: ชื่อ field ใน database (weight_kg, height_cm, etc.)
- fieldThai: ชื่อ field ภาษาไทย
- value: ค่าที่ต้องการอัพเดต

ตอบเป็น JSON เท่านั้น ถ้าไม่พบข้อมูลให้ตอบ {}`;

    const userPrompt = `Extract จากข้อความนี้: "${text}"
ตอบ JSON only:`;

    try {
      const response = await this.askClaude(userPrompt, systemPrompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      this.log('error', 'Claude extraction failed', { error: e });
      return null;
    }
  }

  private async extractMedicationInfo(text: string): Promise<any> {
    const systemPrompt = `คุณเป็น entity extractor สำหรับข้อมูลยา

Extract ข้อมูลยาจากข้อความภาษาไทย:
- name: ชื่อยา (required)
- dosage_amount: จำนวน (ตัวเลข, default 1)
- dosage_unit: หน่วย (tablet, capsule, ml, mg - default tablet)
- dosage_form: รูปแบบ (tablet, capsule, liquid - default tablet)
- times: array ของเวลา ["08:00", "20:00"]
- frequency: daily, weekly, specific_days, as_needed
- instructions: คำแนะนำ เช่น หลังอาหาร ก่อนนอน

ตัวอย่าง:
"ยาเมทฟอร์มิน 500mg เช้าเย็น หลังอาหาร"
→ {"name": "เมทฟอร์มิน", "dosage_amount": 500, "dosage_unit": "mg", "times": ["08:00", "18:00"], "instructions": "หลังอาหาร"}

"ลบยาพาราเซตามอล"
→ {"name": "พาราเซตามอล"}

ตอบ JSON เท่านั้น ถ้าไม่พบข้อมูลให้ตอบ {}`;

    const userPrompt = `Extract จากข้อความ: "${text}"
JSON only:`;

    try {
      const response = await this.askClaude(userPrompt, systemPrompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      this.log('error', 'Medication extraction failed', { error: e });
      return null;
    }
  }

  private async extractReminderInfo(text: string): Promise<any> {
    const systemPrompt = `คุณเป็น entity extractor สำหรับข้อมูลการเตือน

Extract ข้อมูลจากข้อความภาษาไทย:
- title: ชื่อการเตือน
- time: เวลาในรูปแบบ HH:MM (24 ชม.)
- type: medication, vitals, water, food, exercise, custom

แปลงเวลาไทย:
- 8 โมงเช้า → 08:00
- บ่าย 2 → 14:00
- 4 ทุ่ม → 22:00
- เที่ยง → 12:00

ตอบ JSON เท่านั้น ถ้าไม่พบข้อมูลให้ตอบ {}`;

    const userPrompt = `Extract จากข้อความ: "${text}"
JSON only:`;

    try {
      const response = await this.askClaude(userPrompt, systemPrompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      this.log('error', 'Reminder extraction failed', { error: e });
      return null;
    }
  }

  // ========================================
  // Response Helpers
  // ========================================

  private askForValue(field: string, unit: string, example: string, startTime: number): Response {
    return this.createResponse(
      true,
      {
        text: `กรุณาบอก${field}ค่ะ` +
          (unit ? ` (หน่วย: ${unit})` : '') +
          (example ? `\n${example}` : ''),
        requiresFollowUp: true
      },
      startTime
    );
  }

  private invalidValue(field: string, validRange: string, startTime: number): Response {
    return this.createResponse(
      true,
      {
        text: `❌ ${field}ไม่ถูกต้องค่ะ กรุณาใส่ค่าระหว่าง ${validRange}`,
        requiresFollowUp: true
      },
      startTime
    );
  }

  private successResponse(field: string, value: string, startTime: number): Response {
    return this.createResponse(
      true,
      { text: `✅ บันทึก${field} ${value} เรียบร้อยแล้วค่ะ` },
      startTime
    );
  }

  private createErrorResponse(error: string, startTime: number): Response {
    return this.createResponse(
      false,
      { text: `❌ ${error}` },
      startTime
    );
  }

  private createResponse(success: boolean, data: any, startTime: number): Response {
    return {
      success,
      data,
      agentName: this.config.name,
      processingTime: Date.now() - startTime,
      metadata: { handler: 'profile_edit' }
    };
  }

  private formatDosageUnit(unit: DosageUnit): string {
    const unitMap: Record<DosageUnit, string> = {
      tablet: 'เม็ด',
      capsule: 'แคปซูล',
      ml: 'มล.',
      mg: 'มก.',
      g: 'ก.',
      drop: 'หยด',
      puff: 'พัฟ',
      unit: 'หน่วย'
    };
    return unitMap[unit] || unit;
  }

  private formatTimes(times: string[]): string {
    const timeMap: Record<string, string> = {
      '06:00': 'เช้ามืด',
      '07:00': 'เช้า',
      '08:00': 'เช้า',
      '09:00': 'เช้า',
      '12:00': 'เที่ยง',
      '13:00': 'บ่าย',
      '14:00': 'บ่าย',
      '17:00': 'เย็น',
      '18:00': 'เย็น',
      '19:00': 'ค่ำ',
      '20:00': 'ค่ำ',
      '21:00': 'ก่อนนอน',
      '22:00': 'ก่อนนอน'
    };

    return times.map(t => timeMap[t] || t).join(', ');
  }

  getCapabilities(): string[] {
    return [
      'profile-editing',
      'medication-management',
      'reminder-management',
      'entity-extraction',
      'thai-language'
    ];
  }
}

// Export singleton
export const profileEditAgent = new ProfileEditAgent();
