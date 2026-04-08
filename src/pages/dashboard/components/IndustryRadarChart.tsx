import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { IndustryComparisonData } from '../../../hooks/useIndustryComparison';

interface IndustryRadarChartProps {
  industries: [IndustryComparisonData, IndustryComparisonData];
  onClose: () => void;
}

const METRICS = [
  { key: 'perMuSalesRevenue', label: '米均销售收入', unit: '万元/㎡' },
  { key: 'perMuIndustrialOutput', label: '米均工业产值', unit: '万元/㎡' },
  { key: 'perMuAddedValue', label: '米均增加值', unit: '万元/㎡' },
  { key: 'perMuProfit', label: '米均利润', unit: '万元/㎡' },
  { key: 'perMuRdExpenditure', label: '米均研发投入', unit: '万元/㎡' },
  { key: 'perMuEmployeeCount', label: '米均从业人数', unit: '人/㎡' },
];

const COLOR_A = '#0d9488';
const COLOR_B = '#f59e0b';

export const IndustryRadarChart = ({ industries, onClose }: IndustryRadarChartProps) => {
  const [indA, indB] = industries;

  // 对每个维度归一化到 0-100，以两者最大值为基准
  const radarData = METRICS.map(({ key, label, unit }) => {
    const valA = (indA as any)[key] as number ?? 0;
    const valB = (indB as any)[key] as number ?? 0;
    const maxVal = Math.max(valA, valB, 0.0001);
    return {
      subject: label,
      unit,
      rawA: valA,
      rawB: valB,
      A: parseFloat(((valA / maxVal) * 100).toFixed(1)),
      B: parseFloat(((valB / maxVal) * 100).toFixed(1)),
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = radarData.find(d => d.subject === payload[0]?.payload?.subject);
    if (!item) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800 mb-2">{item.subject}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLOR_A }}></span>
            <span className="text-gray-600">{indA.industry}：</span>
            <span className="font-medium text-gray-900">{item.rawA.toFixed(2)} {item.unit}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLOR_B }}></span>
            <span className="text-gray-600">{indB.industry}：</span>
            <span className="font-medium text-gray-900">{item.rawB.toFixed(2)} {item.unit}</span>
          </div>
        </div>
      </div>
    );
  };

  // 综合得分差异
  const scoreDiff = indA.avgScore - indB.avgScore;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <i className="ri-radar-line text-teal-600"></i>
              行业对比雷达图
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">各维度数值已归一化，悬停可查看原始数值</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-full hover:bg-gray-100"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* 综合得分卡片 */}
          <div className="px-6 pt-5 pb-3">
            <p className="text-xs text-gray-500 text-center mb-3 font-medium tracking-wide uppercase">综合得分对比</p>
            <div className="grid grid-cols-2 gap-4">
              {/* 行业 A */}
              <div className="rounded-xl border-2 p-4 flex flex-col items-center gap-1" style={{ borderColor: COLOR_A, background: '#f0fdfa' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLOR_A }}></span>
                  <span className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{indA.industry}</span>
                </div>
                <span className="text-3xl font-bold" style={{ color: COLOR_A }}>{indA.avgScore.toFixed(2)}</span>
                <span className="text-xs text-gray-500">综合得分（分）</span>
                <span className="text-xs text-gray-400 mt-0.5">{indA.enterpriseCount} 家企业</span>
                {scoreDiff > 0 && (
                  <span className="mt-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    领先 +{scoreDiff.toFixed(2)} 分
                  </span>
                )}
              </div>
              {/* 行业 B */}
              <div className="rounded-xl border-2 p-4 flex flex-col items-center gap-1" style={{ borderColor: COLOR_B, background: '#fffbeb' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLOR_B }}></span>
                  <span className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{indB.industry}</span>
                </div>
                <span className="text-3xl font-bold" style={{ color: COLOR_B }}>{indB.avgScore.toFixed(2)}</span>
                <span className="text-xs text-gray-500">综合得分（分）</span>
                <span className="text-xs text-gray-400 mt-0.5">{indB.enterpriseCount} 家企业</span>
                {scoreDiff < 0 && (
                  <span className="mt-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    领先 +{Math.abs(scoreDiff).toFixed(2)} 分
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 雷达图 */}
          <div className="px-6 pb-2" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 10, right: 50, bottom: 10, left: 50 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickCount={5}
                />
                <Radar
                  name={indA.industry}
                  dataKey="A"
                  stroke={COLOR_A}
                  fill={COLOR_A}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ r: 4, fill: COLOR_A, strokeWidth: 0 }}
                />
                <Radar
                  name={indB.industry}
                  dataKey="B"
                  stroke={COLOR_B}
                  fill={COLOR_B}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ r: 4, fill: COLOR_B, strokeWidth: 0 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ display: 'none' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 数据明细表 */}
          <div className="px-6 pb-6">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-gray-600 font-semibold">指标</th>
                    <th className="px-4 py-2.5 text-right font-semibold" style={{ color: COLOR_A }}>{indA.industry}</th>
                    <th className="px-4 py-2.5 text-right font-semibold" style={{ color: COLOR_B }}>{indB.industry}</th>
                    <th className="px-4 py-2.5 text-right text-gray-600 font-semibold">差异</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {radarData.map((row) => {
                    const diff = row.rawA - row.rawB;
                    const diffPct = row.rawB !== 0 ? (diff / Math.abs(row.rawB)) * 100 : 0;
                    return (
                      <tr key={row.subject} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-700">
                          {row.subject}
                          <span className="text-xs text-gray-400 ml-1">({row.unit})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium" style={{ color: COLOR_A }}>
                          {row.rawA.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium" style={{ color: COLOR_B }}>
                          {row.rawB.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">差异 = 对比1 相对 对比2 的百分比变化</p>
          </div>
        </div>
      </div>
    </div>
  );
};
