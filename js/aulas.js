// ═════════════════════════════════════════════════════════════
// Estado local — cache de aulas
// ═════════════════════════════════════════════════════════════

let _aulas = [];

const getAulas        = ()  => _aulas;
const setAulas        = arr => { _aulas = arr; };
const getAulasByAluno = id  => _aulas.filter(a => a.alunoId === id);

// ═════════════════════════════════════════════════════════════
// CRUD — Firestore / Aulas
// ═════════════════════════════════════════════════════════════

async function fsAddAula(aula) {
  if (!aula?.id) throw new Error('ID inválido');
  const { id, ...data } = aula;
  await db.collection('aulas').doc(id).set(data);
  _aulas.push(aula);
}

async function fsUpdateAula(aula) {
  if (!aula?.id) throw new Error('ID inválido');
  const { id, ...data } = aula;
  await db.collection('aulas').doc(id).set(data);
  const idx = _aulas.findIndex(a => a.id === id);
  if (idx >= 0) _aulas[idx] = aula;
}

async function fsDeleteAula(id) {
  if (!id) throw new Error('ID inválido');
  await db.collection('aulas').doc(id).delete();
  _aulas = _aulas.filter(a => a.id !== id);
}

// ═════════════════════════════════════════════════════════════
// Filtros — seletor de alunos
// ═════════════════════════════════════════════════════════════

function populateFiltroAlunos() {
  const alunos = getAlunos();
  const sel    = document.getElementById('filtro-aluno-aulas');
  const cur    = sel.value;

  sel.innerHTML =
    '<option value="">Todos os alunos</option>' +
    alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
  sel.value = cur;

  document.getElementById('aula-aluno-id').innerHTML =
    alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
}

function limparFiltros() {
  document.getElementById('filtro-aluno-aulas').value = '';
  document.getElementById('filtro-data-de').value     = '';
  document.getElementById('filtro-data-ate').value    = '';
  renderTabelaAulas();
}

// Recalcula o total da aula com base no aluno, horas e transporte selecionados
function calcTotal() {
  const alunoId = document.getElementById('aula-aluno-id').value;
  const horas   = parseFloat(document.getElementById('aula-horas').value) || 0;
  const transp  = document.getElementById('aula-transporte').value;
  const aluno   = getAlunoById(alunoId);
  const valorH  = aluno.valorHora  || getConfig().valorHora  || 15;
  const valorT  = transp === 'SIM' ? (aluno.valorTransp || getConfig().valorTransp || 0) : 0;
  document.getElementById('aula-total').value = (horas * valorH + valorT).toFixed(2);
}

// ═════════════════════════════════════════════════════════════
// Renderização — tabela de aulas
// ═════════════════════════════════════════════════════════════

function renderTabelaAulas() {
  const filtroAluno = document.getElementById('filtro-aluno-aulas').value;
  const filtroDe    = document.getElementById('filtro-data-de').value;
  const filtroAte   = document.getElementById('filtro-data-ate').value;

  const aulas = getAulas()
    .filter(a => {
      if (filtroAluno && a.alunoId !== filtroAluno) return false;
      if (filtroDe    && a.data < filtroDe)         return false;
      if (filtroAte   && a.data > filtroAte)         return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  const tbody = document.getElementById('tabela-aulas-body');

  if (!aulas.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px 32px;color:var(--text2)">Nenhuma aula encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = aulas.map(a => {
    const aluno       = getAlunoById(a.alunoId);
    const transpClass = a.transporte === 'SIM' ? 'badge-transp-sim' : 'badge-transp-nao';
    return `
      <tr>
        <td>${fmtData(a.data)}</td>
        <td>${aluno.nome || '—'}</td>
        <td>${Number(a.horas).toFixed(1).replace('.', ',')}h</td>
        <td><span class="status-badge ${transpClass}">${a.transporte === 'SIM' ? 'Sim' : 'Não'}</span></td>
        <td style="font-weight:600">${fmtReal(a.total)}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm btn-icon" data-edit-aula="${a.id}" aria-label="Editar aula">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" data-del-aula="${a.id}" aria-label="Excluir aula">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════
// Modal — Aula
// ═════════════════════════════════════════════════════════════

function openModalAula() {
  document.getElementById('aula-edit-id').value           = '';
  document.getElementById('modal-aula-title').textContent = 'Nova Aula';
  document.getElementById('aula-data').value              = new Date().toISOString().split('T')[0];
  document.getElementById('aula-horas').value             = '';
  document.getElementById('aula-transporte').value        = 'NAO';
  document.getElementById('aula-total').value             = '';
  populateFiltroAlunos();
  openModal('modal-aula');
}

function editAula(id) {
  const a = getAulas().find(x => x.id === id);
  if (!a) return;
  populateFiltroAlunos();
  document.getElementById('aula-edit-id').value           = id;
  document.getElementById('modal-aula-title').textContent = 'Editar Aula';
  document.getElementById('aula-aluno-id').value          = a.alunoId;
  document.getElementById('aula-data').value              = a.data;
  document.getElementById('aula-horas').value             = a.horas;
  document.getElementById('aula-transporte').value        = a.transporte;
  document.getElementById('aula-total').value             = a.total;
  openModal('modal-aula');
}

async function salvarAula() {
  const alunoId = document.getElementById('aula-aluno-id').value;
  const data    = document.getElementById('aula-data').value;
  const horas   = parseFloat(document.getElementById('aula-horas').value);
  const transp  = document.getElementById('aula-transporte').value;
  const total   = parseFloat(document.getElementById('aula-total').value) || 0;
  const editId  = document.getElementById('aula-edit-id').value;

  if (!alunoId || !data || !horas || horas <= 0) {
    showToast('Preencha todos os campos corretamente', 'error');
    return;
  }

  const saveBtn = document.querySelector('#modal-aula .btn-accent');
  setLoading(saveBtn, true);

  try {
    if (editId) {
      const existing = _aulas.find(a => a.id === editId) || {};
      await fsUpdateAula({ ...existing, alunoId, data, horas, transporte: transp, total });
    } else {
      await fsAddAula({ id: uid(), alunoId, data, horas, transporte: transp, total });
    }
    renderTabelaAulas();
    renderDashboard();
    renderAlunos();
    renderPagamentos();
    closeModal('modal-aula');
    showToast('Aula salva!', 'success');
  } catch (e) {
    showToast('Erro ao salvar aula', 'error');
    console.error(e);
  } finally {
    setLoading(saveBtn, false);
  }
}

function delAula(id) {
  showConfirm({
    title: 'Excluir aula',
    msg:   'Remover este registro de aula? Esta ação não pode ser desfeita.',
    onConfirm: async () => {
      try {
        await fsDeleteAula(id);
        renderTabelaAulas();
        renderDashboard();
        renderAlunos();
        renderPagamentos();
        showToast('Aula excluída.', 'success');
      } catch (e) {
        showToast('Erro ao excluir aula', 'error');
        console.error(e);
      }
    },
  });
}
