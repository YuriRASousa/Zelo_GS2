import { api } from '../config/api';
import type {
  Bairro,
  Categoria,
  OcorrenciaDetalhe,
  OcorrenciaResumo,
  Painel,
  ResultadoRotina,
  Status,
  Usuario,
} from '../types';

/** Chamadas da API agrupadas por assunto. Cada funcao devolve o tipo ja pronto para a tela. */

export interface RespostaAuth {
  token: string;
  usuario: Usuario;
}

export const authApi = {
  entrar: (email: string, senha: string) => api.post<RespostaAuth>('/auth/login', { email, senha }),
  cadastrar: (nome: string, email: string, senha: string, bairroId: number) =>
    api.post<RespostaAuth>('/auth/cadastro', { nome, email, senha, bairroId }),
  eu: (sinal?: AbortSignal) => api.get<Usuario>('/usuarios/me', sinal),
  preferencias: (fonteGrande: boolean) => api.patch<Usuario>('/usuarios/me/preferencias', { fonteGrande }),
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
}

export const ocorrenciaApi = {
  listar: (bairroId: number | null, incluirEncerradas: boolean, sinal?: AbortSignal) => {
    const q = new URLSearchParams({ incluirEncerradas: String(incluirEncerradas), limite: '150' });
    if (bairroId) q.set('bairroId', String(bairroId));
    return api.get<OcorrenciaResumo[]>(`/ocorrencias?${q.toString()}`, sinal);
  },
  minhas: (sinal?: AbortSignal) => api.get<OcorrenciaResumo[]>('/ocorrencias/minhas', sinal),
  apoiadas: (sinal?: AbortSignal) => api.get<OcorrenciaResumo[]>('/ocorrencias/apoiadas', sinal),
  detalhe: (id: number, sinal?: AbortSignal) => api.get<OcorrenciaDetalhe>(`/ocorrencias/${id}`, sinal),
  duplicada: (categoriaId: number, lat: number, lon: number, sinal?: AbortSignal) =>
    api.get<{ id: number; protocolo: string; titulo: string } | null>(
      `/ocorrencias/duplicada?categoriaId=${categoriaId}&lat=${lat}&lon=${lon}`,
      sinal,
    ),
  registrar: (dados: NovaOcorrencia) =>
    api.post<{ id: number; protocolo: string }>('/ocorrencias', dados, 45000),
  apoiar: (id: number) => api.post<{ apoios: number; prioridade: number }>(`/ocorrencias/${id}/apoios`),
  avaliar: (id: number, nota: number, comentario: string) =>
    api.post<null>(`/ocorrencias/${id}/avaliacao`, { nota, comentario }),
};

export const painelApi = {
  painel: (bairroId: number | null, sinal?: AbortSignal) =>
    api.get<Painel>(bairroId ? `/painel?bairroId=${bairroId}` : '/painel', sinal),
};

export const gestorApi = {
  fila: (sinal?: AbortSignal) => api.get<OcorrenciaResumo[]>('/gestor/fila', sinal),
  mudarStatus: (id: number, status: Status, comentario: string) =>
    api.patch<OcorrenciaDetalhe>(`/gestor/ocorrencias/${id}/status`, { status, comentario }),
  rotinas: () => api.post<ResultadoRotina>('/gestor/rotinas'),
};
