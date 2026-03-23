// ─── PluginUpdateChecker ──────────────────────────────────────────────────────
//
// Phase 10B P7: checks the FiceCal plugin registry for available updates
// for a set of installed plugins. Uses @ficecal/plugin-registry-client to
// fetch the registry index.
//
// Does NOT install updates — it surfaces what is available so the AdminPanel
// can display badges and the user can opt in.

import type { RegistryClient } from "@ficecal/plugin-registry-client";

export interface InstalledPlugin {
  id: string;
  version: string;
}

export interface PluginUpdate {
  id: string;
  currentVersion: string;
  availableVersion: string;
  bundleUrl: string;
  bundleSha256: string;
  /** Optional changelog / release notes extracted from the registry manifest description */
  releaseNotes?: string;
}

/**
 * Parse a semver-like string into [major, minor, patch] integers.
 * Ignores pre-release suffixes.
 */
function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/** Returns true if `a` is strictly greater than `b`. */
function isNewer(a: string, b: string): boolean {
  const [aMaj, aMin, aPat] = parseVersion(a);
  const [bMaj, bMin, bPat] = parseVersion(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

export class PluginUpdateChecker {
  constructor(private readonly registry: RegistryClient) {}

  /** Check all installed plugins for updates. Returns only those with a newer version available. */
  async checkForUpdates(
    installed: InstalledPlugin[],
    options?: { signal?: AbortSignal },
  ): Promise<PluginUpdate[]> {
    // One network request for all plugins
    const manifests = await this.registry.browse(undefined, options);

    const manifestById = new Map(manifests.map((m) => [m.id, m]));

    const updates: PluginUpdate[] = [];

    for (const plugin of installed) {
      const manifest = manifestById.get(plugin.id);
      if (!manifest) continue;

      if (isNewer(manifest.version, plugin.version)) {
        updates.push({
          id: plugin.id,
          currentVersion: plugin.version,
          availableVersion: manifest.version,
          bundleUrl: manifest.bundleUrl,
          bundleSha256: manifest.bundleSha256,
          releaseNotes: manifest.description,
        });
      }
    }

    return updates;
  }

  /** Returns true if a newer version is available for pluginId in the registry. */
  async hasUpdate(
    pluginId: string,
    currentVersion: string,
    options?: { signal?: AbortSignal },
  ): Promise<boolean> {
    const manifest = await this.registry.find(pluginId, options);
    if (!manifest) return false;
    return isNewer(manifest.version, currentVersion);
  }
}
