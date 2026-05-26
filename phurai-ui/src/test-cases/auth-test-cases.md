# Phūrai Authentication UI — Test Cases

**Scope:** Frontend-only demo validation for Login and Create Account forms (`AuthCard` / `AuthModal`).

**Demo credentials:**
| Field | Value |
|-------|-------|
| Email | demo@phurai.com |
| Phone | 0964813966 |
| Password | Phurai123! |
| Wrong password | Wrong123! |
| Invalid email | abc@ |
| Invalid phone | 12345 |
| Weak password | abc123 |
| Medium password | Phurai123 |
| Strong password | Phurai123! |

---

## Login Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| LOGIN-001 | Login | Empty email/phone | Auth modal open on Login tab | 1. Leave email/phone empty<br>2. Enter any password<br>3. Click SIGN IN | Email/phone: (empty)<br>Password: Phurai123! | Red error under email/phone: "Email or phone number is required." Field has red border. | High |
| LOGIN-002 | Login | Invalid email format | Auth modal open on Login tab | 1. Enter invalid email<br>2. Enter password<br>3. Click SIGN IN | Email: abc@<br>Password: Phurai123! | Red error under field: "Enter a valid email address." | High |
| LOGIN-003 | Login | Invalid phone format | Auth modal open on Login tab | 1. Enter invalid phone<br>2. Enter password<br>3. Click SIGN IN | Phone: 12345<br>Password: Phurai123! | Red error under field: "Enter a valid phone number." | High |
| LOGIN-004 | Login | Empty password | Auth modal open on Login tab | 1. Enter demo@phurai.com<br>2. Leave password empty<br>3. Click SIGN IN | Email: demo@phurai.com<br>Password: (empty) | Red error under password: "Password is required." | High |
| LOGIN-005 | Login | Password less than 8 characters | Auth modal open on Login tab | 1. Enter demo@phurai.com<br>2. Enter short password<br>3. Click SIGN IN | Email: demo@phurai.com<br>Password: abc1234 | Red error under password: "Password must be at least 8 characters." | High |
| LOGIN-006 | Login | Non-existing account | Auth modal open on Login tab | 1. Enter unknown email<br>2. Enter valid-length password<br>3. Click SIGN IN | Email: unknown@test.com<br>Password: Phurai123! | Light red alert: account does not exist. No success message. | High |
| LOGIN-007 | Login | Existing account, incorrect password | Auth modal open on Login tab | 1. Enter demo account<br>2. Enter wrong password<br>3. Click SIGN IN | Email: demo@phurai.com<br>Password: Wrong123! | Light red alert: incorrect password. | High |
| LOGIN-008 | Login | Valid email and valid password | Auth modal open on Login tab | 1. Enter demo email<br>2. Enter demo password<br>3. Click SIGN IN | Email: demo@phurai.com<br>Password: Phurai123! | Light green success alert: login successful. | High |
| LOGIN-009 | Login | Valid phone and valid password | Auth modal open on Login tab | 1. Enter demo phone<br>2. Enter demo password<br>3. Click SIGN IN | Phone: 0964813966<br>Password: Phurai123! | Light green success alert: login successful. | High |
| LOGIN-010 | Login | Toggle password visibility | Auth modal open on Login tab | 1. Enter password<br>2. Click eye icon<br>3. Click eye icon again | Password: Phurai123! | Password toggles between hidden and visible. | Medium |
| LOGIN-011 | Login | Remember me checkbox | Auth modal open on Login tab | 1. Click Remember me checkbox<br>2. Click again | N/A | Checkbox toggles checked/unchecked state. | Low |
| LOGIN-012 | Login | Forgot password link visible | Auth modal open on Login tab | 1. Observe form below password field | N/A | "Forgot password?" link is visible and styled. | Low |

---

