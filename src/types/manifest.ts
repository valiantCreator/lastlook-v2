export type HashType = "xxh3_64" | "md5" | "sha256";
export type TransferStatus = "verified" | "failed" | "skipped";

export interface ManifestEntry {
  filename: string;
  rel_path: string; // Relative to the manifest file
  source_path: string; // Where it came from (Traceability)
  size_bytes: number;
  modified_timestamp: number;
  hash_type: HashType;
  hash_value: string;
  status: TransferStatus;
  verified_at: string; // ISO Date
}

export interface ManifestFile {
  manifest_version: string; // e.g., "1.0"
  session_id: string; // UUID for the batch
  created_at: string; // When this manifest was first created
  last_updated: string; // When it was last modified
  app_version: string; // e.g., "LastLook v0.2.0"

  // Machine Identity
  machine_name: string;
  system_os: string;

  // The Data
  files: ManifestEntry[];
}
