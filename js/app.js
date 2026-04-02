// ═════════════════════════════════════════════════════════════
// Utilitários globais
// ═════════════════════════════════════════════════════════════

const uid      = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtReal  = v  => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const fmtData  = d  => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const initials = n  => n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ═════════════════════════════════════════════════════════════
// Carregamento de dados — Firestore (paralelo, sem fallback)
// ═════════════════════════════════════════════════════════════

async function carregarTodosDados() {
  try {
    const [alunosSnap, aulasSnap, configSnap] = await Promise.all([
      db.collection('alunos').get(),
      db.collection('aulas').get(),
      db.collection('config').doc('settings').get(),
    ]);

    setAlunos(alunosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setAulas(aulasSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    if (configSnap.exists) {
      const c = configSnap.data();
      _config = { valorHora: c.valorHora ?? 15, valorTransp: c.valorTransp ?? 0 };
      _senha  = c.senha ?? '';
    } else {
      _config = { valorHora: 15, valorTransp: 0 };
      _senha  = '';
    }
  } catch (e) {
    console.error('[carregarTodosDados]', e);
    setAlunos([]);
    setAulas([]);
  }
}

// ═════════════════════════════════════════════════════════════
// Autenticação
// ═════════════════════════════════════════════════════════════

function doLogin() {
  const elPasswordInput = document.getElementById('password-input');
  const elLoginScreen   = document.getElementById('login-screen');
  const elApp           = document.getElementById('app');
  const elLoginError    = document.getElementById('login-error');

  if (elPasswordInput.value === getPass()) {
    elLoginScreen.style.display = 'none';
    elApp.style.display         = 'block';
    initApp();
  } else {
    elLoginError.style.display = 'block';
    elPasswordInput.value      = '';
  }
}

function doLogout() {
  const elPasswordInput = document.getElementById('password-input');
  const elLoginScreen   = document.getElementById('login-screen');
  const elApp           = document.getElementById('app');
  const elLoginError    = document.getElementById('login-error');

  elApp.style.display         = 'none';
  elLoginScreen.style.display = 'flex';
  elPasswordInput.value       = '';
  elLoginError.style.display  = 'none';
}

// ═════════════════════════════════════════════════════════════
// Inicialização da aplicação
// ═════════════════════════════════════════════════════════════

let chartHoras = null, chartReceita = null;

async function boot() {
  await carregarTodosDados();
  document.getElementById('loading-overlay').style.display = 'none';
  document.getElementById('login-screen').style.display    = 'flex';
}

function initApp() {
  setGreeting();
  renderDashboard();
  renderAlunos();
  renderTabelaAulas();
  renderPagamentos();
  renderRelatorios();
  loadConfig();
  populateFiltroAlunos();

  // Sincroniza estado ativo do menu flutuante mobile
  document.querySelectorAll('.float-nav-item[data-page]').forEach(n => n.classList.remove('active'));
  const initFloat = document.querySelector('.float-nav-item[data-page="dashboard"]');
  if (initFloat) initFloat.classList.add('active');
}

function setGreeting() {
  const h  = new Date().getHours();
  const gr = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('dash-greeting').innerHTML = `${gr}, <span class="name-highlight">Kimbelly</span>`;
  document.getElementById('dash-date').textContent   = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ═════════════════════════════════════════════════════════════
// Navegação entre páginas
// ═════════════════════════════════════════════════════════════

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  document.querySelectorAll('.float-nav-item[data-page]').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });

  document.getElementById('page-' + name).classList.add('active');

  const sidebarItem = document.querySelector(`.nav-item[data-page="${name}"]`);
  if (sidebarItem) { sidebarItem.classList.add('active'); sidebarItem.setAttribute('aria-current', 'page'); }

  const floatItem = document.querySelector(`.float-nav-item[data-page="${name}"]`);
  if (floatItem)  { floatItem.classList.add('active');   floatItem.setAttribute('aria-current', 'page');   }

  const renders = {
    dashboard:   renderDashboard,
    aulas:       () => { populateFiltroAlunos(); renderTabelaAulas(); },
    pagamentos:  renderPagamentos,
    relatorios:  renderRelatorios,
    alunos:      renderAlunos,
  };
  renders[name]?.();
}

