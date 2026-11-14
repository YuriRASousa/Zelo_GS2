import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Award, Inbox } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { ocorrenciaApi } from '../services/zelo';
import OcorrenciaCard from '../components/OcorrenciaCard';
import MapaFrame from '../components/mapa/MapaFrame';
import { mapaHtml, type MapaRef, type MensagemMapa } from '../components/mapa/mapaHtml';
import { Chip, Faixa, Vazio } from '../components/ui';
import { cores, esp, raio, statusInfo } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import type { RaizParams } from '../navigation/tipos';

const CENTRO_SP = { latitude: -23.5505, longitude: -46.6333 };

/**
 * Funcionalidade 2: mapa do bairro. Mostra os problemas relatados pela
 * vizinhanca, ordenados pela prioridade calculada no banco, para o
 * cidadao apoiar o que ja existe em vez de relatar de novo.
 */
export default function InicioScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { usuario } = useAuth();
  const { bairros, bairroPorId } = useCatalogo();
  const tx = useTexto();

  const [bairroId, setBairroId] = useState<number | null>(usuario?.bairroId ?? null);
  const [encerradas, setEncerradas] = useState(false);
  const [itens, setItens] = useState<OcorrenciaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const mapa = useRef<MapaRef>(null);

  // HTML do mapa gerado uma unica vez: trocar de bairro move a camera por
  // mensagem, sem recarregar a pagina nem baixar os blocos de novo.
  const html = useMemo(() => {
    const b = bairroPorId(usuario?.bairroId);
    return mapaHtml(b?.latitude ?? CENTRO_SP.latitude, b?.longitude ?? CENTRO_SP.longitude, b ? 14 : 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bairros.length > 0]);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      setErro(null);
      try {
        setItens(await ocorrenciaApi.listar(bairroId, encerradas, sinal));
      } catch (e) {
        if (!foiCancelada(e)) setErro((e as Error).message);
      } finally {
        if (!sinal?.aborted) setCarregando(false);
      }
    },
    [bairroId, encerradas],
  );

  // Recarrega ao voltar para a aba (ex.: depois de apoiar ou registrar) e
  // cancela a requisicao se o usuario sair antes da resposta.
  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      return () => controle.abort();
    }, [carregar]),
  );

  useEffect(() => {
    if (!mapaPronto) return;
    mapa.current?.enviar({
      tipo: 'marcadores',
      itens: itens.map((o) => ({
        id: o.id,
        lat: o.latitude,
        lon: o.longitude,
        cor: statusInfo[o.status].cor,
        rotulo: `${o.categoria}: ${o.titulo}`,
        destaque: o.prioridade >= 70,
      })),
    });
  }, [itens, mapaPronto]);

  useEffect(() => {
    if (!mapaPronto) return;
    const b = bairroPorId(bairroId);
    mapa.current?.enviar(
      b ? { tipo: 'centro', lat: b.latitude, lon: b.longitude, zoom: 14 } : { tipo: 'centro', lat: CENTRO_SP.latitude, lon: CENTRO_SP.longitude, zoom: 11 },
    );
  }, [bairroId, mapaPronto, bairroPorId]);

  const abrir = useCallback((id: number) => navegacao.navigate('Detalhe', { id }), [navegacao]);

  const aoMensagemMapa = useCallback(
    (m: MensagemMapa) => {
      if (m.tipo === 'pronto') setMapaPronto(true);
      else if (m.tipo === 'abrir') abrir(m.id);
    },
    [abrir],
  );

  const renderItem = useCallback(
    ({ item }: { item: OcorrenciaResumo }) => <OcorrenciaCard item={item} onAbrir={abrir} />,
    [abrir],
  );

  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={s.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tx.legenda}>{usuario?.papel === 'GESTOR' ? 'Visão da cidade' : `Olá, ${primeiroNome}`}</Text>
          <Text style={tx.titulo}>O que precisa de cuidado</Text>
        </View>
        {usuario?.papel === 'CIDADAO' ? (
          <View style={s.pontos} accessibilityLabel={`${usuario.pontos} pontos de participação`}>
            <Award size={16} color={cores.destaqueEscuro} />
            <Text style={[tx.corpoForte, { color: cores.destaqueEscuro }]}>{usuario.pontos}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 0, nome: 'Cidade toda' }, ...bairros]}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={s.filtros}
        style={{ flexGrow: 0, flexShrink: 0, minHeight: 62 }}
        renderItem={({ item: b }) => (
          <Chip texto={b.nome} ativo={(bairroId ?? 0) === b.id} onPress={() => setBairroId(b.id || null)} />
        )}
      />

      <View style={s.mapa}>
        <MapaFrame ref={mapa} html={html} aoReceber={aoMensagemMapa} />
      </View>

      <View style={s.legendaLinha}>
        <Text style={tx.rotulo}>
          {itens.length} {encerradas ? 'ocorrências' : 'em aberto'} · por prioridade
        </Text>
        <Chip texto="Incluir resolvidas" ativo={encerradas} onPress={() => setEncerradas((v) => !v)} />
      </View>

      {erro ? (
        <View style={{ paddingHorizontal: esp(4) }}>
          <Faixa tipo="erro" texto={erro} />
        </View>
      ) : null}

      <FlatList
        data={itens}
        keyExtractor={(o) => String(o.id)}
        renderItem={renderItem}
        contentContainerStyle={s.lista}
        ItemSeparatorComponent={Separador}
        // Lista virtualizada: so os cards perto da tela ficam montados.
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={() => carregar()} tintColor={cores.primaria} />
        }
        ListEmptyComponent={
          carregando ? null : (
            <Vazio icone={Inbox} titulo="Tudo em ordem por aqui" texto="Nenhuma ocorrência em aberto neste filtro." />
          )
        }
      />
    </SafeAreaView>
  );
}

function Separador() {
  return <View style={{ height: esp(3) }} />;
}

const s = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: esp(4), paddingTop: esp(3), gap: esp(3) },
  pontos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(1.5),
    backgroundColor: '#FDF0D8',
    paddingHorizontal: esp(3),
    paddingVertical: esp(1.5),
    borderRadius: raio.total,
  },
  filtros: { paddingHorizontal: esp(4), paddingVertical: esp(3), gap: esp(2), alignItems: 'center' },
  mapa: {
    height: 250,
    flexShrink: 0,
    marginHorizontal: esp(4),
    borderRadius: raio.g,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: cores.linha,
  },
  legendaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: esp(4),
    paddingTop: esp(4),
    paddingBottom: esp(2),
  },
  lista: { padding: esp(4), paddingTop: esp(1), paddingBottom: esp(10) },
});
