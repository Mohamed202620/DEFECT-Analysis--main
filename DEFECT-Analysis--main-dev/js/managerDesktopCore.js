// ============================================================
// managerDesktopCore.js - MGR-DESKTOP
// إدارة تفعيل وفحص وضع المدير على أجهزة الكمبيوتر
// ============================================================

import { isManagerRole, getCurrentRole } from './permissions.js';

export function isManagerDesktopEligible() {
  if (typeof window === "undefined" || !document.body) return false;
  
  // 1) الدور manager أو supervisor باستخدام isManagerRole(getCurrentRole())
  const role = typeof getCurrentRole === "function" ? getCurrentRole() : (localStorage.getItem("role") || "");
  const isMgr = typeof isManagerRole === "function" ? isManagerRole(role) : (role === "manager" || role === "supervisor");
  if (!isMgr) return false;

  // 2) عرض الشاشة >= 1280px (كمبيوتر/لابتوب) وليس portrait
  const isWide = window.innerWidth >= 1280;
  const isPortrait = typeof window.matchMedia === "function" && window.matchMedia("(orientation: portrait)").matches;
  
  return isWide && !isPortrait;
}

export function applyManagerDesktopMode() {
  if (typeof document === "undefined" || !document.body) return false;
  const eligible = isManagerDesktopEligible();
  if (eligible) {
    if (!document.body.classList.contains("mgr-desktop")) {
      document.body.classList.add("mgr-desktop");
    }
  } else {
    if (document.body.classList.contains("mgr-desktop")) {
      document.body.classList.remove("mgr-desktop");
    }
  }
  return eligible;
}

window.isManagerDesktopEligible = isManagerDesktopEligible;
window.applyManagerDesktopMode = applyManagerDesktopMode;
