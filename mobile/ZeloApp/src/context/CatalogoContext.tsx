import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { catalogoApi } from '../services/zelo';
import type { Bairro, Categoria } from '../types';

interface ValorCatalogo {
  bairros: Bairro[];
  categorias: Categoria[];
  pronto: boolean;
  categoriaPorId: (id: number) => Categoria | undefined;
  bairroPorId: (id: number | null | undefined) => Bairro | undefined;
}

const CatalogoContext = createContext<ValorCatalogo | null>(null);
const CHAVE = 'zelo.catalogo.v1';

/**
 * Bairros e categorias sao carregados uma vez e ficam em memoria para o app
 * inteiro. A ultima copia tambem fica no AsyncStorage: o app abre com os
 * dados da vez anterior e so troca quando a resposta nova chega.
 */
export function CatalogoProvider({ children }: { children: React.ReactNode }) {
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const salvo = await AsyncStorage.getItem(CHAVE);
        if (salvo && ativo) {
          const c = JSON.parse(salvo);
          setBairros(c.bairros);
          setCategorias(c.categorias);
          setPronto(true);
        }
      } catch {
        // cache corrompido: ignora e busca da API
      }
      try {
        const [b, c] = await Promise.all([catalogoApi.bairros(), catalogoApi.categorias()]);
        if (!ativo) return;
        setBairros(b);
        setCategorias(c);
        setPronto(true);
        AsyncStorage.setItem(CHAVE, JSON.stringify({ bairros: b, categorias: c })).catch(() => {});
      } catch {
        if (ativo) setPronto(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const categoriaPorId = useCallback((id: number) => categorias.find((c) => c.id === id), [categorias]);
  const bairroPorId = useCallback(
    (id: number | null | undefined) => (id ? bairros.find((b) => b.id === id) : undefined),
    [bairros],
  );

  const valor = useMemo(
    () => ({ bairros, categorias, pronto, categoriaPorId, bairroPorId }),
    [bairros, categorias, pronto, categoriaPorId, bairroPorId],
  );
  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>;
}

export function useCatalogo(): ValorCatalogo {
  const ctx = useContext(CatalogoContext);
  if (!ctx) throw new Error('useCatalogo fora do CatalogoProvider');
  return ctx;
}
