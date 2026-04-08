import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useDictionaryFields } from '../../../hooks/useDictionaryFields';

interface YearCompareModalProps {
  onClose: () => void;
  enterpriseId: string;
  enterpriseName?: string;
  currentYear: number;
}

export default function YearCompareModal({
  onClose,
  enterpriseId,
  enterpriseName,
  currentYear,
}: YearCompareModalProps) {
  const [compareYear, setCompareYear] = useState<number>(
    currentYear > 2024 ? currentYear - 1 : currentYear
  );
  const [leftData, setLeftData] = useState<Record<string, any> | null>(null);
  const [rightData, setRightData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  // 下拉字典项映射：{ [field_code]: { [item_code]: item_name } }
  const [dropdownMap, setDropdownMap] = useState<Record<string, Record<string, string>>>({});

  const { enabledFields, loading: fieldsLoading } = useDictionaryFields();

  const BASE_CODES = ['company_name', 'credit_code', 'scale_type'];
  const compareFields = enabledFields.filter(f => !BASE_CODES.includes(f.code));

  const yearOptions = Array.from(
    { length: new Date().getFullYear() - 2024 + 1 },
    (_, i) => 2024 + i
  );

  // 加载所有下拉字段的字典项，构建映射表
  useEffect(() => {
    const dropdownFields = enabledFields.filter(f => f.input_type === 'dropdown');
    if (dropdownFields.length === 0) return;

    const fetchDropdownItems = async () => {
      const codes = dropdownFields.map(f => f.code);
      const { data, error } = await supabase
        .from('dictionary_items')
        .select('field_code, code, name')
        .in('field_code', codes);
      if (error || !data) return;

      const map: Record<string, Record<string, string>> = {};
      data.forEach(item => {
        if (!map[item.field_code]) map[item.field_code] = {};
        map[item.field_code][item.code] = item.name;
      });
      setDropdownMap(map);
    };

    fetchDropdownItems();
  }, [enabledFields]);

  const loadYearData = async (year: number): Promise<Record<string, any> | null> => {
    try {
      const { data, error } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .eq('year', year)
        .maybeSingle();
      if (error) { console.error('查询年度数据失败:', error); return null; }
      return data;
    } catch { return null; }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [left, right] = await Promise.all([
        loadYearData(currentYear),
        loadYearData(compareYear),
      ]);
      setLeftData(left);
      setRightData(right);
      setLoading(false);
    };
    fetchData();
  }, [enterpriseId, currentYear, compareYear]);

  const handleYearChange = async (newYear: number) => {
    setCompareYear(newYear);
    setLoading(true);
    const data = await loadYearData(newYear);
    setRightData(data);
    setLoading(false);
  };

  const isDifferent = (code: string): boolean => {
    if (!leftData || !rightData) return false;
    return String(leftData[code] ?? '') !== String(rightData[code] ?? '');
  };

  // 格式化显示值：下拉字段转换为中文名称
  const formatValue = (val: any, fieldCode: string, inputType: string): string => {
    if (val === null || val === undefined || val === '') return '-';
    if (inputType === 'dropdown') {
      const fieldMap = dropdownMap[fieldCode];
      if (fieldMap && fieldMap[String(val)]) {
        return fieldMap[String(val)];
      }
    }
    return String(val);
  };

  const getFieldLabel = (field: { name: string; unit: string }) => {
    return field.unit ? `${field.name}（${field.unit}）` : field.name;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[900px] max-h-[85vh] flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">年度数据对比</h3>
            {enterpriseName && (
              <p className="text-sm text-gray-500 mt-0.5">{enterpriseName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 年度选择器 */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">基准年度：</span>
            <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-md text-sm font-medium">
              {currentYear} 年
            </span>
          </div>
          <i className="ri-arrow-left-right-line text-gray-400"></i>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">对比年度：</span>
            <select
              value={compareYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {yearOptions
                .filter((y) => y !== currentYear)
                .map((year) => (
                  <option key={year} value={year}>{year} 年</option>
                ))}
            </select>
          </div>
          {(loading || fieldsLoading) && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              加载中...
            </div>
          )}
        </div>

        {/* 对比内容 */}
        <div className="flex-1 overflow-y-auto">
          {loading || fieldsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-500">加载对比数据中...</span>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 w-1/3">字段名称</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-teal-700 w-1/3">
                    {currentYear} 年
                    {!leftData && (
                      <span className="ml-2 text-xs font-normal text-orange-500">（暂无数据）</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 w-1/3">
                    {compareYear} 年
                    {!rightData && (
                      <span className="ml-2 text-xs font-normal text-orange-500">（暂无数据）</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* 填报状态行 */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600 font-medium">填报状态</td>
                  <td className="px-6 py-3 text-center">
                    {leftData ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        leftData.status === '已填报' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {leftData.status}
                      </span>
                    ) : <span className="text-gray-400 text-sm">-</span>}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {rightData ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        rightData.status === '已填报' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {rightData.status}
                      </span>
                    ) : <span className="text-gray-400 text-sm">-</span>}
                  </td>
                </tr>

                {/* 动态字段对比行 */}
                {compareFields.map((field) => {
                  const hasDiff = isDifferent(field.code);
                  const leftVal = leftData
                    ? formatValue(leftData[field.code], field.code, field.input_type)
                    : '-';
                  const rightVal = rightData
                    ? formatValue(rightData[field.code], field.code, field.input_type)
                    : '-';
                  return (
                    <tr key={field.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {getFieldLabel(field)}
                      </td>
                      <td className={`px-6 py-3 text-sm text-center ${hasDiff ? 'text-red-600 font-semibold' : 'text-gray-800'}`}>
                        {leftVal}
                        {hasDiff && leftVal !== '-' && (
                          <i className="ri-arrow-up-down-line text-red-400 ml-1 text-xs"></i>
                        )}
                      </td>
                      <td className={`px-6 py-3 text-sm text-center ${hasDiff ? 'text-red-600 font-semibold' : 'text-gray-800'}`}>
                        {rightVal}
                        {hasDiff && rightVal !== '-' && (
                          <i className="ri-arrow-up-down-line text-red-400 ml-1 text-xs"></i>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {compareFields.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                      <i className="ri-inbox-line text-4xl block mb-2"></i>
                      暂无可对比的字段配置
                    </td>
                  </tr>
                )}

                {!leftData && !rightData && compareFields.length > 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                      <i className="ri-file-list-3-line text-4xl block mb-2"></i>
                      两个年度均暂无填报数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 底部说明 + 关闭 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
            红色字体表示两年度数据存在差异
            <span className="ml-3 text-gray-300">|</span>
            <span className="ml-3">对比字段随数据字典配置实时同步</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm whitespace-nowrap cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