// ── Menu flutuante mobile ──────────────────────────────────

function toggleFloatMenu() {
  const elFloatPanel = document.getElementById('float-menu-panel');
  const elFloatBtn   = document.getElementById('float-menu-btn');
  const isOpen = elFloatPanel.classList.toggle('open');
  elFloatBtn.classList.toggle('menu-open', isOpen);
  elFloatBtn.setAttribute('aria-expanded', String(isOpen));
  elFloatBtn.setAttribute('aria-label', isOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
}

function floatNav(name) {
  const elFloatPanel = document.getElementById('float-menu-panel');
  const elFloatBtn   = document.getElementById('float-menu-btn');
  elFloatPanel.classList.remove('open');
  elFloatBtn.classList.remove('menu-open');
  elFloatBtn.setAttribute('aria-expanded', 'false');
  showPage(name);
}

// ═════════════════════════════════════════════════════════════
// Dashboard
// ═════════════════════════════════════════════════════════════

function renderDashboard() {
  const alunos  = getAlunos();
  const aulas   = getAulas();
  const totalR  = aulas.reduce((s, a) => s + Number(a.total), 0);
  const totalH  = aulas.reduce((s, a) => s + Number(a.horas), 0);

  // Calcula stats por aluno uma única vez para alimentar cards e gráficos
  const statsMap  = Object.fromEntries(alunos.map(a => [a.id, computeAlunoStats(a.id)]));
  const totalPago = alunos.reduce((s, a) => s + statsMap[a.id].pago, 0);

  document.getElementById('summary-grid').innerHTML = `
    <div class="glass-card summary-card accent-card">
      <div class="label">Total do Mês</div>
      <div class="value">${fmtReal(totalR)}</div>
      <div class="sub">${alunos.length} alunos ativos</div>
    </div>
    <div class="glass-card summary-card">
      <div class="label">Horas Dadas</div>
      <div class="value">${totalH.toFixed(1).replace('.', ',')}h</div>
      <div class="sub">${aulas.length} aulas registradas</div>
    </div>
    <div class="glass-card summary-card">
      <div class="label">Recebido</div>
      <div class="value" style="color:var(--success)">${fmtReal(totalPago)}</div>
      <div class="sub">de ${fmtReal(totalR)} total</div>
    </div>
    <div class="glass-card summary-card">
      <div class="label">A Receber</div>
      <div class="value" style="color:var(--accent)">${fmtReal(Math.max(0, totalR - totalPago))}</div>
      <div class="sub">pendente</div>
    </div>`;

  const labels  = alunos.map(a => a.nome.split(' ')[0]);
  const horas   = alunos.map(a => statsMap[a.id].horas);
  const receita = alunos.map(a => statsMap[a.id].valor);
  const pal     = ['#b06cda', '#e0609a', '#da9ce0', '#6ca8e0', '#7edabd'];

  if (chartHoras)   chartHoras.destroy();
  if (chartReceita) chartReceita.destroy();

  Chart.defaults.color       = 'rgba(220,190,240,0.6)';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

  chartHoras = new Chart(document.getElementById('chart-horas'), {
    type: 'bar',
    data: { labels, datasets: [{ data: horas, backgroundColor: pal, borderRadius: 8 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(220,190,240,0.5)' } },
        x: { grid: { display: false }, ticks: { color: 'rgba(220,190,240,0.5)' } },
      },
      responsive: true, maintainAspectRatio: false,
    },
  });

  chartReceita = new Chart(document.getElementById('chart-receita'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: receita, backgroundColor: pal, borderWidth: 0 }] },
    options: {
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, color: 'rgba(220,190,240,0.7)' } } },
      responsive: true, maintainAspectRatio: false, cutout: '65%',
    },
  });
}

