import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apagarToken, ErroApi, lerToken, salvarToken } from '../config/api';
import { authApi, notificacaoApi } from '../services/zelo';
import type { Usuario } from '../types';

interface ValorAuth {
  usuario: Usuario | null;
  carregando: boolean;
  /** Ha sessao salva, mas o servidor nao respondeu ao abrir o app. */
  semConexao: boolean;
  tentarDeNovo: () => void;
  naoLidas: number;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string, bairroId: number) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  atualizarNaoLidas: () => Promise<void>;
  definirFonteGrande: (ligada: boolean) => Promise<void>;
  atualizarPerfil: (nome: string, bairroId: number) => Promise<void>;
  trocarSenha: (atual: string, nova: string) => Promise<void>;
}

const AuthContext = createContext<ValorAuth | null>(null);

/**
 * Sessao do usuario. Ao abrir o app com token salvo, o perfil e buscado de
 * novo (pontos, preferencias e notificacoes chegam atualizados). O
 * contador de nao lidas mora aqui para o sininho de qualquer tela ler o
 * mesmo numero.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const [semConexao, setSemConexao] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const aplicar = useCallback((u: Usuario | null) => {
    setUsuario(u);
    setNaoLidas(u?.naoLidas ?? 0);
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      setSemConexao(false);
      try {
        if (await lerToken()) aplicar(await authApi.eu(controle.signal));
      } catch (e) {
        // 401: sessao vencida, volta para a entrada. Outro erro com sessao
        // salva: e falta de conexao; mostra isso em vez da tela de login.
        if (e instanceof ErroApi && e.status === 401) await apagarToken();
        else if (!controle.signal.aborted) setSemConexao(true);
      } finally {
        if (!controle.signal.aborted) setCarregando(false);
      }
    })();
    return () => controle.abort();
  }, [aplicar, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setCarregando(true);
    setTentativa((t) => t + 1);
  }, []);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const r = await authApi.entrar(email.trim(), senha);
      await salvarToken(r.token);
      aplicar(r.usuario);
    },
    [aplicar],
  );

  const cadastrar = useCallback(
    async (nome: string, email: string, senha: string, bairroId: number) => {
      const r = await authApi.cadastrar(nome.trim(), email.trim(), senha, bairroId);
      await salvarToken(r.token);
      aplicar(r.usuario);
    },
    [aplicar],
  );

  const sair = useCallback(async () => {
    await apagarToken();
    aplicar(null);
  }, [aplicar]);

  const recarregar = useCallback(async () => {
    aplicar(await authApi.eu());
  }, [aplicar]);

  const atualizarNaoLidas = useCallback(async () => {
    try {
      setNaoLidas((await notificacaoApi.naoLidas()).total);
    } catch {
      // contador e informativo: falha de rede nao interrompe a tela
    }
  }, []);

  const definirFonteGrande = useCallback(async (ligada: boolean) => {
    // Atualiza a tela na hora e confirma no servidor em seguida.
    setUsuario((u) => (u ? { ...u, fonteGrande: ligada } : u));
    try {
      setUsuario(await authApi.preferencias(ligada));
    } catch {
      setUsuario((u) => (u ? { ...u, fonteGrande: !ligada } : u));
    }
  }, []);

  const atualizarPerfil = useCallback(
    async (nome: string, bairroId: number) => {
      aplicar(await authApi.atualizar(nome.trim(), bairroId));
    },
    [aplicar],
  );

  const trocarSenha = useCallback(async (atual: string, nova: string) => {
    await authApi.trocarSenha(atual, nova);
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      semConexao,
      tentarDeNovo,
      naoLidas,
      entrar,
      cadastrar,
      sair,
      recarregar,
      atualizarNaoLidas,
      definirFonteGrande,
      atualizarPerfil,
      trocarSenha,
    }),
    [usuario, carregando, semConexao, tentarDeNovo, naoLidas, entrar, cadastrar, sair, recarregar, atualizarNaoLidas, definirFonteGrande, atualizarPerfil, trocarSenha],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ValorAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
