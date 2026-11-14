import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apagarToken, ErroApi, lerToken, salvarToken } from '../config/api';
import { authApi } from '../services/zelo';
import type { Usuario } from '../types';

interface ValorAuth {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string, bairroId: number) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  definirFonteGrande: (ligada: boolean) => Promise<void>;
}

const AuthContext = createContext<ValorAuth | null>(null);

/**
 * Sessao do usuario. Ao abrir o app, se ha token salvo, o perfil e
 * buscado de novo: assim pontos e preferencias chegam atualizados.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        if (await lerToken()) setUsuario(await authApi.eu(controle.signal));
      } catch (e) {
        // Token vencido ou invalido: volta para a tela de entrada.
        if (e instanceof ErroApi && e.status === 401) await apagarToken();
      } finally {
        if (!controle.signal.aborted) setCarregando(false);
      }
    })();
    return () => controle.abort();
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await authApi.entrar(email.trim(), senha);
    await salvarToken(r.token);
    setUsuario(r.usuario);
  }, []);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string, bairroId: number) => {
    const r = await authApi.cadastrar(nome.trim(), email.trim(), senha, bairroId);
    await salvarToken(r.token);
    setUsuario(r.usuario);
  }, []);

  const sair = useCallback(async () => {
    await apagarToken();
    setUsuario(null);
  }, []);

  const recarregar = useCallback(async () => {
    setUsuario(await authApi.eu());
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

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, cadastrar, sair, recarregar, definirFonteGrande }),
    [usuario, carregando, entrar, cadastrar, sair, recarregar, definirFonteGrande],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ValorAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
