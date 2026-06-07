import pool from "../db.js";
import { generateOtpCode } from "./password.js";
import { RESEND_COOLDOWN_SECONDS, sendVerificationEmail } from "../email.js";

export function pickColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

export async function loadTableRegistry() {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
  );
  return new Map(rows.map((row) => [row.TABLE_NAME.toLowerCase(), row.TABLE_NAME]));
}

export async function resolveTableNames() {
  const registry = await loadTableRegistry();
  const pick = (candidates) =>
    candidates.map((n) => registry.get(n.toLowerCase())).find(Boolean) || null;

  return {
    users: pick(["Users", "users"]),
    userProfiles: pick(["UserProfiles", "user_profiles"]),
    roles: pick(["Roles", "roles"]),
    userRoles: pick(["UserRoles", "user_roles"]),
    customers: pick(["Customers", "customers"]),
    otpTokens: pick(["OtpTokens", "otp_tokens"]),
  };
}

export async function loadTableColumns(tableName) {
  if (!tableName) return [];
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [tableName]
  );
  return rows.map((row) => row.COLUMN_NAME);
}

export async function findRowByColumn(tableName, column, value, db = pool) {
  if (!tableName || !column || value === undefined || value === null || value === "") {
    return null;
  }
  const [rows] = await db.query(
    `SELECT * FROM \`${tableName}\` WHERE \`${column}\` = ? LIMIT 1`,
    [value]
  );
  return rows[0] || null;
}

export async function buildUniqueUsername(tableName, columns, preferred, db = pool) {
  const col = pickColumn(columns, ["username", "user_name"]);
  if (!col) return preferred;
  let username = preferred;
  let suffix = 1;
  while (await findRowByColumn(tableName, col, username, db)) {
    username = `${preferred}${suffix}`;
    suffix += 1;
  }
  return username;
}

export function mapUserToFrontend(userRow, userCols, profileRow, profileCols) {
  const userIdCol = pickColumn(userCols, ["user_id", "id"]);
  const usernameCol = pickColumn(userCols, ["username", "user_name"]);
  const emailCol = pickColumn(userCols, ["email"]);
  const phoneCol = pickColumn(userCols, ["phone_number", "phone"]);
  const avatarCol = pickColumn(userCols, ["avatar_url"]);
  const authProviderCol = pickColumn(userCols, ["auth_provider"]);
  const firstNameUserCol = pickColumn(userCols, ["first_name"]);
  const lastNameUserCol = pickColumn(userCols, ["last_name"]);
  const dobUserCol = pickColumn(userCols, ["date_of_birth"]);
  const firstNameProfileCol = pickColumn(profileCols, ["first_name", "firstname"]);
  const lastNameProfileCol = pickColumn(profileCols, ["last_name", "lastname"]);
  const dobProfileCol = pickColumn(profileCols, ["date_of_birth"]);

  const firstName =
    (firstNameUserCol && userRow[firstNameUserCol]) ||
    (firstNameProfileCol && profileRow?.[firstNameProfileCol]) ||
    "";
  const lastName =
    (lastNameUserCol && userRow[lastNameUserCol]) ||
    (lastNameProfileCol && profileRow?.[lastNameProfileCol]) ||
    "";
  const dateOfBirth =
    (dobUserCol && userRow[dobUserCol]) ||
    (dobProfileCol && profileRow?.[dobProfileCol]) ||
    null;

  const username = usernameCol ? userRow[usernameCol] : "";
  const fullName = `${firstName} ${lastName}`.trim() || username;

  return {
    id: userIdCol ? userRow[userIdCol] : null,
    userId: userIdCol ? userRow[userIdCol] : null,
    firstName: String(firstName || "").trim(),
    lastName: String(lastName || "").trim(),
    fullName,
    username: String(username || "").trim(),
    nickname: String(firstName || username || "").trim(),
    email: emailCol ? userRow[emailCol] : "",
    phone: phoneCol ? userRow[phoneCol] || "" : "",
    dateOfBirth: dateOfBirth
      ? new Date(dateOfBirth).toISOString().slice(0, 10)
      : "",
    avatarUrl: avatarCol ? userRow[avatarCol] || "" : "",
    authProvider: authProviderCol ? userRow[authProviderCol] || "LOCAL" : "LOCAL",
  };
}

