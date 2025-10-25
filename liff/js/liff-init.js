// ========================================
// LIFF SDK Initialization
// ========================================

const LIFF_ID = '2008278683-5k69jxNq';
let liffProfile = null;

/**
 * Initialize LIFF SDK
 * @returns {Promise<Object>} LIFF profile
 */
async function initLiff() {
  try {
    showLoading('กำลังเข้าสู่ระบบ...');

    // Initialize LIFF
    await liff.init({ liffId: LIFF_ID });

    console.log('✅ LIFF initialized');

    // Check if logged in
    if (!liff.isLoggedIn()) {
      console.log('❌ Not logged in, redirecting to login...');
      liff.login();
      return null;
    }

    // Get user profile
    liffProfile = await liff.getProfile();
    console.log('✅ LIFF Profile:', liffProfile);

    hideLoading();
    return liffProfile;

  } catch (error) {
    console.error('❌ LIFF initialization failed:', error);
    hideLoading();
    showError('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง');
    throw error;
  }
}

/**
 * Close LIFF window
 */
function closeLiff() {
  if (liff.isInClient()) {
    liff.closeWindow();
  } else {
    window.close();
  }
}

/**
 * Open external URL in external browser
 * @param {string} url
 */
function openExternalUrl(url) {
  if (liff.isInClient()) {
    liff.openWindow({
      url: url,
      external: true
    });
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Send LINE message (for sharing)
 * @param {string} message
 */
async function sendLineMessage(message) {
  if (liff.isInClient()) {
    try {
      await liff.sendMessages([{
        type: 'text',
        text: message
      }]);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  return false;
}

/**
 * Share target picker (for sharing link code)
 * @param {Object} message - LINE message object
 */
async function shareWithTargetPicker(message) {
  if (liff.isApiAvailable('shareTargetPicker')) {
    try {
      await liff.shareTargetPicker([message]);
      return true;
    } catch (error) {
      console.error('Error in shareTargetPicker:', error);
      return false;
    }
  }
  return false;
}
