import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { Award, RefreshCw, WifiOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { painelApi } from '../services/zelo';
import IconeCategoria from '../components/Icone';
import { Bloco, Botao, Carregando, Chip, Divisor, Faixa, Vazio } from '../components/ui';
import { cores, esp, fontes, raio } from '../theme/tema';
import { dataCurta, mesPorExtenso, pct } from '../utils/formato';
import type { Painel } from '../types';

/** Tom claro do azul da placa para "em aberto" (o amarelo fica so para relatar e apoiar). */
const COR_ABERTO = '#9DB5DD';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Funcionalidade 4: painel da transparencia. Numeros ao vivo e os
 * indicadores mensais consolidados pela rotina PL/SQL gerar_indicadores.
 */
export default function PainelScreen() {
  const { usuario } = useAuth();
  const { bairros } = useCatalogo();
  const tx = useTexto();
  const [bairroId, setBairroId] = useState<number | null>(usuario?.papel === 'GESTOR' ? null : usuario?.bairroId ?? null);
  const [dados, setDados] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [largura, setLargura] = useState(320);
  const chips = useRef<FlatList<{ id: number; nome: string }>>(null);

  // Mostra o chip do bairro selecionado (pode estar fora da tela a direita).
  useEffect(() => {
    const i = bairroId ? bairros.findIndex((b) => b.id === bairroId) + 1 : 0;
    if (i <= 0 || !bairros.length) return;
    const t = setTimeout(() => chips.current?.scrollToIndex({ index: i, viewPosition: 0.5, animated: false }), 50);
    return () => clearTimeout(t);
    // so na montagem e quando o catalogo chega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bairros.length]);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      setErro(null);
      setCarregando(true);
      try {
        setDados(await painelApi.painel(bairroId, sinal));
      } catch (e) {
        if (!foiCancelada(e)) setErro((e as Error).message);
      } finally {
        if (!sinal?.aborted) setCarregando(false);
      }
    },
    [bairroId],
  );

  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      return () => controle.abort();
    }, [carregar]),
  );

  const maiorCategoria = Math.max(1, ...(dados?.categorias.map((c) => c.total) ?? [1]));
  const meses = [...(dados?.meses ?? [])].reverse();
  const ultimo = dados?.meses[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView
        contentContainerStyle={s.conteudo}
        refreshControl={<RefreshControl refreshing={carregando && !!dados} onRefresh={() => carregar()} tintColor={cores.placa} />}
      >
        <View style={{ gap: esp(1), paddingTop: esp(2) }}>
          <Text style={tx.titulo} accessibilityRole="header">
            Painel da transparência
          </Text>
          <Text style={tx.corpo}>Quanto a prefeitura resolve e em quanto tempo, em números públicos.</Text>
        </View>

        <FlatList
          ref={chips}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
          data={[{ id: 0, nome: 'Cidade toda' }, ...bairros]}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={{ gap: esp(2) }}
          style={{ flexGrow: 0 }}
          renderItem={({ item: b }) => (
            <Chip texto={b.nome} ativo={(bairroId ?? 0) === b.id} onPress={() => setBairroId(b.id || null)} />
          )}
        />

        {erro && dados ? <Faixa tipo="erro" texto={erro} /> : null}
        {erro && !dados ? (
          <Vazio
            icone={WifiOff}
            titulo="Não deu para carregar o painel"
            texto={erro}
            acao={<Botao titulo="Tentar de novo" icone={RefreshCw} variante="secundario" compacto onPress={() => carregar()} />}
          />
        ) : !dados ? (
          <Carregando />
        ) : (
          <>
            <Bloco estilo={s.kpis}>
              <Kpi valor={String(dados.agora.emAberto)} rotulo="em aberto agora" />
              <View style={s.sepV} />
              <Kpi valor={String(dados.agora.atrasadas)} rotulo="com prazo vencido" cor={dados.agora.atrasadas ? cores.perigo : undefined} />
              <View style={s.sepH} />
              <Kpi valor={String(dados.agora.resolvidas)} rotulo="resolvidas" cor={cores.ok} />
              <View style={s.sepV} />
              <Kpi valor={pct(dados.agora.pcNoPrazo)} rotulo="no prazo, desde o início" />
            </Bloco>

            <Bloco estilo={{ gap: esp(4) }}>
              <View style={{ gap: esp(1) }}>
                <Text style={tx.tituloMenor}>Mês a mês</Text>
                <Text style={tx.legenda}>Relatadas e resolvidas por mês, consolidadas pela rotina diária do banco.</Text>
              </View>
              {meses.length === 0 ? (
                <Text style={tx.corpo}>Os números aparecem depois da primeira rotina mensal.</Text>
              ) : (
                <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
                  <Grafico meses={meses} largura={largura} />
                  <View style={{ flexDirection: 'row', gap: esp(4), marginTop: esp(2) }}>
                    <Legenda cor={cores.linha} texto="relatadas" />
                    <Legenda cor={cores.placa} texto="resolvidas" />
                  </View>
                </View>
              )}
              {ultimo ? (
                <>
                  <Divisor />
                  <View style={s.mesAtual}>
                    <Mini valor={ultimo.tempoMedioDias != null ? `${ultimo.tempoMedioDias.toLocaleString('pt-BR')} d` : '–'} rotulo="tempo médio" />
                    <Mini valor={pct(ultimo.pcNoPrazo)} rotulo="no prazo no mês" />
                    <Mini valor={ultimo.notaMedia != null ? ultimo.notaMedia.toLocaleString('pt-BR') : '–'} rotulo="nota média" />
                    <Mini valor={String(ultimo.atrasadas)} rotulo="atrasaram" />
                  </View>
                  <Text style={tx.legenda}>
                    Números de {mesPorExtenso(ultimo.mes)}, consolidados em {dataCurta(ultimo.geradoEm)} pela rotina diária. O mês atual entra quando a rotina roda.
                  </Text>
                </>
              ) : null}
            </Bloco>

            <Bloco estilo={{ gap: esp(4) }}>
              <Text style={tx.tituloMenor}>Problemas mais relatados</Text>
              {dados.categorias.length === 0 ? <Text style={tx.corpo}>Nenhuma ocorrência neste bairro ainda.</Text> : null}
              {dados.categorias.map((c) => (
                <View key={c.categoria} style={{ gap: esp(2) }} accessibilityLabel={`${c.categoria}: ${c.total} no total, ${c.emAberto} em aberto, ${c.resolvidas} resolvidas`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
                    <IconeCategoria nome={c.icone} tamanho={17} />
                    <Text style={[tx.corpoForte, { flex: 1 }]}>{c.categoria}</Text>
                    <Text style={tx.legenda}>
                      {c.emAberto} em aberto de {c.total}
                    </Text>
                  </View>
                  <View style={s.trilho}>
                    <View style={[s.barra, { width: `${(c.resolvidas / maiorCategoria) * 100}%`, backgroundColor: cores.placa }]} />
                    <View style={[s.barra, { width: `${(c.emAberto / maiorCategoria) * 100}%`, backgroundColor: COR_ABERTO }]} />
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: esp(4) }}>
                <Legenda cor={cores.placa} texto="resolvidas" />
                <Legenda cor={COR_ABERTO} texto="em aberto" />
              </View>
            </Bloco>

            {dados.cidadaos.length > 0 ? (
              <Bloco estilo={{ gap: esp(1) }}>
                <Text style={[tx.tituloMenor, { marginBottom: esp(2) }]}>Vizinhos mais participativos</Text>
                {dados.cidadaos.map((c, i) => (
                  <View key={`${c.nome}-${i}`}>
                    {i ? <Divisor /> : null}
                    <View style={s.ranking}>
                      <Text style={[s.posicao, i === 0 && { color: cores.sinalEscuro }]}>{i + 1}</Text>
                      <Text style={[tx.corpoForte, { flex: 1 }]}>{c.nome}</Text>
                      <Award size={16} color={cores.sinalEscuro} />
                      <Text style={[tx.corpoForte, { color: cores.sinalEscuro }]}>{c.pontos} pts</Text>
                    </View>
                  </View>
                ))}
              </Bloco>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Barras agrupadas em SVG: cinza para relatadas, azul para resolvidas. */
function Grafico({ meses, largura }: { meses: Painel['meses']; largura: number }) {
  const altura = 170;
  const base = altura - 24;
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.abertas, m.resolvidas]));
  const grupo = largura / meses.length;
  const barra = Math.min(18, grupo / 3.2);
  return (
    <Svg
      width={largura}
      height={altura}
      accessibilityLabel={meses.map((m) => `${m.mes}: ${m.abertas} relatadas, ${m.resolvidas} resolvidas`).join('; ')}
    >
      <Line x1={0} y1={base} x2={largura} y2={base} stroke={cores.linha} strokeWidth={1} />
      {meses.map((m, i) => {
        const cx = grupo * i + grupo / 2;
        const ha = (m.abertas / maximo) * (base - 22);
        const hr = (m.resolvidas / maximo) * (base - 22);
        const rotulo = MESES[Number(m.mes.slice(5)) - 1];
        return (
          <React.Fragment key={m.mes}>
            <Rect x={cx - barra - 2} y={base - ha} width={barra} height={ha} rx={3} fill={cores.linha} />
            <Rect x={cx + 2} y={base - hr} width={barra} height={hr} rx={3} fill={cores.placa} />
            <SvgText x={cx - barra / 2 - 2} y={base - ha - 5} fontSize={11} fill={cores.tintaSuave} textAnchor="middle" fontFamily={fontes.semi}>
              {m.abertas}
            </SvgText>
            <SvgText x={cx + barra / 2 + 2} y={base - hr - 5} fontSize={11} fill={cores.placa} textAnchor="middle" fontFamily={fontes.semi}>
              {m.resolvidas}
            </SvgText>
            <SvgText x={cx} y={altura - 6} fontSize={12} fill={cores.tintaSuave} textAnchor="middle" fontFamily={fontes.media}>
              {rotulo}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function Kpi({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  const tx = useTexto();
  return (
    <View style={s.kpi} accessibilityLabel={`${valor} ${rotulo}`}>
      <Text style={[tx.numero, cor ? { color: cor } : null]}>{valor}</Text>
      <Text style={tx.legenda}>{rotulo}</Text>
    </View>
  );
}

function Mini({ valor, rotulo }: { valor: string; rotulo: string }) {
  const tx = useTexto();
  return (
    <View style={{ width: '50%', paddingRight: esp(2) }}>
      <Text style={tx.tituloMenor}>{valor}</Text>
      <Text style={tx.legenda}>{rotulo}</Text>
    </View>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  const tx = useTexto();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(1.5) }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: cor }} />
      <Text style={tx.legenda}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(5), paddingBottom: esp(20), maxWidth: 720, width: '100%', alignSelf: 'center' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', padding: 0 },
  kpi: { width: '49.5%', padding: esp(5), gap: 2 },
  sepV: { width: 1, backgroundColor: cores.linhaSuave },
  sepH: { width: '100%', height: 1, backgroundColor: cores.linhaSuave },
  mesAtual: { flexDirection: 'row', flexWrap: 'wrap', rowGap: esp(4) },
  trilho: { flexDirection: 'row', height: 10, borderRadius: 5, backgroundColor: cores.fundo, overflow: 'hidden' },
  barra: { height: 10 },
  ranking: { flexDirection: 'row', alignItems: 'center', gap: esp(2), minHeight: 46 },
  posicao: { width: 26, fontFamily: fontes.condensadaNegrito, fontSize: 22, color: cores.apagado },
});
