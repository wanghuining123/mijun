import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDictionaryFields, DictionaryField } from '../../../hooks/useDictionaryFields';
import YearCompareModal from './YearCompareModal';
import { supabase } from '../../../lib/supabase';

interface FormData {
  [key: string]: string | number;
}

// 企业联想搜索结果
interface EnterpriseSuggestion {
  name: string;
  credit_code: string;
  industry_code: string;
}

// 固定的基础字段 code（企业表字段，不在 year_records 中）
const ENTERPRISE_BASE_CODES = ['company_name', 'credit_code', 'scale_type'];

// 通过接口带出的只读字段（不允许用户手动填写）
const AUTO_FILLED_CODES = ['credit_code'];

// 固定分组顺序
const GROUP_ORDER = ['基础信息', '用地信息', '经济能耗信息', '其他信息'];

// ---- 模拟企业联想接口 ----
// 后续替换为真实接口调用，接口应返回 EnterpriseSuggestion[]
const fetchEnterpriseSuggestions = async (keyword: string): Promise<EnterpriseSuggestion[]> => {
  if (!keyword.trim()) return [];
  // TODO: 替换为真实接口，例如：
  // const res = await fetch(`/api/enterprise/search?keyword=${encodeURIComponent(keyword)}`);
  // return res.json();
  await new Promise(r => setTimeout(r, 300));
  const mock: EnterpriseSuggestion[] = [
    { name: '淘数科技（北京）有限公司', credit_code: '91110000MA01ABCD12', industry_code: 'I6540' },
    { name: '淘数智能制造（上海）有限公司', credit_code: '91310000MA01EFGH34', industry_code: 'C3690' },
    { name: '淘数新能源科技有限公司', credit_code: '91330000MA01IJKL56', industry_code: 'C3825' },
    { name: '淘数生物医药（杭州）有限公司', credit_code: '91330100MA01MNOP78', industry_code: 'C2760' },
    { name: '淘数精密机械制造有限公司', credit_code: '91320000MA01QRST90', industry_code: 'C3599' },
  ].filter(e => e.name.includes(keyword.trim()));
  return mock;
};
// ---- end ----

