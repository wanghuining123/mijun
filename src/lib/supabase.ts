import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库类型定义
export interface Enterprise {
  id: string;
  name: string;
  credit_code: string;
  scale: '规上' | '规下';
  created_at: string;
}

export interface EnterpriseYearRecord {
  id: string;
  enterprise_id: string;
  year: number;
  status: '已填报' | '未填报';
  industry_code?: string;
  own_land_area?: number;
  rent_land_area?: number;
  lease_land_area?: number;
  own_building_area?: number;
  rent_building_area?: number;
  lease_building_area?: number;
  floor_area_ratio?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  sales_revenue?: number;
  industrial_output?: number;
  industrial_added_value?: number;
  total_profit?: number;
  industrial_electricity?: number;
  total_energy_consumption?: number;
  pollutant_emission?: number;
  rd_expenditure?: number;
  avg_employee_count?: number;
  updated_at: string;
}

export interface EnterpriseWithYearData extends Enterprise {
  year_record?: EnterpriseYearRecord;
}