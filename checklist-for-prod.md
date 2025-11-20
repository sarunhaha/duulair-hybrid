# Testing Checklist - LIFF Pages (API Centralization)

## Pre-requisites
- [ ] Deploy to Vercel staging/preview first
- [ ] Have a registered user account ready
- [ ] Have an unregistered LINE account for testing redirect flow

---

## 1. **index.html** (Entry Point)
**URL:** `https://liff.line.me/2008278683-5k69jxNq`

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Open as unregistered user | Redirects to registration.html | |
| Open as registered user | Redirects to dashboard.html | |
| Console shows no `api` errors | No "can't find variable: api" | |

---

## 2. **registration.html** (New User Registration)
**Test as:** Unregistered user

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads without errors | Form displays correctly | |
| Auto-fill from LINE profile | Name fields populated | |
| Submit registration form | API call to `/api/quick-register` works | |
| Success redirect | Closes LIFF or goes to dashboard | |
| Console: no API_BASE_URL errors | Uses shared api.js | |

---

## 3. **group-registration.html** (Group Registration)
**Test in:** LINE Group context

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads without errors | Form displays correctly | |
| Submit registration | API call works | |
| Console: no API_BASE_URL errors | Uses shared api.js | |

---

## 4. **dashboard.html** (Main Menu)
**Test as:** Registered user

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads with welcome message | Shows user name | |
| Registration check works | No redirect if registered | |
| All menu buttons clickable | Navigate to sub-pages | |
| Console: API_BASE_URL from api.js | No duplicate definition | |

---

## 5. **patient-profile.html** (Patient Info)
**Test as:** Registered caregiver

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads patient data | Shows patient info in tabs | |
| Check registration works | Uses `/api/check-user` | |
| Patient data loads | Uses `/api/patient/{id}` | |
| Edit buttons work | Navigate to edit-profile.html | |
| Console: no errors | API calls successful | |

---

## 6. **edit-profile.html** (Edit Patient)
**Test:** From patient-profile edit button

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads with patient data | Form pre-filled | |
| Save changes | PUT `/api/patient/{id}` works | |
| Success message | Shows "บันทึกสำเร็จ" | |
| Back navigation | Returns to patient-profile | |

---

## 7. **medications.html** (Medications)
**Test as:** Registered user

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads | Shows medication list | |
| Registration check | No redirect if registered | |
| Supabase queries work | Loads medications from DB | |
| Add medication | Saves to database | |

---

## 8. **reminders.html** (Reminders)
**Test as:** Registered user

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads | Shows reminders list | |
| Registration check | Uses API_BASE_URL from api.js | |
| Load reminders | Fetches from Supabase | |
| Add/edit reminder | Saves correctly | |

---

## 9. **water-tracking.html** (Water Intake)
**Test as:** Registered user

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads | Shows water tracker | |
| Registration check works | No errors in console | |
| Quick add buttons | Add 250/500/750 ml | |
| Custom amount | Save to localStorage | |

---

## 10. **settings.html** (Settings)
**Test as:** Registered user

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Page loads | Shows settings tabs | |
| Registration check | Uses API_BASE_URL from api.js | |
| Load user/patient data | `/api/check-user` and `/api/patient` work | |
| Toggle settings | Updates correctly | |
| No duplicate API_BASE_URL in console | Removed local definition | |

---

## Quick Console Check (All Pages)
Open browser DevTools and verify:
```javascript
// Should show the centralized URL
console.log(API_BASE_URL);
// Expected: "https://duulair.vercel.app/api" (production)
// or "http://localhost:3000/api" (local)
```

---

## Critical API Endpoints to Verify

| Endpoint | Used By |
|----------|---------|
| `GET /api/check-user/{lineUserId}` | All pages (registration check) |
| `GET /api/patient/{patientId}` | patient-profile, edit-profile, settings |
| `PUT /api/patient/{patientId}` | edit-profile |
| `POST /api/quick-register` | registration, group-registration |

---

## Sign-off

- [ ] All tests passed
- [ ] No console errors
- [ ] Ready for production

**Tested by:** _______________
**Date:** _______________
