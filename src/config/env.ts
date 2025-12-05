// Environment variables configuration
// Vite exposes env variables with VITE_ prefix

export const env = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  nhanh: {
    appId: import.meta.env.VITE_NHANH_APP_ID || '',
    businessId: import.meta.env.VITE_NHANH_BUSINESS_ID || '',
    accessToken: import.meta.env.VITE_NHANH_ACCESS_TOKEN || '',
  },
} as const;

// Validate required environment variables
export function validateEnv() {
  const missing: string[] = [];
  
  if (!env.supabase.url) missing.push('VITE_SUPABASE_URL');
  if (!env.supabase.anonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  
  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing.join(', '));
    console.warn('Please create a .env file with the required variables. See .env.example for reference.');
  }
  
  return missing.length === 0;
}

