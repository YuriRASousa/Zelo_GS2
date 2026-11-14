import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ClipboardList, Plus, ThumbsUp } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { ocorrenciaApi } from '../services/zelo';
import OcorrenciaCard from '../components/OcorrenciaCard';
import { Botao, BotaoIcone, Divisor, Esqueleto, Faixa, Vazio } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import type { RaizParams } from '../navigation/tipos';

/** Acompanhamento: o que eu relatei e o que eu apoiei, com resumo por situacao. */
export default function MinhasScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { naoLidas, atualizarNaoLidas } = useAuth();
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
      atualizarNaoLidas();
      return () => controle.abort();
    }, [carregar, atualizarNaoLidas]),
  );

  const abrir = useCallback((id: number) => navegacao.navigate('Detalhe', { id }), [navegacao]);
  const emAberto = itens.filter((i) => ['ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO'].includes(i.status)).length;
  const resolvidas = itens.filter((i) => i.status === 'RESOLVIDA').length;
  const atrasadas = itens.filter((i) => i.atrasada).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={carregando && itens.length === 0 ? [] : itens}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item, index }) => (
          <View style={[s.linha, index === 0 && s.primeira, index === itens.length - 1 && s.ultima]}>
            {index ? <Divisor estilo={{ marginLeft: esp(5) + 46 + esp(3) }} /> : null}
            <OcorrenciaCard item={item} onAbrir={abrir} />
          </View>
        )}
        contentContainerStyle={s.conteudo}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={carregando && itens.length > 0} onRefresh={() => carregar()} tintColor={cores.placa} />}
        ListHeaderComponent={
          <View style={{ gap: esp(4), marginBottom: esp(4) }}>
            <View style={s.titulo}>
              <Text style={[tx.titulo, { flex: 1 }]} accessibilityRole="header">
                Meus pedidos
              </Text>
              <BotaoIcone icone={Bell} rotulo="Notificações" contador={naoLidas} onPress={() => navegacao.navigate('Notificacoes')} />
            </View>
            <View style={s.segmento} accessibilityRole="tablist">
              {(
                [
                  ['relatei', 'Que eu relatei', ClipboardList],
                  ['apoiei', 'Que eu apoiei', ThumbsUp],
                ] as const
              ).map(([chave, rotulo, Icone]) => (
                <Pressable
                  key={chave}
                  onPress={() => setAba(chave)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: aba === chave }}
                  aria-selected={aba === chave}
                  style={[s.opcao, aba === chave && s.opcaoAtiva]}
                >
                  <Icone size={17} color={aba === chave ? cores.tinta : cores.apagado} />
                  <Text style={[tx.corpoForte, { color: aba === chave ? cores.tinta : cores.apagado }]}>{rotulo}</Text>
                </Pressable>
              ))}
            </View>
            {!carregando && itens.length > 0 ? (
              <View style={s.resumo} accessibilityLabel={`${emAberto} em aberto, ${atrasadas} com prazo vencido, ${resolvidas} resolvidas`}>
                <Numero valor={emAberto} rotulo="em aberto" />
                <View style={s.sep} />
                <Numero valor={atrasadas} rotulo="prazo vencido" cor={atrasadas ? cores.perigo : undefined} />
                <View style={s.sep} />
                <Numero valor={resolvidas} rotulo="resolvidas" cor={cores.ok} />
              </View>
            ) : null}
            {erro ? <Faixa tipo="erro" texto={erro} /> : null}
            {carregando && itens.length === 0 ? (
              <View style={s.bloco}>
                <Esqueleto linhas={3} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          carregando ? null : aba === 'relatei' ? (
            <Vazio
              icone={ClipboardList}
              titulo="Você ainda não relatou nada"
              texto="Quando vir um problema na rua, relate com foto e local. Ele aparece aqui com prazo e linha do tempo."
              acao={<Botao titulo="Relatar um problema" icone={Plus} variante="sinal" onPress={() => navegacao.navigate('Nova')} />}
            />
          ) : (
            <Vazio
              icone={ThumbsUp}
              titulo="Nenhum apoio ainda"
              texto="No mapa, abra um problema que você também viu e toque em Também vi esse problema."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor?: string }) {
  const tx = useTexto();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[tx.numero, { fontSize: Math.round(30 * tx.escala) }, cor ? { color: cor } : null]}>{valor}</Text>
      <Text style={tx.legenda}>{rotulo}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), paddingBottom: esp(20), maxWidth: 680, width: '100%', alignSelf: 'center' },
  titulo: { flexDirection: 'row', alignItems: 'center', paddingTop: esp(2) },
  segmento: { flexDirection: 'row', backgroundColor: cores.linhaSuave, borderRadius: raio.p, padding: 4 },
  opcao: { flex: 1, flexDirection: 'row', gap: esp(2), minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: raio.p - 3 },
  opcaoAtiva: { backgroundColor: cores.superficie },
  resumo: { flexDirection: 'row', backgroundColor: cores.superficie, borderRadius: raio.g, paddingVertical: esp(4) },
  sep: { width: 1, backgroundColor: cores.linhaSuave },
  bloco: { backgroundColor: cores.superficie, borderRadius: raio.g, padding: esp(5) },
  linha: { backgroundColor: cores.superficie },
  primeira: { borderTopLeftRadius: raio.g, borderTopRightRadius: raio.g, overflow: 'hidden' },
  ultima: { borderBottomLeftRadius: raio.g, borderBottomRightRadius: raio.g, overflow: 'hidden' },
});
