import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface SubMenuItem { id: string; label: string; path: string; pageKey?: string; }
interface MenuItem { id: string; label: string; icon: string; path?: string; pageKey?: string; subItems?: SubMenuItem[]; adminOnly?: boolean; }

const menuItems: MenuItem[] = [
  { id: "dashboard", label: "数据驾驶舱", icon: "ri-bar-chart-2-line", path: "/dashboard", pageKey: "dashboard" },
  { id: "enterprise", label: "企业数据列表", icon: "ri-building-line", path: "/enterprise", pageKey: "enterprise" },
  {
    id: "evaluation", label: "评价执行引擎", icon: "ri-dashboard-line",
    subItems: [
      { id: "auto-calc", label: "自动计算功能", path: "/evaluation/auto-calc", pageKey: "evaluation_auto" },
      { id: "special-cases", label: "特殊情形处理", path: "/evaluation/special-cases", pageKey: "evaluation_special" },
    ],
  },
  {
    id: "classification", label: "分类结果管理", icon: "ri-pie-chart-line",
    subItems: [
      { id: "publish", label: "名单公示发布", path: "/classification/publish", pageKey: "classification_publish" },
      { id: "adjustment", label: "动态调整机制", path: "/classification/adjustment", pageKey: "classification_adjustment" },
    ],
  },
  {
    id: "resource", label: "资源要素配置", icon: "ri-settings-3-line",
    subItems: [
      { id: "policy", label: "差别化政策配置", path: "/resource/policy", pageKey: "resource_policy" },
      { id: "policy-docs", label: "考核政策文件管理", path: "/resource/policy-docs", pageKey: "resource_policy_docs" },
      { id: "punishment", label: "联合惩戒管理", path: "/resource/punishment", pageKey: "resource_punishment" },
    ],
  },
  {
    id: "model", label: "评价模型配置", icon: "ri-function-line",
    subItems: [
      { id: "indicators", label: "指标体系管理", path: "/model/indicators", pageKey: "model_indicators" },
      { id: "classification-rules", label: "分类规则设置", path: "/model/classification", pageKey: "model_classification" },
    ],
  },
  { id: "dictionary", label: "数据字典配置", icon: "ri-book-2-line", path: "/dictionary", pageKey: "dictionary" },
  {
    id: "system", label: "系统管理", icon: "ri-shield-user-line", adminOnly: true,
    subItems: [
      { id: "users", label: "用户管理", path: "/system/users", pageKey: "system_users" },
      { id: "roles", label: "角色管理", path: "/system/roles", pageKey: "system_roles" },
    ],
  },
];

export default function SideNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, canView, signOut, isAdmin } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["evaluation", "classification", "resource", "model", "system"]);

  const visibleMenus = menuItems.filter(item => {
    if (item.adminOnly) return isAdmin();
    if (item.pageKey) return canView(item.pageKey);
    if (item.subItems) return item.subItems.some(sub => sub.pageKey ? canView(sub.pageKey) : true);
    return true;
  });

  const handleMenuClick = (item: MenuItem) => {
    if (item.subItems) {
      setExpandedMenus(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
    } else if (item.path) navigate(item.path);
  };

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.path) return location.pathname === item.path || (item.path === "/enterprise" && location.pathname === "/");
    if (item.subItems) return item.subItems.some(sub => location.pathname === sub.path);
    return false;
  };

  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="px-4 py-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <i className="ri-bar-chart-box-line text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">米均效益评价系统</h1>
            <p className="text-xs text-gray-500">济南历下区</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleMenus.map((item) => {
          const isActive = isMenuActive(item);
          const isExpanded = expandedMenus.includes(item.id);
          const visibleSubs = item.subItems?.filter(sub => sub.pageKey ? canView(sub.pageKey) : true);
          return (
            <div key={item.id}>
              <button onClick={() => handleMenuClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors cursor-pointer relative ${isActive && !item.subItems ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`}>
                {isActive && !item.subItems && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>}
                <i className={`${item.icon} text-lg`}></i>
                <span className="font-medium whitespace-nowrap flex-1 text-left">{item.label}</span>
                {item.subItems && <i className={`ri-arrow-down-s-line text-base transition-transform ${isExpanded ? "rotate-180" : ""}`}></i>}
              </button>
              {item.subItems && isExpanded && visibleSubs && visibleSubs.length > 0 && (
                <div className="bg-gray-50">
                  {visibleSubs.map((subItem) => {
                    const isSubActive = location.pathname === subItem.path;
                    return (
                      <button key={subItem.id} onClick={() => navigate(subItem.path)}
                        className={`w-full flex items-center gap-3 pl-12 pr-4 py-2.5 text-sm transition-colors cursor-pointer relative ${isSubActive ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"}`}>
                        {isSubActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>}
                        <span className="whitespace-nowrap">{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <i className="ri-user-line text-gray-600 text-sm"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{profile?.real_name || profile?.phone || "用户"}</p>
            <p className="text-xs text-gray-500 truncate">{profile?.role?.name || "未分配角色"}</p>
          </div>
          <button onClick={signOut} title="退出登录" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer rounded-md hover:bg-red-50 transition-colors">
            <i className="ri-logout-box-r-line text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
