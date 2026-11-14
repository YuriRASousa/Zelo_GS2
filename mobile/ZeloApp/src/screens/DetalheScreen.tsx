import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import {
  Accessibility,
  Building2,
  CalendarClock,
  Camera,
  ImagePlus,
  MapPin,
  MessageSquare,
  SearchX,
  Send,
  Share2,
  ShieldAlert,
  Star,
  ThumbsUp,
  UserRound,
  X,
  XCircle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada, urlFoto, urlWeb } from '../config/api';
import { gestorApi, ocorrenciaApi } from '../services/zelo';
import IconeCategoria from '../components/Icone';
import MapaFrame from '../components/mapa/MapaFrame';
import { mapaHtml, type MapaRef, type MensagemMapa } from '../components/mapa/mapaHtml';
import { Bloco, Botao, BotaoIcone, Campo, Carregando, Divisor, Faixa, Placa, StatusBadge, Vazio } from '../components/ui';
import { corPrioridade, cores, esp, fontes, proximosStatus, raio, statusInfo } from '../theme/tema';
import { dataCurta, dataHora, prazoRelativo } from '../utils/formato';
import { obterFoto, type FotoPronta } from '../utils/foto';
import type { EventoHistorico, OcorrenciaDetalhe, Status } from '../types';
import type { RaizParams } from '../navigation/tipos';

type Origem = 'topo' | 'apoio' | 'gestor' | 'avaliar' | 'comentar' | 'cancelar';
type Aviso = { tipo: 'sucesso' | 'erro' | 'info'; texto: string; origem: Origem } | null;

/**
 * Funcionalidade 3: acompanhar. Etapas, prazo, antes e depois, mini mapa,
 * linha do tempo (gravada por trigger), apoio, comentarios, cancelamento
 * pelo autor, avaliacao e, para o gestor, o proximo passo permitido.
 */
