import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { IndustryComparisonData } from '../../../hooks/useIndustryComparison';

interface IndustryComparisonChartProps {
  data: IndustryComparisonData[];
  loading: boolean;
  onIndustryClick: (industry: string) => void;
}

type ChartType = 'bar' | 'line';
type MetricType = 'avgScore' | 'perMuSalesRevenue' | 'perMuIndustrialOutput' | 'perMuAddedValue' | 'perMuProfit' | 'perMuRdExpenditure' | 'perMuEmployeeCount';

const METRIC_OPTIONS = [
  { value: 'avgScore', label: '综合得分', unit: '分' },
  { value: 'perMuSalesRevenue', label: '米均销售收入', unit: '万元/㎡' },
  { value: 'perMuIndustrialOutput', label: '米均工业产值', unit: '万元/㎡' },
  { value: 'perMuAddedValue', label: '米均增加值', unit: '万元/㎡' },
  { value: 'perMuProfit', label: '米均利润', unit: '万元/㎡' },
  { value: 'perMuRdExpenditure', label: '米均研发投入', unit: '万元/㎡' },
  { value: 'perMuEmployeeCount', label: '米均从业人数', unit: '人/㎡' }
];

const COLORS = ['#14B8A6', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

export const IndustryComparisonChart = ({ data, loading, onIndustryClick }: IndustryComparisonChartProps) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('avgScore');

  const currentMetricOption = METRIC_OPTIONS.find(opt => opt.value === selectedMetric);

  const chartData = data.map(item => ({
    industry: item.industry.length > 8 ? item.industry.substring(0, 8) + '...' : item.industry,
    fullIndustry: item.industry,
    value: Number(item[selectedMetric].toFixed(2)),
    enterpriseCount: item.enterpriseCount
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">{data.fullIndustry}</p>
          <p className="text-sm text-gray-600">
            {currentMetricOption?.label}: <span className="font-semibold text-teal-600">{data.value} {currentMetricOption?.unit}</span>
          </p>
          <p className="text-sm text-gray-600">
            企业数量: <span className="font-semibold">{data.enterpriseCount}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-80 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col items-center justify-center h-80 text-gray-400">
          <i className="ri-bar-chart-line text-5xl mb-3"></i>
          <p>暂无行业对比数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">行业效益对比</h3>
        
        <div className="flex items-center gap-4">
          {/* 指标切换 */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            {METRIC_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* 图表类型切换 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                chartType === 'bar'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-bar-chart-fill mr-1"></i>
              柱状图
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                chartType === 'line'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-line-chart-fill mr-1"></i>
              折线图
            </button>
          </div>
        </div>
      </div>

      {/* 图表 */}
      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'bar' ? (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="industry" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12, fill: '#666' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#666' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 184, 166, 0.1)' }} />
            <Bar 
              dataKey="value" 
              radius={[8, 8, 0, 0]}
              onClick={(data) => onIndustryClick(data.fullIndustry)}
              className="cursor-pointer"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="industry" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12, fill: '#666' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#666' }} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#14B8A6" 
              strokeWidth={3}
              dot={{ fill: '#14B8A6', r: 5, className: 'cursor-pointer' }}
              activeDot={{ r: 7, onClick: (e, payload) => onIndustryClick(payload.payload.fullIndustry) }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};