import { useState, useEffect, useRef } from 'react';
import { supabase, EnterpriseWithYearData } from '../lib/supabase';

interface UseEnterprisesParams {
  year: number;
  searchName?: string;
  searchIndustry?: string;
  scale?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

interface UseEnterprisesResult {
  data: EnterpriseWithYearData[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useEnterprises = ({
  year,
  searchName = '',
  searchIndustry = '',
  scale = '',
  status = '',
  page = 1,
  pageSize = 20,
}: UseEnterprisesParams): UseEnterprisesResult => {
  const [data, setData] = useState<EnterpriseWithYearData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEnterprises = async () => {
    // 取消上一次未完成的请求
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // ── Step 1: 若有行业筛选，先从年度记录表找出符合的企业ID ──
      let industryFilteredIds: string[] | null = null;
      if (searchIndustry) {
        const { data: industryRecords, error: industryError } = await supabase
          .from('enterprise_year_records')
          .select('enterprise_id')
          .eq('year', year)
          .eq('industry_code', searchIndustry);

        if (industryError) throw industryError;
        industryFilteredIds = (industryRecords || []).map((r) => r.enterprise_id);

        // 如果没有匹配的行业记录，直接返回空
        if (industryFilteredIds.length === 0) {
          setData([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      // ── Step 2: 查企业基础信息 ──
      let enterpriseQuery = supabase
        .from('enterprises')
        .select('*');

      if (searchName) {
        enterpriseQuery = enterpriseQuery.ilike('name', `%${searchName}%`);
      }
      if (scale) {
        enterpriseQuery = enterpriseQuery.eq('scale', scale);
      }
      if (industryFilteredIds !== null) {
        enterpriseQuery = enterpriseQuery.in('id', industryFilteredIds);
      }

      const { data: enterprises, error: enterpriseError } = await enterpriseQuery;

      if (enterpriseError) throw enterpriseError;
      if (!enterprises || enterprises.length === 0) {
        setData([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      // ── Step 3: 批量获取当前年度记录（一次请求）──
      const enterpriseIds = enterprises.map((e) => e.id);
      const { data: yearRecords, error: yearRecordError } = await supabase
        .from('enterprise_year_records')
        .select('enterprise_id, status, year, industry_code')
        .in('enterprise_id', enterpriseIds)
        .eq('year', year);

      if (yearRecordError) throw yearRecordError;

      const yearRecordMap = new Map(
        (yearRecords || []).map((r) => [r.enterprise_id, r])
      );

      // ── Step 4: 合并 + 状态筛选（前端轻量计算）──
      let combined = enterprises.map((enterprise) => ({
        ...enterprise,
        year_record: yearRecordMap.get(enterprise.id),
      }));

      if (status) {
        if (status === '未填报') {
          combined = combined.filter(
            (item) => !item.year_record || item.year_record.status === '未填报'
          );
        } else {
          combined = combined.filter(
            (item) => item.year_record?.status === status
          );
        }
      }

      // ── Step 5: 前端分页 ──
      const filteredTotal = combined.length;
      const start = (page - 1) * pageSize;
      const paginatedData = combined.slice(start, start + pageSize);

      setData(paginatedData as EnterpriseWithYearData[]);
      setTotal(filteredTotal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Error fetching enterprises:', err);
      setError(err instanceof Error ? err.message : '获取企业数据失败');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnterprises();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, searchName, searchIndustry, scale, status, page, pageSize]);

  return { data, total, loading, error, refetch: fetchEnterprises };
};

// ── 仅统计未填报数量，不拉全量数据 ──
export const useUnfilledEnterprises = (year: number) => {
  const [count, setCount] = useState(0);
  const [enterprises, setEnterprises] = useState<EnterpriseWithYearData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnfilled = async () => {
      try {
        setLoading(true);

        // 并行请求：全部企业 ID + 已填报企业 ID
        const [{ data: allEnterprises, error: e1 }, { data: filledRecords, error: e2 }] =
          await Promise.all([
            supabase.from('enterprises').select('id, name, credit_code, scale'),
            supabase
              .from('enterprise_year_records')
              .select('enterprise_id')
              .eq('year', year)
              .eq('status', '已填报'),
          ]);

        if (e1) throw e1;
        if (e2) throw e2;

        const filledIds = new Set((filledRecords || []).map((r) => r.enterprise_id));
        const unfilled = (allEnterprises || []).filter((e) => !filledIds.has(e.id));

        setCount(unfilled.length);
        setEnterprises(unfilled.map((e) => ({ ...e, year_record: undefined })) as EnterpriseWithYearData[]);
      } catch (err) {
        console.error('Error fetching unfilled enterprises:', err);
        setCount(0);
        setEnterprises([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUnfilled();
  }, [year]);

  return { count, enterprises, loading };
};
