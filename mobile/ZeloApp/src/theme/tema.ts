import { Platform, ViewStyle } from 'react-native';
import type { Status } from '../types';

/**
 * Identidade do Zelo, tirada do proprio mundo da zeladoria de Sao Paulo:
 * - azul da placa de rua (cor principal e o elemento-assinatura "placa");
 * - amarelo da sinalizacao viaria, guardado para a acao de relatar;
 * - cinza de pedra de calcada no fundo;
 * - Barlow, familia desenhada a partir das placas de transito.
 * Textos sobre o fundo claro ficam acima de 4.5:1 de contraste (WCAG AA).
 */
export const cores = {
  placa: '#1A4E9E',
  placaEscura: '#123A78',
  placaClara: '#E5EDF8',
  sinal: '#F7C51E',
  sinalEscuro: '#7A5B00',
  sinalClaro: '#FFF4CC',
  tinta: '#22262B',
  tintaSuave: '#4E545B',
  apagado: '#737980',
  linha: '#D9DBD3',
  linhaSuave: '#E6E7E1',
  fundo: '#ECEDE7',
  superficie: '#FFFFFF',
  branco: '#FFFFFF',
  perigo: '#C2331E',
  perigoClaro: '#FBE6E2',
  ok: '#1C7449',
  okClaro: '#DDF1E5',
};

export const fontes = {
  regular: 'Barlow_400Regular',
  media: 'Barlow_500Medium',
  semi: 'Barlow_600SemiBold',
  negrito: 'Barlow_700Bold',
  condensada: 'BarlowCondensed_600SemiBold',
  condensadaNegrito: 'BarlowCondensed_700Bold',
};

export const statusInfo: Record<Status, { rotulo: string; cor: string; fundo: string; passo: number }> = {
  ABERTA: { rotulo: 'Aberta', cor: '#8F5600', fundo: '#FFEFC2', passo: 1 },
  EM_ANALISE: { rotulo: 'Em análise', cor: '#1A4E9E', fundo: '#E5EDF8', passo: 2 },
  EM_ANDAMENTO: { rotulo: 'Em andamento', cor: '#5A3DB5', fundo: '#ECE7FB', passo: 3 },
  RESOLVIDA: { rotulo: 'Resolvida', cor: '#1C7449', fundo: '#DDF1E5', passo: 4 },
  CANCELADA: { rotulo: 'Cancelada', cor: '#5B6067', fundo: '#E9EAE6', passo: 0 },
};

/** Proximo passo permitido (espelha a regra transicao_valida do PL/SQL). */
export const proximosStatus: Record<Status, Status[]> = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['EM_ANDAMENTO', 'CANCELADA'],
  EM_ANDAMENTO: ['RESOLVIDA'],
  RESOLVIDA: [],
  CANCELADA: [],
};

/** Raios por hierarquia: placa e chip pequenos, folhas e fotos maiores. */
export const raio = { placa: 6, p: 10, m: 14, g: 22, total: 999 };

export const esp = (n: number) => n * 4;

export function sombra(nivel: 1 | 2 = 1): ViewStyle {
  if (Platform.OS === 'android') return { elevation: nivel === 1 ? 2 : 8 };
  if (Platform.OS === 'web') {
    return { boxShadow: nivel === 1 ? '0 1px 2px rgba(34,38,43,0.08)' : '0 -6px 24px rgba(34,38,43,0.12)' } as ViewStyle;
  }
  return {
    shadowColor: '#22262B',
    shadowOpacity: nivel === 1 ? 0.08 : 0.14,
    shadowRadius: nivel === 1 ? 3 : 18,
    shadowOffset: { width: 0, height: nivel === 1 ? 1 : -6 },
  };
}

/** Cor da prioridade (0-100) para barra e marcador. */
export function corPrioridade(p: number): string {
  if (p >= 70) return cores.perigo;
  if (p >= 45) return '#B26A00';
  return cores.placa;
}
