import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { ManifestFile, ManifestEntry } from "../types/manifest";

const MANIFEST_FILENAME = "lastlook_manifest.json";
const CURRENT_SCHEMA_VERSION = "1.0";

// --- MEMORY STATE (Single Source of Truth) ---
// This cache prevents us from re-reading the disk 50 times a second.
let cachedManifest: ManifestFile | null = null;
let currentManifestPath: string | null = null;

// --- MUTEX QUEUE ---
// Serializes disk writes to prevent file locking collisions
let manifestQueue = Promise.resolve();

// Helper to get default structure
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
 * Loads the manifest from the destination folder into MEMORY.
 * Called when destination is mounted.
 */
export async function loadManifest(
  destFolder: string
): Promise<Map<string, ManifestEntry>> {
  const map = new Map<string, ManifestEntry>();

  try {
    const manifestPath = await join(destFolder, MANIFEST_FILENAME);
    currentManifestPath = manifestPath; // Store path for writers

    const fileExists = await exists(manifestPath);

    if (!fileExists) {
      cachedManifest = null; // No file yet
      return map;
    }

    const content = await readTextFile(manifestPath);
    cachedManifest = JSON.parse(content);

    // Populate Map for UI
    cachedManifest?.files.forEach((entry) => {
      map.set(entry.filename, entry);
    });

    console.log(`📖 Loaded Manifest: ${map.size} verified files found.`);
    return map;
  } catch (err) {
    console.warn("⚠️ Failed to load manifest (ignoring):", err);
    cachedManifest = null; // Reset cache on error
    return map;
  }
}

/**
 * Updates the In-Memory Manifest and queues a Disk Write.
 * This is non-blocking for the logic, but serialized for the disk.
 */
export function updateManifest(
  destFolder: string,
  entry: ManifestEntry,
  meta: {
    machineName: string;
    os: string;
    appVersion: string;
    sessionId: string;
  }
): Promise<void> {
  // 1. Update Memory Immediately (0ms Latency)
  if (!cachedManifest) {
    cachedManifest = createEmptyManifest(
      meta.machineName,
      meta.os,
      meta.appVersion,
      meta.sessionId
    );
  }

  // Update Metadata
  cachedManifest.last_updated = new Date().toISOString();
  cachedManifest.app_version = meta.appVersion;

  // Upsert Entry in Memory
  const existingIndex = cachedManifest.files.findIndex(
    (f) => f.filename === entry.filename
  );

  if (existingIndex >= 0) {
    cachedManifest.files[existingIndex] = entry;
  } else {
    cachedManifest.files.push(entry);
  }

  // 2. Queue Disk Write (Serialized)
  // We use the queue to ensure we don't try to open the file handle twice at once
  manifestQueue = manifestQueue.then(async () => {
    try {
      if (!cachedManifest) return;

      // Ensure path is known
      const path =
        currentManifestPath || (await join(destFolder, MANIFEST_FILENAME));

      // Write the ENTIRE memory state to disk.
      // Even if a previous write failed due to lock, this one contains EVERYTHING.
      await writeTextFile(path, JSON.stringify(cachedManifest, null, 2));
    } catch (err) {
      console.error("❌ Manifest Write Failed (Retrying next cycle):", err);
      // We do not throw. The data is safe in 'cachedManifest' and will be written
      // on the next successful cycle.
    }
  });

  return manifestQueue;
}
