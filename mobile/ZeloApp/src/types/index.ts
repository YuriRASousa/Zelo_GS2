/** Tipos que espelham os DTOs da API (backend/zelo-api/.../dto). */

export type Status = 'ABERTA' | 'EM_ANALISE' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'CANCELADA';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: 'CIDADAO' | 'GESTOR';
  bairroId: number | null;
  bairro: string | null;
  pontos: number;
  fonteGrande: boolean;
  registradas: number;
  apoios: number;
  resolvidas: number;
  naoLidas: number;
}

export interface Bairro {
  id: number;
  nome: string;
  regiao: string;
  latitude: number;
  longitude: number;
}

export interface Categoria {
  id: number;
  nome: string;
  icone: string;
  prazoDias: number;
  peso: number;
  orgao: string;
}

export interface OcorrenciaResumo {
  id: number;
  protocolo: string;
  titulo: string;
  categoriaId: number;
  categoria: string;
  icone: string;
  bairroId: number;
  bairro: string;
  latitude: number;
  longitude: number;
  status: Status;
  prioridade: number;
  apoios: number;
  risco: boolean;
  acessibilidade: boolean;
  atrasada: boolean;
  temFoto: boolean;
  abertura: string;
  prazo: string;
}

export type TipoEvento = 'REGISTRO' | 'STATUS' | 'COMENTARIO' | 'ATRASO';

export interface EventoHistorico {
  tipo: TipoEvento;
  papelAutor: 'CIDADAO' | 'GESTOR' | null;
  data: string;
  statusAnterior: Status | null;
  statusNovo: Status;
  comentario: string | null;
  autor: string;
}

export interface OcorrenciaDetalhe extends Omit<OcorrenciaResumo, 'temFoto'> {
  descricao: string | null;
  endereco: string | null;
  orgao: string;
  foto: string | null;
  fotoSolucao: string | null;
  podeCancelar: boolean;
  podeComentar: boolean;
  resolucao: string | null;
  autor: string;
  souAutor: boolean;
  jaApoiei: boolean;
  nota: number | null;
  comentarioAvaliacao: string | null;
  historico: EventoHistorico[];
}

export interface Painel {
  bairroId: number | null;
  bairro: string;
  agora: { emAberto: number; atrasadas: number; resolvidas: number; apoios: number; pcNoPrazo: number | null };
  meses: {
    mes: string;
    abertas: number;
    resolvidas: number;
    atrasadas: number;
    tempoMedioDias: number | null;
    pcNoPrazo: number | null;
    notaMedia: number | null;
    taxaMilHab: number | null;
    geradoEm: string;
  }[];
  categorias: { categoria: string; icone: string; total: number; emAberto: number; resolvidas: number }[];
  cidadaos: { nome: string; pontos: number }[];
}

export interface ResultadoRotina {
  atrasosDetectados: number;
  prioridadesAjustadas: number;
  bairrosConsolidados: number;
  mes: string;
}

export type TipoNotificacao = 'STATUS' | 'ATRASO' | 'APOIO' | 'COMENTARIO';

export interface Notificacao {
  id: number;
  ocorrenciaId: number;
  protocolo: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  lida: boolean;
  data: string;
}

export interface LogRotina {
  data: string;
  rotina: string;
  nivel: 'INFO' | 'AVISO' | 'ERRO';
  linhas: number;
  mensagem: string;
}
