export interface Enterprise {
  id: string;
  name: string;
  creditCode: string;
  scale: "规上" | "规下";
  latestYear: number;
  status: "已填报" | "未填报";
  createdAt: Date;
}

export interface FilterParams {
  name?: string;
  creditCode?: string;
  year?: number;
  scale?: "规上" | "规下";
  status?: "已填报" | "未填报";
}

export interface EnterpriseData {
  id: string;
  companyName: string;
  creditCode: string;
  scaleType: 'above' | 'below';
  latestYear: number;
  status: 'filled' | 'unfilled';
  year: number;
}

// Supabase 数据库类型定义
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
  updated_at?: string;
}

export interface EnterpriseFormData {
  // 基础信息
  company_name: string;
  credit_code: string;
  industry_code?: string;
  scale_type: 'above' | 'below';
  
  // 用地信息
  own_land_area?: number;
  rent_land_area?: number;
  lease_land_area?: number;
  own_building_area?: number;
  rent_building_area?: number;
  lease_building_area?: number;
  floor_area_ratio?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  
  // 经济能耗信息
  sales_revenue?: number;
  industrial_output?: number;
  industrial_added_value?: number;
  total_profit?: number;
  industrial_electricity?: number;
  total_energy_consumption?: number;
  pollutant_emission?: number;
  rd_expenditure?: number;
  avg_employee_count?: number;
}