// ═════════════════════════════════════════════════════════════
// Modais
// ═════════════════════════════════════════════════════════════

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}

// ═════════════════════════════════════════════════════════════
// Modal de confirmação customizado
// ═════════════════════════════════════════════════════════════

function showConfirm({ title, msg, onConfirm }) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-overlay').classList.add('open');

  // Clona botões para eliminar listeners acumulados de chamadas anteriores
  const okBtn     = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  const newOk     = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  cancelBtn.replaceWith(newCancel);

  const close = () => document.getElementById('confirm-overlay').classList.remove('open');
  newOk.addEventListener('click',     () => { close(); onConfirm(); });
  newCancel.addEventListener('click', close);
}

// ═════════════════════════════════════════════════════════════
// Toast de feedback
// ═════════════════════════════════════════════════════════════

let toastTimer;

function showToast(msg, type = '') {
  const elToast = document.getElementById('toast');
  elToast.textContent = msg;
  elToast.className   = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elToast.className = ''; }, 3200);
}

// ═════════════════════════════════════════════════════════════
// Estado de loading em botões
// ═════════════════════════════════════════════════════════════

function setLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.loading      = 'true';
    btn.dataset.originalText = btn.textContent;
  } else {
    delete btn.dataset.loading;
  }
}

// ═════════════════════════════════════════════════════════════
// Bootstrap 
// ═════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  console.log('[app.js] DOMContentLoaded — iniciando boot()');

  // ── Monitoramento de conexão ──────────────────────────────
  const elOfflineBanner = document.getElementById('offline-banner');
  window.addEventListener('online',  () => elOfflineBanner.classList.remove('visible'));
  window.addEventListener('offline', () => elOfflineBanner.classList.add('visible'));
  if (!navigator.onLine) elOfflineBanner.classList.add('visible');

  // ── Fecha modal ao clicar no overlay ─────────────────────
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.setAttribute('aria-hidden', 'true');
    el.addEventListener('click', e => {
      if (e.target === el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
    });
  });

  // ── Enter no campo de senha dispara login ─────────────────
  document.getElementById('password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // ── Delegação de eventos — alunos ────────────────────────
  document.getElementById('alunos-grid').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-aluno]');
    const delBtn  = e.target.closest('[data-del-aluno]');
    if (editBtn) editAluno(editBtn.getAttribute('data-edit-aluno'));
    if (delBtn)  delAluno(delBtn.getAttribute('data-del-aluno'));
  });

  // ── Delegação de eventos — aulas ─────────────────────────
  document.getElementById('tabela-aulas-body').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-aula]');
    const delBtn  = e.target.closest('[data-del-aula]');
    if (editBtn) editAula(editBtn.getAttribute('data-edit-aula'));
    if (delBtn)  delAula(delBtn.getAttribute('data-del-aula'));
  });

  // ── Delegação de eventos — histórico de pagamentos ───────
  document.getElementById('pag-historico-lista').addEventListener('click', e => {
    const btn = e.target.closest('[data-delpag]');
    if (!btn) return;
    const [alunoId, pagId] = btn.getAttribute('data-delpag').split('|');
    excluirPagamento(alunoId, pagId);
  });

  // ── Recalcula total ao alterar campos do modal de aula ───
  document.getElementById('aula-aluno-id').addEventListener('change', calcTotal);
  document.getElementById('aula-horas').addEventListener('input',    calcTotal);
  document.getElementById('aula-transporte').addEventListener('change', calcTotal);

  // ── Fecha menu flutuante ao clicar fora ──────────────────
  document.addEventListener('click', e => {
    const elFloatPanel = document.getElementById('float-menu-panel');
    const elFloatBtn   = document.getElementById('float-menu-btn');
    if (!elFloatPanel.contains(e.target) && !elFloatBtn.contains(e.target)) {
      elFloatPanel.classList.remove('open');
      elFloatBtn.classList.remove('menu-open');
      elFloatBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // ── Inicia a aplicação ────────────────────────────────────
  boot();
});
