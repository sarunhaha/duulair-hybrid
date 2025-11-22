// Check patient ก้อย
import { supabase } from './src/services/supabase.service';

async function checkGoyPatient() {
  console.log('=== Checking Patient ก้อย ===\n');

  // Find patient ก้อย
  const { data: patients, error } = await supabase
    .from('patient_profiles')
    .select('*')
    .ilike('first_name', '%ก้อย%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!patients || patients.length === 0) {
    console.log('❌ ไม่พบผู้ป่วยชื่อ ก้อย');
    return;
  }

  console.log(`✅ พบผู้ป่วย ${patients.length} คน:\n`);

  for (const patient of patients) {
    console.log(`Patient ID: ${patient.id}`);
    console.log(`Name: ${patient.first_name} ${patient.last_name}`);
    console.log(`User ID: ${patient.user_id || 'null'}`);
    console.log(`Created: ${patient.created_at}`);

    // Check if has user
    if (patient.user_id) {
      const { data: user } = await supabase
        .from('users')
        .select('line_user_id, display_name')
        .eq('id', patient.user_id)
        .single();

      if (user) {
        console.log(`LINE User: ${user.line_user_id} (${user.display_name})`);
      }
    }

    // Check caregivers
    const { data: links } = await supabase
      .from('patient_caregivers')
      .select(`
        *,
        caregiver_profiles(
          id,
          first_name,
          last_name,
          user_id,
          users(line_user_id, display_name)
        )
      `)
      .eq('patient_id', patient.id);

    if (links && links.length > 0) {
      console.log(`\nCaregivers (${links.length}):`);
      for (const link of links) {
        const cg = link.caregiver_profiles as any;
        console.log(`  - ${cg.first_name} ${cg.last_name}`);
        console.log(`    Status: ${link.status}`);
        console.log(`    LINE: ${cg.users?.line_user_id || 'none'}`);
      }
    } else {
      console.log('\n❌ ไม่มี caregiver');
    }

    // Check groups
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .eq('patient_id', patient.id);

    if (groups && groups.length > 0) {
      console.log(`\nGroups (${groups.length}):`);
      for (const group of groups) {
        console.log(`  - Group ID: ${group.id}`);
        console.log(`    LINE Group ID: ${group.line_group_id}`);
        console.log(`    Name: ${group.group_name || 'N/A'}`);
        console.log(`    Active: ${group.is_active}`);
      }
    } else {
      console.log('\n❌ ไม่มี group');
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  process.exit(0);
}

checkGoyPatient();
