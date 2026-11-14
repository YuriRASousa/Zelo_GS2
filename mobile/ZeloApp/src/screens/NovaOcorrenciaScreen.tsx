import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { dataCurta, prazoRelativo, protocoloInteiro } from '../utils/formato';
import {
  Accessibility,
  Camera,
  CircleCheck,
  Copy,
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
import { Botao, Campo, Chip, Faixa, Interruptor, Placa } from '../components/ui';
import { cores, esp, fontes, raio } from '../theme/tema';
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
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [jaAcompanha, setJaAcompanha] = useState(false);
  const [confirmandoOutro, setConfirmandoOutro] = useState(false);
  /** Duplicata apontada ao enviar: o aviso aparece so junto do botao. */
  const [duplicataNoEnvio, setDuplicataNoEnvio] = useState(false);
  const [prazoCriada, setPrazoCriada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [criada, setCriada] = useState<{ id: number; protocolo: string } | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const mapa = useRef<MapaRef>(null);

  const categoria = categorias.find((c) => c.id === categoriaId);
  const html = useMemo(
    () => mapaHtml(inicial?.latitude ?? -23.5505, inicial?.longitude ?? -46.6333, 15, false, true),
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
    setJaAcompanha(false);
    setConfirmandoOutro(false);
    setDuplicataNoEnvio(false);
    if (!categoriaId || !ponto) return;
    const controle = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const d = await ocorrenciaApi.duplicada(categoriaId, ponto.lat, ponto.lon, controle.signal);
        setDuplicada(d && d.id ? d : null);
        // Se a pessoa ja relatou ou apoiou a parecida, o aviso muda para "voce ja acompanha".
        if (d && d.id) {
          const det = await ocorrenciaApi.detalhe(d.id, controle.signal);
          setJaAcompanha(det.jaApoiei || det.souAutor);
        }
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
    setErroFoto(null);
    setPreparandoFoto(true);
    try {
      const f = await obterFoto(origem);
      if (f) setFoto(f);
    } catch (e) {
      setErroFoto((e as Error).message);
    } finally {
      setPreparandoFoto(false);
    }
  }

  async function enviar(ignorarDuplicada = false) {
    setErro(null);
    // Mostra tudo o que falta de uma vez, em vez de um erro por tentativa.
    const faltas: string[] = [];
    if (!categoriaId) faltas.push('escolha o tipo de problema');
    if (!ponto || !bairroId) faltas.push('marque no mapa onde fica');
    if (titulo.trim().length < 5) faltas.push('escreva um título com pelo menos 5 letras');
    setErroTitulo(titulo.trim().length < 5 ? 'Pelo menos 5 letras, por exemplo: Poste apagado na esquina.' : null);
    if (faltas.length) {
      return setErro(`Para enviar, ${faltas.join(', ').replace(/, ([^,]*)$/, ' e $1')}.`);
    }
    if (!categoriaId || !ponto || !bairroId) return;
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
        ignorarDuplicada,
      });
      setCriada(r);
      recarregar().catch(() => {});
      // O prazo foi calculado pelo banco; busca para mostrar no comprovante.
      ocorrenciaApi.detalhe(r.id).then((d) => setPrazoCriada(d.prazo)).catch(() => {});
    } catch (e) {
      // Duplicidade detectada pela procedure (corrida com outro morador).
      if (e instanceof ErroApi && e.referenciaId) {
        const id = e.referenciaId;
        setDuplicataNoEnvio(true);
        setDuplicada({ id, protocolo: '', titulo: e.message });
        ocorrenciaApi
          .detalhe(id)
          .then((d) => {
            setDuplicada({ id, protocolo: d.protocolo, titulo: d.titulo });
            setJaAcompanha(d.jaApoiei || d.souAutor);
          })
          .catch(() => {});
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
      setAviso('Apoio registrado. A prioridade da ocorrência subiu e você vai receber os avisos dela.');
    } catch (e) {
      setAviso(null);
      // Ja apoiava: nao e erro, so informa que ja acompanha.
      if (e instanceof ErroApi && e.status === 409 && /apoiou|registrou/.test(e.message)) setJaAcompanha(true);
      else setErro((e as Error).message);
    }
  }

  if (criada) {
    return (
      <View style={s.sucesso}>
        <View style={s.selo}>
          <CircleCheck size={40} color={cores.placa} />
        </View>
        <Text style={[tx.display, { textAlign: 'center' }]}>Pedido enviado</Text>
        <Text style={[tx.corpo, { textAlign: 'center' }]}>Guarde o protocolo. Ele é a prova do seu pedido.</Text>
        <Placa texto={criada.protocolo} tamanho="g" estilo={{ alignSelf: 'center' }} rotuloAcessivel={`Protocolo ${criada.protocolo}`} />
        <Botao
          titulo={copiado ? 'Protocolo copiado' : 'Copiar protocolo'}
          icone={copiado ? CircleCheck : Copy}
          variante="fantasma"
          compacto
          onPress={() => Clipboard.setStringAsync(criada.protocolo).then(() => setCopiado(true)).catch(() => {})}
        />
        {prazoCriada ? (
          <Text style={[tx.corpoForte, { textAlign: 'center' }]}>
            Prazo de atendimento: {dataCurta(prazoCriada)} ({prazoRelativo(prazoCriada).texto})
          </Text>
        ) : null}
        <Text style={[tx.legenda, { textAlign: 'center', maxWidth: 320 }]}>
          Você vai receber um aviso a cada mudança e ganhou 10 pontos de participação.
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
                aria-checked={ativo}
                accessibilityLabel={`${c.nome}. Prazo de ${c.prazoDias} dias.`}
                style={[s.categoria, tx.escala > 1 && { width: '48.5%' }, ativo && s.categoriaAtiva]}
              >
                <IconeCategoria nome={c.icone} tamanho={24} cor={ativo ? cores.branco : cores.placa} />
                <Text style={[tx.rotulo, { color: ativo ? cores.branco : cores.tinta, textAlign: 'center' }]}>
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
            <Chip
              key={b.id}
              texto={b.nome}
              ativo={bairroId === b.id}
              onPress={() => {
                // Trocar o bairro leva o mapa e o marcador para la; a pessoa so ajusta o ponto.
                setBairroId(b.id);
                const p = { lat: b.latitude, lon: b.longitude };
                setPonto(p);
                mapa.current?.enviar({ tipo: 'escolha', lat: p.lat, lon: p.lon });
              }}
            />
          ))}
        </View>
        <Campo rotulo="Endereço ou referência (opcional)" value={endereco} onChangeText={setEndereco} placeholder="Ex.: em frente ao nº 120" />
      </Secao>

      {duplicada && !duplicataNoEnvio && !confirmandoOutro ? (
        <Faixa
          tipo="info"
          texto={
            jaAcompanha
              ? `Você já acompanha a ocorrência ${protocoloInteiro(duplicada.protocolo)} sobre esse problema.`
              : duplicada.protocolo
                ? `Já existe a ocorrência ${protocoloInteiro(duplicada.protocolo)} aqui perto: "${duplicada.titulo}". Apoiar a existente aumenta a prioridade dela.`
                : duplicada.titulo
          }
          acao={
            <View style={s.chips}>
              {jaAcompanha ? null : <Botao titulo="Apoiar a existente" icone={ThumbsUp} onPress={apoiarExistente} estilo={{ minHeight: 44 }} />}
              <Botao titulo="É outro problema" variante="secundario" onPress={() => setConfirmandoOutro(true)} estilo={{ minHeight: 44 }} />
              <Botao
                titulo="Ver detalhes"
                variante="secundario"
                onPress={() => navegacao.navigate('Detalhe', { id: duplicada.id })}
                estilo={{ minHeight: 44 }}
              />
            </View>
          }
        />
      ) : null}
      
      <Secao numero={3} titulo="Conte o que está acontecendo">
        <Campo rotulo="Título" value={titulo} onChangeText={(t) => { setTitulo(t); if (t.trim().length >= 5) setErroTitulo(null); }} placeholder="Ex.: Poste apagado na esquina" maxLength={120} erro={erroTitulo} />
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
          icone={<Accessibility size={20} color={cores.placa} />}
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
            <Botao titulo="Câmera" icone={Camera} variante="secundario" onPress={() => escolherFoto('camera')} estilo={{ flex: 1 }} desabilitado={preparandoFoto} />
            <Botao titulo="Galeria" icone={ImagePlus} variante="secundario" onPress={() => escolherFoto('galeria')} estilo={{ flex: 1 }} carregando={preparandoFoto} />
          </View>
        )}
        {preparandoFoto ? <Text style={tx.legenda} accessibilityLiveRegion="polite">Preparando a foto para envio...</Text> : null}
        {erroFoto ? <Faixa tipo="erro" texto={erroFoto} /> : null}
      </Secao>

      {erro ? <Faixa tipo="erro" texto={erro} /> : null}
      {duplicada && (duplicataNoEnvio || confirmandoOutro) ? (
        <Faixa
          tipo="info"
          texto={
            confirmandoOutro
              ? `Confirme que é um problema diferente do que já foi relatado aqui perto${duplicada.protocolo ? ` (${protocoloInteiro(duplicada.protocolo)})` : ''}. Toque em Enviar mesmo assim.`
              : jaAcompanha
                ? `Você já acompanha a ocorrência${duplicada.protocolo ? ` ${protocoloInteiro(duplicada.protocolo)}` : ''} sobre esse problema.`
                : `Esse problema já foi relatado aqui perto${duplicada.protocolo ? ` (${protocoloInteiro(duplicada.protocolo)})` : ''}. Apoie o pedido existente em vez de enviar outro.`
          }
          acao={
            <View style={s.chips}>
              {confirmandoOutro ? null : jaAcompanha ? (
                <Botao titulo="Ver ocorrência" compacto onPress={() => navegacao.navigate('Detalhe', { id: duplicada.id })} />
              ) : (
                <Botao titulo="Apoiar a existente" icone={ThumbsUp} onPress={apoiarExistente} compacto />
              )}
              {confirmandoOutro ? (
                <>
                  <Botao titulo="Enviar mesmo assim" icone={Send} variante="sinal" compacto carregando={enviando} onPress={() => enviar(true)} />
                  <Botao titulo="Voltar" variante="secundario" compacto onPress={() => setConfirmandoOutro(false)} />
                </>
              ) : (
                <Botao titulo="É outro problema" variante="secundario" compacto onPress={() => setConfirmandoOutro(true)} />
              )}
            </View>
          }
        />
      ) : null}
      {aviso ? <Faixa tipo="sucesso" texto={aviso} /> : null}
      {confirmandoOutro ? null : <Botao titulo="Enviar para a prefeitura" icone={Send} variante="sinal" onPress={() => enviar()} carregando={enviando && !confirmandoOutro} desabilitado={preparandoFoto} />}
    </ScrollView>
  );
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  const tx = useTexto();
  return (
    <View style={s.secao}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2.5) }}>
        <View style={s.numero}>
          <Text style={{ color: cores.branco, fontFamily: fontes.condensadaNegrito, fontSize: 15 }}>{numero}</Text>
        </View>
        <Text style={tx.tituloMenor} accessibilityRole="header">
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
      <Interruptor valor={props.valor} aoMudar={props.aoMudar} rotulo={props.titulo} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(4), paddingBottom: esp(12), maxWidth: 640, width: '100%', alignSelf: 'center' },
  secao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    padding: esp(5),
    gap: esp(4),
  },
  numero: {
    width: 26,
    height: 26,
    borderRadius: raio.placa,
    backgroundColor: cores.placa,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) },
  categoria: {
    width: '31.5%',
    minHeight: 86,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: esp(1.5),
    padding: esp(2),
    backgroundColor: cores.fundo,
  },
  categoriaAtiva: { backgroundColor: cores.placa, borderColor: cores.placa },
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
    backgroundColor: cores.placaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
