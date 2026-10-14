import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Home,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Menu,
  Lightbulb,
  Calendar,
  Search,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  Layers,
  X
} from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const { t } = useLanguage();
  const { hasPermission, isAdmin } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const navItems = [
    { id: 'home', label: t('home'), icon: Home },
    { id: 'maintenance', label: t('maintenance'), icon: Wrench },
    { id: 'issue', label: t('newIssue'), icon: AlertTriangle, highlight: true },
    { id: 'tickets', label: t('tickets'), icon: ClipboardList }
  ];

  const moreItems = [
    { id: 'pmOrders', label: t('pmOrders'), icon: Calendar, perm: 'pm' },
    { id: 'kaizen', label: t('kaizen'), icon: Lightbulb, perm: 'suggestions' },
    { id: 'errorScanner', label: t('errorScanner'), icon: Search, perm: 'errorScanner' },
    { id: 'dailyAM', label: t('dailyAM'), icon: CheckSquare, perm: 'maintenance' },
    { id: 'fiveS', label: t('fiveS'), icon: Layers, perm: 'maintenance' },
    { id: 'stats', label: t('stats'), icon: BarChart3, perm: 'statistics' },
    { id: 'machines', label: t('machines'), icon: Wrench, perm: 'machines' },
    { id: 'users', label: t('users'), icon: Users, perm: 'users' },
    { id: 'settings', label: t('settings'), icon: Settings, perm: 'settings' }
  ];

  return (
    <>
      {/* Slide-over More Sheet */}
      {showMoreMenu && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity"
          onClick={() => setShowMoreMenu(false)}
        >
          <div 
            className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚡</span> جميع أقسام وخدمات النظام
              </h3>
              <button 
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {moreItems.map(item => {
                const Icon = item.icon;
                const allowed = item.perm ? hasPermission(item.perm) : true;
                if (!allowed && !isAdmin) return null;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setShowMoreMenu(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer ${
                      currentView === item.id 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center mb-2">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-1.5 px-3 md:hidden">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            if (item.highlight) {
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
                >
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 p-0.5 shadow-lg shadow-red-900/50 group-active:scale-95 transition-transform flex items-center justify-center">
                    <div className="w-full h-full rounded-2xl bg-slate-900/30 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white animate-pulse" />
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-red-400 mt-1">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
                  isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </button>
            );
          })}

          {/* More Drawer Button */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
              showMoreMenu ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">المزيد</span>
          </button>
        </div>
      </nav>
    </>
  );
};
