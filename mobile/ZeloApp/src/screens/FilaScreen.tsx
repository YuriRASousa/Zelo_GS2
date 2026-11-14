import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, History, Hourglass, Inbox, Play } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { gestorApi } from '../services/zelo';
import OcorrenciaCard from '../components/OcorrenciaCard';
import { Bloco, Botao, Chip, Divisor, Esqueleto, Faixa, Vazio } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import { mesPorExtenso } from '../utils/formato';
import type { RaizParams } from '../navigation/tipos';

/**
 * Area do gestor: fila ordenada pela prioridade calculada no banco, com
 * filtros por bairro, categoria e atraso, e o botao que roda a rotina
 * diaria (PKG_ZL_INDICADOR) sob demanda.
 */
export default function FilaScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { atualizarNaoLidas } = useAuth();
  const { bairros, categorias } = useCatalogo();
  const tx = useTexto();
  const [itens, setItens] = useState<OcorrenciaResumo[]>([]);
  const [bairroId, setBairroId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      setErro(null);
      setCarregando(true);
      try {
        setItens(await gestorApi.fila({ bairroId, categoriaId, somenteAtrasadas }, sinal));
      } catch (e) {
        if (!foiCancelada(e)) setErro((e as Error).message);
      } finally {
        if (!sinal?.aborted) setCarregando(false);
      }
    },
    [bairroId, categoriaId, somenteAtrasadas],
  );

  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      atualizarNaoLidas();
      return () => controle.abort();
    }, [carregar, atualizarNaoLidas]),
  );

  async function rodarRotinas() {
    setRodando(true);
    setResultado(null);
    setErro(null);
    try {
      const r = await gestorApi.rotinas();
      const n = (q: number, um: string, varios: string) => (q === 1 ? `1 ${um}` : `${q} ${varios}`);
      setResultado(
        `Rotina concluída: ${n(r.atrasosDetectados, 'atraso novo marcado e avisado', 'atrasos novos marcados e avisados')}, ` +
          `${n(r.prioridadesAjustadas, 'prioridade reordenada', 'prioridades reordenadas')} e indicadores de ${mesPorExtenso(r.mes)} ` +
          `consolidados em ${r.bairrosConsolidados} bairros.`,
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
  const filtrando = !!bairroId || !!categoriaId || somenteAtrasadas;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={carregando && itens.length === 0 ? [] : itens}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item, index }) => (
          <View
            style={[
              { backgroundColor: cores.superficie },
              index === 0 && { borderTopLeftRadius: raio.g, borderTopRightRadius: raio.g, overflow: 'hidden' },
              index === itens.length - 1 && { borderBottomLeftRadius: raio.g, borderBottomRightRadius: raio.g, overflow: 'hidden' },
            ]}
          >
            {index ? <Divisor estilo={{ marginLeft: esp(5) + 46 + esp(3) }} /> : null}
            <OcorrenciaCard item={item} onAbrir={abrir} mostrarPrioridade />
          </View>
        )}
        contentContainerStyle={s.conteudo}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={carregando && itens.length > 0} onRefresh={() => carregar()} tintColor={cores.placa} />}
        ListHeaderComponent={
          <View style={{ gap: esp(4), marginBottom: esp(4) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: esp(2) }}>
              <View style={{ flex: 1 }}>
                <Text style={tx.titulo} accessibilityRole="header">
                  Fila de atendimento
                </Text>
                <Text style={tx.corpo}>
                  {carregando ? 'Atualizando' : `${itens.length} em aberto, ${atrasadas} com prazo vencido`}
                </Text>
              </View>

            </View>

            <Bloco estilo={{ gap: esp(3), paddingVertical: esp(4) }}>
              <Text style={tx.legenda}>
                Rotina do banco: marca e avisa atrasos, reordena a fila e fecha os indicadores do mês.
              </Text>
              <View style={{ flexDirection: 'row', gap: esp(2) }}>
                <Botao titulo="Rodar rotina agora" icone={Play} onPress={rodarRotinas} carregando={rodando} compacto estilo={{ flex: 1 }} />
                <Botao titulo="Histórico" icone={History} variante="secundario" compacto onPress={() => navegacao.navigate('Logs')} />
              </View>
            </Bloco>
            {resultado ? <Faixa tipo="sucesso" texto={resultado} /> : null}
            {erro ? <Faixa tipo="erro" texto={erro} /> : null}

            <View style={{ gap: esp(2) }}>
              <Text style={tx.rotulo}>Filtrar</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={[{ id: 0, nome: 'Todos os bairros' }, ...bairros]}
                keyExtractor={(b) => `b${b.id}`}
                contentContainerStyle={{ gap: esp(2) }}
                renderItem={({ item: b }) => <Chip texto={b.nome} ativo={(bairroId ?? 0) === b.id} onPress={() => setBairroId(b.id || null)} />}
              />
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={[{ id: -1, nome: 'Só atrasadas' }, { id: 0, nome: 'Todas as categorias' }, ...categorias]}
                keyExtractor={(c) => `c${c.id}`}
                contentContainerStyle={{ gap: esp(2) }}
                renderItem={({ item: c }) =>
                  c.id === -1 ? (
                    <Chip
                      texto={c.nome}
                      ativo={somenteAtrasadas}
                      icone={somenteAtrasadas ? Check : Hourglass}
                      onPress={() => setSomenteAtrasadas((v) => !v)}
                    />
                  ) : (
                    <Chip texto={c.nome} ativo={(categoriaId ?? 0) === c.id} onPress={() => setCategoriaId(c.id || null)} />
                  )
                }
              />
            </View>
            {carregando && itens.length === 0 ? (
              <Bloco>
                <Esqueleto linhas={4} />
              </Bloco>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          carregando ? null : filtrando ? (
            <Vazio icone={Inbox} titulo="Nada com esses filtros" texto="Troque o bairro ou a categoria para ver outras ocorrências." />
          ) : (
            <Vazio icone={Inbox} titulo="Fila vazia" texto="Nenhuma ocorrência aguardando atendimento." />
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), paddingBottom: esp(20), maxWidth: 720, width: '100%', alignSelf: 'center' },
});
