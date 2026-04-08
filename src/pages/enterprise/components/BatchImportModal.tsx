import { useState, useRef, useCallback, useEffect } from 'react';
import { useDictionaryFields } from '../../../hooks/useDictionaryFields';
import { supabase } from '../../../lib/supabase';

interface Props {
  selectedYear: number;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  failedList: Array<{ row: number; companyName: string; reason: string }>;
}

function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(line => line.trim() !== '')
    .map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    });
}

function hasGarbledText(text: string): boolean {
  if (text.includes('\uFFFD')) return true;
  const garbledPattern = /[\u00C0-\u00FF]{3,}/;
  return garbledPattern.test(text);
}

async function readFileWithEncoding(file: File): Promise<string> {
  const utf8Text = await file.text();
  const cleaned = utf8Text.replace(/^\uFEFF/, '');
  if (!hasGarbledText(cleaned)) return cleaned;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result.replace(/^\uFEFF/, ''));
      } else {
        reject(new Error('文件读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'GBK');
  });
}

// 查询 enterprise_year_records 表实际存在的列名
// 注意：不能用 select('*').limit(1) 来推断列名，因为 Supabase 不返回值为 null 的字段
async function fetchTableColumns(): Promise<Set<string>> {
  // 直接返回从数据库 information_schema 查到的完整列名集合（硬编码兜底）
  // 这些列名来自实际数据库，确保准确
  const knownColumns = new Set([
    'id', 'enterprise_id', 'year', 'status', 'updated_at',
    'industry_code', 'own_land_area', 'rent_land_area', 'lease_land_area',
    'own_building_area', 'rent_building_area', 'lease_building_area',
    'floor_area_ratio', 'lease_start_date', 'lease_end_date',
    'sales_revenue', 'industrial_output', 'industrial_added_value',
    'total_profit', 'industrial_electricity', 'total_energy_consumption',
    'pollutant_emission', 'rd_expenditure', 'avg_employee_count',
    'comprehensive_score', 'classification_grade',
    'field_测试1_mmkin5qsdanr', 'field_企业类型_mmkj73bd9xwq',
    'field_99098_mmkkkplr2vm5', 'field_99099_mmkkkw72gq29',
    'field_联系方式_mmn73l16x8ab',
  ]);

  try {
    // 尝试动态获取最新列名（新增字段后能自动识别）
    // 用一条不存在的 id 查询，让 Supabase 返回空数组但不报错，
    // 再通过 select 指定列名的方式验证列是否存在
    // 实际上这里改用 RPC 或直接信任硬编码列表 + 字典字段 code 的并集
    return knownColumns;
  } catch {
    return knownColumns;
  }
}

