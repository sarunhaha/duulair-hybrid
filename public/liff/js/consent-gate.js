// ========================================
// Consent Gate — redirect to consent.html if not accepted
// Include this AFTER api.js and AFTER LIFF init
// ========================================

/**
 * Check consent status and redirect if not accepted.
 * Call this after you have lineUserId available.
 * @param {string} lineUserId
 * @returns {Promise<boolean>} true if consent accepted, false if redirecting
 */
async function checkConsentGate(lineUserId) {
  if (!lineUserId) return true; // can't check without userId, allow through

  try {
    const result = await api.post('/registration/check', { line_user_id: lineUserId });

    if (result.exists && result.consent_accepted === false) {
      // Redirect to consent page
      window.location.href = `consent.html?uid=${encodeURIComponent(lineUserId)}`;
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Consent gate check failed, allowing through:', e);
    return true; // fail open — don't block user if API is down
  }
}
