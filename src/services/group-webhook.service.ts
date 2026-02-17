/**
 * Group Webhook Service (TASK-002)
 * Handles LINE webhook events in group context
 */

import { WebhookEvent } from '@line/bot-sdk';
import { groupService } from './group.service';
import { supabase } from './supabase.service';

export class GroupWebhookService {
  /**
   * Handle bot joining a group
   */
  async handleGroupJoin(event: any): Promise<{ success: boolean; message: string }> {
    try {
      const groupId = event.source?.groupId;

      if (!groupId) {
        throw new Error('No groupId in join event');
      }

      console.log(`🎉 Bot joined group: ${groupId}`);

      // Check if group is already registered
      const groupCheck = await groupService.checkGroupExists(groupId);

      if (groupCheck.exists) {
        console.log('✅ Group already registered:', groupCheck.group?.id);
        return {
          success: true,
          message: 'Group already registered'
        };
      }

      // Group not registered - this is expected
      // User will register via LIFF later
      console.log('📝 New group detected, waiting for registration via LIFF');

      return {
        success: true,
        message: 'New group detected'
      };

    } catch (error) {
      console.error('❌ Error handling group join:', error);
      throw error;
    }
  }

  /**
   * Handle bot leaving a group
   */
  async handleGroupLeave(event: any): Promise<{ success: boolean; message: string }> {
    try {
      const groupId = event.source?.groupId;

      if (!groupId) {
        throw new Error('No groupId in leave event');
      }

      console.log(`👋 Bot left group: ${groupId}`);

      // Mark group as inactive
      const { error } = await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('line_group_id', groupId);

      if (error) {
        console.error('❌ Error marking group inactive:', error);
      } else {
        console.log('✅ Group marked as inactive');
      }

      return {
        success: true,
        message: 'Group left and marked inactive'
      };

    } catch (error) {
      console.error('❌ Error handling group leave:', error);
      throw error;
    }
  }

  /**
   * Handle member joining a group
   */
  async handleMemberJoin(event: any): Promise<{ success: boolean; message: string }> {
    try {
      const groupId = event.source?.groupId;
      const joined = event.joined?.members || [];

      if (!groupId) {
        throw new Error('No groupId in memberJoined event');
      }

      console.log(`👥 ${joined.length} member(s) joined group: ${groupId}`);

      // Check if group is registered
      const groupData = await groupService.getGroupByLineId(groupId);

      if (!groupData) {
        console.log('⏭️ Group not registered yet, skipping member tracking');
        return {
          success: true,
          message: 'Group not registered'
        };
      }

      // Add members to group_members table
      for (const member of joined) {
        if (member.userId) {
          console.log(`➕ Adding member: ${member.userId}`);

          // Check if member already exists
          const { data: existingMember } = await supabase
            .from('group_members')
            .select('*')
            .eq('group_id', groupData.group.id)
            .eq('line_user_id', member.userId)
            .maybeSingle();

          if (existingMember) {
            // Reactivate if previously left
            if (!existingMember.is_active) {
              await supabase
                .from('group_members')
                .update({
                  is_active: true,
                  left_at: null
                })
                .eq('id', existingMember.id);

              console.log('✅ Reactivated member:', member.userId);
            }
          } else {
            // Add new member with 'family' role by default
            await groupService.addMember(groupData.group.id, {
              lineUserId: member.userId,
              displayName: `สมาชิก ${member.userId.substring(0, 8)}...`, // Placeholder, will be updated when they send first message
              role: 'family'
            });

            console.log('✅ Added new member:', member.userId);
          }

          // 🆕 Auto-detect: Check if this member is a caregiver with a patient
          const { userService } = await import('./user.service');
          const userCheck = await userService.checkUserExists(member.userId);

          if (userCheck.exists && userCheck.role === 'caregiver' && userCheck.profile) {
            const caregiverProfile = userCheck.profile as any;
            const linkedPatientId = caregiverProfile.linked_patient_id;

            if (linkedPatientId) {
              console.log(`🔍 Detected caregiver ${member.userId} with patient: ${linkedPatientId}`);

              // Check if patient already in group
              const { data: existingPatient } = await supabase
                .from('group_patients')
                .select('*')
                .eq('group_id', groupData.group.id)
                .eq('patient_id', linkedPatientId)
                .maybeSingle();

              if (!existingPatient) {
                // Get patient name
                const { data: patient } = await supabase
                  .from('patient_profiles')
                  .select('first_name, last_name, nickname')
                  .eq('id', linkedPatientId)
                  .single();

                const patientName = patient
                  ? `${patient.first_name} ${patient.last_name}${patient.nickname ? ` (${patient.nickname})` : ''}`
                  : 'สมาชิก';

                // Send confirmation message to group
                await this.sendAddPatientConfirmation(
                  groupId,
                  member.userId,
                  groupData.group.id,
                  linkedPatientId,
                  patientName
                );
              }
            }
          }
        }
      }

      return {
        success: true,
        message: `Added ${joined.length} member(s)`
      };

    } catch (error) {
      console.error('❌ Error handling member join:', error);
      throw error;
    }
  }

