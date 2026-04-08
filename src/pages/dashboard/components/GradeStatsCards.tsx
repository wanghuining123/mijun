import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

interface GradeStats {
  A: number;
  B: number;
  C: number;
  D: number;
  total: number;
}

interface GradeStatsCardsProps {
  year: number;
  industry: string;
  refreshKey: number;
}

const GRADE_CONFIG = {
  A: {
    label: 'A 级企业',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    icon: 'ri-award-fill',
    iconColor: 'text-emerald-600',
    barColor: 'bg-emerald-500',
  },
  B: {
    label: 'B 级企业',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
    icon: 'ri-medal-fill',
    iconColor: 'text-teal-600',
    barColor: 'bg-teal-500',
  },
  C: {
    label: 'C 级企业',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    icon: 'ri-shield-check-fill',
    iconColor: 'text-amber-600',
    barColor: 'bg-amber-500',
  },
  D: {
    label: 'D 级企业',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    icon: 'ri-alert-fill',
    iconColor: 'text-rose-600',
    barColor: 'bg-rose-500',
  },
};

export const GradeStatsCards = ({ year, industry, refreshKey }: GradeStatsCardsProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GradeStats>({ A: 0, B: 0, C: 0, D: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGradeStats();
  }, [year, industry, refreshKey]);

  const fetchGradeStats = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('enterprise_year_records')
        .select('classification_grade')
        .eq('year', year)
        .not('classification_grade', 'is', null);

      if (industry !== '全部') {
        query = query.eq('industry_code', industry);
      }

      const { data } = await query;

      const result: GradeStats = { A: 0, B: 0, C: 0, D: 0, total: 0 };
      data?.forEach(record => {
        const grade = record.classification_grade as 'A' | 'B' | 'C' | 'D';
        if (grade in result) {
          result[grade] += 1;
          result.total += 1;
        }
      });

      setStats(result);
    } catch (err) {
      console.error('获取分类等级统计失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-40 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const grades: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

  const handleGradeClick = (grade: 'A' | 'B' | 'C' | 'D') => {
    const params = new URLSearchParams();
    params.set('year', String(year));
    params.set('grade', grade);
    if (industry && industry !== '全部') {
      params.set('industry', industry);
    }
    navigate(`/classification/publish?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <i className="ri-bar-chart-grouped-fill text-teal-600"></i>
          分类等级企业数量统计
        </h2>
        <span className="text-sm text-gray-500">
          共 <span className="font-semibold text-gray-800">{stats.total}</span> 家企业已完成分类评级
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {grades.map(grade => {
          const cfg = GRADE_CONFIG[grade];
          const count = stats[grade];
          const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

          return (
            <div
              key={grade}
              onClick={() => handleGradeClick(grade)}
              className={`rounded-lg border ${cfg.border} ${cfg.bg} p-5 flex flex-col gap-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer group`}
            >
              {/* 顶部：图标 + 等级标签 */}
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${cfg.iconBg}`}>
                  <i className={`${cfg.icon} text-lg ${cfg.iconColor}`}></i>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {grade} 级
                  </span>
                  <i className={`ri-arrow-right-line text-xs ${cfg.color} opacity-0 group-hover:opacity-100 transition-opacity`}></i>
                </div>
              </div>

              {/* 数量 */}
              <div>
                <div className={`text-3xl font-bold ${cfg.color}`}>{count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{cfg.label}</div>
              </div>

              {/* 占比进度条 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">占比</span>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>

              {/* 底部提示 */}
              <div className={`text-xs ${cfg.color} opacity-0 group-hover:opacity-70 transition-opacity flex items-center gap-1`}>
                <i className="ri-external-link-line"></i>
                点击查看详情
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
