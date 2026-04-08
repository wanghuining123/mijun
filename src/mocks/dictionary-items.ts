export const dictionaryItems = {
  industry_code: [
    { id: 1, code: 'A', name: 'A 农、林、牧、渔业', sortOrder: 1 },
    { id: 2, code: 'B', name: 'B 采矿业', sortOrder: 2 },
    { id: 3, code: 'C', name: 'C 制造业', sortOrder: 3 },
    { id: 4, code: 'D', name: 'D 电力、热力、燃气及水生产和供应业', sortOrder: 4 },
    { id: 5, code: 'E', name: 'E 建筑业', sortOrder: 5 },
    { id: 6, code: 'F', name: 'F 批发和零售业', sortOrder: 6 },
    { id: 7, code: 'G', name: 'G 交通运输、仓储和邮政业', sortOrder: 7 },
    { id: 8, code: 'H', name: 'H 住宿和餐饮业', sortOrder: 8 },
    { id: 9, code: 'I', name: 'I 信息传输、软件和信息技术服务业', sortOrder: 9 },
    { id: 10, code: 'J', name: 'J 金融业', sortOrder: 10 },
    { id: 11, code: 'K', name: 'K 房地产业', sortOrder: 11 },
    { id: 12, code: 'L', name: 'L 租赁和商务服务业', sortOrder: 12 },
    { id: 13, code: 'M', name: 'M 科学研究和技术服务业', sortOrder: 13 },
    { id: 14, code: 'N', name: 'N 水利、环境和公共设施管理业', sortOrder: 14 },
    { id: 15, code: 'O', name: 'O 居民服务、修理和其他服务业', sortOrder: 15 },
    { id: 16, code: 'P', name: 'P 教育', sortOrder: 16 },
    { id: 17, code: 'Q', name: 'Q 卫生和社会工作', sortOrder: 17 },
    { id: 18, code: 'R', name: 'R 文化、体育和娱乐业', sortOrder: 18 },
    { id: 19, code: 'S', name: 'S 公共管理、社会保障和社会组织', sortOrder: 19 },
    { id: 20, code: 'T', name: 'T 国际组织', sortOrder: 20 },
  ],
  scale_type: [
    { id: 1, code: 'above', name: '规模以上企业', sortOrder: 1 },
    { id: 2, code: 'below', name: '规模以下企业', sortOrder: 2 }
  ]
};

export const versionHistory = [
  {
    version: 'V2.1',
    isCurrent: true,
    publishTime: '2024-03-20 14:30:25',
    operator: '张三',
    changes: [
      {
        type: 'modify',
        category: '修改字段',
        items: [
          {
            fieldName: '销售收入',
            fieldCode: 'sales_revenue',
            detail: '修改字段提示语：请输入销售收入 → 请输入年度销售收入总额'
          }
        ]
      }
    ]
  },
  {
    version: 'V2.0',
    isCurrent: false,
    publishTime: '2024-02-15 10:15:30',
    operator: '李四',
    changes: [
      {
        type: 'add',
        category: '新增字段',
        items: [
          {
            fieldName: '研发经费支出',
            fieldCode: 'rd_expenditure',
            detail: '新增数值类型字段,单位:万元,选填'
          },
          {
            fieldName: '年平均职工人数',
            fieldCode: 'avg_employee_count',
            detail: '新增数值类型字段,单位:人,选填'
          }
        ]
      },
      {
        type: 'modify',
        category: '字典项变更',
        items: [
          {
            fieldName: '行业代码',
            fieldCode: 'industry_code',
            detail: '新增字典项:C40-仪器仪表制造业'
          }
        ]
      }
    ]
  },
  {
    version: 'V1.0',
    isCurrent: false,
    publishTime: '2024-01-15 09:00:00',
    operator: '系统管理员',
    changes: [
      {
        type: 'add',
        category: '初始化',
        items: [
          {
            fieldName: '系统初始化',
            fieldCode: 'system_init',
            detail: '创建12个预置核心业务字段及配套字典项'
          }
        ]
      }
    ]
  }
];

export const fieldChangeHistory = {
  sales_revenue: [
    {
      version: 'V2.1',
      changeType: 'modify',
      operateTime: '2024-03-20 14:25:10',
      operator: '张三',
      detail: '修改字段提示语：请输入销售收入 → 请输入年度销售收入总额'
    },
    {
      version: 'V1.0',
      changeType: 'add',
      operateTime: '2024-01-15 09:00:00',
      operator: '系统管理员',
      detail: '初始创建字段'
    }
  ]
};