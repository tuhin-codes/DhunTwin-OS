/* ============================================================
   DHUN TWIN OS — CENTRAL ASSET REPOSITORY
   Modular persistence layer implementing IAssetRepository.
   Uses browser localStorage with schema versioning and seed
   fallback. Does not lose new assets on refresh.
   ============================================================ */

import type { RegisteredAsset } from "./types";
import { INITIAL_SEED_ASSETS } from "./seedAssets";

export const STORAGE_KEY = "dhun_twin_os_asset_registry_v1";

export interface IAssetRepository {
  getAll(): RegisteredAsset[];
  getById(id: string): RegisteredAsset | undefined;
  add(asset: RegisteredAsset): { success: boolean; error?: string };
  update(asset: RegisteredAsset): { success: boolean; error?: string };
  delete(id: string): boolean;
  resetToDefaults(): void;
  exportJson(): string;
  importJson(jsonStr: string): { success: boolean; count?: number; error?: string };
}

export class LocalAssetRepository implements IAssetRepository {
  private key: string;
  private memoryStore?: RegisteredAsset[];

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      if (!this.memoryStore) {
        this.memoryStore = [...INITIAL_SEED_ASSETS];
      }
      return;
    }

    try {
      const existing = window.localStorage.getItem(this.key);
      if (!existing) {
        window.localStorage.setItem(this.key, JSON.stringify(INITIAL_SEED_ASSETS));
      }
    } catch (e) {
      console.warn("Dhun Twin OS: Failed to access localStorage, running in-memory fallback", e);
      if (!this.memoryStore) {
        this.memoryStore = [...INITIAL_SEED_ASSETS];
      }
    }
  }

  public getAll(): RegisteredAsset[] {
    if (typeof window === "undefined" || !window.localStorage) {
      return this.memoryStore ? [...this.memoryStore] : [...INITIAL_SEED_ASSETS];
    }

    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) {
        return this.memoryStore ? [...this.memoryStore] : [...INITIAL_SEED_ASSETS];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as RegisteredAsset[];
      }
      return [...INITIAL_SEED_ASSETS];
    } catch (e) {
      console.error("Dhun Twin OS: Error reading asset registry from localStorage", e);
      return this.memoryStore ? [...this.memoryStore] : [...INITIAL_SEED_ASSETS];
    }
  }

  public getById(id: string): RegisteredAsset | undefined {
    const all = this.getAll();
    return all.find((item) => item.id.toLowerCase() === id.toLowerCase());
  }

  public add(asset: RegisteredAsset): { success: boolean; error?: string } {
    // 1. Validate required fields
    if (!asset.id || !asset.name || !asset.domain || !asset.type) {
      return { success: false, error: "Missing required fields: ID, Name, Domain, and Type are mandatory." };
    }

    // 2. Validate ID format and uniqueness
    const normalizedId = asset.id.trim().toLowerCase().replace(/\s+/g, "-");
    const all = this.getAll();
    if (all.some((item) => item.id.toLowerCase() === normalizedId)) {
      return { success: false, error: `Asset with ID '${asset.id}' already exists in the registry.` };
    }

    // 3. Validate rated capacity
    if (typeof asset.ratedCapacity !== "number" || isNaN(asset.ratedCapacity) || asset.ratedCapacity < 0) {
      return { success: false, error: "Rated capacity must be a non-negative number." };
    }

    // 4. Validate unit
    if (!asset.capacityUnit || asset.capacityUnit.trim() === "") {
      return { success: false, error: "Capacity unit is required." };
    }

    // 5. Clean asset structure
    const cleanedAsset: RegisteredAsset = {
      ...asset,
      id: normalizedId,
      name: asset.name.trim(),
      type: asset.type.trim(),
      description: asset.description?.trim() || "No description provided.",
      location: {
        ...asset.location,
        hasVerifiedCoordinates: Boolean(
          asset.location?.coordinates || (asset.location?.mapPosition?.x && asset.location?.mapPosition?.y)
        ),
      },
    };

    const updated = [cleanedAsset, ...all];
    this.save(updated);
    return { success: true };
  }

  public update(asset: RegisteredAsset): { success: boolean; error?: string } {
    if (!asset.id) {
      return { success: false, error: "Asset ID is required for update." };
    }

    const all = this.getAll();
    const index = all.findIndex((item) => item.id.toLowerCase() === asset.id.toLowerCase());
    if (index === -1) {
      return { success: false, error: `Asset '${asset.id}' not found in registry.` };
    }

    all[index] = { ...asset };
    this.save(all);
    return { success: true };
  }

  public delete(id: string): boolean {
    const all = this.getAll();
    const filtered = all.filter((item) => item.id.toLowerCase() !== id.toLowerCase());
    if (filtered.length === all.length) {
      return false;
    }
    this.save(filtered);
    return true;
  }

  public resetToDefaults(): void {
    this.memoryStore = [...INITIAL_SEED_ASSETS];
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(this.key, JSON.stringify(INITIAL_SEED_ASSETS));
    }
  }

  public exportJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  public bulkAdd(newAssets: RegisteredAsset[]): { success: boolean; count: number } {
    const existing = this.getAll();
    const existingIds = new Set(existing.map((a) => a.id.toLowerCase()));
    const toAdd = newAssets.filter((a) => !existingIds.has(a.id.toLowerCase()));
    const merged = [...toAdd, ...existing];
    this.save(merged);
    return { success: true, count: toAdd.length };
  }

  public setAssets(assets: RegisteredAsset[]): void {
    this.save(assets);
  }

  public purgeTestAssets(): number {
    const all = this.getAll();
    const filtered = all.filter((a) => !a.isTestAsset && !a.id.startsWith("test-"));
    const purgedCount = all.length - filtered.length;
    if (purgedCount > 0) {
      this.save(filtered.length > 0 ? filtered : [...INITIAL_SEED_ASSETS]);
    }
    return purgedCount;
  }

  public importJson(jsonStr: string): { success: boolean; count?: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        return { success: false, error: "Imported JSON must be an array of asset records." };
      }

      // Check minimal required keys
      for (const item of parsed) {
        if (!item.id || !item.name || !item.domain) {
          return { success: false, error: `Asset record missing required attributes (id: ${item.id ?? "unknown"})` };
        }
      }

      this.save(parsed);
      return { success: true, count: parsed.length };
    } catch (e) {
      return { success: false, error: `Invalid JSON syntax: ${(e as Error).message}` };
    }
  }

  private save(assets: RegisteredAsset[]): void {
    this.memoryStore = [...assets];
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(this.key, JSON.stringify(assets));
      } catch (e) {
        console.error("Dhun Twin OS: Failed to persist asset registry to localStorage", e);
      }
    }
  }
}

export const assetRepository = new LocalAssetRepository();
