import { PasswordInput, TextField, StrengthMeter, GoogleButton } from "./AuthFields";

function RegisterForm({
  signup,
  onSignupChange,
  onTouch,
  signupErrors,
  onSubmit,
  onGoogleRegister,
  googleLoading,
  signupLoading,
}) {
  const updateSignup = (field) => (event) => {
    const { value, type, checked } = event.target;
    onSignupChange(field, type === "checkbox" ? checked : value);
  };

  return (
    <form className="auth-form auth-form--register auth-form--signup" onSubmit={onSubmit} noValidate>
      <header className="auth-form__header">
        <p className="auth-card__brand auth-slider__brand auth-form__brand">Phūrai</p>
        <h2 className="auth-card__title auth-form__title">Sign Up</h2>
      </header>

      <TextField
        id="signup-fullname"
        label="Full Name"
        value={signup.fullName}
        onChange={updateSignup("fullName")}
        onBlur={() => onTouch("fullName")}
        error={signupErrors.fullName}
        autoComplete="name"
        className="auth-form__full"
      />
      <TextField
        id="signup-username"
        label="Username"
        value={signup.username}
        onChange={updateSignup("username")}
        onBlur={() => onTouch("username")}
        error={signupErrors.username}
        autoComplete="username"
        className="auth-form__full"
      />

      <div className="auth-form__grid auth-form__grid--2">
        <TextField
          id="signup-email"
          label="Email"
          type="email"
          value={signup.email}
          onChange={updateSignup("email")}
          onBlur={() => onTouch("email")}
          error={signupErrors.email}
          autoComplete="email"
        />
        <TextField
          id="signup-phone"
          label="Phone Number"
          type="tel"
          value={signup.phone}
          onChange={updateSignup("phone")}
          onBlur={() => onTouch("phone")}
          error={signupErrors.phone}
          autoComplete="tel"
        />
      </div>

      <TextField
        id="signup-dob"
        label="Date of Birth"
        type="date"
        value={signup.dateOfBirth}
        onChange={updateSignup("dateOfBirth")}
        onBlur={() => onTouch("dateOfBirth")}
        error={signupErrors.dateOfBirth}
        className="auth-form__full"
      />

      <div className="auth-form__grid auth-form__grid--2">
        <div className="auth-form__password-col">
          <PasswordInput
            id="signup-password"
            label="Password"
            value={signup.password}
            onChange={updateSignup("password")}
            onBlur={() => onTouch("password")}
            error={signupErrors.password}
            autoComplete="new-password"
          />
          <StrengthMeter password={signup.password} />
        </div>
        <PasswordInput
          id="signup-confirm"
          label="Confirm Password"
          value={signup.confirmPassword}
          onChange={updateSignup("confirmPassword")}
          onBlur={() => onTouch("confirmPassword")}
          error={signupErrors.confirmPassword}
          autoComplete="new-password"
        />
      </div>

      <label className="auth-checkbox auth-checkbox--terms auth-form__full">
        <input
          type="checkbox"
          checked={signup.agreeTerms}
          onChange={updateSignup("agreeTerms")}
          onBlur={() => onTouch("terms")}
        />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      {signupErrors.terms ? (
        <p className="auth-field__error auth-field__error--terms auth-form__full">
          {signupErrors.terms}
        </p>
      ) : null}

      <button type="submit" className="auth-submit auth-form__full" disabled={signupLoading}>
        {signupLoading ? "SIGNING UP..." : "SIGN UP"}
      </button>

      <GoogleButton
        label={googleLoading ? "Connecting to Google..." : "Continue with Google"}
        onClick={onGoogleRegister}
        disabled={googleLoading}
      />
    </form>
  );
}

export default RegisterForm;
