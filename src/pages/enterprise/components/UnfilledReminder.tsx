import { useUnfilledEnterprises } from '../../../hooks/useEnterprises';

interface UnfilledReminderProps {
  selectedYear: number;
  onFilterUnfilled: () => void;
}

export default function UnfilledReminder({ selectedYear, onFilterUnfilled }: UnfilledReminderProps) {
  const { count, enterprises, loading } = useUnfilledEnterprises(selectedYear);

  // 不显示提醒条的情况
  if (loading || count === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6 rounded-r-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <i className="ri-error-warning-line text-orange-500 text-xl mr-3"></i>
          <div>
            <p className="text-sm text-orange-800 font-medium">
              以下 {count} 家企业尚有 {selectedYear} 年度数据未填报，请及时补充
            </p>
            <p className="text-xs text-orange-600 mt-1">
              {enterprises.slice(0, 5).map(e => e.name).join('、')}
              {count > 5 && '等'}
            </p>
          </div>
        </div>
        <button
          onClick={onFilterUnfilled}
          className="px-4 py-2 bg-orange-500 text-white text-sm rounded-md hover:bg-orange-600 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-filter-line mr-1"></i>
          筛选未填报企业
        </button>
      </div>
    </div>
  );
}