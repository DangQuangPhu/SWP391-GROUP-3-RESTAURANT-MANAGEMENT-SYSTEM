# Phūrai Authentication — Manual Test Cases

**Location:** `test-cases/auth-test-cases.md`  
**Also mirrored:** `src/test-cases/auth-test-cases.md` (sync if updated)

---

## A. Login Validation

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| A-01 | Empty email/username | On `/login`, Login tab | Leave identifier empty, enter password, submit | password: `Test123!` | Inline error: identifier required; no API call | |
| A-02 | Empty password | On `/login` | Enter identifier, leave password empty, submit | identifier: `user@test.com` | Inline error: password required | |
| A-03 | Wrong password | Verified user exists | Submit login | identifier: valid, password: wrong | Error: incorrect password | |
| A-04 | Non-existing user | DB has no matching user | Submit login | identifier: `nobody@test.com`, password: `Test123!` | Error: account does not exist | |
| A-05 | Unverified user | User `is_email_verified=0` | Submit login | valid credentials | 403 `EMAIL_NOT_VERIFIED`; offer resend; no session | |
| A-06 | Verified user success | User active + verified | Submit login | valid credentials | Welcome overlay → Home; profile icon visible | |

---

## B. Create Account Validation

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| B-01 | Empty First Name | Create Account tab | Submit empty form | all empty | First name required error | |
| B-02 | Empty Last Name | Create Account tab | Submit | firstName filled | Last name required | |
| B-03 | Empty Username | Create Account tab | Submit | missing username | Username required | |
| B-04 | Empty Email | Create Account tab | Submit | missing email | Email required | |
| B-05 | Invalid Email | Create Account tab | Submit | email: `not-an-email` | Invalid email format | |
| B-06 | Empty Phone | Create Account tab | Submit | missing phone | Phone required | |
| B-07 | Phone contains letters | Create Account tab | Submit | phone: `09abc12345` | Digits only error | |
| B-08 | Phone too short | Create Account tab | Submit | phone: `123456789` | 10–11 digits error | |
| B-09 | Phone too long | Create Account tab | Submit | phone: `123456789012` | 10–11 digits error | |
| B-10 | Empty Date of Birth | Create Account tab | Submit | missing DOB | DOB required | |
| B-11 | Invalid Date of Birth | Create Account tab | Submit | DOB: invalid | Valid date error | |
| B-12 | Age under 13 | Create Account tab | Submit | DOB: last year | Age 13+ error | |
| B-13 | Empty Password | Create Account tab | Submit | empty password | Password required | |
| B-14 | Weak Password | Create Account tab | Submit | password: `password` | Security rules error; weak meter | |
| B-15 | Confirm mismatch | Create Account tab | Submit | passwords differ | Mismatch error | |
| B-16 | Terms not checked | Create Account tab | Submit | terms unchecked | Terms error | |
| B-17 | Duplicate Email | Email exists in DB | Submit valid form | existing email | 409 email exists | |
| B-18 | Duplicate Username | Username exists | Submit | existing username | 409 username exists | |
| B-19 | Duplicate Phone | Phone exists | Submit | existing phone | 409 phone exists | |
| B-20 | Successful register OTP | Clean email | Complete valid form | all valid | OTP screen; email sent / `[DEV]` log | |

---

## C. OTP Verification

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| C-01 | Empty OTP | OTP screen open | Click VERIFY empty | — | Enter 6-digit code error | |
| C-02 | Less than 6 digits | OTP screen | Enter 3 digits, verify | `123` | All 6 digits error | |
| C-03 | Wrong OTP | Pending user | Enter wrong code | `000000` | Incorrect code | |
| C-04 | Correct OTP | Valid token in DB | Enter correct code | matching OTP | Account verified; welcome/login | |
| C-05 | Resend before 30s | OTP just sent | Click Resend immediately | — | Disabled / 429 / countdown | |
| C-06 | Resend after 30s | Wait 30s | Click Resend | — | New code sent; countdown resets | |
| C-07 | New OTP replaces old | After resend | Verify with old OTP | old code | Fails; new code works | |

---

