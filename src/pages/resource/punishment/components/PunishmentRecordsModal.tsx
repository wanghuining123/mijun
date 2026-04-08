import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';

interface PunishmentRecord {
  id: string;
  record_type: string;
  record_content: string;
  record_date: string;
}

interface PunishmentRecordsModalProps {
  enterprise: {
    id: string;
    name: string;
    credit_code: string;
  };
  onClose: () => void;
}

export default function PunishmentRecordsModal({ enterprise, onClose }: PunishmentRecordsModalProps) {
  const [records, setRecords] = useState<PunishmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('punishment_records')
        .select('*')
        .eq('enterprise_id', enterprise.id)
        .order('record_date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('获取惩戒记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecordTypeIcon = (type: string) => {
    const icons: Record<string, { icon: string; color: string }> = {
      '推送提醒': { icon: 'ri-notification-3-line', color: 'bg-blue-500' },
      '标记失信': { icon: 'ri-alert-line', color: 'bg-red-500' },
      '惩戒执行': { icon: 'ri-shield-cross-line', color: 'bg-orange-500' },
    };
    return icons[type] || { icon: 'ri-file-list-line', color: 'bg-gray-500' };
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 弹窗头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">惩戒记录</h2>
            <p className="text-sm text-gray-500 mt-1">{enterprise.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-3xl text-gray-400 animate-spin"></i>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <i className="ri-file-list-3-line text-5xl mb-3"></i>
              <p className="text-sm">暂无惩戒记录</p>
            </div>
          ) : (
            <div className="relative">
              {/* 时间线 */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              <div className="space-y-6">
                {records.map((record, index) => {
                  const typeInfo = getRecordTypeIcon(record.record_type);
                  
                  return (
                    <div key={record.id} className="relative pl-16">
                      {/* 时间线节点 */}
                      <div className={`absolute left-0 w-12 h-12 ${typeInfo.color} rounded-lg flex items-center justify-center shadow-md`}>
                        <i className={`${typeInfo.icon} text-white text-xl`}></i>
                      </div>
                      
                      {/* 记录内容 */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900">{record.record_type}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(record.record_date).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{record.record_content}</p>
                      </div>
                      
                      {/* 连接线 */}
                      {index < records.length - 1 && (
                        <div className="absolute left-6 top-12 w-0.5 h-6 bg-gray-200"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 弹窗底部 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}