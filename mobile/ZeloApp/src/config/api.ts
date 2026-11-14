import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cliente HTTP do app. Concentra endereco da API, token, timeout e o
 * formato de erro, para nenhuma tela precisar repetir isso.
 */

/** Endereco da API. EXPO_PUBLIC_API_URL permite apontar para outro servidor sem recompilar. */
export function urlBase(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL;
  if (configurada) return configurada;
  // O emulador Android enxerga o computador pelo alias 10.0.2.2.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080/api' : 'http://localhost:8080/api';
}

/** Endereco publico do app (links compartilhados). */
export function urlWeb(): string {
  const configurada = process.env.EXPO_PUBLIC_WEB_URL;
  if (configurada) return configurada;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:8082';
}

export function urlFoto(nome: string): string {
  return `${urlBase()}/fotos/${nome}`;
}

const CHAVE_TOKEN = 'zelo.token';

/**
 * Token guardado em memoria depois da primeira leitura: o AsyncStorage e
 * assincrono e mais lento, e o token e lido em toda requisicao.
 */
let tokenEmMemoria: string | null | undefined;

export async function lerToken(): Promise<string | null> {
  if (tokenEmMemoria === undefined) {
    tokenEmMemoria = await AsyncStorage.getItem(CHAVE_TOKEN);
  }
  return tokenEmMemoria;
}

export async function salvarToken(token: string): Promise<void> {
  tokenEmMemoria = token;
  await AsyncStorage.setItem(CHAVE_TOKEN, token);
}

export async function apagarToken(): Promise<void> {
  tokenEmMemoria = null;
  await AsyncStorage.removeItem(CHAVE_TOKEN);
}

/** Erro com a mensagem que a API (ou o PL/SQL) escreveu para o cidadao. */
export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
    public referenciaId: number | null = null,
  ) {
    super(message);
  }
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT';

interface Opcoes {
  corpo?: unknown;
  /** Permite cancelar a requisicao quando a tela e fechada. */
  sinal?: AbortSignal;
  timeoutMs?: number;
}

async function requisitar<T>(metodo: Metodo, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  const token = await lerToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  // Timeout proprio, encadeado ao sinal da tela: o que acontecer primeiro cancela.
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), opcoes.timeoutMs ?? 20000);
  const repassar = () => controle.abort();
  opcoes.sinal?.addEventListener('abort', repassar);

  try {
    const resposta = await fetch(`${urlBase()}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      signal: controle.signal,
    });
    const texto = await resposta.text();
    const dados = texto ? JSON.parse(texto) : null;
    if (!resposta.ok) {
      const mensagem =
        dados?.mensagem ??
        (resposta.status === 401 ? 'Sua sessao expirou. Entre de novo.' : `Erro ${resposta.status} no servidor.`);
      throw new ErroApi(resposta.status, mensagem, dados?.referenciaId ?? null);
    }
    return dados as T;
  } catch (e) {
    if (e instanceof ErroApi) throw e;
    if ((e as Error).name === 'AbortError') {
      throw new ErroApi(0, opcoes.sinal?.aborted ? 'cancelada' : 'O servidor demorou para responder.');
    }
    throw new ErroApi(0, 'Sem conexão com o servidor do Zelo. Confira a internet e tente de novo.');
  } finally {
    clearTimeout(timer);
    opcoes.sinal?.removeEventListener('abort', repassar);
  }
}

export const api = {
  get: <T>(caminho: string, sinal?: AbortSignal) => requisitar<T>('GET', caminho, { sinal }),
  post: <T>(caminho: string, corpo?: unknown, timeoutMs?: number) =>
    requisitar<T>('POST', caminho, { corpo: corpo ?? {}, timeoutMs }),
  patch: <T>(caminho: string, corpo: unknown) => requisitar<T>('PATCH', caminho, { corpo }),
  put: <T>(caminho: string, corpo: unknown) => requisitar<T>('PUT', caminho, { corpo }),
};

/** Requisicao cancelada porque a tela fechou: nao e erro para mostrar. */
export function foiCancelada(e: unknown): boolean {
  return e instanceof ErroApi && e.status === 0 && e.message === 'cancelada';
}
