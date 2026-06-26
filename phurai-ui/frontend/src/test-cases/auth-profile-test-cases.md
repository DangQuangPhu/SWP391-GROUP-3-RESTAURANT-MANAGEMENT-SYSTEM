# Phūrai Authentication & Profile — Test Cases

**Language:** English  
**Scope:** Frontend demo only (no backend, API, or real OAuth)

**Demo credentials**

| Item | Value |
|------|-------|
| Valid email | demo@phurai.com |
| Valid phone | 0964813966 |
| Correct password | Phurai123! |
| Wrong password | Wrong123! |
| Invalid email | abc@ |
| Invalid phone | 12345 |
| Weak password | abc123 |
| Medium password | Phurai123 |
| Strong password | Phurai123! |
| Correct OTP | 123456 |
| Wrong OTP | 000000 |
| Demo user name | Amanda |

---

## Login Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| LOGIN-001 | Login | Empty email/phone | Auth modal open, Login tab | Leave identifier empty, enter password, click SIGN IN | Password: Phurai123! | Red inline error: required | High |
| LOGIN-002 | Login | Invalid email format | Auth modal open | Enter invalid email, submit | abc@ | Red inline error: valid email | High |
| LOGIN-003 | Login | Invalid phone format | Auth modal open | Enter invalid phone, submit | 12345 | Red inline error: valid phone | High |
| LOGIN-004 | Login | Empty password | Auth modal open | Enter demo@phurai.com, leave password empty, submit | Email: demo@phurai.com | Red inline error: password required | High |
| LOGIN-005 | Login | Password &lt; 8 characters | Auth modal open | Enter demo email, short password, submit | Password: abc1234 | Red inline error: min 8 characters | High |
| LOGIN-006 | Login | Non-existing account | Auth modal open | Enter unknown account, valid-length password, submit | unknown@test.com / Phurai123! | Light red alert: account does not exist | High |
| LOGIN-007 | Login | Wrong password | Auth modal open | Enter demo account, wrong password, submit | demo@phurai.com / Wrong123! | Light red alert: incorrect password | High |
| LOGIN-008 | Login | Valid email login | Auth modal open | Enter demo email and password, submit | demo@phurai.com / Phurai123! | OTP screen appears | High |
| LOGIN-009 | Login | Valid phone login | Auth modal open | Enter demo phone and password, submit | 0964813966 / Phurai123! | OTP screen appears | High |
| LOGIN-010 | Login | Toggle password visibility | Login form visible | Type password, click eye icon twice | Phurai123! | Password toggles show/hide | Medium |
| LOGIN-011 | Login | Remember me | Login form visible | Click Remember me twice | N/A | Checkbox toggles | Low |
| LOGIN-012 | Login | Forgot password link | Login form visible | Observe form | N/A | Forgot password link visible | Low |
| LOGIN-013 | Login | Google starts OTP | Login form visible | Click Sign in with Google | N/A | OTP screen appears (demo user Amanda) | High |

---

