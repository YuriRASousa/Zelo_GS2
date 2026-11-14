import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Award, CircleCheck, Hourglass, Inbox, Timer } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { painelApi } from '../services/zelo';
import IconeCategoria from '../components/Icone';
import { Carregando, Cartao, Chip, Faixa } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';
import { nomeMes, pct } from '../utils/formato';
import type { Painel } from '../types';

/**
 * Funcionalidade 4: painel de transparencia. Numeros ao vivo e os
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView
        contentContainerStyle={s.conteudo}
        refreshControl={<RefreshControl refreshing={carregando && !!dados} onRefresh={() => carregar()} tintColor={cores.primaria} />}
      >
        <View>
          <Text style={tx.titulo} accessibilityRole="header">
            Painel da transparência
          </Text>
          <Text style={tx.corpo}>Quanto a prefeitura resolve, e em quanto tempo.</Text>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 0, nome: 'Cidade toda' }, ...bairros]}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={{ gap: esp(2) }}
          renderItem={({ item: b }) => (
            <Chip texto={b.nome} ativo={(bairroId ?? 0) === b.id} onPress={() => setBairroId(b.id || null)} />
          )}
        />

        {erro ? <Faixa tipo="erro" texto={erro} /> : null}
        {!dados ? (
          <Carregando />
        ) : (
          <>
            <View style={s.grade}>
              <Kpi icone={<Inbox size={20} color={cores.info} />} valor={String(dados.agora.emAberto)} rotulo="em aberto" />
              <Kpi icone={<Hourglass size={20} color={cores.perigo} />} valor={String(dados.agora.atrasadas)} rotulo="com prazo vencido" alerta={dados.agora.atrasadas > 0} />
              <Kpi icone={<CircleCheck size={20} color={cores.primariaMedia} />} valor={String(dados.agora.resolvidas)} rotulo="resolvidas" />
              <Kpi icone={<Timer size={20} color={cores.destaqueEscuro} />} valor={pct(dados.agora.pcNoPrazo)} rotulo="resolvidas no prazo" />
            </View>

            <Cartao estilo={{ gap: esp(3) }}>
              <Text style={tx.subtitulo}>Mês a mês</Text>
              {dados.meses.length === 0 ? (
                <Text style={tx.corpo}>Os indicadores aparecem depois da primeira rotina mensal.</Text>
              ) : (
                dados.meses.map((m) => (
                  <View key={m.mes} style={s.mes}>
                    <Text style={tx.corpoForte}>{nomeMes(m.mes)}</Text>
                    <View style={s.linhaNumeros}>
                      <Numero valor={m.abertas} rotulo="abertas" />
                      <Numero valor={m.resolvidas} rotulo="resolvidas" />
                      <Numero valor={m.tempoMedioDias != null ? `${m.tempoMedioDias.toLocaleString('pt-BR')} d` : '–'} rotulo="tempo médio" />
                      <Numero valor={pct(m.pcNoPrazo)} rotulo="no prazo" />
                      <Numero valor={m.notaMedia != null ? m.notaMedia.toLocaleString('pt-BR') : '–'} rotulo="nota" />
                    </View>
                  </View>
                ))
              )}
            </Cartao>

            <Cartao estilo={{ gap: esp(3) }}>
              <Text style={tx.subtitulo}>Problemas mais relatados</Text>
              {dados.categorias.map((c) => (
                <View key={c.categoria} style={{ gap: esp(1.5) }} accessibilityLabel={`${c.categoria}: ${c.total} ocorrências, ${c.emAberto} em aberto`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
                    <IconeCategoria nome={c.icone} tamanho={16} />
                    <Text style={[tx.corpoForte, { flex: 1 }]}>{c.categoria}</Text>
                    <Text style={tx.legenda}>
                      {c.total} · {c.emAberto} em aberto
                    </Text>
                  </View>
                  <View style={s.trilho}>
                    <View style={[s.barra, { width: `${(c.resolvidas / maiorCategoria) * 100}%`, backgroundColor: cores.primariaMedia }]} />
                    <View style={[s.barra, { width: `${(c.emAberto / maiorCategoria) * 100}%`, backgroundColor: cores.destaque }]} />
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: esp(4) }}>
                <Legenda cor={cores.primariaMedia} texto="resolvidas" />
                <Legenda cor={cores.destaque} texto="em aberto" />
              </View>
            </Cartao>

            {dados.cidadaos.length > 0 ? (
              <Cartao estilo={{ gap: esp(2) }}>
                <Text style={tx.subtitulo}>Vizinhos mais participativos</Text>
                {dados.cidadaos.map((c, i) => (
                  <View key={`${c.nome}-${i}`} style={s.ranking}>
                    <Text style={[tx.corpoForte, { width: 24, color: cores.apagado }]}>{i + 1}</Text>
                    <Text style={[tx.corpoForte, { flex: 1 }]}>{c.nome}</Text>
                    <Award size={16} color={cores.destaqueEscuro} />
                    <Text style={[tx.corpoForte, { color: cores.destaqueEscuro }]}>{c.pontos}</Text>
                  </View>
                ))}
              </Cartao>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ icone, valor, rotulo, alerta }: { icone: React.ReactNode; valor: string; rotulo: string; alerta?: boolean }) {
  const tx = useTexto();
  return (
    <View style={[s.kpi, alerta && { borderColor: '#F5C2B8' }]} accessibilityLabel={`${valor} ${rotulo}`}>
      {icone}
      <Text style={[tx.display, alerta && { color: cores.perigo }]}>{valor}</Text>
      <Text style={tx.legenda}>{rotulo}</Text>
    </View>
  );
}

function Numero({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  const tx = useTexto();
  return (
    <View style={{ minWidth: 58 }}>
      <Text style={tx.corpoForte}>{valor}</Text>
      <Text style={[tx.legenda, { fontSize: 11 * tx.escala }]}>{rotulo}</Text>
    </View>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  const tx = useTexto();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(1.5) }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cor }} />
      <Text style={tx.legenda}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(4), paddingBottom: esp(12), maxWidth: 720, width: '100%', alignSelf: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(3) },
  kpi: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: cores.branco,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: esp(4),
    gap: esp(1),
  },
  mes: { gap: esp(2), paddingBottom: esp(3), borderBottomWidth: 1, borderBottomColor: cores.linha },
  linhaNumeros: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(3) },
  trilho: { flexDirection: 'row', height: 8, borderRadius: 4, backgroundColor: cores.fundo, overflow: 'hidden' },
  barra: { height: 8 },
  ranking: { flexDirection: 'row', alignItems: 'center', gap: esp(2), minHeight: 36 },
});
