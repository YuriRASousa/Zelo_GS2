import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ClipboardList, ThumbsUp } from 'lucide-react-native';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { ocorrenciaApi } from '../services/zelo';
import OcorrenciaCard from '../components/OcorrenciaCard';
import { Faixa, Vazio } from '../components/ui';
import { cores, esp, raio, sombra } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import type { RaizParams } from '../navigation/tipos';

/** Acompanhamento: o que eu relatei e o que eu apoiei. */
export default function MinhasScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const tx = useTexto();
  const [aba, setAba] = useState<'relatei' | 'apoiei'>('relatei');
  const [itens, setItens] = useState<OcorrenciaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      setErro(null);
      setCarregando(true);
      try {
        setItens(aba === 'relatei' ? await ocorrenciaApi.minhas(sinal) : await ocorrenciaApi.apoiadas(sinal));
      } catch (e) {
        if (!foiCancelada(e)) setErro((e as Error).message);
      } finally {
        if (!sinal?.aborted) setCarregando(false);
      }
    },
    [aba],
  );

  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      return () => controle.abort();
    }, [carregar]),
  );

  const abrir = useCallback((id: number) => navegacao.navigate('Detalhe', { id }), [navegacao]);
  const resolvidas = itens.filter((i) => i.status === 'RESOLVIDA').length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ padding: esp(4), gap: esp(3) }}>
        <Text style={tx.titulo} accessibilityRole="header">
          Acompanhar
        </Text>
        <View style={s.segmento} accessibilityRole="tablist">
          {([
            ['relatei', 'Relatei', ClipboardList],
            ['apoiei', 'Apoiei', ThumbsUp],
          ] as const).map(([chave, rotulo, Icone]) => (
            <Pressable
              key={chave}
              onPress={() => setAba(chave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: aba === chave }}
              style={[s.opcao, aba === chave && s.opcaoAtiva]}
            >
              <Icone size={17} color={aba === chave ? cores.primaria : cores.apagado} />
              <Text style={[tx.corpoForte, { color: aba === chave ? cores.primaria : cores.apagado }]}>{rotulo}</Text>
            </Pressable>
          ))}
        </View>
        {!carregando && itens.length > 0 ? (
          <Text style={tx.legenda}>
            {itens.length} ocorrência{itens.length > 1 ? 's' : ''}, {resolvidas} resolvida{resolvidas === 1 ? '' : 's'}
          </Text>
        ) : null}
        {erro ? <Faixa tipo="erro" texto={erro} /> : null}
      </View>
      <FlatList
        data={itens}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => <OcorrenciaCard item={item} onAbrir={abrir} />}
        ItemSeparatorComponent={() => <View style={{ height: esp(3) }} />}
        contentContainerStyle={{ paddingHorizontal: esp(4), paddingBottom: esp(10) }}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => carregar()} tintColor={cores.primaria} />}
        ListEmptyComponent={
          carregando ? null : aba === 'relatei' ? (
            <Vazio icone={ClipboardList} titulo="Nada relatado ainda" texto="Use o botão + para relatar o primeiro problema da sua rua." />
          ) : (
            <Vazio icone={ThumbsUp} titulo="Nenhum apoio ainda" texto="Abra o mapa e confirme os problemas que você também viu." />
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  segmento: { flexDirection: 'row', backgroundColor: cores.linha, borderRadius: raio.m, padding: 4 },
  opcao: {
    flex: 1,
    flexDirection: 'row',
    gap: esp(2),
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.p,
  },
  opcaoAtiva: { backgroundColor: cores.branco, ...sombra(1) },
});