## Create Account Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| REG-001 | Register | All fields empty | Create Account tab | Submit empty form | All empty | Multiple red inline errors | High |
| REG-002 | Register | Empty full name | Create Account tab | Submit without name | Name empty | Red error on full name | High |
| REG-003 | Register | Name &lt; 2 chars | Create Account tab | Enter 1 char name, submit | A | Red error: min 2 characters | High |
| REG-004 | Register | Name with numbers | Create Account tab | Enter name with digit, submit | John2 | Red error: no numbers | High |
| REG-005 | Register | Empty email/phone | Create Account tab | Submit without identifier | Empty | Red error: required | High |
| REG-006 | Register | Invalid email | Create Account tab | Submit invalid email | abc@ | Red error: valid email | High |
| REG-007 | Register | Invalid phone | Create Account tab | Submit invalid phone | 12345 | Red error: valid phone | High |
| REG-008 | Register | Empty password | Create Account tab | Submit without password | Empty | Red error: required | High |
| REG-009 | Register | Password &lt; 8 | Create Account tab | Short password, submit | abc1234 | Red error: min 8 characters | High |
| REG-010 | Register | Password with spaces | Create Account tab | Password with space, submit | Phurai 123 | Red error: no spaces | High |
| REG-011 | Register | Low strength | Create Account tab | Weak password, submit | abc123 | 1 red bar; blocked with weak message | High |
| REG-012 | Register | Medium strength | Create Account tab | Type medium password | Phurai123 | 2 amber/gold bars | Medium |
| REG-013 | Register | Strong strength | Create Account tab | Type strong password | Phurai123! | 3 green bars | Medium |
| REG-014 | Register | Empty confirm | Create Account tab | Leave confirm empty, submit | Valid other fields | Red error on confirm | High |
| REG-015 | Register | Mismatch confirm | Create Account tab | Different confirm, submit | Mismatch | Red error: do not match | High |
| REG-016 | Register | Terms not accepted | Create Account tab | Valid fields, terms unchecked | Valid data | Red terms error | High |
| REG-017 | Register | Successful register | Create Account tab | Valid data, terms checked, submit | Strong password, matching confirm | OTP screen appears | High |
| REG-018 | Register | Toggle password | Create Account tab | Toggle password eye | Phurai123! | Visibility toggles | Medium |
| REG-019 | Register | Toggle confirm | Create Account tab | Toggle confirm eye | Phurai123! | Visibility toggles | Medium |
| REG-020 | Register | Google starts OTP | Create Account tab | Click Continue with Google | N/A | OTP screen appears | High |
| REG-021 | Register | Switch to Login | Create Account tab | Click Login link | N/A | Login form shown | Medium |

---

## Password Strength Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| PWD-001 | Password strength | Empty neutral | Create Account tab | Focus password, leave empty | (empty) | Neutral bars, helper text | Medium |
| PWD-002 | Password strength | Weak 1 red bar | Create Account tab | Type weak password | abc123 | 1 red bar active | High |
| PWD-003 | Password strength | Medium 2 bars | Create Account tab | Type medium password | Phurai123 | 2 amber/gold bars | High |
| PWD-004 | Password strength | Strong 3 bars | Create Account tab | Type strong password | Phurai123! | 3 green bars | High |
| PWD-005 | Password strength | Low blocks submit | Create Account tab | Weak password, valid other fields, submit | abc123 | No OTP; weak error shown | High |

---

## OTP Verification Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| OTP-001 | OTP | After valid login | Completed valid login | Observe screen | N/A | OTP UI shown, form hidden | High |
| OTP-002 | OTP | After valid register | Completed valid register | Observe screen | N/A | OTP UI shown | High |
| OTP-003 | OTP | After Google | Clicked Google on login/signup | Observe screen | N/A | OTP UI shown | High |
| OTP-004 | OTP | Empty OTP | OTP screen | Click VERIFY with empty boxes | (empty) | Red error message | High |
| OTP-005 | OTP | Incomplete OTP | OTP screen | Enter 3 digits, verify | Partial | Red error: all 6 digits | High |
| OTP-006 | OTP | Incorrect OTP | OTP screen | Enter wrong 6 digits, verify | 000000 | Red error: incorrect code | High |
| OTP-007 | OTP | Correct OTP | OTP screen | Enter 123456, verify | 123456 | Welcome overlay starts | High |
| OTP-008 | OTP | Auto-focus next | OTP screen | Type one digit per box | 1-6 sequential | Focus moves to next box | Medium |
| OTP-009 | OTP | Backspace previous | OTP screen | Focus box 2, backspace when empty | N/A | Focus moves to previous | Medium |
| OTP-010 | OTP | Paste 6 digits | OTP screen | Paste 123456 | 123456 | All boxes filled | Medium |
| OTP-011 | OTP | Resend visible | OTP screen | Observe UI | N/A | Resend Code visible | Low |
| OTP-012 | OTP | Back to Login | OTP screen | Click Back to Login | N/A | Login/Create Account form returns | Medium |

