export async function verifyGoogleAccessToken(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Invalid Google access token.");
  }

  const data = await response.json();
  return normalizeGoogleProfile(data);
}

export async function verifyGoogleIdToken(credential) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  if (!response.ok) {
    throw new Error("Invalid Google credential.");
  }

  const data = await response.json();
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
