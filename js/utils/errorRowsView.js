// ============================================================
// errorRowsView.js
// بناء HTML لقائمة "الأعطال المستخرجة" في Machine Error Scanner.
// دوال pure (نص -> نص) بدون DOM/Firebase عشان تتختبر مباشرة؛ errorScanner.js هو
// اللي بيربطها بالصفحة. كل نص ديناميكي (كود/وصف/ماكينة) بيمر على escapeHtml.
// ============================================================

import { escapeHtml, escapeJsArg } from './escapeHtml.js';

function fmt(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : ''));
}

export function statusMeta(row, tr) {
  if (row.unreadable && !String(row.code || '').trim()) {
    return { label: tr.rowEnterCode, cls: 'bg-gray-500/10 text-gray-300 border-gray-500/30', border: 'border-gray-600' };
  }
  if (row.status === 'matched') {
    return { label: tr.rowMatched, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', border: 'border-emerald-500/40' };
  }
  if (row.status === 'unknown') {
    return {
      label: String(row.code || '').trim() ? tr.rowUnknown : tr.rowEnterCode,
      cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      border: 'border-blue-500/30'
    };
  }
  return { label: tr.rowReview, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', border: 'border-amber-500/40' };
}

export function badgeClass(meta) {
  return `text-[10px] px-2 py-0.5 rounded-full border font-bold ${meta.cls}`;
}

export function approveMeta(row, tr) {
  const hasCode = !!String(row.code || '').trim();
  // قراءة ملتبسة (O59) ومعها كود واحد مشابه في القاعدة (059): زر واحد يوضّح الكود اللي هيتعتمد
  const single = row.match && row.match.state === 'possible' && row.match.lookalikes.length === 1
    ? row.match.lookalikes[0].errorCode : '';
  const label = row.approved
    ? tr.rowApproved
    : (single ? fmt(tr.rowApproveAs, { code: single }) : (row.status === 'matched' ? tr.rowApproveShow : tr.rowApprove));
  const cls = `col-span-3 py-2 rounded-xl text-[11px] font-black border transition active:scale-95 disabled:opacity-40 ${row.approved ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'}`;
  return { label, cls, disabled: !hasCode };
}

// الجزء المتغيّر من البطاقة (تحذيرات + حالة المطابقة + اقتراحات). بيتعاد رسمه لوحده عند التعديل
// اليدوي عشان خانات الإدخال ماتفقدش التركيز.
export function renderRowInfoHtml(row, tr, { suggestions = [] } = {}) {
  const parts = [];
  const rid = escapeJsArg(row.id);
  const match = row.match || { state: 'none', entries: [], lookalikes: [] };
  const hasCode = !!String(row.code || '').trim();

  if (row.unreadable && !hasCode) {
    parts.push(`<div class="text-[11px] text-gray-400">${escapeHtml(tr.rowUnreadable)}</div>`);
  }

  if (row.suspect && row.altCode) {
    parts.push(`<div class="text-[11px] text-amber-400">⚠️ ${escapeHtml(fmt(tr.suspectWarn, { code: row.code, alt: row.altCode }))}</div>`);
  }
  if (row.conflict) {
    parts.push(`<div class="text-[11px] text-amber-400">⚠️ ${escapeHtml(fmt(tr.conflictWarn, { code: row.code, other: row.conflict }))}</div>`);
  }
  if (hasCode && !row.reliable && !row.suspect && !row.conflict && !row.manual) {
    parts.push(`<div class="text-[11px] text-amber-400">⚠️ ${escapeHtml(tr.lowConfWarn)}</div>`);
  }

  if (row.descMismatch) {
    parts.push(`<div class="text-[11px] text-amber-400">⚠️ ${escapeHtml(tr.descMismatchWarn)}</div>`);
  }

  if (hasCode) {
    if (match.state === 'exact') {
      const entry = match.entries[0] || {};
      const statusText = entry.status === 'pending_review' ? tr.pendingReviewStatus : tr.verifiedStatus;
      parts.push(`<div class="text-[11px] text-emerald-400">✅ ${escapeHtml(fmt(tr.matchExact, { machine: entry.machine || '-', status: statusText }))}</div>`);
      if (match.lookalikes.length) {
        parts.push(`<div class="text-[11px] text-amber-400">⚠️ ${escapeHtml(fmt(tr.lookalikeWarn, { codes: match.lookalikes.map(e => e.errorCode).join(' / ') }))}</div>`);
      }
      // الوصف المسجّل للكود (للمقارنة) + استبدال وصف OCR به بنقرة لو مختلف
      const recorded = String(row.kbMessage || '').trim();
      const norm = text => String(text || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
      if (recorded && norm(recorded) !== norm(row.message)) {
        parts.push(`<div class="text-[11px] text-gray-300" dir="ltr">${escapeHtml(fmt(tr.recordedDesc, { desc: recorded }))}</div>`);
        parts.push(`<button type="button" onclick="window.errRowUseKbMessage('${rid}')" class="px-2.5 py-1 rounded-lg bg-[#1E293B] border border-gray-600 text-[11px] text-white active:scale-95">${escapeHtml(tr.useRecordedDesc)}</button>`);
      }
    } else if (match.state === 'other-machine') {
      const machines = [...new Set(match.entries.map(e => e.machine).filter(Boolean))].join(' / ') || '-';
      parts.push(`<div class="text-[11px] text-amber-400">⚠️ ${escapeHtml(fmt(tr.matchOther, { machine: machines }))}</div>`);
    } else if (match.state === 'possible') {
      parts.push(`<div class="text-[11px] text-amber-400">${escapeHtml(tr.matchPossible)}</div>`);
      parts.push(`<div class="flex flex-wrap gap-2">${match.lookalikes.map(e => `
        <button type="button" onclick="window.errRowUseKb('${rid}','${escapeJsArg(e.errorCode)}')"
          class="px-2.5 py-1 rounded-lg bg-[#1E293B] border border-amber-500/40 text-[11px] text-white active:scale-95">
          <span class="font-black text-blue-400">${escapeHtml(e.errorCode)}</span>
          <span class="text-gray-400"> ${escapeHtml(e.errorMessage || '')}</span>
        </button>`).join('')}</div>`);
    } else {
      parts.push(`<div class="text-[11px] text-gray-400">${escapeHtml(tr.matchNone)}</div>`);
    }
  }

  if (suggestions.length) {
    parts.push(`<div class="text-[11px] text-gray-400">${escapeHtml(tr.suggestionLabel)}</div>`);
    parts.push(`<div class="flex flex-wrap gap-2">${suggestions.map(sg => `
      <button type="button" onclick="window.errRowUseKb('${rid}','${escapeJsArg(sg.code)}')"
        class="px-2.5 py-1 rounded-lg bg-[#1E293B] border border-gray-600 text-[11px] text-white active:scale-95">
        <span class="font-black text-blue-400">${escapeHtml(sg.code)}</span>
        <span class="text-gray-400"> ${escapeHtml(sg.message || '')} · ${sg.confidence}%</span>
      </button>`).join('')}</div>`);
  }

  return parts.join('');
}

export function renderRowCardHtml(row, tr, { suggestions = [] } = {}) {
  const meta = statusMeta(row, tr);
  const rid = escapeJsArg(row.id);
  const idAttr = escapeHtml(row.id);
  const confidence = row.manual ? '' : (row.confidence ? fmt(tr.rowConf, { n: row.confidence }) : '');
  const seen = row.occurrences > 1 ? fmt(tr.rowSeen, { n: row.occurrences }) : '';
  const approve = approveMeta(row, tr);

  return `
  <div id="errRow_${idAttr}" class="bg-[#0F172A] border ${meta.border} rounded-2xl p-3 space-y-2 ${row.approved ? 'ring-1 ring-emerald-500/60' : ''}">
    <div class="flex items-center justify-between gap-2">
      <span id="errRowBadge_${idAttr}" class="${badgeClass(meta)}">${escapeHtml(meta.label)}</span>
      <span class="text-[10px] text-gray-500">${escapeHtml([confidence, seen].filter(Boolean).join(' · '))}</span>
    </div>
    <input type="text" dir="ltr" maxlength="24" autocomplete="off" spellcheck="false"
      value="${escapeHtml(row.code || '')}" placeholder="${escapeHtml(tr.rowCodePh)}"
      oninput="window.errRowEdit('${rid}','code',this.value)"
      class="w-full p-2.5 rounded-xl bg-[#1E293B] border border-gray-700 text-blue-400 font-black text-sm outline-none uppercase focus:border-indigo-400"/>
    <textarea rows="2" dir="ltr" spellcheck="false" placeholder="${escapeHtml(tr.rowMsgPh)}"
      oninput="window.errRowEdit('${rid}','message',this.value)"
      class="w-full p-2.5 rounded-xl bg-[#1E293B] border border-gray-700 text-gray-100 text-xs outline-none resize-none focus:border-indigo-400">${escapeHtml(row.message || '')}</textarea>
    <div id="errRowInfo_${idAttr}" class="space-y-1.5">${renderRowInfoHtml(row, tr, { suggestions })}</div>
    <div class="grid grid-cols-5 gap-2">
      <button type="button" id="errRowApproveBtn_${idAttr}" onclick="window.errRowApprove('${rid}')" ${approve.disabled ? 'disabled' : ''}
        class="${approve.cls}">${escapeHtml(approve.label)}</button>
      <button type="button" onclick="window.errRowReread('${rid}')" ${row.busy ? 'disabled' : ''}
        class="col-span-1 py-2 rounded-xl text-[11px] font-bold bg-gray-700/60 border border-gray-600 text-gray-200 transition active:scale-95 disabled:opacity-40">${escapeHtml(row.busy ? '…' : '🔄')}</button>
      <button type="button" onclick="window.errRowRemove('${rid}')"
        class="col-span-1 py-2 rounded-xl text-[11px] font-bold bg-red-600/10 border border-red-500/30 text-red-300 transition active:scale-95">🗑</button>
    </div>
  </div>`;
}

export function renderRowsListHtml(rows, tr, suggestionsById = {}) {
  const approvable = rows.some(r => r.status === 'matched' && !r.approved);
  return `
    <div class="flex items-center justify-between gap-2">
      <div class="text-[12px] font-black text-indigo-300">${escapeHtml(fmt(tr.rowsTitle, { n: rows.length }))}</div>
      ${approvable ? `<button type="button" onclick="window.errRowApproveMatched()" class="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-bold active:scale-95">${escapeHtml(tr.rowApproveAll)}</button>` : ''}
    </div>
    <div class="text-[11px] text-gray-400">${escapeHtml(tr.rowsHint)}</div>
    ${rows.map(row => renderRowCardHtml(row, tr, { suggestions: suggestionsById[row.id] || [] })).join('')}
    <button type="button" onclick="window.errRowAdd()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-gray-700/50 border border-gray-600 text-gray-200 active:scale-95">${escapeHtml(tr.rowAddManual)}</button>`;
}
