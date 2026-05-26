import crypto from "node:crypto";
import express from "express";
import pool from "../db.js";
import { sendVerificationEmail } from "../email.js";

const router = express.Router();

const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v1/tokeninfo";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function normalizeGoogleProfile(profile) {
  const email = profile.email?.trim().toLowerCase() || "";
  const firstName = profile.given_name?.trim() || "";
  const lastName = profile.family_name?.trim() || "";
  const fullName = profile.name?.trim() || `${firstName} ${lastName}`.trim();
  const usernameBase = (email.split("@")[0] || "google-user")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();

  return {
    googleId: profile.sub || profile.id || "",
    email,
    firstName,
    lastName,
    fullName,
    username: usernameBase || "google-user",
    avatarUrl: profile.picture || "",
    emailVerified:
      profile.email_verified === true || profile.verified_email === true,
    authProvider: "google",
  };
}

function splitFullName(fullName) {
  const normalized = (fullName || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ");
  const firstName = parts.shift() || "";
  return {
    firstName,
    lastName: parts.join(" "),
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  const [method, salt, storedKey] = String(passwordHash || "").split("$");

  if (method !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedKey, "hex");

  return (
    storedBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(storedBuffer, derivedKey)
  );
}

function generateVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

async function fetchGoogleTokenInfo(accessToken) {
  const response = await fetch(
    `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
  );

  if (!response.ok) {
    throw new Error("Google access token is invalid or expired.");
  }

  return response.json();
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch Google account information.");
  }

  return response.json();
}

function isDbConfigured() {
  return Boolean(
    process.env.DB_SERVER &&
      process.env.DB_USER &&
      process.env.DB_DATABASE &&
      process.env.DB_PASSWORD &&
      process.env.DB_PASSWORD !== "your_sql_server_password"
  );
}

async function loadTableRegistry() {
  const [rows] = await pool.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
    `
  );

  return new Map(rows.map((row) => [row.TABLE_NAME.toLowerCase(), row.TABLE_NAME]));
}

async function resolveTableNames() {
  const registry = await loadTableRegistry();

  const pickTable = (candidates) =>
    candidates.map((name) => registry.get(name.toLowerCase())).find(Boolean) || null;

  return {
    users: pickTable(["Users", "users"]),
    userProfiles: pickTable(["UserProfiles", "user_profiles"]),
    roles: pickTable(["Roles", "roles"]),
    userRoles: pickTable(["UserRoles", "user_roles"]),
    customers: pickTable(["Customers", "customers"]),
    otpTokens: pickTable(["OtpTokens", "otp_tokens"]),
  };
}

async function loadTableColumns(tableName) {
  if (!tableName) {
    return [];
  }

  const [rows] = await pool.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `,
    [tableName]
  );

  return rows.map((row) => row.COLUMN_NAME);
}

function pickColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

async function findRowByColumn(tableName, column, value, db = pool) {
  if (!tableName || !column || value === undefined || value === null || value === "") {
    return null;
  }

  const [rows] = await db.query(
    `SELECT * FROM \`${tableName}\` WHERE \`${column}\` = ? LIMIT 1`,
    [value]
  );

  return rows[0] || null;
}

async function buildUniqueUsername(tableName, columns, preferredUsername, db = pool) {
  const usernameColumn = pickColumn(columns, ["username", "user_name"]);

  if (!usernameColumn) {
    return preferredUsername;
  }

  let username = preferredUsername;
  let suffix = 1;

  while (true) {
    const existing = await findRowByColumn(tableName, usernameColumn, username, db);
    if (!existing) {
      return username;
    }

    username = `${preferredUsername}${suffix}`;
    suffix += 1;
  }
}

function mapUserToFrontend(userRow, userColumns, profileRow, profileColumns, fallbackProfile) {
  const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
  const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
  const emailColumn = pickColumn(userColumns, ["email"]);
  const phoneColumn = pickColumn(userColumns, ["phone_number", "phone"]);
  const avatarColumn = pickColumn(userColumns, ["avatar_url"]);
  const fullNameColumn = pickColumn(userColumns, ["full_name", "name"]);
  const firstNameColumn = pickColumn(profileColumns, ["first_name", "firstname"]);
  const lastNameColumn = pickColumn(profileColumns, ["last_name", "lastname"]);

  const firstName =
    (firstNameColumn && profileRow ? profileRow[firstNameColumn] : "") ||
    fallbackProfile.firstName;
  const lastName =
    (lastNameColumn && profileRow ? profileRow[lastNameColumn] : "") ||
    fallbackProfile.lastName;
  const fullName =
    (fullNameColumn ? userRow[fullNameColumn] : "") ||
    `${firstName} ${lastName}`.trim() ||
    fallbackProfile.fullName;

  return {
    id: userIdColumn ? userRow[userIdColumn] : fallbackProfile.googleId,
    firstName,
    lastName,
    fullName,
    username: (usernameColumn ? userRow[usernameColumn] : "") || fallbackProfile.username,
    nickname: firstName || fallbackProfile.firstName,
    email: (emailColumn ? userRow[emailColumn] : "") || fallbackProfile.email,
    phone: (phoneColumn ? userRow[phoneColumn] : "") || "",
    avatarUrl: (avatarColumn ? userRow[avatarColumn] : "") || fallbackProfile.avatarUrl,
    authProvider: "google",
  };
}

async function insertRow(tableName, values, db = pool) {
  const columns = Object.keys(values);

  if (!tableName || !columns.length) {
    throw new Error(`Cannot insert into ${tableName || "unknown table"}.`);
  }

  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO \`${tableName}\` (${columns
    .map((column) => `\`${column}\``)
    .join(", ")}) VALUES (${placeholders})`;

  const [result] = await db.query(sql, columns.map((column) => values[column]));
  return result;
}

async function ensureGoogleUserProfile(
  tableNames,
  userId,
  profile,
  userColumns,
  profileColumns,
  db = pool
) {
  const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
  const avatarColumn = pickColumn(userColumns, ["avatar_url"]);

  if (avatarColumn) {
    await db.query(
      `UPDATE \`${tableNames.users}\` SET \`${avatarColumn}\` = COALESCE(NULLIF(?, ''), \`${avatarColumn}\`) WHERE \`${userIdColumn}\` = ?`,
      [profile.avatarUrl, userId]
    );
  }

  if (!tableNames.userProfiles || !profileColumns.length) {
    return null;
  }

  const profileUserIdColumn = pickColumn(profileColumns, ["user_id"]);
  const existingProfile = await findRowByColumn(
    tableNames.userProfiles,
    profileUserIdColumn,
    userId,
    db
  );

  if (existingProfile) {
    return existingProfile;
  }

  const values = {};
  const firstNameColumn = pickColumn(profileColumns, ["first_name", "firstname"]);
  const lastNameColumn = pickColumn(profileColumns, ["last_name", "lastname"]);
  const genderColumn = pickColumn(profileColumns, ["gender"]);
  const addressColumn = pickColumn(profileColumns, ["address"]);
  const bioColumn = pickColumn(profileColumns, ["bio"]);

  if (profileUserIdColumn) values[profileUserIdColumn] = userId;
  if (firstNameColumn) values[firstNameColumn] = profile.firstName;
  if (lastNameColumn) values[lastNameColumn] = profile.lastName;
  if (genderColumn) values[genderColumn] = null;
  if (addressColumn) values[addressColumn] = null;
  if (bioColumn) values[bioColumn] = null;

  if (!Object.keys(values).length) {
    return null;
  }

  await insertRow(tableNames.userProfiles, values, db);
  return findRowByColumn(tableNames.userProfiles, profileUserIdColumn, userId, db);
}

