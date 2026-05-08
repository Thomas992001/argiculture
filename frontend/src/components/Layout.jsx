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
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-950">
      
      {/* ── MOBILE TOP HEADER ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-greenhouse-400">AgriTwin-MRV</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {connected ? (
              <Wifi size={14} className="text-greenhouse-400" />
            ) : (
              <WifiOff size={14} className="text-red-400" />
            )}
          </div>
          <button onClick={onLogout} className="text-red-400 hover:text-red-300">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex w-64 bg-gray-900 border-r border-gray-800 flex-col shrink-0 z-10">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-xl font-bold text-greenhouse-400">
            Digital Twin
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Greenhouse & Water-Culture Farm
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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

      {/* ── MAIN CONTENT ── */}
      {/* pb-20 on mobile to leave space for the bottom nav bar */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 relative z-0">
        <Outlet />
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50 flex items-center justify-between px-1 pb-safe">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                isActive ? "text-greenhouse-400" : "text-gray-500 hover:text-gray-300"
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[9px] font-medium truncate max-w-full px-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
