// ═════════════════════════════════════════════════════════════
// Estado local — configuração e autenticação
// ═════════════════════════════════════════════════════════════

let _config = { valorHora: 15, valorTransp: 0 };
let _senha  = '';

const getConfig = () => _config;
const getPass   = () => _senha;

// ═════════════════════════════════════════════════════════════
// CRUD — Firestore / Configurações
// ═════════════════════════════════════════════════════════════

async function fsSaveConfig(cfg) {
  _config = cfg;
  await db.collection('config').doc('settings').set({ ..._config, senha: _senha }, { merge: true });
}

async function fsSaveSenha(novaSenha) {
  _senha = novaSenha;
  await db.collection('config').doc('settings').set({ senha: _senha }, { merge: true });
}

// ═════════════════════════════════════════════════════════════
// Cálculos financeiros por aluno
// ═════════════════════════════════════════════════════════════

const totalHorasAluno = id => getAulasByAluno(id).reduce((s, a) => s + Number(a.horas), 0);
const totalValorAluno = id => getAulasByAluno(id).reduce((s, a) => s + Number(a.total), 0);
const totalPagoAluno  = id => {
  const al = getAlunoById(id);
  return (al.pagamentos || []).reduce((s, p) => s + Number(p.valor), 0);
};

/*
 * computeAlunoStats — agrega horas, valor e pagamentos de um aluno
 * em passagem única pelos arrays, evitando múltiplos .filter/.reduce
 * redundantes durante a renderização de várias seções da UI.
 */
function computeAlunoStats(alunoId) {
  const aulas = getAulasByAluno(alunoId);
  let horas = 0, valor = 0;
  for (const a of aulas) {
    horas += Number(a.horas);
    valor += Number(a.total);
  }
  const aluno = getAlunoById(alunoId);
  const pago  = (aluno.pagamentos || []).reduce((s, p) => s + Number(p.valor), 0);
  return { horas, valor, pago, saldo: Math.max(0, valor - pago), naulas: aulas.length };
}

/*
 * buildStatusInfo — resolve badge, label e cor de saldo
 * a partir dos valores calculados, centralizando a lógica de status
 * usada em renderPagamentos, renderAlunos e abrirModalPagamento.
 */
function buildStatusInfo(valor, pago, saldo) {
  if (saldo <= 0 && valor > 0) return { badgeClass: 'badge-pago',     label: 'Pago',     saldoColor: 'var(--success)' };
  if (pago > 0)                return { badgeClass: 'badge-parcial',  label: 'Parcial',  saldoColor: 'var(--accent)'  };
  return                              { badgeClass: 'badge-pendente', label: 'Pendente', saldoColor: 'var(--accent)'  };
}

// ═════════════════════════════════════════════════════════════
// Renderização — grade de pagamentos
// ═════════════════════════════════════════════════════════════

