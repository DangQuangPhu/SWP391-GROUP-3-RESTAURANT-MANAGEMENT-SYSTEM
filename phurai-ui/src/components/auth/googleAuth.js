const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
import { API_BASE_URL } from "./api";

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

async function exchangeAccessToken(accessToken) {
  const response = await fetch(`${API_BASE_URL}/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || "Google Sign-In failed while contacting the backend."
    );
  }

  if (!data.user) {
    throw new Error("Backend did not return a Google user profile.");
  }

  return data.user;
}

export async function signInWithGoogle() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "Google Sign-In is not configured. Add VITE_GOOGLE_CLIENT_ID to your frontend env."
    );
  }

  await loadGoogleIdentityScript();
  const accessToken = await requestGoogleAccessToken(clientId);
  return exchangeAccessToken(accessToken);
}