async function ensureCustomerRole(tableNames, userId, db = pool) {
  if (!tableNames.roles || !tableNames.userRoles) {
    return;
  }

  const roleColumns = await loadTableColumns(tableNames.roles);
  const userRoleColumns = await loadTableColumns(tableNames.userRoles);
  const roleNameColumn = pickColumn(roleColumns, ["role_name", "name"]);
  const roleIdColumn = pickColumn(roleColumns, ["role_id", "id"]);
  const userIdColumn = pickColumn(userRoleColumns, ["user_id"]);
  const roleIdFkColumn = pickColumn(userRoleColumns, ["role_id"]);

  if (!roleNameColumn || !roleIdColumn || !userIdColumn || !roleIdFkColumn) {
    return;
  }

  const customerRole =
    (await findRowByColumn(tableNames.roles, roleNameColumn, "CUSTOMER", db)) ||
    (await findRowByColumn(tableNames.roles, roleNameColumn, "Customer", db));

  if (!customerRole) {
    return;
  }

  const [existingRows] = await db.query(
    `SELECT * FROM \`${tableNames.userRoles}\` WHERE \`${userIdColumn}\` = ? AND \`${roleIdFkColumn}\` = ? LIMIT 1`,
    [userId, customerRole[roleIdColumn]]
  );

  if (existingRows[0]) {
    return;
  }

  const values = {
    [userIdColumn]: userId,
    [roleIdFkColumn]: customerRole[roleIdColumn],
  };

  await insertRow(tableNames.userRoles, values, db);
}

