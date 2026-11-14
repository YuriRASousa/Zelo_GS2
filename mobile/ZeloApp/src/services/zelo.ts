import { api } from '../config/api';
import type {
  Bairro,
  Categoria,
  LogRotina,
  Notificacao,
  OcorrenciaDetalhe,
  OcorrenciaResumo,
  Painel,
  ResultadoRotina,
  Status,
  Usuario,
} from '../types';

/** Chamadas da API agrupadas por assunto (contrato em docs/CONTRATO_API_V2.md). */

export interface RespostaAuth {
  token: string;
  usuario: Usuario;
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '' && v !== false) q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  entrar: (email: string, senha: string) => api.post<RespostaAuth>('/auth/login', { email, senha }),
  cadastrar: (nome: string, email: string, senha: string, bairroId: number) =>
    api.post<RespostaAuth>('/auth/cadastro', { nome, email, senha, bairroId }),
  eu: (sinal?: AbortSignal) => api.get<Usuario>('/usuarios/me', sinal),
  preferencias: (fonteGrande: boolean) => api.patch<Usuario>('/usuarios/me/preferencias', { fonteGrande }),
  atualizar: (nome: string, bairroId: number) => api.put<Usuario>('/usuarios/me', { nome, bairroId }),
  trocarSenha: (senhaAtual: string, novaSenha: string) =>
    api.post<null>('/usuarios/me/senha', { senhaAtual, novaSenha }),
};

export const catalogoApi = {
  bairros: () => api.get<Bairro[]>('/catalogo/bairros'),
  categorias: () => api.get<Categoria[]>('/catalogo/categorias'),
};

export interface NovaOcorrencia {
  categoriaId: number;
  bairroId: number;
  titulo: string;
  descricao: string;
  endereco: string;
  latitude: number;
  longitude: number;
  risco: boolean;
  acessibilidade: boolean;
  fotoBase64: string | null;
  /** true quando o cidadao confirmou que e outro problema, apesar do aviso de duplicata. */
  ignorarDuplicada?: boolean;
}

export interface FiltroOcorrencias {
  bairroId: number | null;
  categoriaId: number | null;
  busca: string;
  incluirEncerradas: boolean;
}

export const ocorrenciaApi = {
  listar: (f: FiltroOcorrencias, sinal?: AbortSignal) =>
    api.get<OcorrenciaResumo[]>(
      `/ocorrencias${query({ ...f, busca: f.busca.trim(), limite: 150 })}`,
      sinal,
    ),
  minhas: (sinal?: AbortSignal) => api.get<OcorrenciaResumo[]>('/ocorrencias/minhas', sinal),
  apoiadas: (sinal?: AbortSignal) => api.get<OcorrenciaResumo[]>('/ocorrencias/apoiadas', sinal),
  detalhe: (id: number, sinal?: AbortSignal) => api.get<OcorrenciaDetalhe>(`/ocorrencias/${id}`, sinal),
  duplicada: (categoriaId: number, lat: number, lon: number, sinal?: AbortSignal) =>
    api.get<{ id: number; protocolo: string; titulo: string } | null>(
      `/ocorrencias/duplicada${query({ categoriaId, lat, lon })}`,
      sinal,
    ),
  registrar: (dados: NovaOcorrencia) =>
    api.post<{ id: number; protocolo: string }>('/ocorrencias', dados, 45000),
  apoiar: (id: number) => api.post<{ apoios: number; prioridade: number }>(`/ocorrencias/${id}/apoios`),
  avaliar: (id: number, nota: number, comentario: string) =>
    api.post<null>(`/ocorrencias/${id}/avaliacao`, { nota, comentario }),
  comentar: (id: number, texto: string) => api.post<null>(`/ocorrencias/${id}/comentarios`, { texto }),
  cancelar: (id: number, motivo: string) => api.post<OcorrenciaDetalhe>(`/ocorrencias/${id}/cancelar`, { motivo }),
};

export const notificacaoApi = {
  listar: (sinal?: AbortSignal) => api.get<Notificacao[]>('/notificacoes', sinal),
  naoLidas: (sinal?: AbortSignal) => api.get<{ total: number }>('/notificacoes/nao-lidas', sinal),
  marcarLida: (id: number) => api.post<null>(`/notificacoes/${id}/lida`),
  marcarTodas: () => api.post<null>('/notificacoes/lidas'),
};

export const painelApi = {
  painel: (bairroId: number | null, sinal?: AbortSignal) =>
    api.get<Painel>(`/painel${query({ bairroId })}`, sinal),
};

export interface FiltroFila {
  bairroId: number | null;
  categoriaId: number | null;
  somenteAtrasadas: boolean;
}

export const gestorApi = {
  fila: (f: FiltroFila, sinal?: AbortSignal) => api.get<OcorrenciaResumo[]>(`/gestor/fila${query({ ...f })}`, sinal),
  mudarStatus: (id: number, status: Status, comentario: string, fotoSolucaoBase64?: string | null) =>
    api.patch<OcorrenciaDetalhe>(`/gestor/ocorrencias/${id}/status`, {
      status,
      comentario,
      fotoSolucaoBase64: fotoSolucaoBase64 ?? null,
    }),
  rotinas: () => api.post<ResultadoRotina>('/gestor/rotinas', undefined, 45000),
  logs: (sinal?: AbortSignal) => api.get<LogRotina[]>('/gestor/logs', sinal),
};
