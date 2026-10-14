import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Shield,
  Wrench,
  Globe
} from 'lucide-react';

interface HeaderProps {
  onOpenNotifications: () => void;
  unreadCount?: number;
  onNavigate: (view: string) => void;
  currentView: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  unreadCount = 0,
  onNavigate,
  currentView
}) => {
  const { user, logout, isAdmin, isManager } = useAuth();
  const { lang, setLang, t, isRtl } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => onNavigate('home')} 
          className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 p-1 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <img 
              src="/assets/branding/logo-mark.png" 
              alt="Logo" 
              className="w-full h-full object-contain filter drop-shadow"
              onError={(e) => {
                // Fallback icon if image fails
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <Wrench className="w-6 h-6 text-white" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
                MAINTENANCE SYSTEM
              </span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                PRO v1.3
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate max-w-[180px] sm:max-w-xs">
              {lang === 'ar' ? 'نظام إدارة الصيانة وتحليل العيوب' : 'Maintenance & Defect Analysis'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title={lang === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline text-[11px] uppercase font-bold">{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-amber-400 transition active:scale-95 cursor-pointer"
            title="تبديل المظهر"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition active:scale-95 cursor-pointer"
            title="الإشعارات والتنبيهات"
          >
            <Bell className="w-4 h-4 text-blue-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Badge */}
          {user && (
            <div className="flex items-center gap-2 pl-1 sm:pl-2">
              <div 
                onClick={() => onNavigate('settings')} 
                className="hidden md:flex flex-col text-right cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                    {user.name}
                  </span>
                  {isAdmin && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[10px] text-slate-400 capitalize">
                  {user.role} {user.department ? `• ${user.department}` : ''}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="p-2 sm:p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 transition active:scale-95 cursor-pointer"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