function buildCustomerCode(profile) {
  const seed = (profile.username || "customer").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = Date.now().toString().slice(-6);
  return `CUS-${seed.slice(0, 6) || "USER"}-${suffix}`;
}

async function ensureCustomerRecord(tableNames, userId, profile, db = pool) {
  if (!tableNames.customers) {
    return;
  }

  const columns = await loadTableColumns(tableNames.customers);
  const userIdColumn = pickColumn(columns, ["user_id"]);

  if (!userIdColumn) {
    return;
  }

  const existingCustomer = await findRowByColumn(
    tableNames.customers,
    userIdColumn,
    userId,
    db
  );
  if (existingCustomer) {
    return;
  }

  const values = {
    [userIdColumn]: userId,
  };
  const customerCodeColumn = pickColumn(columns, ["customer_code"]);
  const membershipLevelColumn = pickColumn(columns, ["membership_level"]);
  const totalSpentColumn = pickColumn(columns, ["total_spent"]);

  if (customerCodeColumn) values[customerCodeColumn] = buildCustomerCode(profile);
  if (membershipLevelColumn) values[membershipLevelColumn] = "BRONZE";
  if (totalSpentColumn) values[totalSpentColumn] = 0;

  await insertRow(tableNames.customers, values, db);
}

async function createOrRefreshVerificationToken(
  tableNames,
  userId,
  purpose,
  otpCode,
  db = pool
) {
  if (!tableNames.otpTokens) {
    return;
  }

  const columns = await loadTableColumns(tableNames.otpTokens);
  const userIdColumn = pickColumn(columns, ["user_id"]);
  const codeColumn = pickColumn(columns, ["otp_code", "token"]);
  const purposeColumn = pickColumn(columns, ["purpose"]);
  const expiresAtColumn = pickColumn(columns, ["expires_at"]);
  const usedAtColumn = pickColumn(columns, ["used_at"]);
  const attemptCountColumn = pickColumn(columns, ["attempt_count"]);
  const maxAttemptsColumn = pickColumn(columns, ["max_attempts"]);

  if (!userIdColumn || !codeColumn || !purposeColumn || !expiresAtColumn) {
    return;
  }

  const activeTokenFilter = usedAtColumn ? ` AND \`${usedAtColumn}\` IS NULL` : "";
  const [existingRows] = await db.query(
    `SELECT * FROM \`${tableNames.otpTokens}\` WHERE \`${userIdColumn}\` = ? AND \`${purposeColumn}\` = ?${activeTokenFilter} ORDER BY \`${expiresAtColumn}\` DESC LIMIT 1`,
    [userId, purpose]
  );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (existingRows[0]) {
    const tokenIdColumn = pickColumn(columns, ["otp_id", "id"]);
    const updates = [`\`${codeColumn}\` = ?`, `\`${expiresAtColumn}\` = ?`];
    const params = [otpCode, expiresAt];

    if (usedAtColumn) {
      updates.push(`\`${usedAtColumn}\` = NULL`);
    }
    if (attemptCountColumn) {
      updates.push(`\`${attemptCountColumn}\` = 0`);
    }
    if (maxAttemptsColumn) {
      updates.push(`\`${maxAttemptsColumn}\` = 5`);
    }

    params.push(existingRows[0][tokenIdColumn]);

    await db.query(
      `UPDATE \`${tableNames.otpTokens}\` SET ${updates.join(", ")} WHERE \`${tokenIdColumn}\` = ?`,
      params
    );
    return;
  }

  const values = {
    [userIdColumn]: userId,
    [codeColumn]: otpCode,
    [purposeColumn]: purpose,
    [expiresAtColumn]: expiresAt,
  };

  if (usedAtColumn) {
    values[usedAtColumn] = null;
  }
  if (attemptCountColumn) {
    values[attemptCountColumn] = 0;
  }
  if (maxAttemptsColumn) {
    values[maxAttemptsColumn] = 5;
  }

  await insertRow(tableNames.otpTokens, values, db);
}

