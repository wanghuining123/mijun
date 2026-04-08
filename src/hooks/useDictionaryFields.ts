import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface DictionaryField {
  id: string;
  name: string;
  code: string;
  input_type: string;
  required: boolean;
  placeholder: string;
  unit: string;
  sort_order: number;
  status: 'enabled' | 'disabled';
  in_use: boolean;
  group_name: string;
  version: string;
  has_modified: boolean;
  operator: string;
  created_at: string;
  updated_at: string;
  current_version?: string;
}

export interface PendingChange {
  field_id?: string;
  operation: 'add' | 'update' | 'delete';
  before_snapshot?: any;
  after_snapshot: any;
}

interface UseDictionaryFieldsResult {
  fields: DictionaryField[];
  enabledFields: DictionaryField[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addField: (data: Partial<DictionaryField>) => Promise<{ success: boolean; pendingChange?: PendingChange; error?: string }>;
  updateField: (id: string, data: Partial<DictionaryField>) => Promise<{ success: boolean; pendingChange?: PendingChange; error?: string }>;
  deleteField: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleStatus: (id: string, currentStatus: 'enabled' | 'disabled') => Promise<{ success: boolean; error?: string }>;
  getFieldById: (id: string) => DictionaryField | undefined;
}

export const useDictionaryFields = (): UseDictionaryFieldsResult => {
  const [fields, setFields] = useState<DictionaryField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('dictionary_fields')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setFields(data || []);
    } catch (err) {
      console.error('获取字典字段失败:', err);
      setError(err instanceof Error ? err.message : '获取字段配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const getFieldById = (id: string) => {
    return fields.find(f => f.id === id);
  };

  const addField = async (data: Partial<DictionaryField>) => {
    try {
      // 不再直接写库，返回暂存的变更数据
      const pendingChange: PendingChange = {
        operation: 'add',
        after_snapshot: {
          name: data.name,
          code: data.code,
          input_type: data.input_type || 'text',
          required: data.required || false,
          placeholder: data.placeholder || '',
          unit: data.unit || '',
          sort_order: data.sort_order || 99,
          status: 'enabled',
          in_use: false,
          group_name: data.group_name || '其他信息',
          version: 'V1.0',
          has_modified: false,
          operator: '管理员',
        }
      };
      
      return { success: true, pendingChange };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '新增字段失败';
      return { success: false, error: msg };
    }
  };

  const updateField = async (id: string, data: Partial<DictionaryField>) => {
    try {
      // 获取变更前的快照
      const beforeSnapshot = fields.find(f => f.id === id);
      if (!beforeSnapshot) {
        return { success: false, error: '字段不存在' };
      }

      // 不再直接写库，返回暂存的变更数据
      const pendingChange: PendingChange = {
        field_id: id,
        operation: 'update',
        before_snapshot: { ...beforeSnapshot },
        after_snapshot: {
          ...beforeSnapshot,
          ...data,
          has_modified: true,
          updated_at: new Date().toISOString(),
        }
      };
      
      return { success: true, pendingChange };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新字段失败';
      return { success: false, error: msg };
    }
  };

  const deleteField = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('dictionary_fields')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      await fetchFields();
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除字段失败';
      return { success: false, error: msg };
    }
  };

  const toggleStatus = async (id: string, currentStatus: 'enabled' | 'disabled') => {
    const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
    try {
      const { error: updateError } = await supabase
        .from('dictionary_fields')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;
      await fetchFields();
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '切换状态失败';
      return { success: false, error: msg };
    }
  };

  const enabledFields = fields.filter(f => f.status === 'enabled' || f.in_use === true);

  return {
    fields,
    enabledFields,
    loading,
    error,
    refetch: fetchFields,
    addField,
    updateField,
    deleteField,
    toggleStatus,
    getFieldById,
  };
};