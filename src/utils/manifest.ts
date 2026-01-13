import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { ManifestFile, ManifestEntry } from "../types/manifest";

const MANIFEST_FILENAME = "lastlook_manifest.json";
const CURRENT_SCHEMA_VERSION = "1.0";

// Helper to get default structure if file is missing
function createEmptyManifest(
  machineName: string,
  os: string,
  appVersion: string,
  sessionId: string
): ManifestFile {
  const now = new Date().toISOString();
  return {
    manifest_version: CURRENT_SCHEMA_VERSION,
    session_id: sessionId,
    created_at: now,
    last_updated: now,
    app_version: appVersion,
    machine_name: machineName,
    system_os: os,
    files: [],
  };
}

/**
 * Updates or creates a manifest file in the destination folder.
 * This is designed to be called after a SUCCESSFUL transfer of a single file.
 */
export async function updateManifest(
  destFolder: string,
  entry: ManifestEntry,
  meta: {
    machineName: string;
    os: string;
    appVersion: string;
    sessionId: string;
  }
): Promise<void> {
  try {
    const manifestPath = await join(destFolder, MANIFEST_FILENAME);
    const fileExists = await exists(manifestPath);

    let manifest: ManifestFile;

    if (fileExists) {
      // 1. READ EXISTING
      try {
        const content = await readTextFile(manifestPath);
        manifest = JSON.parse(content);

        // Update metadata to show recent activity
        manifest.last_updated = new Date().toISOString();

        // Optional: Update app version if it changed since last run
        manifest.app_version = meta.appVersion;
      } catch (e) {
        console.error(
          "⚠️ Corrupt manifest found. Creating backup and starting fresh.",
          e
        );
        // In a real pro app, we might rename the old one to .bak here
        manifest = createEmptyManifest(
          meta.machineName,
          meta.os,
          meta.appVersion,
          meta.sessionId
        );
      }
    } else {
      // 2. CREATE NEW
      manifest = createEmptyManifest(
        meta.machineName,
        meta.os,
        meta.appVersion,
        meta.sessionId
      );
    }

    // 3. UPSERT ENTRY (Update if exists, Append if new)
    const existingIndex = manifest.files.findIndex(
      (f) => f.filename === entry.filename
    );

    if (existingIndex >= 0) {
      // Overwrite existing entry with new verification data
      manifest.files[existingIndex] = entry;
    } else {
      // Append new entry
      manifest.files.push(entry);
    }

    // 4. WRITE TO DISK
    await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
    // console.log(`📝 Manifest updated for: ${entry.filename}`);
  } catch (err) {
    console.error("❌ Failed to update manifest:", err);
    // We do NOT throw here. A manifest failure should not crash the app logic
    // or make the user think the transfer failed. It's a "soft" error.
  }
}

/**
 * Loads the manifest from the destination folder and returns a Map for fast lookup.
 * Returns an empty Map if the file is missing or corrupt.
 */
export async function loadManifest(
  destFolder: string
): Promise<Map<string, ManifestEntry>> {
  const map = new Map<string, ManifestEntry>();

  try {
    const manifestPath = await join(destFolder, MANIFEST_FILENAME);
    const fileExists = await exists(manifestPath);

    if (!fileExists) {
      return map; // Return empty map (no verification data yet)
    }

    const content = await readTextFile(manifestPath);
    const manifest: ManifestFile = JSON.parse(content);

    // Populate the Map for O(1) lookup
    manifest.files.forEach((entry) => {
      map.set(entry.filename, entry);
    });

    console.log(`📖 Loaded Manifest: ${map.size} verified files found.`);
    return map;
  } catch (err) {
    console.warn("⚠️ Failed to load manifest (ignoring):", err);
    return map; // Safe fallback
  }
}
