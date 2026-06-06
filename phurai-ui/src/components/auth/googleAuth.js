const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
import { googleRegister, googleRegisterWithAccessToken, googleLogin } from "./api";

let googleScriptPromise;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load Google Sign-In script.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load Google Sign-In script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

function getClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Google Sign-In is not configured. Add VITE_GOOGLE_CLIENT_ID to your frontend env."
    );
  }
  return clientId;
}

function requestGoogleAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => {
        reject(new Error("Google Sign-In was cancelled or failed."));
      },
    });

    tokenClient.requestAccessToken({ prompt: "select_account" });
  });
}

function requestGoogleIdCredential(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.id) {
      reject(new Error("Google Identity Services failed to load."));
      return;
    }

    let settled = false;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (settled) return;
        settled = true;
        if (response.credential) resolve(response.credential);
        else reject(new Error("No Google credential received."));
      },
      auto_select: false,
    });

    window.google.accounts.id.prompt((notification) => {
      if (settled) return;
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        requestGoogleAccessToken(clientId)
          .then((token) => {
            if (settled) return;
            settled = true;
            resolve({ accessToken: token });
          })
          .catch(reject);
      }
    });
  });
}

/** Google Sign-In for verified accounts (Login tab). */
export async function signInWithGoogle() {
  const clientId = getClientId();
  await loadGoogleIdentityScript();
  const accessToken = await requestGoogleAccessToken(clientId);
  try {
    const data = await googleLogin({ accessToken });
    return { type: "login", user: data.user };
  } catch (error) {
    if (error.code === "ACCOUNT_NOT_FOUND") {
      const regData = await googleRegisterWithAccessToken(accessToken);
      return { type: "register", ...regData };
    }
    if (error.code === "EMAIL_NOT_VERIFIED") {
      return {
        type: "otp",
        requiresOtp: true,
        userId: error.data?.userId,
        email: error.data?.email,
      };
    }
    throw error;
  }
}

/** Google Create Account — always requires OTP before login. */
export async function registerWithGoogle() {
  const clientId = getClientId();
  await loadGoogleIdentityScript();

  const result = await requestGoogleIdCredential(clientId);

  if (typeof result === "string") {
    return googleRegister(result);
  }

  if (result?.accessToken) {
    return googleRegisterWithAccessToken(result.accessToken);
  }

  throw new Error("Google registration failed.");
}