---

## Welcome Overlay Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| WEL-001 | Welcome | Appears after OTP | Correct OTP entered | Verify OTP | 123456 | Full-screen welcome shown | High |
| WEL-002 | Welcome | Darkens background | Welcome visible | Observe page | N/A | Dark dim overlay on content | High |
| WEL-003 | Welcome | Displays user name | Registered as Amanda / custom name | Observe message | Amanda / custom | Welcome, {name} to Phūrai | High |
| WEL-004 | Welcome | Auto dismiss 3s | Welcome visible | Wait ~3 seconds | N/A | Overlay fades and disappears | High |
| WEL-005 | Welcome | Navbar updates after | Welcome completed | Observe navbar | N/A | Sign In hidden; avatar shown | High |

---

## Navbar Authenticated State Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| NAV-001 | Navbar | Unauthenticated | Logged out | Observe navbar | N/A | SIGN IN + RESERVATIONS visible | High |
| NAV-002 | Navbar | Authenticated | Logged in after welcome | Observe navbar | N/A | RESERVATIONS + avatar; no SIGN IN | High |
| NAV-003 | Navbar | Avatar opens dropdown | Authenticated | Click avatar | N/A | Dropdown menu opens | High |
| NAV-004 | Navbar | Click outside closes | Dropdown open | Click outside menu | N/A | Dropdown closes | Medium |
| NAV-005 | Navbar | Escape closes | Dropdown open | Press Escape | N/A | Dropdown closes | Medium |
| NAV-006 | Navbar | Sign Out | Authenticated | Click Sign Out | N/A | Returns to unauthenticated navbar | High |
| NAV-007 | Navbar | Stay on current page | On any page | Open/close dropdown | N/A | activePage unchanged | High |

---

## My Profile Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| PROF-001 | Profile | Open from dropdown | Authenticated | Avatar → My Profile | N/A | Profile modal opens | High |
| PROF-002 | Profile | Displays user data | Profile open | Review fields | N/A | Name, email, phone, preferences shown | High |
| PROF-003 | Profile | Edit enables fields | Profile open | Click Edit | N/A | Inputs become editable | High |
| PROF-004 | Profile | Update full name | Edit mode | Change name, Save | New name | Saved in local state | High |
| PROF-005 | Profile | Update nickname | Edit mode | Change nickname, Save | New nickname | Saved locally | Medium |
| PROF-006 | Profile | Update phone | Edit mode | Change phone, Save | Valid phone | Saved locally | High |
| PROF-007 | Profile | Update address | Edit mode | Change address, Save | New address | Saved locally | Medium |
| PROF-008 | Profile | Change avatar | Edit mode | Upload image | Image file | Avatar preview updates | Medium |
| PROF-009 | Profile | Save updates state | Edit mode | Save changes | Valid data | Green success message; navbar reflects | High |
| PROF-010 | Profile | Cancel reverts | Edit mode | Change fields, Cancel | N/A | Unsaved changes discarded | High |
| PROF-011 | Profile | Close stays on page | On Take Out (etc.) | Open profile, close | N/A | Same page still visible | High |
| PROF-012 | Profile | Required validation | Edit mode | Clear full name, Save | Empty name | Red error on full name | High |
| PROF-013 | Profile | Invalid email | Edit mode | Invalid email, Save | bad@ | Red email error | High |
| PROF-014 | Profile | Mobile responsive | Narrow viewport | Open profile | Mobile width | Layout stacks; usable | Medium |

---

## Social Login Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| SOC-001 | Social | Google only on login | Login form | Inspect social buttons | N/A | Only Google button; no Apple/Facebook | High |
| SOC-002 | Social | Google only on register | Create Account form | Inspect social buttons | N/A | Only Google button; no Apple/Facebook | High |
