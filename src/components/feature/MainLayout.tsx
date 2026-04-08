import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SideNav />
      <div className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