export default function DetalheScreen() {
  const { params } = useRoute<RouteProp<RaizParams, 'Detalhe'>>();
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { usuario, recarregar } = useAuth();
  const tx = useTexto();

  const [o, setO] = useState<OcorrenciaDetalhe | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verDepois, setVerDepois] = useState(true);

  const [nota, setNota] = useState(0);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState('');
  const [comentario, setComentario] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [comentarioGestor, setComentarioGestor] = useState('');
  const [fotoSolucao, setFotoSolucao] = useState<FotoPronta | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const rolagem = React.useRef<ScrollView>(null);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      try {
        setO(await ocorrenciaApi.detalhe(params.id, sinal));
      } catch (e) {
        if (!foiCancelada(e)) setErroCarga((e as Error).message);
      }
    },
    [params.id],
  );

  useEffect(() => {
    const controle = new AbortController();
    carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  /** Executa uma acao, mostra o resultado na tela e recarrega o detalhe. */
  async function executar(chave: string, origem: Origem, acao: () => Promise<unknown>, sucesso: string): Promise<boolean> {
    setAviso(null);
    setOcupado(chave);
    try {
      await acao();
      // Se a acao encerra a ocorrencia, o bloco dela some: a confirmacao vai
      // para o topo e a tela rola ate la.
      const encerrou = origem === 'cancelar' || chave === 'RESOLVIDA' || chave === 'CANCELADA';
      setAviso({ tipo: 'sucesso', texto: sucesso, origem: encerrou ? 'topo' : origem });
      if (encerrou) rolagem.current?.scrollTo({ y: 0, animated: true });
      await carregar();
      recarregar().catch(() => {});
      return true;
    } catch (e) {
      setAviso({ tipo: 'erro', texto: (e as Error).message, origem });
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function compartilhar() {
    if (!o) return;
    const texto = `Acompanhe no Zelo a ocorrência ${o.protocolo}: ${o.titulo} (${o.bairro}). Status: ${statusInfo[o.status].rotulo}. ${urlWeb()}/ocorrencia/${o.id}`;
    try {
      if (Platform.OS === 'web' && !(navigator as Navigator & { share?: unknown }).share) {
        await Clipboard.setStringAsync(texto);
        setAviso({ tipo: 'info', texto: 'Texto com o link da ocorrência copiado. É só colar na conversa.', origem: 'topo' });
      } else {
        await Share.share({ message: texto, title: `Ocorrência ${o.protocolo}` });
      }
    } catch {
      await Clipboard.setStringAsync(texto).catch(() => {});
      setAviso({ tipo: 'info', texto: 'Texto com o link da ocorrência copiado. É só colar na conversa.', origem: 'topo' });
    }
  }

  /** Mensagem mostrada junto da acao que a gerou, nunca fora da vista. */
  function mensagem(...origens: Origem[]) {
    return aviso && origens.includes(aviso.origem) ? <Faixa tipo={aviso.tipo} texto={aviso.texto} /> : null;
  }

  if (!o) {
    return erroCarga ? (
      <Vazio
        icone={SearchX}
        titulo="Não encontramos esta ocorrência"
        texto={erroCarga}
        acao={
          <Botao
            titulo="Voltar ao mapa"
            variante="secundario"
            compacto
            onPress={() => navegacao.reset({ index: 0, routes: [{ name: 'Abas' }] })}
          />
        }
      />
    ) : (
      <Carregando />
    );
  }

  const gestor = usuario?.papel === 'GESTOR';
  const encerrada = o.status === 'RESOLVIDA' || o.status === 'CANCELADA';
  const prazo = prazoRelativo(o.prazo);
  const podeApoiar = !gestor && !o.souAutor && !o.jaApoiei && !encerrada;
  const podeAvaliar = o.souAutor && o.status === 'RESOLVIDA' && o.nota == null;
  const fotoAtual = o.fotoSolucao && verDepois ? o.fotoSolucao : o.foto;

  return (
    <ScrollView ref={rolagem} contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      {/* Foto: antes e depois quando a prefeitura anexou a da solucao */}
      <View>
        {fotoAtual ? (
          <Image
            source={{ uri: urlFoto(fotoAtual) }}
            style={s.foto}
            resizeMode="cover"
            accessibilityLabel={fotoAtual === o.fotoSolucao ? 'Foto depois do atendimento' : `Foto do problema: ${o.titulo}`}
          />
        ) : (
          <View style={[s.foto, s.semFoto]}>
            <IconeCategoria nome={o.icone} tamanho={44} />
            <Text style={tx.legenda}>Relatada sem foto</Text>
          </View>
        )}
        {fotoAtual ? (
          <View style={s.rotuloFoto} pointerEvents="none">
            <Text style={[tx.legenda, { color: cores.branco, fontFamily: fontes.semi }]}>
              {fotoAtual === o.fotoSolucao ? 'Depois, foto da equipe da prefeitura' : 'Antes, foto de quem relatou'}
            </Text>
          </View>
        ) : null}
        {o.fotoSolucao && o.foto ? (
          <View style={s.antesDepois} accessibilityRole="tablist">
            {(['Antes', 'Depois'] as const).map((r) => {
              const ativo = (r === 'Depois') === verDepois;
              return (
                <Pressable
                  key={r}
                  onPress={() => setVerDepois(r === 'Depois')}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativo }}
                  style={[s.abaFoto, ativo && { backgroundColor: cores.tinta }]}
                >
                  <Text style={[tx.rotulo, { color: ativo ? cores.branco : cores.tinta }]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Cabecalho */}
      <View style={{ gap: esp(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Placa texto={o.protocolo} tamanho="m" rotuloAcessivel={`Protocolo ${o.protocolo}`} />
          <BotaoIcone icone={Share2} rotulo="Compartilhar protocolo" onPress={compartilhar} />
        </View>
        <Text style={tx.legenda}>{o.categoria}</Text>
        <Text style={tx.titulo}>{o.titulo}</Text>
        <StatusBadge status={o.status} atrasada={o.atrasada} />
      </View>

      {podeApoiar ? (
        <Botao
          titulo="Também vi esse problema"
          icone={ThumbsUp}
          variante="sinal"
          dica="Confirma o problema e aumenta a prioridade"
          carregando={ocupado === 'apoio'}
          onPress={() => executar('apoio', 'apoio', () => ocorrenciaApi.apoiar(o.id), 'Apoio registrado. A prioridade subiu e você vai receber avisos desta ocorrência.')}
        />
      ) : o.jaApoiei && aviso?.origem !== 'apoio' ? (
        <Faixa tipo="info" texto="Você apoiou esta ocorrência e recebe aviso quando ela mudar." />
      ) : null}
      {mensagem('topo', 'apoio')}

      <Passos status={o.status} />

      {/* Informacoes */}
      <Bloco estilo={{ gap: esp(4) }}>
        {!encerrada ? (
          <View style={{ gap: esp(2) }} accessibilityLabel={`Prioridade ${o.prioridade} de 100`}>
            <View style={s.linhaEntre}>
              <Text style={tx.rotulo}>Prioridade na fila da prefeitura</Text>
              <Text style={[s.numeroPrioridade, { color: corPrioridade(o.prioridade) }]}>{o.prioridade}</Text>
            </View>
            <View style={s.trilho}>
              <View style={[s.barra, { width: `${o.prioridade}%`, backgroundColor: corPrioridade(o.prioridade) }]} />
            </View>
          </View>
        ) : null}
        <Info icone={<CalendarClock size={18} color={prazo.vencido && !encerrada ? cores.perigo : cores.tintaSuave} />}>
          {o.status === 'RESOLVIDA' && o.resolucao
            ? `Resolvida em ${dataCurta(o.resolucao)} (prazo era ${dataCurta(o.prazo)})`
            : o.status === 'CANCELADA'
              ? 'Ocorrência cancelada'
              : `Prazo ${dataCurta(o.prazo)}, ${prazo.texto}`}
        </Info>
        <Info icone={<Building2 size={18} color={cores.tintaSuave} />}>{o.orgao}</Info>
        <Info icone={<UserRound size={18} color={cores.tintaSuave} />}>
          Relatada por {o.souAutor ? 'você' : o.autor} em {dataCurta(o.abertura)}
        </Info>
        <Info icone={<ThumbsUp size={18} color={cores.tintaSuave} />}>
          {o.apoios === 0
            ? 'Nenhum vizinho confirmou ainda'
            : o.apoios === 1
              ? '1 vizinho confirmou o problema'
              : `${o.apoios} vizinhos confirmaram o problema`}
        </Info>
        {o.risco ? <Info icone={<ShieldAlert size={18} color={cores.perigo} />}>Risco para pessoas, prazo reduzido pela metade</Info> : null}
        {o.acessibilidade ? (
          <Info icone={<Accessibility size={18} color={cores.placa} />}>Barreira para quem tem deficiência ou mobilidade reduzida</Info>
        ) : null}
        {o.descricao ? (
          <>
            <Divisor />
            <Text style={tx.corpo}>{o.descricao}</Text>
          </>
        ) : null}
      </Bloco>

      {/* Local */}
      <Bloco estilo={{ padding: 0, overflow: 'hidden' }}>
        <MiniMapa lat={o.latitude} lon={o.longitude} />
        <View style={{ padding: esp(4), flexDirection: 'row', gap: esp(3), alignItems: 'flex-start' }}>
          <MapPin size={18} color={cores.placa} style={{ marginTop: 2 }} />
          <Text style={[tx.corpo, { flex: 1 }]}>{[o.endereco, o.bairro].filter(Boolean).join(', ')}</Text>
        </View>
      </Bloco>

      {/* Gestor */}
      {gestor && !encerrada ? (
        <Bloco estilo={{ gap: esp(4) }}>
          <Text style={tx.tituloMenor}>Atualizar andamento</Text>
          <Campo
            rotulo="Comentário para o cidadão"
            value={comentarioGestor}
            onChangeText={setComentarioGestor}
            placeholder="Ex.: equipe agendada para quinta-feira"
            maxLength={500}
            multiline
            ajuda={proximosStatus[o.status].includes('CANCELADA') ? 'Obrigatório para cancelar (vira o motivo). Aparece na linha do tempo.' : 'Aparece na linha do tempo para o cidadão.'}
          />
          {proximosStatus[o.status].includes('RESOLVIDA') ? (
            fotoSolucao ? (
              <View style={{ gap: esp(2) }}>
                <Image source={{ uri: fotoSolucao.uri }} style={[s.foto, { height: 150 }]} accessibilityLabel="Foto da solução" />
                <Botao titulo="Remover foto da solução" icone={X} variante="fantasma" compacto onPress={() => setFotoSolucao(null)} />
              </View>
            ) : (
              <View style={{ gap: esp(2) }}>
              <Text style={tx.rotulo}>Foto do depois (opcional, aparece para o cidadão)</Text>
              <View style={{ flexDirection: 'row', gap: esp(2) }}>
                <Botao
                  titulo="Câmera"
                  icone={Camera}
                  variante="secundario"
                  compacto
                  estilo={{ flex: 1 }}
                  onPress={() =>
                    obterFoto('camera')
                      .then((f) => f && setFotoSolucao(f))
                      .catch((e) => setAviso({ tipo: 'erro', texto: (e as Error).message, origem: 'gestor' }))
                  }
                />
                <Botao
                  titulo="Galeria"
                  icone={ImagePlus}
                  variante="secundario"
                  compacto
                  estilo={{ flex: 1 }}
                  onPress={() =>
                    obterFoto('galeria')
                      .then((f) => f && setFotoSolucao(f))
                      .catch((e) => setAviso({ tipo: 'erro', texto: (e as Error).message, origem: 'gestor' }))
                  }
                />
              </View>
              </View>
            )
          ) : null}
          {o.status === 'EM_ANDAMENTO' ? (
            <Text style={tx.legenda}>Com a equipe já em campo, o próximo passo é resolver. Cancelar só é possível até a análise.</Text>
          ) : null}
          {mensagem('gestor')}
          <View style={{ gap: esp(2) }}>
            {proximosStatus[o.status].map((st: Status) => (
              <Botao
                key={st}
                titulo={st === 'CANCELADA' ? (confirmandoCancelamento ? 'Confirmar cancelamento' : 'Cancelar ocorrência') : `Mover para ${statusInfo[st].rotulo}`}
                variante={st === 'CANCELADA' ? 'perigo' : 'primario'}
                carregando={ocupado === st}
                onPress={async () => {
                  if (st === 'CANCELADA') {
                    if (comentarioGestor.trim().length < 5) {
                      setAviso({ tipo: 'erro', texto: 'Para cancelar, escreva o motivo no comentário (pelo menos 5 letras). Ele aparece para o cidadão.', origem: 'gestor' });
                      return;
                    }
                    if (!confirmandoCancelamento) {
                      setConfirmandoCancelamento(true);
                      setAviso({ tipo: 'info', texto: 'Toque de novo em Confirmar cancelamento. O cidadão e quem apoiou serão avisados.', origem: 'gestor' });
                      return;
                    }
                  }
                  setConfirmandoCancelamento(false);
                  const ok = await executar(
                    st,
                    'gestor',
                    () =>
                      gestorApi.mudarStatus(
                        o.id,
                        st,
                        comentarioGestor.trim() || (st === 'CANCELADA' ? '' : statusInfo[st].rotulo),
                        st === 'RESOLVIDA' ? fotoSolucao?.base64 : null,
                      ),
                    `Status atualizado para ${statusInfo[st].rotulo}. O cidadão foi avisado.`,
                  );
                  if (ok) {
                    setComentarioGestor('');
                    setFotoSolucao(null);
                  }
                }}
              />
            ))}
          </View>
        </Bloco>
      ) : null}

      {/* Avaliacao */}
      {podeAvaliar ? (
        <Bloco estilo={{ gap: esp(3) }}>
          <Text style={tx.tituloMenor}>Como foi o atendimento?</Text>
          <View style={{ flexDirection: 'row', gap: esp(2) }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setNota(n)}
                accessibilityRole="radio"
                accessibilityLabel={`${n} estrela${n > 1 ? 's' : ''}`}
                accessibilityState={{ checked: nota === n }}
                aria-checked={nota === n}
                hitSlop={6}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Star size={36} color={cores.sinalEscuro} fill={n <= nota ? cores.sinal : 'transparent'} />
              </Pressable>
            ))}
          </View>
          <Campo rotulo="Comentário (opcional)" value={comentarioAvaliacao} onChangeText={setComentarioAvaliacao} maxLength={500} />
          {mensagem('avaliar')}
          <Botao
            titulo="Enviar avaliação"
            desabilitado={nota === 0}
            carregando={ocupado === 'avaliar'}
            onPress={() =>
              executar('avaliar', 'avaliar', () => ocorrenciaApi.avaliar(o.id, nota, comentarioAvaliacao.trim()), 'Avaliação enviada. Ela entra na nota média do bairro.')
            }
          />
        </Bloco>
      ) : null}

      {o.nota != null ? (
        <Bloco estilo={{ gap: esp(2) }}>
          <Text style={tx.rotulo}>Avaliação de quem relatou</Text>
          <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`${o.nota} de 5 estrelas`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={20} color={cores.sinalEscuro} fill={n <= (o.nota ?? 0) ? cores.sinal : 'transparent'} />
            ))}
          </View>
          {o.comentarioAvaliacao ? <Text style={tx.corpo}>“{o.comentarioAvaliacao}”</Text> : null}
        </Bloco>
      ) : null}

      {/* Linha do tempo e comentarios */}
      <Bloco estilo={{ gap: esp(1) }}>
        <Text style={[tx.tituloMenor, { marginBottom: esp(3) }]}>Linha do tempo</Text>
        {o.historico.map((h, i) => (
          <Evento key={`${h.data}-${i}`} h={h} ultimo={i === o.historico.length - 1} />
        ))}
        {o.podeComentar ? (
          <View style={{ gap: esp(2), marginTop: esp(3) }}>
            <Campo
              rotulo={gestor ? 'Comentar sem mudar o status' : 'Acrescentar informação'}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Ex.: o buraco aumentou depois da chuva"
              maxLength={500}
              multiline
              ajuda={
                comentario.trim().length < 3
                  ? `Escreva pelo menos 3 letras para publicar${comentario.trim().length ? ` (faltam ${3 - comentario.trim().length})` : ''}.`
                  : `${comentario.length}/500`
              }
            />
            {mensagem('comentar')}
            <Botao
              titulo="Publicar na linha do tempo"
              icone={Send}
              variante="secundario"
              desabilitado={comentario.trim().length < 3}
              carregando={ocupado === 'comentar'}
              onPress={async () => {
                if (await executar('comentar', 'comentar', () => ocorrenciaApi.comentar(o.id, comentario.trim()), 'Informação publicada. Quem acompanha foi avisado.')) {
                  setComentario('');
                }
              }}
            />
          </View>
        ) : null}
      </Bloco>

      {/* Cancelamento pelo autor */}
      {o.podeCancelar ? (
        cancelando ? (
          <Bloco estilo={{ gap: esp(3) }}>
            <Text style={tx.tituloMenor}>Cancelar este pedido</Text>
            <Text style={tx.corpo}>Use quando o problema foi resolvido por outra via ou foi relatado por engano.</Text>
            <Campo
              rotulo="Motivo"
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ex.: a equipe já consertou"
              maxLength={300}
              ajuda={motivo.trim().length < 5 ? 'Escreva o motivo (pelo menos 5 letras) para confirmar.' : undefined}
            />
            {mensagem('cancelar')}
            <View style={{ flexDirection: 'row', gap: esp(2) }}>
              <Botao titulo="Voltar" variante="secundario" onPress={() => setCancelando(false)} estilo={{ flex: 1 }} />
              <Botao
                titulo="Confirmar"
                variante="perigo"
                estilo={{ flex: 1 }}
                desabilitado={motivo.trim().length < 5}
                carregando={ocupado === 'cancelar'}
                onPress={async () => {
                  if (await executar('cancelar', 'cancelar', () => ocorrenciaApi.cancelar(o.id, motivo.trim()), 'Pedido cancelado.')) {
                    setCancelando(false);
                    setMotivo('');
                  }
                }}
              />
            </View>
          </Bloco>
        ) : (
          <Botao
            titulo="Cancelar meu pedido"
            icone={XCircle}
            variante="fantasma"
            onPress={() => {
              setCancelando(true);
              setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 80);
            }}
          />
        )
      ) : null}
    </ScrollView>
  );
}

function MiniMapa({ lat, lon }: { lat: number; lon: number }) {
  const ref = React.useRef<MapaRef>(null);
  const html = useMemo(() => mapaHtml(lat, lon, 16, true, true), [lat, lon]);
  const aoReceber = useCallback(
    (m: MensagemMapa) => {
      if (m.tipo === 'pronto') ref.current?.enviar({ tipo: 'fixo', lat, lon });
    },
    [lat, lon],
  );
  return (
    <View style={{ height: 160 }} accessibilityLabel="Mapa com o local da ocorrência">
      <MapaFrame ref={ref} html={html} aoReceber={aoReceber} />
    </View>
  );
}

/** Barra de etapas: Aberta, Em analise, Em andamento, Resolvida. */
function Passos({ status }: { status: Status }) {
  const tx = useTexto();
  if (status === 'CANCELADA') return null;
  const atual = statusInfo[status].passo;
  const passos: Status[] = ['ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO', 'RESOLVIDA'];
  return (
    <View style={s.passos} accessibilityLabel={`Etapa ${atual} de 4: ${statusInfo[status].rotulo}`}>
      {passos.map((p) => {
        const feito = statusInfo[p].passo <= atual;
        return (
          <View key={p} style={{ flex: 1, gap: esp(1.5) }}>
            <View style={[s.passo, { backgroundColor: feito ? cores.placa : cores.linha }]} />
            <Text
              style={[tx.legenda, { fontSize: Math.round(11.5 * tx.escala), color: feito ? cores.tinta : cores.apagado }, feito && { fontFamily: fontes.semi }]}
            >
              {statusInfo[p].rotulo}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Evento({ h, ultimo }: { h: EventoHistorico; ultimo: boolean }) {
  const tx = useTexto();
  const tipo = h.tipo ?? (h.comentario?.startsWith('[ATRASO]') ? 'ATRASO' : h.statusAnterior ? 'STATUS' : 'REGISTRO');
  const cor =
    tipo === 'ATRASO' ? cores.perigo : tipo === 'COMENTARIO' ? cores.tintaSuave : statusInfo[h.statusNovo].cor;
  const titulo =
    tipo === 'ATRASO'
      ? 'Prazo vencido'
      : tipo === 'COMENTARIO'
        ? h.papelAutor === 'GESTOR'
          ? 'Comentário da prefeitura'
          : 'Informação acrescentada'
        : tipo === 'REGISTRO'
          ? 'Registrada'
          : statusInfo[h.statusNovo].rotulo;
  return (
    <View style={s.evento}>
      <View style={{ alignItems: 'center', width: 18 }}>
        {tipo === 'COMENTARIO' ? (
          <MessageSquare size={16} color={cor} style={{ marginTop: 2 }} />
        ) : (
          <View style={[s.bolinha, { backgroundColor: cor }]} />
        )}
        {!ultimo ? <View style={s.fio} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: esp(5), gap: 3 }}>
        <Text style={[tx.corpoForte, { color: cor }]}>{titulo}</Text>
        {h.comentario ? <Text style={tx.corpo}>{h.comentario.replace('[ATRASO] ', '')}</Text> : null}
        <Text style={tx.legenda}>
          {dataHora(h.data)}, {h.autor}
        </Text>
      </View>
    </View>
  );
}

function Info({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  const tx = useTexto();
  return (
    <View style={{ flexDirection: 'row', gap: esp(3), alignItems: 'flex-start' }}>
      <View style={{ paddingTop: 2 }}>{icone}</View>
      <Text style={[tx.corpo, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(5), paddingBottom: esp(14), maxWidth: 640, width: '100%', alignSelf: 'center' },
  foto: { width: '100%', height: 230, borderRadius: raio.g, backgroundColor: cores.linha },
  semFoto: { alignItems: 'center', justifyContent: 'center', gap: esp(2), backgroundColor: cores.placaClara },
  rotuloFoto: {
    position: 'absolute',
    top: esp(3),
    left: esp(3),
    backgroundColor: 'rgba(34,38,43,0.72)',
    paddingHorizontal: esp(2.5),
    paddingVertical: esp(1),
    borderRadius: raio.placa,
  },
  antesDepois: {
    position: 'absolute',
    bottom: esp(3),
    left: esp(3),
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: raio.p,
    padding: 3,
  },
  abaFoto: { paddingHorizontal: esp(4), minHeight: 34, justifyContent: 'center', borderRadius: raio.p - 3 },
  linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numeroPrioridade: { fontFamily: fontes.condensadaNegrito, fontSize: 26, lineHeight: 28 },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.linhaSuave, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
  passos: { flexDirection: 'row', gap: esp(2) },
  passo: { height: 5, borderRadius: 3 },
  evento: { flexDirection: 'row', gap: esp(3) },
  bolinha: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  fio: { width: 2, flex: 1, backgroundColor: cores.linhaSuave, marginTop: 3 },
});
