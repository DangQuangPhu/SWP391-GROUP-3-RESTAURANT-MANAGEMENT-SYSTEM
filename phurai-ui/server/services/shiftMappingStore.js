import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const shiftFilePath = path.join(__dirname, "../data/shift_mapping.json");

/** Default when file is missing (keys are staff user_id strings). */
const DEFAULT_MAPPING = {
  "3": "Morning",
  "4": "Afternoon",
  "5": "Night",
};

function normalizeMappingKeys(mapping) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    return { ...DEFAULT_MAPPING };
  }

  const normalized = {};
  for (const [key, value] of Object.entries(mapping)) {
    const staffKey = String(key).trim();
    if (!staffKey) continue;
    normalized[staffKey] = normalizeShiftLabel(value) || String(value).trim();
  }
  return Object.keys(normalized).length > 0 ? normalized : { ...DEFAULT_MAPPING };
}

export const VALID_SHIFT_LABELS = new Set(["Morning", "Afternoon", "Night"]);

export function normalizeShiftLabel(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const canonical =
    text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  if (canonical === "Morning") return "Morning";
  if (canonical === "Afternoon") return "Afternoon";
  if (canonical === "Night") return "Night";
  return null;
}

export function shiftLabelToId(label) {
  const normalized = normalizeShiftLabel(label);
  if (!normalized) return null;
  return normalized.toLowerCase();
}

function ensureDataDirectory() {
  const dir = path.dirname(shiftFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readShiftMapping() {
  ensureDataDirectory();

  if (!fs.existsSync(shiftFilePath)) {
    writeShiftMapping(DEFAULT_MAPPING);
    return { ...DEFAULT_MAPPING };
  }

  try {
    const raw = fs.readFileSync(shiftFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeMappingKeys(parsed);
  } catch (error) {
    console.error("readShiftMapping failed:", error);
    return { ...DEFAULT_MAPPING };
  }
}

export function writeShiftMapping(mapping) {
  ensureDataDirectory();
  const payload = JSON.stringify(mapping, null, 2);
  fs.writeFileSync(shiftFilePath, `${payload}\n`, "utf8");
}

export function getShiftLabelForUserId(userId, mapping = readShiftMapping()) {
  if (userId == null || userId === "") return null;
  const raw = mapping[String(userId)];
  return normalizeShiftLabel(raw);
}

export function getShiftIdForUserId(userId, mapping = readShiftMapping()) {
  return shiftLabelToId(getShiftLabelForUserId(userId, mapping));
}

export function updateShiftForStaff(staffId, shiftLabel) {
  const normalizedShift = normalizeShiftLabel(shiftLabel);
  if (!normalizedShift) {
    throw new Error("shift must be Morning, Afternoon, or Night.");
  }

  const staffKey = String(staffId ?? "").trim();
  if (!staffKey) {
    throw new Error("staffId is required.");
  }

  const mapping = readShiftMapping();
  mapping[staffKey] = normalizedShift;
  writeShiftMapping(mapping);
  console.log("--- SHIFT UPDATED FOR STAFF:", staffKey, "TO:", normalizedShift);
  return mapping;
}