## Create Account Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| REG-001 | Register | All fields empty | Auth modal open on Create Account tab | 1. Leave all fields empty<br>2. Click CREATE ACCOUNT | All fields empty | Multiple red field errors and terms error shown at once. | High |
| REG-002 | Register | Empty full name | Create Account tab | 1. Leave full name empty<br>2. Fill other valid fields<br>3. Submit | Full name: (empty) | Red error: full name is required. | High |
| REG-003 | Register | Full name shorter than 2 characters | Create Account tab | 1. Enter 1-character name<br>2. Submit | Full name: A | Red error: at least 2 characters. | High |
| REG-004 | Register | Full name contains numbers | Create Account tab | 1. Enter name with digits<br>2. Submit | Full name: John2 | Red error: must not contain numbers. | High |
| REG-005 | Register | Empty email/phone | Create Account tab | 1. Leave email/phone empty<br>2. Submit | Email/phone: (empty) | Red error: email/phone required. | High |
| REG-006 | Register | Invalid email format | Create Account tab | 1. Enter invalid email<br>2. Submit | Email: abc@ | Red error: valid email required. | High |
| REG-007 | Register | Invalid phone format | Create Account tab | 1. Enter invalid phone<br>2. Submit | Phone: 12345 | Red error: valid phone required. | High |
| REG-008 | Register | Empty password | Create Account tab | 1. Leave password empty<br>2. Submit | Password: (empty) | Red error: password required. | High |
| REG-009 | Register | Password shorter than 8 characters | Create Account tab | 1. Enter short password<br>2. Submit | Password: abc1234 | Red error: at least 8 characters. | High |
| REG-010 | Register | Password contains spaces | Create Account tab | 1. Enter password with space<br>2. Submit | Password: Phurai 123 | Red error: must not contain spaces. | High |
| REG-011 | Register | Low password strength | Create Account tab | 1. Enter weak password<br>2. Observe strength meter<br>3. Submit | Password: abc123 | 1 red bar active. Submit blocked with weak password message. | High |
| REG-012 | Register | Medium password strength | Create Account tab | 1. Enter medium password<br>2. Observe strength meter | Password: Phurai123 | 2 amber/gold bars active. Label shows acceptable strength. | Medium |
| REG-013 | Register | Strong password strength | Create Account tab | 1. Enter strong password<br>2. Observe strength meter | Password: Phurai123! | 3 green bars active. Label shows strong password. | Medium |
| REG-014 | Register | Empty confirm password | Create Account tab | 1. Fill password<br>2. Leave confirm empty<br>3. Submit | Confirm: (empty) | Red error: confirm password required. | High |
| REG-015 | Register | Mismatched confirm password | Create Account tab | 1. Enter different confirm value<br>2. Submit | Password: Phurai123!<br>Confirm: Phurai123 | Red error: passwords do not match. | High |
| REG-016 | Register | Terms not accepted | Create Account tab | 1. Fill all valid fields<br>2. Leave terms unchecked<br>3. Submit | Valid data, terms unchecked | Red terms error. No success alert. | High |
| REG-017 | Register | Successful registration | Create Account tab | 1. Fill all valid fields<br>2. Check terms<br>3. Submit | Full name: Phu Rai<br>Email: guest@phurai.com<br>Password: Phurai123!<br>Confirm: Phurai123! | Light green success alert shown. | High |
| REG-018 | Register | Toggle password visibility | Create Account tab | 1. Enter password<br>2. Toggle eye icon | Password: Phurai123! | Password visibility toggles. | Medium |
| REG-019 | Register | Toggle confirm password visibility | Create Account tab | 1. Enter confirm password<br>2. Toggle eye icon | Confirm: Phurai123! | Confirm password visibility toggles. | Medium |
| REG-020 | Register | Switch from Register to Login | Create Account tab | 1. Click "Login" link at bottom | N/A | Form switches to Login tab without page navigation. | Medium |

---

## Password Strength Test Cases

| Test Case ID | Feature | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Priority |
|--------------|---------|----------|---------------|------------|-----------|-----------------|----------|
| PWD-001 | Password strength | Empty password neutral state | Create Account tab | 1. Focus password field<br>2. Leave empty | Password: (empty) | Three neutral/empty bars. Helper text prompts to enter password. | Medium |
| PWD-002 | Password strength | Weak password — 1 red bar | Create Account tab | 1. Type weak password | Password: abc123 | Only 1 red bar active. Label indicates weak password. | High |
| PWD-003 | Password strength | Medium password — 2 amber bars | Create Account tab | 1. Type medium password | Password: Phurai123 | 2 amber/gold bars active. | High |
| PWD-004 | Password strength | Strong password — 3 green bars | Create Account tab | 1. Type strong password | Password: Phurai123! | 3 green bars active. | High |
| PWD-005 | Password strength | Low password blocks submission | Create Account tab | 1. Fill form with weak password<br>2. Accept terms<br>3. Submit | Password: abc123 | Form does not show success. Weak password validation message shown. | High |

---

## Notes for QA

- Open the UI via **SIGN IN** in the navbar on any page.
- No backend calls are made; all validation is local/demo only.
- Field errors appear on blur or after submit.
- Global alerts appear at the top of the auth card (red = error, green = success).
