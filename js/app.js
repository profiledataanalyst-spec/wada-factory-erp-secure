(() => {
  'use strict';

  const UI_STORAGE_KEY = 'factoryERP_ui_v9';
  const LEGACY_STORAGE_KEYS = [
    'factoryERP_vanilla_v5_executive_stage',
    'factoryERP_vanilla_v1',
    'factoryERP_vanilla_v2',
    'factoryERP_vanilla_v3_production',
    'factoryERP_vanilla_v4_operations'
  ];
  const BUSINESS_COLLECTIONS = ['projects', 'items', 'shortages', 'issues', 'audit', 'notifications'];
  const ENTITY_TYPES = Object.freeze({
    projects: 'projects', items: 'items', shortages: 'shortages', issues: 'issues', audit: 'audit', notifications: 'notifications'
  });
  let legacyBusinessSnapshot = null;
  const STAGES = [
    'PLANNING', 'CUTTING', 'FABRICATION', 'GRINDING',
    'PRE-COATING', 'POWDER COATING', 'READY FOR DISPATCH'
  ];
  const LEGACY_STAGES = [
    'PLANNING', 'MRN - STORES', 'CUTTING', 'FABRICATION', 'GRINDING',
    'PRE-COATING', 'POWDER COATING', 'ASSEMBLY', 'READY FOR DISPATCH'
  ];
  const LEGACY_STAGE_FALLBACKS = Object.freeze({
    'MRN - STORES': 'PLANNING',
    'ASSEMBLY': 'POWDER COATING'
  });

  const SECTIONS = ['Aluminium', 'Store', 'Fabrication', 'Outsource'];

  const TEMPLATE_HEADERS = [
    'PROJECT NAME', 'ITEM NAME', 'SECTION', 'SITE DETAILS', 'SIZE', 'BOM', 'QTY',
    'BOM NUMBER', 'JOB NO', 'BOM ISSUE DATE', 'DRAWING ISSUE DATE',
    'INDENT NO', 'INDENT ISSUE DATE', 'TENT DEL DATE', 'SHORTAGES', 'STATUS'
  ];

  const BRAND = {
    name: 'Profile Solutions',
    erpName: 'Profile Solutions Procurement ERP',
    tagline: 'Data Center Infrastructure Experts',
    factory: 'Wada Manufacturing Unit',
    logo: 'assets/profile-solutions-logo.svg',
    mark: 'assets/favicon.svg',
    website: 'https://www.profile-solution.com/',
    heroImage: 'https://www.profile-solution.com/wp-content/uploads/profilell-newww-1-1.webp',
    dataCenterImage: 'https://www.profile-solution.com/wp-content/uploads/Data-Centerrrrrrrrrrr-new-1.webp'
  };

  function svgIcon(name, className = 'app-icon') {
    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      projects: '<path d="M3 7h5l2 2h11v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/>',
      production: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/>',
      import: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2"/>',
      reports: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 21h22"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      audit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.37.3.72.6 1 .27.26.62.4 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6.6Z"/>',
      shortage: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      delete: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
      upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      project: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      item: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
      factory: '<path d="M3 21V9l6 3V8l6 4V5l6 4v12Z"/><path d="M7 21v-4h4v4M16 14h1M16 18h1"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      issue: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
      ready: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      chevronLeft: '<path d="m15 18-6-6 6-6"/>',
      chevronDown: '<path d="m6 9 6 6 6-6"/>',
      refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 11M4 13l2.4 5a7 7 0 0 0 11.5-2"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>'
    };
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.issue}</svg>`;
  }

  function brandLogo(className = 'brand-logo') {
    return `<img class="${className}" src="${BRAND.logo}" alt="Profile Solutions" decoding="async">`;
  }

  const ICONS = {
    dashboard: svgIcon('dashboard'), projects: svgIcon('projects'), production: svgIcon('production'), import: svgIcon('import'), reports: svgIcon('reports'),
    users: svgIcon('users'), audit: svgIcon('audit'), settings: svgIcon('settings'), shortage: svgIcon('shortage'), logout: svgIcon('logout'),
    search: svgIcon('search'), bell: svgIcon('bell'), menu: svgIcon('menu'), theme: svgIcon('theme'), plus: svgIcon('plus'), edit: svgIcon('edit'),
    view: svgIcon('view'), delete: svgIcon('delete'), download: svgIcon('download'), upload: svgIcon('upload'), check: svgIcon('check'), clock: svgIcon('clock'),
    project: svgIcon('project'), item: svgIcon('item'), factory: svgIcon('factory'), target: svgIcon('target'), issue: svgIcon('issue'), ready: svgIcon('ready'),
    chevronLeft: svgIcon('chevronLeft'), chevronDown: svgIcon('chevronDown'), refresh: svgIcon('refresh'), lock: svgIcon('lock'), mail: svgIcon('mail'),
    user: svgIcon('user'), shield: svgIcon('shield'), calendar: svgIcon('calendar'), arrowRight: svgIcon('arrowRight')
  };

  const NAV = [
    { id: 'dashboard', label: 'Procurement Overview', icon: ICONS.dashboard, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Overview' },
    { id: 'projects', label: 'Projects', icon: ICONS.projects, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Operations' },
    { id: 'production', label: 'Production Tracker', icon: ICONS.production, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Operations' },
    { id: 'shortages', label: 'Shortages & Issues', icon: ICONS.shortage, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Operations' },
    { id: 'import', label: 'Excel Import', icon: ICONS.import, roles: ['ADMIN','MANAGER'], section: 'Data & Reports' },
    { id: 'reports', label: 'Reports', icon: ICONS.reports, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Data & Reports' },
    { id: 'users', label: 'User Management', icon: ICONS.users, roles: ['ADMIN','MANAGER'], section: 'Administration' },
    { id: 'audit', label: 'Audit Logs', icon: ICONS.audit, roles: ['ADMIN'], section: 'Administration' },
    { id: 'settings', label: 'Settings & Backup', icon: ICONS.settings, roles: ['ADMIN'], section: 'Administration' }
  ];

  const APP_VERSION = '11.3.0';
  const API_TIMEOUT_MS = 22000;
  const SESSION_REFRESH_WINDOW_SECONDS = 90;
  const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

  let state = loadState();
  const legacyApplicationNames = ['Factory' + ' ERP', 'Profile Solutions' + ' ERP', 'Profile Solutions Production' + ' ERP'];
  if (legacyApplicationNames.includes(state.settings.companyName)) state.settings.companyName = BRAND.erpName;
  if (state.settings.factoryName === 'Main Manufacturing Unit') state.settings.factoryName = BRAND.factory;
  let currentRoute = 'dashboard';
  let supabaseClient = null;
  let authSession = null;
  let currentProfile = null;
  let appConfig = null;
  let setupRequired = false;
  let authInitialized = false;
  let authView = 'login';
  let authMessage = '';
  let passwordFlow = '';
  let importBuffer = null;
  let globalSearchTimer = null;
  let operationalDataReady = false;
  let applyingRemoteData = false;
  let lastSyncedBusiness = null;
  let syncTimer = null;
  let syncInFlight = false;
  let syncRequestedWhileBusy = false;
  let syncWaiters = [];
  let realtimeChannel = null;
  let pendingRealtimePayloads = [];
  let realtimeReloadTimer = null;
  let realtimeRenderTimer = null;
  let operationalLoadPromise = null;
  let remoteReloadPending = false;
  let bulkImportInFlight = false;
  let operationalRecordVersions = new Map();
  const itemWorkflowLocks = new Set();
  const operationalMutationLocks = new Set();
  let realtimeReconnectTimer = null;
  let realtimeReconnectAttempt = 0;
  let realtimeFallbackTimer = null;
  let realtimeStatus = 'IDLE';
  let realtimeGeneration = 0;
  let lastOperationalLoadAt = 0;
  let sessionRefreshPromise = null;
  let authTransitionChain = Promise.resolve();
  let authStateSubscription = null;
  let authenticatedStartupPromise = null;
  let sessionExpiryInProgress = false;
  let globalClickListenerInstalled = false;
  let activeProjectItemsModalProjectId = '';
  let projectItemsModalReloadTimer = null;
  let projectItemsModalSaving = false;

  function defaultState() {
    return {
      version: 11,
      settings: {
        companyName: 'Profile Solutions Procurement ERP',
        factoryName: 'Wada Manufacturing Unit',
        theme: 'light',
        dateFormat: 'DD/MM/YYYY',
        notifications: true,
        sidebarCollapsed: false
      },
      users: [],
      projects: [],
      items: [],
      shortages: [],
      issues: [],
      audit: [],
      notifications: []
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const uiRaw = localStorage.getItem(UI_STORAGE_KEY);
      if (uiRaw) {
        const ui = JSON.parse(uiRaw);
        base.settings = { ...base.settings, ...(ui.settings || {}) };
      }
    } catch (error) {
      console.warn('UI preference load failed', error);
    }

    for (const key of LEGACY_STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const hasBusinessData = BUSINESS_COLLECTIONS.some(name => Array.isArray(parsed?.[name]) && parsed[name].length > 0);
        if (hasBusinessData && !legacyBusinessSnapshot) {
          legacyBusinessSnapshot = Object.fromEntries(BUSINESS_COLLECTIONS.map(name => [name, Array.isArray(parsed[name]) ? parsed[name] : []]));
        }
        if (!localStorage.getItem(UI_STORAGE_KEY) && parsed?.settings) {
          base.settings = { ...base.settings, ...parsed.settings };
        }
      } catch (error) {
        console.warn(`Legacy ERP data could not be read from ${key}`, error);
      }
    }
    return base;
  }

  function saveUiPreferences() {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ settings: state.settings }));
  }

  function saveState() {
    saveUiPreferences();
    if (operationalDataReady && !applyingRemoteData && authSession) return queueOperationalSync();
    return Promise.resolve({ ok: true, skipped: true });
  }

  function restoreBusinessState(snapshot) {
    if (!snapshot) return;
    applyingRemoteData = true;
    try {
      for (const name of BUSINESS_COLLECTIONS) state[name] = sortBusinessCollection(name, cloneJson(snapshot[name] || []));
    } finally {
      applyingRemoteData = false;
    }
  }

  function createRequestId(prefix = 'REQ') {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function uid(prefix = 'ID') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  }

  function nowISO() { return new Date().toISOString(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }
  function number(value) { return Number(value || 0); }
  function fmtNumber(value) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(number(value)); }
  function fmtDate(value, includeTime = false) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return esc(value);
    return new Intl.DateTimeFormat('en-GB', includeTime ? {
      day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
    } : { day:'2-digit', month:'short', year:'numeric' }).format(d);
  }
  function initials(name = '') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'U'; }
  function slugStatus(value='') { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function statusChip(value) {
    const text = value || 'Pending';
    let cls = 'status-neutral';
    if (/complete|approved|ready|active|resolved/i.test(text)) cls = 'status-completed';
    else if (/delay|reject|hold|critical|open issue/i.test(text)) cls = 'status-delayed';
    else if (/progress|planning|pending|approach/i.test(text)) cls = 'status-pending';
    else if (/submit|assigned|info/i.test(text)) cls = 'status-info';
    return `<span class="status ${cls}">${esc(text)}</span>`;
  }
  function normalizedStageName(stageName, stageIndex, assumeLegacyIndex = false) {
    const rawName = String(stageName || '').trim().toUpperCase().replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ');
    const compact = rawName.replace(/[\s-]/g, '');
    const retained = STAGES.find(name => name.replace(/[\s-]/g, '') === compact);
    if (retained) return retained;
    const legacyName = LEGACY_STAGES.find(name => name.replace(/[\s-]/g, '') === compact);
    if (legacyName) return LEGACY_STAGE_FALLBACKS[legacyName] || legacyName;
    const numeric = Number(stageIndex);
    if (Number.isInteger(numeric)) {
      if (!assumeLegacyIndex && numeric >= 0 && numeric < STAGES.length) return STAGES[numeric];
      if (numeric >= 0 && numeric < LEGACY_STAGES.length) {
        const fromLegacy = LEGACY_STAGES[numeric];
        return LEGACY_STAGE_FALLBACKS[fromLegacy] || fromLegacy;
      }
    }
    return STAGES[0];
  }

  function normalizeProductionItemRecord(record, assumeLegacyIndex = false) {
    if (!record || typeof record !== 'object') return record;
    const normalized = { ...record };
    const stageName = normalizedStageName(normalized.currentStageName, normalized.currentStage, assumeLegacyIndex || !normalized.currentStageName);
    normalized.currentStage = STAGES.indexOf(stageName);
    normalized.currentStageName = stageName;
    normalized.uom = String(normalized.uom || 'Nos.').trim() || 'Nos.';
    normalized.projectLineItemId = String(normalized.projectLineItemId || '').trim();
    normalized.quantity = Number(normalized.quantity || 0);
    normalized.dispatchQuantity = Number(normalized.dispatchQuantity || 0);
    normalized.pendingQuantity = Math.max(0, normalized.quantity - normalized.dispatchQuantity);
    if (Array.isArray(normalized.history)) {
      normalized.history = normalized.history.map(event => {
        if (!event || typeof event !== 'object') return event;
        const eventStageName = normalizedStageName(event.stageName, event.stageIndex, assumeLegacyIndex || !event.stageName);
        return { ...event, stageIndex: STAGES.indexOf(eventStageName), stageName: eventStageName };
      });
    }
    return normalized;
  }

  function getCurrentUser() { return currentProfile || state.users.find(u => u.id === authSession?.user?.id) || null; }
  function can(...roles) { return roles.includes(getCurrentUser()?.role); }
  function roleLabel(role) { return role === 'ADMIN' ? 'SUPER ADMIN' : role; }
  function requireRole(...roles) {
    if (can(...roles)) return true;
    toast('Access denied', 'Your role does not have permission to perform this action.', 'error');
    return false;
  }
  function manageableExecutives(managerId = getCurrentUser()?.id) {
    if (!managerId) return [];
    const assigned = new Set(state.projects.filter(p => p.managerId === managerId).flatMap(p => p.executiveIds || []));
    return state.users.filter(u => u.role === 'EXECUTIVE' && (u.createdBy === managerId || assigned.has(u.id)));
  }
  function canManageUser(target) {
    const current = getCurrentUser();
    if (!current || !target || target.role === 'ADMIN' || target.id === current.id) return false;
    if (current.role === 'ADMIN') return true;
    return current.role === 'MANAGER' && target.role === 'EXECUTIVE' && target.createdBy === current.id;
  }
  function generateTemporaryPassword(length = 14) {
    const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
    const all = groups.join('');
    const pick = chars => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
    const chars = groups.map(pick);
    while (chars.length < length) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
  function projectById(id) { return state.projects.find(p => p.id === id); }
  function userById(id) { return state.users.find(u => u.id === id); }
  function itemById(id) { return state.items.find(i => i.id === id); }
  function canonicalSection(value) {
    const raw = String(value || '').trim().toLowerCase();
    return SECTIONS.find(section => section.toLowerCase() === raw) || '';
  }
  function itemSection(item) { return canonicalSection(item?.section) || 'Unassigned'; }
  function assignedExecutive(item) { return userById(String(item?.assignedExecutiveId || '')); }
  function assignedExecutiveName(item) { return assignedExecutive(item)?.name || 'Unassigned'; }
  function itemDueDate(item) { return item?.targetDate || projectById(item?.projectId)?.targetDate || ''; }
  function itemPriority(item) { return item?.priority || projectById(item?.projectId)?.priority || 'Medium'; }
  function itemTaskState(item) {
    if (item?.status === 'Completed' || Number(item?.currentStage || 0) >= STAGES.length - 1) return 'Completed';
    if (Number(item?.currentStage || 0) > 0 || ['Delayed','On Hold'].includes(item?.status)) return 'In Progress';
    return 'Pending';
  }
  function projectSections(projectId) {
    return [...new Set(state.items.filter(item => item.projectId === projectId).map(itemSection).filter(section => section !== 'Unassigned'))];
  }
  function assignedProjects() {
    const user = getCurrentUser();
    if (!user) return [];
    if (user.role !== 'EXECUTIVE') return state.projects;
    const assignedProjectIds = new Set(state.items.filter(item => String(item.assignedExecutiveId || '') === user.id).map(item => item.projectId));
    return state.projects.filter(project => assignedProjectIds.has(project.id) || (project.executiveIds || []).includes(user.id));
  }
  function visibleItems() {
    const user = getCurrentUser();
    if (!user) return [];
    const allowed = new Set(assignedProjects().map(project => project.id));
    return state.items.filter(item => allowed.has(item.projectId) && (user.role !== 'EXECUTIVE' || String(item.assignedExecutiveId || '') === user.id));
  }
  function visibleShortages() {
    const visibleItemIds = new Set(visibleItems().map(item => item.id));
    const visibleProjectIds = new Set(assignedProjects().map(project => project.id));
    const user = getCurrentUser();
    return state.shortages.filter(shortage => visibleItemIds.has(shortage.itemId) || (user?.role !== 'EXECUTIVE' && visibleProjectIds.has(shortage.projectId)) || (!shortage.itemId && visibleProjectIds.has(shortage.projectId)));
  }
  function canUpdateItemStage(item) {
    const user=getCurrentUser();
    return Boolean(user && item && ['ADMIN','MANAGER','EXECUTIVE'].includes(user.role));
  }
  function completionPercent(item) {
    if (!item) return 0;
    if (item.status === 'Completed' || item.currentStage >= STAGES.length - 1) return 100;
    const base = Math.max(0, Math.min(STAGES.length - 1, Number(item.currentStage || 0)));
    const pct = Math.round((base / (STAGES.length - 1)) * 100);
    return item.approvalStatus === 'SUBMITTED' ? Math.min(99, pct + 6) : pct;
  }
  function projectCompletion(projectId) {
    const items = state.items.filter(i => i.projectId === projectId);
    if (!items.length) return 0;
    return Math.round(items.reduce((a, i) => a + completionPercent(i), 0) / items.length);
  }
  function audit(action, module, details, entityId = '') {
    const user = getCurrentUser();
    state.audit.unshift({
      id: uid('AUD'), action, module, details, entityId,
      userId: user?.id || 'SYSTEM', userName: user?.name || 'System', createdAt: nowISO()
    });
    state.audit = state.audit.slice(0, 1000);
  }
  function notify(userId, title, message, type = 'Info', entityId = '') {
    if (!userId) return;
    state.notifications.unshift({ id: uid('NOT'), userId, title, message, type, entityId, read: false, createdAt: nowISO() });
    state.notifications = state.notifications.slice(0, 500);
  }
  function toast(title, message = '', type = 'success') {
    let c = document.querySelector('.toast-container');
    if (!c) {
      c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<div>${type === 'error' ? '!' : type === 'warning' ? '⚠' : '✓'}</div><div><strong>${esc(title)}</strong><span>${esc(message)}</span></div>`;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }


  function render() {
    document.documentElement.setAttribute('data-theme', state.settings.theme || 'light');
    if (!authInitialized) return renderAuthLoading();
    if (authView === 'set-password') return renderSetPassword();
    if (!authSession || !getCurrentUser()) return renderAuth();
    renderAppShell();
  }

  function renderAuthLoading() {
    document.getElementById('app').innerHTML = `
      <div class="loading-screen" role="status" aria-live="polite">
        <div class="loading-glow loading-glow-one"></div><div class="loading-glow loading-glow-two"></div>
        <div class="loading-card">
          ${brandLogo('loading-logo')}
          <div class="loading-orbit"><span></span><span></span><span></span></div>
          <h1>Profile Solutions Procurement ERP</h1>
          <p>Preparing your secure procurement workspace…</p>
          <div class="loading-progress"><span></span></div>
        </div>
      </div>`;
  }

  function renderAuth() {
    document.getElementById('app').innerHTML = `
      <div class="auth-shell">
        <section class="auth-visual" aria-label="Profile Solutions procurement platform">
          <div class="auth-photo-layer" aria-hidden="true"></div>
          <div class="auth-overlay" aria-hidden="true"></div>
          <div class="auth-brand-row">
            <div class="auth-logo-panel">${brandLogo('auth-brand-logo')}</div>
            <span class="auth-brand-chip">Enterprise Operations</span>
          </div>
          <div class="auth-hero">
            <span class="eyebrow"><i></i> Profile Solutions Procurement ERP</span>
            <h2>Engineering precision.<br><em>Operational clarity.</em></h2>
            <p>A unified procurement workspace for projects, production stages, shortages, reporting and secure role-based operations.</p>
            <div class="auth-stats">
              <div class="auth-stat"><span class="auth-stat-icon">${ICONS.production}</span><strong>${STAGES.length}</strong><span>Production stages</span></div>
              <div class="auth-stat"><span class="auth-stat-icon">${ICONS.shield}</span><strong>3</strong><span>Controlled role levels</span></div>
              <div class="auth-stat"><span class="auth-stat-icon">${ICONS.factory}</span><strong>1</strong><span>Connected workspace</span></div>
            </div>
          </div>
          <div class="auth-foot"><span>Profile Data Center Solutions Pvt. Ltd.</span><span>Data Center Infrastructure Experts</span></div>
        </section>
        <section class="auth-panel">
          <div class="auth-panel-inner">
            <div class="auth-mobile-brand">${brandLogo('auth-mobile-logo')}</div>
            <div class="auth-card">
              ${authMessage ? `<div class="info-banner ${authMessage.startsWith('ERROR:') ? 'danger' : ''}"><div>${authMessage.startsWith('ERROR:') ? ICONS.issue : ICONS.check}</div><div><p>${esc(authMessage.replace(/^ERROR:\s*/,''))}</p></div></div>` : ''}
              ${setupRequired ? setupForm() : loginForm()}
            </div>
            <p class="auth-security-note">${ICONS.lock}<span>Secured by Supabase Authentication and protected Netlify Functions</span></p>
          </div>
        </section>
      </div>`;
    bindAuthEvents();
  }

  function setupForm() {
    return `
      <div class="auth-card-heading"><span class="auth-card-icon">${ICONS.shield}</span><div><span class="eyebrow dark">Secure workspace setup</span><h2>Create First Super Admin</h2><p>This one-time setup creates the first secured administrator in Supabase.</p></div></div>
      <form id="setup-form" class="auth-form">
        <div class="form-group"><label for="setup-name">Full name</label><div class="input-shell"><span>${ICONS.user}</span><input id="setup-name" name="name" required placeholder="Your full name" autocomplete="name"></div></div>
        <div class="form-group"><label for="setup-email">Email Address</label><div class="input-shell"><span>${ICONS.mail}</span><input id="setup-email" name="email" type="email" required placeholder="admin@profile-solution.com" autocomplete="email"></div></div>
        <div class="form-group"><label for="setup-password">Password</label><div class="input-shell"><span>${ICONS.lock}</span><input id="setup-password" name="password" type="password" required minlength="10" placeholder="Strong password" autocomplete="new-password"></div></div>
        <div class="form-group"><label for="setup-confirm">Confirm password</label><div class="input-shell"><span>${ICONS.lock}</span><input id="setup-confirm" name="confirm" type="password" required minlength="10" placeholder="Repeat password" autocomplete="new-password"></div></div>
        <div class="password-rules">Use at least 10 characters with uppercase, lowercase, number and special character.</div>
        <button class="btn btn-primary btn-lg w-100 auth-submit" type="submit"><span>Create Super Admin</span>${ICONS.arrowRight}</button>
      </form>`;
  }

  function loginForm() {
    return `
      <div class="auth-card-heading"><span class="auth-card-icon">${ICONS.lock}</span><div><span class="eyebrow dark">Welcome to Profile Solutions</span><h2>Sign in to your ERP</h2><p>Use your company email and password to continue.</p></div></div>
      <form id="login-form" class="auth-form">
        <div class="form-group"><label for="login-email">Email Address</label><div class="input-shell"><span>${ICONS.mail}</span><input id="login-email" name="email" type="email" required placeholder="name@profile-solution.com" autocomplete="username"></div></div>
        <div class="form-group"><div class="label-row"><label for="login-password">Password</label><button type="button" class="auth-link" id="forgot-password-help">Forgot Password?</button></div><div class="input-shell"><span>${ICONS.lock}</span><input id="login-password" name="password" type="password" required placeholder="Enter your password" autocomplete="current-password"></div></div>
        <button class="btn btn-primary btn-lg w-100 auth-submit" type="submit"><span>Sign In</span>${ICONS.arrowRight}</button>
        <div class="auth-note">New users should sign in with the temporary password supplied by their Super Admin or Manager.</div>
      </form>`;
  }

  function renderSetPassword() {
    document.getElementById('app').innerHTML = `
      <div class="auth-shell">
        <section class="auth-visual password-visual">
          <div class="auth-photo-layer" aria-hidden="true"></div><div class="auth-overlay" aria-hidden="true"></div>
          <div class="auth-brand-row"><div class="auth-logo-panel">${brandLogo('auth-brand-logo')}</div><span class="auth-brand-chip">Secure Password Setup</span></div>
          <div class="auth-hero"><span class="eyebrow"><i></i> First login security</span><h2>Create your private<br><em>ERP password.</em></h2><p>Your temporary password has completed its purpose. Replace it now before accessing operational data.</p></div>
          <div class="auth-foot"><span>Profile Data Center Solutions Pvt. Ltd.</span><span>Secure • Controlled • Traceable</span></div>
        </section>
        <section class="auth-panel"><div class="auth-panel-inner"><div class="auth-mobile-brand">${brandLogo('auth-mobile-logo')}</div><div class="auth-card">
          <div class="auth-card-heading"><span class="auth-card-icon">${ICONS.shield}</span><div><span class="eyebrow dark">Required security step</span><h2>Change Temporary Password</h2><p>${esc(authSession?.user?.email || '')}</p></div></div>
          <form id="set-password-form" class="auth-form">
            <div class="form-group"><label for="new-password">New Password</label><div class="input-shell"><span>${ICONS.lock}</span><input id="new-password" name="password" type="password" required minlength="10" autocomplete="new-password" placeholder="Create a strong password"></div></div>
            <div class="form-group"><label for="confirm-password">Confirm Password</label><div class="input-shell"><span>${ICONS.lock}</span><input id="confirm-password" name="confirm" type="password" required minlength="10" autocomplete="new-password" placeholder="Repeat your new password"></div></div>
            <div class="password-rules">Minimum 10 characters, including uppercase, lowercase, number and special character.</div>
            <button class="btn btn-primary btn-lg w-100 auth-submit" type="submit"><span>Save New Password</span>${ICONS.arrowRight}</button>
          </form>
        </div><p class="auth-security-note">${ICONS.lock}<span>Your password is securely hashed by Supabase Authentication</span></p></div></section>
      </div>`;
    document.getElementById('set-password-form').addEventListener('submit', completePasswordFlow);
  }

  function strongPassword(value) {
    return value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
  }

  async function bindAuthEvents() {
    const setup = document.getElementById('setup-form');
    if (setup) setup.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(setup), name = String(fd.get('name') || '').trim(), email = String(fd.get('email') || '').trim().toLowerCase(), password = String(fd.get('password') || ''), confirm = String(fd.get('confirm') || '');
      if (password !== confirm) return toast('Password mismatch', 'Both passwords must be the same.', 'error');
      if (!strongPassword(password)) return toast('Weak password', 'Use 10+ characters with uppercase, lowercase, number and special character.', 'error');
      setFormBusy(setup, true);
      try {
        await callAuthAdmin('bootstrap', { fullName: name, email, password }, false);
        setupRequired = false;
        const { data, error } = await withTimeout(
          supabaseClient.auth.signInWithPassword({ email, password }),
          18000,
          'Sign-in timed out. Check the network connection and try again.',
        );
        if (error) throw error;
        authSession = data.session;
        await prepareAuthenticatedSession(data.session);
        currentRoute = 'dashboard';
        authMessage = '';
        render();
        toast('ERP setup completed', 'Your secure Super Admin account is ready.');
      } catch (error) { toast('Setup failed', error.message, 'error'); }
      finally { setFormBusy(setup, false); }
    });

    const login = document.getElementById('login-form');
    if (login) login.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(login), email = String(fd.get('email') || '').trim().toLowerCase(), password = String(fd.get('password') || '');
      setFormBusy(login, true);
      try {
        const { data, error } = await withTimeout(
          supabaseClient.auth.signInWithPassword({ email, password }),
          18000,
          'Sign-in timed out. Check the network connection and try again.',
        );
        if (error) throw error;
        authSession = data.session;
        const startup = await prepareAuthenticatedSession(data.session);
        if (startup.passwordChangeRequired) {
          authMessage = '';
          render();
          return;
        }
        currentRoute = 'dashboard'; authMessage = ''; render();
        audit('LOGIN', 'Authentication', 'User signed in', currentProfile.id);
        await saveState().catch(error => console.warn('Login audit could not be saved', error));
      } catch (err) {
        if (isAuthenticationFailure(err)) {
          await supabaseClient.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        authSession = null;
        currentProfile = null;
        stopOperationalRealtime();
        const title = isAuthenticationFailure(err) ? 'Login failed' : 'ERP connection failed';
        toast(title, err.message || 'Check your network connection and try again.', 'error');
        render();
      } finally { setFormBusy(login, false); }
    });

    document.getElementById('forgot-password-help')?.addEventListener('click', () => {
      toast('Password assistance', 'Contact your Super Admin or Manager to receive a new temporary password.', 'warning');
    });
  }

  function setFormBusy(form, busy) {
    form?.classList.toggle('is-busy', busy);
    form?.setAttribute('aria-busy', String(Boolean(busy)));
    form?.querySelectorAll('button,input,select').forEach(el => { el.disabled = busy; });
  }

  async function completePasswordFlow(e) {
    e.preventDefault();
    const form = e.currentTarget, fd = new FormData(form), password = String(fd.get('password') || ''), confirm = String(fd.get('confirm') || '');
    if (password !== confirm) return toast('Password mismatch', 'Both passwords must be the same.', 'error');
    if (!strongPassword(password)) return toast('Weak password', 'Use 10+ characters with uppercase, lowercase, number and special character.', 'error');
    setFormBusy(form, true);
    try {
      await callAuthAdmin('change-own-password', { newPassword: password });
      await supabaseClient.auth.signOut();
      authSession = null; currentProfile = null; passwordFlow = ''; authView = 'login';
      authMessage = 'Password changed successfully. Sign in using your email and new password.';
      render();
    } catch (error) { toast('Password update failed', error.message, 'error'); }
    finally { setFormBusy(form, false); }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message || 'The request timed out.')), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  async function expireSession(message = 'Your session has expired. Sign in again.') {
    if (sessionExpiryInProgress) return;
    sessionExpiryInProgress = true;
    try {
      stopOperationalRealtime();
      authSession = null;
      currentProfile = null;
      authView = 'login';
      passwordFlow = '';
      authMessage = `ERROR:${message}`;
      await supabaseClient?.auth.signOut({ scope: 'local' }).catch(() => {});
      render();
    } finally {
      sessionExpiryInProgress = false;
    }
  }

  async function ensureFreshSession(forceRefresh = false) {
    if (!supabaseClient) throw new Error('Authentication is not initialized.');
    if (sessionRefreshPromise) return sessionRefreshPromise;
    sessionRefreshPromise = (async () => {
      const { data, error } = await withTimeout(
        supabaseClient.auth.getSession(),
        12000,
        'Unable to verify your session. Check the network connection.',
      );
      if (error) throw error;
      let session = data?.session || null;
      const expiresSoon = session?.expires_at
        ? Number(session.expires_at) - Math.floor(Date.now() / 1000) <= SESSION_REFRESH_WINDOW_SECONDS
        : false;
      if (session && (forceRefresh || expiresSoon)) {
        const refreshed = await withTimeout(
          supabaseClient.auth.refreshSession(),
          15000,
          'Unable to refresh your session. Check the network connection.',
        );
        if (refreshed.error) throw refreshed.error;
        session = refreshed.data?.session || null;
      }
      authSession = session;
      if (!session?.access_token) {
        await expireSession();
        throw new Error('Your session has expired. Sign in again.');
      }
      return session;
    })();
    try { return await sessionRefreshPromise; }
    finally { sessionRefreshPromise = null; }
  }

  async function requestJson(url, options = {}, policy = {}) {
    const retries = Math.max(0, Number(policy.retries ?? 1));
    const timeoutMs = Math.max(1000, Number(policy.timeoutMs ?? API_TIMEOUT_MS));
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        const body = await response.json().catch(() => ({}));
        if (TRANSIENT_HTTP_STATUSES.has(response.status) && attempt < retries) {
          await delay(Math.min(2500, 300 * (2 ** attempt) + Math.floor(Math.random() * 160)));
          continue;
        }
        return { response, body };
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        if (attempt >= retries) break;
        await delay(Math.min(2500, 300 * (2 ** attempt) + Math.floor(Math.random() * 160)));
      }
    }
    if (lastError?.name === 'AbortError') throw new Error('The server request timed out. Please retry.');
    throw new Error(lastError?.message || 'The server is temporarily unavailable.');
  }

  async function authenticatedApiRequest(url, payload, policy = {}) {
    const requestBody = JSON.stringify(payload);
    for (let authAttempt = 0; authAttempt < 2; authAttempt += 1) {
      const session = await ensureFreshSession(authAttempt > 0);
      const { response, body } = await requestJson(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'X-ERP-Request-ID': String(payload.requestId || ''),
        },
        body: requestBody,
      }, policy);
      if (response.status === 401 && authAttempt === 0) continue;
      if (response.status === 401) {
        await expireSession(body.error || 'Your session has expired. Sign in again.');
      }
      if (!response.ok) {
        const error = new Error(body.error || 'Server request failed.');
        error.status = response.status;
        error.details = body;
        throw error;
      }
      return body;
    }
    throw new Error('Authentication request failed.');
  }

  async function callAuthAdmin(action, payload = {}, needsSession = true) {
    const requestId = payload.requestId || createRequestId('AUTH');
    const bodyPayload = { action, ...payload, requestId };
    if (needsSession) {
      return authenticatedApiRequest('/api/auth-admin', bodyPayload, { retries: 0, timeoutMs: API_TIMEOUT_MS });
    }
    const { response, body } = await requestJson('/api/auth-admin', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-ERP-Request-ID': requestId },
      body: JSON.stringify(bodyPayload),
    }, { retries: 0, timeoutMs: API_TIMEOUT_MS });
    if (!response.ok) throw new Error(body.error || 'Authentication request failed.');
    return body;
  }

  async function callDataApi(action, payload = {}) {
    const requestId = payload.requestId || createRequestId('DATA');
    return authenticatedApiRequest('/api/erp-data', { action, ...payload, requestId }, {
      retries: 2,
      timeoutMs: action === 'bulk-import' ? 60000 : API_TIMEOUT_MS,
    });
  }


  async function callProjectLineItemsApi(action, payload = {}) {
    const requestId = payload.requestId || createRequestId('PLI');
    return authenticatedApiRequest('/api/project-line-items', { action, ...payload, requestId }, {
      retries: 1,
      timeoutMs: 30000,
    });
  }

  function recordVersionKey(entity, recordId) {
    return `${entity}:${recordId}`;
  }

  function setControlBusy(control, busy) {
    if (!control) return;
    control.disabled = Boolean(busy);
    control.classList.toggle('is-busy-control', Boolean(busy));
    control.setAttribute('aria-busy', String(Boolean(busy)));
  }

  async function withOperationalMutationLock(key, control, task) {
    if (operationalMutationLocks.has(key)) {
      toast('Request already in progress', 'Wait for the current database operation to finish.', 'warning');
      return null;
    }
    operationalMutationLocks.add(key);
    setControlBusy(control, true);
    try { return await task(); }
    finally {
      operationalMutationLocks.delete(key);
      setControlBusy(control, false);
      drainRealtimePayloads();
    }
  }

  function workflowAuditRecord(action, details, entityId) {
    const user = getCurrentUser();
    return {
      id: uid('AUD'), action, module: 'Production', details, entityId,
      userId: user?.id || 'SYSTEM', userName: user?.name || 'System', createdAt: nowISO()
    };
  }

  function workflowNotificationRecord(userId, title, message, type, entityId) {
    return { id: uid('NOT'), userId, title, message, type, entityId, read: false, createdAt: nowISO() };
  }

  function applyConfirmedItemRecord(record, version = '') {
    if (!record?.id) return;
    const index = state.items.findIndex(item => item.id === record.id);
    const normalizedRecord = normalizeProductionItemRecord(record);
    if (index >= 0) state.items[index] = cloneJson(normalizedRecord);
    else state.items.push(cloneJson(normalizedRecord));
    state.items = sortBusinessCollection('items', state.items);
    if (version) operationalRecordVersions.set(recordVersionKey('items', record.id), version);
    if (lastSyncedBusiness) {
      const rows = Array.isArray(lastSyncedBusiness.items) ? lastSyncedBusiness.items : [];
      const syncedIndex = rows.findIndex(item => item.id === record.id);
      if (syncedIndex >= 0) rows[syncedIndex] = cloneJson(normalizedRecord);
      else rows.push(cloneJson(normalizedRecord));
      lastSyncedBusiness.items = sortBusinessCollection('items', rows);
    }
  }

  function hasUnsyncedOperationalChanges() {
    if (!operationalDataReady || applyingRemoteData || !lastSyncedBusiness) return false;
    return hasOperationalChanges(diffBusinessState(lastSyncedBusiness, extractBusinessState()));
  }

  async function persistItemWorkflowChange({ itemId, patch, historyEvents = [], auditRecords = [], notifications = [], control = null }) {
    if (itemWorkflowLocks.has(itemId)) {
      toast('Update already in progress', 'Wait for the current production-stage update to finish.', 'warning');
      return null;
    }
    const current = itemById(itemId);
    if (!current) return null;
    itemWorkflowLocks.add(itemId);
    setControlBusy(control, true);
    const expectedVersion = operationalRecordVersions.get(recordVersionKey('items', itemId)) || '';
    try {
      if (operationalLoadPromise) await operationalLoadPromise;
      const result = await callDataApi('update-item-workflow', {
        itemId,
        expectedVersion,
        patch,
        historyEvents,
        sideEffects: { audit: auditRecords, notifications }
      });
      applyConfirmedItemRecord(result.record, result.version);
      if (authSession && currentProfile && authView !== 'set-password') renderPage(currentRoute);
      return itemById(itemId);
    } catch (error) {
      console.error('Production workflow update failed', error);
      if (error.status === 409) {
        const latestRecord = error.details?.latestRecord;
        const latestVersion = error.details?.latestVersion;
        if (latestRecord?.id) applyConfirmedItemRecord(latestRecord, latestVersion);
        else {
          try { await loadOperationalData({ renderAfter: false }); }
          catch (reloadError) { console.error('Conflict reload failed', reloadError); }
        }
        if (authSession && currentProfile) renderPage(currentRoute);
        toast('Record changed by another user', error.message || 'The latest production item has been loaded. Review it and try again.', 'warning');
      } else {
        toast('Production update failed', error.message || 'The database did not save this update.', 'error');
      }
      return null;
    } finally {
      itemWorkflowLocks.delete(itemId);
      setControlBusy(control, false);
      drainRealtimePayloads();
      if (remoteReloadPending) {
        remoteReloadPending = false;
        scheduleOperationalReload(20);
      }
    }
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function emptyBusinessState() {
    return Object.fromEntries(BUSINESS_COLLECTIONS.map(name => [name, []]));
  }

  function extractBusinessState(source = state) {
    return Object.fromEntries(BUSINESS_COLLECTIONS.map(name => [name, cloneJson(Array.isArray(source[name]) ? source[name] : [])]));
  }

  function businessRecordCount(snapshot = extractBusinessState()) {
    return BUSINESS_COLLECTIONS.reduce((total, name) => total + (snapshot[name]?.length || 0), 0);
  }

  function sortBusinessCollection(name, records) {
    const rows = [...records];
    const time = record => new Date(record?.createdAt || record?.updatedAt || 0).getTime() || 0;
    if (name === 'audit' || name === 'notifications') return rows.sort((a, b) => time(b) - time(a));
    return rows.sort((a, b) => time(a) - time(b));
  }

  function diffBusinessState(previous, current) {
    const changes = {};
    for (const name of BUSINESS_COLLECTIONS) {
      const oldRows = Array.isArray(previous?.[name]) ? previous[name] : [];
      const newRows = Array.isArray(current?.[name]) ? current[name] : [];
      const oldMap = new Map(oldRows.filter(row => row?.id).map(row => [String(row.id), row]));
      const newMap = new Map(newRows.filter(row => row?.id).map(row => [String(row.id), row]));
      const upsert = [];
      const remove = [];
      for (const [id, row] of newMap) {
        const old = oldMap.get(id);
        if (!old || canonicalJson(old) !== canonicalJson(row)) upsert.push(row);
      }
      for (const id of oldMap.keys()) if (!newMap.has(id)) remove.push(id);
      if (upsert.length || remove.length) changes[name] = { upsert, delete: remove };
    }
    return changes;
  }

  function hasOperationalChanges(changes) {
    return Object.values(changes || {}).some(change => (change.upsert?.length || 0) + (change.delete?.length || 0) > 0);
  }

  function versionedOperationalChanges(changes) {
    const output = {};
    for (const [entity, change] of Object.entries(changes || {})) {
      output[entity] = {
        upsert: (change.upsert || []).map(record => ({
          record,
          expectedVersion: operationalRecordVersions.get(recordVersionKey(entity, record.id)) || '',
        })),
        delete: (change.delete || []).map(recordId => ({
          recordId,
          expectedVersion: operationalRecordVersions.get(recordVersionKey(entity, recordId)) || '',
        })),
      };
    }
    return output;
  }


  function applyReturnedVersions(versions = {}) {
    for (const [entity, rows] of Object.entries(versions || {})) {
      for (const [recordId, version] of Object.entries(rows || {})) {
        if (version) operationalRecordVersions.set(recordVersionKey(entity, recordId), String(version));
      }
    }
  }

  async function sendOperationalChanges(changes, requestId) {
    const versioned = versionedOperationalChanges(changes);
    const operationCount = Object.values(versioned).reduce(
      (total, change) => total + (change.upsert?.length || 0) + (change.delete?.length || 0),
      0,
    );
    const payloadBytes = JSON.stringify(versioned).length;
    if (operationCount > 5000 || payloadBytes > 4500000) {
      throw new Error('This database operation is too large to save safely in one transaction. Split the operation into smaller groups.');
    }
    const result = await callDataApi('sync', { changes: versioned, requestId });
    applyReturnedVersions(result?.versions || {});
    for (const [entity, change] of Object.entries(changes || {})) {
      for (const recordId of change.delete || []) operationalRecordVersions.delete(recordVersionKey(entity, recordId));
    }
    return result;
  }

  function settleSyncWaiters(waiters, error = null, result = null) {
    for (const waiter of waiters) {
      if (error) waiter.reject(error);
      else waiter.resolve(result || { ok: true });
    }
  }

  function queueOperationalSync(delayMs = 40) {
    const promise = new Promise((resolve, reject) => syncWaiters.push({ resolve, reject }));
    clearTimeout(syncTimer);
    syncTimer = setTimeout(flushOperationalSync, Math.max(0, delayMs));
    return promise;
  }

  async function flushOperationalSync() {
    clearTimeout(syncTimer);
    syncTimer = null;
    if (!operationalDataReady || applyingRemoteData || !authSession) {
      const waiters = syncWaiters.splice(0);
      settleSyncWaiters(waiters, null, { ok: true, skipped: true });
      return { ok: true, skipped: true };
    }
    if (syncInFlight) {
      syncRequestedWhileBusy = true;
      return null;
    }

    const waiters = syncWaiters.splice(0);
    const snapshot = extractBusinessState();
    const before = cloneJson(lastSyncedBusiness || emptyBusinessState());
    const changes = diffBusinessState(before, snapshot);
    if (!hasOperationalChanges(changes)) {
      settleSyncWaiters(waiters, null, { ok: true, unchanged: true });
      return { ok: true, unchanged: true };
    }

    syncInFlight = true;
    syncRequestedWhileBusy = false;
    const requestId = createRequestId('SYNC');
    try {
      const result = await sendOperationalChanges(changes, requestId);
      lastSyncedBusiness = cloneJson(snapshot);
      settleSyncWaiters(waiters, null, result);
      return result;
    } catch (error) {
      console.error('Shared database sync failed', { requestId, error });
      restoreBusinessState(before);
      lastSyncedBusiness = cloneJson(before);
      const pending = syncWaiters.splice(0);
      settleSyncWaiters(waiters, error);
      settleSyncWaiters(pending, error);
      toast('Database sync failed', `${error.message} No unsaved change was kept on screen.`, 'error');
      if (Number(error?.status) === 409) scheduleOperationalReload(0);
      throw error;
    } finally {
      syncInFlight = false;
      if (syncRequestedWhileBusy || syncWaiters.length) {
        syncRequestedWhileBusy = false;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushOperationalSync, 0);
      }
      drainRealtimePayloads();
      if (remoteReloadPending) {
        remoteReloadPending = false;
        scheduleOperationalReload(20);
      }
    }
  }

  async function fetchAllOperationalRows() {
    await ensureFreshSession();
    const rows = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      let pageResult = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          pageResult = await withTimeout(
            supabaseClient
              .from('erp_records')
              .select('entity_type,record_id,payload,updated_at')
              .order('entity_type', { ascending: true })
              .order('record_id', { ascending: true })
              .range(from, from + pageSize - 1),
            18000,
            'Database data loading timed out.',
          );
          if (!pageResult.error) break;
          lastError = pageResult.error;
          if (!/timeout|network|fetch|429|5\d\d/i.test(String(pageResult.error.message || '')) || attempt === 2) break;
        } catch (error) {
          lastError = error;
          if (attempt === 2) break;
        }
        await delay(300 * (2 ** attempt));
      }
      const { data, error } = pageResult || { data: null, error: lastError };
      if (error) {
        if (/erp_records|does not exist|schema cache/i.test(error.message || '')) {
          throw new Error('The shared ERP database migration has not been installed. Run supabase/003_shared_operational_data.sql in Supabase SQL Editor.');
        }
        throw error;
      }
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  }

  function refreshCurrentDataView() {
    if (!authSession || !currentProfile || authView === 'set-password') return;
    renderPage(currentRoute);
    renderNotifications();
  }

  async function loadOperationalData({ renderAfter = false } = {}) {
    if (!supabaseClient || !authSession) return 0;
    if (operationalLoadPromise) return operationalLoadPromise;
    operationalLoadPromise = (async () => {
      const rows = await fetchAllOperationalRows();
      const next = emptyBusinessState();
      const nextVersions = new Map();
      for (const row of rows) {
        const name = String(row.entity_type || '');
        if (!BUSINESS_COLLECTIONS.includes(name) || !row.payload || typeof row.payload !== 'object') continue;
        let record = { ...row.payload, id: String(row.record_id || row.payload.id || '') };
        if (name === 'items') record = normalizeProductionItemRecord(record, true);
        if (record.id) {
          next[name].push(record);
          if (row.updated_at) nextVersions.set(recordVersionKey(name, record.id), String(row.updated_at));
        }
      }
      applyingRemoteData = true;
      try {
        for (const name of BUSINESS_COLLECTIONS) state[name] = sortBusinessCollection(name, next[name]);
        operationalRecordVersions = nextVersions;
        lastSyncedBusiness = extractBusinessState();
        operationalDataReady = true;
        lastOperationalLoadAt = Date.now();
      } finally {
        applyingRemoteData = false;
      }
      if (renderAfter) refreshCurrentDataView();
      return rows.length;
    })();
    try { return await operationalLoadPromise; }
    finally { operationalLoadPromise = null; }
  }

  function flattenLegacySnapshot(snapshot) {
    const records = [];
    for (const name of BUSINESS_COLLECTIONS) {
      for (const record of snapshot?.[name] || []) {
        if (record?.id) {
          const payload = name === 'items' ? normalizeProductionItemRecord(record, true) : record;
          records.push({ entityType: name, recordId: String(record.id), payload });
        }
      }
    }
    return records;
  }

  function clearLegacyBusinessStorage() {
    LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    legacyBusinessSnapshot = null;
    saveUiPreferences();
  }

  async function initialiseOperationalData() {
    operationalDataReady = false;
    const existingCount = await loadOperationalData();
    const legacyCount = legacyBusinessSnapshot ? businessRecordCount(legacyBusinessSnapshot) : 0;
    if (existingCount === 0 && legacyCount > 0 && can('ADMIN', 'MANAGER')) {
      await callDataApi('seed-if-empty', { records: flattenLegacySnapshot(legacyBusinessSnapshot) });
      await loadOperationalData();
      clearLegacyBusinessStorage();
      toast('Shared database activated', `${legacyCount} existing browser records were moved to Supabase.`);
    } else if (existingCount > 0 || legacyCount === 0) {
      clearLegacyBusinessStorage();
    }
    subscribeOperationalRealtime();
  }

  function scheduleRealtimeViewRefresh(delayMs = 40) {
    clearTimeout(realtimeRenderTimer);
    realtimeRenderTimer = setTimeout(refreshCurrentDataView, Math.max(0, delayMs));
  }

  function compareVersions(left, right) {
    const leftTime = Date.parse(String(left || ''));
    const rightTime = Date.parse(String(right || ''));
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
    return String(left || '').localeCompare(String(right || ''));
  }

  function realtimeMutationBusy() {
    return Boolean(
      syncInFlight
      || syncTimer
      || bulkImportInFlight
      || itemWorkflowLocks.size
      || operationalMutationLocks.size
      || hasUnsyncedOperationalChanges()
    );
  }

  function queueRealtimePayload(payload) {
    pendingRealtimePayloads.push(payload);
    if (pendingRealtimePayloads.length > 2000) {
      pendingRealtimePayloads = [];
      remoteReloadPending = true;
    }
  }

  function applyRealtimePayload(payload, { queued = false } = {}) {
    const row = payload?.eventType === 'DELETE' ? payload.old : payload.new;
    const entity = String(row?.entity_type || '');
    const recordId = String(row?.record_id || '');
    if (!BUSINESS_COLLECTIONS.includes(entity) || !recordId) return;
    if (!queued && realtimeMutationBusy()) {
      queueRealtimePayload(payload);
      return;
    }

    const incomingVersion = String(row?.updated_at || '');
    const currentVersion = operationalRecordVersions.get(recordVersionKey(entity, recordId)) || '';
    if (payload.eventType === 'DELETE') {
      if (incomingVersion && currentVersion && compareVersions(incomingVersion, currentVersion) < 0) return;
    } else if (incomingVersion && currentVersion && compareVersions(incomingVersion, currentVersion) <= 0) {
      return;
    }

    applyingRemoteData = true;
    try {
      if (payload.eventType === 'DELETE') {
        state[entity] = state[entity].filter(record => String(record.id) !== recordId);
        operationalRecordVersions.delete(recordVersionKey(entity, recordId));
      } else if (row?.payload && typeof row.payload === 'object') {
        const record = entity === 'items'
          ? normalizeProductionItemRecord({ ...row.payload, id: recordId }, true)
          : { ...row.payload, id: recordId };
        const index = state[entity].findIndex(existing => String(existing.id) === recordId);
        if (index >= 0) state[entity][index] = record;
        else state[entity].push(record);
        state[entity] = sortBusinessCollection(entity, state[entity]);
        if (incomingVersion) operationalRecordVersions.set(recordVersionKey(entity, recordId), incomingVersion);
      }
      lastSyncedBusiness = extractBusinessState();
      lastOperationalLoadAt = Date.now();
    } finally {
      applyingRemoteData = false;
    }
    scheduleRealtimeViewRefresh();
    if (entity === 'items') {
      const previousItem = payload.old?.payload || {};
      const nextItem = payload.new?.payload || {};
      const synchronizedFields = ['projectId','projectLineItemId','itemName','uom','quantity','dispatchQuantity','pendingQuantity'];
      const linkedValuesChanged = payload.eventType !== 'UPDATE' || synchronizedFields.some(field => canonicalJson(previousItem[field]) !== canonicalJson(nextItem[field]));
      if (linkedValuesChanged) {
        const itemProjectId = String((payload.eventType === 'DELETE' ? previousItem : nextItem).projectId || '');
        scheduleProjectItemsModalRefresh(itemProjectId);
      }
    }
  }

  function drainRealtimePayloads() {
    if (realtimeMutationBusy() || !pendingRealtimePayloads.length) return;
    const payloads = pendingRealtimePayloads.splice(0);
    for (const payload of payloads) applyRealtimePayload(payload, { queued: true });
  }

  function scheduleOperationalReload(delayMs = 80) {
    clearTimeout(realtimeReloadTimer);
    realtimeReloadTimer = setTimeout(async () => {
      if (!authSession || !operationalDataReady || !navigator.onLine) return;
      if (realtimeMutationBusy()) {
        remoteReloadPending = true;
        return;
      }
      try { await loadOperationalData({ renderAfter: true }); }
      catch (error) {
        console.error('Operational reload failed', error);
        if (Number(error?.status) === 401) await expireSession(error.message);
        else scheduleRealtimeReconnect();
      }
    }, Math.max(0, delayMs));
  }

  function scheduleRealtimeReconnect() {
    if (!authSession || realtimeReconnectTimer) return;
    const delayMs = Math.min(30000, 1000 * (2 ** Math.min(realtimeReconnectAttempt, 5)));
    realtimeReconnectAttempt += 1;
    realtimeReconnectTimer = setTimeout(() => {
      realtimeReconnectTimer = null;
      if (!authSession) return;
      subscribeOperationalRealtime(true);
    }, delayMs);
  }

  function startRealtimeFallbackMonitor() {
    clearInterval(realtimeFallbackTimer);
    realtimeFallbackTimer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || !authSession) return;
      const stale = Date.now() - lastOperationalLoadAt > 5 * 60 * 1000;
      if (realtimeStatus !== 'SUBSCRIBED' || stale) scheduleOperationalReload(0);
    }, 120000);
  }

  function subscribeOperationalRealtime(force = false) {
    if (!supabaseClient || !authSession) return;
    if (!force && realtimeChannel && ['SUBSCRIBED', 'SUBSCRIBING'].includes(realtimeStatus)) return;

    const reconnecting = force || realtimeReconnectAttempt > 0;
    const generation = ++realtimeGeneration;
    const previous = realtimeChannel;
    realtimeChannel = null;
    if (previous) supabaseClient.removeChannel(previous).catch(() => {});

    realtimeStatus = 'SUBSCRIBING';
    const channel = supabaseClient
      .channel(`erp-records-${authSession.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_records' }, applyRealtimePayload);
    realtimeChannel = channel;
    channel.subscribe(status => {
      if (generation !== realtimeGeneration || realtimeChannel !== channel) return;
      realtimeStatus = status;
      if (status === 'SUBSCRIBED') {
        realtimeReconnectAttempt = 0;
        clearTimeout(realtimeReconnectTimer);
        realtimeReconnectTimer = null;
        startRealtimeFallbackMonitor();
        if (reconnecting) scheduleOperationalReload(0);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('Supabase Realtime channel status:', status);
        scheduleRealtimeReconnect();
      }
    });
  }

  function stopOperationalRealtime() {
    clearTimeout(realtimeReloadTimer);
    clearTimeout(realtimeRenderTimer);
    clearTimeout(syncTimer);
    syncTimer = null;
    clearTimeout(realtimeReconnectTimer);
    clearInterval(realtimeFallbackTimer);
    realtimeReconnectTimer = null;
    realtimeFallbackTimer = null;
    realtimeReconnectAttempt = 0;
    realtimeStatus = 'IDLE';
    realtimeGeneration += 1;
    if (realtimeChannel && supabaseClient) supabaseClient.removeChannel(realtimeChannel).catch(() => {});
    realtimeChannel = null;
    pendingRealtimePayloads = [];
    operationalDataReady = false;
    lastSyncedBusiness = null;
    operationalRecordVersions = new Map();
    itemWorkflowLocks.clear();
    operationalMutationLocks.clear();
    const waiters = syncWaiters.splice(0);
    settleSyncWaiters(waiters, new Error('The session ended before synchronization completed.'));
  }

  async function syncProfiles() {
    if (!supabaseClient || !authSession) return;
    await ensureFreshSession();
    let result = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = await withTimeout(
        supabaseClient
          .from('profiles')
          .select('id,full_name,email,role,status,must_change_password,created_by,invited_at,activated_at,created_at')
          .order('created_at', { ascending: true }),
        15000,
        'User profile loading timed out.',
      );
      if (!result.error || attempt === 2 || !/timeout|network|fetch|429|5\d\d/i.test(String(result.error.message || ''))) break;
      await delay(300 * (2 ** attempt));
    }
    if (result?.error) throw result.error;
    state.users = (result?.data || []).map(row => ({ id: row.id, name: row.full_name, email: row.email, role: row.role, status: titleCase(row.status), mustChangePassword: Boolean(row.must_change_password), createdBy: row.created_by || '', invitedAt: row.invited_at, activatedAt: row.activated_at, createdAt: row.created_at }));
    currentProfile = state.users.find(user => user.id === authSession.user.id) || null;
    saveUiPreferences();
  }

  function titleCase(value = '') { return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : ''; }

  function isAuthenticationFailure(error) {
    return Number(error?.status) === 401 || /invalid login|invalid or expired|session|jwt|refresh token|not authenticated/i.test(String(error?.message || ''));
  }

  async function prepareAuthenticatedSession(nextSession) {
    if (!nextSession?.user?.id) throw new Error('The authenticated session is unavailable.');
    authSession = nextSession;
    if (authenticatedStartupPromise) return authenticatedStartupPromise;
    authenticatedStartupPromise = (async () => {
      await syncProfiles();
      if (!currentProfile || currentProfile.status !== 'Active') {
        throw new Error('This account is not active. Contact the Super Admin.');
      }
      if (currentProfile.mustChangePassword) {
        passwordFlow = 'forced';
        authView = 'set-password';
        stopOperationalRealtime();
        return { passwordChangeRequired: true };
      }
      if (!operationalDataReady) await initialiseOperationalData();
      return { passwordChangeRequired: false };
    })();
    try { return await authenticatedStartupPromise; }
    finally { authenticatedStartupPromise = null; }
  }

  async function handleAuthStateChange(event, nextSession) {
    if (event === 'TOKEN_REFRESHED') {
      authSession = nextSession;
      return;
    }
    if (!nextSession || event === 'SIGNED_OUT') {
      authSession = null;
      currentProfile = null;
      authenticatedStartupPromise = null;
      stopOperationalRealtime();
      if (authInitialized) render();
      return;
    }

    if (authSession?.user?.id === nextSession.user?.id && operationalDataReady && event === 'INITIAL_SESSION') {
      authSession = nextSession;
      return;
    }

    try {
      await prepareAuthenticatedSession(nextSession);
      if (authInitialized) render();
    } catch (error) {
      console.error('Authentication state processing failed', error);
      if (isAuthenticationFailure(error)) {
        await expireSession(error.message);
      } else {
        // Keep the persisted Supabase session intact. A reload or a new sign-in attempt can retry startup.
        authSession = null;
        currentProfile = null;
        stopOperationalRealtime();
        authMessage = `ERROR:${error.message || 'Unable to connect to the ERP database. Try again.'}`;
        if (authInitialized) render();
      }
    }
  }

  async function initialiseAuthentication() {
    renderAuthLoading();
    try {
      const { response, body: config } = await requestJson('/api/config', { cache: 'no-store' }, {
        retries: 2,
        timeoutMs: 15000,
      });
      if (!response.ok) throw new Error(config.error || 'Supabase configuration is unavailable.');
      appConfig = config;
      setupRequired = Boolean(config.setupRequired);
      if (config.sharedDataReady === false) throw new Error('Shared ERP database is not ready. Run supabase/003_shared_operational_data.sql in Supabase SQL Editor.');
      if (config.stabilityMigrationReady === false) throw new Error('ERP stability migration is not ready. Run supabase/004_stability_performance.sql in Supabase SQL Editor.');
      if (!window.supabase?.createClient) throw new Error('Supabase client library did not load. Check the internet connection.');

      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'profile-solutions-factory-erp-auth',
        },
      });

      authStateSubscription?.unsubscribe?.();
      const { data: listenerData } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
        authTransitionChain = authTransitionChain
          .then(() => handleAuthStateChange(event, nextSession))
          .catch(error => console.error('Queued authentication transition failed', error));
      });
      authStateSubscription = listenerData?.subscription || null;

      const { data, error } = await withTimeout(
        supabaseClient.auth.getSession(),
        15000,
        'Unable to restore the saved session. Check the network connection.',
      );
      if (error) throw error;
      authSession = data.session;
      if (authSession) await prepareAuthenticatedSession(authSession);
      authInitialized = true;
      render();
    } catch (error) {
      authInitialized = true;
      authSession = null;
      currentProfile = null;
      setupRequired = false;
      authMessage = `ERROR:${error.message}`;
      render();
    }
  }

  function renderAppShell() {
    const user = getCurrentUser();
    const allowed = NAV.filter(n => n.roles.includes(user.role));
    const groups = [...new Set(allowed.map(n => n.section))];
    const unread = state.notifications.filter(n => n.userId === user.id && !n.read).length;
    const collapsed = Boolean(state.settings.sidebarCollapsed);
    document.getElementById('app').innerHTML = `
      <div class="app-shell ${collapsed ? 'sidebar-collapsed' : ''}">
        <aside class="sidebar" id="sidebar" aria-label="ERP navigation">
          <div class="brand-area">
            <div class="sidebar-logo-full">${brandLogo('sidebar-logo')}</div>
            <img class="sidebar-logo-mark" src="${BRAND.mark}" alt="Profile Solutions">
            <button class="sidebar-collapse-btn" data-action="collapse-sidebar" title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}" aria-label="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}">${ICONS.chevronLeft}</button>
          </div>
          <div class="factory-chip"><span>${ICONS.factory}</span><div><strong>${esc(state.settings.factoryName)}</strong><small>Procurement Operations</small></div></div>
          <nav class="nav-scroll">
            ${groups.map(g => `<div class="nav-section-title">${esc(g)}</div>${allowed.filter(n=>n.section===g).map(n=>`<button class="nav-item ${currentRoute===n.id?'active':''}" data-route="${n.id}" title="${esc(n.label)}"><span class="nav-icon">${n.icon}</span><span class="nav-label">${esc(n.label)}</span><span class="nav-active-marker"></span></button>`).join('')}`).join('')}
          </nav>
          <div class="sidebar-bottom">
            <div class="user-mini"><div class="avatar">${initials(user.name)}</div><div class="user-info"><strong>${esc(user.name)}</strong><span>${esc(roleLabel(user.role))}</span></div><button class="sidebar-logout" data-action="logout" title="Logout" aria-label="Logout">${ICONS.logout}</button></div>
          </div>
        </aside>
        <header class="topbar">
          <div class="topbar-left">
            <button class="icon-btn mobile-menu-btn" data-action="toggle-sidebar" aria-label="Open navigation">${ICONS.menu}</button>
            <div class="topbar-brand"><img src="${BRAND.mark}" alt="Profile Solutions"><span>Profile Solutions</span></div>
            <span class="topbar-divider"></span>
            <div class="page-heading"><h1 id="top-page-title">Procurement Overview</h1><small id="top-page-subtitle">Live operations summary</small></div>
          </div>
          <div class="topbar-search"><span class="search-icon">${ICONS.search}</span><input id="global-search" aria-label="Global ERP search" placeholder="Search project, job, BOM or item..." autocomplete="off"><kbd>Ctrl K</kbd><div id="global-results"></div></div>
          <div class="topbar-actions">
            <button class="icon-btn" data-action="theme" title="Toggle theme" aria-label="Toggle theme">${ICONS.theme}</button>
            <button class="icon-btn" data-action="notifications" title="Notifications" aria-label="Notifications">${ICONS.bell}${unread ? `<span class="badge-dot">${unread>9?'9+':unread}</span>`:''}</button>
            <div class="profile-control">
              <button class="profile-trigger" data-action="profile-menu" aria-haspopup="menu" aria-expanded="false"><div class="avatar">${initials(user.name)}</div><div class="profile-trigger-copy"><strong>${esc(user.name)}</strong><span>${esc(roleLabel(user.role))}</span></div>${ICONS.chevronDown}</button>
              <div class="profile-menu" id="profile-menu" role="menu">
                <div class="profile-menu-head"><div class="avatar large">${initials(user.name)}</div><div><strong>${esc(user.name)}</strong><span>${esc(user.email || '')}</span><small>${esc(roleLabel(user.role))}</small></div></div>
                <button role="menuitem" data-action="logout">${ICONS.logout}<span>Sign out</span></button>
              </div>
            </div>
          </div>
        </header>
        <main class="main-content"><div class="content-wrap" id="page-content"></div></main>
        <aside class="notification-panel" id="notification-panel"><div class="panel-head"><div><span class="eyebrow dark">Activity centre</span><strong>Notifications</strong></div><div><button class="btn btn-ghost btn-sm" data-action="mark-all-read">Mark all read</button><button class="close-btn" data-action="notifications" aria-label="Close notifications">×</button></div></div><div class="panel-body" id="notification-list"></div></aside>
        <div class="mobile-nav-backdrop" data-action="toggle-sidebar"></div>
      </div>`;
    bindShellEvents();
    renderPage(currentRoute);
    renderNotifications();
  }

  function bindShellEvents() {
    document.querySelectorAll('[data-route]').forEach(btn => btn.addEventListener('click', () => {
      currentRoute = btn.dataset.route;
      document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.route === currentRoute));
      document.getElementById('sidebar').classList.remove('open');
      renderPage(currentRoute);
    }));
    if (!globalClickListenerInstalled) {
      document.addEventListener('click', globalClickHandler);
      globalClickListenerInstalled = true;
    }
    document.querySelectorAll('[data-action="logout"]').forEach(btn => btn.addEventListener('click', logout));
    document.querySelectorAll('[data-action="toggle-sidebar"]').forEach(btn => btn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open')));
    document.querySelectorAll('[data-action="collapse-sidebar"]').forEach(btn => btn.addEventListener('click', toggleSidebarCollapse));
    document.querySelectorAll('[data-action="profile-menu"]').forEach(btn => btn.addEventListener('click', () => {
      const menu = document.getElementById('profile-menu'); const open = menu?.classList.toggle('open'); btn.setAttribute('aria-expanded', String(Boolean(open)));
    }));
    document.querySelectorAll('[data-action="theme"]').forEach(btn => btn.addEventListener('click', toggleTheme));
    document.querySelectorAll('[data-action="notifications"]').forEach(btn => btn.addEventListener('click', () => document.getElementById('notification-panel').classList.toggle('open')));
    document.querySelectorAll('[data-action="mark-all-read"]').forEach(btn => btn.addEventListener('click', markAllRead));
    const search = document.getElementById('global-search');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(globalSearchTimer);
        globalSearchTimer = setTimeout(() => renderGlobalSearch(search.value), 120);
      });
      search.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('global-results').innerHTML = ''; });
    }
    window.onkeydown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
  }

  function globalClickHandler(e) {
    if (!e.target.closest('.topbar-search')) {
      const r = document.getElementById('global-results'); if (r) r.innerHTML = '';
    }
    if (!e.target.closest('.profile-control')) {
      document.getElementById('profile-menu')?.classList.remove('open');
      document.querySelector('[data-action="profile-menu"]')?.setAttribute('aria-expanded','false');
    }
  }

  async function logout() {
    audit('LOGOUT', 'Authentication', 'User signed out', getCurrentUser()?.id);
    await saveState().catch(error => console.warn('Logout audit could not be saved', error));
    stopOperationalRealtime();
    await supabaseClient?.auth.signOut().catch(() => {});
    authSession = null; currentProfile = null; currentRoute = 'dashboard'; authView = 'login'; render();
  }
  function toggleSidebarCollapse() {
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    saveUiPreferences(); renderAppShell();
  }
  function toggleTheme() {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; saveUiPreferences(); renderAppShell();
  }
  async function markAllRead() {
    const user = getCurrentUser();
    state.notifications.forEach(n => { if (n.userId === user.id) n.read = true; });
    try {
      await saveState();
      renderAppShell();
    } catch (error) {
      toast('Notification update failed', error.message, 'error');
      renderAppShell();
    }
  }

  function setPageTitle(title, subtitle) {
    const a = document.getElementById('top-page-title'); const b = document.getElementById('top-page-subtitle');
    document.title = `${title} | ${BRAND.erpName}`;
    if (a) a.textContent = title; if (b) b.textContent = subtitle || '';
  }

  function renderPage(route) {
    const routes = {
      dashboard: renderDashboard, projects: renderProjects, production: renderProduction,
      shortages: renderShortages, import: renderImport, reports: renderReports,
      users: renderUsers, audit: renderAudit, settings: renderSettings
    };
    const nav = NAV.find(n => n.id === route);
    if (!nav || !nav.roles.includes(getCurrentUser().role)) { currentRoute = 'dashboard'; return renderDashboard(); }
    routes[route]?.();
  }

  function renderGlobalSearch(query) {
    const box = document.getElementById('global-results');
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) { box.innerHTML = ''; return; }
    const projects = assignedProjects().filter(p => [p.name,p.code,p.jobNumber,p.site,p.client].some(v => String(v||'').toLowerCase().includes(q))).slice(0,5);
    const items = visibleItems().filter(i => [i.itemName,i.bomNumber,i.jobNumber,i.site,itemSection(i),assignedExecutiveName(i)].some(v => String(v||'').toLowerCase().includes(q))).slice(0,7);
    if (!projects.length && !items.length) { box.innerHTML = `<div class="search-results"><div class="empty-state" style="padding:24px"><p>No matching records</p></div></div>`; return; }
    box.innerHTML = `<div class="search-results">
      ${projects.length ? `<div class="search-group-title">Projects</div>${projects.map(p=>`<button class="search-result" data-search-project="${p.id}"><span class="result-icon">${ICONS.project}</span><span><strong>${esc(p.name)}</strong><span>${esc(p.code)} • ${esc(p.jobNumber || 'No Job No.')}</span></span></button>`).join('')}`:''}
      ${items.length ? `<div class="search-group-title">Production Items</div>${items.map(i=>`<button class="search-result" data-search-item="${i.id}"><span class="result-icon">${ICONS.item}</span><span><strong>${esc(i.itemName)}</strong><span>${esc(i.bomNumber || 'No BOM')} • ${esc(itemSection(i))} • ${esc(STAGES[i.currentStage] || '')}</span></span></button>`).join('')}`:''}
    </div>`;
    box.querySelectorAll('[data-search-project]').forEach(b => b.onclick = () => { currentRoute='projects'; renderPage('projects'); setTimeout(()=>openProjectDetail(b.dataset.searchProject),0); box.innerHTML=''; });
    box.querySelectorAll('[data-search-item]').forEach(b => b.onclick = () => { currentRoute='production'; renderPage('production'); setTimeout(()=>openItemDetail(b.dataset.searchItem),0); box.innerHTML=''; });
  }

  function renderNotifications() {
    const user = getCurrentUser();
    const list = state.notifications.filter(n => n.userId === user.id).slice(0,50);
    const el = document.getElementById('notification-list');
    if (!el) return;
    el.innerHTML = list.length ? list.map(n => `<button class="notification-item ${n.read?'':'unread'}" data-notification-id="${n.id}"><span class="activity-icon">${n.type==='Approval'?'✓':n.type==='Delay'?'!':'♢'}</span><span><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><time>${fmtDate(n.createdAt,true)}</time></span></button>`).join('') : `<div class="empty-state"><div class="empty-icon">♢</div><h3>No notifications</h3><p>You are all caught up.</p></div>`;
    el.querySelectorAll('[data-notification-id]').forEach(btn => btn.onclick = async () => {
      const n = state.notifications.find(x => x.id === btn.dataset.notificationId);
      if (!n) return;
      n.read = true;
      try {
        await saveState();
        renderAppShell();
        if (n.entityId && itemById(n.entityId)) setTimeout(() => { currentRoute = 'production'; renderPage('production'); openItemDetail(n.entityId); }, 0);
      } catch (error) {
        toast('Notification update failed', error.message, 'error');
        renderAppShell();
      }
    });
  }

  function pageToolbar(title, subtitle, actions = '') {
    return `<div class="page-toolbar"><div class="page-toolbar-copy"><span class="eyebrow dark"><i></i> Profile Solutions Procurement ERP</span><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><div class="toolbar-actions">${actions}</div></div>`;
  }
  function emptyState(icon, title, text, action='') {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  }

  function renderDashboard() {
    if (getCurrentUser()?.role === 'EXECUTIVE') return renderExecutiveDashboard();
    const dashboardName = `${roleLabel(getCurrentUser()?.role || '')} Dashboard`;
    setPageTitle(dashboardName, 'Live operations summary');
    const projects = assignedProjects();
    const items = visibleItems();
    const active = projects.filter(p => p.status === 'Active').length;
    const delayed = projects.filter(p => p.status === 'Delayed' || (p.targetDate && new Date(p.targetDate) < new Date() && projectCompletion(p.id) < 100)).length;
    const completed = projects.filter(p => p.status === 'Completed' || projectCompletion(p.id) === 100).length;
    const qty = items.reduce((a,i)=>a+number(i.quantity),0);
    const ready = items.filter(i=>i.currentStage>=STAGES.length-1 || i.status==='Completed').reduce((a,i)=>a+number(i.quantity),0);
    const pending = Math.max(0, qty-ready);
    const shortages = state.shortages.filter(s => s.status !== 'Resolved' && projects.some(p=>p.id===s.projectId)).length;
    const page = document.getElementById('page-content');
    page.innerHTML = `
      ${pageToolbar('Procurement Overview Dashboard','Monitor production, delivery risk and workflow progress.', `<button class="btn btn-secondary" id="refresh-dashboard">${ICONS.refresh}<span>Refresh</span></button>${can('ADMIN','MANAGER')?`<button class="btn btn-primary" data-go="import">${ICONS.upload}<span>Import Excel</span></button>`:''}`)}
      <section class="dashboard-hero">
        <div class="dashboard-hero-media" aria-hidden="true"></div><div class="dashboard-hero-overlay" aria-hidden="true"></div>
        <div class="dashboard-hero-content"><span class="eyebrow"><i></i> ${esc(roleLabel(getCurrentUser()?.role || ''))} workspace</span><h3>Welcome back, ${esc((getCurrentUser()?.name || 'Team').split(' ')[0])}.</h3><p>Keep Profile Solutions projects moving with a live view of production flow, delivery risk and operational priorities.</p><div class="hero-meta"><span>${ICONS.calendar}${fmtDate(todayISO())}</span><span>${ICONS.factory}${esc(state.settings.factoryName)}</span></div></div>
        <div class="dashboard-hero-score"><span>Production readiness</span><strong>${qty ? Math.round((ready / qty) * 100) : 0}%</strong><small>${fmtNumber(ready)} of ${fmtNumber(qty)} ready</small></div>
      </section>
      <div class="grid grid-5 kpi-grid">
        ${kpi(ICONS.projects,'Total Projects',projects.length,'All visible projects')}
        ${kpi(ICONS.check,'Active Projects',active,`${completed} completed`)}
        ${kpi(ICONS.shortage,'Delayed Projects',delayed,'Requires attention')}
        ${kpi(ICONS.item,'Total Quantity',fmtNumber(qty),`${fmtNumber(pending)} pending`)}
        ${kpi(ICONS.ready,'Ready for Dispatch',fmtNumber(ready),`${shortages} open shortages`)}
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <section class="card"><div class="card-header"><div><h3>Stage-wise Production</h3><p>Items currently positioned at each workflow stage</p></div></div><div class="card-body"><div class="chart-box"><canvas id="stage-chart"></canvas></div></div></section>
        <section class="card"><div class="card-header"><div><h3>Project Progress</h3><p>Completion percentage by active project</p></div></div><div class="card-body"><div class="chart-box"><canvas id="project-chart"></canvas></div></div></section>
      </div>
      ${renderSectionSummary(items)}
      <div class="grid grid-3" style="margin-top:18px">
        <section class="card" style="grid-column:span 2"><div class="card-header"><div><h3>Recent Production Activity</h3><p>Latest workflow movements and approvals</p></div></div><div class="card-body">${renderRecentActivity()}</div></section>
        <section class="card"><div class="card-header"><div><h3>Upcoming Deliveries</h3><p>Projects closest to target date</p></div></div><div class="card-body">${renderUpcomingDeliveries(projects)}</div></section>
      </div>`;
    page.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{currentRoute=b.dataset.go; renderAppShell();});
    document.getElementById('refresh-dashboard').onclick = async event => {
      const button = event.currentTarget;
      setControlBusy(button, true);
      try {
        await loadOperationalData({ renderAfter: true });
        toast('Dashboard refreshed', 'Latest production data loaded from the shared database.');
      } catch (error) {
        toast('Refresh failed', error.message || 'Unable to load the latest production data.', 'error');
      } finally { setControlBusy(button, false); }
    };
    requestAnimationFrame(() => {
      drawBarChart('stage-chart', STAGES.map((s,idx)=>({label:shortStage(s), value:items.filter(i=>Number(i.currentStage)===idx).length})), { horizontal:false });
      drawBarChart('project-chart', projects.slice(0,10).map(p=>({label:p.name.length>18?p.name.slice(0,18)+'…':p.name,value:projectCompletion(p.id)})), { max:100, suffix:'%' });
    });
  }

  function renderSectionSummary(items = visibleItems()) {
    const rows = SECTIONS.map(section => {
      const sectionItems = items.filter(item => itemSection(item) === section);
      const completed = sectionItems.filter(item => itemTaskState(item) === 'Completed').length;
      const inProgress = sectionItems.filter(item => itemTaskState(item) === 'In Progress').length;
      const pending = sectionItems.filter(item => itemTaskState(item) === 'Pending').length;
      const assigned = sectionItems.filter(item => item.assignedExecutiveId).length;
      return { section, total: sectionItems.length, assigned, inProgress, completed, pending };
    });
    return `<section class="card table-card" style="margin-top:18px"><div class="card-header"><div><h3>Section Summary</h3><p>Live section-wise production workload and assignment status</p></div></div><div class="table-wrap"><table><thead><tr><th>Section</th><th>Total Items</th><th>Total Assigned</th><th>In Progress</th><th>Completed</th><th>Pending</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${esc(row.section)}</strong></td><td>${row.total}</td><td>${row.assigned}</td><td>${row.inProgress}</td><td>${row.completed}</td><td>${row.pending}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderExecutiveDashboard() {
    setPageTitle('Executive Dashboard', 'Your assigned production work');
    const user = getCurrentUser();
    const items = visibleItems();
    const projectIds = new Set(items.map(item => item.projectId));
    const projects = assignedProjects().filter(project => projectIds.has(project.id));
    const pending = items.filter(item => itemTaskState(item) !== 'Completed').length;
    const completed = items.filter(item => itemTaskState(item) === 'Completed').length;
    const page = document.getElementById('page-content');
    page.innerHTML = `${pageToolbar('Executive Dashboard','Only work assigned to your account is displayed.',`<button class="btn btn-secondary" id="refresh-dashboard">${ICONS.refresh}<span>Refresh</span></button>`)}
      <div class="grid grid-4 kpi-grid">
        ${kpi(ICONS.projects,'Assigned Projects',projects.length,'Projects containing assigned work')}
        ${kpi(ICONS.item,'Assigned Items',items.length,`${pending} pending`)}
        ${kpi(ICONS.clock,'Pending Tasks',pending,'Assigned work not completed')}
        ${kpi(ICONS.check,'Completed Tasks',completed,'Finished assigned work')}
      </div>
      <section class="card table-card" style="margin-top:18px"><div class="card-header"><div><h3>My Assigned Work</h3><p>Section, current stage, due date and priority</p></div></div><div class="table-wrap"><table><thead><tr><th>Project</th><th>Assigned Item</th><th>Section</th><th>Current Stage</th><th>Task Status</th><th>Due Date</th><th>Priority</th><th>Action</th></tr></thead><tbody>${items.length?items.map(item=>`<tr><td>${esc(projectById(item.projectId)?.name||'—')}</td><td><strong>${esc(item.itemName)}</strong></td><td>${statusChip(itemSection(item))}</td><td>${esc(STAGES[item.currentStage]||'PLANNING')}</td><td>${statusChip(itemTaskState(item))}</td><td>${fmtDate(itemDueDate(item))}</td><td>${statusChip(itemPriority(item))}</td><td><button class="btn btn-secondary btn-sm" data-executive-item="${item.id}">Open</button></td></tr>`).join(''):`<tr><td colspan="9">${emptyState(ICONS.item,'No assigned work','A Super Admin or Manager can assign Aluminium, Store, Fabrication or Outsource work to you.')}</td></tr>`}</tbody></table></div></section>
      ${renderSectionSummary(items)}`;
    document.querySelectorAll('[data-executive-item]').forEach(button=>button.onclick=()=>openItemDetail(button.dataset.executiveItem));
    document.getElementById('refresh-dashboard').onclick=async event=>{setControlBusy(event.currentTarget,true);try{await loadOperationalData({renderAfter:true});toast('Dashboard refreshed','Latest assigned work loaded.');}catch(error){toast('Refresh failed',error.message,'error');}finally{setControlBusy(event.currentTarget,false);}};
  }

  function kpi(icon,label,value,meta) { return `<section class="card kpi-card"><div class="kpi-icon">${icon}</div><div class="kpi-copy"><span>${esc(label)}</span><strong>${esc(value)}</strong><small class="kpi-meta">${esc(meta)}</small></div></section>`; }
  function shortStage(stage) { return stage.replace('READY FOR DISPATCH','DISPATCH').replace('POWDER COATING','P.COATING').replace('PRE-COATING','PRE COAT'); }
  function renderRecentActivity() {
    const logs = state.audit.filter(a=>['Production','Projects','Import','Shortages'].includes(a.module)).slice(0,8);
    return logs.length ? `<div class="activity-list">${logs.map(a=>`<div class="activity-item"><div class="activity-icon">${a.module==='Production'?ICONS.production:a.module==='Import'?ICONS.upload:a.module==='Shortages'?ICONS.shortage:ICONS.projects}</div><div class="activity-main"><strong>${esc(a.action)} • ${esc(a.module)}</strong><span>${esc(a.details)} by ${esc(a.userName)}</span></div><div class="activity-time">${fmtDate(a.createdAt,true)}</div></div>`).join('')}</div>` : emptyState(ICONS.clock,'No recent activity','Activity will appear after records are created or updated.');
  }
  function renderUpcomingDeliveries(projects) {
    const list = projects.filter(p=>p.targetDate && projectCompletion(p.id)<100).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate)).slice(0,6);
    return list.length ? `<div class="activity-list">${list.map(p=>{const days=Math.ceil((new Date(p.targetDate)-new Date())/86400000); return `<div class="activity-item"><div class="activity-icon">${ICONS.target}</div><div class="activity-main"><strong>${esc(p.name)}</strong><span>${projectCompletion(p.id)}% complete • ${days<0?Math.abs(days)+' days overdue':days+' days remaining'}</span></div><div class="activity-time">${fmtDate(p.targetDate)}</div></div>`}).join('')}</div>` : emptyState(ICONS.target,'No upcoming deliveries','Add project target dates to monitor delivery schedules.');
  }

  function drawBarChart(canvasId, data, options={}) {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, rect.width*dpr); canvas.height = Math.max(220, rect.height*dpr);
    const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
    const w=canvas.width/dpr,h=canvas.height/dpr, pad={l:42,r:15,t:20,b:62};
    ctx.clearRect(0,0,w,h);
    const style=getComputedStyle(document.documentElement), line=style.getPropertyValue('--line').trim(), text=style.getPropertyValue('--muted').trim(), primary=style.getPropertyValue('--primary').trim(), primaryStrong=style.getPropertyValue('--primary-strong').trim() || primary;
    const max = options.max || Math.max(1,...data.map(d=>d.value))*1.18;
    ctx.strokeStyle=line;ctx.fillStyle=text;ctx.font='10px system-ui';ctx.textAlign='right';
    for(let i=0;i<=4;i++){const y=pad.t+(h-pad.t-pad.b)*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=Math.round(max*(1-i/4));ctx.fillText(v+(options.suffix||''),pad.l-7,y+3);}
    const chartW=w-pad.l-pad.r, gap=8, bw=Math.max(8,(chartW/data.length)-gap);
    data.forEach((d,i)=>{const x=pad.l+i*(chartW/data.length)+gap/2;const bh=(h-pad.t-pad.b)*(d.value/max);const y=h-pad.b-bh;const gradient=ctx.createLinearGradient(0,y,0,h-pad.b);gradient.addColorStop(0,primary);gradient.addColorStop(1,primaryStrong);ctx.fillStyle=gradient;ctx.shadowColor='rgba(104,168,40,.18)';ctx.shadowBlur=10;roundRect(ctx,x,y,bw,bh,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=text;ctx.textAlign='center';ctx.save();ctx.translate(x+bw/2,h-pad.b+10);ctx.rotate(-0.45);ctx.fillText(d.label,0,0);ctx.restore();ctx.fillStyle=style.getPropertyValue('--text').trim();ctx.font='bold 10px system-ui';ctx.fillText(d.value+(options.suffix||''),x+bw/2,y-6);});
  }
  function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

  function renderProjects() {
    setPageTitle('Projects','Project portfolio and delivery tracking');
    const projects = assignedProjects();
    const canEdit = can('ADMIN','MANAGER');
    const page = document.getElementById('page-content');
    page.innerHTML = `${pageToolbar('Project Tracking','Search projects, monitor completion and manage assignments.', canEdit?'<button class="btn btn-primary" id="add-project">+ New Project</button>':'')}
      <div class="filter-bar"><div class="filter-item search-wide"><input id="project-search" placeholder="Search project, client, job number, site or section"></div><div class="filter-item"><select id="project-status"><option value="">All statuses</option><option>Active</option><option>Delayed</option><option>Completed</option><option>On Hold</option></select></div><div class="filter-item"><select id="project-section"><option value="">All sections</option>${SECTIONS.map(section=>`<option>${section}</option>`).join('')}</select></div><button class="btn btn-secondary" id="project-clear">Clear</button></div>
      <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Project</th><th>Job No.</th><th>Client / Site</th><th>Section(s)</th><th>Manager</th><th>Target</th><th>Progress</th><th>Status</th><th>Actions</th></tr></thead><tbody id="projects-body"></tbody></table></div><div class="table-footer"><span id="project-count"></span><span>Click View for full project tracking</span></div></section>`;
    const draw = () => {
      const q=document.getElementById('project-search').value.toLowerCase(), status=document.getElementById('project-status').value, section=document.getElementById('project-section').value;
      const rows=projects.filter(project=>{const sections=projectSections(project.id);return(!q||[project.name,project.code,project.client,project.site,project.jobNumber,...sections].some(value=>String(value||'').toLowerCase().includes(q)))&&(!status||project.status===status)&&(!section||sections.includes(section));});
      document.getElementById('project-count').textContent=`${rows.length} project(s)`;
      document.getElementById('projects-body').innerHTML=rows.length?rows.map(project=>{const sections=projectSections(project.id);return `<tr><td><strong>${esc(project.name)}</strong><div class="small muted">${esc(project.code)}</div></td><td>${esc(project.jobNumber||'—')}</td><td>${esc(project.client||'—')}<div class="small muted">${esc(project.site||'—')}</div></td><td>${sections.length?sections.map(section=>statusChip(section)).join(' '):'<span class="muted">Unassigned</span>'}</td><td>${esc(userById(project.managerId)?.name||'Unassigned')}</td><td>${fmtDate(project.targetDate)}</td><td style="min-width:150px"><div class="progress-line"><span style="width:${projectCompletion(project.id)}%"></span></div><div class="progress-meta"><span>${projectCompletion(project.id)}%</span><span>${state.items.filter(item=>item.projectId===project.id).length} items</span></div></td><td>${statusChip(project.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-view-project="${project.id}">View</button>${canEdit?`<button class="btn btn-secondary btn-sm" data-add-project-items="${project.id}">Add Items</button><button class="btn btn-secondary btn-sm" data-assign-section-project="${project.id}">Assign</button><button class="btn btn-ghost btn-sm" data-edit-project="${project.id}">✎</button>`:''}${can('ADMIN')?`<button class="btn btn-danger btn-sm" data-delete-project="${project.id}">×</button>`:''}</div></td></tr>`}).join(''):`<tr><td colspan="9">${emptyState('▣','No projects found','Create a project or import the MASTER SHEET to begin.')}</td></tr>`;
      bindProjectRowActions();
    };
    draw();
    document.getElementById('project-search').oninput=draw; document.getElementById('project-status').onchange=draw; document.getElementById('project-section').onchange=draw;
    document.getElementById('project-clear').onclick=()=>{document.getElementById('project-search').value='';document.getElementById('project-status').value='';document.getElementById('project-section').value='';draw();};
    if(document.getElementById('add-project')) document.getElementById('add-project').onclick=()=>openProjectForm();
  }
  function bindProjectRowActions(){document.querySelectorAll('[data-view-project]').forEach(b=>b.onclick=()=>openProjectDetail(b.dataset.viewProject));document.querySelectorAll('[data-add-project-items]').forEach(b=>b.onclick=()=>openProjectItemsModal(b.dataset.addProjectItems));document.querySelectorAll('[data-assign-section-project]').forEach(b=>b.onclick=()=>openSectionAssignmentModal(b.dataset.assignSectionProject));document.querySelectorAll('[data-edit-project]').forEach(b=>b.onclick=()=>openProjectForm(projectById(b.dataset.editProject)));document.querySelectorAll('[data-delete-project]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.deleteProject));}
  async function deleteProject(id){
    if(!requireRole('ADMIN'))return;
    const p=projectById(id);if(!p)return;
    if(!confirm(`Delete ${p.name} and all of its production items, shortages and issues?`))return;
    await withOperationalMutationLock(`project-delete:${id}`, null, async()=>{
      const itemIds=new Set(state.items.filter(i=>i.projectId===id).map(i=>i.id));
      state.projects=state.projects.filter(x=>x.id!==id);
      state.items=state.items.filter(i=>i.projectId!==id);
      state.shortages=state.shortages.filter(x=>x.projectId!==id&&!itemIds.has(x.itemId));
      state.issues=state.issues.filter(x=>x.projectId!==id&&!itemIds.has(x.itemId));
      audit('DELETE','Projects',`Deleted project ${p.name} and its operational records`,id);
      try{await saveState();renderProjects();toast('Project deleted');}
      catch(error){renderProjects();toast('Delete failed',error.message,'error');}
    });
  }

  function createProjectLineItemDraft(item = {}) {
    return {
      id: String(item.id || `PLI-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`),
      lineItemName: String(item.lineItemName || ''),
      section: canonicalSection(item.section),
      assignedExecutiveId: String(item.assignedExecutiveId || ''),
      uom: String(item.uom || 'Nos.'),
      requiredQuantity: item.requiredQuantity ?? '',
      dispatchQuantity: item.dispatchQuantity ?? 0,
      pendingQuantity: item.pendingQuantity ?? 0,
    };
  }

  function projectLineItemRowHtml(item = {}) {
    const row = createProjectLineItemDraft(item);
    return `<tr data-project-line-item-id="${esc(row.id)}">
      <td><input class="line-item-name" required maxlength="300" value="${esc(row.lineItemName)}" placeholder="Line Item Name"></td>
      <td><select class="line-item-section" required><option value="">Select section</option>${SECTIONS.map(section=>`<option value="${section}" ${row.section===section?'selected':''}>${section}</option>`).join('')}</select></td>
      <td><input class="line-item-uom" required maxlength="40" value="${esc(row.uom)}" placeholder="Nos."></td>
      <td><input class="line-item-required" type="number" required min="0.0001" step="any" value="${esc(row.requiredQuantity)}"></td>
      <td><input class="line-item-dispatch" type="number" required min="0" step="any" value="${esc(row.dispatchQuantity)}"></td>
      <td><input class="line-item-pending" type="number" step="any" value="${esc(row.pendingQuantity)}" readonly tabindex="-1"></td>
      <td><button type="button" class="btn btn-danger btn-sm" data-delete-line-item-row>Delete Row</button></td>
    </tr>`;
  }

  function recalculateProjectLineItemRow(row) {
    const requiredInput = row.querySelector('.line-item-required');
    const dispatchInput = row.querySelector('.line-item-dispatch');
    const pendingInput = row.querySelector('.line-item-pending');
    const required = Number(requiredInput.value);
    const dispatch = Number(dispatchInput.value);
    requiredInput.setCustomValidity(Number.isFinite(required) && required > 0 ? '' : 'Required Quantity must be greater than zero.');
    dispatchInput.setCustomValidity(Number.isFinite(dispatch) && dispatch >= 0 && Number.isFinite(required) && dispatch <= required ? '' : dispatch > required ? 'Dispatch Quantity cannot exceed Required Quantity.' : 'Dispatch Quantity cannot be negative.');
    pendingInput.value = Number.isFinite(required) && Number.isFinite(dispatch) ? Math.round(Math.max(0, required - dispatch) * 10000) / 10000 : 0;
  }

  function bindProjectLineItemRows() {
    document.querySelectorAll('#project-line-items-body tr').forEach(row => {
      row.querySelectorAll('.line-item-required,.line-item-dispatch').forEach(input => {
        input.oninput = () => recalculateProjectLineItemRow(row);
        input.onchange = () => recalculateProjectLineItemRow(row);
      });
      const deleteButton = row.querySelector('[data-delete-line-item-row]');
      if (deleteButton) deleteButton.onclick = () => row.remove();
      recalculateProjectLineItemRow(row);
    });
  }

  function collectProjectLineItems(form) {
    const rows = [...form.querySelectorAll('#project-line-items-body tr')];
    rows.forEach(recalculateProjectLineItemRow);
    if (!form.reportValidity()) return null;
    return rows.map(row => ({
      id: String(row.dataset.projectLineItemId || '').trim(),
      lineItemName: String(row.querySelector('.line-item-name').value || '').trim(),
      section: canonicalSection(row.querySelector('.line-item-section').value),
      uom: String(row.querySelector('.line-item-uom').value || 'Nos.').trim(),
      requiredQuantity: Number(row.querySelector('.line-item-required').value),
      dispatchQuantity: Number(row.querySelector('.line-item-dispatch').value),
    }));
  }

  function renderProjectItemsModal(project, records = []) {
    openModal(`Add Items — ${project.name}`, `<form id="project-line-items-form">
      <div class="table-wrap"><table><thead><tr><th>Line Item Name</th><th>Section</th><th>UOM</th><th>Required Quantity</th><th>Dispatch Quantity</th><th>Pending Quantity</th><th>Action</th></tr></thead><tbody id="project-line-items-body">${records.map(projectLineItemRowHtml).join('')}</tbody></table></div>
      <div style="margin-top:14px"><button type="button" class="btn btn-secondary" id="add-project-line-item-row">+ Add Row</button></div>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-project-line-items">Save All Items</button>`, 'modal-xl');
    activeProjectItemsModalProjectId = project.id;
    const body = document.getElementById('project-line-items-body');
    if (!records.length) body.insertAdjacentHTML('beforeend', projectLineItemRowHtml());
    bindProjectLineItemRows();
    document.getElementById('add-project-line-item-row').onclick = () => {
      body.insertAdjacentHTML('beforeend', projectLineItemRowHtml());
      bindProjectLineItemRows();
      body.lastElementChild?.querySelector('.line-item-name')?.focus();
    };
    document.getElementById('save-project-line-items').onclick = async event => {
      const form = document.getElementById('project-line-items-form');
      const items = collectProjectLineItems(form);
      if (!items) return;
      if (!items.length && records.length && !confirm('Save with no rows? All saved line items for this project will be removed.')) return;
      await withOperationalMutationLock(`project-line-items:${project.id}`, event.currentTarget, async () => {
        setFormBusy(form, true);
        projectItemsModalSaving = true;
        try {
          const result = await callProjectLineItemsApi('save-all', { projectId: project.id, items });
          for (const productionRecord of result.productionRecords || []) applyConfirmedItemRecord(productionRecord);
          try { await loadOperationalData({ renderAfter: false }); }
          catch (reloadError) { console.warn('Production synchronization reload failed; Realtime will reconcile it.', reloadError); }
          closeModal();
          if (currentRoute === 'production') renderProduction();
          toast('Line items saved', `${items.length} item(s) saved and synchronized with Production Tracker.`);
        } catch (error) {
          toast('Line item save failed', error.message, 'error');
        } finally {
          projectItemsModalSaving = false;
          setFormBusy(form, false);
        }
      });
    };
  }

  async function openProjectItemsModal(projectId) {
    if (!requireRole('ADMIN','MANAGER')) return;
    const project = projectById(projectId);
    if (!project) return toast('Project unavailable', 'Reload the Projects page and try again.', 'error');
    const current = getCurrentUser();
    if (current?.role === 'MANAGER' && project.managerId !== current.id) {
      return toast('Access denied', 'Managers can add items only to projects assigned to them.', 'error');
    }
    openModal(`Add Items — ${project.name}`, `<div class="empty-state"><div class="empty-icon">${ICONS.clock}</div><h3>Loading line items</h3><p>Please wait while saved items are retrieved.</p></div>`, `<button class="btn btn-secondary" data-close-modal>Close</button>`, 'modal-xl');
    activeProjectItemsModalProjectId = project.id;
    try {
      const result = await callProjectLineItemsApi('list', { projectId: project.id });
      renderProjectItemsModal(project, Array.isArray(result.records) ? result.records : []);
    } catch (error) {
      closeModal();
      toast('Unable to load line items', error.message, 'error');
    }
  }

  function scheduleProjectItemsModalRefresh(projectId, delayMs = 120) {
    if (!projectId || projectItemsModalSaving || activeProjectItemsModalProjectId !== projectId || !document.getElementById('project-line-items-form')) return;
    clearTimeout(projectItemsModalReloadTimer);
    projectItemsModalReloadTimer = setTimeout(async () => {
      if (projectItemsModalSaving || activeProjectItemsModalProjectId !== projectId || !document.getElementById('project-line-items-form')) return;
      const project = projectById(projectId);
      if (!project) return;
      try {
        const result = await callProjectLineItemsApi('list', { projectId });
        if (activeProjectItemsModalProjectId === projectId && document.getElementById('project-line-items-form')) {
          renderProjectItemsModal(project, Array.isArray(result.records) ? result.records : []);
        }
      } catch (error) {
        console.warn('Open Add Items popup could not refresh after a Production Tracker update.', error);
      }
    }, Math.max(0, delayMs));
  }

  function openProjectForm(project=null) {
    if(!requireRole('ADMIN','MANAGER'))return;
    const current=getCurrentUser();
    if(current.role==='MANAGER'&&project&&project.managerId!==current.id)return toast('Access denied','Managers can update only projects assigned to them.','error');
    const managers=current.role==='MANAGER'?[current]:state.users.filter(u=>u.role==='MANAGER'&&u.status==='Active');
    const executives=current.role==='MANAGER'?manageableExecutives(current.id):state.users.filter(u=>u.role==='EXECUTIVE'&&u.status==='Active');
    openModal(project?'Edit Project':'Create Project',`<form id="project-form">
      <div class="form-grid">
        <div class="form-group"><label>Project name *</label><input name="name" required value="${esc(project?.name||'')}"></div>
        <div class="form-group"><label>Project code</label><input name="code" value="${esc(project?.code||'')}"></div>
        <div class="form-group"><label>Client</label><input name="client" value="${esc(project?.client||'')}"></div>
        <div class="form-group"><label>Site</label><input name="site" value="${esc(project?.site||'')}"></div>
        <div class="form-group"><label>Job number</label><input name="jobNumber" value="${esc(project?.jobNumber||'')}"></div>
        <div class="form-group"><label>Status</label><select name="status">${['Active','Delayed','Completed','On Hold'].map(x=>`<option ${project?.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="form-group"><label>Start date</label><input name="startDate" type="date" value="${project?.startDate||todayISO()}"></div>
        <div class="form-group"><label>Target date</label><input name="targetDate" type="date" value="${project?.targetDate||''}"></div>
        <div class="form-group"><label>Manager</label><select name="managerId"><option value="">Unassigned</option>${managers.map(u=>`<option value="${u.id}" ${project?.managerId===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Priority</label><select name="priority">${['Low','Medium','High','Critical'].map(x=>`<option ${project?.priority===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Assigned Executives</label><div class="grid grid-2">${executives.length?executives.map(u=>`<label class="input-row small"><input type="checkbox" name="executives" value="${u.id}" style="width:auto" ${(project?.executiveIds||[]).includes(u.id)?'checked':''}> ${esc(u.name)}</label>`).join(''):'<span class="muted small">Create Executive users first.</span>'}</div></div>
    </form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-project">Save Project</button>`);
    document.getElementById('save-project').onclick=async event=>{
      const form=document.getElementById('project-form');if(!form.reportValidity())return;const fd=new FormData(form);
      const data={name:String(fd.get('name')).trim(),code:String(fd.get('code')||'').trim()||`PRJ-${String(state.projects.length+1).padStart(4,'0')}`,client:String(fd.get('client')||'').trim(),site:String(fd.get('site')||'').trim(),jobNumber:String(fd.get('jobNumber')||'').trim(),status:String(fd.get('status')),startDate:String(fd.get('startDate')||''),targetDate:String(fd.get('targetDate')||''),managerId:String(fd.get('managerId')||''),executiveIds:fd.getAll('executives').map(String),priority:String(fd.get('priority')||'Medium')};
      const lockKey=`project-save:${project?.id||data.code}`;
      await withOperationalMutationLock(lockKey,event.currentTarget,async()=>{
        setFormBusy(form,true);
        try{
          if(project){Object.assign(project,data,{updatedAt:nowISO()});audit('UPDATE','Projects',`Updated project ${data.name}`,project.id);}
          else{const p={id:uid('PRJ'),...data,createdAt:nowISO()};state.projects.push(p);audit('CREATE','Projects',`Created project ${data.name}`,p.id);if(p.managerId)notify(p.managerId,'Project assigned',`${p.name} has been assigned to you.`,'Assignment',p.id);p.executiveIds.forEach(id=>notify(id,'Work assigned',`${p.name} has been assigned to you.`,'Assignment',p.id));}
          await saveState();
          closeModal();renderProjects();toast('Project saved','Project information has been updated.');
        }catch(error){toast('Project save failed',error.message,'error');}
        finally{setFormBusy(form,false);}
      });
    };
  }

  function openProjectDetail(id) {
    const p=projectById(id);if(!p)return;if(!assignedProjects().some(x=>x.id===id))return toast('Access denied','This project is not assigned to your account.','error');const items=visibleItems().filter(i=>i.projectId===id);const shortages=visibleShortages().filter(s=>s.projectId===id&&s.status!=='Resolved');
    openModal(p.name,`<div class="grid grid-4">
      ${miniMetric('Project Code',p.code)}${miniMetric('Job Number',p.jobNumber||'—')}${miniMetric('Completion',projectCompletion(p.id)+'%')}${miniMetric('Target Date',fmtDate(p.targetDate))}
    </div>
    <div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="card-body"><h3 class="mt-0">Project Details</h3><p class="small muted">Client</p><strong>${esc(p.client||'—')}</strong><p class="small muted">Site</p><strong>${esc(p.site||'—')}</strong><p class="small muted">Manager</p><strong>${esc(userById(p.managerId)?.name||'Unassigned')}</strong><p class="small muted">Executives</p><strong>${esc((p.executiveIds||[]).map(x=>userById(x)?.name).filter(Boolean).join(', ')||'Unassigned')}</strong></div></div><div class="card"><div class="card-body"><h3 class="mt-0">Production Summary</h3>${STAGES.map((s,idx)=>{const count=items.filter(i=>i.currentStage===idx).length;return `<div style="margin:10px 0"><div class="progress-meta"><span>${esc(s)}</span><strong>${count}</strong></div><div class="progress-line"><span style="width:${items.length?count/items.length*100:0}%"></span></div></div>`}).join('')}</div></div></div>
    <h3 style="margin-top:22px">Items (${items.length})</h3><div class="table-wrap"><table><thead><tr><th>Item</th><th>Section</th><th>Assigned To</th><th>BOM</th><th>Quantity</th><th>Current Stage</th><th>Status</th><th></th></tr></thead><tbody>${items.length?items.map(i=>`<tr><td>${esc(i.itemName)}</td><td>${esc(itemSection(i))}</td><td>${esc(assignedExecutiveName(i))}</td><td>${esc(i.bomNumber||'—')}</td><td>${fmtNumber(i.quantity)}</td><td>${esc(STAGES[i.currentStage])}</td><td>${statusChip(i.approvalStatus==='SUBMITTED'?'Submitted':i.status)}</td><td><button class="btn btn-secondary btn-sm" data-modal-item="${i.id}">Open</button></td></tr>`).join(''):'<tr><td colspan="8" class="muted">No items in this project.</td></tr>'}</tbody></table></div>
    ${shortages.length?`<h3 style="margin-top:22px">Open Shortages</h3><div class="info-banner warning"><div>⚠</div><div><strong>${shortages.length} shortage(s) require attention</strong><p>${shortages.map(s=>s.material).join(', ')}</p></div></div>`:''}`, `<button class="btn btn-secondary" data-close-modal>Close</button>`,'modal-xl');
    document.querySelectorAll('[data-modal-item]').forEach(b=>b.onclick=()=>{closeModal();openItemDetail(b.dataset.modalItem);});
  }
  function miniMetric(label,value){return `<div class="card"><div class="card-body"><span class="small muted">${esc(label)}</span><strong style="display:block;font-size:18px;margin-top:7px">${esc(value)}</strong></div></div>`;}

  function renderProduction() {
    setPageTitle('Production Tracker','Seven-stage manufacturing workflow');
    const items=visibleItems(),projects=assignedProjects();
    const page=document.getElementById('page-content');
    page.innerHTML=`${pageToolbar('Production Progress Tracker','Track every item from planning to ready for dispatch.',`<button class="btn btn-primary" id="add-item">+ Add Item</button>${can('ADMIN','MANAGER')?'<button class="btn btn-secondary" id="assign-section-work">Assign Section Work</button>':''}`)}
      <div class="filter-bar"><div class="filter-item search-wide"><input id="item-search" placeholder="Search item, BOM, job number, section or executive"></div><div class="filter-item"><select id="item-project"><option value="">All projects</option>${projects.map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}</select></div><div class="filter-item"><select id="item-section"><option value="">All sections</option>${SECTIONS.map(section=>`<option>${section}</option>`).join('')}</select></div><div class="filter-item"><select id="item-stage"><option value="">All stages</option>${STAGES.map((stage,index)=>`<option value="${index}">${esc(stage)}</option>`).join('')}</select></div><div class="filter-item"><select id="item-status"><option value="">All statuses</option><option>In Progress</option><option>Delayed</option><option>Completed</option><option>On Hold</option></select></div></div>
      <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Item</th><th>Project</th><th>Section</th><th>Assigned To</th><th>BOM / Job</th><th>Qty</th><th>Current Stage</th><th>Progress</th><th>Status</th><th>Action</th></tr></thead><tbody id="items-body"></tbody></table></div><div class="table-footer"><span id="items-count"></span><span>Open an item to view its complete timeline</span></div></section>`;
    const draw=()=>{const q=document.getElementById('item-search').value.toLowerCase(),pid=document.getElementById('item-project').value,section=document.getElementById('item-section').value,stage=document.getElementById('item-stage').value,status=document.getElementById('item-status').value;const rows=items.filter(item=>(!q||[item.itemName,item.bomNumber,item.jobNumber,itemSection(item),assignedExecutiveName(item)].some(value=>String(value||'').toLowerCase().includes(q)))&&(!pid||item.projectId===pid)&&(!section||itemSection(item)===section)&&(!stage||String(item.currentStage)===stage)&&(!status||item.status===status));document.getElementById('items-count').textContent=`${rows.length} item(s)`;document.getElementById('items-body').innerHTML=rows.length?rows.map(item=>`<tr><td><strong>${esc(item.itemName)}</strong><div class="small muted">${esc(item.size||item.site||'')}</div></td><td>${esc(projectById(item.projectId)?.name||'Unknown')}</td><td>${statusChip(itemSection(item))}</td><td>${esc(assignedExecutiveName(item))}</td><td>${esc(item.bomNumber||'—')}<div class="small muted">${esc(item.jobNumber||'—')}</div></td><td>${fmtNumber(item.quantity)}${item.quantityVerified?'':' <span title="Unverified">⚠</span>'}</td><td>${canUpdateItemStage(item)?`<select class="table-stage-select" data-stage-item="${item.id}" aria-label="Update current stage for ${esc(item.itemName)}">${STAGES.map((stageName,index)=>`<option value="${index}" ${Number(item.currentStage)===index?'selected':''}>${esc(stageName)}</option>`).join('')}</select>`:esc(STAGES[item.currentStage]||'PLANNING')}</td><td style="min-width:140px"><div class="progress-line"><span style="width:${completionPercent(item)}%"></span></div><div class="progress-meta"><span>${completionPercent(item)}%</span><span>${item.approvalStatus==='SUBMITTED'?'Awaiting approval':''}</span></div></td><td>${statusChip(item.approvalStatus==='SUBMITTED'?'Submitted':item.status)}</td><td><button class="btn btn-secondary btn-sm" data-view-item="${item.id}">Open</button></td></tr>`).join(''):`<tr><td colspan="10">${emptyState('⚙','No production items','Import Excel data or add an item manually.')}</td></tr>`;document.querySelectorAll('[data-view-item]').forEach(button=>button.onclick=()=>openItemDetail(button.dataset.viewItem));document.querySelectorAll('[data-stage-item]').forEach(select=>select.onchange=()=>updateItemStageDirect(select.dataset.stageItem,select.value,select));};
    draw();['item-search','item-project','item-section','item-stage','item-status'].forEach(id=>document.getElementById(id).addEventListener(id==='item-search'?'input':'change',draw));
    if(document.getElementById('add-item'))document.getElementById('add-item').onclick=()=>openItemForm();
    if(document.getElementById('assign-section-work'))document.getElementById('assign-section-work').onclick=()=>openSectionAssignmentModal();
  }

  function openItemForm(item=null) {
    if(item){if(!requireRole('ADMIN','MANAGER'))return;}else if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;
    if(item&&!visibleItems().some(x=>x.id===item.id))return toast('Access denied','This production item is not assigned to your account.','error');
    const projects=assignedProjects();
    if(!projects.length)return toast('Create a project first','Production items must belong to a project.','warning');
    openModal(item?'Edit Production Item':'Add Production Item',`<form id="item-form"><div class="form-grid"><div class="form-group"><label>Project *</label><select name="projectId" required>${projects.map(p=>`<option value="${p.id}" ${item?.projectId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="form-group"><label>Section *</label><select name="section" required><option value="">Select section</option>${SECTIONS.map(section=>`<option value="${section}" ${itemSection(item)===section?'selected':''}>${section}</option>`).join('')}</select></div><div class="form-group"><label>Quantity</label><input name="quantity" type="number" min="0" step="any" value="${item?.quantity??0}"></div><div class="form-group" style="grid-column:1/-1"><label>Item name *</label><textarea name="itemName" required placeholder="Enter complete item description">${esc(item?.itemName||'')}</textarea></div><div class="form-group"><label>BOM number</label><input name="bomNumber" value="${esc(item?.bomNumber||'')}"></div><div class="form-group"><label>Job number</label><input name="jobNumber" value="${esc(item?.jobNumber||'')}"></div><div class="form-group"><label>Size</label><input name="size" value="${esc(item?.size||'')}"></div>${item?`<div class="form-group"><label>Current stage</label><input value="${esc(STAGES[item.currentStage])}" disabled><div class="help-text">Use the stage workflow controls to move this item.</div></div>`:`<div class="form-group"><label>Current stage</label><select name="currentStage">${STAGES.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join('')}</select></div>`}</div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-item">${item?'Save Changes':'Add Item'}</button>`);
    document.getElementById('save-item').onclick=async event=>{
      const f=document.getElementById('item-form');if(!f.reportValidity())return;
      const fd=new FormData(f),p=projectById(String(fd.get('projectId')));if(!p)return toast('Project unavailable','Reload the data and try again.','error');
      await withOperationalMutationLock(`item-save:${item?.id||String(fd.get('itemName')).trim()}`,event.currentTarget,async()=>{
        setFormBusy(f,true);
        try{
          if(item){
            Object.assign(item,{projectId:p.id,projectLineItemId:item.projectLineItemId||item.id,itemName:String(fd.get('itemName')).trim(),rawItemName:String(fd.get('itemName')).trim(),site:p.site,size:String(fd.get('size')||''),quantity:number(fd.get('quantity')),uom:String(item.uom||'Nos.').trim(),dispatchQuantity:number(item.dispatchQuantity||0),pendingQuantity:Math.max(0,number(fd.get('quantity'))-number(item.dispatchQuantity||0)),quantityVerified:true,section:canonicalSection(fd.get('section')),assignedExecutiveId:itemSection(item)===canonicalSection(fd.get('section'))?String(item.assignedExecutiveId||''):'',assignedBy:itemSection(item)===canonicalSection(fd.get('section'))?String(item.assignedBy||''):'',assignedAt:itemSection(item)===canonicalSection(fd.get('section'))?String(item.assignedAt||''):'',bomNumber:String(fd.get('bomNumber')||''),jobNumber:String(fd.get('jobNumber')||p.jobNumber||''),updatedAt:nowISO()});
            item.history=item.history||[];item.history.push(historyEvent(item,'Item Details Updated',item.status,'Production item master details updated.'));
            audit('UPDATE','Production',`Updated production item ${item.itemName}`,item.id);
          }else{
            const idx=Number(fd.get('currentStage')),itemName=String(fd.get('itemName')).trim(),section=canonicalSection(fd.get('section')),uom='Nos.',required=number(fd.get('quantity')),dispatch=0;const existing=state.items.find(existingItem=>existingItem.projectId===p.id&&itemSection(existingItem)===section&&String(existingItem.itemName||'').trim().toLowerCase()===itemName.toLowerCase()&&String(existingItem.uom||'Nos.').trim().toUpperCase()===uom.toUpperCase());
            if(existing){const existingDispatch=number(existing.dispatchQuantity||0);Object.assign(existing,{projectLineItemId:existing.projectLineItemId||existing.id,itemName,rawItemName:itemName,section,uom,quantity:required,dispatchQuantity:existingDispatch,pendingQuantity:Math.max(0,required-existingDispatch),quantityVerified:true,updatedAt:nowISO()});existing.history=existing.history||[];existing.history.push(historyEvent(existing,'Item Details Updated',existing.status,'Production item quantities synchronized with Projects Add Items.'));audit('UPDATE','Production',`Updated existing production item ${existing.itemName}`,existing.id);}
            else{const itemId=uid('ITM');const i={id:itemId,projectId:p.id,projectLineItemId:itemId,itemName,rawItemName:itemName,section,assignedExecutiveId:getCurrentUser().role==='EXECUTIVE'?getCurrentUser().id:'',assignedBy:getCurrentUser().role==='EXECUTIVE'?getCurrentUser().id:'',assignedAt:getCurrentUser().role==='EXECUTIVE'?nowISO():'',site:p.site,size:String(fd.get('size')||''),quantity:required,uom,dispatchQuantity:dispatch,pendingQuantity:Math.max(0,required-dispatch),quantityVerified:true,bomNumber:String(fd.get('bomNumber')||''),jobNumber:String(fd.get('jobNumber')||p.jobNumber||''),currentStage:idx,currentStageName:STAGES[idx],status:'In Progress',approvalStatus:'',shortages:'',remarks:'',createdAt:nowISO(),updatedAt:nowISO(),history:[{id:uid('HIS'),stageIndex:idx,stageName:STAGES[idx],action:'Created',status:'In Progress',updatedBy:getCurrentUser().id,updatedByName:getCurrentUser().name,date:nowISO(),remarks:'Production item created manually.',attachments:[]}]};state.items.push(i);audit('CREATE','Production',`Created production item ${i.itemName}`,i.id);}
          }
          await saveState();
          closeModal();renderProduction();toast(item?'Item updated':'Item created','Production item saved successfully.');
        }catch(error){toast('Production item save failed',error.message,'error');}
        finally{setFormBusy(f,false);}
      });
    };
  }

  function openItemDetail(id) {
    const item=itemById(id);if(!item)return;if(!visibleItems().some(x=>x.id===id))return toast('Access denied','This production item is not assigned to your account.','error');const project=projectById(item.projectId),user=getCurrentUser();const canApprove=['ADMIN','MANAGER'].includes(user.role)&&item.approvalStatus==='SUBMITTED';
    const timeline=STAGES.map((s,idx)=>{let cls='pending',symbol=idx+1;if(idx<item.currentStage){cls='completed';symbol='✓';}else if(idx===item.currentStage){cls=item.status==='Delayed'?'delayed':item.approvalStatus==='SUBMITTED'?'submitted':'current';symbol=item.status==='Delayed'?'!':item.approvalStatus==='SUBMITTED'?'↥':idx+1;}const hist=[...(item.history||[])].reverse().find(h=>h.stageIndex===idx);return `<div class="timeline-stage ${cls}"><div class="stage-circle">${symbol}</div><div class="stage-name">${esc(s)}</div><div class="stage-meta">${hist?`${fmtDate(hist.date)}<br>${esc(hist.updatedByName||'')}`:idx<item.currentStage?'Imported stage':'Pending'}</div></div>`}).join('');
    openModal(item.itemName,`<div class="info-banner"><div>⚙</div><div><strong>${esc(project?.name||'Unknown project')}</strong><p>BOM: ${esc(item.bomNumber||'—')} • Job: ${esc(item.jobNumber||'—')} • Quantity: ${fmtNumber(item.quantity)}</p></div></div><div class="timeline">${timeline}</div>
      <div class="grid grid-3" style="margin-top:18px">${miniMetric('Current Stage',STAGES[item.currentStage])}${miniMetric('Progress',completionPercent(item)+'%')}${miniMetric('Status',item.approvalStatus==='SUBMITTED'?'Awaiting Approval':item.status)}</div>
      <div class="tabs" style="margin-top:20px"><button class="tab active" data-item-tab="history">Stage History</button><button class="tab" data-item-tab="details">Item Details</button><button class="tab" data-item-tab="attachments">Attachments</button></div><div id="item-tab-content">${itemHistoryHtml(item)}</div>`,
      `<button class="btn btn-secondary" data-close-modal>Close</button>${can('ADMIN','MANAGER')?'<button class="btn btn-secondary" id="edit-item">Edit Item</button>':''}${can('ADMIN','MANAGER')?'<button class="btn btn-danger" id="delete-item">Delete Item</button>':''}${canUpdateItemStage(item)&&item.approvalStatus!=='SUBMITTED'&&item.currentStage<STAGES.length-1?'<button class="btn btn-primary" id="update-stage">Update Stage</button>':''}${canApprove?'<button class="btn btn-danger" id="reject-stage">Reject</button><button class="btn btn-success" id="approve-stage">Approve & Continue</button>':''}${item.currentStage===STAGES.length-1&&item.status!=='Completed'&&can('ADMIN','MANAGER')?'<button class="btn btn-success" id="complete-item">Mark Completed</button>':''}`,'modal-xl');
    document.querySelectorAll('[data-item-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-item-tab]').forEach(x=>x.classList.toggle('active',x===b));const c=document.getElementById('item-tab-content');c.innerHTML=b.dataset.itemTab==='history'?itemHistoryHtml(item):b.dataset.itemTab==='details'?itemDetailsHtml(item,project):itemAttachmentsHtml(item);bindAttachmentLinks();});
    if(document.getElementById('edit-item'))document.getElementById('edit-item').onclick=()=>{closeModal();openItemForm(item);};
    if(document.getElementById('delete-item'))document.getElementById('delete-item').onclick=()=>deleteItem(item.id);
    if(document.getElementById('update-stage'))document.getElementById('update-stage').onclick=()=>openStageUpdate(item);
    if(document.getElementById('approve-stage'))document.getElementById('approve-stage').onclick=()=>approveStage(item,true);
    if(document.getElementById('reject-stage'))document.getElementById('reject-stage').onclick=()=>rejectStage(item);
    if(document.getElementById('complete-item'))document.getElementById('complete-item').onclick=async event=>{
      const current=itemById(item.id);if(!current)return;
      const draft=cloneJson(current);draft.status='Completed';draft.approvalStatus='';
      const saved=await persistItemWorkflowChange({
        itemId:current.id,
        patch:{status:'Completed',approvalStatus:''},
        historyEvents:[historyEvent(draft,'Completed','Completed','Item marked ready and completed.')],
        auditRecords:[workflowAuditRecord('COMPLETE',`Completed ${current.itemName}`,current.id)],
        control:event.currentTarget
      });
      if(!saved)return;closeModal();renderProduction();toast('Item completed','The database confirmed the completed status.');
    };
    bindAttachmentLinks();
  }
  async function deleteItem(id){
    if(!requireRole('ADMIN','MANAGER'))return;
    const item=itemById(id);if(!item)return;
    if(!confirm(`Delete ${item.itemName} and its complete stage history?`))return;
    await withOperationalMutationLock(`item-delete:${id}`,null,async()=>{
      state.items=state.items.filter(i=>i.id!==id);
      state.shortages=state.shortages.filter(s=>s.itemId!==id);
      state.issues=state.issues.filter(x=>x.itemId!==id);
      audit('DELETE','Production',`Deleted production item ${item.itemName}`,id);
      try{await saveState();closeModal();renderProduction();toast('Item deleted');}
      catch(error){renderProduction();toast('Delete failed',error.message,'error');}
    });
  }

  function itemHistoryHtml(item){const h=[...(item.history||[])].reverse();return h.length?`<div class="activity-list">${h.map(x=>`<div class="activity-item"><div class="activity-icon">${x.status==='Approved'?'✓':x.status==='Rejected'?'!':'⚙'}</div><div class="activity-main"><strong>${esc(x.stageName)} • ${esc(x.action)}</strong><span>${esc(x.remarks||'No remarks')}<br>${esc(x.updatedByName||'Unknown user')} • ${esc(x.status||'')}</span>${(x.attachments||[]).length?`<div>${x.attachments.map(a=>`<button class="file-chip" data-file-id="${a.id}" data-item-id="${item.id}">▤ ${esc(a.name)}</button>`).join('')}</div>`:''}</div><div class="activity-time">${fmtDate(x.date,true)}</div></div>`).join('')}</div>`:emptyState('◷','No stage history','Updates will appear here.');}
  function itemDetailsHtml(i,p){return `<div class="grid grid-2"><div>${detailRow('Project',p?.name)}${detailRow('Section',itemSection(i))}${detailRow('Assigned To',assignedExecutiveName(i))}${detailRow('Due Date',fmtDate(itemDueDate(i)))}${detailRow('Priority',itemPriority(i))}${detailRow('Site',i.site||p?.site)}${detailRow('BOM Number',i.bomNumber)}${detailRow('Job Number',i.jobNumber)}${detailRow('Size',i.size)}${detailRow('Quantity',fmtNumber(i.quantity))}</div><div>${detailRow('Current Stage',STAGES[i.currentStage])}${detailRow('Status',i.status)}${detailRow('Quantity Verified',i.quantityVerified?'Yes':'No')}${detailRow('Shortages',i.shortages||'None')}${detailRow('Created',fmtDate(i.createdAt,true))}${detailRow('Updated',fmtDate(i.updatedAt,true))}</div></div>`;}
  function detailRow(label,value){return `<div class="setting-row"><div class="setting-copy"><span>${esc(label)}</span></div><strong>${esc(value||'—')}</strong></div>`;}
  function itemAttachmentsHtml(item){const files=(item.history||[]).flatMap(h=>(h.attachments||[]).map(a=>({...a,stage:h.stageName,date:h.date})));return files.length?`<div class="table-wrap"><table><thead><tr><th>File</th><th>Stage</th><th>Uploaded</th><th>Action</th></tr></thead><tbody>${files.map(a=>`<tr><td>${esc(a.name)}<div class="small muted">${fmtNumber(a.size/1024)} KB</div></td><td>${esc(a.stage)}</td><td>${fmtDate(a.date,true)}</td><td><button class="btn btn-secondary btn-sm" data-file-id="${a.id}" data-item-id="${item.id}">Open</button></td></tr>`).join('')}</tbody></table></div>`:emptyState('▤','No attachments','Files uploaded during stage updates will appear here.');}
  function bindAttachmentLinks(){document.querySelectorAll('[data-file-id]').forEach(b=>b.onclick=()=>{const item=itemById(b.dataset.itemId);const file=(item.history||[]).flatMap(h=>h.attachments||[]).find(a=>a.id===b.dataset.fileId);if(file?.data){const a=document.createElement('a');a.href=file.data;a.download=file.name;a.click();}else toast('File unavailable','Only metadata is stored for large files.','warning');});}
  function historyEvent(item,action,status,remarks,attachments=[]){return{id:uid('HIS'),stageIndex:item.currentStage,stageName:STAGES[item.currentStage],action,status,updatedBy:getCurrentUser().id,updatedByName:getCurrentUser().name,date:nowISO(),remarks,attachments};}

  async function updateItemStageDirect(itemId, nextStageValue, control = null) {
    if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;
    const item=itemById(itemId);
    if(!item||!visibleItems().some(x=>x.id===itemId)||!canUpdateItemStage(item))return toast('Access denied','You must be logged in to update a production stage.','error');
    const nextStage=Number(nextStageValue);
    if(!Number.isInteger(nextStage)||nextStage<0||nextStage>=STAGES.length){if(control)control.value=String(item.currentStage);return toast('Invalid stage','Select a valid production stage.','error');}
    const previousStage=Number(item.currentStage||0);
    if(previousStage===nextStage)return;
    const previousStageName=STAGES[previousStage]||'UNKNOWN';
    const nextStatus=item.status==='Completed'&&nextStage<STAGES.length-1?'In Progress':item.status;
    const draft=cloneJson(item);
    draft.currentStage=nextStage;draft.currentStageName=STAGES[nextStage];draft.approvalStatus='';draft.status=nextStatus;
    const saved=await persistItemWorkflowChange({
      itemId:item.id,
      patch:{currentStage:nextStage,currentStageName:STAGES[nextStage],approvalStatus:'',status:nextStatus},
      historyEvents:[historyEvent(draft,'Stage Changed',nextStatus||'In Progress',`Current stage changed directly from ${previousStageName} to ${STAGES[nextStage]} in Production Tracker.`)],
      auditRecords:[workflowAuditRecord('UPDATE',`Changed ${item.itemName} stage from ${previousStageName} to ${STAGES[nextStage]}`,item.id)],
      control
    });
    if(!saved){if(control?.isConnected)control.value=String(previousStage);return;}
    renderProduction();
    toast('Production stage updated',`${saved.itemName} moved to ${STAGES[saved.currentStage]}.`);
  }

  function openStageUpdate(item) {
    if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;
    if(!canUpdateItemStage(item))return toast('Access denied','You must be logged in to update a production stage.','error');
    openModal(`Update: ${STAGES[item.currentStage]}`,`<form id="stage-form"><div class="form-group"><label>Status</label><select name="status"><option>In Progress</option><option>Delayed</option><option>On Hold</option></select></div><div class="form-group"><label>Remarks *</label><textarea name="remarks" required placeholder="Describe work completed, issue or delay reason"></textarea></div><div class="form-group"><label>Images / documents</label><input id="stage-files" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"><div class="help-text">Files up to 500 KB each are stored with the synchronized production record. Larger files are recorded by name only.</div></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="submit-stage">Submit Update</button>`);
    document.getElementById('submit-stage').onclick=async event=>{
      const f=document.getElementById('stage-form');if(!f.reportValidity())return;
      const current=itemById(item.id);if(!current)return toast('Item unavailable','Reload the production tracker and try again.','error');
      const fd=new FormData(f),status=String(fd.get('status')),remarks=String(fd.get('remarks')),files=[...document.getElementById('stage-files').files],attachments=[];
      setFormBusy(f,true);setControlBusy(event.currentTarget,true);
      try {
        for(const file of files.slice(0,4)){attachments.push({id:uid('FIL'),name:file.name,type:file.type,size:file.size,data:file.size<=512000?await fileToDataURL(file):null});}
        const approvalStatus=status==='In Progress'?'SUBMITTED':current.approvalStatus||'';
        const draft=cloneJson(current);draft.status=status;draft.approvalStatus=approvalStatus;
        const notifications=[];const p=projectById(current.projectId);
        if(status==='In Progress'&&p?.managerId)notifications.push(workflowNotificationRecord(p.managerId,'Stage completion submitted',`${current.itemName} is waiting for approval at ${STAGES[current.currentStage]}.`,'Approval',current.id));
        else if(status==='Delayed'&&p?.managerId)notifications.push(workflowNotificationRecord(p.managerId,'Production delay reported',`${current.itemName} is delayed at ${STAGES[current.currentStage]}.`,'Delay',current.id));
        const saved=await persistItemWorkflowChange({
          itemId:current.id,
          patch:{status,approvalStatus,remarks},
          historyEvents:[historyEvent(draft,'Stage Updated',status,remarks,attachments)],
          auditRecords:[workflowAuditRecord('UPDATE',`Updated ${current.itemName} at ${STAGES[current.currentStage]}`,current.id)],
          notifications,
          control:event.currentTarget
        });
        if(!saved)return;
        closeModal();renderProduction();openItemDetail(saved.id);
        toast(saved.approvalStatus==='SUBMITTED'?'Submitted for approval':'Stage updated','The database confirmed the production update.');
      } finally {setFormBusy(f,false);setControlBusy(event.currentTarget,false);}
    };
  }

  async function approveStage(item, _legacyFlag = false) {
    const current=itemById(item.id);if(!current)return;
    const previousStage=Number(current.currentStage||0);
    const nextStage=previousStage<STAGES.length-1?previousStage+1:previousStage;
    const nextStatus=previousStage<STAGES.length-1?'In Progress':'Completed';
    const draft=cloneJson(current);
    const approvedEvent=historyEvent(draft,'Stage Approved','Approved','Stage completion approved by manager.');
    draft.currentStage=nextStage;draft.currentStageName=STAGES[nextStage];draft.status=nextStatus;draft.approvalStatus='';
    const historyEvents=[approvedEvent];
    if(previousStage<STAGES.length-1)historyEvents.push(historyEvent(draft,'Stage Started','In Progress','Next production stage started.'));
    const p=projectById(current.projectId);
    const notifications=(p?.executiveIds||[]).map(id=>workflowNotificationRecord(id,'Stage approved',`${current.itemName} has been approved and moved to ${STAGES[nextStage]}.`,'Approval',current.id));
    const control=document.getElementById('approve-stage');
    const saved=await persistItemWorkflowChange({
      itemId:current.id,
      patch:{approvalStatus:'',currentStage:nextStage,currentStageName:STAGES[nextStage],status:nextStatus},
      historyEvents,
      auditRecords:[workflowAuditRecord('APPROVE',`Approved stage for ${current.itemName}`,current.id)],
      notifications,control
    });
    if(!saved)return;closeModal();renderProduction();toast('Stage approved',saved.status==='Completed'?'Item completed.':`Moved to ${STAGES[saved.currentStage]}.`);
  }

  function rejectStage(item) {
    openModal('Reject Stage',`<form id="reject-form"><div class="form-group"><label>Reason *</label><textarea name="reason" required placeholder="Explain why the stage was rejected"></textarea></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-danger" id="confirm-reject">Reject Stage</button>`);
    document.getElementById('confirm-reject').onclick=async event=>{
      const f=document.getElementById('reject-form');if(!f.reportValidity())return;
      const current=itemById(item.id);if(!current)return;
      const reason=String(new FormData(f).get('reason'));
      const draft=cloneJson(current);draft.approvalStatus='';draft.status='In Progress';
      const p=projectById(current.projectId);
      const notifications=(p?.executiveIds||[]).map(id=>workflowNotificationRecord(id,'Stage rejected',`${current.itemName}: ${reason}`,'Approval',current.id));
      setFormBusy(f,true);
      try {
        const saved=await persistItemWorkflowChange({
          itemId:current.id,
          patch:{approvalStatus:'',status:'In Progress'},
          historyEvents:[historyEvent(draft,'Stage Rejected','Rejected',reason)],
          auditRecords:[workflowAuditRecord('REJECT',`Rejected stage for ${current.itemName}: ${reason}`,current.id)],
          notifications,control:event.currentTarget
        });
        if(!saved)return;closeModal();renderProduction();toast('Stage rejected','Executive has been notified.','warning');
      } finally {setFormBusy(f,false);}
    };
  }
  function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}

  function renderShortages() {
    setPageTitle('Shortages & Issues','Material constraints and production blockers');
    const projects=assignedProjects(),shortages=visibleShortages();
    const page=document.getElementById('page-content');
    page.innerHTML=`${pageToolbar('Shortages & Issues','Report and resolve material shortages affecting production.','<button class="btn btn-primary" id="add-shortage">+ Report Shortage</button>')}
      <div class="grid grid-4">${kpi('⚠','Open Shortages',shortages.filter(s=>s.status==='Open').length,'Requires material action')}${kpi('!','Critical',shortages.filter(s=>s.severity==='Critical'&&s.status!=='Resolved').length,'Immediate escalation')}${kpi('✓','Resolved',shortages.filter(s=>s.status==='Resolved').length,'Closed records')}${kpi('∑','Shortage Qty',fmtNumber(shortages.filter(s=>s.status!=='Resolved').reduce((a,s)=>a+number(s.shortageQty),0)),'Across visible projects')}</div>
      <div class="filter-bar" style="margin-top:18px"><div class="filter-item"><select id="shortage-section-filter"><option value="">All sections</option>${SECTIONS.map(section=>`<option>${section}</option>`).join('')}</select></div></div><section class="card table-card" style="margin-top:18px"><div class="table-wrap"><table><thead><tr><th>Material</th><th>Project / Item</th><th>Section</th><th>Required</th><th>Available</th><th>Shortage</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead><tbody>${shortages.length?shortages.map(s=>`<tr><td><strong>${esc(s.material)}</strong><div class="small muted">${esc(s.remarks||'')}</div></td><td>${esc(projectById(s.projectId)?.name||'—')}<div class="small muted">${esc(itemById(s.itemId)?.itemName||'General project shortage')}</div></td><td>${esc(itemSection(itemById(s.itemId)))}</td><td>${fmtNumber(s.requiredQty)} ${esc(s.uom||'')}</td><td>${fmtNumber(s.availableQty)} ${esc(s.uom||'')}</td><td><strong class="text-danger">${fmtNumber(s.shortageQty)}</strong></td><td>${statusChip(s.severity)}</td><td>${statusChip(s.status)}</td><td><div class="table-actions">${s.status!=='Resolved'&&can('ADMIN','MANAGER')?`<button class="btn btn-success btn-sm" data-resolve-shortage="${s.id}">Resolve</button>`:''}${can('ADMIN')?`<button class="btn btn-danger btn-sm" data-delete-shortage="${s.id}">Delete</button>`:''}${s.status==='Resolved'&&!can('ADMIN')?'—':''}</div></td></tr>`).join(''):`<tr><td colspan="9">${emptyState('⚠','No shortages reported','Production teams can report material constraints here.')}</td></tr>`}</tbody></table></div></section>`;
    document.getElementById('add-shortage').onclick=()=>openShortageForm();
    const shortageSectionFilter=document.getElementById('shortage-section-filter');if(shortageSectionFilter)shortageSectionFilter.onchange=()=>{const selected=shortageSectionFilter.value;document.querySelectorAll('tbody tr').forEach(row=>{const itemText=row.children?.[2]?.textContent?.trim()||'';row.hidden=Boolean(selected&&itemText!==selected);});};
    document.querySelectorAll('[data-resolve-shortage]').forEach(b=>b.onclick=async()=>{
      const shortage=state.shortages.find(x=>x.id===b.dataset.resolveShortage);if(!shortage)return;
      await withOperationalMutationLock(`shortage-resolve:${shortage.id}`,b,async()=>{
        shortage.status='Resolved';shortage.resolvedAt=nowISO();audit('RESOLVE','Shortages',`Resolved shortage for ${shortage.material}`,shortage.id);
        try{await saveState();renderShortages();toast('Shortage resolved');}
        catch(error){renderShortages();toast('Shortage update failed',error.message,'error');}
      });
    });
    document.querySelectorAll('[data-delete-shortage]').forEach(b=>b.onclick=async()=>{
      if(!requireRole('ADMIN'))return;const shortage=state.shortages.find(row=>row.id===b.dataset.deleteShortage);
      if(!shortage||!confirm(`Delete shortage record for ${shortage.material}?`))return;
      await withOperationalMutationLock(`shortage-delete:${shortage.id}`,b,async()=>{
        state.shortages=state.shortages.filter(row=>row.id!==shortage.id);audit('DELETE','Shortages',`Deleted shortage for ${shortage.material}`,shortage.id);
        try{await saveState();renderShortages();toast('Shortage deleted');}
        catch(error){renderShortages();toast('Shortage delete failed',error.message,'error');}
      });
    });
  }
  function openShortageForm(){if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;const projects=assignedProjects();if(!projects.length)return toast('No project available','Create or assign a project first.','warning');openModal('Report Material Shortage',`<form id="shortage-form"><div class="form-grid"><div class="form-group"><label>Project *</label><select name="projectId" id="shortage-project" required>${projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="form-group"><label>Production item</label><select name="itemId" id="shortage-item"></select></div><div class="form-group"><label>Material *</label><input name="material" required></div><div class="form-group"><label>UOM</label><input name="uom" value="Nos."></div><div class="form-group"><label>Required quantity</label><input name="requiredQty" type="number" min="0" step="any" value="0"></div><div class="form-group"><label>Available quantity</label><input name="availableQty" type="number" min="0" step="any" value="0"></div><div class="form-group"><label>Severity</label><select name="severity"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div></div><div class="form-group"><label>Remarks</label><textarea name="remarks"></textarea></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-shortage">Report Shortage</button>`);const fill=()=>{const pid=document.getElementById('shortage-project').value;document.getElementById('shortage-item').innerHTML='<option value="">Project level</option>'+visibleItems().filter(i=>i.projectId===pid).map(i=>`<option value="${i.id}">${esc(i.itemName)}</option>`).join('');};fill();document.getElementById('shortage-project').onchange=fill;document.getElementById('save-shortage').onclick=async event=>{const f=document.getElementById('shortage-form');if(!f.reportValidity())return;const fd=new FormData(f),req=number(fd.get('requiredQty')),avail=number(fd.get('availableQty'));const shortage={id:uid('SHR'),projectId:String(fd.get('projectId')),itemId:String(fd.get('itemId')||''),material:String(fd.get('material')).trim(),requiredQty:req,availableQty:avail,shortageQty:Math.max(0,req-avail),uom:String(fd.get('uom')||''),severity:String(fd.get('severity')),status:'Open',remarks:String(fd.get('remarks')||''),reportedBy:getCurrentUser().id,createdAt:nowISO()};await withOperationalMutationLock(`shortage-create:${shortage.id}`,event.currentTarget,async()=>{setFormBusy(f,true);try{state.shortages.push(shortage);const project=projectById(shortage.projectId);if(project?.managerId)notify(project.managerId,'Material shortage reported',`${shortage.material}: shortage of ${shortage.shortageQty} ${shortage.uom}`,'Delay',shortage.itemId||shortage.id);audit('CREATE','Shortages',`Reported shortage for ${shortage.material}`,shortage.id);await saveState();closeModal();renderShortages();toast('Shortage reported');}catch(error){toast('Shortage report failed',error.message,'error');}finally{setFormBusy(f,false);}});};}

  function ensureImportInput() {
    let input = document.getElementById('excel-file-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'excel-file-input';
      input.className = 'hidden';
      document.body.appendChild(input);
    }
    input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    return input;
  }

  function renderImport() {
    setPageTitle('Excel Import','Validate and import MASTER SHEET records');
    const page=document.getElementById('page-content');
    page.innerHTML=`${pageToolbar('Excel Bulk Upload','Validate the official template and save every valid record to the shared Supabase database.',`<a class="btn btn-secondary" href="ERP_Bulk_Upload_Template.xlsx" download>⇩ Download Excel Template</a>${can('ADMIN')?'<button class="btn btn-danger" id="delete-uploaded-data">Delete Uploaded Data</button>':''}`)}
      <div class="info-banner"><div>☁</div><div><strong>Shared database import</strong><p>The Excel workbook is read and validated in your browser. Valid records are then saved securely to Supabase and become available to all authorised users and devices.</p></div></div>
      <div class="import-steps"><div class="import-step active">1. Select File</div><div class="import-step">2. Read Data</div><div class="import-step">3. Validate</div><div class="import-step">4. Save to Database</div></div>
      <section class="card"><div class="card-body"><div class="import-drop" id="import-drop"><div class="drop-icon">⇧</div><h3>Drop the official ERP Excel template here</h3><p>Accepted formats: XLSX or XLS • Required sheet: MASTER SHEET</p><button class="btn btn-primary" id="choose-import-file">Choose Excel File</button></div><div id="import-results" style="margin-top:18px"></div></div></section>`;
    if(document.getElementById('delete-uploaded-data'))document.getElementById('delete-uploaded-data').onclick=deleteUploadedData;
    const input=ensureImportInput();
    input.value='';
    document.getElementById('choose-import-file').onclick=()=>{input.value='';input.click();};
    input.onchange=()=>{if(input.files?.[0])processImportFile(input.files[0]);};
    const drop=document.getElementById('import-drop');
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));
    ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));
    drop.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0];if(f)processImportFile(f);});
  }

  function isSupportedExcelFile(file) {
    const name=String(file?.name||'').toLowerCase();
    return name.endsWith('.xlsx')||name.endsWith('.xls');
  }

  function rowContainsTemplateData(row) {
    return TEMPLATE_HEADERS.some(header=>String(getCol(row,header)??'').trim()!=='');
  }

  async function processImportFile(file) {
    if(!requireRole('ADMIN','MANAGER'))return;
    const result=document.getElementById('import-results');
    result.innerHTML='<div class="empty-state"><div class="empty-icon">◷</div><h3>Reading Excel file...</h3><p>Please wait while the workbook is parsed and checked.</p></div>';
    importBuffer=null;
    try {
      if(!file||!file.size)throw new Error('The selected file is empty. Choose the completed ERP Excel template.');
      if(!isSupportedExcelFile(file))throw new Error('Invalid file format. Upload the official ERP template in XLSX or XLS format.');
      if(file.size>25*1024*1024)throw new Error('The Excel file is larger than 25 MB. Split the file into smaller official-template workbooks and upload them separately.');
      if(typeof XLSX==='undefined')throw new Error('The Excel reader did not load. Refresh the page and try again.');

      const data=await file.arrayBuffer();
      let wb;
      try { wb=XLSX.read(data,{type:'array',cellDates:false,cellNF:false,cellText:false}); }
      catch { throw new Error('The workbook is corrupted or is not a valid Excel file. Download a fresh ERP template and copy your data into it.'); }

      const sheetName=wb.SheetNames.find(n=>cleanKey(n)==='MASTER SHEET');
      if(!sheetName)throw new Error('Required worksheet "MASTER SHEET" was not found. Use the official ERP Excel template without renaming the sheet.');
      const sheet=wb.Sheets[sheetName];
      if(!sheet||!sheet['!ref'])throw new Error('The MASTER SHEET worksheet is empty.');

      const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:false});
      const headers=(matrix[0]||[]).map(x=>String(x??''));
      const duplicateHeaders=findDuplicateHeaders(headers);
      if(duplicateHeaders.length)throw new Error(`Duplicate column header(s): ${duplicateHeaders.join(', ')}. Use each official template header only once.`);
      const missing=validateTemplateHeaders(headers);
      if(missing.length)throw new Error(`Required column(s) missing: ${missing.join(', ')}. Download and use the ERP Excel template without changing its headers.`);

      const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true,blankrows:false}).filter(rowContainsTemplateData);
      if(!rows.length)throw new Error('The file contains the correct headers but no data rows. Add records below the header row and upload it again.');

      const parsed=validateImportRows(rows);
      importBuffer={fileName:file.name,fileSize:file.size,rawRows:rows,databaseFailures:[],...parsed};
      renderImportPreview();
    } catch(e){
      result.innerHTML=`<div class="info-banner danger"><div>!</div><div><strong>Unable to validate file</strong><p>${esc(e.message)}</p></div></div>`;
    }
  }

  function cleanKey(k){return String(k??'').replace(/^\uFEFF/,'').trim().toUpperCase().replace(/[\r\n]+/g,' ').replace(/\s+/g,' ');}
  function validateTemplateHeaders(headers){const available=new Set(headers.map(cleanKey).filter(Boolean));return TEMPLATE_HEADERS.filter(h=>!available.has(cleanKey(h)));}
  function findDuplicateHeaders(headers){const seen=new Set(),duplicates=new Set();headers.map(cleanKey).filter(Boolean).forEach(h=>{if(seen.has(h))duplicates.add(h);seen.add(h);});return[...duplicates];}
  function getCol(row,...names){const map={};Object.entries(row||{}).forEach(([k,v])=>map[cleanKey(k)]=v);for(const n of names){if(map[cleanKey(n)]!==undefined)return map[cleanKey(n)];}return '';}
  function canonicalSectionValue(value){return canonicalSection(value);}
  function canonicalStage(value){const s=String(value||'').trim().toUpperCase().replace(/\s*-\s*/g,' - ').replace(/\s+/g,' ');const compact=s.replace(/[\s-]/g,'');const found=STAGES.find(x=>x.replace(/[\s-]/g,'')===compact);if(found)return found;const legacy=LEGACY_STAGES.find(x=>x.replace(/[\s-]/g,'')===compact);return legacy?(LEGACY_STAGE_FALLBACKS[legacy]||legacy):'';}
  function blankOptionalExcelValue(value){const text=String(value??'').trim();return value==null||text===''||/^0(?:\.0+)?$/.test(text);}
  function excelDate(value){
    if(blankOptionalExcelValue(value))return'';
    if(value instanceof Date&&!Number.isNaN(value.getTime()))return`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
    if(typeof value==='number'){
      const d=new Date(Math.round((value-25569)*86400*1000));
      return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
    }
    const s=String(value).trim();
    const dmy=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(dmy){const d=new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}T00:00:00`);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
    const iso=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if(iso){const d=new Date(`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}T00:00:00`);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
    const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
  }
  function extractQty(name){const matches=[...String(name||'').matchAll(/(\d+(?:\.\d+)?)\s*(?:NOS?\.?|PCS?\.?|PIECES?)/gi)];return matches.length?number(matches[matches.length-1][1]):0;}
  function extractSize(name){const m=String(name||'').match(/(?:W(?:IDTH)?\s*)?(\d+(?:\.\d+)?)\s*MM\s*[X×]\s*(?:H(?:EIGHT)?\s*)?(\d+(?:\.\d+)?)\s*MM/i);return m?`${m[1]} x ${m[2]} mm`:'';}
  function parseQuantityCell(value){
    const text=String(value??'').trim();
    if(text===''||/^0(?:\.0+)?$/.test(text))return{kind:'missing',value:0};
    const normalized=text.replace(/,/g,'');
    if(!/^\d+(?:\.\d+)?$/.test(normalized))return{kind:'invalid',value:0};
    const parsed=Number(normalized);
    return Number.isFinite(parsed)&&parsed>0?{kind:'valid',value:parsed}:{kind:'missing',value:0};
  }
  function importDuplicateKey(projectName,itemName,section,site,bomNumber,jobNumber,stage,quantity){return[projectName,itemName,section,site,bomNumber,jobNumber,stage,quantity].map(x=>String(x??'').trim().toLowerCase()).join('|');}

  function validateImportRows(rows){
    const valid=[],failed=[],warnings=[],seen=new Set();
    rows.forEach((r,index)=>{
      const itemName=String(getCol(r,'ITEM NAME')).trim();
      const projectName=String(getCol(r,'PROJECT NAME')).trim();
      const sectionRaw=getCol(r,'SECTION');
      const section=canonicalSectionValue(sectionRaw);
      const statusRaw=getCol(r,'STATUS');
      const stage=canonicalStage(statusRaw);
      const qtyCell=getCol(r,'QTY');
      const qtyInfo=parseQuantityCell(qtyCell);
      const suggested=extractQty(itemName);
      let qty=0,quantitySource='Missing',quantityVerified=false;
      const rowWarnings=[];
      if(qtyInfo.kind==='valid'){
        qty=qtyInfo.value;quantitySource='Excel Column';quantityVerified=true;
      }else if(qtyInfo.kind==='missing'&&suggested>0){
        qty=suggested;quantitySource='ITEM NAME';
        rowWarnings.push(`${String(qtyCell??'').trim()===''?'QTY was blank':'QTY was 0'}; quantity ${suggested} was extracted from ITEM NAME and should be verified`);
      }

      const dateFields=[['BOM ISSUE DATE','bomIssueDate'],['DRAWING ISSUE DATE','drawingIssueDate'],['INDENT ISSUE DATE','indentIssueDate'],['TENT DEL DATE','targetDate']];
      const dates={},dateErrors=[];
      dateFields.forEach(([header,key])=>{const raw=getCol(r,header);dates[key]=excelDate(raw);if(!blankOptionalExcelValue(raw)&&!dates[key])dateErrors.push(`${header} has an invalid date`);});
      const rawSize=getCol(r,'SIZE');
      const rec={
        sourceRow:index+2,projectName,itemName,section,sectionRaw:String(sectionRaw||'').trim(),site:String(getCol(r,'SITE DETAILS')).trim(),
        size:blankOptionalExcelValue(rawSize)?extractSize(itemName):String(rawSize).trim(),
        bomPath:String(getCol(r,'BOM')).trim(),quantity:qty,quantitySource,quantityVerified,
        bomNumber:String(getCol(r,'BOM NUMBER')).trim(),jobNumber:String(getCol(r,'JOB NO')).trim(),
        ...dates,indentNumber:String(getCol(r,'INDENT NO')).trim(),shortages:String(getCol(r,'SHORTAGES')).trim(),
        stage,statusRaw:String(statusRaw||'').trim(),raw:r,errors:[],warnings:rowWarnings
      };
      if(!projectName)rec.errors.push('PROJECT NAME is required');
      if(!itemName)rec.errors.push('ITEM NAME is required');
      if(!section)rec.errors.push(`SECTION is invalid: ${rec.sectionRaw||'blank'}. Allowed values: ${SECTIONS.join(', ')}`);
      if(!stage)rec.errors.push(`STATUS is invalid: ${rec.statusRaw||'blank'}`);
      if(qtyInfo.kind==='invalid')rec.errors.push('QTY must contain only a number greater than zero');
      if(!qty)rec.errors.push('QTY is required. Enter a number greater than zero or include a quantity such as 10 NOS in ITEM NAME');
      rec.errors.push(...dateErrors);

      const key=importDuplicateKey(projectName,itemName,rec.section,rec.site,rec.bomNumber,rec.jobNumber,stage,qty);
      if(seen.has(key))rec.errors.push('Exact duplicate row exists in this file');
      seen.add(key);
      const existing=state.items.some(i=>importDuplicateKey(projectById(i.projectId)?.name,i.itemName,itemSection(i),i.site,i.bomNumber,i.jobNumber,STAGES[i.currentStage],i.quantity)===key);
      if(existing)rec.errors.push('Exact duplicate record already exists in the ERP database');
      if(rec.errors.length)failed.push(rec);else{valid.push(rec);if(rec.warnings.length)warnings.push(rec);}
    });
    return{total:rows.length,valid,failed,warnings};
  }

  function renderImportPreview(){
    const r=importBuffer,result=document.getElementById('import-results');
    document.querySelectorAll('.import-step').forEach((x,i)=>{x.classList.toggle('done',i<2);x.classList.toggle('active',i===2);});
    result.innerHTML=`<div class="validation-summary"><div class="validation-box"><strong>${r.total}</strong><span>Total Rows</span></div><div class="validation-box"><strong class="text-success">${r.valid.length}</strong><span>Valid Rows</span></div><div class="validation-box"><strong class="text-warning">${r.warnings.length}</strong><span>Warnings</span></div><div class="validation-box"><strong class="text-danger">${r.failed.length}</strong><span>Failed Rows</span></div><div class="validation-box"><strong>${new Set(r.valid.map(x=>x.projectName)).size}</strong><span>Projects</span></div></div>
      ${r.failed.length?`<div class="info-banner danger"><div>!</div><div><strong>${r.failed.length} row(s) will not be imported</strong><p>Correct the errors shown below or continue to import only the valid rows.</p></div></div>`:''}
      ${r.warnings.length?`<div class="info-banner warning"><div>⚠</div><div><strong>${r.warnings.length} quantity warning(s)</strong><p>Where QTY was blank or zero, the ERP extracted a quantity such as “10 NOS” from ITEM NAME. Review these rows before importing.</p></div></div>`:''}
      <div class="table-wrap"><table><thead><tr><th>Row</th><th>Project</th><th>Item</th><th>Section</th><th>Qty</th><th>BOM / Job</th><th>Stage</th><th>Validation</th></tr></thead><tbody>${[...r.valid.slice(0,80),...r.failed.slice(0,40)].map(x=>`<tr><td>${x.sourceRow}</td><td>${esc(x.projectName||'—')}</td><td>${esc(x.itemName||'—')}<div class="small muted">${esc(x.site)}</div></td><td>${esc(x.section||'—')}</td><td>${fmtNumber(x.quantity)}<div class="small muted">${esc(x.quantitySource)}</div></td><td>${esc(x.bomNumber||'—')}<div class="small muted">${esc(x.jobNumber||'—')}</div></td><td>${esc(x.stage||x.statusRaw||'—')}</td><td>${x.errors.length?`<span class="text-danger small">${esc(x.errors.join('; '))}</span>`:x.warnings.length?`<span class="text-warning small">${esc(x.warnings.join('; '))}</span>`:'<span class="text-success small">Valid</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="modal-footer" style="position:static;padding:16px 0 0"><button class="btn btn-secondary" id="download-error-report">Download Validation CSV</button><button class="btn btn-primary" id="confirm-import" ${r.valid.length?'':'disabled'}>Save ${r.valid.length} Valid Rows to Database</button></div>`;
    document.getElementById('confirm-import').onclick=confirmImport;
    document.getElementById('download-error-report').onclick=downloadErrorReport;
  }

  function findImportProject(projects,row){
    const name=row.projectName.trim().toLowerCase(),job=row.jobNumber.trim().toLowerCase();
    return projects.find(x=>String(x.name||'').trim().toLowerCase()===name&&(job?String(x.jobNumber||'').trim().toLowerCase()===job:true));
  }

  function buildImportPlan(validRows){
    const user=getCurrentUser(),workingProjects=[...state.projects],newProjects=[],items=[],shortages=[],rowBundles=[];
    validRows.forEach(r=>{
      let p=findImportProject(workingProjects,r);
      if(!p){
        p={id:uid('PRJ'),code:`PRJ-${String(workingProjects.length+1).padStart(4,'0')}`,name:r.projectName,client:'',site:r.site,jobNumber:r.jobNumber,status:'Active',startDate:r.bomIssueDate||todayISO(),targetDate:r.targetDate||'',managerId:user.role==='MANAGER'?user.id:'',executiveIds:[],priority:'Medium',createdAt:nowISO()};
        workingProjects.push(p);newProjects.push(p);
      }
      const idx=STAGES.indexOf(r.stage),item={id:uid('ITM'),projectId:p.id,itemName:r.itemName,rawItemName:r.itemName,section:r.section,assignedExecutiveId:'',assignedBy:'',assignedAt:'',site:r.site,size:r.size,quantity:r.quantity,quantitySource:r.quantitySource,quantityVerified:r.quantityVerified,bomPath:r.bomPath,bomNumber:r.bomNumber,jobNumber:r.jobNumber,bomIssueDate:r.bomIssueDate,drawingIssueDate:r.drawingIssueDate,indentNumber:r.indentNumber,indentIssueDate:r.indentIssueDate,targetDate:r.targetDate,currentStage:idx,currentStageName:r.stage,status:r.shortages?'Delayed':'In Progress',approvalStatus:'',shortages:r.shortages,remarks:'',createdAt:nowISO(),updatedAt:nowISO(),history:[{id:uid('HIS'),stageIndex:idx,stageName:r.stage,action:'Excel Initial Import',status:'Imported',updatedBy:user.id,updatedByName:user.name,date:nowISO(),remarks:`Imported from ${importBuffer.fileName}, source row ${r.sourceRow}. Previous stage history was not available in the workbook.`,attachments:[]}]};
      items.push(item);
      let shortage=null;
      if(r.shortages){shortage={id:uid('SHR'),projectId:p.id,itemId:item.id,material:'Imported shortage',requiredQty:0,availableQty:0,shortageQty:0,uom:'',severity:'High',status:'Open',remarks:r.shortages,reportedBy:user.id,createdAt:nowISO()};shortages.push(shortage);}
      rowBundles.push({sourceRow:r.sourceRow,project:p,item,shortage,source:r});
    });
    const records=[
      ...newProjects.map(project=>({entityType:'projects',recordId:project.id,payload:project,sourceRow:0})),
      ...rowBundles.map(bundle=>({entityType:'items',recordId:bundle.item.id,payload:bundle.item,sourceRow:bundle.sourceRow})),
      ...shortages.map(shortage=>({entityType:'shortages',recordId:shortage.id,payload:shortage,sourceRow:rowBundles.find(x=>x.shortage?.id===shortage.id)?.sourceRow||0}))
    ];
    return{newProjects,items,shortages,rowBundles,records};
  }

  function importFailureRecord(bundle,message){return{...bundle.source,errors:[message],warnings:[],databaseFailure:true};}

  async function confirmImport(){
    if(!requireRole('ADMIN','MANAGER')||!importBuffer?.valid?.length)return;
    const button=document.getElementById('confirm-import'),originalText=button?.textContent||'Import';
    if(button){button.disabled=true;button.textContent='Saving to shared database...';button.setAttribute('aria-busy','true');}
    bulkImportInFlight=true;
    try{
      await flushOperationalSync();
      await loadOperationalData();
      const refreshedValidation=validateImportRows(importBuffer.rawRows);
      importBuffer={...importBuffer,...refreshedValidation,databaseFailures:[]};
      if(!refreshedValidation.valid.length){renderImportPreview();throw new Error('No valid rows remain after checking the latest shared database. Review the validation errors.');}

      const plan=buildImportPlan(refreshedValidation.valid);
      const response=await callDataApi('bulk-import',{fileName:importBuffer.fileName,records:plan.records});
      await loadOperationalData();

      const failureById=new Map((response.failures||[]).map(f=>[`${f.entityType}:${f.recordId}`,f.error||'Database insertion failed.']));
      const importedBundles=[],databaseFailures=[];
      plan.rowBundles.forEach(bundle=>{
        const exists=state.items.some(item=>item.id===bundle.item.id);
        if(exists)importedBundles.push(bundle);
        else databaseFailures.push(importFailureRecord(bundle,failureById.get(`items:${bundle.item.id}`)||'The database did not confirm this record after import.'));
      });
      importBuffer.databaseFailures=databaseFailures;

      if(importedBundles.length){
        const user=getCurrentUser();
        const auditRecord={id:uid('AUD'),action:'IMPORT',module:'Import',details:`Imported ${importedBundles.length} production rows from ${importBuffer.fileName}; ${refreshedValidation.failed.length+databaseFailures.length} row(s) failed`,entityId:'',userId:user?.id||'SYSTEM',userName:user?.name||'System',createdAt:nowISO()};
        state.audit.unshift(auditRecord);
        await saveState();
      }

      const importedProjectIds=new Set(importedBundles.map(x=>x.project.id));
      const newProjectCount=plan.newProjects.filter(project=>importedProjectIds.has(project.id)&&state.projects.some(p=>p.id===project.id)).length;
      renderImportCompletion({imported:importedBundles.length,newProjects:newProjectCount,validationFailed:refreshedValidation.failed,databaseFailed:databaseFailures});
      if(importedBundles.length)toast('Bulk upload completed',`${importedBundles.length} record(s) saved to the shared database.`);
      else toast('Bulk upload failed','No production rows were saved. Review the database errors.','error');
    }catch(error){
      try{await loadOperationalData();}catch{}
      const result=document.getElementById('import-results');
      if(result&&!result.querySelector('.import-completion'))result.insertAdjacentHTML('afterbegin',`<div class="info-banner danger"><div>!</div><div><strong>Bulk upload failed</strong><p>${esc(error.message)}</p></div></div>`);
      toast('Bulk upload failed',error.message,'error');
    }finally{
      bulkImportInFlight=false;
      if(button&&document.body.contains(button)){button.disabled=false;button.textContent=originalText;button.removeAttribute('aria-busy');}
      drainRealtimePayloads();
      if(remoteReloadPending){remoteReloadPending=false;scheduleOperationalReload();}
    }
  }

  function renderImportCompletion({imported,newProjects,validationFailed,databaseFailed}){
    const result=document.getElementById('import-results'),allFailed=[...validationFailed,...databaseFailed];
    document.querySelectorAll('.import-step').forEach(x=>{x.classList.add('done');x.classList.remove('active');});
    result.innerHTML=`<div class="import-completion"><div class="validation-summary"><div class="validation-box"><strong class="text-success">${imported}</strong><span>Imported</span></div><div class="validation-box"><strong>${newProjects}</strong><span>New Projects</span></div><div class="validation-box"><strong class="text-danger">${allFailed.length}</strong><span>Failed Rows</span></div><div class="validation-box"><strong>${importBuffer.total}</strong><span>Total Rows</span></div></div>
      <div class="info-banner ${imported?'':'danger'}"><div>${imported?'✓':'!'}</div><div><strong>${imported?'Database import completed':'No rows were imported'}</strong><p>${imported} valid production record(s) are now stored in Supabase and visible to authorised users. ${allFailed.length?`${allFailed.length} row(s) were not imported; review the reasons below.`:'No rows failed.'}</p></div></div>
      ${allFailed.length?`<div class="table-wrap"><table><thead><tr><th>Row</th><th>Project</th><th>Item</th><th>Failure Reason</th></tr></thead><tbody>${allFailed.slice(0,200).map(r=>`<tr><td>${r.sourceRow||'—'}</td><td>${esc(r.projectName||'—')}</td><td>${esc(r.itemName||'—')}</td><td><span class="text-danger small">${esc((r.errors||[]).join('; ')||'Import failed')}</span></td></tr>`).join('')}</tbody></table></div>`:''}
      <div class="modal-footer" style="position:static;padding:16px 0 0">${allFailed.length?'<button class="btn btn-secondary" id="download-error-report">Download Failure CSV</button>':''}${imported&&can('ADMIN','MANAGER')?'<button class="btn btn-secondary" id="assign-after-import">Assign Section Work</button>':''}<button class="btn btn-primary" id="open-production-after-import">Open Production Tracker</button></div></div>`;
    if(document.getElementById('assign-after-import'))document.getElementById('assign-after-import').onclick=()=>openSectionAssignmentModal();
    document.getElementById('open-production-after-import').onclick=()=>{currentRoute='production';renderAppShell();};
    if(document.getElementById('download-error-report'))document.getElementById('download-error-report').onclick=downloadErrorReport;
  }

  async function deleteUploadedData(){
    if(!requireRole('ADMIN'))return;
    if(!confirm('Delete all uploaded projects, production items, shortages, issues and operational notifications? User accounts and settings will remain.'))return;
    if(!confirm('Final confirmation: permanently delete all uploaded operational data?'))return;
    await withOperationalMutationLock('delete-all-operational-data',document.getElementById('delete-uploaded-data'),async()=>{
      const counts={projects:state.projects.length,items:state.items.length};
      state.projects=[];state.items=[];state.shortages=[];state.issues=[];state.notifications=[];importBuffer=null;
      audit('DELETE','Import',`Deleted all uploaded data (${counts.projects} projects and ${counts.items} items)`);
      try{await saveState();renderImport();toast('Uploaded data deleted','The ERP is ready for a fresh template upload.');}
      catch(error){renderImport();toast('Delete failed',error.message,'error');}
    });
  }
  function downloadErrorReport(){const rows=[...(importBuffer?.failed||[]),...(importBuffer?.warnings||[]),...(importBuffer?.databaseFailures||[])];const csv=['Source Row,Project,Item,Section,Stage,Errors,Warnings',...rows.map(r=>[r.sourceRow,r.projectName,r.itemName,r.sectionRaw||r.section,r.statusRaw,r.errors?.join('; ')||'',r.warnings?.join('; ')||''].map(csvCell).join(','))].join('\n');downloadBlob('\uFEFF'+csv,'procurement-erp-import-results.csv','text/csv;charset=utf-8');}
  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadBlob(content,name,type){const b=new Blob([content],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  function renderReports() {
    setPageTitle('Reports','Operational reporting and exports');
    const page=document.getElementById('page-content');page.innerHTML=`${pageToolbar('Reports Centre','Generate project, stage, delay and shortage reports.','<button class="btn btn-secondary" id="print-report">Print / Save PDF</button><button class="btn btn-primary" id="export-report">⇩ Export CSV</button>')}
      <div class="filter-bar"><div class="filter-item"><select id="report-type"><option value="production">Production Items</option><option value="projects">Project Summary</option><option value="stage">Stage Summary</option><option value="delay">Delay Report</option><option value="shortage">Shortage Report</option></select></div><div class="filter-item"><select id="report-project"><option value="">All projects</option>${assignedProjects().map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join('')}</select></div><div class="filter-item"><select id="report-section"><option value="">All sections</option>${SECTIONS.map(section=>`<option>${section}</option>`).join('')}</select></div><div class="filter-item"><input id="report-from" type="date"></div><div class="filter-item"><input id="report-to" type="date"></div><button class="btn btn-secondary" id="run-report">Run Report</button></div><section class="card table-card"><div class="card-header"><div><h3 id="report-title">Production Items Report</h3><p id="report-subtitle">Generated ${fmtDate(nowISO(),true)}</p></div></div><div class="table-wrap" id="report-table"></div></section>`;
    const run=()=>renderReportTable();document.getElementById('run-report').onclick=run;document.getElementById('report-type').onchange=run;document.getElementById('report-section').onchange=run;run();document.getElementById('print-report').onclick=()=>window.print();document.getElementById('export-report').onclick=exportCurrentReport;
  }
  function getReportData(){const type=document.getElementById('report-type').value,pid=document.getElementById('report-project').value,section=document.getElementById('report-section').value,allowed=new Set(assignedProjects().map(project=>project.id));const filterItem=item=>(!pid||item.projectId===pid)&&(!section||itemSection(item)===section);if(type==='projects')return{title:'Project Summary Report',headers:['Project Code','Project Name','Sections','Client','Site','Job Number','Manager','Target Date','Completion %','Status'],rows:assignedProjects().filter(project=>(!pid||project.id===pid)&&(!section||projectSections(project.id).includes(section))).map(project=>[project.code,project.name,projectSections(project.id).join(', '),project.client,project.site,project.jobNumber,userById(project.managerId)?.name||'',project.targetDate,projectCompletion(project.id),project.status])};if(type==='stage')return{title:'Stage-wise Production Report',headers:['Section','Stage','Item Count','Total Quantity','Delayed Items'],rows:(section?[section]:SECTIONS).flatMap(sectionName=>STAGES.map((stageName,index)=>{const rows=visibleItems().filter(item=>filterItem(item)&&itemSection(item)===sectionName&&item.currentStage===index);return[sectionName,stageName,rows.length,rows.reduce((total,item)=>total+number(item.quantity),0),rows.filter(item=>item.status==='Delayed').length]}))};if(type==='delay'){const items=visibleItems().filter(item=>filterItem(item)&&(item.status==='Delayed'||projectById(item.projectId)?.status==='Delayed'));return{title:'Production Delay Report',headers:['Project','Item','Section','Assigned To','BOM','Current Stage','Quantity','Shortage / Reason','Updated'],rows:items.map(item=>[projectById(item.projectId)?.name,item.itemName,itemSection(item),assignedExecutiveName(item),item.bomNumber,STAGES[item.currentStage],item.quantity,item.shortages||item.remarks||'Delayed',item.updatedAt])};}if(type==='shortage'){const rows=visibleShortages().filter(shortage=>(!pid||shortage.projectId===pid)&&(!section||itemSection(itemById(shortage.itemId))===section));return{title:'Material Shortage Report',headers:['Project','Item','Section','Assigned To','Material','Required','Available','Shortage','UOM','Severity','Status','Remarks'],rows:rows.map(shortage=>{const item=itemById(shortage.itemId);return[projectById(shortage.projectId)?.name,item?.itemName||'',itemSection(item),assignedExecutiveName(item),shortage.material,shortage.requiredQty,shortage.availableQty,shortage.shortageQty,shortage.uom,shortage.severity,shortage.status,shortage.remarks]})};}const items=visibleItems().filter(filterItem);return{title:'Production Items Report',headers:['Project','Item','Section','Assigned To','Site','BOM Number','Job Number','Quantity','Current Stage','Task Status','Due Date','Priority','Progress %','Status','Updated'],rows:items.map(item=>[projectById(item.projectId)?.name,item.itemName,itemSection(item),assignedExecutiveName(item),item.site,item.bomNumber,item.jobNumber,item.quantity,STAGES[item.currentStage],itemTaskState(item),itemDueDate(item),itemPriority(item),completionPercent(item),item.approvalStatus==='SUBMITTED'?'Submitted':item.status,item.updatedAt])};}
  function renderReportTable(){const d=getReportData();document.getElementById('report-title').textContent=d.title;document.getElementById('report-table').innerHTML=d.rows.length?`<table><thead><tr>${d.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v??'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`:emptyState('▤','No report data','Adjust filters or import records first.');}
  async function exportCurrentReport(){const d=getReportData(),csv=[d.headers.map(csvCell).join(','),...d.rows.map(r=>r.map(csvCell).join(','))].join('\n');const appSlug=BRAND.erpName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const reportSlug=d.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');downloadBlob('\uFEFF'+csv,`${appSlug}-${reportSlug}.csv`,'text/csv;charset=utf-8');audit('EXPORT','Reports',`Exported ${d.title}`);try{await saveState();toast('Report exported');}catch(error){toast('Report exported','The file was downloaded, but its audit entry could not be saved.','warning');}}

  function sectionExecutiveOptions(project, selectedId = '') {
    const current=getCurrentUser();
    const executives=current?.role==='MANAGER'?manageableExecutives(current.id):state.users.filter(user=>user.role==='EXECUTIVE'&&user.status==='Active');
    return `<option value="">Unassigned</option>${executives.map(user=>`<option value="${user.id}" ${user.id===selectedId?'selected':''}>${esc(user.name)} (${esc(user.email)})</option>`).join('')}`;
  }

  function currentSectionAssignee(projectId, section) {
    const counts=new Map();
    state.items.filter(item=>item.projectId===projectId&&itemSection(item)===section&&item.assignedExecutiveId).forEach(item=>counts.set(item.assignedExecutiveId,(counts.get(item.assignedExecutiveId)||0)+1));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  }

  function openSectionAssignmentModal(initialProjectId = '') {
    if(!requireRole('ADMIN','MANAGER'))return;
    const current=getCurrentUser();
    const projects=assignedProjects().filter(project=>current.role==='ADMIN'||project.managerId===current.id);
    if(!projects.length)return toast('No manageable project','Assign a Manager to a project before section-based work assignment.','warning');
    const selectedProjectId=projects.some(project=>project.id===initialProjectId)?initialProjectId:projects[0].id;
    const renderRows=projectId=>{const project=projectById(projectId);return SECTIONS.map(section=>`<tr><td><strong>${section}</strong></td><td>${state.items.filter(item=>item.projectId===projectId&&itemSection(item)===section).length}</td><td><select data-section-assignee="${section}">${sectionExecutiveOptions(project,currentSectionAssignee(projectId,section))}</select></td></tr>`).join('');};
    openModal('Assign Section Work',`<form id="section-assignment-form"><div class="form-group"><label>Project *</label><select id="section-assignment-project" required>${projects.map(project=>`<option value="${project.id}" ${project.id===selectedProjectId?'selected':''}>${esc(project.name)}</option>`).join('')}</select></div><div class="info-banner"><div>↦</div><div><strong>Assign imported work without editing item data</strong><p>Every item in the selected project and section will be assigned to the selected Executive.</p></div></div><div class="table-wrap"><table><thead><tr><th>Section</th><th>Items</th><th>Executive</th></tr></thead><tbody id="section-assignment-body">${renderRows(selectedProjectId)}</tbody></table></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-section-assignments">Save Assignments</button>`,'modal-lg');
    document.getElementById('section-assignment-project').onchange=event=>{document.getElementById('section-assignment-body').innerHTML=renderRows(event.target.value);};
    document.getElementById('save-section-assignments').onclick=async event=>{const form=document.getElementById('section-assignment-form');if(!form.reportValidity())return;const projectId=document.getElementById('section-assignment-project').value;const assignments=[...document.querySelectorAll('[data-section-assignee]')].map(select=>({section:select.dataset.sectionAssignee,executiveId:select.value}));await withOperationalMutationLock(`section-assignment:${projectId}`,event.currentTarget,async()=>{setFormBusy(form,true);try{const result=await callProjectLineItemsApi('assign-sections',{projectId,assignments});for(const record of result.productionRecords||[])applyConfirmedItemRecord(record);await loadOperationalData({renderAfter:false});closeModal();renderPage(currentRoute);toast('Section work assigned',`${result.updatedItems||0} production item(s) synchronized.`);}catch(error){toast('Assignment failed',error.message,'error');}finally{setFormBusy(form,false);}});};
  }

  function renderUsers() {
    if (!requireRole('ADMIN','MANAGER')) return;
    setPageTitle('User Management','Temporary passwords and role management');
    const current = getCurrentUser();
    const users = current.role === 'ADMIN'
      ? state.users
      : [current, ...state.users.filter(u => u.role === 'EXECUTIVE' && u.createdBy === current.id)];
    const uniqueUsers = [...new Map(users.map(u => [u.id, u])).values()];
    const page = document.getElementById('page-content');
    page.innerHTML = `${pageToolbar('User Management','Create accounts with temporary passwords. Users must change the password at first login.','<button class="btn btn-primary" id="add-user">+ Create User</button>')}
      <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Assigned Projects</th><th>Status</th><th>Password</th><th>Created</th><th>Action</th></tr></thead><tbody>${uniqueUsers.length ? uniqueUsers.map(u => {
        const manageable = canManageUser(u);
        const passwordState = u.mustChangePassword ? statusChip('Change Required') : statusChip('Password Set');
        const actions = u.role === 'ADMIN' || u.id === current.id
          ? '<span class="small muted">Protected account</span>'
          : manageable
            ? `<div class="table-actions"><button class="btn btn-secondary btn-sm" data-edit-user="${u.id}">Edit</button><button class="btn btn-secondary btn-sm" data-reset-user="${u.id}">Reset Password</button><button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Delete</button></div>`
            : '<span class="small muted">View only</span>';
        return `<tr><td><div class="input-row"><div class="avatar">${initials(u.name)}</div><div><strong>${esc(u.name)}</strong><div class="small muted">${esc(u.id)}</div></div></div></td><td>${esc(u.email)}</td><td><span class="role-chip">${esc(roleLabel(u.role))}</span></td><td>${state.projects.filter(p=>p.managerId===u.id||(p.executiveIds||[]).includes(u.id)).length}</td><td>${statusChip(u.status)}</td><td>${passwordState}</td><td>${fmtDate(u.createdAt)}</td><td>${actions}</td></tr>`;
      }).join('') : `<tr><td colspan="9">${emptyState('♙','No users available','Create a Manager or Executive to begin.')}</td></tr>`}</tbody></table></div></section>`;
    document.getElementById('add-user').onclick = () => openUserForm();
    document.querySelectorAll('[data-edit-user]').forEach(b => b.onclick = () => openUserForm(userById(b.dataset.editUser)));
    document.querySelectorAll('[data-reset-user]').forEach(b => b.onclick = () => openPasswordReset(userById(b.dataset.resetUser)));
    document.querySelectorAll('[data-delete-user]').forEach(b => b.onclick = () => deleteUser(b.dataset.deleteUser));
  }

  function passwordFields(prefix = 'Temporary') {
    return `<div class="form-group"><label>${prefix} Password *</label><div class="input-row"><input name="temporaryPassword" type="text" required minlength="10" autocomplete="new-password" placeholder="Generate or enter a strong password"><button type="button" class="btn btn-secondary" id="generate-temp-password">Generate</button></div></div><div class="form-group"><label>Confirm ${prefix} Password *</label><input name="confirmTemporaryPassword" type="text" required minlength="10" autocomplete="new-password" placeholder="Repeat the temporary password"></div><div class="password-rules">Use 10+ characters with uppercase, lowercase, number and special character. The user must replace it at first login.</div>`;
  }

  function bindPasswordGenerator(form) {
    const button = document.getElementById('generate-temp-password');
    if (!button) return;
    button.onclick = () => {
      const password = generateTemporaryPassword();
      form.elements.temporaryPassword.value = password;
      form.elements.confirmTemporaryPassword.value = password;
    };
  }

  function openUserForm(user = null) {
    if (!requireRole('ADMIN','MANAGER')) return;
    const current = getCurrentUser();
    if (user && !canManageUser(user)) return toast('Access denied','You cannot manage this user.','error');
    const roles = current.role === 'ADMIN' ? ['MANAGER','EXECUTIVE'] : ['EXECUTIVE'];
    openModal(user ? 'Edit User' : 'Create New User', `<form id="user-form"><div class="form-grid"><div class="form-group"><label>Full Name *</label><input name="name" required value="${esc(user?.name || '')}"></div><div class="form-group"><label>Email Address *</label><input name="email" type="email" required value="${esc(user?.email || '')}" ${user ? 'readonly' : ''}></div><div class="form-group"><label>Role *</label><select name="role">${roles.map(r => `<option value="${r}" ${user?.role === r ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select></div>${user ? `<div class="form-group"><label>Status</label><select name="status"><option value="ACTIVE" ${user.status === 'Active' ? 'selected' : ''}>Active</option><option value="INACTIVE" ${user.status === 'Inactive' ? 'selected' : ''}>Inactive</option><option value="INVITED" ${user.status === 'Invited' ? 'selected' : ''}>Invited</option></select></div>` : passwordFields()}</div>${user ? '' : '<div class="info-banner"><div>🔐</div><div><strong>Temporary password workflow</strong><p>Share the temporary password privately. The user will be forced to create a new password after the first successful login.</p></div></div>'}</form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-user">${user ? 'Save Changes' : 'Create User'}</button>`);
    const form = document.getElementById('user-form');
    if (!user) bindPasswordGenerator(form);
    document.getElementById('save-user').onclick = async () => {
      if (!form.reportValidity()) return;
      const fd = new FormData(form), fullName = String(fd.get('name')).trim(), email = String(fd.get('email')).trim().toLowerCase(), role = String(fd.get('role'));
      if (!roles.includes(role)) return toast('Invalid role','You cannot assign that role.','error');
      let temporaryPassword = '';
      if (!user) {
        temporaryPassword = String(fd.get('temporaryPassword') || '');
        const confirmPassword = String(fd.get('confirmTemporaryPassword') || '');
        if (temporaryPassword !== confirmPassword) return toast('Password mismatch','Both temporary password fields must match.','error');
        if (!strongPassword(temporaryPassword)) return toast('Weak temporary password','Use 10+ characters with uppercase, lowercase, number and special character.','error');
      }
      setFormBusy(form, true);
      try {
        if (user) {
          await callAuthAdmin('update', { userId: user.id, fullName, role, status: String(fd.get('status')) });
          audit('UPDATE','Users',`Updated ${roleLabel(role)} ${fullName}`,user.id);
          await syncProfiles(); await saveState(); closeModal(); renderUsers();
          toast('User updated','The user profile was updated.');
        } else {
          await callAuthAdmin('create', { fullName, email, role, temporaryPassword });
          audit('CREATE','Users',`Created ${roleLabel(role)} ${fullName} with a temporary password`);
          await syncProfiles(); await saveState(); closeModal(); renderUsers();
          showTemporaryCredentials(fullName, email, temporaryPassword, 'User created successfully');
        }
      } catch (error) { toast(user ? 'Update failed' : 'User creation failed', error.message, 'error'); }
      finally { setFormBusy(form, false); }
    };
  }

  function showTemporaryCredentials(fullName, email, temporaryPassword, title) {
    const credentials = `Profile Solutions Procurement ERP login\nEmail: ${email}\nTemporary password: ${temporaryPassword}\nThe password must be changed after first login.`;
    openModal(title, `<div class="info-banner"><div>✓</div><div><strong>${esc(fullName)}</strong><p>The account is active and ready for first login. Share these details privately.</p></div></div><div class="form-group"><label>Login Email</label><input value="${esc(email)}" readonly></div><div class="form-group"><label>Temporary Password</label><input value="${esc(temporaryPassword)}" readonly></div><div class="auth-note">This password is displayed here for handover. The ERP does not store it in browser data, and the user must replace it at first login.</div>`, `<button class="btn btn-secondary" data-close-modal>Close</button><button class="btn btn-primary" id="copy-temp-credentials">Copy Login Details</button>`);
    document.getElementById('copy-temp-credentials').onclick = async () => {
      try { await navigator.clipboard.writeText(credentials); toast('Copied','Login details copied to the clipboard.'); }
      catch { toast('Copy failed','Select and copy the details manually.','error'); }
    };
  }

  function openPasswordReset(user) {
    if (!user || !canManageUser(user)) return toast('Access denied','You cannot reset this user password.','error');
    openModal('Reset Temporary Password', `<form id="password-reset-form"><div class="info-banner"><div>🔑</div><div><strong>${esc(user.name)}</strong><p>Set a new temporary password. All existing sessions may be invalidated, and the user must change it at the next login.</p></div></div>${passwordFields('New Temporary')}</form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-reset-password">Reset Password</button>`);
    const form = document.getElementById('password-reset-form');
    bindPasswordGenerator(form);
    document.getElementById('save-reset-password').onclick = async () => {
      if (!form.reportValidity()) return;
      const fd = new FormData(form), temporaryPassword = String(fd.get('temporaryPassword') || ''), confirmPassword = String(fd.get('confirmTemporaryPassword') || '');
      if (temporaryPassword !== confirmPassword) return toast('Password mismatch','Both temporary password fields must match.','error');
      if (!strongPassword(temporaryPassword)) return toast('Weak temporary password','Use 10+ characters with uppercase, lowercase, number and special character.','error');
      setFormBusy(form, true);
      try {
        await callAuthAdmin('reset-password', { userId: user.id, temporaryPassword });
        audit('RESET PASSWORD','Users',`Issued a temporary password for ${user.name}`,user.id);
        await syncProfiles(); await saveState(); closeModal(); renderUsers();
        showTemporaryCredentials(user.name, user.email, temporaryPassword, 'Password reset completed');
      } catch (error) { toast('Password reset failed',error.message,'error'); }
      finally { setFormBusy(form, false); }
    };
  }

  async function deleteUser(id) {
    if (!requireRole('ADMIN','MANAGER')) return;
    const current = getCurrentUser(), target = userById(id); if (!target) return;
    if (!canManageUser(target)) return toast('Delete blocked','You cannot delete this account.','error');
    if (target.id === current.id) return toast('Delete blocked','You cannot delete your own signed-in account.','error');
    if (!confirm(`Delete user ${target.name}? This also removes their Supabase login.`)) return;
    try {
      await callAuthAdmin('delete', { userId: id });
      state.projects.forEach(p => { if (p.managerId === id) p.managerId = ''; p.executiveIds = (p.executiveIds || []).filter(x => x !== id); });
      state.notifications = state.notifications.filter(n => n.userId !== id);
      audit('DELETE','Users',`Deleted ${roleLabel(target.role)} ${target.name}`,id);
      await syncProfiles(); await saveState(); renderUsers(); toast('User deleted');
    } catch (error) { toast('Delete failed', error.message, 'error'); }
  }


  function renderAudit() {
    setPageTitle('Audit Logs','Traceability of user and data changes');
    const page=document.getElementById('page-content');page.innerHTML=`${pageToolbar('Audit Logs','Every important action performed in the ERP.','<button class="btn btn-secondary" id="export-audit">⇩ Export CSV</button>')}<div class="filter-bar"><div class="filter-item search-wide"><input id="audit-search" placeholder="Search user, action, module or details"></div><div class="filter-item"><select id="audit-module"><option value="">All modules</option>${[...new Set(state.audit.map(a=>a.module))].map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div><section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Date & Time</th><th>User</th><th>Action</th><th>Module</th><th>Details</th></tr></thead><tbody id="audit-body"></tbody></table></div></section>`;const draw=()=>{const q=document.getElementById('audit-search').value.toLowerCase(),m=document.getElementById('audit-module').value;const rows=state.audit.filter(a=>(!q||[a.userName,a.action,a.module,a.details].some(v=>String(v||'').toLowerCase().includes(q)))&&(!m||a.module===m));document.getElementById('audit-body').innerHTML=rows.length?rows.slice(0,500).map(a=>`<tr><td>${fmtDate(a.createdAt,true)}</td><td>${esc(a.userName)}</td><td><span class="role-chip">${esc(a.action)}</span></td><td>${esc(a.module)}</td><td>${esc(a.details)}</td></tr>`).join(''):`<tr><td colspan="5">${emptyState('◷','No audit records','Actions performed in the ERP will be tracked here.')}</td></tr>`;};draw();document.getElementById('audit-search').oninput=draw;document.getElementById('audit-module').onchange=draw;document.getElementById('export-audit').onclick=()=>{const csv=['Date,User,Action,Module,Details',...state.audit.map(a=>[a.createdAt,a.userName,a.action,a.module,a.details].map(csvCell).join(','))].join('\n');downloadBlob(csv,'procurement-erp-audit-log.csv','text/csv');};
  }

  function renderSettings() {
    setPageTitle('Settings & Backup','Configuration and operational data protection');
    const page=document.getElementById('page-content');page.innerHTML=`${pageToolbar('System Settings','Configure the ERP and manage operational data backups.')}
      <div class="info-banner"><div>🔐</div><div><strong>Authentication is secured by Supabase</strong><p>Passwords are securely hashed by Supabase Auth. Super Admins and authorised Managers create temporary passwords, and users must change them at first login. Projects, production records, shortages, issues, audit entries and notifications are stored in the shared Supabase database and synchronized across authorized users.</p></div></div>
      <div class="grid grid-2"><section class="card"><div class="card-header"><div><h3>Company Configuration</h3><p>Branding and display preferences</p></div></div><div class="card-body"><form id="settings-form"><div class="form-group"><label>Company / ERP Name</label><input name="companyName" value="${esc(state.settings.companyName)}"></div><div class="form-group"><label>Factory Name</label><input name="factoryName" value="${esc(state.settings.factoryName)}"></div><div class="setting-row"><div class="setting-copy"><strong>Dark Mode</strong><span>Use dark industrial interface</span></div><button type="button" class="toggle ${state.settings.theme==='dark'?'on':''}" id="settings-theme"></button></div><button class="btn btn-primary" type="submit" style="margin-top:16px">Save Settings</button></form></div></section>
      <section class="card"><div class="card-header"><div><h3>Backup & Restore</h3><p>Protect shared ERP records</p></div></div><div class="card-body"><div class="setting-row"><div class="setting-copy"><strong>Download Full Backup</strong><span>Projects, production history, shortages and settings</span></div><button class="btn btn-secondary" id="download-backup">⇩ Backup</button></div><div class="setting-row"><div class="setting-copy"><strong>Restore Backup</strong><span>Replace shared operational data from a JSON backup</span></div><button class="btn btn-secondary" id="restore-backup">⇧ Restore</button></div><div class="setting-row"><div class="setting-copy"><strong class="text-danger">Reset All Data</strong><span>Delete all shared ERP operational records</span></div><button class="btn btn-danger" id="reset-data">Reset</button></div></div></section></div>
      <section class="card" style="margin-top:18px"><div class="card-header"><div><h3>System Information</h3><p>Deployment characteristics</p></div></div><div class="card-body"><div class="grid grid-4">${miniMetric('Technology','HTML / CSS / JS')}${miniMetric('Authentication','Supabase Auth')}${miniMetric('Deployment','Netlify Functions')}${miniMetric('Version','11.1 Procurement Alignment')}</div></div></section>`;
    const settingsForm = document.getElementById('settings-form');
    settingsForm.onsubmit = async event => {
      event.preventDefault();
      const previousSettings = cloneJson(state.settings);
      const fd = new FormData(settingsForm);
      state.settings.companyName = String(fd.get('companyName') || BRAND.erpName);
      state.settings.factoryName = String(fd.get('factoryName') || BRAND.factory);
      audit('UPDATE', 'Settings', 'Updated company configuration');
      setFormBusy(settingsForm, true);
      try {
        await saveState();
        renderAppShell();
        toast('Settings saved');
      } catch (error) {
        state.settings = previousSettings;
        saveUiPreferences();
        renderAppShell();
        toast('Settings update failed', error.message, 'error');
      } finally {
        setFormBusy(settingsForm, false);
      }
    };
    document.getElementById('settings-theme').onclick = toggleTheme;
    document.getElementById('download-backup').onclick = () => downloadBlob(
      JSON.stringify(state, null, 2),
      `procurement-erp-backup-${todayISO()}.json`,
      'application/json',
    );
    document.getElementById('restore-backup').onclick = () => document.getElementById('backup-file-input').click();
    const backupInput = document.getElementById('backup-file-input');
    backupInput.value = '';
    backupInput.onchange = async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const control = document.getElementById('restore-backup');
      await withOperationalMutationLock('backup-restore', control, async () => {
        try {
          const data = JSON.parse(await file.text());
          if (!data || typeof data !== 'object' || !Array.isArray(data.projects) || !Array.isArray(data.items)) {
            throw new Error('Invalid backup format. Projects and production items are required.');
          }
          for (const name of BUSINESS_COLLECTIONS) {
            if (data[name] != null && !Array.isArray(data[name])) throw new Error(`Invalid backup collection: ${name}.`);
          }
          if (!confirm('Restore this backup and replace shared ERP data for every user?')) return;
          const existingUsers = state.users;
          const existingSettings = state.settings;
          state = {
            ...defaultState(),
            ...data,
            settings: { ...defaultState().settings, ...(data.settings || existingSettings) },
            users: existingUsers,
          };
          state.items = (state.items || []).map(row => normalizeProductionItemRecord(row, true));
          audit('RESTORE', 'Settings', `Restored ERP backup ${file.name}`);
          await saveState();
          render();
          toast('Backup restored', 'Shared operational data was restored. Supabase users were not changed.');
        } catch (error) {
          toast('Restore failed', error.message, 'error');
        } finally {
          backupInput.value = '';
        }
      });
    };
    document.getElementById('reset-data').onclick = async event => {
      if (!confirm('This permanently deletes shared ERP operational data for every user. Continue?')) return;
      if (!confirm('Final confirmation: delete everything?')) return;
      await withOperationalMutationLock('reset-all-data', event.currentTarget, async () => {
        const preservedSettings = state.settings;
        const preservedUsers = state.users;
        state = { ...defaultState(), settings: preservedSettings, users: preservedUsers };
        audit('RESET', 'Settings', 'Deleted all shared ERP operational data');
        try {
          await saveState();
          render();
          toast('Shared data reset', 'All operational records were deleted from the database.');
        } catch (error) {
          toast('Reset failed', error.message, 'error');
        }
      });
    };
  }

  function openModal(title, body, footer='', size='') {
    closeModal();const el=document.createElement('div');el.className='modal-backdrop';el.id='app-modal';el.innerHTML=`<div class="modal ${size}"><div class="modal-header"><h3>${esc(title)}</h3><button class="close-btn" data-close-modal>×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div>`;document.body.appendChild(el);el.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=closeModal);el.addEventListener('mousedown',e=>{if(e.target===el)closeModal();});
  }
  function closeModal(){clearTimeout(projectItemsModalReloadTimer);projectItemsModalReloadTimer=null;activeProjectItemsModalProjectId='';document.getElementById('app-modal')?.remove();}

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  window.addEventListener('resize',()=>{if(authSession&&currentRoute==='dashboard'){clearTimeout(window.__chartTimer);window.__chartTimer=setTimeout(()=>renderDashboard(),150);}});
  window.addEventListener('focus', () => {
    if (!authSession || !operationalDataReady) return;
    if (realtimeStatus !== 'SUBSCRIBED' || Date.now() - lastOperationalLoadAt > 30000) scheduleOperationalReload(0);
  });
  window.addEventListener('online', () => {
    if (!authSession || !operationalDataReady) return;
    subscribeOperationalRealtime(true);
    scheduleOperationalReload(0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !authSession || !operationalDataReady) return;
    if (realtimeStatus !== 'SUBSCRIBED' || Date.now() - lastOperationalLoadAt > 30000) scheduleOperationalReload(0);
  });

  initialiseAuthentication();
})();
