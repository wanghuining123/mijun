import { useState } from 'react';
import { useEnterprises } from '../../../hooks/useEnterprises';
import { supabase } from '../../../lib/supabase';
import DeleteConfirmModal from './DeleteConfirmModal';
import YearCompareModal from './YearCompareModal';
import EnterprisePortraitModal from './EnterprisePortraitModal';

interface EnterpriseListTableProps {
  selectedYear: number;
  searchName: string;
  searchIndustry: string;
  scale: string;
  status: string;
  onEdit: (id: string) => void;
  canEdit?: boolean;
}

export default function EnterpriseListTable({
  selectedYear,
  searchName,
  searchIndustry,
  scale,
  status,
  onEdit,
  canEdit = false,
}: EnterpriseListTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: enterprises, total, loading, error, refetch } = useEnterprises({
    year: selectedYear,
    searchName,
    searchIndustry,
    scale,
    status,
    page: currentPage,
    pageSize,
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareTarget, setCompareTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [portraitModalOpen, setPortraitModalOpen] = useState(false);
  const [portraitTarget, setPortraitTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from('enterprises')
        .delete()
        .eq('id', deleteTarget.id);

      if (deleteError) throw deleteError;

      // 删除成功后刷新列表
      refetch();
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting enterprise:', err);
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleCompare = (id: string, name: string) => {
    setCompareTarget({ id, name });
    setCompareModalOpen(true);
  };

  const handlePortrait = (id: string, name: string) => {
    setPortraitTarget({ id, name });
    setPortraitModalOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  // 加载状态骨架屏
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企业名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">统一社会信用代码</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规上/规下</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数据状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...Array(5)].map((_, index) => (
                <tr key={index}>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-40"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <i className="ri-error-warning-line text-4xl text-red-500 mb-4"></i>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 whitespace-nowrap"
        >
          重新加载
        </button>
      </div>
    );
  }

  // 空状态
  if (enterprises.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <i className="ri-inbox-line text-6xl text-gray-300 mb-4"></i>
        <p className="text-gray-500 text-lg mb-2">暂无企业数据</p>
        <p className="text-gray-400 text-sm">请点击"新增企业数据"按钮添加企业信息</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  企业名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  统一社会信用代码
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  规上/规下
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  数据状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enterprises.map((enterprise) => {
                const isUnfilled = enterprise.year_record?.status === '未填报';
                return (
                  <tr
                    key={enterprise.id}
                    className={isUnfilled ? 'bg-orange-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {enterprise.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {enterprise.credit_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          enterprise.scale === '规上'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {enterprise.scale}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          enterprise.year_record?.status === '已填报'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {enterprise.year_record?.status || '未填报'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        {canEdit && (
                          <button
                            onClick={() => onEdit(enterprise.id)}
                            className="text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-edit-line mr-1"></i>
                            编辑
                          </button>
                        )}
                        <button
                          onClick={() => handlePortrait(enterprise.id, enterprise.name)}
                          className="text-teal-600 hover:text-teal-800 whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-radar-line mr-1"></i>
                          画像
                        </button>
                        <button
                          onClick={() => handleCompare(enterprise.id, enterprise.name)}
                          className="text-purple-600 hover:text-purple-800 whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-git-compare-line mr-1"></i>
                          对比
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(enterprise.id, enterprise.name)}
                            className="text-red-600 hover:text-red-800 whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-delete-bin-line mr-1"></i>
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            共 <span className="font-medium text-gray-700">{total}</span> 条记录，第{' '}
            <span className="font-medium text-gray-700">{currentPage}</span> /{' '}
            <span className="font-medium text-gray-700">{Math.max(1, totalPages)}</span> 页
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              title="首页"
            >
              <i className="ri-skip-back-line"></i>
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              上一页
            </button>
            <div className="flex items-center gap-1">
              {(() => {
                const pages = Math.max(1, totalPages);
                const maxShow = 5;
                let start = 1;
                if (pages > maxShow) {
                  if (currentPage <= 3) {
                    start = 1;
                  } else if (currentPage >= pages - 2) {
                    start = pages - maxShow + 1;
                  } else {
                    start = currentPage - 2;
                  }
                }
                return [...Array(Math.min(maxShow, pages))].map((_, i) => {
                  const pageNum = start + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-md text-sm whitespace-nowrap cursor-pointer transition-colors ${
                        currentPage === pageNum
                          ? 'bg-emerald-600 text-white border border-emerald-600'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              下一页
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              title="末页"
            >
              <i className="ri-skip-forward-line"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 企业画像弹窗 */}
      {portraitModalOpen && portraitTarget && (
        <EnterprisePortraitModal
          enterpriseId={portraitTarget.id}
          enterpriseName={portraitTarget.name}
          year={selectedYear}
          onClose={() => {
            setPortraitModalOpen(false);
            setPortraitTarget(null);
          }}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteModalOpen && deleteTarget && (
        <DeleteConfirmModal
          enterpriseName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }}
          loading={deleting}
        />
      )}

      {/* 年度对比弹窗 */}
      {compareModalOpen && compareTarget && (
        <YearCompareModal
          enterpriseId={compareTarget.id}
          enterpriseName={compareTarget.name}
          currentYear={selectedYear}
          onClose={() => {
            setCompareModalOpen(false);
            setCompareTarget(null);
          }}
        />
      )}
    </>
  );
}