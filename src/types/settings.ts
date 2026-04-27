// Settings types and default values for all configurable business rules

export interface TimeSlotConfig {
  start: number; // Giờ bắt đầu (decimal, e.g. 8.5 = 8h30)
  end: number;   // Giờ kết thúc
  weight: number; // Trọng số (cao điểm = nhiều đơn hơn)
}

export interface DepotProfile {
  id: string;       // unique key, e.g. "kho-test"
  name: string;     // display name, e.g. "Kho test"
  depotId: number;  // NhanhVN depot ID
  nhanhAppId: string;
  nhanhBusinessId: string;
  nhanhAccessToken: string;
}

export interface ApiConfig {
  // Derived from active profile — kept so all existing code still works
  depotId: number;
  nhanhAppId: string;
  nhanhBusinessId: string;
  nhanhAccessToken: string;
  // Profile system
  activeDepotId: string;
  depotProfiles: DepotProfile[];
}

export interface OrderRulesConfig {
  minTotalAmount: number;
  maxTotalAmount: number;
  minProductsPerOrder: number;
  maxProductsPerOrder: number;
  minQuantityPerProduct: number;
  maxQuantityPerProduct: number;
  sweepMaxValue: number;
  maxConsecutiveFails: number;
  /** Số sản phẩm "thừa" cộng vào maxProductsPerOrder khi rút random — giúp đạt minTotalAmount với pool giá rẻ. */
  productCountSlack: number;
  /** Số vòng lặp tối đa khi rút sản phẩm cho 1 đơn. */
  maxGenerationLoops: number;
  /** Tỷ lệ vị trí trung bình đơn giữa min và max (dùng để ƯỚC số đơn). Lý tưởng ≈ 1/(targetAmountSkew+1). */
  avgOrderValueRatio: number;
  /** Độ lệch của phân phối targetAmount: 1 = uniform, 2.5 = log-normal-like (đa số đơn nhỏ, đuôi dài lên cao). */
  targetAmountSkew: number;
}

export interface TimeDistributionConfig {
  timeSlots: TimeSlotConfig[];
  weekendBoost: number;
  lateOrderPercent: number;
  lateOrderMinCount: number;
  lateOrderMaxCount: number;
  lateOrderTimeStart: number; // decimal hours, e.g. 22.77 = 22h46
  lateOrderTimeEnd: number;   // decimal hours, e.g. 23.5 = 23h30
}

export interface ExcelConfig {
  customerSheetName: string;
  productSheetName: string;
  templateSheetName: string;
}

export interface AppSettings {
  apiConfig: ApiConfig;
  orderRules: OrderRulesConfig;
  timeDistribution: TimeDistributionConfig;
  excelConfig: ExcelConfig;
}

// Setting keys used in Supabase app_settings table
export type SettingKey = 'api_config' | 'order_rules' | 'time_distribution' | 'excel_config';

// Map from SettingKey to AppSettings property
export const SETTING_KEY_MAP: Record<SettingKey, keyof AppSettings> = {
  api_config: 'apiConfig',
  order_rules: 'orderRules',
  time_distribution: 'timeDistribution',
  excel_config: 'excelConfig',
};

// Default values extracted from current hardcoded values in the codebase
export const DEFAULT_TIME_SLOTS: TimeSlotConfig[] = [
  { start: 8.5, end: 10, weight: 1 },     // 8h30-10h: Bình thường
  { start: 10, end: 12, weight: 3 },       // 10h-12h: CAO ĐIỂM
  { start: 12, end: 14, weight: 0.3 },     // 12h-14h: RẤT THẤP
  { start: 14, end: 16, weight: 1 },       // 14h-16h: Bình thường
  { start: 16, end: 18, weight: 3 },       // 16h-18h: CAO ĐIỂM
  { start: 18, end: 20, weight: 1 },       // 18h-20h: Bình thường
  { start: 20, end: 21.5, weight: 3 },     // 20h-21h30: CAO ĐIỂM
  { start: 21.5, end: 22.75, weight: 0.8 },// 21h30-22h45: Giảm dần
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiConfig: {
    depotId: 215639,
    nhanhAppId: '',
    nhanhBusinessId: '',
    nhanhAccessToken: '',
    activeDepotId: 'kho-chinh',
    depotProfiles: [
      { id: 'kho-chinh', name: 'Kho chính', depotId: 215639, nhanhAppId: '', nhanhBusinessId: '', nhanhAccessToken: '' },
    ],
  },
  orderRules: {
    minTotalAmount: 300000,
    maxTotalAmount: 2000000,
    minProductsPerOrder: 1,
    maxProductsPerOrder: 5,
    minQuantityPerProduct: 1,
    maxQuantityPerProduct: 3,
    sweepMaxValue: 200000,
    maxConsecutiveFails: 100,
    productCountSlack: 3,
    maxGenerationLoops: 20,
    avgOrderValueRatio: 0.286, // ≈ 1/(2.5+1), khớp với targetAmountSkew=2.5
    targetAmountSkew: 2.5,
  },
  timeDistribution: {
    timeSlots: DEFAULT_TIME_SLOTS,
    weekendBoost: 1.8,
    lateOrderPercent: 0.25,
    lateOrderMinCount: 1,
    lateOrderMaxCount: 2,
    lateOrderTimeStart: 22.77, // 22h46
    lateOrderTimeEnd: 23.5,    // 23h30
  },
  excelConfig: {
    customerSheetName: 'DSKH',
    productSheetName: 'DSSP',
    templateSheetName: 'template',
  },
};

/** Get the active depot profile (or first profile as fallback) */
export function getActiveDepot(apiConfig: ApiConfig): DepotProfile {
  const found = apiConfig.depotProfiles.find(p => p.id === apiConfig.activeDepotId);
  return found || apiConfig.depotProfiles[0] || {
    id: 'default', name: 'Mặc định', depotId: apiConfig.depotId,
    nhanhAppId: apiConfig.nhanhAppId, nhanhBusinessId: apiConfig.nhanhBusinessId, nhanhAccessToken: apiConfig.nhanhAccessToken,
  };
}
