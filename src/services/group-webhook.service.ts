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

      // For now, use first patient (in order of added_at)
      // Future: implement patient selection UI
      const primaryPatient = groupData.patients[0];

      if (groupData.patients.length > 1) {
        console.log(`⚠️ Group has ${groupData.patients.length} patients, using first: ${primaryPatient.first_name}`);
      }

      return {
        patientId: primaryPatient.id,
        groupId: groupData.group.id,
        source: 'group',
        patients: groupData.patients // Include all for future use
      };

    } catch (error) {
      console.error('❌ Error getting group context:', error);
      return null;
    }
  }
}

export const groupWebhookService = new GroupWebhookService();
