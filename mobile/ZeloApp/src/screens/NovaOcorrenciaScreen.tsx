import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import {
  Accessibility,
  Camera,
  CircleCheck,
  Crosshair,
  ImagePlus,
  Send,
  ShieldAlert,
  ThumbsUp,
  X,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { ErroApi, foiCancelada } from '../config/api';
import { ocorrenciaApi } from '../services/zelo';
import IconeCategoria from '../components/Icone';
import MapaFrame from '../components/mapa/MapaFrame';
import { mapaHtml, type MapaRef, type MensagemMapa } from '../components/mapa/mapaHtml';
import { Botao, Campo, Chip, Faixa } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';
import { obterFoto, type FotoPronta } from '../utils/foto';
import type { RaizParams } from '../navigation/tipos';

type Ponto = { lat: number; lon: number };

/**
 * Funcionalidade 1: relatar um problema com foto e localizacao.
 *
 * Antes de enviar, o app pergunta ao banco se ja existe ocorrencia aberta
 * igual a menos de 60 m (function buscar_duplicada). Se existir, sugere
 * apoiar a existente: a fila do gestor nao enche de registros repetidos e
 * o apoio aumenta a prioridade do problema.
 */
export default function NovaOcorrenciaScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { usuario, recarregar } = useAuth();
  const { categorias, bairros, bairroPorId } = useCatalogo();
  const tx = useTexto();

  const inicial = bairroPorId(usuario?.bairroId) ?? bairros[0];
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [bairroId, setBairroId] = useState<number | null>(inicial?.id ?? null);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [risco, setRisco] = useState(false);
  const [acessibilidade, setAcessibilidade] = useState(false);
  const [foto, setFoto] = useState<FotoPronta | null>(null);
  const [duplicada, setDuplicada] = useState<{ id: number; protocolo: string; titulo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [criada, setCriada] = useState<{ id: number; protocolo: string } | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const mapa = useRef<MapaRef>(null);

  const categoria = categorias.find((c) => c.id === categoriaId);
  const html = useMemo(
    () => mapaHtml(inicial?.latitude ?? -23.5505, inicial?.longitude ?? -46.6333, 15),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Posiciona o marcador arrastavel assim que o mapa carrega.
  useEffect(() => {
    if (mapaPronto && inicial) {
      const p = ponto ?? { lat: inicial.latitude, lon: inicial.longitude };
      if (!ponto) setPonto(p);
      mapa.current?.enviar({ tipo: 'escolha', lat: p.lat, lon: p.lon });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaPronto]);

  // Consulta de duplicidade com espera de 500 ms (debounce): arrastar o
  // marcador nao dispara uma requisicao por pixel, e a anterior e cancelada.
  useEffect(() => {
    setDuplicada(null);
    if (!categoriaId || !ponto) return;
    const controle = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const d = await ocorrenciaApi.duplicada(categoriaId, ponto.lat, ponto.lon, controle.signal);
        setDuplicada(d && d.id ? d : null);
      } catch (e) {
        if (!foiCancelada(e)) setDuplicada(null);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [categoriaId, ponto]);

  /** Bairro mais proximo do ponto marcado, para o cidadao nao precisar escolher. */
  const ajustarBairro = useCallback(
    (p: Ponto) => {
      let melhor = bairros[0];
      let menor = Infinity;
      for (const b of bairros) {
        const d = (b.latitude - p.lat) ** 2 + (b.longitude - p.lon) ** 2;
        if (d < menor) {
          menor = d;
          melhor = b;
        }
      }
      if (melhor) setBairroId(melhor.id);
    },
    [bairros],
  );

  const aoMensagemMapa = useCallback(
    (m: MensagemMapa) => {
      if (m.tipo === 'pronto') setMapaPronto(true);
      if (m.tipo === 'ponto') {
        const p = { lat: Number(m.lat.toFixed(6)), lon: Number(m.lon.toFixed(6)) };
        setPonto(p);
        ajustarBairro(p);
      }
    },
    [ajustarBairro],
  );

  async function usarMinhaLocalizacao() {
    setErro(null);
    setLocalizando(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error('Sem permissão de localização. Marque o local tocando no mapa.');
      // GPS sem sinal (ou navegador que nunca responde) nao pode travar o botao.
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error('A localização demorou demais. Toque no mapa para marcar o local.')), 12000),
        ),
      ]);
      const p = { lat: Number(pos.coords.latitude.toFixed(6)), lon: Number(pos.coords.longitude.toFixed(6)) };
      setPonto(p);
      ajustarBairro(p);
      mapa.current?.enviar({ tipo: 'escolha', lat: p.lat, lon: p.lon });
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível obter a localização. Toque no mapa para marcar.');
    } finally {
      setLocalizando(false);
    }
  }

  async function escolherFoto(origem: 'camera' | 'galeria') {
    setErro(null);
    try {
      const f = await obterFoto(origem);
      if (f) setFoto(f);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function enviar() {
    setErro(null);
    if (!categoriaId) return setErro('Escolha o tipo de problema.');
    if (!ponto || !bairroId) return setErro('Marque no mapa onde fica o problema.');
    if (titulo.trim().length < 5) return setErro('Escreva um título com pelo menos 5 letras.');
    setEnviando(true);
    try {
      const r = await ocorrenciaApi.registrar({
        categoriaId,
        bairroId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        endereco: endereco.trim(),
        latitude: ponto.lat,
        longitude: ponto.lon,
        risco,
        acessibilidade,
        fotoBase64: foto?.base64 ?? null,
      });
      setCriada(r);
      recarregar().catch(() => {});
    } catch (e) {
      // Duplicidade detectada pela procedure (corrida com outro morador).
      if (e instanceof ErroApi && e.referenciaId) {
        setDuplicada({ id: e.referenciaId, protocolo: '', titulo: e.message });
      } else {
        setErro((e as Error).message);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function apoiarExistente() {
    if (!duplicada) return;
    setErro(null);
    try {
      await ocorrenciaApi.apoiar(duplicada.id);
      setAviso('Apoio registrado. A prioridade da ocorrência subiu.');
    } catch (e) {
      setAviso(null);
      setErro((e as Error).message);
    }
  }

  if (criada) {
    return (
      <View style={s.sucesso}>
        <View style={s.selo}>
          <CircleCheck size={40} color={cores.primaria} />
        </View>
        <Text style={[tx.titulo, { textAlign: 'center' }]}>Ocorrência registrada</Text>
        <Text style={[tx.corpo, { textAlign: 'center' }]}>Guarde o protocolo. Ele é a prova do seu pedido.</Text>
        <Text style={s.protocolo} selectable accessibilityLabel={`Protocolo ${criada.protocolo}`}>
          {criada.protocolo}
        </Text>
        <Text style={[tx.legenda, { textAlign: 'center', maxWidth: 320 }]}>
          Prazo e prioridade já foram calculados. Você recebeu 10 pontos de participação.
        </Text>
        <Botao
          titulo="Acompanhar ocorrência"
          onPress={() => navegacao.replace('Detalhe', { id: criada.id })}
          estilo={{ alignSelf: 'stretch' }}
        />
        <Botao titulo="Voltar ao mapa" variante="fantasma" onPress={() => navegacao.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      <Secao numero={1} titulo="Qual é o problema?">
        <View style={s.grade}>
          {categorias.map((c) => {
            const ativo = c.id === categoriaId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoriaId(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativo }}
                accessibilityLabel={`${c.nome}. Prazo de ${c.prazoDias} dias.`}
                style={[s.categoria, ativo && s.categoriaAtiva]}
              >
                <IconeCategoria nome={c.icone} tamanho={24} cor={ativo ? cores.branco : cores.primaria} />
                <Text style={[tx.legenda, { color: ativo ? cores.branco : cores.tinta, fontWeight: '700', textAlign: 'center' }]}>
                  {c.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {categoria ? (
          <Text style={tx.legenda}>
            Responsável: {categoria.orgao}. Prazo de atendimento: {categoria.prazoDias} dias
            {risco ? ` (${Math.max(Math.ceil(categoria.prazoDias / 2), 1)} com risco)` : ''}.
          </Text>
        ) : null}
      </Secao>

      <Secao numero={2} titulo="Onde fica?">
        <Text style={tx.legenda}>Toque no mapa ou arraste o marcador até o local exato.</Text>
        <View style={s.mapa}>
          <MapaFrame ref={mapa} html={html} aoReceber={aoMensagemMapa} />
        </View>
        <Botao
          titulo="Usar minha localização"
          icone={Crosshair}
          variante="secundario"
          onPress={usarMinhaLocalizacao}
          carregando={localizando}
        />
        <View style={s.chips}>
          {bairros.map((b) => (
            <Chip key={b.id} texto={b.nome} ativo={bairroId === b.id} onPress={() => setBairroId(b.id)} />
          ))}
        </View>
        <Campo rotulo="Endereço ou referência (opcional)" value={endereco} onChangeText={setEndereco} placeholder="Ex.: em frente ao nº 120" />
      </Secao>

      {duplicada ? (
        <Faixa
          tipo="info"
          texto={
            duplicada.protocolo
              ? `Já existe a ocorrência ${duplicada.protocolo} aqui perto: "${duplicada.titulo}". Apoiar a existente aumenta a prioridade dela.`
              : duplicada.titulo
          }
          acao={
            <View style={s.chips}>
              <Botao titulo="Apoiar a existente" icone={ThumbsUp} onPress={apoiarExistente} estilo={{ minHeight: 42 }} />
              <Botao
                titulo="Ver detalhes"
                variante="secundario"
                onPress={() => navegacao.navigate('Detalhe', { id: duplicada.id })}
                estilo={{ minHeight: 42 }}
              />
            </View>
          }
        />
      ) : null}
      {aviso ? <Faixa tipo="sucesso" texto={aviso} /> : null}

      <Secao numero={3} titulo="Conte o que está acontecendo">
        <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} placeholder="Ex.: Poste apagado na esquina" maxLength={120} />
        <Campo
          rotulo="Detalhes (opcional)"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Desde quando, quem é afetado..."
          multiline
          maxLength={1000}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <Alternar
          icone={<ShieldAlert size={20} color={cores.perigo} />}
          titulo="Há risco para pessoas"
          texto="Prazo cai pela metade e a prioridade sobe."
          valor={risco}
          aoMudar={setRisco}
        />
        <Alternar
          icone={<Accessibility size={20} color={cores.info} />}
          titulo="Atrapalha quem tem deficiência ou mobilidade reduzida"
          texto="Calçada bloqueada, rampa ou piso tátil."
          valor={acessibilidade}
          aoMudar={setAcessibilidade}
        />
      </Secao>

      <Secao numero={4} titulo="Foto (recomendado)">
        {foto ? (
          <View>
            <Image source={{ uri: foto.uri }} style={s.foto} accessibilityLabel="Foto do problema" />
            <Pressable onPress={() => setFoto(null)} style={s.removerFoto} accessibilityLabel="Remover foto">
              <X size={18} color={cores.branco} />
            </Pressable>
            <Text style={[tx.legenda, { marginTop: esp(2) }]}>Foto otimizada para envio: {foto.kb} KB</Text>
          </View>
        ) : (
          <View style={s.chips}>
            <Botao titulo="Câmera" icone={Camera} variante="secundario" onPress={() => escolherFoto('camera')} estilo={{ flex: 1 }} />
            <Botao titulo="Galeria" icone={ImagePlus} variante="secundario" onPress={() => escolherFoto('galeria')} estilo={{ flex: 1 }} />
          </View>
        )}
      </Secao>

      {erro ? <Faixa tipo="erro" texto={erro} /> : null}
      <Botao titulo="Enviar para a prefeitura" icone={Send} onPress={enviar} carregando={enviando} />
    </ScrollView>
  );
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  const tx = useTexto();
  return (
    <View style={s.secao}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2.5) }}>
        <View style={s.numero}>
          <Text style={{ color: cores.branco, fontWeight: '800', fontSize: 13 }}>{numero}</Text>
        </View>
        <Text style={tx.subtitulo} accessibilityRole="header">
          {titulo}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Alternar(props: { icone: React.ReactNode; titulo: string; texto: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  const tx = useTexto();
  return (
    <Pressable
      onPress={() => props.aoMudar(!props.valor)}
      accessibilityRole="switch"
      accessibilityState={{ checked: props.valor }}
      accessibilityLabel={props.titulo}
      style={s.alternar}
    >
      {props.icone}
      <View style={{ flex: 1 }}>
        <Text style={tx.corpoForte}>{props.titulo}</Text>
        <Text style={tx.legenda}>{props.texto}</Text>
      </View>
      <Switch
        value={props.valor}
        onValueChange={props.aoMudar}
        trackColor={{ true: cores.primariaMedia, false: cores.linha }}
        thumbColor={cores.branco}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(4), paddingBottom: esp(12), maxWidth: 640, width: '100%', alignSelf: 'center' },
  secao: {
    backgroundColor: cores.branco,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: esp(4),
    gap: esp(3),
  },
  numero: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) },
  categoria: {
    width: '31.5%',
    minHeight: 86,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
    gap: esp(1.5),
    padding: esp(2),
    backgroundColor: cores.fundo,
  },
  categoriaAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  mapa: { height: 230, borderRadius: raio.m, overflow: 'hidden', borderWidth: 1, borderColor: cores.linha },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) },
  alternar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(3),
    padding: esp(3),
    borderRadius: raio.m,
    backgroundColor: cores.fundo,
  },
  foto: { width: '100%', height: 200, borderRadius: raio.m, backgroundColor: cores.linha },
  removerFoto: {
    position: 'absolute',
    top: esp(2),
    right: esp(2),
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(19,32,28,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sucesso: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: esp(6), gap: esp(3), maxWidth: 480, width: '100%', alignSelf: 'center' },
  selo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolo: {
    fontSize: 26,
    fontWeight: '800',
    color: cores.primaria,
    letterSpacing: 1,
    backgroundColor: cores.primariaClara,
    paddingHorizontal: esp(5),
    paddingVertical: esp(3),
    borderRadius: raio.m,
    overflow: 'hidden',
  },
});
