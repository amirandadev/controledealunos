// ═════════════════════════════════════════════════════════════
// Estado local — cache de alunos
// ═════════════════════════════════════════════════════════════

let _alunos = [];

const getAlunos    = ()  => _alunos;
const getAlunoById = id  => _alunos.find(a => a.id === id) || {};
const setAlunos    = arr => { _alunos = arr; };

// ═════════════════════════════════════════════════════════════
// CRUD — Firestore / Alunos
// ═════════════════════════════════════════════════════════════

async function fsAddAluno(aluno) {
  if (!aluno?.id) throw new Error('ID inválido');
  const { id, ...data } = aluno;
  await db.collection('alunos').doc(id).set(data);
  _alunos.push(aluno);
}

async function fsUpdateAluno(aluno) {
  if (!aluno?.id) throw new Error('ID inválido');
  const { id, ...data } = aluno;
  await db.collection('alunos').doc(id).set(data);
  const idx = _alunos.findIndex(a => a.id === id);
  if (idx >= 0) _alunos[idx] = aluno;
}

async function fsDeleteAluno(id) {
  if (!id) throw new Error('ID inválido');
  await db.collection('alunos').doc(id).delete();
  _alunos = _alunos.filter(a => a.id !== id);
}

// ═════════════════════════════════════════════════════════════
// Renderização — grade de alunos
// ═════════════════════════════════════════════════════════════

function renderAlunos() {
  const alunos = getAlunos();
  const grid   = document.getElementById('alunos-grid');

  if (!alunos.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="7" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <p>Nenhum aluno cadastrado.</p>
      </div>`;
    return;
  }

  grid.innerHTML = alunos.map(a => {
    const { horas, valor } = computeAlunoStats(a.id);
    return `
      <div class="glass-card aluno-card">
        <div class="aluno-card-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="aluno-avatar">${initials(a.nome)}</div>
            <span class="aluno-name">${a.nome}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm btn-icon" data-edit-aluno="${a.id}" aria-label="Editar ${a.nome}">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" data-del-aluno="${a.id}" aria-label="Excluir ${a.nome}">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="aluno-stats">
          <div class="aluno-stat"><div class="stat-label">Horas</div><div class="stat-value">${horas.toFixed(1).replace('.', ',')}h</div></div>
          <div class="aluno-stat"><div class="stat-label">Total</div><div class="stat-value">${fmtReal(valor)}</div></div>
          <div class="aluno-stat"><div class="stat-label">Valor/h</div><div class="stat-value">R$ ${Number(a.valorHora).toFixed(2).replace('.', ',')}</div></div>
        </div>
      </div>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════
// Modal — Aluno
// ═════════════════════════════════════════════════════════════

function openModalAluno() {
  document.getElementById('aluno-edit-id').value          = '';
  document.getElementById('modal-aluno-title').textContent = 'Novo Aluno';
  document.getElementById('aluno-nome').value             = '';
  const cfg = getConfig();
  document.getElementById('aluno-valor-hora').value = cfg.valorHora;
  document.getElementById('aluno-transp').value     = cfg.valorTransp;
  openModal('modal-aluno');
}

function editAluno(id) {
  const a = getAlunoById(id);
  document.getElementById('aluno-edit-id').value           = id;
  document.getElementById('modal-aluno-title').textContent = 'Editar Aluno';
  document.getElementById('aluno-nome').value              = a.nome;
  document.getElementById('aluno-valor-hora').value        = a.valorHora;
  document.getElementById('aluno-transp').value            = a.valorTransp || 0;
  openModal('modal-aluno');
}

async function salvarAluno() {
  const nome       = document.getElementById('aluno-nome').value.trim();
  const valorHora  = parseFloat(document.getElementById('aluno-valor-hora').value) || 15;
  const valorTransp= parseFloat(document.getElementById('aluno-transp').value) || 0;
  const editId     = document.getElementById('aluno-edit-id').value;

  if (!nome) { showToast('Informe o nome do aluno', 'error'); return; }

  try {
    if (editId) {
      const updated = { ...getAlunoById(editId), nome, valorHora, valorTransp };
      await fsUpdateAluno(updated);
    } else {
      await fsAddAluno({ id: uid(), nome, valorHora, valorTransp, pagamentos: [] });
    }
    renderAlunos();
    populateFiltroAlunos();
    renderPagamentos();
    renderRelatorios();
    closeModal('modal-aluno');
    showToast('Aluno salvo!', 'success');
  } catch (e) {
    showToast('Erro ao salvar aluno', 'error');
    console.error(e);
  }
}

function delAluno(id) {
  const aluno = getAlunoById(id);
  showConfirm({
    title: 'Excluir aluno',
    msg:   `Excluir "${aluno.nome}" e todas as suas aulas? Esta ação não pode ser desfeita.`,
    onConfirm: async () => {
      try {
        const aulasDoAluno = getAulasByAluno(id);
        const batch        = db.batch();
        aulasDoAluno.forEach(a => batch.delete(db.collection('aulas').doc(a.id)));
        batch.delete(db.collection('alunos').doc(id));
        await batch.commit();
        _alunos = _alunos.filter(a => a.id !== id);
        setAulas(getAulas().filter(a => a.alunoId !== id));
        renderAlunos();
        renderTabelaAulas();
        populateFiltroAlunos();
        renderPagamentos();
        renderRelatorios();
        renderDashboard();
        showToast('Aluno excluído.', 'success');
      } catch (e) {
        showToast('Erro ao excluir aluno', 'error');
        console.error(e);
      }
    },
  });
}
