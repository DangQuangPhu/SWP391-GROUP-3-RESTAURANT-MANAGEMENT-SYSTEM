import { PasswordInput, TextField, GoogleButton } from "./AuthFields";

function LoginForm({
  login,
  onLoginChange,
  onTouch,
  loginIdentifierError,
  loginPasswordError,
  onSubmit,
  onForgotPassword,
  onGoogleLogin,
  googleLoading,
  loginLoading,
}) {
  return (
    <form className="auth-form auth-form--login" onSubmit={onSubmit} noValidate>
      <header className="auth-form__header">
        <p className="auth-card__brand auth-slider__brand auth-form__brand">Phūrai</p>
        <h2 className="auth-card__title auth-form__title">Welcome Back</h2>
       
      </header>

      <TextField
        id="login-identifier"
        label="Email or Username"
        value={login.identifier}
        onChange={(e) => onLoginChange({ identifier: e.target.value })}
        onBlur={() => onTouch("loginIdentifier")}
        error={loginIdentifierError}
        autoComplete="username"
      />

      <PasswordInput
        id="login-password"
        label="Password"
        value={login.password}
        onChange={(e) => onLoginChange({ password: e.target.value })}
        onBlur={() => onTouch("loginPassword")}
        error={loginPasswordError}
        autoComplete="current-password"
      />

      <div className="auth-form__row">
        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={login.rememberMe}
            onChange={(e) => onLoginChange({ rememberMe: e.target.checked })}
          />
          <span>Remember me</span>
        </label>
        <button type="button" className="auth-form__link" onClick={onForgotPassword}>
          Forgot password?
        </button>
      </div>

      <button type="submit" className="auth-submit" disabled={loginLoading}>
        {loginLoading ? "SIGNING IN..." : "SIGN IN"}
      </button>

      <GoogleButton
        label={googleLoading ? "Connecting to Google..." : "Continue with Google"}
        onClick={onGoogleLogin}
        disabled={googleLoading}
      />
    </form>
  );
}

export default LoginForm;