## D. Google Create Account

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| D-01 | Missing VITE_GOOGLE_CLIENT_ID | No client ID in `.env` | Click Continue with Google | — | Config error message | |
| D-02 | Google popup opens | Client ID configured | Click Continue with Google | — | Account chooser appears | |
| D-03 | User cancels Google | Popup shown | Cancel selection | — | Clean error; no login | |
| D-04 | Invalid token | Tampered credential | POST `/google-register` | bad token | Invalid token error | |
| D-05 | Google email not verified | Google account unverified | Register | — | Email not verified error | |
| D-06 | New Google user pending | New Gmail | Complete Google register | new Gmail | Pending user; OTP screen | |
| D-07 | OTP to selected Gmail | SMTP or dev log | Check inbox/log | selected Gmail | OTP at selected email, not hardcoded | |
| D-08 | Verified Google email exists | Active user | Google register same email | — | 409 sign in instead | |
| D-09 | After OTP active | Pending Google user | Verify OTP | correct code | `is_email_verified=1`, can login | |

---

## E. Forgot Password (Login Page)

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| E-01 | Empty identifier | Forgot screen | Submit empty | — | Required error | |
| E-02 | Invalid email format | Forgot screen | Submit | `bad-email` | Invalid email | |
| E-03 | Phone letters | Forgot screen | Submit | `09abc` | Digits only | |
| E-04 | Unknown email/phone | No user | Submit | unknown | No account found | |
| E-05 | Existing email OTP | User by email | Submit email | valid email | OTP sent to account email | |
| E-06 | Existing phone OTP | User by phone | Submit phone | valid phone | OTP to account email | |
| E-07 | Wrong reset OTP | Reset OTP screen | Wrong code | `000000` | Incorrect code | |
| E-08 | Expired reset OTP | Wait 5+ min | Verify | expired | Expired error | |
| E-09 | Correct OTP → reset form | Valid reset OTP | Verify | correct | Reset password form | |
| E-10 | Empty new password | Reset form | Submit empty | — | Required errors | |
| E-11 | Weak new password | Reset form | Submit weak | `weak` | Security error | |
| E-12 | Confirm mismatch | Reset form | Mismatch | — | Mismatch error | |
| E-13 | Reset success | Valid session | Reset password | strong match | Success message; Login tab | |
| E-14 | Old password fails login | After reset | Login old password | old | Login fails | |
| E-15 | New password login | After reset | Login new password | new | Login success | |
| E-16 | Resend reset cooldown | Reset OTP | Resend &lt;30s | — | Blocked with countdown | |

---

## F. Profile (Navbar & Modal)

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| F-01 | Profile icon after login | Logged in | Observe navbar | — | Avatar right of RESERVATIONS | |
| F-02 | Username in menu | Logged in | Open dropdown | — | @username shown | |
| F-03 | Logout restores Sign In | Logged in | Logout | — | SIGN IN visible; profile hidden | |
| F-04 | Update first/last name | Edit profile | Save valid names | — | Saved; persists | |
| F-05 | Duplicate username rejected | Username taken | Change username | duplicate | 409 error | |
| F-06 | Phone digits only | Edit profile | Letters in phone | `09abc` | Validation error | |
| F-07 | Valid DOB | Edit profile | Valid date 13+ | — | Saves | |
| F-08 | Avatar immediate update | Edit profile | Upload valid image | jpg &lt;2MB | Avatar updates in modal/navbar | |
| F-09 | Avatar persists | After F-08 | Close/reopen profile | — | Same avatar | |
| F-10 | Google avatar replaced | Google user | Upload new avatar | png | Uploaded replaces Google URL in DB | |

---

