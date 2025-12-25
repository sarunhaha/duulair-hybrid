// ========================================
// 🔍 Query สำหรับ test ดู data ใน database
// ========================================
// วิธีใช้: node test-query.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mqxklnzxfrupwwkwlwwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xeGtsbnp4ZnJ1cHd3a3dsd3djIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzA2NzEyNiwiZXhwIjoyMDcyNjQzMTI2fQ.mA9TZvpaCE3i_DEuy-G2kBj32HuQHjkjOjSgYzUe0MY'
);

(async () => {
  const today = new Date().toISOString().split('T')[0];

  console.log('\n========================================');
  console.log('📊 VITALS_LOGS (ทั้งหมด)');
  console.log('========================================');
  const { data: vitals } = await supabase
    .from('vitals_logs')
    .select('id, patient_id, bp_systolic, bp_diastolic, heart_rate, source, measured_at')
    .order('measured_at', { ascending: false });
  console.table(vitals);

  console.log('\n========================================');
  console.log('📊 VITALS_LOGS (วันนี้: ' + today + ')');
  console.log('========================================');
  const { data: todayVitals } = await supabase
    .from('vitals_logs')
    .select('*')
    .gte('measured_at', today + 'T00:00:00')
    .order('measured_at', { ascending: false });
  console.table(todayVitals);

  console.log('\n========================================');
  console.log('👥 PATIENT_PROFILES');
  console.log('========================================');
  const { data: patients } = await supabase
    .from('patient_profiles')
    .select('id, first_name, last_name');
  console.table(patients);

  console.log('\n========================================');
  console.log('🔗 PATIENT_CAREGIVERS');
  console.log('========================================');
  const { data: links } = await supabase
    .from('patient_caregivers')
    .select('patient_id, caregiver_id, relationship, status');
  console.table(links);

  console.log('\n========================================');
  console.log('💊 ACTIVITY_LOGS (ล่าสุด 10)');
  console.log('========================================');
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('id, patient_id, task_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.table(activities);

  console.log('\n========================================');
  console.log('💊 MEDICATIONS');
  console.log('========================================');
  const { data: meds } = await supabase
    .from('medications')
    .select('id, patient_id, name, active');
  console.table(meds);
})();
