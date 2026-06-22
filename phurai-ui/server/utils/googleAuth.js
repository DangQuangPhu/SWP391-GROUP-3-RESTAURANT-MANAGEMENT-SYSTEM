export async function verifyGoogleAccessToken(accessToken) {
  let response;
  try {
    response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (networkErr) {
    throw new Error("Could not reach Google servers. Check your internet connection.");
  }

  if (!response.ok) {
    throw new Error("Invalid or expired Google access token.");
  }

  const data = await response.json();
  return normalizeGoogleProfile(data);
}

export async function verifyGoogleIdToken(credential) {
  let response;
  try {
    response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
  } catch (networkErr) {
    throw new Error("Could not reach Google servers. Check your internet connection.");
  }

  if (!response.ok) {
    throw new Error("Invalid or expired Google credential.");
  }

  const data = await response.json();

  // Security: validate token audience matches our app's client ID
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (expectedAud && data.aud !== expectedAud) {
    throw new Error("Google token audience mismatch. Token was not issued for this application.");
  }

  return normalizeGoogleProfile({
    sub: data.sub,
    email: data.email,
    email_verified: data.email_verified,
    name: data.name,
    picture: data.picture,
    given_name: data.given_name,
    family_name: data.family_name,
  });
}

function normalizeGoogleProfile(data) {
  return {
    sub: data.sub,
    email: String(data.email || "").trim().toLowerCase(),
    emailVerified: data.email_verified === true || data.email_verified === "true",
    fullName: data.name || [data.given_name, data.family_name].filter(Boolean).join(" ").trim(),
    picture: data.picture || null,
  };
}