## G. Profile Validation (Extended)

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| G-01 | Empty First Name | Edit profile | Clear first name | — | Required | |
| G-02 | First Name numbers | Edit profile | `John1` | — | Letters/spaces only | |
| G-03 | Empty Last Name | Edit profile | Clear last name | — | Required | |
| G-04 | Last Name special chars | Edit profile | `Doe!` | — | Letters/spaces only | |
| G-05 | Empty Username | Edit profile | Clear username | — | Required | |
| G-06 | Username &lt;3 chars | Edit profile | `ab` | — | 3–30 chars error | |
| G-07 | Username spaces | Edit profile | `john doe` | — | Format error | |
| G-08 | Duplicate Username | Taken username | Save | duplicate | 409 | |
| G-09 | Empty Phone | Edit profile | Clear phone | — | Required | |
| G-10 | Phone letters | Edit profile | `abc` | — | Digits error | |
| G-11 | Phone too short | Edit profile | 9 digits | — | 10–11 error | |
| G-12 | Phone too long | Edit profile | 12 digits | — | 10–11 error | |
| G-13 | Duplicate Phone | Taken phone | Save | duplicate | 409 | |
| G-14 | Empty DOB | Edit profile | Clear DOB | — | Required | |
| G-15 | Invalid DOB | Edit profile | invalid | — | Valid date error | |
| G-16 | Age under 13 | Edit profile | recent DOB | — | Age error | |
| G-17 | Valid profile update | All valid | Save | — | Success | |
| G-18 | Avatar wrong type | Edit profile | Upload `.gif` | gif | Rejected | |
| G-19 | Avatar over 2MB | Edit profile | Large file | &gt;2MB | Rejected | |
| G-20 | Avatar success | Edit profile | Valid webp | webp | Saved | |
| G-21 | Avatar persists reopen | After G-20 | Close/reopen | — | Still shown | |

---

## H. Change Password (Profile)

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| H-01 | Empty Old Password | Change password | Verify empty | — | Required | |
| H-02 | Wrong Old Password | Change password | Wrong old | wrong | Incorrect message | |
| H-03 | Correct old shows new fields | Valid user | Verify old | correct | New + confirm fields appear | |
| H-04 | Empty New Password | Step 2 | Submit empty | — | Required | |
| H-05 | Weak New Password | Step 2 | `password` | weak | Rules error | |
| H-06 | No uppercase | Step 2 | `test1234!` | — | Fails rules | |
| H-07 | No lowercase | Step 2 | `TEST1234!` | — | Fails rules | |
| H-08 | No number | Step 2 | `TestTest!` | — | Fails rules | |
| H-09 | No special | Step 2 | `Test1234` | — | Fails rules | |
| H-10 | Confirm mismatch | Step 2 | mismatch | — | Mismatch error | |
| H-11 | Same as old | Step 2 | same as old | — | Must differ error | |
| H-12 | Valid change | Step 2 | strong new | `NewPass1!` | Success message | |
| H-13 | Login old fails | After H-12 | Login old | old | Fails | |
| H-14 | Login new succeeds | After H-12 | Login new | new | Success | |
| H-15 | Forgot old password link | Change password | Click link | — | Navigates to `/login` forgot flow | |

---

## Avatar Management

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| AV-01 | Google user default avatar | User registers/logs in with Google | Complete Google auth; open Profile and Navbar | — | `AvatarUrl` saved from Google `picture`; displays in Navbar and Profile | |
| AV-02 | No avatar fallback | `AvatarUrl` is NULL | Open Profile / Navbar | — | Circle shows first letter of username (or email), not broken image | |
| AV-03 | Broken avatar URL fallback | `AvatarUrl` is invalid URL | Open Profile / Navbar | bad URL | Fallback initial shown; no broken image icon | |
| AV-04 | Upload invalid file type | Logged in; Change Avatar | Upload PDF or TXT | non-image | Rejected: "Avatar must be JPG, PNG, or WEBP." | |
| AV-05 | Upload file over 2MB | Logged in; Change Avatar | Upload large image | > 2MB | Rejected: "Avatar must be smaller than 2MB." | |
| AV-06 | Upload valid avatar | Logged in; Change Avatar | Upload PNG/JPG/WEBP under 2MB | valid image | Avatar updates immediately in Profile and Navbar | |
| AV-07 | Uploaded avatar persists | After AV-06 | Close profile → reopen → switch page → reload | — | Uploaded avatar still appears | |
| AV-08 | Random system avatar selection | Logged in; Change Avatar | Choose system avatar from grid | `/avatars/avatar-N.svg` | Selected avatar in Profile and Navbar | |
| AV-09 | Random avatar persists | After AV-08 | Close profile → reopen → reload | — | System avatar still appears | |
| AV-10 | Google avatar replaced by upload | User has Google avatar | Upload custom avatar | valid image | Custom avatar replaces Google; persists in DB and UI | |
| AV-11 | Profile save should not clear avatar | User has any avatar | Edit first name only → Save Changes | — | `AvatarUrl` unchanged; avatar still displays | |

---

## Manual API Commands

```bash
curl -i http://localhost:5001/health

curl -X POST http://localhost:5001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your_test_email@gmail.com"}'
```
