import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { SupabaseService } from '@/services/supabase';
import { env } from '@/config/env';
import {
  type AppSettings,
  type SettingKey,
  SETTING_KEY_MAP,
  DEFAULT_SETTINGS,
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
  // Fill in env var fallbacks for API credentials
  if (!merged.apiConfig.nhanhAppId) merged.apiConfig.nhanhAppId = env.nhanh.appId;
  if (!merged.apiConfig.nhanhBusinessId) merged.apiConfig.nhanhBusinessId = env.nhanh.businessId;
  if (!merged.apiConfig.nhanhAccessToken) merged.apiConfig.nhanhAccessToken = env.nhanh.accessToken;

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
  const [supabase] = useState<SupabaseService | null>(() => {
    if (env.supabase.url && env.supabase.anonKey) {
      return new SupabaseService({ url: env.supabase.url, key: env.supabase.anonKey });
    }
    return null;
  });

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
    setSettings(prev => ({
      ...prev,
      [propKey]: { ...prev[propKey], ...value },
    }));
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