const VALID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EnterpriseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  // 如果 id 存在但不是合法 UUID（如字面量 ":id"），立即跳回列表
  const isValidId = !id || VALID_UUID_RE.test(id);
  const isEdit = !!id && isValidId;

  // 非法 ID 时重定向
  useEffect(() => {
    if (id && !isValidId) {
      navigate('/enterprise', { replace: true });
    }
  }, [id, isValidId, navigate]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [formData, setFormData] = useState<FormData>({});
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [hasLastYearData, setHasLastYearData] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [dataLoading, setDataLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [enterpriseId, setEnterpriseId] = useState<string>('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false, message: '', type: 'success'
  });

  // 企业名称联想
  const [suggestions, setSuggestions] = useState<EnterpriseSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // 已填报年度集合（新增模式）
  const [filledYears, setFilledYears] = useState<Set<number>>(new Set());
  const [checkingName, setCheckingName] = useState(false);
  const [nameCheckTimer, setNameCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // 从数据库动态加载的下拉选项
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, { id: string; code: string; name: string }[]>>({});

  const { enabledFields, loading: fieldsLoading } = useDictionaryFields();

  // 点击外部关闭联想下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 批量拉取下拉字段字典项
  useEffect(() => {
    const dropdownCodes = enabledFields
      .filter(f => f.input_type === 'dropdown')
      .map(f => f.code);
    if (dropdownCodes.length === 0) return;

    const fetchAllDropdownItems = async () => {
      const { data, error } = await supabase
        .from('dictionary_items')
        .select('id, field_code, code, name, sort_order')
        .in('field_code', dropdownCodes)
        .order('sort_order', { ascending: true });
      if (error || !data) return;

      const grouped: Record<string, { id: string; code: string; name: string }[]> = {};
      data.forEach(item => {
        if (!grouped[item.field_code]) grouped[item.field_code] = [];
        grouped[item.field_code].push({ id: item.id, code: item.code, name: item.name });
      });
      setDropdownOptions(grouped);
    };

    fetchAllDropdownItems();
  }, [enabledFields]);

  // 按分组归类字段
  const groupedFields = GROUP_ORDER.reduce<Record<string, DictionaryField[]>>((acc, group) => {
    const groupFields = enabledFields
      .filter(f => (f.group_name || '其他信息') === group)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (groupFields.length > 0) acc[group] = groupFields;
    return acc;
  }, {});

  const yearRecordCodes = enabledFields
    .filter(f => !ENTERPRISE_BASE_CODES.includes(f.code))
    .map(f => f.code);

  useEffect(() => {
    if (isEdit && id && !fieldsLoading && enabledFields.length > 0) {
      setEnterpriseId(id);
      loadEnterpriseData(id);
    } else if (isEdit && id && !fieldsLoading && enabledFields.length === 0) {
      setDataLoading(false);
    }
  }, [id, selectedYear, fieldsLoading]);

  useEffect(() => {
    if (enterpriseId || id) {
      checkLastYearData();
    }
  }, [selectedYear, enterpriseId, id]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const loadEnterpriseData = async (eid: string) => {
    setDataLoading(true);
    try {
      const { data: enterprise, error: enterpriseError } = await supabase
        .from('enterprises')
        .select('*')
        .eq('id', eid)
        .maybeSingle();

      if (enterpriseError) throw enterpriseError;
      if (!enterprise) {
        showToast('企业不存在', 'error');
        navigate('/enterprise');
        return;
      }

      const { data: yearRecord, error: yearError } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('enterprise_id', eid)
        .eq('year', selectedYear)
        .maybeSingle();

      if (yearError) throw yearError;

      const loadedData: FormData = {
        company_name: enterprise.name,
        credit_code: enterprise.credit_code,
        scale_type: enterprise.scale === '规上' ? 'above' : 'below',
      };

      if (yearRecord) {
        yearRecordCodes.forEach(code => {
          loadedData[code] = yearRecord[code] ?? '';
        });
      }

      setFormData(loadedData);
    } catch (error) {
      console.error('加载企业数据失败:', error);
      showToast('加载数据失败，请重试', 'error');
    } finally {
      setDataLoading(false);
    }
  };

  const checkLastYearData = async () => {
    const lastYear = selectedYear - 1;
    if (lastYear < 2024) { setHasLastYearData(false); return; }
    try {
      const targetId = enterpriseId || id;
      if (!targetId) { setHasLastYearData(false); return; }
      const { data, error } = await supabase
        .from('enterprise_year_records')
        .select('status')
        .eq('enterprise_id', targetId)
        .eq('year', lastYear)
        .maybeSingle();
      if (error) throw error;
      setHasLastYearData(data?.status === '已填报');
    } catch {
      setHasLastYearData(false);
    }
  };

  const handleCopyLastYear = async () => {
    if (!hasLastYearData) { showToast('无上一年度数据可复制', 'error'); return; }
    setSaving(true);
    try {
      const lastYear = selectedYear - 1;
      const targetId = enterpriseId || id;
      const { data: lastYearRecord, error } = await supabase
        .from('enterprise_year_records')
        .select('*')
        .eq('enterprise_id', targetId)
        .eq('year', lastYear)
        .maybeSingle();
      if (error) throw error;
      if (!lastYearRecord) { showToast('无上一年度数据可复制', 'error'); return; }

      const copiedData: FormData = { ...formData };
      yearRecordCodes.forEach(code => {
        copiedData[code] = lastYearRecord[code] ?? '';
      });
      setFormData(copiedData);
      setShowCopyModal(false);
      showToast('已成功复制上一年度数据，请根据实际情况修改后提交', 'success');
    } catch {
      showToast('复制数据失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (code: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [code]: value }));
  };

  // 企业名称输入 → 触发联想搜索 + 已填报年度检查
  const handleCompanyNameChange = (value: string) => {
    handleInputChange('company_name', value);

    // 清空之前自动带出的字段（用户重新输入时重置）
    if (!isEdit) {
      setFormData(prev => ({ ...prev, company_name: value, credit_code: '' }));
    }

    // 联想搜索防抖
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestionLoading(true);
    suggestionTimer.current = setTimeout(async () => {
      const results = await fetchEnterpriseSuggestions(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSuggestionLoading(false);
    }, 350);

    // 已填报年度检查防抖（新增模式）
    if (!isEdit) {
      if (nameCheckTimer) clearTimeout(nameCheckTimer);
      const timer = setTimeout(() => {
        checkFilledYearsByName(value);
      }, 600);
      setNameCheckTimer(timer);
    }
  };

  // 选中联想项 → 自动带出信用代码
  const handleSelectSuggestion = (suggestion: EnterpriseSuggestion) => {
    setFormData(prev => ({
      ...prev,
      company_name: suggestion.name,
      credit_code: suggestion.credit_code,
    }));
    setShowSuggestions(false);
    setSuggestions([]);

    // 检查已填报年度
    if (!isEdit) {
      checkFilledYearsByName(suggestion.name);
    }
  };

  const checkFilledYearsByName = async (name: string) => {
    if (!name.trim()) { setFilledYears(new Set()); return; }
    setCheckingName(true);
    try {
      const { data: enterprise, error } = await supabase
        .from('enterprises')
        .select('id')
        .eq('name', name.trim())
        .maybeSingle();

      if (error || !enterprise) { setFilledYears(new Set()); return; }

      const { data: records, error: recordsError } = await supabase
        .from('enterprise_year_records')
        .select('year, status')
        .eq('enterprise_id', enterprise.id)
        .eq('status', '已填报');

      if (recordsError) { setFilledYears(new Set()); return; }

      const years = new Set<number>((records || []).map(r => r.year));
      setFilledYears(years);

      if (years.has(selectedYear)) {
        const firstAvailable = yearOptions.find(y => !years.has(y));
        if (firstAvailable) setSelectedYear(firstAvailable);
      }
    } catch {
      setFilledYears(new Set());
    } finally {
      setCheckingName(false);
    }
  };

  const validateCreditCode = (code: string): boolean => /^[0-9A-Z]{18}$/.test(code);

  const checkCreditCodeUnique = async (creditCode: string, excludeId?: string): Promise<boolean> => {
    let query = supabase.from('enterprises').select('id').eq('credit_code', creditCode);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query;
    if (error) throw new Error(`信用代码查重失败：${error.message}`);
    return !data || data.length === 0;
  };

  const handleSubmit = async () => {
    const requiredFields = enabledFields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => {
      // 自动带出字段不强制要求（接口可能未返回）
      if (AUTO_FILLED_CODES.includes(f.code)) return false;
      const val = formData[f.code];
      return val === undefined || val === null || val === '';
    });
    if (missingFields.length > 0) {
      showToast(`请填写必填字段：${missingFields.map(f => f.name).join('、')}`, 'error');
      return;
    }

    const creditCode = formData.credit_code as string;
    if (!creditCode || creditCode.trim() === '') {
      showToast('请先通过企业名称联想选择企业，系统将自动带出统一社会信用代码', 'error');
      return;
    }
    if (!validateCreditCode(creditCode.trim())) {
      showToast('统一社会信用代码格式错误，必须为18位数字和大写字母', 'error');
      return;
    }

    setSaving(true);
    try {
      const isUnique = await checkCreditCodeUnique(creditCode.trim(), isEdit ? id : undefined);
      if (!isUnique) {
        showToast('该统一社会信用代码已存在，请检查', 'error');
        return;
      }

      if (isEdit && id) {
        await updateEnterprise(id);
      } else {
        await createEnterprise();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('保存失败:', msg);
      showToast(`保存失败：${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const buildYearRecordData = () => {
    const data: Record<string, string | number | null> = {};
    yearRecordCodes.forEach(code => {
      const field = enabledFields.find(f => f.code === code);
      if (!field) return;
      const val = formData[code];
      if (field.input_type === 'number') {
        data[code] = val !== '' && val !== undefined ? Number(val) : null;
      } else {
        data[code] = (val as string) || null;
      }
    });
    return data;
  };

  const createEnterprise = async () => {
    const { data: newEnterprise, error: enterpriseError } = await supabase
      .from('enterprises')
      .insert({
        name: formData.company_name as string,
        credit_code: (formData.credit_code as string).trim(),
        scale: formData.scale_type === 'above' ? '规上' : '规下',
      })
      .select()
      .single();
    if (enterpriseError) throw new Error(`新增企业失败：${enterpriseError.message}`);

    const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);
    const yearRecords = years.map(year => ({
      enterprise_id: newEnterprise.id,
      year,
      status: year === selectedYear ? '已填报' : '未填报',
      ...(year === selectedYear ? buildYearRecordData() : {}),
    }));

    const { error: recordsError } = await supabase.from('enterprise_year_records').insert(yearRecords);
    if (recordsError) throw new Error(`保存年度数据失败：${recordsError.message}`);

    showToast('新增成功！已自动为所有年份生成数据状态', 'success');
    setTimeout(() => navigate('/enterprise'), 1500);
  };

  const updateEnterprise = async (eid: string) => {
    const { error: enterpriseError } = await supabase
      .from('enterprises')
      .update({
        name: formData.company_name as string,
        credit_code: (formData.credit_code as string).trim(),
        scale: formData.scale_type === 'above' ? '规上' : '规下',
      })
      .eq('id', eid);
    if (enterpriseError) throw new Error(`更新企业信息失败：${enterpriseError.message}`);

    const { data: existingRecord, error: queryError } = await supabase
      .from('enterprise_year_records')
      .select('*')
      .eq('enterprise_id', eid)
      .eq('year', selectedYear)
      .maybeSingle();
    if (queryError) throw new Error(`查询年度记录失败：${queryError.message}`);

    if (existingRecord && existingRecord.status === '已填报') {
      const { error: historyError } = await supabase.from('enterprise_data_history').insert({
        enterprise_id: eid,
        year: selectedYear,
        data: existingRecord,
        modified_by: '管理员',
      });
      if (historyError) {
        console.warn('写入历史记录失败（不影响保存）:', historyError.message);
      }
    }

    const yearRecordData = { ...buildYearRecordData(), status: '已填报', updated_at: new Date().toISOString() };

    if (existingRecord) {
      const { error: updateError } = await supabase
        .from('enterprise_year_records')
        .update(yearRecordData)
        .eq('enterprise_id', eid)
        .eq('year', selectedYear);
      if (updateError) throw new Error(`更新年度数据失败：${updateError.message}`);
    } else {
      const { error: insertError } = await supabase
        .from('enterprise_year_records')
        .insert({ enterprise_id: eid, year: selectedYear, ...yearRecordData });
      if (insertError) throw new Error(`新增年度数据失败：${insertError.message}`);

      const allYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);
      const { data: existingRecords } = await supabase
        .from('enterprise_year_records')
        .select('year')
        .eq('enterprise_id', eid);
      if (existingRecords) {
        const existingYears = new Set(existingRecords.map(r => r.year));
        const missingYears = allYears.filter(y => !existingYears.has(y));
        if (missingYears.length > 0) {
          await supabase.from('enterprise_year_records').insert(
            missingYears.map(year => ({ enterprise_id: eid, year, status: '未填报' }))
          );
        }
      }
    }

    showToast('修改成功！数据已保存', 'success');
    setTimeout(() => navigate('/enterprise'), 1500);
  };

  // 渲染只读带出字段
  const renderReadonlyAutoField = (field: DictionaryField) => {
    const value = formData[field.code] ?? '';
    return (
      <div className="relative">
        <input
          type="text"
          value={value as string}
          readOnly
          placeholder="将由企业名称联想自动带出"
          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed select-none"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
          <i className="ri-link text-gray-300 text-xs"></i>
        </div>
      </div>
    );
  };

  const renderField = (field: DictionaryField) => {
    // 自动带出的只读字段（新增模式）
    if (!isEdit && AUTO_FILLED_CODES.includes(field.code)) {
      return renderReadonlyAutoField(field);
    }

    const value = formData[field.code] ?? '';
    const borderClass = field.required ? 'border-red-300 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500';
    const baseClass = `w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${borderClass}`;

    // 企业名称：联想输入框
    if (field.code === 'company_name' && !isEdit) {
      return (
        <div className="relative" ref={suggestionRef}>
          <div className="relative">
            <input
              type="text"
              value={value as string}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={field.placeholder || '请输入企业名称进行搜索'}
              className={baseClass}
              autoComplete="off"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
              {suggestionLoading || checkingName ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              ) : (
                <i className="ri-search-line text-gray-400 text-sm"></i>
              )}
            </div>
          </div>

          {/* 联想下拉列表 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                >
                  <div className="text-sm font-medium text-gray-800">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
                    <span><i className="ri-barcode-line mr-1"></i>{s.credit_code}</span>
                    <span><i className="ri-building-line mr-1"></i>{s.industry_code}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!suggestionLoading && !checkingName && filledYears.size > 0 && (
            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
              <i className="ri-information-line"></i>
              该企业已在 {Array.from(filledYears).sort().join('、')} 年度填报过数据，对应年度不可重复选择
            </p>
          )}
        </div>
      );
    }

    switch (field.input_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.code, e.target.value)}
            placeholder={field.placeholder}
            className={baseClass}
          />
        );
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) handleInputChange(field.code, val);
              }}
              placeholder={field.placeholder}
              className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${borderClass}`}
            />
            {field.unit && <span className="text-sm text-gray-500 whitespace-nowrap">{field.unit}</span>}
          </div>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.code, e.target.value)}
            className={baseClass}
          />
        );
      case 'dropdown': {
        const options = dropdownOptions[field.code] || [];
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.code, e.target.value)}
            className={`${baseClass} cursor-pointer`}
          >
            <option value="">{field.placeholder || `请选择${field.name}`}</option>
            {options.map((option) => (
              <option key={option.id} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        );
      }
      default:
        return null;
    }
  };

  const isPageLoading = fieldsLoading || dataLoading;

  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">
            {isEdit ? '编辑企业数据' : '新增企业数据'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            请填写企业相关数据信息，标记 <span className="text-red-500">*</span> 的为必填项
          </p>
        </div>

        {isPageLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 mt-4">加载中...</p>
          </div>
        ) : (
          <>
            {/* 年度选择器 */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">
                    填报年度 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {yearOptions.map(year => {
                      const isFilled = !isEdit && filledYears.has(year);
                      const isSelected = selectedYear === year;
                      return (
                        <button
                          key={year}
                          type="button"
                          disabled={isFilled || saving}
                          onClick={() => !isFilled && !saving && setSelectedYear(year)}
                          title={isFilled ? `${year}年度已填报，不可重复选择` : `选择${year}年度`}
                          className={[
                            'px-4 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap',
                            isSelected && !isFilled
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : isFilled
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600 cursor-pointer',
                          ].join(' ')}
                        >
                          {isFilled && <i className="ri-lock-line mr-1 text-xs"></i>}
                          {year}年
                          {isFilled && <span className="ml-1 text-xs">(已填报)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isEdit && (
                    <button
                      onClick={() => setShowCompareModal(true)}
                      disabled={saving}
                      className="px-4 py-2 text-sm text-indigo-600 border border-indigo-400 rounded-md hover:bg-indigo-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <i className="ri-contrast-2-line mr-1"></i>对比年度
                    </button>
                  )}
                  <button
                    onClick={() => setShowCopyModal(true)}
                    disabled={saving || !hasLastYearData}
                    className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="ri-file-copy-line mr-1"></i>一键复制上一年度数据
                  </button>
                </div>
              </div>
            </div>

            {/* 动态分组渲染字段 */}
            {Object.entries(groupedFields).map(([groupName, fields]) => (
              <div key={groupName} className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4 pb-3 border-b flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full inline-block"></span>
                  {groupName}
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  {fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {field.name}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                        {!isEdit && AUTO_FILLED_CODES.includes(field.code) && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">（自动带出）</span>
                        )}
                      </label>
                      {renderField(field)}
                      {field.placeholder && field.input_type !== 'dropdown' && field.code !== 'company_name' && !AUTO_FILLED_CODES.includes(field.code) && (
                        <p className="text-xs text-gray-400 mt-1">{field.placeholder}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 底部操作按钮 */}
            <div className="flex justify-center gap-4 py-6">
              <button
                onClick={() => navigate('/enterprise')}
                disabled={saving}
                className="px-8 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-8 py-2.5 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                保存
              </button>
            </div>
          </>
        )}
      </div>

      {/* Toast 提示 */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 text-white ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-xl`}></i>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* 复制上一年度确认弹窗 */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">确认复制</h3>
              <button onClick={() => setShowCopyModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              确认要复制 {selectedYear - 1} 年度的数据吗？复制后可根据实际情况修改。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCopyLastYear}
                disabled={saving}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                确认复制
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 年度对比弹窗 */}
      {showCompareModal && (enterpriseId || id) && (
        <YearCompareModal
          enterpriseId={enterpriseId || id!}
          currentYear={selectedYear}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </div>
  );
}