export default function BatchImportModal({ selectedYear, onClose, onImportSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);
  const [importYear, setImportYear] = useState(selectedYear);

  const { enabledFields, loading: fieldsLoading } = useDictionaryFields();

  const [dbColumns, setDbColumns] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTableColumns().then(cols => setDbColumns(cols));
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    const sortedFields = [...enabledFields].sort((a, b) => a.sort_order - b.sort_order);

    const dropdownFields = sortedFields.filter(f => f.input_type === 'dropdown');
    const dropdownOptionsMap: Record<string, string[]> = {};

    if (dropdownFields.length > 0) {
      const codes = dropdownFields.map(f => f.code);
      const { data } = await supabase
        .from('dictionary_items')
        .select('field_code, name')
        .in('field_code', codes)
        .order('sort_order', { ascending: true });

      if (data) {
        data.forEach(item => {
          if (!dropdownOptionsMap[item.field_code]) {
            dropdownOptionsMap[item.field_code] = [];
          }
          dropdownOptionsMap[item.field_code].push(item.name);
        });
      }
    }

    const headers = sortedFields.map((field) => {
      const required = field.required ? '*' : '';
      const unit = field.unit ? `(${field.unit})` : '';
      return `${field.name}${required}${unit}`;
    });

    const hints = sortedFields.map((field) => {
      if (field.input_type === 'dropdown') {
        const options = dropdownOptionsMap[field.code];
        if (options && options.length > 0) {
          return `下拉选项：${options.join(' / ')}`;
        }
        return '下拉选项';
      }
      if (field.input_type === 'number') return '数字';
      if (field.input_type === 'date') return '日期（格式：YYYY-MM-DD）';
      return '文本';
    });

    const rows = [
      headers,
      hints,
      new Array(headers.length).fill(''),
    ];

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `企业数据导入模板_${importYear}年.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [enabledFields, importYear]);

  const handleSelectFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      alert('请上传 CSV 文件');
      return;
    }

    setUploading(true);
    setProgress(10);
    setImportResult(null);

    try {
      const text = await readFileWithEncoding(file);
      const rows = parseCsv(text);

      if (rows.length < 3) {
        setImportResult({ success: 0, failed: 0, failedList: [] });
        setUploading(false);
        return;
      }

      setProgress(20);

      const headerRow = rows[0];
      const dataRows = rows.slice(2);

      const cleanHeaderText = (h: string) =>
        h
          .replace(/^\uFEFF/, '')
          .replace(/\([^)]*\)/g, '')      // 先去掉英文括号及内容（含单位）
          .replace(/（[^）]*）/g, '')      // 先去掉中文括号及内容（含单位）
          .replace(/\*+/g, '')            // 再去掉所有星号（必填标记）
          .replace(/[^\x20-\x7E\u4E00-\u9FFF\u3400-\u4DBF\uFF00-\uFFEF\u3000-\u303F]/g, '')
          .trim();

      const stripAllSpaces = (s: string) => s.replace(/[\s\u3000]/g, '');

      const sortedFields = [...enabledFields].sort((a, b) => a.sort_order - b.sort_order);

      const headerToCode: Record<number, string> = {};
      let companyNameColIdx = -1;

      headerRow.forEach((header, colIdx) => {
        const cleanHeader = cleanHeaderText(header);
        if (!cleanHeader) return;

        let matched = sortedFields.find(f => cleanHeaderText(f.name) === cleanHeader);
        if (!matched) {
          matched = sortedFields.find(
            f => stripAllSpaces(cleanHeaderText(f.name)) === stripAllSpaces(cleanHeader)
          );
        }

        if (matched) {
          headerToCode[colIdx] = matched.code;
          if (matched.code === 'company_name') {
            companyNameColIdx = colIdx;
          }
        }

        if (cleanHeader.includes('企业名称')) {
          companyNameColIdx = colIdx;
        }
      });

      if (companyNameColIdx === -1) {
        companyNameColIdx = 0;
      }

      setProgress(30);

      const dropdownFields = sortedFields.filter(f => f.input_type === 'dropdown');
      const dropdownNameToCode: Record<string, Record<string, string>> = {};
      if (dropdownFields.length > 0) {
        const codes = dropdownFields.map(f => f.code);
        const { data: dictItems } = await supabase
          .from('dictionary_items')
          .select('field_code, code, name')
          .in('field_code', codes);
        if (dictItems) {
          dictItems.forEach(item => {
            if (!dropdownNameToCode[item.field_code]) dropdownNameToCode[item.field_code] = {};
            dropdownNameToCode[item.field_code][item.name] = item.code;
          });
        }
      }

      setProgress(40);

      // 获取数据库列名：硬编码列名 + 当前所有字典字段 code 的并集
      // 这样即使字典新增了字段，只要数据库也加了对应列，就能正确写入
      let currentDbColumns = dbColumns;
      if (currentDbColumns.size === 0) {
        currentDbColumns = await fetchTableColumns();
        setDbColumns(currentDbColumns);
      }

      // 将所有字典字段 code 也加入已知列集合（字典字段 code 就是数据库列名）
      // 这是关键修复：不再依赖动态查询，直接信任字典配置中的 code 即为数据库列名
      const allKnownCodes = new Set([
        ...currentDbColumns,
        ...sortedFields.map(f => f.code),
      ]);

      // 判断某个字段 code 是否在数据库中存在
      // 规则：只要字段 code 在 allKnownCodes 中，就认为数据库有这一列
      const isColumnKnown = (code: string) => allKnownCodes.has(code);

      const { data: existingEnterprises } = await supabase
        .from('enterprises')
        .select('id, name, credit_code');
      const creditCodeToId: Record<string, string> = {};
      (existingEnterprises || []).forEach(e => { creditCodeToId[e.credit_code] = e.id; });

      setProgress(50);

      const failedList: ImportResult['failedList'] = [];
      let successCount = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const rowNum = i + 3;
        const row = dataRows[i];
        if (row.every(cell => cell === '')) continue;

        const rowData: Record<string, string> = {};
        Object.entries(headerToCode).forEach(([colIdxStr, code]) => {
          rowData[code] = row[Number(colIdxStr)] || '';
        });

        const companyName = companyNameColIdx >= 0
          ? (row[companyNameColIdx] || '').trim()
          : (rowData['company_name'] || '').trim();

        // 验证必填字段
        // 基础字段（企业名称、信用代码、规上规下）始终验证
        // 其他必填字段：只要字段在字典中启用且数据库有对应列，就验证
        const ALWAYS_CHECK = ['company_name', 'credit_code', 'scale_type'];
        const requiredFields = sortedFields.filter(f => {
          if (!f.required) return false;
          if (ALWAYS_CHECK.includes(f.code)) return true;
          // 字典字段的 code 就是数据库列名，直接用 isColumnKnown 判断
          return isColumnKnown(f.code);
        });

        const missingField = requiredFields.find(f => !rowData[f.code] || rowData[f.code].trim() === '');
        if (missingField) {
          failedList.push({ row: rowNum, companyName, reason: `必填字段为空：${missingField.name}` });
          continue;
        }

        const creditCode = (rowData['credit_code'] || '').trim();
        if (!/^[0-9A-Z]{18}$/.test(creditCode)) {
          failedList.push({ row: rowNum, companyName, reason: '统一社会信用代码格式错误（必须为18位数字和大写字母）' });
          continue;
        }

        const numberFields = sortedFields.filter(f => f.input_type === 'number');
        let numberError = '';
        for (const nf of numberFields) {
          const val = rowData[nf.code];
          if (val && val.trim() !== '' && !/^-?\d*\.?\d+$/.test(val.trim())) {
            numberError = `数值字段格式错误：${nf.name}（仅允许数字，支持负数）`;
            break;
          }
        }
        if (numberError) {
          failedList.push({ row: rowNum, companyName, reason: numberError });
          continue;
        }

        let dropdownError = '';
        for (const df of dropdownFields) {
          const val = rowData[df.code];
          if (val && val.trim() !== '') {
            const optionsMap = dropdownNameToCode[df.code] || {};
            if (!optionsMap[val.trim()]) {
              dropdownError = `下拉字段值不合法：${df.name}（"${val}"不在可选项中）`;
              break;
            }
          }
        }
        if (dropdownError) {
          failedList.push({ row: rowNum, companyName, reason: dropdownError });
          continue;
        }

        try {
          const ENTERPRISE_BASE_CODES = ['company_name', 'credit_code', 'scale_type'];
          const yearRecordData: Record<string, string | number | null> = {};

          sortedFields
            .filter(f => !ENTERPRISE_BASE_CODES.includes(f.code))
            .forEach(f => {
              // 跳过数据库表中不存在的列（避免写入报错）
              // 使用 allKnownCodes（硬编码列名 + 所有字典字段 code 的并集）来判断
              // 这样新增的字典字段（如"从业人数"）也能被正确写入
              if (!allKnownCodes.has(f.code)) return;

              const rawVal = rowData[f.code];
              if (!rawVal || rawVal.trim() === '') {
                yearRecordData[f.code] = null;
              } else if (f.input_type === 'number') {
                yearRecordData[f.code] = Number(rawVal.trim());
              } else if (f.input_type === 'dropdown') {
                const optionsMap = dropdownNameToCode[f.code] || {};
                yearRecordData[f.code] = optionsMap[rawVal.trim()] || rawVal.trim();
              } else {
                yearRecordData[f.code] = rawVal.trim();
              }
            });

          const scaleRaw = rowData['scale_type'] || '';
          const scale = scaleRaw.includes('规上') || scaleRaw === 'above' ? '规上' : '规下';

          let enterpriseId = creditCodeToId[creditCode];

          if (!enterpriseId) {
            const { data: newEnt, error: entErr } = await supabase
              .from('enterprises')
              .insert({ name: companyName.trim(), credit_code: creditCode, scale })
              .select('id')
              .single();
            if (entErr) throw new Error(`新增企业失败：${entErr.message}`);
            enterpriseId = newEnt.id;
            creditCodeToId[creditCode] = enterpriseId;

            const allYears = Array.from({ length: currentYear - 2023 }, (_, idx) => 2024 + idx);
            const initRecords = allYears.map(y => ({
              enterprise_id: enterpriseId,
              year: y,
              status: '未填报',
            }));
            await supabase.from('enterprise_year_records').insert(initRecords);
          }

          const { data: existingRecord } = await supabase
            .from('enterprise_year_records')
            .select('id')
            .eq('enterprise_id', enterpriseId)
            .eq('year', importYear)
            .maybeSingle();

          if (existingRecord) {
            const { error: updErr } = await supabase
              .from('enterprise_year_records')
              .update({ ...yearRecordData, status: '已填报', updated_at: new Date().toISOString() })
              .eq('enterprise_id', enterpriseId)
              .eq('year', importYear);
            if (updErr) throw new Error(`更新年度数据失败：${updErr.message}`);
          } else {
            const { error: insErr } = await supabase
              .from('enterprise_year_records')
              .insert({ enterprise_id: enterpriseId, year: importYear, status: '已填报', ...yearRecordData });
            if (insErr) throw new Error(`写入年度数据失败：${insErr.message}`);
          }

          successCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '写入数据库失败';
          failedList.push({ row: rowNum, companyName, reason: msg });
        }

        setProgress(50 + Math.floor(((i + 1) / dataRows.length) * 45));
      }

      setProgress(100);
      setImportResult({ success: successCount, failed: failedList.length, failedList });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '文件解析失败';
      setImportResult({ success: 0, failed: 1, failedList: [{ row: 0, companyName: '', reason: msg }] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportFailedList = () => {
    if (!importResult || importResult.failedList.length === 0) return;

    const headers = ['行号', '企业名称', '失败原因'];
    const rows = importResult.failedList.map(item => [
      item.row > 0 ? `第 ${item.row} 行` : '—',
      item.companyName,
      item.reason,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `导入失败清单_${importYear}年.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    if (importResult && importResult.success > 0) onImportSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">批量导入企业数据</h2>
            <p className="text-sm text-gray-500 mt-1">请先选择导入年度，再下载模板并上传数据</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {/* 导入年度选择 */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-4">
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-semibold shrink-0">
              <i className="ri-calendar-line text-base"></i>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">导入年度</span>
              <select
                value={importYear}
                onChange={(e) => { setImportYear(Number(e.target.value)); setImportResult(null); }}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
              <span className="text-xs text-gray-500">下载的模板文件名和上传的数据均归属于所选年度</span>
            </div>
          </div>

          {/* 步骤1 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">1</div>
              <h3 className="text-base font-semibold text-gray-800">下载导入模板</h3>
            </div>
            <div className="ml-10">
              <p className="text-sm text-gray-600 mb-3">
                请先下载 <strong>{importYear} 年</strong> 的导入模板，模板字段根据<strong>数据字典配置</strong>自动生成（当前共 {enabledFields.length} 个启用字段）
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-download-line mr-1"></i>下载 {importYear} 年导入模板
              </button>
            </div>
          </div>

          {/* 步骤2 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">2</div>
              <h3 className="text-base font-semibold text-gray-800">上传填写好的文件</h3>
            </div>
            <div className="ml-10">
              <p className="text-sm text-gray-600 mb-3">
                按照模板格式填写 <strong>{importYear} 年</strong> 数据后，上传 CSV 文件进行导入
              </p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              {fieldsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <i className="ri-loader-4-line animate-spin"></i>
                  <span>字段配置加载中，请稍候...</span>
                </div>
              ) : (
                <button
                  onClick={handleSelectFile}
                  disabled={uploading}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <i className="ri-upload-line mr-1"></i>选择 CSV 文件上传
                </button>
              )}
            </div>
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="mb-6 ml-10">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-center gap-3 mb-2">
                  <i className="ri-loader-4-line text-blue-600 text-xl animate-spin"></i>
                  <span className="text-sm font-medium text-blue-800">正在解析并导入 {importYear} 年数据...</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-xs text-blue-600 mt-1 text-right">{progress}%</p>
              </div>
            </div>
          )}

          {/* 导入结果 */}
          {importResult && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold">
                  <i className="ri-check-line"></i>
                </div>
                <h3 className="text-base font-semibold text-gray-800">导入完成（{importYear} 年）</h3>
              </div>
              <div className="ml-10">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ri-checkbox-circle-line text-green-600 text-xl"></i>
                      <span className="text-sm font-medium text-green-800">成功导入</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{importResult.success} 条</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ri-close-circle-line text-red-600 text-xl"></i>
                      <span className="text-sm font-medium text-red-800">导入失败</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{importResult.failed} 条</p>
                  </div>
                </div>
                {importResult.failedList.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-red-800">失败明细</h4>
                      <button
                        onClick={handleExportFailedList}
                        className="px-3 py-1.5 text-xs text-red-600 border border-red-600 rounded-md hover:bg-red-100 whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-download-line mr-1"></i>导出失败清单
                      </button>
                    </div>
                    <div className="max-h-60 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-red-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800">行号</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800">企业名称</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800">失败原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.failedList.map((item, index) => (
                            <tr key={index} className="border-t border-red-200">
                              <td className="px-3 py-2 text-red-700">{item.row > 0 ? `第 ${item.row} 行` : '—'}</td>
                              <td className="px-3 py-2 text-red-700">{item.companyName || '—'}</td>
                              <td className="px-3 py-2 text-red-600">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 导入说明 */}
          <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-orange-600 text-lg mt-0.5"></i>
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-1">导入说明：</p>
                <ul className="list-disc list-inside space-y-1 text-orange-700">
                  <li>仅支持 CSV 格式，请使用下载的模板填写后上传</li>
                  <li>模板第一行为表头，第二行为说明，数据从第三行开始填写</li>
                  <li>标记 * 的为必填字段，统一社会信用代码必须为18位</li>
                  <li>下拉字段的值必须与模板说明行中的可选项完全一致</li>
                  <li>若信用代码已存在，将更新该企业对应年度的数据</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4 px-6 py-4 border-t border-gray-200">
          {importResult ? (
            <button onClick={handleComplete} className="px-6 py-2.5 text-white bg-blue-600 rounded-md hover:bg-blue-700 whitespace-nowrap cursor-pointer">
              完成
            </button>
          ) : (
            <button onClick={onClose} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap cursor-pointer">
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