async function createRegisteredUser(tableNames, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const userColumns = await loadTableColumns(tableNames.users);
    const profileColumns = await loadTableColumns(tableNames.userProfiles);
    const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
    const emailColumn = pickColumn(userColumns, ["email"]);
    const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
    const passwordHashColumn = pickColumn(userColumns, ["password_hash", "password"]);
    const phoneColumn = pickColumn(userColumns, ["phone_number", "phone"]);
    const statusColumn = pickColumn(userColumns, ["status"]);
    const emailVerifiedColumn = pickColumn(userColumns, ["is_email_verified", "email_verified"]);
    const phoneVerifiedColumn = pickColumn(userColumns, ["is_phone_verified", "phone_verified"]);
    const deletedColumn = pickColumn(userColumns, ["is_deleted"]);
    const fullNameColumn = pickColumn(userColumns, ["full_name", "name"]);

    const { firstName, lastName } = splitFullName(payload.fullName);
    const passwordHash = hashPassword(payload.password);
    const username = await buildUniqueUsername(
      tableNames.users,
      userColumns,
      payload.username.trim().toLowerCase(),
      connection
    );

    const userValues = {};
    if (usernameColumn) userValues[usernameColumn] = username;
    if (emailColumn) userValues[emailColumn] = payload.email.trim().toLowerCase();
    if (passwordHashColumn) userValues[passwordHashColumn] = passwordHash;
    if (phoneColumn) userValues[phoneColumn] = payload.phone?.trim() || null;
    if (statusColumn) userValues[statusColumn] = "INACTIVE";
    if (emailVerifiedColumn) userValues[emailVerifiedColumn] = 0;
    if (phoneVerifiedColumn) userValues[phoneVerifiedColumn] = 0;
    if (deletedColumn) userValues[deletedColumn] = 0;
    if (fullNameColumn) userValues[fullNameColumn] = payload.fullName?.trim() || null;

    await insertRow(tableNames.users, userValues, connection);

    const createdUser = await findRowByColumn(
      tableNames.users,
      emailColumn,
      payload.email.trim().toLowerCase(),
      connection
    );

    if (!createdUser) {
      throw new Error("User record was not created.");
    }

    if (tableNames.userProfiles && profileColumns.length) {
      const profileUserIdColumn = pickColumn(profileColumns, ["user_id"]);
      const firstNameColumn = pickColumn(profileColumns, ["first_name", "firstname"]);
      const lastNameColumn = pickColumn(profileColumns, ["last_name", "lastname"]);
      const genderColumn = pickColumn(profileColumns, ["gender"]);
      const addressColumn = pickColumn(profileColumns, ["address"]);
      const bioColumn = pickColumn(profileColumns, ["bio"]);

      const profileValues = {};
      if (profileUserIdColumn) profileValues[profileUserIdColumn] = createdUser[userIdColumn];
      if (firstNameColumn) profileValues[firstNameColumn] = firstName || null;
      if (lastNameColumn) profileValues[lastNameColumn] = lastName || null;
      if (genderColumn) profileValues[genderColumn] = null;
      if (addressColumn) profileValues[addressColumn] = null;
      if (bioColumn) profileValues[bioColumn] = null;

      if (Object.keys(profileValues).length) {
        await insertRow(tableNames.userProfiles, profileValues, connection);
      }
    }

    await ensureCustomerRole(tableNames, createdUser[userIdColumn], connection);
    await ensureCustomerRecord(tableNames, createdUser[userIdColumn], {
      username,
    }, connection);

    const verificationCode = generateVerificationCode();
    await createOrRefreshVerificationToken(
      tableNames,
      createdUser[userIdColumn],
      "EMAIL_VERIFICATION",
      verificationCode,
      connection
    );

    await connection.commit();

    return {
      userId: createdUser[userIdColumn],
      verificationCode,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifyEmailToken(tableNames, userId, token) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const userColumns = await loadTableColumns(tableNames.users);
    const otpColumns = await loadTableColumns(tableNames.otpTokens);
    const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
    const statusColumn = pickColumn(userColumns, ["status"]);
    const emailVerifiedColumn = pickColumn(userColumns, ["is_email_verified", "email_verified"]);
    const tokenUserIdColumn = pickColumn(otpColumns, ["user_id"]);
    const codeColumn = pickColumn(otpColumns, ["otp_code", "token"]);
    const purposeColumn = pickColumn(otpColumns, ["purpose"]);
    const usedAtColumn = pickColumn(otpColumns, ["used_at"]);
    const expiresAtColumn = pickColumn(otpColumns, ["expires_at"]);
    const tokenIdColumn = pickColumn(otpColumns, ["otp_id", "id"]);

    const user = await findRowByColumn(tableNames.users, userIdColumn, userId, connection);
    if (!user) {
      throw new Error("Account not found.");
    }

    const [rows] = await connection.query(
      `SELECT * FROM \`${tableNames.otpTokens}\` WHERE \`${tokenUserIdColumn}\` = ? AND \`${codeColumn}\` = ? AND \`${purposeColumn}\` = ? LIMIT 1`,
      [userId, token, "EMAIL_VERIFICATION"]
    );

    const otpRecord = rows[0];

    if (!otpRecord) {
      throw new Error("Verification token is invalid.");
    }

    if (usedAtColumn && otpRecord[usedAtColumn]) {
      throw new Error("Verification token has already been used.");
    }

    if (expiresAtColumn && new Date(otpRecord[expiresAtColumn]).getTime() < Date.now()) {
      throw new Error("Verification token has expired.");
    }

    const userUpdates = [];
    const userParams = [];

    if (emailVerifiedColumn) {
      userUpdates.push(`\`${emailVerifiedColumn}\` = 1`);
    }
    if (statusColumn) {
      userUpdates.push(`\`${statusColumn}\` = 'ACTIVE'`);
    }

    userParams.push(userId);

    if (userUpdates.length) {
      await connection.query(
        `UPDATE \`${tableNames.users}\` SET ${userUpdates.join(", ")} WHERE \`${userIdColumn}\` = ?`,
        userParams
      );
    }

    if (usedAtColumn && tokenIdColumn) {
      await connection.query(
        `UPDATE \`${tableNames.otpTokens}\` SET \`${usedAtColumn}\` = ? WHERE \`${tokenIdColumn}\` = ?`,
        [new Date(), otpRecord[tokenIdColumn]]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertGoogleUser(tableNames, userColumns, profile) {
  const values = {};
  const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
  const emailColumn = pickColumn(userColumns, ["email"]);
  const passwordHashColumn = pickColumn(userColumns, ["password_hash", "password"]);
  const phoneColumn = pickColumn(userColumns, ["phone_number", "phone"]);
  const avatarColumn = pickColumn(userColumns, ["avatar_url"]);
  const statusColumn = pickColumn(userColumns, ["status"]);
  const emailVerifiedColumn = pickColumn(userColumns, ["is_email_verified", "email_verified"]);
  const phoneVerifiedColumn = pickColumn(userColumns, ["is_phone_verified", "phone_verified"]);
  const deletedColumn = pickColumn(userColumns, ["is_deleted"]);
  const fullNameColumn = pickColumn(userColumns, ["full_name", "name"]);
  const lastLoginColumn = pickColumn(userColumns, ["last_login_at"]);

  if (usernameColumn) {
    values[usernameColumn] = await buildUniqueUsername(
      tableNames.users,
      userColumns,
      profile.username
    );
  }
  if (emailColumn) values[emailColumn] = profile.email;
  if (passwordHashColumn) values[passwordHashColumn] = "GOOGLE_OAUTH_ONLY";
  if (phoneColumn) values[phoneColumn] = null;
  if (avatarColumn) values[avatarColumn] = profile.avatarUrl || null;
  if (statusColumn) values[statusColumn] = "ACTIVE";
  if (emailVerifiedColumn) values[emailVerifiedColumn] = 1;
  if (phoneVerifiedColumn) values[phoneVerifiedColumn] = 0;
  if (deletedColumn) values[deletedColumn] = 0;
  if (fullNameColumn) values[fullNameColumn] = profile.fullName || null;
  if (lastLoginColumn) values[lastLoginColumn] = new Date();

  await insertRow(tableNames.users, values);

  const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
  const emailRow = await findRowByColumn(tableNames.users, emailColumn, profile.email);

  if (!emailRow) {
    throw new Error("Google user was inserted but could not be reloaded.");
  }

  await ensureGoogleUserProfile(tableNames, emailRow[userIdColumn], profile, userColumns, await loadTableColumns(tableNames.userProfiles));
  await ensureCustomerRole(tableNames, emailRow[userIdColumn]);
  await ensureCustomerRecord(tableNames, emailRow[userIdColumn], profile);

  return emailRow;
}

async function findOrCreateGoogleUser(profile) {
  if (!isDbConfigured()) {
    return {
      user: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
        username: profile.username,
        nickname: profile.firstName,
        email: profile.email,
        phone: "",
        avatarUrl: profile.avatarUrl,
        authProvider: "google",
      },
      persisted: false,
    };
  }

  try {
    const tableNames = await resolveTableNames();

    if (!tableNames.users) {
      throw new Error("Users table was not found in the configured database.");
    }

    const userColumns = await loadTableColumns(tableNames.users);
    const profileColumns = await loadTableColumns(tableNames.userProfiles);
    const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
    const emailColumn = pickColumn(userColumns, ["email"]);

    const existingUser = await findRowByColumn(
      tableNames.users,
      emailColumn,
      profile.email
    );

    if (existingUser) {
      const profileUserIdColumn = pickColumn(profileColumns, ["user_id"]);
      let existingProfile =
        tableNames.userProfiles && profileUserIdColumn
          ? await findRowByColumn(
              tableNames.userProfiles,
              profileUserIdColumn,
              existingUser[userIdColumn]
            )
          : null;
      existingProfile = await ensureGoogleUserProfile(
        tableNames,
        existingUser[userIdColumn],
        profile,
        userColumns,
        profileColumns
      ) || existingProfile;
      await ensureCustomerRole(tableNames, existingUser[userIdColumn]);
      await ensureCustomerRecord(tableNames, existingUser[userIdColumn], profile);

      return {
        user: mapUserToFrontend(
          existingUser,
          userColumns,
          existingProfile,
          profileColumns,
          profile
        ),
        persisted: true,
      };
    }

    const insertedUser = await insertGoogleUser(tableNames, userColumns, profile);
    const insertedProfileUserIdColumn = pickColumn(profileColumns, ["user_id"]);
    const insertedProfile =
      tableNames.userProfiles && insertedProfileUserIdColumn
        ? await findRowByColumn(
            tableNames.userProfiles,
            insertedProfileUserIdColumn,
            insertedUser[userIdColumn]
          )
        : null;

    if (!insertedUser) {
      throw new Error("User was not returned after insert.");
    }

    return {
      user: mapUserToFrontend(
        insertedUser,
        userColumns,
        insertedProfile,
        profileColumns,
        profile
      ),
      persisted: true,
    };
  } catch (error) {
    console.error("Google DB sync error:", error);
    return {
      user: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
        username: profile.username,
        nickname: profile.firstName,
        email: profile.email,
        phone: "",
        avatarUrl: profile.avatarUrl,
        authProvider: "google",
      },
      persisted: false,
      storageWarning: error.message,
    };
  }
}

// Register endpoint - expects JSON { username, email, password, fullName, phone }
router.post("/register", async (req, res) => {
  const { username, email, password, passwordHash, fullName, phone } = req.body;
  const normalizedUsername = username?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const rawPassword = password || passwordHash;

  if (!normalizedUsername || !normalizedEmail || !rawPassword) {
    return res.status(400).json({ message: "Username, email, and password are required." });
  }

  if (rawPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters." });
  }

  try {
    const tableNames = await resolveTableNames();
    if (!tableNames.users) {
      return res.status(500).json({ message: "Users table was not found in the database." });
    }

    const userColumns = await loadTableColumns(tableNames.users);
    const emailColumn = pickColumn(userColumns, ["email"]);
    const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
    const deletedColumn = pickColumn(userColumns, ["is_deleted"]);

    const existingByEmail = await findRowByColumn(
      tableNames.users,
      emailColumn,
      normalizedEmail
    );
    const existingByUsername = await findRowByColumn(
      tableNames.users,
      usernameColumn,
      normalizedUsername.toLowerCase()
    );

    const activeExistingUser = [existingByEmail, existingByUsername].find(
      (user) => user && (!deletedColumn || !user[deletedColumn])
    );

    if (activeExistingUser) {
      return res.status(409).json({
        message: "An account with that email or username already exists.",
      });
    }

    const result = await createRegisteredUser(tableNames, {
      username: normalizedUsername,
      email: normalizedEmail,
      password: rawPassword,
      fullName,
      phone,
    });

    await sendVerificationEmail(normalizedEmail, result.userId, result.verificationCode);
    res.json({
      message:
        "Registration successful. Please check your email and verify your account.",
      userId: result.userId,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/google", async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ message: "Missing Google access token." });
  }

  try {
    const tokenInfo = await fetchGoogleTokenInfo(accessToken);
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;

    if (expectedClientId) {
      const audience = tokenInfo.audience || tokenInfo.issued_to || "";
      if (audience && audience !== expectedClientId) {
        return res.status(401).json({
          message: "Google token audience does not match this application.",
        });
      }
    }

    const googleProfile = await fetchGoogleUserInfo(accessToken);
    const normalizedProfile = normalizeGoogleProfile(googleProfile);

    if (!normalizedProfile.email) {
      return res
        .status(400)
        .json({ message: "Google account did not return an email address." });
    }

    const result = await findOrCreateGoogleUser(normalizedProfile);

    res.json({
      message: result.persisted
        ? "Google Sign-In successful."
        : "Google Sign-In successful, but database sync was skipped.",
      user: result.user,
      persisted: result.persisted,
      storageWarning: result.storageWarning || null,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      message: error.message || "Google Sign-In failed.",
    });
  }
});

router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  const normalizedIdentifier = identifier?.trim().toLowerCase();

  if (!normalizedIdentifier || !password) {
    return res
      .status(400)
      .json({ message: "Email or username and password are required." });
  }

  try {
    const tableNames = await resolveTableNames();
    const userColumns = await loadTableColumns(tableNames.users);
    const profileColumns = await loadTableColumns(tableNames.userProfiles);
    const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
    const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
    const emailColumn = pickColumn(userColumns, ["email"]);
    const passwordHashColumn = pickColumn(userColumns, ["password_hash", "password"]);
    const statusColumn = pickColumn(userColumns, ["status"]);
    const emailVerifiedColumn = pickColumn(userColumns, ["is_email_verified", "email_verified"]);
    const deletedColumn = pickColumn(userColumns, ["is_deleted"]);
    const lastLoginColumn = pickColumn(userColumns, ["last_login_at"]);

    const user =
      (await findRowByColumn(tableNames.users, emailColumn, normalizedIdentifier)) ||
      (await findRowByColumn(tableNames.users, usernameColumn, normalizedIdentifier));

    if (!user || (deletedColumn && user[deletedColumn])) {
      return res.status(404).json({
        message: "Account does not exist. Please check your email or username.",
      });
    }

    if (!verifyPassword(password, user[passwordHashColumn])) {
      return res
        .status(401)
        .json({ message: "Incorrect password. Please try again." });
    }

    if (emailVerifiedColumn && !user[emailVerifiedColumn]) {
      return res.status(403).json({
        message: "Please verify your email before signing in.",
      });
    }

    if (statusColumn && String(user[statusColumn]).toUpperCase() !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active. Please verify your email.",
      });
    }

    if (lastLoginColumn) {
      await pool.query(
        `UPDATE \`${tableNames.users}\` SET \`${lastLoginColumn}\` = ? WHERE \`${userIdColumn}\` = ?`,
        [new Date(), user[userIdColumn]]
      );
    }

    const profileUserIdColumn = pickColumn(profileColumns, ["user_id"]);
    const profileRow =
      tableNames.userProfiles && profileUserIdColumn
        ? await findRowByColumn(
            tableNames.userProfiles,
            profileUserIdColumn,
            user[userIdColumn]
          )
        : null;

    res.json({
      message: "Login successful.",
      user: mapUserToFrontend(user, userColumns, profileRow, profileColumns, {
        firstName: "",
        lastName: "",
        fullName: user[usernameColumn],
        username: user[usernameColumn],
        email: user[emailColumn],
        phone: "",
        avatarUrl: "",
        authProvider: "password",
      }),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Login failed." });
  }
});

router.put("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, username, email, phone, avatarUrl } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  if (!firstName?.trim() || !lastName?.trim() || !username?.trim()) {
    return res
      .status(400)
      .json({ message: "First name, last name, and username are required." });
  }

  try {
    const tableNames = await resolveTableNames();
    const userColumns = await loadTableColumns(tableNames.users);
    const profileColumns = await loadTableColumns(tableNames.userProfiles);
    const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
    const usernameColumn = pickColumn(userColumns, ["username", "user_name"]);
    const emailColumn = pickColumn(userColumns, ["email"]);
    const phoneColumn = pickColumn(userColumns, ["phone_number", "phone"]);
    const avatarColumn = pickColumn(userColumns, ["avatar_url"]);
    const fullNameColumn = pickColumn(userColumns, ["full_name", "name"]);

    const currentUser = await findRowByColumn(
      tableNames.users,
      userIdColumn,
      userId
    );

    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email?.trim().toLowerCase() || "";
    const existingUsername = await findRowByColumn(
      tableNames.users,
      usernameColumn,
      normalizedUsername
    );
    const existingEmail = normalizedEmail
      ? await findRowByColumn(tableNames.users, emailColumn, normalizedEmail)
      : null;

    if (existingUsername && String(existingUsername[userIdColumn]) !== String(userId)) {
      return res.status(409).json({ message: "Username is already in use." });
    }

    if (existingEmail && String(existingEmail[userIdColumn]) !== String(userId)) {
      return res.status(409).json({ message: "Email is already in use." });
    }

    const userUpdates = [];
    const userParams = [];
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (usernameColumn) {
      userUpdates.push(`\`${usernameColumn}\` = ?`);
      userParams.push(normalizedUsername);
    }
    if (emailColumn && normalizedEmail) {
      userUpdates.push(`\`${emailColumn}\` = ?`);
      userParams.push(normalizedEmail);
    }
    if (phoneColumn) {
      userUpdates.push(`\`${phoneColumn}\` = ?`);
      userParams.push(phone?.trim() || null);
    }
    if (avatarColumn) {
      userUpdates.push(`\`${avatarColumn}\` = ?`);
      userParams.push(avatarUrl || null);
    }
    if (fullNameColumn) {
      userUpdates.push(`\`${fullNameColumn}\` = ?`);
      userParams.push(fullName);
    }

    if (userUpdates.length) {
      userParams.push(userId);
      await pool.query(
        `UPDATE \`${tableNames.users}\` SET ${userUpdates.join(", ")} WHERE \`${userIdColumn}\` = ?`,
        userParams
      );
    }

    let profileRow = null;

    if (tableNames.userProfiles && profileColumns.length) {
      const profileUserIdColumn = pickColumn(profileColumns, ["user_id"]);
      const firstNameColumn = pickColumn(profileColumns, ["first_name", "firstname"]);
      const lastNameColumn = pickColumn(profileColumns, ["last_name", "lastname"]);

      profileRow = await findRowByColumn(
        tableNames.userProfiles,
        profileUserIdColumn,
        userId
      );

      if (profileRow) {
        const profileUpdates = [];
        const profileParams = [];

        if (firstNameColumn) {
          profileUpdates.push(`\`${firstNameColumn}\` = ?`);
          profileParams.push(firstName.trim());
        }
        if (lastNameColumn) {
          profileUpdates.push(`\`${lastNameColumn}\` = ?`);
          profileParams.push(lastName.trim());
        }

        if (profileUpdates.length) {
          profileParams.push(userId);
          await pool.query(
            `UPDATE \`${tableNames.userProfiles}\` SET ${profileUpdates.join(", ")} WHERE \`${profileUserIdColumn}\` = ?`,
            profileParams
          );
        }
      } else {
        const profileValues = {};
        if (profileUserIdColumn) profileValues[profileUserIdColumn] = userId;
        if (firstNameColumn) profileValues[firstNameColumn] = firstName.trim();
        if (lastNameColumn) profileValues[lastNameColumn] = lastName.trim();
        await insertRow(tableNames.userProfiles, profileValues);
      }

      profileRow = await findRowByColumn(
        tableNames.userProfiles,
        profileUserIdColumn,
        userId
      );
    }

    const updatedUser = await findRowByColumn(
      tableNames.users,
      userIdColumn,
      userId
    );

    res.json({
      message: "Profile updated successfully.",
      user: mapUserToFrontend(
        updatedUser,
        userColumns,
        profileRow,
        profileColumns,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName,
          username: normalizedUsername,
          email: normalizedEmail,
          phone: phone?.trim() || "",
          avatarUrl: avatarUrl || "",
        }
      ),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: error.message || "Profile update failed." });
  }
});

// Verify endpoint - expects query params uid and token
router.get("/verify", async (req, res) => {
  const { uid, token } = req.query;
  if (!uid || !token) {
    return res.status(400).json({ message: "Missing uid or token" });
  }
  try {
    const tableNames = await resolveTableNames();
    if (!tableNames.users || !tableNames.otpTokens) {
      return res
        .status(500)
        .json({ message: "Verification tables were not found in the database." });
    }

    await verifyEmailToken(tableNames, uid, String(token).trim());
    res.json({ message: "Email verified successfully. You can now sign in." });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(400).json({
      message: err.message || "Verification failed or token invalid/expired.",
    });
  }
});

export default router;