export async function loadUserBundle(userId, tableNames) {
  const userCols = await loadTableColumns(tableNames.users);
  const profileCols = tableNames.userProfiles
    ? await loadTableColumns(tableNames.userProfiles)
    : [];
  const userIdCol = pickColumn(userCols, ["user_id", "id"]);
  const user = await findRowByColumn(tableNames.users, userIdCol, userId);
  if (!user) return null;

  const profileUserIdCol = pickColumn(profileCols, ["user_id"]);
  const profile =
    tableNames.userProfiles && profileUserIdCol
      ? await findRowByColumn(tableNames.userProfiles, profileUserIdCol, userId)
      : null;

  return {
    user,
    profile,
    userCols,
    profileCols,
    frontend: mapUserToFrontend(user, userCols, profile, profileCols),
  };
}

export function getResendRemainingSeconds(sentAt) {
  if (!sentAt) return 0;
  const elapsed = (Date.now() - new Date(sentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

export async function setVerificationOtp(tableNames, userId, otp, db = pool) {
  const userCols = await loadTableColumns(tableNames.users);
  const userIdCol = pickColumn(userCols, ["user_id", "id"]);
  const tokenCol = pickColumn(userCols, ["verification_token"]);
  const sentAtCol = pickColumn(userCols, ["verification_sent_at"]);
  const statusCol = pickColumn(userCols, ["status"]);
  const emailVerifiedCol = pickColumn(userCols, ["is_email_verified", "email_verified"]);

  const now = new Date();

  if (tokenCol && sentAtCol) {
    const updates = [`\`${tokenCol}\` = ?`, `\`${sentAtCol}\` = ?`];
    const params = [otp, now];
    if (statusCol) {
      updates.push(`\`${statusCol}\` = ?`);
      params.push("pending");
    }
    if (emailVerifiedCol) {
      updates.push(`\`${emailVerifiedCol}\` = 0`);
    }
    params.push(userId);
    await db.query(
      `UPDATE \`${tableNames.users}\` SET ${updates.join(", ")} WHERE \`${userIdCol}\` = ?`,
      params
    );
    return;
  }

  // Fallback: OtpTokens table
  if (!tableNames.otpTokens) return;
  const otpCols = await loadTableColumns(tableNames.otpTokens);
  const otpUserIdCol = pickColumn(otpCols, ["user_id"]);
  const codeCol = pickColumn(otpCols, ["otp_code", "token"]);
  const purposeCol = pickColumn(otpCols, ["purpose"]);
  const expiresCol = pickColumn(otpCols, ["expires_at"]);
  const usedCol = pickColumn(otpCols, ["used_at"]);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [existing] = await db.query(
    `SELECT * FROM \`${tableNames.otpTokens}\` WHERE \`${otpUserIdCol}\` = ? AND \`${purposeCol}\` = ? ORDER BY \`${expiresCol}\` DESC LIMIT 1`,
    [userId, "EMAIL_VERIFICATION"]
  );

  if (existing[0]) {
    const idCol = pickColumn(otpCols, ["otp_id", "id"]);
    await db.query(
      `UPDATE \`${tableNames.otpTokens}\` SET \`${codeCol}\` = ?, \`${expiresCol}\` = ?${
        usedCol ? `, \`${usedCol}\` = NULL` : ""
      } WHERE \`${idCol}\` = ?`,
      [otp, expiresAt, existing[0][idCol]]
    );
  } else {
    const values = {
      [otpUserIdCol]: userId,
      [codeCol]: otp,
      [purposeCol]: "EMAIL_VERIFICATION",
      [expiresCol]: expiresAt,
    };
    if (usedCol) values[usedCol] = null;
    const cols = Object.keys(values);
    await db.query(
      `INSERT INTO \`${tableNames.otpTokens}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      cols.map((c) => values[c])
    );
  }
}

export async function verifyUserOtp(tableNames, userId, otp) {
  const userCols = await loadTableColumns(tableNames.users);
  const userIdCol = pickColumn(userCols, ["user_id", "id"]);
  const tokenCol = pickColumn(userCols, ["verification_token"]);
  const sentAtCol = pickColumn(userCols, ["verification_sent_at"]);
  const statusCol = pickColumn(userCols, ["status"]);
  const emailVerifiedCol = pickColumn(userCols, ["is_email_verified", "email_verified"]);

  const user = await findRowByColumn(tableNames.users, userIdCol, userId);
  if (!user) throw new Error("Account not found.");

  let valid = false;

  if (tokenCol && user[tokenCol]) {
    valid = String(user[tokenCol]).trim() === String(otp).trim();
  }

  if (!valid && tableNames.otpTokens) {
    const otpCols = await loadTableColumns(tableNames.otpTokens);
    const otpUserIdCol = pickColumn(otpCols, ["user_id"]);
    const codeCol = pickColumn(otpCols, ["otp_code", "token"]);
    const purposeCol = pickColumn(otpCols, ["purpose"]);
    const usedCol = pickColumn(otpCols, ["used_at"]);
    const expiresCol = pickColumn(otpCols, ["expires_at"]);
    const idCol = pickColumn(otpCols, ["otp_id", "id"]);

    const [rows] = await pool.query(
      `SELECT * FROM \`${tableNames.otpTokens}\` WHERE \`${otpUserIdCol}\` = ? AND \`${codeCol}\` = ? AND \`${purposeCol}\` = ? LIMIT 1`,
      [userId, otp, "EMAIL_VERIFICATION"]
    );
    const record = rows[0];
    if (record) {
      if (usedCol && record[usedCol]) throw new Error("Verification code already used.");
      if (expiresCol && new Date(record[expiresCol]).getTime() < Date.now()) {
        throw new Error("Verification code has expired.");
      }
      valid = true;
      if (usedCol && idCol) {
        await pool.query(
          `UPDATE \`${tableNames.otpTokens}\` SET \`${usedCol}\` = ? WHERE \`${idCol}\` = ?`,
          [new Date(), record[idCol]]
        );
      }
    }
  }

  if (!valid) throw new Error("Incorrect verification code.");

  const updates = [];
  const params = [];
  if (emailVerifiedCol) {
    updates.push(`\`${emailVerifiedCol}\` = 1`);
  }
  if (statusCol) {
    updates.push(`\`${statusCol}\` = ?`);
    params.push("ACTIVE");
  }
  if (tokenCol) {
    updates.push(`\`${tokenCol}\` = NULL`);
  }
  if (sentAtCol) {
    updates.push(`\`${sentAtCol}\` = NULL`);
  }
  params.push(userId);

  if (updates.length) {
    await pool.query(
      `UPDATE \`${tableNames.users}\` SET ${updates.join(", ")} WHERE \`${userIdCol}\` = ?`,
      params
    );
  }

  return loadUserBundle(userId, tableNames);
}

export async function sendUserVerificationOtp(tableNames, userId, context = "account") {
  const bundle = await loadUserBundle(userId, tableNames);
  if (!bundle) throw new Error("User not found.");

  const userCols = bundle.userCols;
  const emailVerifiedCol = pickColumn(userCols, ["is_email_verified", "email_verified"]);
  if (emailVerifiedCol && bundle.user[emailVerifiedCol]) {
    throw new Error("Account is already verified.");
  }

  const sentAtCol = pickColumn(userCols, ["verification_sent_at"]);
  if (sentAtCol && bundle.user[sentAtCol]) {
    const remaining = getResendRemainingSeconds(bundle.user[sentAtCol]);
    if (remaining > 0) {
      const err = new Error("Please wait before requesting another code.");
      err.status = 429;
      err.retryAfterSeconds = remaining;
      throw err;
    }
  }

  const otp = generateOtpCode();
  await setVerificationOtp(tableNames, userId, otp);
  const emailCol = pickColumn(userCols, ["email"]);
  const email = bundle.user[emailCol];
  await sendVerificationEmail(email, otp, { context });
  return { email, otp };
}

export async function runMigrationsOnStartup() {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const migrationsDir = path.join(__dirname, "../migrations");
    if (!fs.existsSync(migrationsDir)) return;

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const fileName of migrationFiles) {
      const raw = fs.readFileSync(path.join(migrationsDir, fileName), "utf8");
      const batches = raw
        .split(/^\s*GO\s*$/gim)
        .map((b) => b.trim())
        .filter((b) => b && !b.startsWith("--") && !b.match(/^USE\s/i) && !b.match(/^PRINT\s/i));

      for (const batch of batches) {
        if (batch.includes("OBJECT_ID") && batch.includes("no-op")) continue;
        try {
          await pool.query(batch);
        } catch (e) {
          if (!String(e.message).includes("already an object")) {
            console.warn(`Migration ${fileName} warning:`, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Auth migrations skipped:", err.message);
  }
}
