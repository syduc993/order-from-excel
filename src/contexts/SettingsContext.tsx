import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSupabaseService } from '@/services/supabase';
import { env } from '@/config/env';
import {
  type AppSettings,
  type SettingKey,
  type ApiConfig,
  SETTING_KEY_MAP,
  DEFAULT_SETTINGS,
  getActiveDepot,
} from '@/types/settings';

interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (key: SettingKey, value: any, updatedBy?: string) => Promise<void>;
  reloadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function mergeWithDefaults(dbSettings: Record<string, any>): AppSettings {
  const merged = { ...DEFAULT_SETTINGS };

  // Merge API config (use env vars as fallback for credentials)
  if (dbSettings.api_config) {
    merged.apiConfig = {
      ...merged.apiConfig,
      ...dbSettings.api_config,
    };
  }
  // Backward-compat: if DB has old format (no depotProfiles), migrate to profile
  if (!merged.apiConfig.depotProfiles || merged.apiConfig.depotProfiles.length === 0) {
    // Use env vars as fallback for old credentials
    const appId = merged.apiConfig.nhanhAppId || env.nhanh.appId;
    const bizId = merged.apiConfig.nhanhBusinessId || env.nhanh.businessId;
    const token = merged.apiConfig.nhanhAccessToken || env.nhanh.accessToken;
    merged.apiConfig.depotProfiles = [{
      id: 'kho-chinh', name: 'Kho chính', depotId: merged.apiConfig.depotId,
      nhanhAppId: appId, nhanhBusinessId: bizId, nhanhAccessToken: token,
    }];
    merged.apiConfig.activeDepotId = 'kho-chinh';
  }

  // Sync top-level fields from active profile (so all existing code still works)
  const activeDepot = getActiveDepot(merged.apiConfig);
  merged.apiConfig.depotId = activeDepot.depotId;
  merged.apiConfig.nhanhAppId = activeDepot.nhanhAppId || env.nhanh.appId;
  merged.apiConfig.nhanhBusinessId = activeDepot.nhanhBusinessId || env.nhanh.businessId;
  merged.apiConfig.nhanhAccessToken = activeDepot.nhanhAccessToken || env.nhanh.accessToken;

  if (dbSettings.order_rules) {
    merged.orderRules = { ...merged.orderRules, ...dbSettings.order_rules };
  }

  if (dbSettings.time_distribution) {
    merged.timeDistribution = { ...merged.timeDistribution, ...dbSettings.time_distribution };
  }

  if (dbSettings.excel_config) {
    merged.excelConfig = { ...merged.excelConfig, ...dbSettings.excel_config };
  }

  return merged;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseService();

  const loadSettings = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const dbSettings = await supabase.getSettings();
      const merged = mergeWithDefaults(dbSettings);
      setSettings(merged);
    } catch (error) {
      console.error('Failed to load settings, using defaults:', error);
      // Keep DEFAULT_SETTINGS as fallback
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (key: SettingKey, value: any, updatedBy?: string) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    await supabase.updateSetting(key, value, updatedBy);

    // Update local state
    const propKey = SETTING_KEY_MAP[key];
    setSettings(prev => {
      const updated = {
        ...prev,
        [propKey]: { ...prev[propKey], ...value },
      };
      // Re-sync top-level ApiConfig fields from active profile after save
      if (key === 'api_config') {
        const cfg = updated.apiConfig as ApiConfig;
        const active = getActiveDepot(cfg);
        cfg.depotId = active.depotId;
        cfg.nhanhAppId = active.nhanhAppId || env.nhanh.appId;
        cfg.nhanhBusinessId = active.nhanhBusinessId || env.nhanh.businessId;
        cfg.nhanhAccessToken = active.nhanhAccessToken || env.nhanh.accessToken;
      }
      return updated;
    });
  }, [supabase]);

  const value: SettingsContextValue = {
    settings,
    isLoading,
    updateSettings,
    reloadSettings: loadSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
