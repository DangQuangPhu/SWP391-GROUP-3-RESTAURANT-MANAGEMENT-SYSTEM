import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, ChefHat } from "lucide-react";

export function KitchenLayout({ currentUser, onSignOut }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-gray-900 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight">Phūrai KDS</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Kitchen Display System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-800">{currentUser?.full_name}</p>
            <p className="text-xs text-amber-600 font-medium">{currentUser?.role_name}</p>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