  /**
   * Handle member leaving a group
   */
  async handleMemberLeave(event: any): Promise<{ success: boolean; message: string }> {
    try {
      const groupId = event.source?.groupId;
      const left = event.left?.members || [];

      if (!groupId) {
        throw new Error('No groupId in memberLeft event');
      }

      console.log(`👋 ${left.length} member(s) left group: ${groupId}`);

      // Check if group is registered
      const groupData = await groupService.getGroupByLineId(groupId);

      if (!groupData) {
        console.log('⏭️ Group not registered, skipping');
        return {
          success: true,
          message: 'Group not registered'
        };
      }

      // Mark members as inactive
      for (const member of left) {
        if (member.userId) {
          console.log(`❌ Marking member inactive: ${member.userId}`);

          await supabase
            .from('group_members')
            .update({
              is_active: false,
              left_at: new Date().toISOString()
            })
            .eq('group_id', groupData.group.id)
            .eq('line_user_id', member.userId);

          console.log('✅ Member marked inactive:', member.userId);
        }
      }

      return {
        success: true,
        message: `Removed ${left.length} member(s)`
      };

    } catch (error) {
      console.error('❌ Error handling member leave:', error);
      throw error;
    }
  }

  /**
   * Handle text message in group
   */
  async handleGroupMessage(event: any, orchestratorResult: any): Promise<{
    success: boolean;
    groupData: any;
    actorInfo: { userId: string; displayName: string } | null;
  }> {
    try {
      const groupId = event.source?.groupId;
      const userId = event.source?.userId;

      if (!groupId) {
        throw new Error('No groupId in message event');
      }

      console.log(`📨 Group message from ${userId} in group ${groupId}`);

      // Get group data
      const groupData = await groupService.getGroupByLineId(groupId);

      if (!groupData) {
        console.log('⏭️ Group not registered, cannot process message');
        return {
          success: false,
          groupData: null,
          actorInfo: null
        };
      }

      // Get actor info (who sent the message)
      let actorInfo = null;
      if (userId) {
        // Try to find member in group_members
        const { data: member } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupData.group.id)
          .eq('line_user_id', userId)
          .maybeSingle();

        if (member) {
          actorInfo = {
            userId: member.line_user_id,
            displayName: member.display_name
          };
        } else {
          // Member not in group_members yet, use userId
          actorInfo = {
            userId: userId,
            displayName: `สมาชิก ${userId.substring(0, 8)}...`
          };
        }
      }

      console.log('👤 Actor info:', actorInfo);

      return {
        success: true,
        groupData,
        actorInfo
      };

    } catch (error) {
      console.error('❌ Error handling group message:', error);
      throw error;
    }
  }

  /**
   * Update member display name from LINE profile
   */
  async updateMemberProfile(
    groupId: string,
    userId: string,
    displayName: string,
    pictureUrl?: string
  ): Promise<void> {
    try {
      // Get group data
      const groupData = await groupService.getGroupByLineId(groupId);
      if (!groupData) return;

      // Update member info
      await supabase
        .from('group_members')
        .update({
          display_name: displayName,
          picture_url: pictureUrl || null
        })
        .eq('group_id', groupData.group.id)
        .eq('line_user_id', userId);

      console.log('✅ Updated member profile:', userId);

    } catch (error) {
      console.error('❌ Error updating member profile:', error);
    }
  }

  /**
   * Get group context for message processing
   */
  async getGroupContext(groupId: string): Promise<{
    patientId: string;
    groupId: string;
    source: 'group';
    patients?: any[]; // All patients in group (for multi-patient support)
  } | null> {
    try {
      const groupData = await groupService.getGroupByLineId(groupId);

      if (!groupData || !groupData.patients || groupData.patients.length === 0) {
        return null;
      }

      // Use active patient if set, otherwise use first patient
      let activePatient;
      if (groupData.group.activePatientId) {
        activePatient = groupData.patients.find(p => p.id === groupData.group.activePatientId);
        console.log(`✅ Using active patient: ${activePatient?.firstName}`);
      }

      // Fallback to first patient if active not found
      if (!activePatient) {
        activePatient = groupData.patients[0];
        if (groupData.patients.length > 1) {
          console.log(`⚠️ Group has ${groupData.patients.length} patients, using first: ${activePatient.firstName}`);
        }
      }

      return {
        patientId: activePatient.id,
        groupId: groupData.group.id,
        source: 'group',
        patients: groupData.patients // Include all for future use
      };

    } catch (error) {
      console.error('❌ Error getting group context:', error);
      return null;
    }
  }

  /**
   * Send add patient confirmation message to group
   */
  async sendAddPatientConfirmation(
    groupId: string,
    caregiverUserId: string,
    internalGroupId: string,
    patientId: string,
    patientName: string
  ): Promise<void> {
    try {
      const { lineClient } = await import('./line-client.service');

      await lineClient.pushMessage(groupId, {
        type: 'flex',
        altText: `เพิ่ม ${patientName} เข้ากลุ่ม?`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'box', layout: 'vertical', contents: [], width: '10px', height: '10px', backgroundColor: '#FFFFFF', cornerRadius: '50px', flex: 0 },
                  { type: 'text', text: 'อุ่นใจ', size: 'xs', color: '#FFFFFF', margin: 'sm', weight: 'bold', flex: 0 },
                  { type: 'text', text: 'สมาชิกใหม่', size: 'xs', color: '#FFFFFFB3', margin: 'md' },
                ],
                alignItems: 'center'
              },
              {
                type: 'text',
                text: `${patientName}`,
                weight: 'bold',
                size: 'xl',
                color: '#FFFFFF',
                margin: 'md'
              }
            ],
            backgroundColor: '#0FA968',
            paddingAll: 'xl',
            paddingBottom: 'lg'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'พบว่ามีสมาชิกที่ดูแลอยู่',
                color: '#3B4C63',
                wrap: true
              },
              {
                type: 'text',
                text: 'ต้องการเพิ่มเข้ากลุ่มนี้ไหมคะ?',
                margin: 'md',
                color: '#7B8DA0',
                wrap: true
              }
            ],
            paddingAll: 'xl'
          },
          footer: {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'เพิ่ม ✓',
                  data: `action=add_patient&group_id=${internalGroupId}&patient_id=${patientId}`
                },
                style: 'primary',
                color: '#0FA968'
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'ไม่เพิ่ม',
                  data: 'action=skip_add_patient'
                },
                style: 'secondary'
              }
            ]
          }
        }
      });

      console.log(`✅ Sent add patient confirmation to group: ${groupId}`);
    } catch (error) {
      console.error('❌ Error sending confirmation:', error);
    }
  }

  /**
   * Handle postback event (button click)
   */
  async handlePostback(event: any): Promise<{ success: boolean; message?: string }> {
    try {
      const data = event.postback?.data;
      const groupId = event.source?.groupId;

      if (!data) {
        return { success: false };
      }

      // Parse postback data
      const params = new URLSearchParams(data);
      const action = params.get('action');

      if (action === 'add_patient') {
        const internalGroupId = params.get('group_id');
        const patientId = params.get('patient_id');

        if (!internalGroupId || !patientId) {
          return { success: false };
        }

        // Get caregiver ID from patient_caregivers table
        const { data: caregiverLink } = await supabase
          .from('patient_caregivers')
          .select('caregiver_id')
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (!caregiverLink) {
          console.error('❌ No caregiver found for patient:', patientId);
          return { success: false };
        }

        // Add patient to group
        const result = await groupService.addPatientToGroup(internalGroupId, patientId, caregiverLink.caregiver_id);

        if (result.success) {
          const { lineClient } = await import('./line-client.service');

          // Get patient name
          const { data: patient } = await supabase
            .from('patient_profiles')
            .select('first_name, last_name, nickname')
            .eq('id', patientId)
            .single();

          const patientName = patient
            ? `${patient.first_name} ${patient.last_name}${patient.nickname ? ` (${patient.nickname})` : ''}`
            : 'สมาชิก';

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: `✅ เพิ่ม ${patientName} เข้ากลุ่มเรียบร้อยแล้วค่ะ\n\nตอนนี้สามารถบันทึกข้อมูลสุขภาพให้ได้แล้วนะคะ 📝`
          });
        }

        return { success: result.success };
      } else if (action === 'skip_add_patient') {
        const { lineClient } = await import('./line-client.service');

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: 'ตกลงค่ะ ถ้าต้องการเพิ่มทีหลัง สามารถใช้คำสั่ง /addpatient ได้นะคะ'
        });

        return { success: true };
      }

      return { success: false };
    } catch (error) {
      console.error('❌ Error handling postback:', error);
      return { success: false };
    }
  }
}

export const groupWebhookService = new GroupWebhookService();
