import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { History } from 'lucide-react-native';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { gestorApi } from '../services/zelo';
import { Divisor, Esqueleto, Faixa, Vazio } from '../components/ui';
import { cores, esp, fontes, raio } from '../theme/tema';
import { dataHora } from '../utils/formato';
import type { LogRotina } from '../types';

const NOMES: Record<string, string> = {
  REGISTRAR: 'Registro de ocorrência',
  DETECTAR_ATRASOS: 'Detecção de atrasos',
  RECALCULAR_PRIORIDADES: 'Reordenação da fila',
  GERAR_INDICADORES: 'Indicadores do mês',
  ROTINA_DIARIA: 'Rotina diária',
  JOB: 'Agendamento',
  CANCELAR_PELO_AUTOR: 'Cancelamento por quem relatou',
};

const NIVEL = {
  INFO: { cor: cores.ok, fundo: cores.okClaro, rotulo: 'ok' },
  AVISO: { cor: '#8F5600', fundo: '#FFEFC2', rotulo: 'aviso' },
  ERRO: { cor: cores.perigo, fundo: cores.perigoClaro, rotulo: 'erro' },
};

/** Ultimas execucoes registradas em ZL_LOG_ROTINA (transacao autonoma no banco). */
export default function LogsScreen() {
  const tx = useTexto();
  const [itens, setItens] = useState<LogRotina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErro(null);
    setCarregando(true);
    try {
      setItens(await gestorApi.logs(sinal));
    } catch (e) {
      if (!foiCancelada(e)) setErro((e as Error).message);
    } finally {
      if (!sinal?.aborted) setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      return () => controle.abort();
    }, [carregar]),
  );

  return (
    <FlatList
      data={itens}
      keyExtractor={(l, i) => `${l.data}-${i}`}
      contentContainerStyle={s.conteudo}
      refreshControl={<RefreshControl refreshing={carregando && itens.length > 0} onRefresh={() => carregar()} tintColor={cores.placa} />}
      ListHeaderComponent={
        <View style={{ gap: esp(3), marginBottom: esp(3) }}>
          <Text style={tx.corpo}>Cada execução das rotinas PL/SQL fica registrada, mesmo quando a operação principal é desfeita.</Text>
          {erro ? <Faixa tipo="erro" texto={erro} /> : null}
          {carregando && itens.length === 0 ? (
            <View style={s.bloco}>
              <Esqueleto linhas={4} />
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item: l, index }) => {
        const n = NIVEL[l.nivel] ?? NIVEL.INFO;
        return (
          <View
            style={[
              { backgroundColor: cores.superficie },
              index === 0 && { borderTopLeftRadius: raio.g, borderTopRightRadius: raio.g },
              index === itens.length - 1 && { borderBottomLeftRadius: raio.g, borderBottomRightRadius: raio.g },
            ]}
          >
            {index ? <Divisor estilo={{ marginHorizontal: esp(5) }} /> : null}
            <View style={s.item}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
                <Text style={[tx.corpoForte, { flex: 1 }]}>{NOMES[l.rotina] ?? l.rotina}</Text>
                <View style={[s.nivel, { backgroundColor: n.fundo }]}>
                  <Text style={[tx.legenda, { color: n.cor, fontFamily: fontes.semi }]}>{n.rotulo}</Text>
                </View>
              </View>
              <Text style={tx.corpo}>{l.mensagem}</Text>
              <Text style={tx.legenda}>{dataHora(l.data)}</Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={carregando ? null : <Vazio icone={History} titulo="Nenhuma execução ainda" texto="Rode a rotina diária na fila para registrar a primeira." />}
    />
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), paddingBottom: esp(12), maxWidth: 680, width: '100%', alignSelf: 'center' },
  bloco: { backgroundColor: cores.superficie, borderRadius: raio.g, padding: esp(5) },
  item: { padding: esp(5), gap: esp(1.5) },
  nivel: { paddingHorizontal: esp(2), paddingVertical: 2, borderRadius: raio.placa },
});
