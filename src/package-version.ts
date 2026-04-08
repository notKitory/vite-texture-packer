import fs from "node:fs";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

let cachedVersion: string | undefined;

export function getPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };

    cachedVersion = typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }

  return cachedVersion;
}
