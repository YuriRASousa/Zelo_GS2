import { Platform, ViewStyle } from 'react-native';
import type { Status } from '../types';

/**
 * Identidade visual do Zelo: verde-petroleo (cuidado, servico publico) com
 * ambar de sinalizacao como destaque. Contraste dos textos sobre o fundo
 * claro fica acima de 4.5:1 (WCAG AA).
 */
export const cores = {
  primaria: '#0B5D4B',
  primariaMedia: '#12806A',
  primariaClara: '#E2F1EB',
  destaque: '#F2A93B',
  destaqueEscuro: '#B76E00',
  tinta: '#13201C',
  tintaSuave: '#45544F',
  apagado: '#7A8984',
  linha: '#E1E7E4',
  fundo: '#F4F6F3',
  branco: '#FFFFFF',
  perigo: '#C8341F',
  perigoClaro: '#FDE8E4',
  info: '#1D5FD1',
  infoClaro: '#E4EDFC',
};

export const gradientes = {
  marca: ['#0B5D4B', '#12806A'] as const,
  escuro: ['#0A2A23', '#0B5D4B'] as const,
};

export const statusInfo: Record<Status, { rotulo: string; cor: string; fundo: string; passo: number }> = {
  ABERTA: { rotulo: 'Aberta', cor: '#B45309', fundo: '#FEF3C7', passo: 1 },
  EM_ANALISE: { rotulo: 'Em análise', cor: '#1D5FD1', fundo: '#E4EDFC', passo: 2 },
  EM_ANDAMENTO: { rotulo: 'Em andamento', cor: '#6D28D9', fundo: '#EDE9FE', passo: 3 },
  RESOLVIDA: { rotulo: 'Resolvida', cor: '#047857', fundo: '#D1FAE5', passo: 4 },
  CANCELADA: { rotulo: 'Cancelada', cor: '#4B5563', fundo: '#F3F4F6', passo: 0 },
};

/** Proximo passo permitido (espelha a regra transicao_valida do PL/SQL). */
export const proximosStatus: Record<Status, Status[]> = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['EM_ANDAMENTO', 'CANCELADA'],
  EM_ANDAMENTO: ['RESOLVIDA'],
  RESOLVIDA: [],
  CANCELADA: [],
};

export const raio = { p: 10, m: 14, g: 20, total: 999 };

export const esp = (n: number) => n * 4;

export function sombra(nivel: 1 | 2 = 1): ViewStyle {
  if (Platform.OS === 'android') return { elevation: nivel * 2 };
  return {
    shadowColor: '#0A2A23',
    shadowOpacity: nivel === 1 ? 0.06 : 0.12,
    shadowRadius: nivel === 1 ? 8 : 16,
    shadowOffset: { width: 0, height: nivel === 1 ? 2 : 6 },
  };
}

/** Cor da prioridade (0-100) para barra e marcador. */
export function corPrioridade(p: number): string {
  if (p >= 70) return '#C8341F';
  if (p >= 45) return '#D97706';
  return '#12806A';
}
