export interface EnterpriseYearData {
  id: string;
  enterpriseId: string;
  year: number;
  status: '已填报' | '未填报';
  data: {
    [key: string]: string | number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 模拟企业多年度数据
export const mockEnterpriseYearData: EnterpriseYearData[] = [
  {
    id: '1-2024',
    enterpriseId: '1',
    year: 2024,
    status: '已填报',
    data: {
      company_name: '济南华能电子科技有限公司',
      credit_code: '91370100MA3C1234XY',
      industry_code: 'C39',
      scale_type: 'above',
      own_land_area: 5000,
      rent_land_area: 2000,
      sales_revenue: 8500,
      industrial_output: 9200,
      industrial_added_value: 3200,
      total_profit: 1200,
      industrial_electricity: 450000,
      total_energy_consumption: 320,
      rd_expenditure: 680,
      avg_employee_count: 156
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '1-2023',
    enterpriseId: '1',
    year: 2023,
    status: '已填报',
    data: {
      company_name: '济南华能电子科技有限公司',
      credit_code: '91370100MA3C1234XY',
      industry_code: 'C39',
      scale_type: 'above',
      own_land_area: 5000,
      rent_land_area: 2000,
      sales_revenue: 8000,
      industrial_output: 8800,
      industrial_added_value: 3000,
      total_profit: 1100,
      industrial_electricity: 420000,
      total_energy_consumption: 300,
      rd_expenditure: 650,
      avg_employee_count: 150
    },
    createdAt: new Date('2023-01-20'),
    updatedAt: new Date('2023-01-20')
  }
];