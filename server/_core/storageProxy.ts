import type { Express } from "express";
// Storage proxy is disabled when BUILT_IN_FORGE_API_URL is not set.
// Photos are served from /uploads instead (see server/_core/index.ts).
export function registerStorageProxy(_app: Express) {
  // No-op: local storage via /uploads is handled in index.ts
}