function renderPagamentos() {
  const alunos = getAlunos();
  const grid   = document.getElementById('pagamentos-grid');

  if (!alunos.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <p>Nenhum aluno cadastrado.</p>
      </div>`;
    return;
  }

  grid.innerHTML = alunos.map(a => {
    const { valor: total, pago, saldo } = computeAlunoStats(a.id);
    const { badgeClass, label, saldoColor } = buildStatusInfo(total, pago, saldo);
    const hist = (a.pagamentos || []).slice(-3).reverse().map(p =>
      `<div class="pag-hist-item">
        <span style="color:var(--text2)">${fmtData(p.data)}${p.obs ? ` · <span style="opacity:0.7">${p.obs}</span>` : ''}</span>
        <span style="color:var(--success);font-weight:600">${fmtReal(p.valor)}</span>
      </div>`
    ).join('') || `<div style="font-size:0.8rem;color:var(--text2);padding:6px 0">Nenhum pagamento registrado ainda</div>`;

    return `
      <div class="glass-card aluno-card">
        <div class="aluno-card-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="aluno-avatar">${initials(a.nome)}</div>
            <div>
              <div class="aluno-name">${a.nome}</div>
              <span class="status-badge ${badgeClass}">${label}</span>
            </div>
          </div>
        </div>
        <div class="aluno-stats" style="margin-bottom:16px">
          <div class="aluno-stat"><div class="stat-label">Total</div><div class="stat-value">${fmtReal(total)}</div></div>
          <div class="aluno-stat"><div class="stat-label">Pago</div><div class="stat-value" style="color:var(--success)">${fmtReal(pago)}</div></div>
          <div class="aluno-stat"><div class="stat-label">Saldo</div><div class="stat-value" style="color:${saldoColor}">${fmtReal(Math.max(0, saldo))}</div></div>
        </div>
        <div style="margin-bottom:14px">${hist}</div>
        <button class="btn btn-accent" style="width:100%;justify-content:center" onclick="abrirModalPagamento('${a.id}')">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar Pagamento
        </button>
      </div>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════
// Modal — Pagamento
// ═════════════════════════════════════════════════════════════

function abrirModalPagamento(alunoId) {
  const aluno = getAlunoById(alunoId);
  const { valor: total, pago, saldo } = computeAlunoStats(alunoId);

  document.getElementById('pag-aluno-id').value          = alunoId;
  document.getElementById('modal-pag-title').textContent = `Pagamento · ${aluno.nome}`;
  document.getElementById('pag-info-total').textContent  = fmtReal(total);
  document.getElementById('pag-info-pago').textContent   = fmtReal(pago);
  document.getElementById('pag-info-saldo').textContent  = fmtReal(saldo);
  document.getElementById('pag-data').value              = new Date().toISOString().split('T')[0];
  document.getElementById('pag-valor').value             = saldo > 0 ? saldo.toFixed(2) : '';
  document.getElementById('pag-obs').value               = '';

  renderHistoricoPagamentos(alunoId);
  openModal('modal-pagamento');
}

function renderHistoricoPagamentos(alunoId) {
  const aluno = getAlunoById(alunoId);
  const pags  = (aluno.pagamentos || []).slice().reverse();
  const lista = document.getElementById('pag-historico-lista');

  if (!pags.length) {
    lista.innerHTML = '<div style="font-size:0.8rem;color:var(--text2);padding:4px 0">Nenhum pagamento ainda</div>';
    return;
  }

  lista.innerHTML = pags.map(p =>
    `<div class="pag-hist-item">
      <div>
        <span style="font-weight:600">${fmtData(p.data)}</span>
        ${p.obs ? `<span style="color:var(--text2);font-size:0.78rem"> · ${p.obs}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:var(--success);font-weight:600">${fmtReal(p.valor)}</span>
        <button class="pag-del-btn" data-delpag="${alunoId}|${p.id}" aria-label="Excluir pagamento">
          <svg viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>`
  ).join('');
}

async function confirmarPagamento() {
  const alunoId  = document.getElementById('pag-aluno-id').value;
  const data     = document.getElementById('pag-data').value;
  const valorStr = document.getElementById('pag-valor').value;
  const obs      = document.getElementById('pag-obs').value.trim();

  if (!data) { showToast('Selecione a data', 'error'); return; }
  const valor = parseFloat(String(valorStr).replace(',', '.'));
  if (isNaN(valor) || valor <= 0) { showToast('Informe um valor válido', 'error'); return; }

  const saveBtn = document.querySelector('#modal-pagamento .btn-accent');
  setLoading(saveBtn, true);

  try {
    const aluno      = getAlunoById(alunoId);
    const pagamentos = [...(aluno.pagamentos || []), { id: uid(), data, valor, obs }];
    await fsUpdateAluno({ ...aluno, pagamentos });

    const { valor: total, pago, saldo } = computeAlunoStats(alunoId);
    document.getElementById('pag-info-pago').textContent  = fmtReal(pago);
    document.getElementById('pag-info-saldo').textContent = fmtReal(saldo);
    document.getElementById('pag-valor').value            = saldo > 0 ? saldo.toFixed(2) : '';
    document.getElementById('pag-obs').value              = '';

    renderHistoricoPagamentos(alunoId);
    renderPagamentos();
    renderDashboard();
    showToast(`${fmtReal(valor)} registrado com sucesso!`, 'success');
  } catch (e) {
    showToast('Erro ao registrar pagamento', 'error');
    console.error(e);
  } finally {
    setLoading(saveBtn, false);
  }
}

function excluirPagamento(alunoId, pagId) {
  showConfirm({
    title: 'Excluir pagamento',
    msg:   'Remover este registro de pagamento? Esta ação não pode ser desfeita.',
    onConfirm: async () => {
      try {
        const aluno      = getAlunoById(alunoId);
        const pagamentos = (aluno.pagamentos || []).filter(p => p.id !== pagId);
        await fsUpdateAluno({ ...aluno, pagamentos });

        const { pago, saldo } = computeAlunoStats(alunoId);
        document.getElementById('pag-info-pago').textContent  = fmtReal(pago);
        document.getElementById('pag-info-saldo').textContent = fmtReal(saldo);

        renderHistoricoPagamentos(alunoId);
        renderPagamentos();
        renderDashboard();
        showToast('Pagamento excluído.', 'success');
      } catch (e) {
        showToast('Erro ao excluir pagamento', 'error');
        console.error(e);
      }
    },
  });
}

// ═════════════════════════════════════════════════════════════
// Renderização — grade de relatórios
// ═════════════════════════════════════════════════════════════

function renderRelatorios() {
  const alunos = getAlunos();
  const grid   = document.getElementById('relatorios-grid');

  if (!alunos.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        </div>
        <p>Nenhum aluno cadastrado.</p>
      </div>`;
    return;
  }

  grid.innerHTML = alunos.map(a => {
    const { horas, valor: total, naulas } = computeAlunoStats(a.id);
    return `
      <div class="glass-card aluno-card">
        <div class="aluno-card-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="aluno-avatar">${initials(a.nome)}</div>
            <div class="aluno-name">${a.nome}</div>
          </div>
        </div>
        <div class="aluno-stats" style="margin-bottom:16px">
          <div class="aluno-stat"><div class="stat-label">Aulas</div><div class="stat-value">${naulas}</div></div>
          <div class="aluno-stat"><div class="stat-label">Horas</div><div class="stat-value">${horas.toFixed(1).replace('.', ',')}h</div></div>
          <div class="aluno-stat"><div class="stat-label">Total</div><div class="stat-value">${fmtReal(total)}</div></div>
        </div>
        <button class="btn btn-accent" style="width:100%;justify-content:center" onclick="abrirModalPDF('${a.id}')">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
          Exportar PDF
        </button>
      </div>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════
// Modal — Exportação de PDF
// ═════════════════════════════════════════════════════════════

function abrirModalPDF(alunoId) {
  const aluno = getAlunoById(alunoId);
  document.getElementById('pdf-aluno-id').value          = alunoId;
  document.getElementById('modal-pdf-title').textContent = `Exportar · ${aluno.nome}`;
  document.getElementById('pdf-aluno-info').textContent  = `Aluno: ${aluno.nome} — escolha o período ou deixe em branco para todas as aulas.`;
  document.getElementById('pdf-data-de').value           = '';
  document.getElementById('pdf-data-ate').value          = '';
  openModal('modal-pdf');
}

function confirmarGerarPDF() {
  const alunoId = document.getElementById('pdf-aluno-id').value;
  const de      = document.getElementById('pdf-data-de').value;
  const ate     = document.getElementById('pdf-data-ate').value;
  closeModal('modal-pdf');
  gerarPDF(alunoId, de, ate);
}

// ═════════════════════════════════════════════════════════════
// Configurações — leitura e gravação
// ═════════════════════════════════════════════════════════════

function loadConfig() {
  const c = getConfig();
  document.getElementById('cfg-valor-hora').value   = c.valorHora  || 15;
  document.getElementById('cfg-valor-transp').value = c.valorTransp || 0;
}

async function salvarConfig() {
  const cfg = {
    valorHora:   parseFloat(document.getElementById('cfg-valor-hora').value)  || 15,
    valorTransp: parseFloat(document.getElementById('cfg-valor-transp').value) || 0,
  };
  try {
    await fsSaveConfig(cfg);
    showToast('Configurações salvas!', 'success');
  } catch (e) {
    showToast('Erro ao salvar configurações', 'error');
  }
}

async function alterarSenha() {
  const atual = document.getElementById('cfg-senha-atual').value;
  const nova  = document.getElementById('cfg-nova-senha').value;
  const conf  = document.getElementById('cfg-confirmar-senha').value;

  if (atual !== getPass())      { showToast('Senha atual incorreta', 'error'); return; }
  if (!nova || nova.length < 4) { showToast('Nova senha muito curta (mín. 4 caracteres)', 'error'); return; }
  if (nova !== conf)            { showToast('Senhas não conferem', 'error'); return; }

  try {
    await fsSaveSenha(nova);
    ['cfg-senha-atual', 'cfg-nova-senha', 'cfg-confirmar-senha'].forEach(id => {
      document.getElementById(id).value = '';
    });
    showToast('Senha alterada com sucesso!', 'success');
  } catch (e) {
    showToast('Erro ao alterar senha', 'error');
  }
}

// ═════════════════════════════════════════════════════════════
// Geração de PDF — Comprovante de Aulas
// Estrutura: Cabeçalho → Aluno → Cards de Resumo → Tabela → Bloco Final → Rodapé
// ═════════════════════════════════════════════════════════════

function gerarPDF(alunoId, filtroDe, filtroAte) {
  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ unit: 'mm', format: 'a4' });
  const aluno = getAlunoById(alunoId);

  if (!aluno || !aluno.nome) { showToast('Aluno não encontrado', 'error'); return; }

  let aulas = getAulasByAluno(alunoId).sort((a, b) => a.data.localeCompare(b.data));
  if (filtroDe)  aulas = aulas.filter(a => a.data >= filtroDe);
  if (filtroAte) aulas = aulas.filter(a => a.data <= filtroAte);

  const nAulas          = aulas.length;
  const totalV          = aulas.reduce((s, a) => s + Number(a.total || 0), 0);
  const totalTransporte = aulas
    .filter(a => a.transporte === 'SIM')
    .reduce((s, a) => s + Number(aluno.valorTransp || getConfig().valorTransp || 0), 0);
  const totalPago = totalPagoAluno(alunoId);
  const isPago    = totalV > 0 && totalPago >= totalV;
  const isParcial = totalPago > 0 && totalPago < totalV;

  // Paleta de cores do documento
  const C = {
    bg:        [255, 255, 255],
    roxo:      [100,  50, 160],
    roxoClaro: [150, 100, 205],
    verde:     [ 18, 148,  98],
    verdePale: [213, 248, 232],
    verdeText: [ 12, 110,  72],
    vermelho:  [200,  45,  60],
    vermPale:  [255, 225, 228],
    vermText:  [155,  28,  42],
    laranja:   [210, 135,  25],
    larPale:   [255, 242, 215],
    larText:   [155,  95,  10],
    cinzaF:    [246, 245, 250],
    cinzaB:    [215, 210, 226],
    cinzaT:    [118, 106, 138],
    cinzaL:    [158, 148, 172],
    preto:     [ 28,  18,  48],
  };

  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();
  const M   = 18;
  const CW  = PW - M * 2;
  const MID = PW / 2;

  // Helpers de renderização
  const setFont = (size, style = 'normal', r = 28, g = 18, b = 48) => {
    doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(r, g, b);
  };
  const rr    = (x, y, w, h, r, fill, stroke) => doc.roundedRect(x, y, w, h, r, r, fill ? (stroke ? 'FD' : 'F') : 'S');
  const hLine = (yPos, color = C.cinzaB, lw = 0.2) => { doc.setDrawColor(...color); doc.setLineWidth(lw); doc.line(M, yPos, M + CW, yPos); };

  // Design system do documento
  const SP = 4, PAD_X = 6, PAD_Y = 5;
  const R_CONTAINER = 4, R_SMALL = 3, R_LOGO = 7;
  const H_ALUNO = 20, H_CARD2 = 18, H_HEADER_T = 7, H_ROW = 7.5;
  const LOGO_SZ = 22;

  const labelY  = (blockY)    => blockY + PAD_Y;
  const valueY  = (blockY, h) => blockY + h - PAD_Y;
  const centerY = (blockY, h) => blockY + h / 2;
  const centerX = (x, w)      => x + w / 2;

  // 1. Fundo + cabeçalho
  doc.setFillColor(...C.bg); doc.rect(0, 0, PW, PH, 'F');
  const headerH = 36;
  doc.setFillColor(...C.roxo); doc.rect(0, 0, PW, headerH, 'F');
  doc.setFillColor(115, 62, 182); doc.circle(PW + 4, -4, 46, 'F');
  doc.setFillColor(108, 56, 174); doc.circle(PW + 4, -4, 32, 'F');

  const logoX = M, logoY = (headerH - LOGO_SZ) / 2;
  doc.setFillColor(255, 255, 255); doc.setDrawColor(230, 225, 245); doc.setLineWidth(0.3);
  rr(logoX, logoY, LOGO_SZ, LOGO_SZ, R_LOGO, true, true);
  doc.setFillColor(245, 242, 255);
  rr(logoX + 0.8, logoY + 0.8, LOGO_SZ - 1.6, LOGO_SZ - 1.6, R_LOGO - 1, true, false);
  setFont(17, 'bold', ...C.roxo);
  doc.text('K', centerX(logoX, LOGO_SZ), centerY(logoY, LOGO_SZ) + 17 / 3 * 0.35, { align: 'center' });

  const txX = logoX + LOGO_SZ + SP + SP / 2, txMid = centerY(logoY, LOGO_SZ), LINE_GAP = 7;
  setFont(12, 'bold', 255, 255, 255);
  doc.text('Comprovante de Aulas', txX, txMid - LINE_GAP / 2);
  setFont(7, 'normal', 208, 188, 238);
  doc.text('Sistema de Controle · Kimbelly', txX, txMid + LINE_GAP / 2);
  setFont(6.5, 'normal', 208, 188, 238);
  doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR'), PW - M, txMid - LINE_GAP / 2, { align: 'right' });
  if (filtroDe || filtroAte) {
    const per = 'Periodo: ' + (filtroDe ? fmtData(filtroDe) : 'inicio') + ' a ' + (filtroAte ? fmtData(filtroAte) : 'hoje');
    setFont(6, 'normal', 208, 188, 238);
    doc.text(per, PW - M, txMid + LINE_GAP / 2, { align: 'right' });
  }

  let y = headerH + SP * 2;

  // 2. Bloco do aluno
  doc.setFillColor(...C.cinzaF); doc.setDrawColor(...C.cinzaB); doc.setLineWidth(0.2);
  rr(M, y, CW, H_ALUNO, R_CONTAINER, true, true);
  setFont(5, 'bold', ...C.roxoClaro); doc.text('ALUNO', M + PAD_X, labelY(y));
  setFont(11, 'bold', ...C.preto);   doc.text(aluno.nome, M + PAD_X, valueY(y, H_ALUNO));
  setFont(5, 'bold', ...C.roxoClaro); doc.text('VALOR / HORA', PW - M - PAD_X, labelY(y), { align: 'right' });
  setFont(11, 'bold', ...C.roxo);
  doc.text('R$ ' + Number(aluno.valorHora || 15).toFixed(2).replace('.', ','), PW - M - PAD_X, valueY(y, H_ALUNO), { align: 'right' });
  y += H_ALUNO + SP;

  // 3. Cards de resumo (2 colunas)
  const c2W = (CW - SP) / 2;
  const drawSummaryCard = (cx, cy, label, value) => {
    doc.setFillColor(...C.cinzaF); doc.setDrawColor(...C.cinzaB); doc.setLineWidth(0.2);
    rr(cx, cy, c2W, H_CARD2, R_CONTAINER, true, true);
    setFont(5, 'bold', ...C.cinzaT);  doc.text(label, cx + PAD_X, labelY(cy));
    setFont(10, 'bold', ...C.preto);  doc.text(value, cx + PAD_X, valueY(cy, H_CARD2));
  };
  const totalHorasAlc   = aulas.reduce((s, a) => s + Number(a.horas || 0), 0);
  const totalSoAulasAlc = aulas.reduce((s, a) => {
    const vT = a.transporte === 'SIM' ? Number(aluno.valorTransp || getConfig().valorTransp || 0) : 0;
    return s + Number(a.total || 0) - vT;
  }, 0);
  drawSummaryCard(M,            y, 'QTD. DE AULAS', nAulas + (nAulas !== 1 ? ' aulas' : ' aula'));
  drawSummaryCard(M + c2W + SP, y, 'QTD. DE HORAS', totalHorasAlc.toFixed(1).replace('.', ',') + 'h');
  y += H_CARD2 + SP;
  drawSummaryCard(M,            y, 'TOTAL AULAS',   fmtReal(totalSoAulasAlc));
  drawSummaryCard(M + c2W + SP, y, 'TOTAL TRANSP.', fmtReal(totalTransporte));
  y += H_CARD2 + SP;

  // 4. Tabela de aulas
  const colData = M + PAD_X, colHorasCX = M + CW * 0.32, colTrCX = M + CW * 0.60, colValor = M + CW - PAD_X;
  const tabelaBodyH  = nAulas > 0 ? nAulas * H_ROW : H_ROW * 2;
  const tabelaTotalH = H_HEADER_T + tabelaBodyH;

  doc.setFillColor(...C.cinzaF); doc.setDrawColor(...C.cinzaB); doc.setLineWidth(0.2);
  rr(M, y, CW, tabelaTotalH, R_SMALL, true, true);

  /*
   * Cabeçalho: dois passos para cantos superiores arredondados e inferiores retos,
   * sem clip de conteúdo.
   */
  doc.setFillColor(...C.roxo); doc.setDrawColor(...C.roxo); doc.setLineWidth(0);
  rr(M, y, CW, H_HEADER_T, R_SMALL, true, false);
  doc.rect(M, y + R_SMALL, CW, H_HEADER_T - R_SMALL, 'F');

  setFont(5.5, 'bold', 255, 255, 255);
  const thMidY = y + H_HEADER_T / 2;
  doc.text('DATA',       colData,    thMidY, { baseline: 'middle' });
  doc.text('HORAS',      colHorasCX, thMidY, { align: 'center', baseline: 'middle' });
  doc.text('TRANSPORTE', colTrCX,    thMidY, { align: 'center', baseline: 'middle' });
  doc.text('VALOR',      colValor,   thMidY, { align: 'right',  baseline: 'middle' });
  y += H_HEADER_T;

  if (!nAulas) {
    setFont(8, 'normal', ...C.cinzaT);
    doc.text('Nenhuma aula no periodo selecionado.', MID, y + H_ROW, { align: 'center', baseline: 'middle' });
    y += H_ROW * 2 + SP;
  } else {
    const FONT_SZ_CELL = 7.5, FONT_SZ_BADGE = 5.5, BADGE_W = 17, BADGE_H = 5;
    aulas.forEach((a, i) => {
      const isLast = i === aulas.length - 1;
      if (y > PH - 52) { doc.addPage(); doc.setFillColor(...C.bg); doc.rect(0, 0, PW, PH, 'F'); y = 18; }

      // Zebra stripe nas linhas pares
      if (i % 2 === 0) {
        doc.setFillColor(236, 233, 245); doc.setDrawColor(...C.cinzaF); doc.setLineWidth(0);
        isLast ? rr(M, y, CW, H_ROW, R_SMALL, true, false) : doc.rect(M, y, CW, H_ROW, 'F');
      }
      if (!isLast) { doc.setDrawColor(...C.cinzaB); doc.setLineWidth(0.1); doc.line(M, y + H_ROW, M + CW, y + H_ROW); }

      const rowMidY = y + H_ROW / 2;
      setFont(FONT_SZ_CELL, 'normal', ...C.preto);
      doc.text(fmtData(a.data) || '—', colData, rowMidY, { baseline: 'middle' });
      doc.text(Number(a.horas).toFixed(1).replace('.', ',') + 'h', colHorasCX, rowMidY, { align: 'center', baseline: 'middle' });

      const sim   = a.transporte === 'SIM';
      const bFill = sim ? C.verdePale : C.vermPale;
      const bBord = sim ? C.verde     : C.vermelho;
      const bText = sim ? C.verdeText : C.vermText;
      const bX    = colTrCX - BADGE_W / 2, bY = rowMidY - BADGE_H / 2;
      doc.setFillColor(...bFill); doc.setDrawColor(...bBord); doc.setLineWidth(0.2);
      rr(bX, bY, BADGE_W, BADGE_H, BADGE_H / 2, true, true);
      setFont(FONT_SZ_BADGE, 'bold', ...bText);
      doc.text(sim ? 'Sim' : 'Nao', colTrCX, bY + BADGE_H / 2, { align: 'center', baseline: 'middle' });

      setFont(FONT_SZ_CELL, 'bold', ...C.preto);
      doc.text(fmtReal(a.total), colValor, rowMidY, { align: 'right', baseline: 'middle' });
      y += H_ROW;
    });
  }

  y += SP * 2;

  // 5. Bloco final — 3 colunas (Valor · Pago · Status)
  if (y > PH - 46) { doc.addPage(); doc.setFillColor(...C.bg); doc.rect(0, 0, PW, PH, 'F'); y = 18; }

  let sFill, sBord, sText, sLabel;
  if (isPago)       { sFill = C.verdePale; sBord = C.verde;    sText = C.verdeText; sLabel = 'PAGO';     }
  else if (isParcial){ sFill = C.larPale;  sBord = C.laranja;  sText = C.larText;   sLabel = 'PARCIAL';  }
  else               { sFill = C.vermPale; sBord = C.vermelho; sText = C.vermText;  sLabel = 'PENDENTE'; }

  const corPago       = totalPago > 0 ? C.verde : C.preto;
  const H_BLOCO_FINAL = 26;
  doc.setFillColor(...C.cinzaF); doc.setDrawColor(...C.cinzaB); doc.setLineWidth(0.2);
  rr(M, y, CW, H_BLOCO_FINAL, R_CONTAINER, true, true);

  const div1X = M + CW * (1/3), div2X = M + CW * (2/3), divMargin = R_CONTAINER;
  doc.setLineWidth(0.15);
  doc.line(div1X, y + divMargin, div1X, y + H_BLOCO_FINAL - divMargin);
  doc.line(div2X, y + divMargin, div2X, y + H_BLOCO_FINAL - divMargin);

  const col1CX = M + (div1X - M) / 2, col2CX = div1X + (div2X - div1X) / 2, col3CX = div2X + (M + CW - div2X) / 2;
  const LABEL_FONT = 5, VALUE_FONT = 10, PILL_FONT = 5.5;
  const PILL_W = sLabel.length > 5 ? 26 : 18, PILL_H = 6;
  const bLabelY5 = y + PAD_Y, bLabelBot = bLabelY5 + LABEL_FONT * 0.7;
  const bZoneMidY = bLabelBot + (y + H_BLOCO_FINAL - bLabelBot) / 2;

  setFont(LABEL_FONT, 'bold', ...C.cinzaT); doc.text('VALOR FINAL', col1CX, bLabelY5, { align: 'center', baseline: 'top' });
  setFont(VALUE_FONT, 'bold', ...C.preto);  doc.text(fmtReal(totalV), col1CX, bZoneMidY, { align: 'center', baseline: 'middle' });

  setFont(LABEL_FONT, 'bold', ...C.cinzaT); doc.text('TOTAL PAGO', col2CX, bLabelY5, { align: 'center', baseline: 'top' });
  setFont(VALUE_FONT, 'bold', ...corPago);  doc.text(fmtReal(totalPago), col2CX, bZoneMidY, { align: 'center', baseline: 'middle' });

  setFont(LABEL_FONT, 'bold', ...C.cinzaT); doc.text('STATUS', col3CX, bLabelY5, { align: 'center', baseline: 'top' });
  const pillX = col3CX - PILL_W / 2, pillY = bZoneMidY - PILL_H / 2;
  doc.setFillColor(...sFill); doc.setDrawColor(...sBord); doc.setLineWidth(0.25);
  rr(pillX, pillY, PILL_W, PILL_H, PILL_H / 2, true, true);
  setFont(PILL_FONT, 'bold', ...sText);
  doc.text(sLabel, col3CX, bZoneMidY, { align: 'center', baseline: 'middle' });

  y += H_BLOCO_FINAL + SP * 2;

  // 6. Rodapé
  hLine(PH - 11, C.cinzaB, 0.2);
  setFont(5.5, 'normal', ...C.cinzaL);
  doc.text('Documento gerado pelo sistema de Controle de Alunos · Kimbelly', M, PH - 6.5);
  doc.text(new Date().toLocaleString('pt-BR'), PW - M, PH - 6.5, { align: 'right' });

  const nomeArquivo = 'comprovante-' + aluno.nome.replace(/\s+/g, '-').toLowerCase() + (filtroDe ? '-' + filtroDe : '') + '.pdf';
  doc.save(nomeArquivo);
  showToast('PDF gerado com sucesso!', 'success');
}
