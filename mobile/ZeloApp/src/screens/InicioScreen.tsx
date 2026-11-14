import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Check, ChevronDown, Inbox, RefreshCw, Search, SearchX, WifiOff, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { ocorrenciaApi } from '../services/zelo';
import OcorrenciaCard from '../components/OcorrenciaCard';
import IconeCategoria from '../components/Icone';
import MapaFrame from '../components/mapa/MapaFrame';
import { mapaHtml, type MapaRef, type MensagemMapa } from '../components/mapa/mapaHtml';
import { ICONES_SVG } from '../components/mapa/iconesMapa';
import { Botao, BotaoIcone, Chip, Divisor, Esqueleto, Faixa, Placa, Vazio } from '../components/ui';
import { cores, esp, fontes, raio, sombra, statusInfo } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import type { RaizParams } from '../navigation/tipos';

const CENTRO_SP = { latitude: -23.5505, longitude: -46.6333 };

/**
 * Funcionalidade 2: mapa do bairro. Problemas relatados pela vizinhanca,
 * ordenados pela prioridade calculada no banco, com busca por protocolo
 * ou titulo e filtro por categoria. O mapa ocupa a tela; a lista fica numa
 * folha que pode ser expandida.
 */
export default function InicioScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { usuario, naoLidas, atualizarNaoLidas } = useAuth();
  const { bairros, categorias, bairroPorId } = useCatalogo();
  const tx = useTexto();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [bairroId, setBairroId] = useState<number | null>(usuario?.papel === 'GESTOR' ? null : usuario?.bairroId ?? null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [encerradas, setEncerradas] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [itens, setItens] = useState<OcorrenciaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [escolhendoBairro, setEscolhendoBairro] = useState(false);
  const mapa = useRef<MapaRef>(null);
  const [alturaTela, setAlturaTela] = useState(0);

  // HTML do mapa gerado uma unica vez: trocar de bairro move a camera por
  // mensagem, sem recarregar a pagina nem baixar os blocos de novo.
  const html = useMemo(() => {
    const b = bairroPorId(usuario?.bairroId);
    return mapaHtml(b?.latitude ?? CENTRO_SP.latitude, b?.longitude ?? CENTRO_SP.longitude, b ? 13 : 11, false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bairros.length > 0]);

  // Busca com espera de 400 ms: nao dispara uma consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  // Trocou bairro, categoria, busca ou "resolvidas": a lista antiga sai na
  // hora, para nunca aparecer dado de um filtro sob o titulo de outro.
  useEffect(() => {
    setItens([]);
  }, [bairroId, categoriaId, buscaAplicada, encerradas]);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      setErro(null);
      setCarregando(true);
      try {
        setItens(
          await ocorrenciaApi.listar({ bairroId, categoriaId, busca: buscaAplicada, incluirEncerradas: encerradas }, sinal),
        );
      } catch (e) {
        if (!foiCancelada(e)) setErro((e as Error).message);
      } finally {
        if (!sinal?.aborted) setCarregando(false);
      }
    },
    [bairroId, categoriaId, buscaAplicada, encerradas],
  );

  // Recarrega ao voltar para a aba e cancela a requisicao se sair antes.
  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      atualizarNaoLidas();
      return () => controle.abort();
    }, [carregar, atualizarNaoLidas]),
  );

  // Altura util da tela (sem a barra de abas). Aberta, a folha para logo
  // abaixo da busca; fechada, ocupa pouco mais da metade.
  const util = alturaTela || height - 70;
  const topoBusca = insets.top + 128;
  const alturaFolha = folhaAberta ? util - topoBusca : Math.max(320, Math.round(util * 0.52));

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
        icone: ICONES_SVG[o.icone],
      })),
      enquadrar: !bairroId,
      offsetY: alturaFolha,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, mapaPronto]);


  useEffect(() => {
    if (!mapaPronto) return;
    const b = bairroPorId(bairroId);
    // Centraliza na faixa visivel entre a busca (topo) e a folha da lista.
    const offsetY = Math.round(alturaFolha - 130);
    mapa.current?.enviar(
      b
        ? { tipo: 'centro', lat: b.latitude, lon: b.longitude, zoom: 13, offsetY }
        : { tipo: 'centro', lat: CENTRO_SP.latitude, lon: CENTRO_SP.longitude, zoom: 11, offsetY },
    );
  }, [bairroId, mapaPronto, bairroPorId, alturaFolha]);

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

  const nomeBairro = bairroPorId(bairroId)?.nome ?? 'Cidade toda';
  const filtrando = !!categoriaId || !!buscaAplicada.trim();
  const resumo =
    itens.length === 0
      ? encerradas ? 'Nenhuma ocorrência' : 'Nenhuma ocorrência em aberto'
      : `${itens.length} ${encerradas ? (itens.length === 1 ? 'ocorrência' : 'ocorrências') : 'em aberto'}`;

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }} onLayout={(e) => setAlturaTela(e.nativeEvent.layout.height)}>
      <View style={StyleSheet.absoluteFill}>
        <MapaFrame ref={mapa} html={html} aoReceber={aoMensagemMapa} />
      </View>

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <View style={s.linhaTopo} pointerEvents="box-none">
          <Pressable
            onPress={() => setEscolhendoBairro(true)}
            accessibilityRole="button"
            accessibilityLabel={`Bairro: ${nomeBairro}. Toque para trocar.`}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }, pressed && { opacity: 0.85 }]}
          >
            <Placa texto={nomeBairro} tamanho="m" estilo={sombra(1)} />
            <View style={s.trocar}>
              <ChevronDown size={18} color={cores.tinta} />
            </View>
          </Pressable>
          {usuario?.papel === 'CIDADAO' ? (
            <BotaoIcone icone={Bell} rotulo="Notificações" contador={naoLidas} onPress={() => navegacao.navigate('Notificacoes')} claro />
          ) : null}
        </View>
        <View style={s.busca}>
          <Search size={19} color={cores.apagado} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por protocolo ou problema"
            placeholderTextColor={cores.apagado}
            accessibilityLabel="Buscar por protocolo ou problema"
            style={[s.campoBusca, { fontSize: Math.round(15.5 * tx.escala) }]}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {busca ? (
            <Pressable onPress={() => setBusca('')} accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={8}>
              <X size={18} color={cores.tintaSuave} />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      <View style={[s.folha, sombra(2), { height: alturaFolha }]}>
        <Pressable
          onPress={() => setFolhaAberta((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={folhaAberta ? 'Mostrar mais mapa' : 'Expandir a lista'}
          style={s.alca}
        >
          <View style={s.alcaBarra} />
        </Pressable>

        <View style={s.cabecalhoFolha}>
          <View style={{ flex: 1 }}>
            <Text style={tx.tituloMenor}>{buscaAplicada.trim() ? 'Resultado da busca' : categoriaId ? (categorias.find((c) => c.id === categoriaId)?.nome ?? 'Filtro') : encerradas ? 'Todas as ocorrências' : 'O que precisa de cuidado'}</Text>
            <Text style={tx.legenda}>{carregando ? 'Atualizando' : erro && itens.length === 0 ? 'Sem dados agora' : itens.length ? `${resumo}, por prioridade` : resumo}</Text>
          </View>
          <Chip texto="Resolvidas" ativo={encerradas} onPress={() => setEncerradas((v) => !v)} icone={encerradas ? Check : undefined} />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 0, nome: 'Todas', icone: '' }, ...categorias]}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={s.categorias}
          style={{ flexGrow: 0, flexShrink: 0 }}
          renderItem={({ item: c }) => {
            const ativo = (categoriaId ?? 0) === c.id;
            return (
              <Pressable
                onPress={() => setCategoriaId(c.id || null)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                aria-pressed={ativo}
                accessibilityLabel={`Filtrar por ${c.nome}`}
                style={[s.categoria, ativo && s.categoriaAtiva]}
              >
                {c.icone ? <IconeCategoria nome={c.icone} tamanho={16} cor={ativo ? cores.branco : cores.placa} /> : null}
                <Text style={[tx.rotulo, { color: ativo ? cores.branco : cores.tinta }]}>{c.nome}</Text>
              </Pressable>
            );
          }}
        />

        {erro && itens.length === 0 ? (
          <Vazio
            icone={WifiOff}
            titulo="Não deu para carregar"
            texto={erro}
            acao={<Botao titulo="Tentar de novo" icone={RefreshCw} variante="secundario" compacto onPress={() => carregar()} />}
          />
        ) : erro ? (
          <View style={{ paddingHorizontal: esp(5), paddingBottom: esp(2) }}>
            <Faixa tipo="erro" texto={erro} />
          </View>
        ) : null}

        {erro && itens.length === 0 ? null : carregando && itens.length === 0 ? (
          <View style={{ paddingHorizontal: esp(5) }}>
            <Esqueleto linhas={3} />
          </View>
        ) : (
          <FlatList
            data={itens}
            keyExtractor={(o) => String(o.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={Separador}
            // Folga embaixo para o botao Relatar (que sobe da barra de abas) nao cobrir a ultima linha.
            contentContainerStyle={{ paddingBottom: esp(16) }}
            // Lista virtualizada: so as linhas perto da tela ficam montadas.
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => carregar()} tintColor={cores.placa} />}
            ListEmptyComponent={
              filtrando ? (
                <Vazio
                  icone={SearchX}
                  titulo="Nada encontrado"
                  texto={`Nenhuma ocorrência com esse termo ou categoria ${bairroId ? 'neste bairro' : 'na cidade'}.`}
                  acao={
                    <Botao
                      titulo="Limpar busca e filtro"
                      variante="secundario"
                      compacto
                      onPress={() => {
                        setBusca('');
                        setCategoriaId(null);
                      }}
                    />
                  }
                />
              ) : (
                <Vazio icone={Inbox} titulo="Nada em aberto aqui" texto="Viu algum problema? Use o botão Relatar para avisar a prefeitura." />
              )
            }
          />
        )}
      </View>

      <Modal visible={escolhendoBairro} transparent animationType="fade" onRequestClose={() => setEscolhendoBairro(false)}>
        <Pressable style={s.veu} onPress={() => setEscolhendoBairro(false)} accessibilityLabel="Fechar">
          <Pressable style={s.seletor} onPress={() => {}}>
            <Text style={[tx.tituloMenor, { padding: esp(5), paddingBottom: esp(2) }]}>Ver ocorrências de</Text>
            {[{ id: 0, nome: 'Cidade toda', regiao: 'Todos os bairros' }, ...bairros].map((b, i) => {
              const ativo = (bairroId ?? 0) === b.id;
              return (
                <View key={b.id}>
                  {i ? <Divisor estilo={{ marginHorizontal: esp(5) }} /> : null}
                  <Pressable
                    onPress={() => {
                      setBairroId(b.id || null);
                      setEscolhendoBairro(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativo }}
                    style={({ pressed }) => [s.opcaoBairro, pressed && { backgroundColor: cores.fundo }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={tx.corpoForte}>{b.nome}</Text>
                      <Text style={tx.legenda}>{b.regiao}</Text>
                    </View>
                    {ativo ? <Check size={20} color={cores.placa} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Separador() {
  return <Divisor estilo={{ marginLeft: esp(5) + 46 + esp(3) }} />;
}

const s = StyleSheet.create({
  topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: esp(4), paddingTop: esp(2), gap: esp(3) },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trocar: {
    marginLeft: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: esp(2),
  },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(2),
    backgroundColor: cores.superficie,
    borderRadius: raio.m,
    paddingHorizontal: esp(4),
    minHeight: 50,
    ...sombra(1),
  },
  campoBusca: { flex: 1, fontFamily: fontes.regular, color: cores.tinta, paddingVertical: esp(3) },
  folha: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cores.superficie,
    borderTopLeftRadius: raio.g + 6,
    borderTopRightRadius: raio.g + 6,
    overflow: 'hidden',
  },
  alca: { alignItems: 'center', justifyContent: 'center', height: 44, marginBottom: -12 },
  alcaBarra: { width: 44, height: 5, borderRadius: 3, backgroundColor: cores.linha },
  cabecalhoFolha: { flexDirection: 'row', alignItems: 'center', gap: esp(3), paddingHorizontal: esp(5), paddingTop: esp(1) },
  categorias: { paddingHorizontal: esp(5), paddingVertical: esp(3), gap: esp(2), alignItems: 'center' },
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(1.5),
    paddingHorizontal: esp(3),
    minHeight: 44,
    borderRadius: raio.p,
    backgroundColor: cores.fundo,
  },
  categoriaAtiva: { backgroundColor: cores.placa },
  veu: { flex: 1, backgroundColor: 'rgba(34,38,43,0.45)', justifyContent: 'flex-end' },
  seletor: {
    backgroundColor: cores.superficie,
    borderTopLeftRadius: raio.g + 6,
    borderTopRightRadius: raio.g + 6,
    paddingBottom: esp(8),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  opcaoBairro: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: esp(5) },
});
