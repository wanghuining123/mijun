import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DictionaryVersion {
  id: string;
  version_number: string;
  publish_time: string;
  operator: string;
  change_summary: Array<{
    field_id: string;
    field_name: string;
    operation: string;
  }>;
  created_at: string;
}

export interface FieldHistory {
  id: string;
  field_id: string;
  version_id: string;
  version_number: string;
  before_snapshot: any;
  after_snapshot: any;
  operation_type: string;
  operator: string;
  created_at: string;
}

export interface PendingChange {
  field_id?: string;
  operation: 'add' | 'update' | 'delete';
  before_snapshot?: any;
  after_snapshot: any;
}

export const useDictionaryVersions = () => {
  const [versions, setVersions] = useState<DictionaryVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dictionary_versions')
        .select('*')
        .order('publish_time', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('获取版本列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const getNextVersionNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('dictionary_versions')
        .select('version_number')
        .order('publish_time', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        return 'V1.0';
      }

      const lastVersion = data[0].version_number;
      const match = lastVersion.match(/V(\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        return `V${major}.${minor + 1}`;
      }

      return 'V1.0';
    } catch (error) {
      console.error('获取版本号失败:', error);
      return 'V1.0';
    }
  };

  const createVersion = async (
    pendingChanges: PendingChange[],
    operator: string = '管理员'
  ): Promise<{ success: boolean; version?: DictionaryVersion; error?: string }> => {
    try {
      const versionNumber = await getNextVersionNumber();

      // 构建变更摘要
      const changeSummary = pendingChanges.map(change => ({
        field_id: change.field_id || '',
        field_name: (change.after_snapshot ?? change.before_snapshot)?.name || '',
        operation: change.operation === 'add' ? '新增' : change.operation === 'update' ? '修改' : '删除'
      }));

      // 创建版本记录
      const { data: versionData, error: versionError } = await supabase
        .from('dictionary_versions')
        .insert({
          version_number: versionNumber,
          operator,
          change_summary: changeSummary
        })
        .select()
        .single();

      if (versionError) throw versionError;

      /** 将 snapshot（可能含驼峰字段名）转换为数据库下划线字段名 */
      const toDbFields = (snapshot: any) => ({
        name: snapshot.name,
        code: snapshot.code,
        input_type: snapshot.input_type ?? snapshot.inputType,
        required: snapshot.required ?? false,
        placeholder: snapshot.placeholder ?? '',
        unit: snapshot.unit ?? '',
        sort_order: snapshot.sort_order ?? snapshot.sortOrder ?? 99,
        status: snapshot.status ?? 'enabled',
        in_use: snapshot.in_use ?? snapshot.inUse ?? false,
        group_name: snapshot.group_name ?? snapshot.groupName ?? '其他信息',
        version: snapshot.version ?? 'V1.0',
        has_modified: snapshot.has_modified ?? snapshot.hasModified ?? false,
        operator: snapshot.operator ?? operator,
      });

      /** 根据字段输入类型，返回对应的 PostgreSQL 列类型 */
      const getColumnType = (inputType: string): string => {
        switch (inputType) {
          case 'number': return 'NUMERIC';
          case 'date': return 'DATE';
          default: return 'TEXT';
        }
      };

      /** 自动在 enterprise_year_records 表中添加列（如果不存在） */
      const ensureColumnExists = async (code: string, inputType: string): Promise<void> => {
        try {
          const colType = getColumnType(inputType);
          // 使用 Supabase rpc 执行 DDL，若列已存在则忽略
          const { error } = await supabase.rpc('add_column_if_not_exists', {
            p_table: 'enterprise_year_records',
            p_column: code,
            p_type: colType,
          });
          if (error) {
            console.warn(`自动建列失败（${code}）:`, error.message);
          }
        } catch (err) {
          console.warn(`自动建列异常（${code}）:`, err);
        }
      };

      // 先处理字段表变更，并收集真实 field_id
      const resolvedChanges: Array<PendingChange & { resolved_field_id: string | null }> = [];

      for (const change of pendingChanges) {
        if (change.operation === 'add') {
          // 新增字段：先插入获取真实 UUID
          const { data: insertedField, error: insertError } = await supabase
            .from('dictionary_fields')
            .insert({
              ...toDbFields(change.after_snapshot),
              current_version: versionNumber,
              has_modified: false
            })
            .select('id')
            .single();
          if (insertError) throw insertError;
          resolvedChanges.push({ ...change, resolved_field_id: insertedField.id });

          // 自动在 enterprise_year_records 表中添加对应列
          const code = change.after_snapshot?.code;
          const inputType = change.after_snapshot?.input_type ?? change.after_snapshot?.inputType ?? 'text';
          if (code) {
            await ensureColumnExists(code, inputType);
          }
        } else if (change.operation === 'update' && change.field_id) {
          const { error: updateError } = await supabase
            .from('dictionary_fields')
            .update({
              ...toDbFields(change.after_snapshot),
              current_version: versionNumber,
              has_modified: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', change.field_id);
          if (updateError) throw updateError;
          resolvedChanges.push({ ...change, resolved_field_id: change.field_id });
        } else if (change.operation === 'delete' && change.field_id) {
          const { error: deleteError } = await supabase
            .from('dictionary_fields')
            .delete()
            .eq('id', change.field_id);
          if (deleteError) throw deleteError;
          resolvedChanges.push({ ...change, resolved_field_id: change.field_id });
        } else {
          resolvedChanges.push({ ...change, resolved_field_id: change.field_id || null });
        }
      }

      // 批量创建字段变更历史（使用真实 field_id，跳过 field_id 为 null 的记录）
      const historyRecords = resolvedChanges
        .filter(change => change.resolved_field_id)
        .map(change => ({
          field_id: change.resolved_field_id!,
          version_id: versionData.id,
          version_number: versionNumber,
          before_snapshot: change.before_snapshot || null,
          after_snapshot: change.after_snapshot ?? change.before_snapshot,
          operation_type: change.operation,
          operator
        }));

      if (historyRecords.length > 0) {
        const { error: historyError } = await supabase
          .from('dictionary_field_history')
          .insert(historyRecords);
        if (historyError) throw historyError;
      }

      await fetchVersions();

      return { success: true, version: versionData };
    } catch (error: any) {
      console.error('创建版本失败:', error);
      return { success: false, error: error.message };
    }
  };

  const getFieldHistory = async (fieldId: string): Promise<FieldHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('dictionary_field_history')
        .select('*')
        .eq('field_id', fieldId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('获取字段变更历史失败:', error);
      return [];
    }
  };

  return {
    versions,
    loading,
    fetchVersions,
    createVersion,
    getFieldHistory,
    getNextVersionNumber
  };
};