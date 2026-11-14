/**
 * Gera o DER (modelo fisico, Oracle) e o MER (modelo conceitual, notacao
 * de Chen) do Zelo em SVG e PNG, dentro de docs/modelo.
 *
 * As colunas do DER acompanham database/01_ddl.sql: mudou o banco, muda
 * a lista abaixo e roda de novo.
 *
 * Uso: cd docs/geradores && npm install && node gerar_modelos.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SAIDA = path.join(__dirname, '..', 'modelo');

const TINTA = '#13201C';
const SUAVE = '#45544F';
const LINHA = '#9AAAA4';
const FUNDO = '#FFFFFF';
const CARTAO = '#F7F9F7';
const VERDE = '#0B5D4B';
const VERDE2 = '#12806A';
const AMBAR = '#D9921E';
const AZUL = '#1D5FD1';
const CINZA = '#6B7A75';

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function salvar(nome, svg, largura) {
  fs.writeFileSync(path.join(SAIDA, `${nome}.svg`), svg, 'utf8');
  await sharp(Buffer.from(svg)).resize({ width: largura * 2 }).png().toFile(path.join(SAIDA, `${nome}.png`));
  console.log(`ok  ${nome}.svg / ${nome}.png`);
}

// =====================================================================
// DER
// =====================================================================
const W = 300;
const CAB = 34;
const LIN = 20;
const PAD = 10;

const TABELAS = [
  {
    nome: 'ZL_USUARIO', x: 40, y: 100, cor: VERDE,
    cols: [
      ['id_usuario', 'NUMBER(10)', 'pk'], ['nm_usuario', 'VARCHAR2(100)'], ['ds_email', 'VARCHAR2(120)', 'uk'],
      ['ds_senha_hash', 'VARCHAR2(100)'], ['tp_papel', 'VARCHAR2(10)'], ['id_bairro', 'NUMBER(6)', 'fk'],
      ['nr_pontos', 'NUMBER(8)'], ['fl_fonte_grande', 'CHAR(1)'], ['dt_cadastro', 'DATE'],
    ],
  },
  {
    nome: 'ZL_OCORRENCIA', x: 470, y: 100, cor: VERDE,
    cols: [
      ['id_ocorrencia', 'NUMBER(10)', 'pk'], ['cd_protocolo', 'VARCHAR2(20)', 'uk'], ['id_usuario', 'NUMBER(10)', 'fk'],
      ['id_categoria', 'NUMBER(4)', 'fk'], ['id_bairro', 'NUMBER(6)', 'fk'], ['ds_titulo', 'VARCHAR2(120)'],
      ['ds_descricao', 'VARCHAR2(1000)'], ['ds_endereco', 'VARCHAR2(200)'], ['nr_latitude', 'NUMBER(9,6)'],
      ['nr_longitude', 'NUMBER(9,6)'], ['ds_foto', 'VARCHAR2(200)'], ['fl_risco', 'CHAR(1)'],
      ['fl_acessibilidade', 'CHAR(1)'], ['st_ocorrencia', 'VARCHAR2(15)'], ['nr_prioridade', 'NUMBER(3)'],
      ['qt_apoios', 'NUMBER(6)'], ['dt_abertura', 'DATE'], ['dt_prazo', 'DATE'], ['dt_resolucao', 'DATE'],
    ],
  },
  {
    nome: 'ZL_CATEGORIA', x: 900, y: 100, cor: AZUL,
    cols: [
      ['id_categoria', 'NUMBER(4)', 'pk'], ['nm_categoria', 'VARCHAR2(60)', 'uk'], ['ds_icone', 'VARCHAR2(30)'],
      ['nr_prazo_dias', 'NUMBER(3)'], ['nr_peso', 'NUMBER(1)'], ['nm_orgao', 'VARCHAR2(80)'],
    ],
  },
  {
    nome: 'ZL_AVALIACAO', x: 900, y: 330, cor: VERDE2,
    cols: [
      ['id_ocorrencia', 'NUMBER(10)', 'pk fk'], ['nr_nota', 'NUMBER(1)'], ['ds_comentario', 'VARCHAR2(500)'],
      ['dt_avaliacao', 'DATE'],
    ],
  },
  {
    nome: 'ZL_LOG_ROTINA', x: 1330, y: 100, cor: AMBAR,
    cols: [
      ['id_log', 'NUMBER(12)', 'pk'], ['nm_rotina', 'VARCHAR2(60)'], ['ds_mensagem', 'VARCHAR2(500)'],
      ['qt_linhas', 'NUMBER(8)'], ['tp_nivel', 'VARCHAR2(5)'], ['dt_execucao', 'DATE'],
    ],
  },
  {
    nome: 'ZL_APOIO', x: 40, y: 420, cor: VERDE2,
    cols: [['id_ocorrencia', 'NUMBER(10)', 'pk fk'], ['id_usuario', 'NUMBER(10)', 'pk fk'], ['dt_apoio', 'DATE']],
  },
  {
    nome: 'ZL_HISTORICO', x: 470, y: 620, cor: VERDE2,
    cols: [
      ['id_historico', 'NUMBER(12)', 'pk'], ['id_ocorrencia', 'NUMBER(10)', 'fk'], ['st_anterior', 'VARCHAR2(15)'],
      ['st_novo', 'VARCHAR2(15)'], ['ds_comentario', 'VARCHAR2(500)'], ['id_usuario', 'NUMBER(10)', 'fk'],
      ['dt_evento', 'DATE'],
    ],
  },
  {
    nome: 'ZL_BAIRRO', x: 900, y: 620, cor: AZUL,
    cols: [
      ['id_bairro', 'NUMBER(6)', 'pk'], ['nm_bairro', 'VARCHAR2(80)', 'uk'], ['nm_regiao', 'VARCHAR2(40)'],
      ['nr_populacao', 'NUMBER(8)'], ['nr_latitude', 'NUMBER(9,6)'], ['nr_longitude', 'NUMBER(9,6)'],
    ],
  },
  {
    nome: 'ZL_INDICADOR', x: 1330, y: 580, cor: AMBAR,
    cols: [
      ['id_bairro', 'NUMBER(6)', 'pk fk'], ['cd_mes', 'CHAR(7)', 'pk'], ['qt_abertas', 'NUMBER(6)'],
      ['qt_resolvidas', 'NUMBER(6)'], ['qt_atrasadas', 'NUMBER(6)'], ['nr_tempo_medio', 'NUMBER(6,1)'],
      ['pc_no_prazo', 'NUMBER(5,1)'], ['nr_nota_media', 'NUMBER(3,2)'], ['nr_taxa_mil_hab', 'NUMBER(7,2)'],
      ['dt_geracao', 'DATE'],
    ],
  },
];

const tab = (n) => TABELAS.find((t) => t.nome === n);
const alt = (t) => CAB + t.cols.length * LIN + PAD;
const centro = (t) => ({ x: t.x + W / 2, y: t.y + alt(t) / 2 });

function borda(t, alvo) {
  const c = centro(t);
  const h = alt(t);
  const dx = alvo.x - c.x;
  const dy = alvo.y - c.y;
  const k = Math.min(dx ? W / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}

// [pai (lado 1), filha (lado N), rotulo, cardinalidade da filha, pontos intermediarios opcionais]
const LIGACOES = [
  ['ZL_USUARIO', 'ZL_OCORRENCIA', 'registra', 'N'],
  ['ZL_CATEGORIA', 'ZL_OCORRENCIA', 'classifica', 'N'],
  ['ZL_BAIRRO', 'ZL_OCORRENCIA', 'localiza', 'N'],
  ['ZL_USUARIO', 'ZL_APOIO', 'apoia', 'N'],
  ['ZL_OCORRENCIA', 'ZL_APOIO', 'recebe apoio', 'N'],
  ['ZL_OCORRENCIA', 'ZL_HISTORICO', 'linha do tempo', 'N'],
  ['ZL_OCORRENCIA', 'ZL_AVALIACAO', 'avaliada', '0..1'],
  ['ZL_BAIRRO', 'ZL_INDICADOR', 'consolida', 'N'],
  ['ZL_USUARIO', 'ZL_HISTORICO', 'atualiza (gestor)', 'N', [{ x: 340, y: 300 }, { x: 405, y: 300 }, { x: 405, y: 712 }, { x: 470, y: 712 }]],
  ['ZL_BAIRRO', 'ZL_USUARIO', 'reside', 'N', [{ x: 1050, y: 784 }, { x: 1050, y: 860 }, { x: 22, y: 860 }, { x: 22, y: 230 }, { x: 40, y: 230 }]],
];

function caixa(t) {
  const h = alt(t);
  let s = `<g>
    <rect x="${t.x}" y="${t.y}" width="${W}" height="${h}" rx="10" fill="${CARTAO}" stroke="#DCE4E0" stroke-width="1.5"/>
    <path d="M ${t.x} ${t.y + 10} a 10 10 0 0 1 10 -10 h ${W - 20} a 10 10 0 0 1 10 10 v ${CAB - 10} h -${W} z" fill="${t.cor}"/>
    <text x="${t.x + 12}" y="${t.y + 22}" font-family="Segoe UI, Arial" font-size="14.5" font-weight="700" fill="#fff">${esc(t.nome)}</text>`;
  t.cols.forEach((c, i) => {
    const y = t.y + CAB + 14 + i * LIN;
    const f = c[2] || '';
    const marca = f.includes('pk') && f.includes('fk') ? 'PK/FK' : f.includes('pk') ? 'PK' : f.includes('fk') ? 'FK' : f.includes('uk') ? 'UK' : '';
    const corMarca = f.includes('pk') ? VERDE : f.includes('fk') ? AZUL : CINZA;
    if (marca) s += `<text x="${t.x + 10}" y="${y}" font-family="Segoe UI, Arial" font-size="9.5" font-weight="700" fill="${corMarca}">${marca}</text>`;
    s += `<text x="${t.x + 52}" y="${y}" font-family="Consolas, monospace" font-size="12.5" font-weight="${f.includes('pk') ? 700 : 400}" fill="${TINTA}">${esc(c[0])}</text>`;
    s += `<text x="${t.x + W - 10}" y="${y}" text-anchor="end" font-family="Segoe UI, Arial" font-size="10.5" fill="${SUAVE}">${esc(c[1])}</text>`;
  });
  return s + '</g>';
}

function ligacao([de, para, rotulo, card, via]) {
  const a = tab(de);
  const b = tab(para);
  let pts;
  if (via) {
    pts = via;
  } else {
    pts = [borda(a, centro(b)), borda(b, centro(a))];
  }
  const p1 = pts[0];
  const p2 = pts[pts.length - 1];
  const seg = (i) => {
    const q1 = pts[i];
    const q2 = pts[i + 1];
    const d = Math.hypot(q2.x - q1.x, q2.y - q1.y) || 1;
    return { ux: (q2.x - q1.x) / d, uy: (q2.y - q1.y) / d };
  };
  const ini = seg(0);
  const fim = seg(pts.length - 2);
  // rotulo no meio do segmento mais longo
  let melhor = 0;
  let maior = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (d > maior) { maior = d; melhor = i; }
  }
  const mx = (pts[melhor].x + pts[melhor + 1].x) / 2;
  const my = (pts[melhor].y + pts[melhor + 1].y) / 2;
  const larg = rotulo.length * 6 + 12;
  return `<g>
    <polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${LINHA}" stroke-width="1.6"/>
    <circle cx="${p1.x}" cy="${p1.y}" r="3.2" fill="${LINHA}"/><circle cx="${p2.x}" cy="${p2.y}" r="3.2" fill="${LINHA}"/>
    <text x="${p1.x + ini.ux * 14 + 4}" y="${p1.y + ini.uy * 14 - 4}" font-family="Segoe UI, Arial" font-size="11" font-weight="700" fill="${TINTA}">1</text>
    <text x="${p2.x - fim.ux * (18 + card.length * 5) + 4 - (card.length > 1 ? 10 : 0)}" y="${p2.y - fim.uy * 18 - 6}" font-family="Segoe UI, Arial" font-size="11" font-weight="700" fill="${TINTA}">${card}</text>
    <rect x="${mx - larg / 2}" y="${my - 9}" width="${larg}" height="16" rx="8" fill="${FUNDO}" stroke="#E6ECE9"/>
    <text x="${mx}" y="${my + 3}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="9.8" fill="${SUAVE}">${esc(rotulo)}</text>
  </g>`;
}

async function gerarDer() {
  const L = 1680;
  const H = 960;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <rect width="${L}" height="${H}" fill="${FUNDO}"/>
  <text x="40" y="46" font-family="Segoe UI, Arial" font-size="21" font-weight="800" fill="${TINTA}">Zelo | DER (modelo físico, Oracle 19c)</text>
  <text x="40" y="70" font-family="Segoe UI, Arial" font-size="12.5" fill="${SUAVE}">9 tabelas com prefixo ZL_. Escritas em ZL_OCORRENCIA passam pelo pacote PKG_ZL_OCORRENCIA; ZL_HISTORICO é preenchida por trigger.</text>`;
  LIGACOES.forEach((l) => (s += ligacao(l)));
  TABELAS.forEach((t) => (s += caixa(t)));
  const ly = H - 56;
  s += `<g><rect x="430" y="${ly}" width="820" height="40" rx="10" fill="${CARTAO}" stroke="#DCE4E0"/>
    ${[
      [VERDE, 'Núcleo (cidadão e ocorrência)', 450],
      [VERDE2, 'Participação e acompanhamento', 670],
      [AZUL, 'Catálogo', 900],
      [AMBAR, 'Gerado pelas rotinas PL/SQL', 1010],
    ]
      .map(([c, t, x]) => `<circle cx="${x + 6}" cy="${ly + 20}" r="6" fill="${c}"/><text x="${x + 18}" y="${ly + 24}" font-family="Segoe UI, Arial" font-size="11.5" fill="${TINTA}">${t}</text>`)
      .join('')}
  </g></svg>`;
  await salvar('DER_Zelo', s, L);
}

// =====================================================================
// MER (Chen): entidades em retangulo, relacionamentos em losango,
// atributos principais listados dentro da entidade (chave sublinhada).
// =====================================================================
const ENT = {
  USUARIO: { x: 90, y: 150, rot: 'USUÁRIO', attrs: ['id_usuario', 'nome', 'e-mail', 'papel (cidadão/gestor)', 'pontos'] },
  OCORRENCIA: { x: 640, y: 150, rot: 'OCORRÊNCIA', attrs: ['id_ocorrencia', 'protocolo', 'título, local, foto', 'status, prioridade', 'abertura, prazo'] },
  CATEGORIA: { x: 1190, y: 150, rot: 'CATEGORIA', attrs: ['id_categoria', 'nome', 'prazo (SLA), peso', 'órgão responsável'] },
  BAIRRO: { x: 640, y: 640, rot: 'BAIRRO', attrs: ['id_bairro', 'nome, região', 'população'] },
  HISTORICO: { x: 640, y: 400, rot: 'HISTÓRICO', attrs: ['id_historico', 'status anterior/novo', 'comentário, data'], fraca: true },
  AVALIACAO: { x: 1190, y: 400, rot: 'AVALIAÇÃO', attrs: ['nota (1 a 5)', 'comentário'], fraca: true },
  INDICADOR: { x: 1190, y: 640, rot: 'INDICADOR', attrs: ['mês', 'abertas, resolvidas', 'tempo médio, % no prazo'], fraca: true },
};
const EW = 230;
const eh = (e) => 40 + e.attrs.length * 17 + 10;
const ec = (e) => ({ x: e.x + EW / 2, y: e.y + eh(e) / 2 });

// [entidade A, cardA, relacionamento, entidade B, cardB, posicao do losango]
const RELS = [
  ['USUARIO', '1', 'registra', 'OCORRENCIA', 'N', { x: 460, y: 165 }],
  ['USUARIO', 'N', 'apoia', 'OCORRENCIA', 'M', { x: 460, y: 290 }],
  ['CATEGORIA', '1', 'classifica', 'OCORRENCIA', 'N', { x: 1010, y: 215 }],
  ['OCORRENCIA', '1', 'possui', 'HISTORICO', 'N', { x: 755, y: 345 }],
  ['USUARIO', '1', 'atualiza', 'HISTORICO', 'N', { x: 460, y: 445 }],
  ['OCORRENCIA', '1', 'recebe', 'AVALIACAO', '0..1', { x: 1010, y: 330 }],
  ['BAIRRO', '1', 'localiza', 'OCORRENCIA', 'N', { x: 1010, y: 560 }],
  ['BAIRRO', '1', 'reside', 'USUARIO', 'N', { x: 205, y: 690 }],
  ['BAIRRO', '1', 'consolida', 'INDICADOR', 'N', { x: 1010, y: 700 }],
];

function bordaEnt(e, alvo) {
  const c = ec(e);
  const h = eh(e);
  const dx = alvo.x - c.x;
  const dy = alvo.y - c.y;
  const k = Math.min(dx ? EW / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}

async function gerarMer() {
  const L = 1520;
  const H = 860;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <rect width="${L}" height="${H}" fill="${FUNDO}"/>
  <text x="40" y="46" font-family="Segoe UI, Arial" font-size="21" font-weight="800" fill="${TINTA}">Zelo | MER (modelo conceitual, notação de Chen)</text>
  <text x="40" y="70" font-family="Segoe UI, Arial" font-size="12.5" fill="${SUAVE}">Retângulo: entidade (borda dupla = entidade fraca, depende da ocorrência ou do bairro). Losango: relacionamento. Atributo sublinhado: identificador.</text>`;

  // linhas primeiro, entidades e losangos por cima
  RELS.forEach(([a, ca, , b, cb, d]) => {
    const A = ENT[a];
    const B = ENT[b];
    const pa = bordaEnt(A, d);
    const pb = bordaEnt(B, d);
    s += `<line x1="${pa.x}" y1="${pa.y}" x2="${d.x}" y2="${d.y}" stroke="${LINHA}" stroke-width="1.6"/>`;
    s += `<line x1="${d.x}" y1="${d.y}" x2="${pb.x}" y2="${pb.y}" stroke="${LINHA}" stroke-width="1.6"/>`;
    const rot = (p, q, t) => {
      const dd = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const x = p.x + ((q.x - p.x) / dd) * 20;
      const y = p.y + ((q.y - p.y) / dd) * 20;
      return `<rect x="${x - 4 - t.length * 3.6}" y="${y - 10}" width="${t.length * 7.2 + 8}" height="16" rx="4" fill="${FUNDO}"/><text x="${x}" y="${y + 2}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="12" font-weight="800" fill="${VERDE}">${t}</text>`;
    };
    s += rot(pa, d, ca) + rot(pb, d, cb);
  });

  RELS.forEach(([, , r, , , d]) => {
    const w = Math.max(84, r.length * 8 + 26);
    const h = 44;
    s += `<polygon points="${d.x},${d.y - h / 2} ${d.x + w / 2},${d.y} ${d.x},${d.y + h / 2} ${d.x - w / 2},${d.y}" fill="#FDF3E1" stroke="${AMBAR}" stroke-width="1.6"/>
      <text x="${d.x}" y="${d.y + 4}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11.5" font-weight="700" fill="#7A4D00">${esc(r)}</text>`;
  });

  Object.values(ENT).forEach((e) => {
    const h = eh(e);
    s += `<rect x="${e.x}" y="${e.y}" width="${EW}" height="${h}" rx="6" fill="${CARTAO}" stroke="${VERDE}" stroke-width="2"/>`;
    if (e.fraca) s += `<rect x="${e.x + 4}" y="${e.y + 4}" width="${EW - 8}" height="${h - 8}" rx="4" fill="none" stroke="${VERDE}" stroke-width="1"/>`;
    s += `<rect x="${e.x + 2}" y="${e.y + 2}" width="${EW - 4}" height="30" rx="4" fill="${VERDE}"/>`;
    s += `<text x="${e.x + EW / 2}" y="${e.y + 23}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="14" font-weight="800" fill="#fff">${esc(e.rot)}</text>`;
    e.attrs.forEach((a, i) => {
      const chave = i === 0 && a.startsWith('id_');
      s += `<text x="${e.x + 14}" y="${e.y + 52 + i * 17}" font-family="Segoe UI, Arial" font-size="12" fill="${TINTA}" ${chave ? 'text-decoration="underline" font-weight="700"' : ''}>${esc(a)}</text>`;
    });
  });

  s += '</svg>';
  await salvar('MER_Zelo', s, L);
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  await gerarDer();
  await gerarMer();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
