// ========================================
// Group Dashboard Logic (TASK-002)
// ========================================

let groupData = null;

// ========================================
// Initialization
// ========================================

async function init() {
  try {
    console.log('🚀 Initializing group dashboard...');

    // Initialize LIFF
    liffProfile = await initLiff();
    if (!liffProfile) {
      showError('ไม่สามารถเชื่อมต่อกับ LINE ได้');
      return;
    }

    // Check if in group context
    const context = liff.getContext();
    console.log('📱 LIFF Context:', context);

    if (context.type !== 'group') {
      showError('กรุณาเปิดหน้านี้จากกลุ่ม LINE');
      return;
    }

    // Load group data
    await loadGroupData(context.groupId);

  } catch (error) {
    console.error('❌ Initialization error:', error);
    showError('เกิดข้อผิดพลาด: ' + error.message);
  }
}

// ========================================
// Load Group Data
// ========================================

async function loadGroupData(lineGroupId) {
  try {
    console.log('📥 Loading group data for:', lineGroupId);

    // Show loading
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('groupInfo').classList.add('hidden');

    // Fetch group info
    const response = await fetch(`/api/groups/by-line-id/${lineGroupId}`);

    if (!response.ok) {
      if (response.status === 404) {
        // Group not registered
        showError('กลุ่มนี้ยังไม่ได้ลงทะเบียน กำลังพาคุณไปหน้าลงทะเบียน...');
        setTimeout(() => {
          window.location.href = '/liff/group-registration.html';
        }, 2000);
        return;
      }
      throw new Error('ไม่สามารถโหลดข้อมูลกลุ่มได้');
    }

    const result = await response.json();
    groupData = result;

    console.log('✅ Group data loaded:', groupData);

    // Populate UI
    populateGroupInfo();

    // Hide loading, show content
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('groupInfo').classList.remove('hidden');

  } catch (error) {
    console.error('❌ Error loading group data:', error);
    hideLoading();
    showError('ไม่สามารถโหลดข้อมูลกลุ่มได้: ' + error.message);
  }
}

// ========================================
// Populate Group Info
// ========================================

function populateGroupInfo() {
  if (!groupData) return;

  // Group name
  const groupNameEl = document.getElementById('groupName');
  if (groupNameEl) {
    groupNameEl.textContent = groupData.group.groupName || 'ไม่ระบุ';
  }

  // Patient name
  const patientNameEl = document.getElementById('patientName');
  if (patientNameEl && groupData.patient) {
    const nickname = groupData.patient.nickname ? ` (${groupData.patient.nickname})` : '';
    patientNameEl.textContent = `${groupData.patient.first_name} ${groupData.patient.last_name}${nickname}`;
  }

  // Caregiver name
  const caregiverNameEl = document.getElementById('caregiverName');
  if (caregiverNameEl && groupData.primaryCaregiver) {
    caregiverNameEl.textContent = `${groupData.primaryCaregiver.first_name} ${groupData.primaryCaregiver.last_name}`;
  }

  // Members list
  populateMembersList();
}

// ========================================
// Populate Members List
// ========================================

function populateMembersList() {
  const membersListEl = document.getElementById('membersList');
  if (!membersListEl || !groupData.members) return;

  membersListEl.innerHTML = '';

  if (groupData.members.length === 0) {
    membersListEl.innerHTML = '<p class="text-small text-center" style="color: #999;">ยังไม่มีสมาชิก</p>';
    return;
  }

  groupData.members.forEach(member => {
    const memberEl = document.createElement('div');
    memberEl.className = 'member-item';
    memberEl.style.cssText = `
      display: flex;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid #E0E0E0;
    `;

    // Role icon
    let roleIcon = '👤';
    if (member.role === 'caregiver') roleIcon = '👨‍⚕️';
    else if (member.role === 'patient') roleIcon = '👴';
    else if (member.role === 'family') roleIcon = '👨‍👩‍👧';

    memberEl.innerHTML = `
      <div style="flex: 1;">
        <div style="font-weight: 500;">${roleIcon} ${member.display_name}</div>
        <div style="font-size: 12px; color: #666;">
          ${getRoleLabel(member.role)} • เข้าร่วมเมื่อ ${formatDate(new Date(member.joined_at))}
        </div>
      </div>
    `;

    membersListEl.appendChild(memberEl);
  });
}

// ========================================
// Helper Functions
// ========================================

function getRoleLabel(role) {
  const labels = {
    'caregiver': 'ผู้ดูแลหลัก',
    'patient': 'ผู้ป่วย',
    'family': 'ครอบครัว'
  };
  return labels[role] || role;
}

function formatDate(date) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('th-TH', options);
}

// ========================================
// Quick Actions
// ========================================

function logActivity() {
  liff.closeWindow();
  // User will use chat to log activities
}

function viewReports() {
  showInfo('ฟีเจอร์รายงานกำลังพัฒนา...');
  // TODO: Implement in Phase 5
}

function viewSettings() {
  showInfo('ฟีเจอร์ตั้งค่ากำลังพัฒนา...');
  // TODO: Implement in Phase 5
}

// ========================================
// Start when DOM is ready
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
