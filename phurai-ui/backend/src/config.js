import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const backendEnvLocalPath = path.join(__dirname, "../.env.local");
const rootEnvLocalPath = path.join(__dirname, "../../.env.local");
const backendEnvPath = path.join(__dirname, "../.env");
const rootEnvPath = path.join(__dirname, "../../.env");

// Load local overrides first
if (fs.existsSync(backendEnvLocalPath)) {
  dotenv.config({ path: backendEnvLocalPath });
} else if (fs.existsSync(rootEnvLocalPath)) {
  dotenv.config({ path: rootEnvLocalPath });
}

// Load standard variables (without overwriting)
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

