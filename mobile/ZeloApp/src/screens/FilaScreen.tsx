import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Inbox, Play } from 'lucide-react-native';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { gestorApi } from '../services/zelo';
import OcorrenciaCard from '../components/OcorrenciaCard';
import { Botao, Cartao, Faixa, Vazio } from '../components/ui';
import { cores, esp } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import type { RaizParams } from '../navigation/tipos';

/**
 * Area do gestor: fila ordenada pela prioridade calculada no banco e o
 * botao que roda a rotina diaria (PKG_ZL_INDICADOR) sob demanda.
 */
export default function FilaScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const tx = useTexto();
  const [itens, setItens] = useState<OcorrenciaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErro(null);
    try {
      setItens(await gestorApi.fila(sinal));
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

  async function rodarRotinas() {
    setRodando(true);
    setResultado(null);
    setErro(null);
    try {
      const r = await gestorApi.rotinas();
      setResultado(
        `${r.atrasosDetectados} atraso(s) marcados na linha do tempo, ${r.prioridadesAjustadas} prioridade(s) ajustadas e indicadores de ${r.mes} consolidados para ${r.bairrosConsolidados} bairros.`,
      );
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  const abrir = useCallback((id: number) => navegacao.navigate('Detalhe', { id }), [navegacao]);
  const atrasadas = itens.filter((i) => i.atrasada).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={itens}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => <OcorrenciaCard item={item} onAbrir={abrir} mostrarPrioridade />}
        ItemSeparatorComponent={() => <View style={{ height: esp(3) }} />}
        contentContainerStyle={s.conteudo}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => carregar()} tintColor={cores.primaria} />}
        ListHeaderComponent={
          <View style={{ gap: esp(3), marginBottom: esp(3) }}>
            <View>
              <Text style={tx.titulo} accessibilityRole="header">
                Fila de atendimento
              </Text>
              <Text style={tx.corpo}>
                {itens.length} em aberto · {atrasadas} com prazo vencido. Ordem definida pela prioridade calculada no banco.
              </Text>
            </View>
            <Cartao estilo={{ gap: esp(3) }}>
              <Text style={tx.corpoForte}>Rotina diária</Text>
              <Text style={tx.legenda}>
                Marca atrasos, recalcula prioridades e consolida os indicadores do mês (pacote PL/SQL PKG_ZL_INDICADOR).
              </Text>
              <Botao titulo="Rodar rotinas agora" icone={Play} variante="destaque" onPress={rodarRotinas} carregando={rodando} />
            </Cartao>
            {resultado ? <Faixa tipo="sucesso" texto={resultado} /> : null}
            {erro ? <Faixa tipo="erro" texto={erro} /> : null}
          </View>
        }
        ListEmptyComponent={
          carregando ? null : <Vazio icone={Inbox} titulo="Fila vazia" texto="Nenhuma ocorrência aguardando atendimento." />
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), paddingBottom: esp(12), maxWidth: 720, width: '100%', alignSelf: 'center' },
});
