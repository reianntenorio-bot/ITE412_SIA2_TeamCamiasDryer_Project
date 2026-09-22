/**
 * Outputs minified service account JSON for Railway FIREBASE_CREDENTIALS_JSON.
 * Run: node scripts/prepare-firebase-credentials.js
 * Copy the output and paste into Railway Variables.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credsPath = path.join(__dirname, "..", "kamyasdryer-dae01-e46f40295dc6.json");

if (!fs.existsSync(credsPath)) {
  console.error("Credentials file not found:", credsPath);
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const minified = JSON.stringify(json);
console.log("\nCopy everything below and paste as FIREBASE_CREDENTIALS_JSON in Railway:\n");
console.log(minified);
console.log("\n");
