/**
 * Voice Confirmation Service
 * จัดการ state ของการยืนยัน voice transcription
 */

import { supabase } from './supabase.service';

export interface PendingVoiceConfirmation {
  id: string;
  line_user_id: string;
  patient_id: string | null;
  transcribed_text: string;
  context: any;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
}

export interface VoiceContext {
  userId: string;
  patientId?: string;
  groupId?: string;
  isGroupContext?: boolean;
  actorLineUserId?: string;
  actorDisplayName?: string;
  originalAudioId?: string;
}

class VoiceConfirmationService {
  /**
   * บันทึก pending confirmation
   */
  async savePending(
    lineUserId: string,
    transcribedText: string,
    context: VoiceContext
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // ลบ pending เก่าของ user นี้ก่อน (ถ้ามี)
      await supabase
        .from('pending_voice_confirmations')
        .delete()
        .eq('line_user_id', lineUserId)
        .eq('status', 'pending');

      // สร้าง pending ใหม่
      const { data, error } = await supabase
        .from('pending_voice_confirmations')
        .insert({
          line_user_id: lineUserId,
          patient_id: context.patientId || null,
          transcribed_text: transcribedText,
          context: context,
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Failed to save pending voice confirmation:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Saved pending voice confirmation: ${data.id}`);
      return { success: true, id: data.id };
    } catch (err) {
      console.error('❌ Error saving pending voice confirmation:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * ดึง pending confirmation ของ user
   */
  async getPending(lineUserId: string): Promise<PendingVoiceConfirmation | null> {
    try {
      const { data, error } = await supabase
        .from('pending_voice_confirmations')
        .select('*')
        .eq('line_user_id', lineUserId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Failed to get pending voice confirmation:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('❌ Error getting pending voice confirmation:', err);
      return null;
    }
  }

  /**
   * ยืนยัน pending confirmation
   */
  async confirm(lineUserId: string): Promise<PendingVoiceConfirmation | null> {
    try {
      // Get pending first
      const pending = await this.getPending(lineUserId);
      if (!pending) {
        console.log('⚠️ No pending voice confirmation found for user:', lineUserId);
        return null;
      }

      // Update status
      const { error } = await supabase
        .from('pending_voice_confirmations')
        .update({ status: 'confirmed' })
        .eq('id', pending.id);

      if (error) {
        console.error('❌ Failed to confirm voice:', error);
        return null;
      }

      console.log(`✅ Voice confirmation confirmed: ${pending.id}`);
      return pending;
    } catch (err) {
      console.error('❌ Error confirming voice:', err);
      return null;
    }
  }

  /**
   * ปฏิเสธ pending confirmation
   */
  async reject(lineUserId: string): Promise<boolean> {
    try {
      const pending = await this.getPending(lineUserId);
      if (!pending) {
        return false;
      }

      const { error } = await supabase
        .from('pending_voice_confirmations')
        .update({ status: 'rejected' })
        .eq('id', pending.id);

      if (error) {
        console.error('❌ Failed to reject voice:', error);
        return false;
      }

      console.log(`✅ Voice confirmation rejected: ${pending.id}`);
      return true;
    } catch (err) {
      console.error('❌ Error rejecting voice:', err);
      return false;
    }
  }

  /**
   * ลบ pending confirmations ที่หมดอายุ
   */
  async cleanupExpired(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('pending_voice_confirmations')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('❌ Failed to cleanup expired confirmations:', error);
        return 0;
      }

      const count = data?.length || 0;
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} expired voice confirmations`);
      }
      return count;
    } catch (err) {
      console.error('❌ Error cleaning up expired confirmations:', err);
      return 0;
    }
  }
}

export const voiceConfirmationService = new VoiceConfirmationService();
