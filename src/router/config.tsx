import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import MainLayout from "../components/feature/MainLayout";
import PermissionGuard from "../components/feature/PermissionGuard";

import EnterprisePage from "../pages/enterprise/page";
import AutoCalcPage from "../pages/evaluation/auto-calc/page";
import SpecialCasesPage from "../pages/evaluation/special-cases/page";
import PublishPage from "../pages/classification/publish/page";
import AdjustmentPage from "../pages/classification/adjustment/page";
import IndicatorsPage from "../pages/model/indicators/page";
import ClassificationRulesPage from "../pages/model/classification/page";
import DictionaryPage from "../pages/dictionary/page";
import PolicyPage from "../pages/resource/policy/page";
import PolicyDocsPage from "../pages/resource/policy-docs/page";
import PunishmentPage from "../pages/resource/punishment/page";
import DashboardPage from "../pages/dashboard/page";
import UsersPage from "../pages/system/users/page";
import RolesPage from "../pages/system/roles/page";

const EnterpriseFormPage = lazy(() => import("../pages/enterprise/components/EnterpriseFormPage"));
const LoginPage = lazy(() => import("../pages/auth/login/page"));
const NotFoundPage = lazy(() => import("../pages/NotFound"));

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <PermissionGuard pageKey="enterprise"><EnterprisePage /></PermissionGuard> },
      { path: "dashboard", element: <PermissionGuard pageKey="dashboard"><DashboardPage /></PermissionGuard> },
      { path: "dictionary", element: <PermissionGuard pageKey="dictionary"><DictionaryPage /></PermissionGuard> },
      { path: "enterprise", element: <PermissionGuard pageKey="enterprise"><EnterprisePage /></PermissionGuard> },
      { path: "enterprise/new", element: <PermissionGuard pageKey="enterprise"><EnterpriseFormPage /></PermissionGuard> },
      { path: "enterprise/edit/:id", element: <PermissionGuard pageKey="enterprise"><EnterpriseFormPage /></PermissionGuard> },
      { path: "evaluation/auto-calc", element: <PermissionGuard pageKey="evaluation_auto"><AutoCalcPage /></PermissionGuard> },
      { path: "evaluation/special-cases", element: <PermissionGuard pageKey="evaluation_special"><SpecialCasesPage /></PermissionGuard> },
      { path: "classification/publish", element: <PermissionGuard pageKey="classification_publish"><PublishPage /></PermissionGuard> },
      { path: "classification/adjustment", element: <PermissionGuard pageKey="classification_adjustment"><AdjustmentPage /></PermissionGuard> },
      { path: "resource/policy", element: <PermissionGuard pageKey="resource_policy"><PolicyPage /></PermissionGuard> },
      { path: "resource/policy-docs", element: <PermissionGuard pageKey="resource_policy_docs"><PolicyDocsPage /></PermissionGuard> },
      { path: "resource/punishment", element: <PermissionGuard pageKey="resource_punishment"><PunishmentPage /></PermissionGuard> },
      { path: "model/indicators", element: <PermissionGuard pageKey="model_indicators"><IndicatorsPage /></PermissionGuard> },
      { path: "model/classification", element: <PermissionGuard pageKey="model_classification"><ClassificationRulesPage /></PermissionGuard> },
      { path: "system/users", element: <PermissionGuard pageKey="system_users"><UsersPage /></PermissionGuard> },
      { path: "system/roles", element: <PermissionGuard pageKey="system_roles"><RolesPage /></PermissionGuard> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export default routes;
