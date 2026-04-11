import { NavLink, Outlet } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  LayoutDashboard,
  Activity,
  Box,
  SlidersHorizontal,
  BarChart3,
  Bot,
  Wifi,
  WifiOff,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/sensors", icon: Activity, label: "Sensors" },
  { to: "/greenhouse", icon: Box, label: "3D Greenhouse" },
  { to: "/control", icon: SlidersHorizontal, label: "Control" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/assistant", icon: Bot, label: "AI Assistant" },
];

export default function Layout({ onLogout }) {
  const { connected } = useWebSocket();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-xl font-bold text-greenhouse-400">
            Digital Twin
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Greenhouse & Water-Culture Farm
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-greenhouse-600/20 text-greenhouse-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs mb-4">
            {connected ? (
              <>
                <Wifi size={14} className="text-greenhouse-400" />
                <span className="text-greenhouse-400">Live Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-red-400" />
                <span className="text-red-400">Disconnected</span>
              </>
            )}
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
        <Outlet />
      </main>
    </div>
  );
}
