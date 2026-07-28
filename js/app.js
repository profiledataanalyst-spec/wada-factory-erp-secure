(() => {
  'use strict';

  const STORAGE_KEY = 'factoryERP_vanilla_v5_executive_stage';
  const LEGACY_STORAGE_KEYS = ['factoryERP_vanilla_v1', 'factoryERP_vanilla_v2', 'factoryERP_vanilla_v3_production', 'factoryERP_vanilla_v4_operations'];
  LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  const STAGES = [
    'PLANNING', 'MRN - STORES', 'CUTTING', 'FABRICATION', 'GRINDING',
    'PRE-COATING', 'POWDER COATING', 'ASSEMBLY', 'READY FOR DISPATCH'
  ];

  const TEMPLATE_HEADERS = [
    'PROJECT NAME', 'ITEM NAME', 'SITE DETAILS', 'SIZE', 'BOM', 'QTY',
    'BOM NUMBER', 'JOB NO', 'BOM ISSUE DATE', 'DRAWING ISSUE DATE',
    'INDENT NO', 'INDENT ISSUE DATE', 'TENT DEL DATE', 'SHORTAGES', 'STATUS'
  ];

  const ICONS = {
    dashboard: '▦', projects: '▣', production: '⚙', import: '⇧', reports: '▤',
    users: '♙', audit: '◷', settings: '⚒', shortage: '⚠', logout: '↪',
    search: '⌕', bell: '♢', menu: '☰', theme: '◐', plus: '+', edit: '✎',
    view: '◉', delete: '×', download: '⇩', upload: '⇧', check: '✓', clock: '◷',
    project: '▧', item: '◫', factory: '⌂', target: '◎', issue: '!', ready: '➜'
  };

  const NAV = [
    { id: 'dashboard', label: 'Factory Overview', icon: ICONS.dashboard, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Overview' },
    { id: 'projects', label: 'Projects', icon: ICONS.projects, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Operations' },
    { id: 'production', label: 'Production Tracker', icon: ICONS.production, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Operations' },
    { id: 'shortages', label: 'Shortages & Issues', icon: ICONS.shortage, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Operations' },
    { id: 'import', label: 'Excel Import', icon: ICONS.import, roles: ['ADMIN','MANAGER'], section: 'Data & Reports' },
    { id: 'reports', label: 'Reports', icon: ICONS.reports, roles: ['ADMIN','MANAGER','EXECUTIVE'], section: 'Data & Reports' },
    { id: 'users', label: 'User Management', icon: ICONS.users, roles: ['ADMIN'], section: 'Administration' },
    { id: 'audit', label: 'Audit Logs', icon: ICONS.audit, roles: ['ADMIN'], section: 'Administration' },
    { id: 'settings', label: 'Settings & Backup', icon: ICONS.settings, roles: ['ADMIN'], section: 'Administration' }
  ];

  let state = loadState();
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

  function defaultState() {
    return {
      version: 6,
      settings: {
        companyName: 'Factory ERP',
        factoryName: 'Main Manufacturing Unit',
        theme: 'light',
        dateFormat: 'DD/MM/YYYY',
        notifications: true
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const loaded = raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
      loaded.users = (loaded.users || []).map(({ password, ...user }) => user);
      return loaded;
    } catch (e) {
      console.error('State load failed', e);
      return defaultState();
    }
  }

  function saveState() {
    const safeState = { ...state, users: (state.users || []).map(({ password, ...user }) => user) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
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
    if (!current || !target) return false;
    if (current.role === 'ADMIN') return true;
    return current.role === 'MANAGER' && target.role === 'EXECUTIVE' && manageableExecutives(current.id).some(u => u.id === target.id);
  }
  function projectById(id) { return state.projects.find(p => p.id === id); }
  function userById(id) { return state.users.find(u => u.id === id); }
  function itemById(id) { return state.items.find(i => i.id === id); }
  function assignedProjects() {
    const user = getCurrentUser();
    if (!user) return [];
    return state.projects;
  }
  function visibleItems() {
    const allowed = new Set(assignedProjects().map(p => p.id));
    return state.items.filter(i => allowed.has(i.projectId));
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
    document.getElementById('app').innerHTML = `<div class="auth-shell"><section class="auth-visual"><div class="brand-lockup"><div class="brand-mark">ERP</div><div><h1>${esc(state.settings.companyName)}</h1><p>Manufacturing Operations Platform</p></div></div><div class="auth-hero"><h2>Secure authentication is loading.</h2><p>Connecting to Supabase Authentication and checking the ERP configuration.</p></div></section><section class="auth-panel"><div class="auth-card"><div class="empty-state"><div class="empty-icon">◷</div><h3>Please wait</h3><p>Loading secure sign-in…</p></div></div></section></div>`;
  }

  function renderAuth() {
    document.getElementById('app').innerHTML = `
      <div class="auth-shell">
        <section class="auth-visual">
          <div class="brand-lockup"><div class="brand-mark">ERP</div><div><h1>${esc(state.settings.companyName)}</h1><p>Manufacturing Operations Platform</p></div></div>
          <div class="auth-hero">
            <h2>Control every production stage from one place.</h2>
            <p>Secure user invitations, role-based access, projects, BOM items, shortages, reports and production tracking.</p>
            <div class="auth-stats">
              <div class="auth-stat"><strong>9</strong><span>Production stages</span></div>
              <div class="auth-stat"><strong>3</strong><span>Role levels</span></div>
              <div class="auth-stat"><strong>24h</strong><span>Recommended link expiry</span></div>
            </div>
          </div>
          <div class="auth-foot">Supabase Auth + Netlify Functions • Passwords are never stored in browser data</div>
        </section>
        <section class="auth-panel"><div class="auth-card">
          ${authMessage ? `<div class="info-banner ${authMessage.startsWith('ERROR:') ? 'danger' : ''}"><div>${authMessage.startsWith('ERROR:') ? '!' : '✓'}</div><div><p>${esc(authMessage.replace(/^ERROR:\s*/,''))}</p></div></div>` : ''}
          ${setupRequired ? setupForm() : authView === 'forgot' ? forgotPasswordForm() : loginForm()}
        </div></section>
      </div>`;
    bindAuthEvents();
  }

  function setupForm() {
    return `
      <h2>Create First Super Admin</h2>
      <p>This one-time setup creates the first secured administrator in Supabase.</p>
      <form id="setup-form">
        <div class="form-group"><label>Full name</label><input name="name" required placeholder="Your full name" autocomplete="name"></div>
        <div class="form-group"><label>Email Address</label><input name="email" type="email" required placeholder="admin@yourcompany.com" autocomplete="email"></div>
        <div class="form-group"><label>Password</label><input name="password" type="password" required minlength="10" placeholder="Strong password" autocomplete="new-password"></div>
        <div class="form-group"><label>Confirm password</label><input name="confirm" type="password" required minlength="10" placeholder="Repeat password" autocomplete="new-password"></div>
        <div class="password-rules">Use at least 10 characters with uppercase, lowercase, number and special character.</div>
        <button class="btn btn-primary btn-lg w-100" type="submit">Create Super Admin</button>
      </form>`;
  }

  function loginForm() {
    return `
      <h2>Welcome back</h2>
      <p>Sign in with the password you created from your invitation email.</p>
      <form id="login-form">
        <div class="form-group"><label>Email Address</label><input name="email" type="email" required placeholder="name@company.com" autocomplete="username"></div>
        <div class="form-group"><label>Password</label><input name="password" type="password" required placeholder="Enter password" autocomplete="current-password"></div>
        <div class="auth-row"><button type="button" class="auth-link" id="forgot-password-link">Forgot Password?</button></div>
        <button class="btn btn-primary btn-lg w-100" type="submit">Sign in</button>
      </form>`;
  }

  function forgotPasswordForm() {
    return `
      <h2>Forgot Password</h2>
      <p>Enter your registered email address. Supabase will send a secure password-reset link.</p>
      <form id="forgot-form">
        <div class="form-group"><label>Email Address</label><input name="email" type="email" required placeholder="name@company.com" autocomplete="email"></div>
        <button class="btn btn-primary btn-lg w-100" type="submit">Send Reset Link</button>
        <button class="btn btn-secondary btn-lg w-100 auth-secondary" type="button" id="back-login">Back to Sign In</button>
      </form>`;
  }

  function renderSetPassword() {
    const isInvite = passwordFlow === 'invite';
    document.getElementById('app').innerHTML = `
      <div class="auth-shell">
        <section class="auth-visual"><div class="brand-lockup"><div class="brand-mark">ERP</div><div><h1>${esc(state.settings.companyName)}</h1><p>Secure Account Activation</p></div></div><div class="auth-hero"><h2>${isInvite ? 'Welcome to the ERP System.' : 'Create a new password.'}</h2><p>${isInvite ? 'Your invitation was verified. Create your password to activate the account.' : 'Your reset link was verified. Choose a new secure password.'}</p></div><div class="auth-foot">The secure link is single-use and managed by Supabase Auth.</div></section>
        <section class="auth-panel"><div class="auth-card">
          <h2>${isInvite ? 'Set Password' : 'Reset Password'}</h2>
          <p>${esc(authSession?.user?.email || '')}</p>
          <form id="set-password-form">
            <div class="form-group"><label>New Password</label><input name="password" type="password" required minlength="10" autocomplete="new-password"></div>
            <div class="form-group"><label>Confirm Password</label><input name="confirm" type="password" required minlength="10" autocomplete="new-password"></div>
            <div class="password-rules">Minimum 10 characters, including uppercase, lowercase, number and special character.</div>
            <button class="btn btn-primary btn-lg w-100" type="submit">Save Password & Continue</button>
          </form>
        </div></section>
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
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        authSession = data.session;
        await syncProfiles();
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
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) { setFormBusy(login, false); return toast('Login failed', error.message || 'Check your email and password.', 'error'); }
      authSession = data.session;
      try {
        await syncProfiles();
        if (!currentProfile || currentProfile.status !== 'Active') throw new Error('This account is not active. Use the invitation link or contact the Super Admin.');
        currentRoute = 'dashboard'; authMessage = ''; render();
        audit('LOGIN', 'Authentication', 'User signed in', currentProfile.id); saveState();
      } catch (err) {
        await supabaseClient.auth.signOut(); authSession = null; currentProfile = null;
        toast('Login blocked', err.message, 'error'); render();
      } finally { setFormBusy(login, false); }
    });

    document.getElementById('forgot-password-link')?.addEventListener('click', () => { authView = 'forgot'; authMessage = ''; render(); });
    document.getElementById('back-login')?.addEventListener('click', () => { authView = 'login'; authMessage = ''; render(); });
    const forgot = document.getElementById('forgot-form');
    if (forgot) forgot.addEventListener('submit', async e => {
      e.preventDefault();
      const email = String(new FormData(forgot).get('email') || '').trim().toLowerCase();
      setFormBusy(forgot, true);
      const redirectTo = `${location.origin}${location.pathname}?auth=recovery`;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      setFormBusy(forgot, false);
      if (error) return toast('Unable to send reset email', error.message, 'error');
      authView = 'login'; authMessage = 'If the email is registered, a secure password-reset link has been sent.'; render();
    });
  }

  function setFormBusy(form, busy) {
    form?.querySelectorAll('button,input,select').forEach(el => { el.disabled = busy; });
  }

  async function completePasswordFlow(e) {
    e.preventDefault();
    const form = e.currentTarget, fd = new FormData(form), password = String(fd.get('password') || ''), confirm = String(fd.get('confirm') || '');
    if (password !== confirm) return toast('Password mismatch', 'Both passwords must be the same.', 'error');
    if (!strongPassword(password)) return toast('Weak password', 'Use 10+ characters with uppercase, lowercase, number and special character.', 'error');
    setFormBusy(form, true);
    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      if (passwordFlow === 'invite') await callAuthAdmin('activate', {});
      await supabaseClient.auth.signOut();
      authSession = null; currentProfile = null; passwordFlow = ''; authView = 'login';
      history.replaceState({}, document.title, location.pathname);
      authMessage = 'Password saved successfully. Sign in using your email and new password.';
      render();
    } catch (error) { toast('Password update failed', error.message, 'error'); }
    finally { setFormBusy(form, false); }
  }

  async function callAuthAdmin(action, payload = {}, needsSession = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (needsSession) {
      const token = authSession?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch('/api/auth-admin', { method: 'POST', headers, body: JSON.stringify({ action, ...payload }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Authentication request failed.');
    return body;
  }

  async function syncProfiles() {
    if (!supabaseClient || !authSession) return;
    const { data, error } = await supabaseClient.from('profiles').select('id,full_name,email,role,status,invited_at,activated_at,created_at').order('created_at', { ascending: true });
    if (error) throw error;
    state.users = (data || []).map(row => ({ id: row.id, name: row.full_name, email: row.email, role: row.role, status: titleCase(row.status), invitedAt: row.invited_at, activatedAt: row.activated_at, createdAt: row.created_at }));
    currentProfile = state.users.find(user => user.id === authSession.user.id) || null;
    saveState();
  }

  function titleCase(value = '') { return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : ''; }

  async function initialiseAuthentication() {
    renderAuthLoading();
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(config.error || 'Supabase configuration is unavailable.');
      appConfig = config; setupRequired = Boolean(config.setupRequired);
      if (!window.supabase?.createClient) throw new Error('Supabase client library did not load. Check the internet connection.');
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const requestedFlow = new URLSearchParams(location.search).get('auth');
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      authSession = data.session;
      if (requestedFlow === 'invite' || requestedFlow === 'recovery') {
        passwordFlow = requestedFlow;
        authView = authSession ? 'set-password' : 'login';
        if (!authSession) authMessage = 'ERROR:The secure link is invalid or has expired. Request a new link.';
      }
      if (authSession) {
        await syncProfiles();
        if (authView !== 'set-password' && currentProfile?.status !== 'Active') {
          await supabaseClient.auth.signOut();
          authSession = null; currentProfile = null;
          authMessage = 'ERROR:This account is not active. Use the invitation email or contact the Super Admin.';
        }
      }
      authInitialized = true;
      render();
      supabaseClient.auth.onAuthStateChange((event, nextSession) => {
        setTimeout(async () => {
          authSession = nextSession;
          if (event === 'PASSWORD_RECOVERY') { passwordFlow = 'recovery'; authView = 'set-password'; }
          if (nextSession) {
            try {
              await syncProfiles();
              if (authView !== 'set-password' && currentProfile?.status !== 'Active') {
                await supabaseClient.auth.signOut(); authSession = null; currentProfile = null;
                authMessage = 'ERROR:This account is not active. Use the invitation email or contact the Super Admin.';
              }
            } catch (error) { console.error('Profile sync failed', error); }
          } else currentProfile = null;
          if (authInitialized) render();
        }, 0);
      });
    } catch (error) {
      authInitialized = true; authSession = null; currentProfile = null; setupRequired = false;
      authMessage = `ERROR:${error.message}`; render();
    }
  }

  function renderAppShell() {
    const user = getCurrentUser();
    const allowed = NAV.filter(n => n.roles.includes(user.role));
    const groups = [...new Set(allowed.map(n => n.section))];
    const unread = state.notifications.filter(n => n.userId === user.id && !n.read).length;
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <div class="brand-area"><div class="brand-mark">ERP</div><div class="brand-copy"><strong>${esc(state.settings.companyName)}</strong><small>${esc(state.settings.factoryName)}</small></div></div>
          <div class="nav-scroll">
            ${groups.map(g => `<div class="nav-section-title">${esc(g)}</div>${allowed.filter(n=>n.section===g).map(n=>`<button class="nav-item ${currentRoute===n.id?'active':''}" data-route="${n.id}"><span class="nav-icon">${n.icon}</span><span class="nav-label">${esc(n.label)}</span></button>`).join('')}`).join('')}
          </div>
          <div class="sidebar-bottom">
            <div class="user-mini"><div class="avatar">${initials(user.name)}</div><div class="user-info"><strong>${esc(user.name)}</strong><span>${esc(roleLabel(user.role))}</span></div><button class="btn btn-ghost" data-action="logout" title="Logout">${ICONS.logout}</button></div>
          </div>
        </aside>
        <header class="topbar">
          <div class="topbar-left"><button class="icon-btn mobile-menu-btn" data-action="toggle-sidebar">${ICONS.menu}</button><div class="page-heading"><h1 id="top-page-title">Factory Overview</h1><small id="top-page-subtitle">Live operations summary</small></div></div>
          <div class="topbar-search"><span class="search-icon">${ICONS.search}</span><input id="global-search" placeholder="Search project, job, BOM or item..." autocomplete="off"><div id="global-results"></div></div>
          <div class="topbar-actions"><button class="icon-btn" data-action="theme" title="Toggle theme">${ICONS.theme}</button><button class="icon-btn" data-action="notifications" title="Notifications">${ICONS.bell}${unread ? `<span class="badge-dot">${unread>9?'9+':unread}</span>`:''}</button></div>
        </header>
        <main class="main-content"><div class="content-wrap" id="page-content"></div></main>
        <aside class="notification-panel" id="notification-panel"><div class="panel-head"><strong>Notifications</strong><div><button class="btn btn-ghost btn-sm" data-action="mark-all-read">Mark all read</button><button class="close-btn" data-action="notifications">×</button></div></div><div class="panel-body" id="notification-list"></div></aside>
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
    document.addEventListener('click', globalClickHandler, { once: true });
    document.querySelectorAll('[data-action="logout"]').forEach(btn => btn.addEventListener('click', logout));
    document.querySelectorAll('[data-action="toggle-sidebar"]').forEach(btn => btn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open')));
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
  }

  function globalClickHandler(e) {
    if (!e.target.closest('.topbar-search')) {
      const r = document.getElementById('global-results'); if (r) r.innerHTML = '';
    }
    document.addEventListener('click', globalClickHandler, { once: true });
  }

  async function logout() {
    audit('LOGOUT', 'Authentication', 'User signed out', getCurrentUser()?.id);
    saveState();
    await supabaseClient?.auth.signOut();
    authSession = null; currentProfile = null; currentRoute = 'dashboard'; authView = 'login'; render();
  }
  function toggleTheme() {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; saveState(); renderAppShell();
  }
  function markAllRead() {
    const user = getCurrentUser();
    state.notifications.forEach(n => { if (n.userId === user.id) n.read = true; });
    saveState(); renderAppShell();
  }

  function setPageTitle(title, subtitle) {
    const a = document.getElementById('top-page-title'); const b = document.getElementById('top-page-subtitle');
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
    const items = visibleItems().filter(i => [i.itemName,i.bomNumber,i.jobNumber,i.site].some(v => String(v||'').toLowerCase().includes(q))).slice(0,7);
    if (!projects.length && !items.length) { box.innerHTML = `<div class="search-results"><div class="empty-state" style="padding:24px"><p>No matching records</p></div></div>`; return; }
    box.innerHTML = `<div class="search-results">
      ${projects.length ? `<div class="search-group-title">Projects</div>${projects.map(p=>`<button class="search-result" data-search-project="${p.id}"><span class="result-icon">${ICONS.project}</span><span><strong>${esc(p.name)}</strong><span>${esc(p.code)} • ${esc(p.jobNumber || 'No Job No.')}</span></span></button>`).join('')}`:''}
      ${items.length ? `<div class="search-group-title">Production Items</div>${items.map(i=>`<button class="search-result" data-search-item="${i.id}"><span class="result-icon">${ICONS.item}</span><span><strong>${esc(i.itemName)}</strong><span>${esc(i.bomNumber || 'No BOM')} • ${esc(STAGES[i.currentStage] || '')}</span></span></button>`).join('')}`:''}
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
    el.querySelectorAll('[data-notification-id]').forEach(btn => btn.onclick = () => {
      const n = state.notifications.find(x=>x.id===btn.dataset.notificationId); if (n) n.read=true; saveState(); renderAppShell();
      if (n?.entityId && itemById(n.entityId)) setTimeout(()=>{ currentRoute='production'; renderPage('production'); openItemDetail(n.entityId); },0);
    });
  }

  function pageToolbar(title, subtitle, actions = '') {
    return `<div class="page-toolbar"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><div class="toolbar-actions">${actions}</div></div>`;
  }
  function emptyState(icon, title, text, action='') {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  }

  function renderDashboard() {
    const dashboardName = `${roleLabel(getCurrentUser()?.role || '')} Dashboard`;
    setPageTitle(dashboardName, 'Live operations summary');
    const projects = assignedProjects();
    const items = visibleItems();
    const active = projects.filter(p => p.status === 'Active').length;
    const delayed = projects.filter(p => p.status === 'Delayed' || (p.targetDate && new Date(p.targetDate) < new Date() && projectCompletion(p.id) < 100)).length;
    const completed = projects.filter(p => p.status === 'Completed' || projectCompletion(p.id) === 100).length;
    const qty = items.reduce((a,i)=>a+number(i.quantity),0);
    const ready = items.filter(i=>i.currentStage>=8 || i.status==='Completed').reduce((a,i)=>a+number(i.quantity),0);
    const pending = Math.max(0, qty-ready);
    const shortages = state.shortages.filter(s => s.status !== 'Resolved' && projects.some(p=>p.id===s.projectId)).length;
    const page = document.getElementById('page-content');
    page.innerHTML = `
      ${pageToolbar('Factory Overview Dashboard','Monitor production, delivery risk and workflow progress.', `<button class="btn btn-secondary" id="refresh-dashboard">↻ Refresh</button>${can('ADMIN','MANAGER')?'<button class="btn btn-primary" data-go="import">⇧ Import Excel</button>':''}`)}
      <div class="grid grid-5">
        ${kpi('▣','Total Projects',projects.length,'All visible projects')}
        ${kpi('●','Active Projects',active,`${completed} completed`)}
        ${kpi('⚠','Delayed Projects',delayed,'Requires attention')}
        ${kpi('∑','Total Quantity',fmtNumber(qty),`${fmtNumber(pending)} pending`)}
        ${kpi('➜','Ready for Dispatch',fmtNumber(ready),`${shortages} open shortages`)}
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <section class="card"><div class="card-header"><div><h3>Stage-wise Production</h3><p>Items currently positioned at each workflow stage</p></div></div><div class="card-body"><div class="chart-box"><canvas id="stage-chart"></canvas></div></div></section>
        <section class="card"><div class="card-header"><div><h3>Project Progress</h3><p>Completion percentage by active project</p></div></div><div class="card-body"><div class="chart-box"><canvas id="project-chart"></canvas></div></div></section>
      </div>
      <div class="grid grid-3" style="margin-top:18px">
        <section class="card" style="grid-column:span 2"><div class="card-header"><div><h3>Recent Production Activity</h3><p>Latest workflow movements and approvals</p></div></div><div class="card-body">${renderRecentActivity()}</div></section>
        <section class="card"><div class="card-header"><div><h3>Upcoming Deliveries</h3><p>Projects closest to target date</p></div></div><div class="card-body">${renderUpcomingDeliveries(projects)}</div></section>
      </div>`;
    page.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{currentRoute=b.dataset.go; renderAppShell();});
    document.getElementById('refresh-dashboard').onclick = renderDashboard;
    requestAnimationFrame(() => {
      drawBarChart('stage-chart', STAGES.map((s,idx)=>({label:shortStage(s), value:items.filter(i=>Number(i.currentStage)===idx).length})), { horizontal:false });
      drawBarChart('project-chart', projects.slice(0,10).map(p=>({label:p.name.length>18?p.name.slice(0,18)+'…':p.name,value:projectCompletion(p.id)})), { max:100, suffix:'%' });
    });
  }
  function kpi(icon,label,value,meta) { return `<section class="card kpi-card"><div class="kpi-icon">${icon}</div><div class="kpi-copy"><span>${esc(label)}</span><strong>${esc(value)}</strong><small class="kpi-meta">${esc(meta)}</small></div></section>`; }
  function shortStage(stage) { return stage.replace('READY FOR DISPATCH','DISPATCH').replace('POWDER COATING','P.COATING').replace('MRN - STORES','MRN').replace('PRE-COATING','PRE COAT'); }
  function renderRecentActivity() {
    const logs = state.audit.filter(a=>['Production','Projects','Import','Shortages'].includes(a.module)).slice(0,8);
    return logs.length ? `<div class="activity-list">${logs.map(a=>`<div class="activity-item"><div class="activity-icon">${a.module==='Production'?'⚙':a.module==='Import'?'⇧':a.module==='Shortages'?'⚠':'▣'}</div><div class="activity-main"><strong>${esc(a.action)} • ${esc(a.module)}</strong><span>${esc(a.details)} by ${esc(a.userName)}</span></div><div class="activity-time">${fmtDate(a.createdAt,true)}</div></div>`).join('')}</div>` : emptyState('◷','No recent activity','Activity will appear after records are created or updated.');
  }
  function renderUpcomingDeliveries(projects) {
    const list = projects.filter(p=>p.targetDate && projectCompletion(p.id)<100).sort((a,b)=>new Date(a.targetDate)-new Date(b.targetDate)).slice(0,6);
    return list.length ? `<div class="activity-list">${list.map(p=>{const days=Math.ceil((new Date(p.targetDate)-new Date())/86400000); return `<div class="activity-item"><div class="activity-icon">◎</div><div class="activity-main"><strong>${esc(p.name)}</strong><span>${projectCompletion(p.id)}% complete • ${days<0?Math.abs(days)+' days overdue':days+' days remaining'}</span></div><div class="activity-time">${fmtDate(p.targetDate)}</div></div>`}).join('')}</div>` : emptyState('◎','No upcoming deliveries','Add project target dates to monitor delivery schedules.');
  }

  function drawBarChart(canvasId, data, options={}) {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, rect.width*dpr); canvas.height = Math.max(220, rect.height*dpr);
    const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
    const w=canvas.width/dpr,h=canvas.height/dpr, pad={l:42,r:15,t:20,b:62};
    ctx.clearRect(0,0,w,h);
    const style=getComputedStyle(document.documentElement), line=style.getPropertyValue('--line').trim(), text=style.getPropertyValue('--muted').trim(), primary=style.getPropertyValue('--primary').trim();
    const max = options.max || Math.max(1,...data.map(d=>d.value))*1.18;
    ctx.strokeStyle=line;ctx.fillStyle=text;ctx.font='10px system-ui';ctx.textAlign='right';
    for(let i=0;i<=4;i++){const y=pad.t+(h-pad.t-pad.b)*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=Math.round(max*(1-i/4));ctx.fillText(v+(options.suffix||''),pad.l-7,y+3);}
    const chartW=w-pad.l-pad.r, gap=8, bw=Math.max(8,(chartW/data.length)-gap);
    data.forEach((d,i)=>{const x=pad.l+i*(chartW/data.length)+gap/2;const bh=(h-pad.t-pad.b)*(d.value/max);const y=h-pad.b-bh;ctx.fillStyle=primary;roundRect(ctx,x,y,bw,bh,5);ctx.fill();ctx.fillStyle=text;ctx.textAlign='center';ctx.save();ctx.translate(x+bw/2,h-pad.b+10);ctx.rotate(-0.45);ctx.fillText(d.label,0,0);ctx.restore();ctx.fillStyle=style.getPropertyValue('--text').trim();ctx.font='bold 10px system-ui';ctx.fillText(d.value+(options.suffix||''),x+bw/2,y-6);});
  }
  function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

  function renderProjects() {
    setPageTitle('Projects','Project portfolio and delivery tracking');
    const projects = assignedProjects();
    const canEdit = can('ADMIN','MANAGER');
    const page = document.getElementById('page-content');
    page.innerHTML = `${pageToolbar('Project Tracking','Search projects, monitor completion and manage assignments.', canEdit?'<button class="btn btn-primary" id="add-project">+ New Project</button>':'')}
      <div class="filter-bar"><div class="filter-item search-wide"><input id="project-search" placeholder="Search project, client, job number or site"></div><div class="filter-item"><select id="project-status"><option value="">All statuses</option><option>Active</option><option>Delayed</option><option>Completed</option><option>On Hold</option></select></div><button class="btn btn-secondary" id="project-clear">Clear</button></div>
      <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Project</th><th>Job No.</th><th>Client / Site</th><th>Manager</th><th>Target</th><th>Progress</th><th>Status</th><th>Actions</th></tr></thead><tbody id="projects-body"></tbody></table></div><div class="table-footer"><span id="project-count"></span><span>Click View for full project tracking</span></div></section>`;
    const draw = () => {
      const q=document.getElementById('project-search').value.toLowerCase(), status=document.getElementById('project-status').value;
      const rows=projects.filter(p=>(!q||[p.name,p.code,p.client,p.site,p.jobNumber].some(v=>String(v||'').toLowerCase().includes(q)))&&(!status||p.status===status));
      document.getElementById('project-count').textContent=`${rows.length} project(s)`;
      document.getElementById('projects-body').innerHTML=rows.length?rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong><div class="small muted">${esc(p.code)}</div></td><td>${esc(p.jobNumber||'—')}</td><td>${esc(p.client||'—')}<div class="small muted">${esc(p.site||'—')}</div></td><td>${esc(userById(p.managerId)?.name||'Unassigned')}</td><td>${fmtDate(p.targetDate)}</td><td style="min-width:150px"><div class="progress-line"><span style="width:${projectCompletion(p.id)}%"></span></div><div class="progress-meta"><span>${projectCompletion(p.id)}%</span><span>${state.items.filter(i=>i.projectId===p.id).length} items</span></div></td><td>${statusChip(p.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-view-project="${p.id}">View</button>${canEdit?`<button class="btn btn-ghost btn-sm" data-edit-project="${p.id}">✎</button>`:''}${can('ADMIN')?`<button class="btn btn-danger btn-sm" data-delete-project="${p.id}">×</button>`:''}</div></td></tr>`).join(''):`<tr><td colspan="8">${emptyState('▣','No projects found','Create a project or import the MASTER SHEET to begin.')}</td></tr>`;
      bindProjectRowActions();
    };
    draw();
    document.getElementById('project-search').oninput=draw; document.getElementById('project-status').onchange=draw;
    document.getElementById('project-clear').onclick=()=>{document.getElementById('project-search').value='';document.getElementById('project-status').value='';draw();};
    if(document.getElementById('add-project')) document.getElementById('add-project').onclick=()=>openProjectForm();
  }
  function bindProjectRowActions(){document.querySelectorAll('[data-view-project]').forEach(b=>b.onclick=()=>openProjectDetail(b.dataset.viewProject));document.querySelectorAll('[data-edit-project]').forEach(b=>b.onclick=()=>openProjectForm(projectById(b.dataset.editProject)));document.querySelectorAll('[data-delete-project]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.deleteProject));}
  function deleteProject(id){if(!requireRole('ADMIN'))return;const p=projectById(id);if(!p)return;if(!confirm(`Delete ${p.name} and all of its production items, shortages and issues?`))return;const itemIds=new Set(state.items.filter(i=>i.projectId===id).map(i=>i.id));state.projects=state.projects.filter(x=>x.id!==id);state.items=state.items.filter(i=>i.projectId!==id);state.shortages=state.shortages.filter(x=>x.projectId!==id&&!itemIds.has(x.itemId));state.issues=state.issues.filter(x=>x.projectId!==id&&!itemIds.has(x.itemId));audit('DELETE','Projects',`Deleted project ${p.name} and its operational records`,id);saveState();renderProjects();toast('Project deleted');}

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
    document.getElementById('save-project').onclick=()=>{
      const form=document.getElementById('project-form');if(!form.reportValidity())return;const fd=new FormData(form);
      const data={name:String(fd.get('name')).trim(),code:String(fd.get('code')||'').trim()||`PRJ-${String(state.projects.length+1).padStart(4,'0')}`,client:String(fd.get('client')||'').trim(),site:String(fd.get('site')||'').trim(),jobNumber:String(fd.get('jobNumber')||'').trim(),status:String(fd.get('status')),startDate:String(fd.get('startDate')||''),targetDate:String(fd.get('targetDate')||''),managerId:String(fd.get('managerId')||''),executiveIds:fd.getAll('executives').map(String),priority:String(fd.get('priority')||'Medium')};
      if(project){Object.assign(project,data,{updatedAt:nowISO()});audit('UPDATE','Projects',`Updated project ${data.name}`,project.id);}else{const p={id:uid('PRJ'),...data,createdAt:nowISO()};state.projects.push(p);audit('CREATE','Projects',`Created project ${data.name}`,p.id);if(p.managerId)notify(p.managerId,'Project assigned',`${p.name} has been assigned to you.`,'Assignment',p.id);p.executiveIds.forEach(id=>notify(id,'Work assigned',`${p.name} has been assigned to you.`,'Assignment',p.id));}
      saveState();closeModal();renderProjects();toast('Project saved','Project information has been updated.');
    };
  }

  function openProjectDetail(id) {
    const p=projectById(id);if(!p)return;if(!assignedProjects().some(x=>x.id===id))return toast('Access denied','This project is not assigned to your account.','error');const items=state.items.filter(i=>i.projectId===id);const shortages=state.shortages.filter(s=>s.projectId===id&&s.status!=='Resolved');
    openModal(p.name,`<div class="grid grid-4">
      ${miniMetric('Project Code',p.code)}${miniMetric('Job Number',p.jobNumber||'—')}${miniMetric('Completion',projectCompletion(p.id)+'%')}${miniMetric('Target Date',fmtDate(p.targetDate))}
    </div>
    <div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="card-body"><h3 class="mt-0">Project Details</h3><p class="small muted">Client</p><strong>${esc(p.client||'—')}</strong><p class="small muted">Site</p><strong>${esc(p.site||'—')}</strong><p class="small muted">Manager</p><strong>${esc(userById(p.managerId)?.name||'Unassigned')}</strong><p class="small muted">Executives</p><strong>${esc((p.executiveIds||[]).map(x=>userById(x)?.name).filter(Boolean).join(', ')||'Unassigned')}</strong></div></div><div class="card"><div class="card-body"><h3 class="mt-0">Production Summary</h3>${STAGES.map((s,idx)=>{const count=items.filter(i=>i.currentStage===idx).length;return `<div style="margin:10px 0"><div class="progress-meta"><span>${esc(s)}</span><strong>${count}</strong></div><div class="progress-line"><span style="width:${items.length?count/items.length*100:0}%"></span></div></div>`}).join('')}</div></div></div>
    <h3 style="margin-top:22px">Items (${items.length})</h3><div class="table-wrap"><table><thead><tr><th>Item</th><th>BOM</th><th>Quantity</th><th>Current Stage</th><th>Status</th><th></th></tr></thead><tbody>${items.length?items.map(i=>`<tr><td>${esc(i.itemName)}</td><td>${esc(i.bomNumber||'—')}</td><td>${fmtNumber(i.quantity)}</td><td>${esc(STAGES[i.currentStage])}</td><td>${statusChip(i.approvalStatus==='SUBMITTED'?'Submitted':i.status)}</td><td><button class="btn btn-secondary btn-sm" data-modal-item="${i.id}">Open</button></td></tr>`).join(''):'<tr><td colspan="6" class="muted">No items in this project.</td></tr>'}</tbody></table></div>
    ${shortages.length?`<h3 style="margin-top:22px">Open Shortages</h3><div class="info-banner warning"><div>⚠</div><div><strong>${shortages.length} shortage(s) require attention</strong><p>${shortages.map(s=>s.material).join(', ')}</p></div></div>`:''}`, `<button class="btn btn-secondary" data-close-modal>Close</button>`,'modal-xl');
    document.querySelectorAll('[data-modal-item]').forEach(b=>b.onclick=()=>{closeModal();openItemDetail(b.dataset.modalItem);});
  }
  function miniMetric(label,value){return `<div class="card"><div class="card-body"><span class="small muted">${esc(label)}</span><strong style="display:block;font-size:18px;margin-top:7px">${esc(value)}</strong></div></div>`;}

  function renderProduction() {
    setPageTitle('Production Tracker','Nine-stage manufacturing workflow');
    const items=visibleItems(),projects=assignedProjects();
    const page=document.getElementById('page-content');
    page.innerHTML=`${pageToolbar('Production Progress Tracker','Track every item from planning to ready for dispatch.','<button class="btn btn-primary" id="add-item">+ Add Item</button>')}
      <div class="filter-bar"><div class="filter-item search-wide"><input id="item-search" placeholder="Search item, BOM or job number"></div><div class="filter-item"><select id="item-project"><option value="">All projects</option>${projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="filter-item"><select id="item-stage"><option value="">All stages</option>${STAGES.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join('')}</select></div><div class="filter-item"><select id="item-status"><option value="">All statuses</option><option>In Progress</option><option>Delayed</option><option>Completed</option><option>On Hold</option></select></div></div>
      <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Item</th><th>Project</th><th>BOM / Job</th><th>Qty</th><th>Current Stage</th><th>Progress</th><th>Status</th><th>Action</th></tr></thead><tbody id="items-body"></tbody></table></div><div class="table-footer"><span id="items-count"></span><span>Open an item to view its complete timeline</span></div></section>`;
    const draw=()=>{const q=document.getElementById('item-search').value.toLowerCase(),pid=document.getElementById('item-project').value,stage=document.getElementById('item-stage').value,status=document.getElementById('item-status').value;const rows=items.filter(i=>(!q||[i.itemName,i.bomNumber,i.jobNumber].some(v=>String(v||'').toLowerCase().includes(q)))&&(!pid||i.projectId===pid)&&(!stage||String(i.currentStage)===stage)&&(!status||i.status===status));document.getElementById('items-count').textContent=`${rows.length} item(s)`;document.getElementById('items-body').innerHTML=rows.length?rows.map(i=>`<tr><td><strong>${esc(i.itemName)}</strong><div class="small muted">${esc(i.size||i.site||'')}</div></td><td>${esc(projectById(i.projectId)?.name||'Unknown')}</td><td>${esc(i.bomNumber||'—')}<div class="small muted">${esc(i.jobNumber||'—')}</div></td><td>${fmtNumber(i.quantity)}${i.quantityVerified?'':' <span title="Unverified">⚠</span>'}</td><td>${canUpdateItemStage(i)?`<select class="table-stage-select" data-stage-item="${i.id}" aria-label="Update current stage for ${esc(i.itemName)}">${STAGES.map((s,idx)=>`<option value="${idx}" ${Number(i.currentStage)===idx?'selected':''}>${esc(s)}</option>`).join('')}</select>`:esc(STAGES[i.currentStage]||'PLANNING')}</td><td style="min-width:140px"><div class="progress-line"><span style="width:${completionPercent(i)}%"></span></div><div class="progress-meta"><span>${completionPercent(i)}%</span><span>${i.approvalStatus==='SUBMITTED'?'Awaiting approval':''}</span></div></td><td>${statusChip(i.approvalStatus==='SUBMITTED'?'Submitted':i.status)}</td><td><button class="btn btn-secondary btn-sm" data-view-item="${i.id}">Open</button></td></tr>`).join(''):`<tr><td colspan="8">${emptyState('⚙','No production items','Import Excel data or add an item manually.')}</td></tr>`;document.querySelectorAll('[data-view-item]').forEach(b=>b.onclick=()=>openItemDetail(b.dataset.viewItem));document.querySelectorAll('[data-stage-item]').forEach(sel=>sel.onchange=()=>updateItemStageDirect(sel.dataset.stageItem,sel.value));};
    draw();['item-search','item-project','item-stage','item-status'].forEach(id=>document.getElementById(id).addEventListener(id==='item-search'?'input':'change',draw));
    if(document.getElementById('add-item'))document.getElementById('add-item').onclick=()=>openItemForm();
  }

  function openItemForm(item=null) {
    if(item){if(!requireRole('ADMIN','MANAGER'))return;}else if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;
    if(item&&!visibleItems().some(x=>x.id===item.id))return toast('Access denied','This production item is not assigned to your account.','error');
    const projects=assignedProjects();
    if(!projects.length)return toast('Create a project first','Production items must belong to a project.','warning');
    openModal(item?'Edit Production Item':'Add Production Item',`<form id="item-form"><div class="form-grid"><div class="form-group"><label>Project *</label><select name="projectId" required>${projects.map(p=>`<option value="${p.id}" ${item?.projectId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="form-group"><label>Quantity</label><input name="quantity" type="number" min="0" step="any" value="${item?.quantity??0}"></div><div class="form-group" style="grid-column:1/-1"><label>Item name *</label><textarea name="itemName" required placeholder="Enter complete item description">${esc(item?.itemName||'')}</textarea></div><div class="form-group"><label>BOM number</label><input name="bomNumber" value="${esc(item?.bomNumber||'')}"></div><div class="form-group"><label>Job number</label><input name="jobNumber" value="${esc(item?.jobNumber||'')}"></div><div class="form-group"><label>Size</label><input name="size" value="${esc(item?.size||'')}"></div>${item?`<div class="form-group"><label>Current stage</label><input value="${esc(STAGES[item.currentStage])}" disabled><div class="help-text">Use the stage workflow controls to move this item.</div></div>`:`<div class="form-group"><label>Current stage</label><select name="currentStage">${STAGES.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join('')}</select></div>`}</div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-item">${item?'Save Changes':'Add Item'}</button>`);
    document.getElementById('save-item').onclick=()=>{const f=document.getElementById('item-form');if(!f.reportValidity())return;const fd=new FormData(f),p=projectById(String(fd.get('projectId')));if(item){Object.assign(item,{projectId:p.id,itemName:String(fd.get('itemName')).trim(),rawItemName:String(fd.get('itemName')).trim(),site:p.site,size:String(fd.get('size')||''),quantity:number(fd.get('quantity')),quantityVerified:true,bomNumber:String(fd.get('bomNumber')||''),jobNumber:String(fd.get('jobNumber')||p.jobNumber||''),updatedAt:nowISO()});item.history=item.history||[];item.history.push(historyEvent(item,'Item Details Updated',item.status,'Production item master details updated.'));audit('UPDATE','Production',`Updated production item ${item.itemName}`,item.id);}else{const idx=Number(fd.get('currentStage'));const i={id:uid('ITM'),projectId:p.id,itemName:String(fd.get('itemName')).trim(),rawItemName:String(fd.get('itemName')).trim(),site:p.site,size:String(fd.get('size')||''),quantity:number(fd.get('quantity')),quantityVerified:true,bomNumber:String(fd.get('bomNumber')||''),jobNumber:String(fd.get('jobNumber')||p.jobNumber||''),currentStage:idx,currentStageName:STAGES[idx],status:'In Progress',approvalStatus:'',shortages:'',remarks:'',createdAt:nowISO(),updatedAt:nowISO(),history:[{id:uid('HIS'),stageIndex:idx,stageName:STAGES[idx],action:'Created',status:'In Progress',updatedBy:getCurrentUser().id,updatedByName:getCurrentUser().name,date:nowISO(),remarks:'Production item created manually.',attachments:[]}]};state.items.push(i);audit('CREATE','Production',`Created production item ${i.itemName}`,i.id);}saveState();closeModal();renderProduction();toast(item?'Item updated':'Item created','Production item saved successfully.');};
  }

  function openItemDetail(id) {
    const item=itemById(id);if(!item)return;if(!visibleItems().some(x=>x.id===id))return toast('Access denied','This production item is not assigned to your account.','error');const project=projectById(item.projectId),user=getCurrentUser();const canApprove=['ADMIN','MANAGER'].includes(user.role)&&item.approvalStatus==='SUBMITTED';
    const timeline=STAGES.map((s,idx)=>{let cls='pending',symbol=idx+1;if(idx<item.currentStage){cls='completed';symbol='✓';}else if(idx===item.currentStage){cls=item.status==='Delayed'?'delayed':item.approvalStatus==='SUBMITTED'?'submitted':'current';symbol=item.status==='Delayed'?'!':item.approvalStatus==='SUBMITTED'?'↥':idx+1;}const hist=[...(item.history||[])].reverse().find(h=>h.stageIndex===idx);return `<div class="timeline-stage ${cls}"><div class="stage-circle">${symbol}</div><div class="stage-name">${esc(s)}</div><div class="stage-meta">${hist?`${fmtDate(hist.date)}<br>${esc(hist.updatedByName||'')}`:idx<item.currentStage?'Imported stage':'Pending'}</div></div>`}).join('');
    openModal(item.itemName,`<div class="info-banner"><div>⚙</div><div><strong>${esc(project?.name||'Unknown project')}</strong><p>BOM: ${esc(item.bomNumber||'—')} • Job: ${esc(item.jobNumber||'—')} • Quantity: ${fmtNumber(item.quantity)}</p></div></div><div class="timeline">${timeline}</div>
      <div class="grid grid-3" style="margin-top:18px">${miniMetric('Current Stage',STAGES[item.currentStage])}${miniMetric('Progress',completionPercent(item)+'%')}${miniMetric('Status',item.approvalStatus==='SUBMITTED'?'Awaiting Approval':item.status)}</div>
      <div class="tabs" style="margin-top:20px"><button class="tab active" data-item-tab="history">Stage History</button><button class="tab" data-item-tab="details">Item Details</button><button class="tab" data-item-tab="attachments">Attachments</button></div><div id="item-tab-content">${itemHistoryHtml(item)}</div>`,
      `<button class="btn btn-secondary" data-close-modal>Close</button>${can('ADMIN','MANAGER')?'<button class="btn btn-secondary" id="edit-item">Edit Item</button>':''}${can('ADMIN')?'<button class="btn btn-danger" id="delete-item">Delete Item</button>':''}${canUpdateItemStage(item)&&item.approvalStatus!=='SUBMITTED'&&item.currentStage<8?'<button class="btn btn-primary" id="update-stage">Update Stage</button>':''}${canApprove?'<button class="btn btn-danger" id="reject-stage">Reject</button><button class="btn btn-success" id="approve-stage">Approve & Continue</button>':''}${item.currentStage===8&&item.status!=='Completed'&&can('ADMIN','MANAGER')?'<button class="btn btn-success" id="complete-item">Mark Completed</button>':''}`,'modal-xl');
    document.querySelectorAll('[data-item-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-item-tab]').forEach(x=>x.classList.toggle('active',x===b));const c=document.getElementById('item-tab-content');c.innerHTML=b.dataset.itemTab==='history'?itemHistoryHtml(item):b.dataset.itemTab==='details'?itemDetailsHtml(item,project):itemAttachmentsHtml(item);bindAttachmentLinks();});
    if(document.getElementById('edit-item'))document.getElementById('edit-item').onclick=()=>{closeModal();openItemForm(item);};
    if(document.getElementById('delete-item'))document.getElementById('delete-item').onclick=()=>deleteItem(item.id);
    if(document.getElementById('update-stage'))document.getElementById('update-stage').onclick=()=>openStageUpdate(item);
    if(document.getElementById('approve-stage'))document.getElementById('approve-stage').onclick=()=>approveStage(item,true);
    if(document.getElementById('reject-stage'))document.getElementById('reject-stage').onclick=()=>rejectStage(item);
    if(document.getElementById('complete-item'))document.getElementById('complete-item').onclick=()=>{item.status='Completed';item.approvalStatus='';item.updatedAt=nowISO();item.history.push(historyEvent(item,'Completed','Completed','Item marked ready and completed.'));audit('COMPLETE','Production',`Completed ${item.itemName}`,item.id);saveState();closeModal();renderProduction();toast('Item completed');};
    bindAttachmentLinks();
  }
  function deleteItem(id){if(!requireRole('ADMIN'))return;const item=itemById(id);if(!item)return;if(!confirm(`Delete ${item.itemName} and its complete stage history?`))return;state.items=state.items.filter(i=>i.id!==id);state.shortages=state.shortages.filter(s=>s.itemId!==id);state.issues=state.issues.filter(x=>x.itemId!==id);audit('DELETE','Production',`Deleted production item ${item.itemName}`,id);saveState();closeModal();renderProduction();toast('Item deleted');}

  function itemHistoryHtml(item){const h=[...(item.history||[])].reverse();return h.length?`<div class="activity-list">${h.map(x=>`<div class="activity-item"><div class="activity-icon">${x.status==='Approved'?'✓':x.status==='Rejected'?'!':'⚙'}</div><div class="activity-main"><strong>${esc(x.stageName)} • ${esc(x.action)}</strong><span>${esc(x.remarks||'No remarks')}<br>${esc(x.updatedByName||'Unknown user')} • ${esc(x.status||'')}</span>${(x.attachments||[]).length?`<div>${x.attachments.map(a=>`<button class="file-chip" data-file-id="${a.id}" data-item-id="${item.id}">▤ ${esc(a.name)}</button>`).join('')}</div>`:''}</div><div class="activity-time">${fmtDate(x.date,true)}</div></div>`).join('')}</div>`:emptyState('◷','No stage history','Updates will appear here.');}
  function itemDetailsHtml(i,p){return `<div class="grid grid-2"><div>${detailRow('Project',p?.name)}${detailRow('Site',i.site||p?.site)}${detailRow('BOM Number',i.bomNumber)}${detailRow('Job Number',i.jobNumber)}${detailRow('Size',i.size)}${detailRow('Quantity',fmtNumber(i.quantity))}</div><div>${detailRow('Current Stage',STAGES[i.currentStage])}${detailRow('Status',i.status)}${detailRow('Quantity Verified',i.quantityVerified?'Yes':'No')}${detailRow('Shortages',i.shortages||'None')}${detailRow('Created',fmtDate(i.createdAt,true))}${detailRow('Updated',fmtDate(i.updatedAt,true))}</div></div>`;}
  function detailRow(label,value){return `<div class="setting-row"><div class="setting-copy"><span>${esc(label)}</span></div><strong>${esc(value||'—')}</strong></div>`;}
  function itemAttachmentsHtml(item){const files=(item.history||[]).flatMap(h=>(h.attachments||[]).map(a=>({...a,stage:h.stageName,date:h.date})));return files.length?`<div class="table-wrap"><table><thead><tr><th>File</th><th>Stage</th><th>Uploaded</th><th>Action</th></tr></thead><tbody>${files.map(a=>`<tr><td>${esc(a.name)}<div class="small muted">${fmtNumber(a.size/1024)} KB</div></td><td>${esc(a.stage)}</td><td>${fmtDate(a.date,true)}</td><td><button class="btn btn-secondary btn-sm" data-file-id="${a.id}" data-item-id="${item.id}">Open</button></td></tr>`).join('')}</tbody></table></div>`:emptyState('▤','No attachments','Files uploaded during stage updates will appear here.');}
  function bindAttachmentLinks(){document.querySelectorAll('[data-file-id]').forEach(b=>b.onclick=()=>{const item=itemById(b.dataset.itemId);const file=(item.history||[]).flatMap(h=>h.attachments||[]).find(a=>a.id===b.dataset.fileId);if(file?.data){const a=document.createElement('a');a.href=file.data;a.download=file.name;a.click();}else toast('File unavailable','Only metadata is stored for large files.','warning');});}
  function historyEvent(item,action,status,remarks,attachments=[]){return{id:uid('HIS'),stageIndex:item.currentStage,stageName:STAGES[item.currentStage],action,status,updatedBy:getCurrentUser().id,updatedByName:getCurrentUser().name,date:nowISO(),remarks,attachments};}

  function updateItemStageDirect(itemId, nextStageValue) {
    if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;
    const item=itemById(itemId);
    if(!item||!visibleItems().some(x=>x.id===itemId)||!canUpdateItemStage(item))return toast('Access denied','You must be logged in to update a production stage.','error');
    const nextStage=Number(nextStageValue);
    if(!Number.isInteger(nextStage)||nextStage<0||nextStage>=STAGES.length)return toast('Invalid stage','Select a valid production stage.','error');
    const previousStage=Number(item.currentStage||0);
    if(previousStage===nextStage)return;
    const previousStageName=STAGES[previousStage]||'UNKNOWN';
    item.currentStage=nextStage;
    item.currentStageName=STAGES[nextStage];
    item.approvalStatus='';
    if(item.status==='Completed'&&nextStage<STAGES.length-1)item.status='In Progress';
    item.updatedAt=nowISO();
    item.history=item.history||[];
    item.history.push(historyEvent(item,'Stage Changed',item.status||'In Progress',`Current stage changed directly from ${previousStageName} to ${STAGES[nextStage]} in Production Tracker.`));
    audit('UPDATE','Production',`Changed ${item.itemName} stage from ${previousStageName} to ${STAGES[nextStage]}`,item.id);
    saveState();
    renderProduction();
    toast('Production stage updated',`${item.itemName} moved to ${STAGES[nextStage]}.`);
  }

  function openStageUpdate(item) {
    if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;
    if(!canUpdateItemStage(item))return toast('Access denied','You must be logged in to update a production stage.','error');
    openModal(`Update: ${STAGES[item.currentStage]}`,`<form id="stage-form"><div class="form-group"><label>Status</label><select name="status"><option>In Progress</option><option>Delayed</option><option>On Hold</option></select></div><div class="form-group"><label>Remarks *</label><textarea name="remarks" required placeholder="Describe work completed, issue or delay reason"></textarea></div><div class="form-group"><label>Images / documents</label><input id="stage-files" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"><div class="help-text">For static browser storage, files up to 500 KB each can be saved. Larger files are recorded by name only.</div></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="submit-stage">Submit Update</button>`);
    document.getElementById('submit-stage').onclick=async()=>{const f=document.getElementById('stage-form');if(!f.reportValidity())return;const fd=new FormData(f),status=String(fd.get('status')),remarks=String(fd.get('remarks')),files=[...document.getElementById('stage-files').files],attachments=[];for(const file of files.slice(0,4)){attachments.push({id:uid('FIL'),name:file.name,type:file.type,size:file.size,data:file.size<=512000?await fileToDataURL(file):null});}item.status=status;item.updatedAt=nowISO();item.history.push(historyEvent(item,'Stage Updated',status,remarks,attachments));if(status==='In Progress'){if(can('EXECUTIVE')){item.approvalStatus='SUBMITTED';const p=projectById(item.projectId);if(p?.managerId)notify(p.managerId,'Stage completion submitted',`${item.itemName} is waiting for approval at ${STAGES[item.currentStage]}.`,'Approval',item.id);}else{item.approvalStatus='SUBMITTED';}}else if(status==='Delayed'){const p=projectById(item.projectId);if(p?.managerId)notify(p.managerId,'Production delay reported',`${item.itemName} is delayed at ${STAGES[item.currentStage]}.`,'Delay',item.id);}audit('UPDATE','Production',`Updated ${item.itemName} at ${STAGES[item.currentStage]}`,item.id);saveState();closeModal();openItemDetail(item.id);toast(item.approvalStatus==='SUBMITTED'?'Submitted for approval':'Stage updated','Production history has been recorded.');};
  }
  function approveStage(item){item.history.push(historyEvent(item,'Stage Approved','Approved','Stage completion approved by manager.'));item.approvalStatus='';if(item.currentStage<8){item.currentStage+=1;item.currentStageName=STAGES[item.currentStage];item.status='In Progress';item.history.push(historyEvent(item,'Stage Started','In Progress','Next production stage started.'));}else item.status='Completed';item.updatedAt=nowISO();const p=projectById(item.projectId);(p?.executiveIds||[]).forEach(id=>notify(id,'Stage approved',`${item.itemName} has been approved and moved to ${STAGES[item.currentStage]}.`,'Approval',item.id));audit('APPROVE','Production',`Approved stage for ${item.itemName}`,item.id);saveState();closeModal();renderProduction();toast('Stage approved',item.status==='Completed'?'Item completed.':`Moved to ${STAGES[item.currentStage]}.`);}
  function rejectStage(item){openModal('Reject Stage',`<form id="reject-form"><div class="form-group"><label>Reason *</label><textarea name="reason" required placeholder="Explain why the stage was rejected"></textarea></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-danger" id="confirm-reject">Reject Stage</button>`);document.getElementById('confirm-reject').onclick=()=>{const f=document.getElementById('reject-form');if(!f.reportValidity())return;const reason=String(new FormData(f).get('reason'));item.approvalStatus='';item.status='In Progress';item.history.push(historyEvent(item,'Stage Rejected','Rejected',reason));const p=projectById(item.projectId);(p?.executiveIds||[]).forEach(id=>notify(id,'Stage rejected',`${item.itemName}: ${reason}`,'Approval',item.id));audit('REJECT','Production',`Rejected stage for ${item.itemName}: ${reason}`,item.id);saveState();closeModal();renderProduction();toast('Stage rejected','Executive has been notified.','warning');};}
  function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}

  function renderShortages() {
    setPageTitle('Shortages & Issues','Material constraints and production blockers');
    const projects=assignedProjects(),allowed=new Set(projects.map(p=>p.id));const shortages=state.shortages.filter(s=>allowed.has(s.projectId));
    const page=document.getElementById('page-content');
    page.innerHTML=`${pageToolbar('Shortages & Issues','Report and resolve material shortages affecting production.','<button class="btn btn-primary" id="add-shortage">+ Report Shortage</button>')}
      <div class="grid grid-4">${kpi('⚠','Open Shortages',shortages.filter(s=>s.status==='Open').length,'Requires material action')}${kpi('!','Critical',shortages.filter(s=>s.severity==='Critical'&&s.status!=='Resolved').length,'Immediate escalation')}${kpi('✓','Resolved',shortages.filter(s=>s.status==='Resolved').length,'Closed records')}${kpi('∑','Shortage Qty',fmtNumber(shortages.filter(s=>s.status!=='Resolved').reduce((a,s)=>a+number(s.shortageQty),0)),'Across visible projects')}</div>
      <section class="card table-card" style="margin-top:18px"><div class="table-wrap"><table><thead><tr><th>Material</th><th>Project / Item</th><th>Required</th><th>Available</th><th>Shortage</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead><tbody>${shortages.length?shortages.map(s=>`<tr><td><strong>${esc(s.material)}</strong><div class="small muted">${esc(s.remarks||'')}</div></td><td>${esc(projectById(s.projectId)?.name||'—')}<div class="small muted">${esc(itemById(s.itemId)?.itemName||'General project shortage')}</div></td><td>${fmtNumber(s.requiredQty)} ${esc(s.uom||'')}</td><td>${fmtNumber(s.availableQty)} ${esc(s.uom||'')}</td><td><strong class="text-danger">${fmtNumber(s.shortageQty)}</strong></td><td>${statusChip(s.severity)}</td><td>${statusChip(s.status)}</td><td><div class="table-actions">${s.status!=='Resolved'&&can('ADMIN','MANAGER')?`<button class="btn btn-success btn-sm" data-resolve-shortage="${s.id}">Resolve</button>`:''}${can('ADMIN')?`<button class="btn btn-danger btn-sm" data-delete-shortage="${s.id}">Delete</button>`:''}${s.status==='Resolved'&&!can('ADMIN')?'—':''}</div></td></tr>`).join(''):`<tr><td colspan="8">${emptyState('⚠','No shortages reported','Production teams can report material constraints here.')}</td></tr>`}</tbody></table></div></section>`;
    document.getElementById('add-shortage').onclick=()=>openShortageForm();document.querySelectorAll('[data-resolve-shortage]').forEach(b=>b.onclick=()=>{const s=state.shortages.find(x=>x.id===b.dataset.resolveShortage);s.status='Resolved';s.resolvedAt=nowISO();audit('RESOLVE','Shortages',`Resolved shortage for ${s.material}`,s.id);saveState();renderShortages();toast('Shortage resolved');});document.querySelectorAll('[data-delete-shortage]').forEach(b=>b.onclick=()=>{if(!requireRole('ADMIN'))return;const x=state.shortages.find(s=>s.id===b.dataset.deleteShortage);if(!x||!confirm(`Delete shortage record for ${x.material}?`))return;state.shortages=state.shortages.filter(s=>s.id!==x.id);audit('DELETE','Shortages',`Deleted shortage for ${x.material}`,x.id);saveState();renderShortages();toast('Shortage deleted');});
  }
  function openShortageForm(){if(!requireRole('ADMIN','MANAGER','EXECUTIVE'))return;const projects=assignedProjects();if(!projects.length)return toast('No project available','Create or assign a project first.','warning');openModal('Report Material Shortage',`<form id="shortage-form"><div class="form-grid"><div class="form-group"><label>Project *</label><select name="projectId" id="shortage-project" required>${projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="form-group"><label>Production item</label><select name="itemId" id="shortage-item"></select></div><div class="form-group"><label>Material *</label><input name="material" required></div><div class="form-group"><label>UOM</label><input name="uom" value="Nos."></div><div class="form-group"><label>Required quantity</label><input name="requiredQty" type="number" min="0" step="any" value="0"></div><div class="form-group"><label>Available quantity</label><input name="availableQty" type="number" min="0" step="any" value="0"></div><div class="form-group"><label>Severity</label><select name="severity"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div></div><div class="form-group"><label>Remarks</label><textarea name="remarks"></textarea></div></form>`,`<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-shortage">Report Shortage</button>`);const fill=()=>{const pid=document.getElementById('shortage-project').value;document.getElementById('shortage-item').innerHTML='<option value="">Project level</option>'+state.items.filter(i=>i.projectId===pid).map(i=>`<option value="${i.id}">${esc(i.itemName)}</option>`).join('');};fill();document.getElementById('shortage-project').onchange=fill;document.getElementById('save-shortage').onclick=()=>{const f=document.getElementById('shortage-form');if(!f.reportValidity())return;const fd=new FormData(f),req=number(fd.get('requiredQty')),avail=number(fd.get('availableQty'));const s={id:uid('SHR'),projectId:String(fd.get('projectId')),itemId:String(fd.get('itemId')||''),material:String(fd.get('material')).trim(),requiredQty:req,availableQty:avail,shortageQty:Math.max(0,req-avail),uom:String(fd.get('uom')||''),severity:String(fd.get('severity')),status:'Open',remarks:String(fd.get('remarks')||''),reportedBy:getCurrentUser().id,createdAt:nowISO()};state.shortages.push(s);const p=projectById(s.projectId);if(p?.managerId)notify(p.managerId,'Material shortage reported',`${s.material}: shortage of ${s.shortageQty} ${s.uom}`,'Delay',s.itemId||s.id);audit('CREATE','Shortages',`Reported shortage for ${s.material}`,s.id);saveState();closeModal();renderShortages();toast('Shortage reported');};}

  function renderImport() {
    setPageTitle('Excel Import','Validate and import MASTER SHEET records');
    const page=document.getElementById('page-content');
    page.innerHTML=`${pageToolbar('Excel / CSV Import','Map factory master data into projects and production items.',`<a class="btn btn-secondary" href="ERP_Bulk_Upload_Template.xlsx" download>⇩ Download Excel Template</a>${can('ADMIN')?'<button class="btn btn-danger" id="delete-uploaded-data">Delete Uploaded Data</button>':''}`)}
      <div class="info-banner warning"><div>⚠</div><div><strong>Browser-based import</strong><p>XLSX files are read locally in your browser. Nothing is uploaded to a server. SheetJS is loaded from a public CDN; CSV import works even when the library is unavailable.</p></div></div>
      <div class="import-steps"><div class="import-step active">1. Select File</div><div class="import-step">2. Read Data</div><div class="import-step">3. Validate</div><div class="import-step">4. Import</div></div>
      <section class="card"><div class="card-body"><div class="import-drop" id="import-drop"><div class="drop-icon">⇧</div><h3>Drop MASTER SHEET.xlsx here</h3><p>Supported formats: XLSX, XLS and CSV</p><button class="btn btn-primary" id="choose-import-file">Choose File</button></div><div id="import-results" style="margin-top:18px"></div></div></section>`;
    if(document.getElementById('delete-uploaded-data'))document.getElementById('delete-uploaded-data').onclick=deleteUploadedData;
    const input=document.getElementById('excel-file-input');input.value='';document.getElementById('choose-import-file').onclick=()=>input.click();input.onchange=()=>{if(input.files[0])processImportFile(input.files[0]);};const drop=document.getElementById('import-drop');['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)processImportFile(f);});
  }

  async function processImportFile(file) {
    if(!requireRole('ADMIN','MANAGER'))return;
    const result=document.getElementById('import-results');result.innerHTML='<div class="empty-state"><div class="empty-icon">◷</div><h3>Reading file...</h3><p>Please wait while the workbook is parsed locally.</p></div>';
    try {
      let rows=[],headers=[];
      if(file.name.toLowerCase().endsWith('.csv')) { const parsed=parseCSV(await file.text()); rows=parsed.rows; headers=parsed.headers; }
      else {
        if(typeof XLSX==='undefined') throw new Error('XLSX library could not load. Check your internet connection or save the sheet as CSV.');
        const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array',cellDates:false});
        const sheetName=wb.SheetNames.find(n=>n.trim().toUpperCase()==='MASTER SHEET')||wb.SheetNames[0];
        const sheet=wb.Sheets[sheetName];
        const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
        headers=(matrix[0]||[]).map(x=>String(x||''));
        rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});
      }
      const missing=validateTemplateHeaders(headers);
      if(missing.length) throw new Error(`Required column(s) missing: ${missing.join(', ')}. Download and use the ERP Excel template without changing its headers.`);
      if(!rows.length) throw new Error('The file contains the correct headers but no data rows. Add records below the header row and upload it again.');
      const parsed=validateImportRows(rows);importBuffer={fileName:file.name,...parsed};renderImportPreview();
    } catch(e){result.innerHTML=`<div class="info-banner danger"><div>!</div><div><strong>Unable to validate file</strong><p>${esc(e.message)}</p></div></div>`;}
  }
  function parseCSV(text){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return{headers:[],rows:[]};const parseLine=line=>{const out=[];let v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){v+='"';i++;}else if(c==='"')q=!q;else if(c===','&&!q){out.push(v.trim());v='';}else v+=c;}out.push(v.trim());return out;};const headers=parseLine(lines[0]);const rows=lines.slice(1).map(l=>{const vals=parseLine(l),o={};headers.forEach((h,i)=>o[h]=vals[i]??'');return o;});return{headers,rows};}
  function cleanKey(k){return String(k||'').trim().toUpperCase().replace(/\s+/g,' ');}
  function validateTemplateHeaders(headers){const available=new Set(headers.map(cleanKey).filter(Boolean));return TEMPLATE_HEADERS.filter(h=>!available.has(cleanKey(h)));}
  function getCol(row,...names){const map={};Object.entries(row).forEach(([k,v])=>map[cleanKey(k)]=v);for(const n of names){if(map[cleanKey(n)]!==undefined)return map[cleanKey(n)];}return '';}
  function canonicalStage(value){const s=String(value||'').trim().toUpperCase().replace(/\s*-\s*/g,' - ').replace(/\s+/g,' ');const compact=s.replace(/[\s-]/g,'');const found=STAGES.find(x=>x.replace(/[\s-]/g,'')===compact);return found||'';}
  function excelDate(value){if(value===0||value==='0'||value===''||value==null)return'';if(typeof value==='number'){const d=new Date(Math.round((value-25569)*86400*1000));return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}const s=String(value).trim();const dmy=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(dmy){const d=new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}T00:00:00`);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
  function extractQty(name){const matches=[...String(name||'').matchAll(/(\d+(?:\.\d+)?)\s*(?:NOS?\.?|PCS?\.?|PIECES?)/gi)];return matches.length?number(matches[matches.length-1][1]):0;}
  function extractSize(name){const m=String(name||'').match(/(?:W(?:IDTH)?\s*)?(\d+(?:\.\d+)?)\s*MM\s*[X×]\s*(?:H(?:EIGHT)?\s*)?(\d+(?:\.\d+)?)\s*MM/i);return m?`${m[1]} x ${m[2]} mm`:'';}
  function validateImportRows(rows){const valid=[],failed=[],warnings=[],seen=new Set();rows.forEach((r,index)=>{const itemName=String(getCol(r,'ITEM NAME')).trim(),projectName=String(getCol(r,'PROJECT NAME')).trim(),statusRaw=getCol(r,'STATUS'),stage=canonicalStage(statusRaw),qtyCell=getCol(r,'QTY'),qtyText=String(qtyCell??'').trim(),qtyParsed=qtyText===''?0:Number(qtyCell),suggested=extractQty(itemName),qty=Number.isFinite(qtyParsed)&&qtyParsed>0?qtyParsed:suggested;const dateFields=[['BOM ISSUE DATE','bomIssueDate'],['DRAWING ISSUE DATE','drawingIssueDate'],['INDENT ISSUE DATE','indentIssueDate'],['TENT DEL DATE','targetDate']];const dates={};const dateErrors=[];dateFields.forEach(([header,key])=>{const raw=getCol(r,header);dates[key]=excelDate(raw);if(String(raw??'').trim()&&!dates[key])dateErrors.push(`${header} has an invalid date`);});const rec={sourceRow:index+2,projectName,itemName,site:String(getCol(r,'SITE DETAILS')).trim(),size:String(getCol(r,'SIZE')).trim()||extractSize(itemName),bomPath:String(getCol(r,'BOM')).trim(),quantity:qty,quantitySource:Number.isFinite(qtyParsed)&&qtyParsed>0?'Excel Column':suggested>0?'Item Description':'Missing',quantityVerified:Number.isFinite(qtyParsed)&&qtyParsed>0,bomNumber:String(getCol(r,'BOM NUMBER')).trim(),jobNumber:String(getCol(r,'JOB NO')).trim(),...dates,indentNumber:String(getCol(r,'INDENT NO')).trim(),shortages:String(getCol(r,'SHORTAGES')).trim(),stage,statusRaw:String(statusRaw||'').trim(),raw:r,errors:[],warnings:[]};if(!projectName)rec.errors.push('PROJECT NAME is required');if(!itemName)rec.errors.push('ITEM NAME is required');if(!stage)rec.errors.push(`STATUS is invalid: ${rec.statusRaw||'blank'}`);if(qtyText!==''&&(!Number.isFinite(qtyParsed)||qtyParsed<=0))rec.errors.push('QTY must be a number greater than zero');if(qtyText===''&&!suggested)rec.errors.push('QTY is required unless a quantity such as 10 NOS is present in ITEM NAME');if(suggested>0&&qtyText==='')rec.warnings.push('Quantity extracted from ITEM NAME and requires confirmation');rec.errors.push(...dateErrors);const key=[projectName,itemName,rec.site,rec.bomNumber,rec.jobNumber,stage,qty].map(x=>String(x).trim().toLowerCase()).join('|');if(seen.has(key))rec.errors.push('Exact duplicate row exists in this file');seen.add(key);const existing=state.items.some(i=>[projectById(i.projectId)?.name,i.itemName,i.site,i.bomNumber,i.jobNumber,STAGES[i.currentStage],i.quantity].map(x=>String(x||'').trim().toLowerCase()).join('|')===key);if(existing)rec.errors.push('Exact duplicate record already exists in the ERP');if(rec.errors.length)failed.push(rec);else{valid.push(rec);if(rec.warnings.length)warnings.push(rec);}});return{total:rows.length,valid,failed,warnings};}

  function renderImportPreview(){const r=importBuffer,result=document.getElementById('import-results');document.querySelectorAll('.import-step').forEach((x,i)=>{x.classList.toggle('done',i<2);x.classList.toggle('active',i===2);});result.innerHTML=`<div class="validation-summary"><div class="validation-box"><strong>${r.total}</strong><span>Total Rows</span></div><div class="validation-box"><strong class="text-success">${r.valid.length}</strong><span>Valid Rows</span></div><div class="validation-box"><strong class="text-warning">${r.warnings.length}</strong><span>Warnings</span></div><div class="validation-box"><strong class="text-danger">${r.failed.length}</strong><span>Failed Rows</span></div><div class="validation-box"><strong>${new Set(r.valid.map(x=>x.projectName)).size}</strong><span>Projects</span></div></div>
      ${r.failed.length?`<div class="info-banner danger"><div>!</div><div><strong>${r.failed.length} row(s) will not be imported</strong><p>Rows with missing project/item names, invalid stages or exact duplicates are excluded.</p></div></div>`:''}
      <div class="table-wrap"><table><thead><tr><th>Row</th><th>Project</th><th>Item</th><th>Qty</th><th>BOM / Job</th><th>Stage</th><th>Validation</th></tr></thead><tbody>${[...r.valid.slice(0,80),...r.failed.slice(0,20)].map(x=>`<tr><td>${x.sourceRow}</td><td>${esc(x.projectName||'—')}</td><td>${esc(x.itemName||'—')}<div class="small muted">${esc(x.site)}</div></td><td>${fmtNumber(x.quantity)}<div class="small muted">${esc(x.quantitySource)}</div></td><td>${esc(x.bomNumber||'—')}<div class="small muted">${esc(x.jobNumber||'—')}</div></td><td>${esc(x.stage||x.statusRaw||'—')}</td><td>${x.errors.length?`<span class="text-danger small">${esc(x.errors.join('; '))}</span>`:x.warnings.length?`<span class="text-warning small">${esc(x.warnings.join('; '))}</span>`:'<span class="text-success small">Valid</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="modal-footer" style="position:static;padding:16px 0 0"><button class="btn btn-secondary" id="download-error-report">Download Error CSV</button><button class="btn btn-primary" id="confirm-import" ${r.valid.length?'':'disabled'}>Import ${r.valid.length} Valid Rows</button></div>`;document.getElementById('confirm-import').onclick=confirmImport;document.getElementById('download-error-report').onclick=downloadErrorReport;}
  function confirmImport(){if(!requireRole('ADMIN','MANAGER'))return;const user=getCurrentUser(),createdProjects=[];let imported=0;importBuffer.valid.forEach(r=>{let p=state.projects.find(x=>x.name.trim().toLowerCase()===r.projectName.toLowerCase()&&(r.jobNumber?String(x.jobNumber||'').toLowerCase()===r.jobNumber.toLowerCase():true));if(!p){p={id:uid('PRJ'),code:`PRJ-${String(state.projects.length+1).padStart(4,'0')}`,name:r.projectName,client:'',site:r.site,jobNumber:r.jobNumber,status:'Active',startDate:r.bomIssueDate||todayISO(),targetDate:r.targetDate,managerId:user.role==='MANAGER'?user.id:'',executiveIds:[],priority:'Medium',createdAt:nowISO()};state.projects.push(p);createdProjects.push(p);}const idx=STAGES.indexOf(r.stage);const i={id:uid('ITM'),projectId:p.id,itemName:r.itemName,rawItemName:r.itemName,site:r.site,size:r.size,quantity:r.quantity,quantitySource:r.quantitySource,quantityVerified:r.quantityVerified,bomPath:r.bomPath,bomNumber:r.bomNumber,jobNumber:r.jobNumber,bomIssueDate:r.bomIssueDate,drawingIssueDate:r.drawingIssueDate,indentNumber:r.indentNumber,indentIssueDate:r.indentIssueDate,targetDate:r.targetDate,currentStage:idx,currentStageName:r.stage,status:r.shortages?'Delayed':'In Progress',approvalStatus:'',shortages:r.shortages,remarks:'',createdAt:nowISO(),updatedAt:nowISO(),history:[{id:uid('HIS'),stageIndex:idx,stageName:r.stage,action:'Excel Initial Import',status:'Imported',updatedBy:user.id,updatedByName:user.name,date:nowISO(),remarks:`Imported from ${importBuffer.fileName}, source row ${r.sourceRow}. Previous stage history was not available in the workbook.`,attachments:[]} ]};state.items.push(i);if(r.shortages){state.shortages.push({id:uid('SHR'),projectId:p.id,itemId:i.id,material:'Imported shortage',requiredQty:0,availableQty:0,shortageQty:0,uom:'',severity:'High',status:'Open',remarks:r.shortages,reportedBy:user.id,createdAt:nowISO()});}imported++;});audit('IMPORT','Import',`Imported ${imported} production rows from ${importBuffer.fileName}`);saveState();document.querySelectorAll('.import-step').forEach(x=>x.classList.add('done'));document.getElementById('import-results').innerHTML=`<div class="empty-state"><div class="empty-icon">✓</div><h3>Import completed</h3><p>${imported} items imported across ${createdProjects.length} new project(s). Invalid rows were skipped.</p><button class="btn btn-primary" id="open-production-after-import">Open Production Tracker</button></div>`;document.getElementById('open-production-after-import').onclick=()=>{currentRoute='production';renderAppShell();};toast('Import completed',`${imported} records added successfully.`);}
  function deleteUploadedData(){if(!requireRole('ADMIN'))return;if(!confirm('Delete all uploaded projects, production items, shortages, issues and operational notifications? User accounts and settings will remain.'))return;if(!confirm('Final confirmation: permanently delete all uploaded operational data?'))return;const counts={projects:state.projects.length,items:state.items.length};state.projects=[];state.items=[];state.shortages=[];state.issues=[];state.notifications=[];importBuffer=null;audit('DELETE','Import',`Deleted all uploaded data (${counts.projects} projects and ${counts.items} items)`);saveState();renderImport();toast('Uploaded data deleted','The ERP is ready for a fresh template upload.');}
    function downloadErrorReport(){const rows=[...importBuffer.failed,...importBuffer.warnings];const csv=['Source Row,Project,Item,Stage,Errors,Warnings',...rows.map(r=>[r.sourceRow,r.projectName,r.itemName,r.statusRaw,r.errors.join('; '),r.warnings.join('; ')].map(csvCell).join(','))].join('\n');downloadBlob(csv,'factory-erp-import-errors.csv','text/csv');}
  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadBlob(content,name,type){const b=new Blob([content],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  function renderReports() {
    setPageTitle('Reports','Operational reporting and exports');
    const page=document.getElementById('page-content');page.innerHTML=`${pageToolbar('Reports Centre','Generate project, stage, delay and shortage reports.','<button class="btn btn-secondary" id="print-report">Print / Save PDF</button><button class="btn btn-primary" id="export-report">⇩ Export CSV</button>')}
      <div class="filter-bar"><div class="filter-item"><select id="report-type"><option value="production">Production Items</option><option value="projects">Project Summary</option><option value="stage">Stage Summary</option><option value="delay">Delay Report</option><option value="shortage">Shortage Report</option></select></div><div class="filter-item"><select id="report-project"><option value="">All projects</option>${assignedProjects().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="filter-item"><input id="report-from" type="date"></div><div class="filter-item"><input id="report-to" type="date"></div><button class="btn btn-secondary" id="run-report">Run Report</button></div><section class="card table-card"><div class="card-header"><div><h3 id="report-title">Production Items Report</h3><p id="report-subtitle">Generated ${fmtDate(nowISO(),true)}</p></div></div><div class="table-wrap" id="report-table"></div></section>`;
    const run=()=>renderReportTable();document.getElementById('run-report').onclick=run;document.getElementById('report-type').onchange=run;run();document.getElementById('print-report').onclick=()=>window.print();document.getElementById('export-report').onclick=exportCurrentReport;
  }
  function getReportData(){const type=document.getElementById('report-type').value,pid=document.getElementById('report-project').value,allowed=new Set(assignedProjects().map(p=>p.id));if(type==='projects')return{title:'Project Summary Report',headers:['Project Code','Project Name','Client','Site','Job Number','Manager','Target Date','Completion %','Status'],rows:assignedProjects().filter(p=>!pid||p.id===pid).map(p=>[p.code,p.name,p.client,p.site,p.jobNumber,userById(p.managerId)?.name||'',p.targetDate,projectCompletion(p.id),p.status])};if(type==='stage')return{title:'Stage-wise Production Report',headers:['Stage','Item Count','Total Quantity','Delayed Items'],rows:STAGES.map((s,idx)=>{const arr=visibleItems().filter(i=>(!pid||i.projectId===pid)&&i.currentStage===idx);return[s,arr.length,arr.reduce((a,i)=>a+number(i.quantity),0),arr.filter(i=>i.status==='Delayed').length]})};if(type==='delay'){const items=visibleItems().filter(i=>(!pid||i.projectId===pid)&&(i.status==='Delayed'||projectById(i.projectId)?.status==='Delayed'));return{title:'Production Delay Report',headers:['Project','Item','BOM','Current Stage','Quantity','Shortage / Reason','Updated'],rows:items.map(i=>[projectById(i.projectId)?.name,i.itemName,i.bomNumber,STAGES[i.currentStage],i.quantity,i.shortages||i.remarks||'Delayed',i.updatedAt])};}if(type==='shortage'){const rows=state.shortages.filter(s=>allowed.has(s.projectId)&&(!pid||s.projectId===pid));return{title:'Material Shortage Report',headers:['Project','Item','Material','Required','Available','Shortage','UOM','Severity','Status','Remarks'],rows:rows.map(s=>[projectById(s.projectId)?.name,itemById(s.itemId)?.itemName||'',s.material,s.requiredQty,s.availableQty,s.shortageQty,s.uom,s.severity,s.status,s.remarks])};}const items=visibleItems().filter(i=>!pid||i.projectId===pid);return{title:'Production Items Report',headers:['Project','Item','Site','BOM Number','Job Number','Quantity','Current Stage','Progress %','Status','Updated'],rows:items.map(i=>[projectById(i.projectId)?.name,i.itemName,i.site,i.bomNumber,i.jobNumber,i.quantity,STAGES[i.currentStage],completionPercent(i),i.approvalStatus==='SUBMITTED'?'Submitted':i.status,i.updatedAt])};}
  function renderReportTable(){const d=getReportData();document.getElementById('report-title').textContent=d.title;document.getElementById('report-table').innerHTML=d.rows.length?`<table><thead><tr>${d.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v??'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`:emptyState('▤','No report data','Adjust filters or import records first.');}
  function exportCurrentReport(){const d=getReportData(),csv=[d.headers.map(csvCell).join(','),...d.rows.map(r=>r.map(csvCell).join(','))].join('\n');downloadBlob('\uFEFF'+csv,`${d.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`,'text/csv;charset=utf-8');audit('EXPORT','Reports',`Exported ${d.title}`);saveState();toast('Report exported');}

  function renderUsers() {
    if (!requireRole('ADMIN')) return;
    setPageTitle('User Management','Secure invitations and role management');
    const current = getCurrentUser(), users = state.users;
    const page = document.getElementById('page-content');
    page.innerHTML = `${pageToolbar('User Management','Create Managers and Executives. New users receive a secure Set Password email.','<button class="btn btn-primary" id="add-user">+ Invite User</button>')}
      <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Assigned Projects</th><th>Status</th><th>Invited / Created</th><th>Action</th></tr></thead><tbody>${users.length ? users.map(u => `<tr><td><div class="input-row"><div class="avatar">${initials(u.name)}</div><div><strong>${esc(u.name)}</strong><div class="small muted">${esc(u.id)}</div></div></div></td><td>${esc(u.email)}</td><td><span class="role-chip">${esc(roleLabel(u.role))}</span></td><td>${state.projects.filter(p=>p.managerId===u.id||(p.executiveIds||[]).includes(u.id)).length}</td><td>${statusChip(u.status)}</td><td>${fmtDate(u.invitedAt || u.createdAt)}</td><td>${u.role === 'ADMIN' ? '<span class="small muted">Protected Admin</span>' : `<div class="table-actions"><button class="btn btn-secondary btn-sm" data-edit-user="${u.id}">Edit</button>${u.id !== current.id ? `<button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Delete</button>` : ''}</div>`}</td></tr>`).join('') : `<tr><td colspan="7">${emptyState('♙','No users available','Invite a Manager or Executive to begin.')}</td></tr>`}</tbody></table></div></section>`;
    document.getElementById('add-user').onclick = () => openUserForm();
    document.querySelectorAll('[data-edit-user]').forEach(b => b.onclick = () => openUserForm(userById(b.dataset.editUser)));
    document.querySelectorAll('[data-delete-user]').forEach(b => b.onclick = () => deleteUser(b.dataset.deleteUser));
  }

  function openUserForm(user = null) {
    if (!requireRole('ADMIN')) return;
    const roles = ['MANAGER','EXECUTIVE'];
    openModal(user ? 'Edit User' : 'Invite New User', `<form id="user-form"><div class="form-grid"><div class="form-group"><label>Full Name *</label><input name="name" required value="${esc(user?.name || '')}"></div><div class="form-group"><label>Email Address *</label><input name="email" type="email" required value="${esc(user?.email || '')}" ${user ? 'readonly' : ''}></div><div class="form-group"><label>Role *</label><select name="role">${roles.map(r => `<option value="${r}" ${user?.role === r ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select></div>${user ? `<div class="form-group"><label>Status</label><select name="status"><option value="ACTIVE" ${user.status === 'Active' ? 'selected' : ''}>Active</option><option value="INACTIVE" ${user.status === 'Inactive' ? 'selected' : ''}>Inactive</option><option value="INVITED" ${user.status === 'Invited' ? 'selected' : ''}>Invited</option></select></div>` : ''}</div>${user ? '' : '<div class="info-banner"><div>✉</div><div><strong>No password is required</strong><p>The user will receive a secure invitation email and create their own password.</p></div></div>'}</form>`, `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="save-user">${user ? 'Save Changes' : 'Send Invitation'}</button>`);
    document.getElementById('save-user').onclick = async () => {
      const form = document.getElementById('user-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form), fullName = String(fd.get('name')).trim(), email = String(fd.get('email')).trim().toLowerCase(), role = String(fd.get('role'));
      if (!roles.includes(role)) return toast('Invalid role','Only Manager or Executive can be invited.','error');
      setFormBusy(form, true);
      try {
        if (user) {
          await callAuthAdmin('update', { userId: user.id, fullName, role, status: String(fd.get('status')) });
          audit('UPDATE','Users',`Updated ${roleLabel(role)} ${fullName}`,user.id);
        } else {
          await callAuthAdmin('invite', { fullName, email, role });
          audit('INVITE','Users',`Invited ${roleLabel(role)} ${fullName}`);
        }
        await syncProfiles(); saveState(); closeModal(); renderUsers();
        toast(user ? 'User updated' : 'Invitation sent', user ? 'The user profile was updated.' : `A Set Password email was sent to ${email}.`);
      } catch (error) { toast(user ? 'Update failed' : 'Invitation failed', error.message, 'error'); }
      finally { setFormBusy(form, false); }
    };
  }

  async function deleteUser(id) {
    if (!requireRole('ADMIN')) return;
    const current = getCurrentUser(), target = userById(id); if (!target) return;
    if (target.id === current.id) return toast('Delete blocked','You cannot delete your own signed-in account.','error');
    if (!confirm(`Delete user ${target.name}? This also removes their Supabase login.`)) return;
    try {
      await callAuthAdmin('delete', { userId: id });
      state.projects.forEach(p => { if (p.managerId === id) p.managerId = ''; p.executiveIds = (p.executiveIds || []).filter(x => x !== id); });
      state.notifications = state.notifications.filter(n => n.userId !== id);
      audit('DELETE','Users',`Deleted ${roleLabel(target.role)} ${target.name}`,id);
      await syncProfiles(); saveState(); renderUsers(); toast('User deleted');
    } catch (error) { toast('Delete failed', error.message, 'error'); }
  }


  function renderAudit() {
    setPageTitle('Audit Logs','Traceability of user and data changes');
    const page=document.getElementById('page-content');page.innerHTML=`${pageToolbar('Audit Logs','Every important action performed in the ERP.','<button class="btn btn-secondary" id="export-audit">⇩ Export CSV</button>')}<div class="filter-bar"><div class="filter-item search-wide"><input id="audit-search" placeholder="Search user, action, module or details"></div><div class="filter-item"><select id="audit-module"><option value="">All modules</option>${[...new Set(state.audit.map(a=>a.module))].map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div><section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Date & Time</th><th>User</th><th>Action</th><th>Module</th><th>Details</th></tr></thead><tbody id="audit-body"></tbody></table></div></section>`;const draw=()=>{const q=document.getElementById('audit-search').value.toLowerCase(),m=document.getElementById('audit-module').value;const rows=state.audit.filter(a=>(!q||[a.userName,a.action,a.module,a.details].some(v=>String(v||'').toLowerCase().includes(q)))&&(!m||a.module===m));document.getElementById('audit-body').innerHTML=rows.length?rows.slice(0,500).map(a=>`<tr><td>${fmtDate(a.createdAt,true)}</td><td>${esc(a.userName)}</td><td><span class="role-chip">${esc(a.action)}</span></td><td>${esc(a.module)}</td><td>${esc(a.details)}</td></tr>`).join(''):`<tr><td colspan="5">${emptyState('◷','No audit records','Actions performed in the ERP will be tracked here.')}</td></tr>`;};draw();document.getElementById('audit-search').oninput=draw;document.getElementById('audit-module').onchange=draw;document.getElementById('export-audit').onclick=()=>{const csv=['Date,User,Action,Module,Details',...state.audit.map(a=>[a.createdAt,a.userName,a.action,a.module,a.details].map(csvCell).join(','))].join('\n');downloadBlob(csv,'factory-erp-audit-log.csv','text/csv');};
  }

  function renderSettings() {
    setPageTitle('Settings & Backup','Configuration and operational data protection');
    const page=document.getElementById('page-content');page.innerHTML=`${pageToolbar('System Settings','Configure the ERP and manage operational data backups.')}
      <div class="info-banner"><div>🔐</div><div><strong>Authentication is secured by Supabase</strong><p>Passwords, invitation links and reset links are managed by Supabase Auth. Operational records continue to use the existing browser-storage workflow.</p></div></div>
      <div class="grid grid-2"><section class="card"><div class="card-header"><div><h3>Company Configuration</h3><p>Branding and display preferences</p></div></div><div class="card-body"><form id="settings-form"><div class="form-group"><label>Company / ERP Name</label><input name="companyName" value="${esc(state.settings.companyName)}"></div><div class="form-group"><label>Factory Name</label><input name="factoryName" value="${esc(state.settings.factoryName)}"></div><div class="setting-row"><div class="setting-copy"><strong>Dark Mode</strong><span>Use dark industrial interface</span></div><button type="button" class="toggle ${state.settings.theme==='dark'?'on':''}" id="settings-theme"></button></div><button class="btn btn-primary" type="submit" style="margin-top:16px">Save Settings</button></form></div></section>
      <section class="card"><div class="card-header"><div><h3>Backup & Restore</h3><p>Protect browser-stored ERP records</p></div></div><div class="card-body"><div class="setting-row"><div class="setting-copy"><strong>Download Full Backup</strong><span>Projects, production history, shortages and settings</span></div><button class="btn btn-secondary" id="download-backup">⇩ Backup</button></div><div class="setting-row"><div class="setting-copy"><strong>Restore Backup</strong><span>Replace current browser data from a JSON file</span></div><button class="btn btn-secondary" id="restore-backup">⇧ Restore</button></div><div class="setting-row"><div class="setting-copy"><strong class="text-danger">Reset All Data</strong><span>Delete all ERP records from this browser</span></div><button class="btn btn-danger" id="reset-data">Reset</button></div></div></section></div>
      <section class="card" style="margin-top:18px"><div class="card-header"><div><h3>System Information</h3><p>Deployment characteristics</p></div></div><div class="card-body"><div class="grid grid-4">${miniMetric('Technology','HTML / CSS / JS')}${miniMetric('Authentication','Supabase Auth')}${miniMetric('Deployment','Netlify Functions')}${miniMetric('Version','6.0 Secure Invitations')}</div></div></section>`;
    document.getElementById('settings-form').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);state.settings.companyName=String(fd.get('companyName')||'Factory ERP');state.settings.factoryName=String(fd.get('factoryName')||'Main Manufacturing Unit');audit('UPDATE','Settings','Updated company configuration');saveState();renderAppShell();toast('Settings saved');};document.getElementById('settings-theme').onclick=toggleTheme;document.getElementById('download-backup').onclick=()=>downloadBlob(JSON.stringify(state,null,2),`factory-erp-backup-${todayISO()}.json`,'application/json');document.getElementById('restore-backup').onclick=()=>document.getElementById('backup-file-input').click();const backupInput=document.getElementById('backup-file-input');backupInput.value='';backupInput.onchange=async()=>{try{const data=JSON.parse(await backupInput.files[0].text());if(!data.projects||!data.items)throw new Error('Invalid backup format');if(!confirm('Restore this backup and replace current browser data?'))return;state={...defaultState(),...data,users:state.users};saveState();render();toast('Backup restored','Operational data was restored. Supabase users were not changed.');}catch(e){toast('Restore failed',e.message,'error');}};document.getElementById('reset-data').onclick=()=>{if(!confirm('This permanently deletes all local ERP data. Continue?'))return;if(!confirm('Final confirmation: delete everything?'))return;localStorage.removeItem(STORAGE_KEY);state={...defaultState(),users:state.users};saveState();render();};
  }

  function openModal(title, body, footer='', size='') {
    closeModal();const el=document.createElement('div');el.className='modal-backdrop';el.id='app-modal';el.innerHTML=`<div class="modal ${size}"><div class="modal-header"><h3>${esc(title)}</h3><button class="close-btn" data-close-modal>×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div>`;document.body.appendChild(el);el.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=closeModal);el.addEventListener('mousedown',e=>{if(e.target===el)closeModal();});
  }
  function closeModal(){document.getElementById('app-modal')?.remove();}

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  window.addEventListener('resize',()=>{if(authSession&&currentRoute==='dashboard'){clearTimeout(window.__chartTimer);window.__chartTimer=setTimeout(()=>renderDashboard(),150);}});

  initialiseAuthentication();
})();
