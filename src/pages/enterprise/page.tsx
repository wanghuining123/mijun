import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EnterpriseFilters from './components/EnterpriseFilters';
import EnterpriseListTable from './components/EnterpriseListTable';
import UnfilledReminder from './components/UnfilledReminder';
import BatchImportModal from './components/BatchImportModal';
import { useAuth } from '../../contexts/AuthContext';

export default function EnterprisePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canEdit } = useAuth();
  const hasEditPermission = canEdit('enterprise');
  const currentYear = new Date().getFullYear();

  // 从 URL 参数初始化筛选状态
  const initYear = searchParams.get('year') ? Number(searchParams.get('year')) : currentYear;
  const initIndustry = searchParams.get('industry') ?? '';

  const [selectedYear, setSelectedYear] = useState(initYear);
  const [searchName, setSearchName] = useState('');
  const [searchIndustry, setSearchIndustry] = useState(initIndustry);
  const [scale, setScale] = useState('');
  const [status, setStatus] = useState('');
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 当 URL 参数变化时同步更新筛选状态（如从看板页跳转过来）
  useEffect(() => {
    const yearParam = searchParams.get('year');
    const industryParam = searchParams.get('industry');
    if (yearParam) setSelectedYear(Number(yearParam));
    if (industryParam !== null) setSearchIndustry(industryParam);
  }, [searchParams]);

  const handleEdit = (id: string) => {
    if (!hasEditPermission) return;
    navigate(`/enterprise/edit/${id}`);
  };

  const handleFilterUnfilled = () => {
    setStatus('未填报');
  };

  const handleBatchExport = () => {
    alert('批量导出功能开发中');
  };

  const handleImportSuccess = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">企业数据列表</h1>
        <p className="text-sm text-gray-600">管理和维护辖区企业基础信息及年度数据</p>
      </div>

      <UnfilledReminder selectedYear={selectedYear} onFilterUnfilled={handleFilterUnfilled} />

      <EnterpriseFilters
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        searchName={searchName}
        onSearchNameChange={setSearchName}
        searchIndustry={searchIndustry}
        onSearchIndustryChange={setSearchIndustry}
        scale={scale}
        onScaleChange={setScale}
        status={status}
        onStatusChange={setStatus}
        onAddNew={() => hasEditPermission && navigate('/enterprise/new')}
        onBatchImport={() => hasEditPermission && setShowBatchImport(true)}
        onBatchExport={handleBatchExport}
        canEdit={hasEditPermission}
      />

      <EnterpriseListTable
        key={refreshKey}
        selectedYear={selectedYear}
        searchName={searchName}
        searchIndustry={searchIndustry}
        scale={scale}
        status={status}
        onEdit={handleEdit}
        canEdit={hasEditPermission}
      />

      {showBatchImport && (
        <BatchImportModal
          selectedYear={selectedYear}
          onClose={() => setShowBatchImport(false)}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
