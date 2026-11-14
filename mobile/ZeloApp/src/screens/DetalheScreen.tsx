import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  Accessibility,
  Building2,
  CalendarClock,
  MapPin,
  ShieldAlert,
  Star,
  ThumbsUp,
  UserRound,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada, urlFoto } from '../config/api';
import { gestorApi, ocorrenciaApi } from '../services/zelo';
import IconeCategoria from '../components/Icone';
import { Botao, Campo, Carregando, Cartao, Faixa, StatusBadge } from '../components/ui';
import { corPrioridade, cores, esp, proximosStatus, raio, statusInfo } from '../theme/tema';
import { dataCurta, dataHora, prazoRelativo } from '../utils/formato';
import type { OcorrenciaDetalhe, Status } from '../types';
import type { RaizParams } from '../navigation/tipos';

/**
 * Funcionalidade 3: acompanhar. Linha do tempo gravada pelo trigger do
 * banco, apoio da vizinhanca, avaliacao do atendimento e, para o gestor,
 * os botoes do proximo passo permitido.
 */
export default function DetalheScreen() {
  const { params } = useRoute<RouteProp<RaizParams, 'Detalhe'>>();
  const { usuario, recarregar } = useAuth();
  const tx = useTexto();

  const [o, setO] = useState<OcorrenciaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [comentarioGestor, setComentarioGestor] = useState('');

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      try {
        setO(await ocorrenciaApi.detalhe(params.id, sinal));
      } catch (e) {
        if (!foiCancelada(e)) setErro((e as Error).message);
      }
    },
    [params.id],
  );

  useEffect(() => {
    const controle = new AbortController();
    carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await acao();
      setAviso(sucesso);
      await carregar();
      recarregar().catch(() => {});
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (!o) return erro ? <View style={{ padding: esp(4) }}><Faixa tipo="erro" texto={erro} /></View> : <Carregando />;

  const gestor = usuario?.papel === 'GESTOR';
  const encerrada = o.status === 'RESOLVIDA' || o.status === 'CANCELADA';
  const prazo = prazoRelativo(o.prazo);
  const podeApoiar = !gestor && !o.souAutor && !o.jaApoiei && !encerrada;
  const podeAvaliar = o.souAutor && o.status === 'RESOLVIDA' && o.nota == null;

  return (
    <ScrollView contentContainerStyle={s.conteudo}>
      {o.foto ? (
        <Image source={{ uri: urlFoto(o.foto) }} style={s.foto} accessibilityLabel={`Foto: ${o.titulo}`} resizeMode="cover" />
      ) : (
        <View style={[s.foto, s.semFoto]}>
          <IconeCategoria nome={o.icone} tamanho={48} />
          <Text style={tx.legenda}>Sem foto</Text>
        </View>
      )}

      <View style={{ gap: esp(2) }}>
        <Text style={[tx.legenda, { fontWeight: '700', letterSpacing: 0.5 }]} selectable>
          {o.protocolo} · {o.categoria}
        </Text>
        <Text style={tx.titulo}>{o.titulo}</Text>
        <StatusBadge status={o.status} atrasada={o.atrasada} />
      </View>

      {aviso ? <Faixa tipo="sucesso" texto={aviso} /> : null}
      {erro ? <Faixa tipo="erro" texto={erro} /> : null}

      <Passos status={o.status} />

      <Cartao estilo={{ gap: esp(3) }}>
        {!encerrada ? (
          <View style={{ gap: esp(1.5) }} accessibilityLabel={`Prioridade ${o.prioridade} de 100`}>
            <View style={s.linhaEntre}>
              <Text style={tx.rotulo}>Prioridade na fila</Text>
              <Text style={[tx.corpoForte, { color: corPrioridade(o.prioridade) }]}>{o.prioridade}/100</Text>
            </View>
            <View style={s.trilho}>
              <View style={[s.barra, { width: `${o.prioridade}%`, backgroundColor: corPrioridade(o.prioridade) }]} />
            </View>
          </View>
        ) : null}
        <Info icone={<CalendarClock size={18} color={prazo.vencido && !encerrada ? cores.perigo : cores.tintaSuave} />}>
          {encerrada && o.resolucao
            ? `Resolvida em ${dataCurta(o.resolucao)} (prazo era ${dataCurta(o.prazo)})`
            : `Prazo: ${dataCurta(o.prazo)}, ${prazo.texto}`}
        </Info>
        <Info icone={<Building2 size={18} color={cores.tintaSuave} />}>{o.orgao}</Info>
        <Info icone={<MapPin size={18} color={cores.tintaSuave} />}>
          {[o.endereco, o.bairro].filter(Boolean).join(' · ')}
        </Info>
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
        {o.risco ? (
          <Info icone={<ShieldAlert size={18} color={cores.perigo} />}>Risco para pessoas: prazo reduzido</Info>
        ) : null}
        {o.acessibilidade ? (
          <Info icone={<Accessibility size={18} color={cores.info} />}>Barreira de acessibilidade</Info>
        ) : null}
        {o.descricao ? <Text style={tx.corpo}>{o.descricao}</Text> : null}
      </Cartao>

      {podeApoiar ? (
        <Botao
          titulo="Também vi esse problema"
          icone={ThumbsUp}
          variante="destaque"
          dica="Confirma o problema e aumenta a prioridade"
          carregando={ocupado}
          onPress={() => executar(() => ocorrenciaApi.apoiar(o.id), 'Obrigado! Seu apoio aumentou a prioridade.')}
        />
      ) : o.jaApoiei ? (
        <Faixa tipo="info" texto="Você já apoiou esta ocorrência." />
      ) : null}

      {gestor && !encerrada ? (
        <Cartao estilo={{ gap: esp(3) }}>
          <Text style={tx.subtitulo}>Atualizar andamento</Text>
          <Campo
            rotulo="Comentário para o cidadão"
            value={comentarioGestor}
            onChangeText={setComentarioGestor}
            placeholder="Ex.: equipe agendada para quinta-feira"
            maxLength={500}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) }}>
            {proximosStatus[o.status].map((st) => (
              <Botao
                key={st}
                titulo={st === 'CANCELADA' ? 'Cancelar' : `Mover para ${statusInfo[st].rotulo}`}
                variante={st === 'CANCELADA' ? 'perigo' : 'primario'}
                carregando={ocupado}
                estilo={{ flexGrow: 1 }}
                onPress={() =>
                  executar(
                    () => gestorApi.mudarStatus(o.id, st, comentarioGestor.trim() || statusInfo[st].rotulo),
                    `Status atualizado para ${statusInfo[st].rotulo}.`,
                  ).then(() => setComentarioGestor(''))
                }
              />
            ))}
          </View>
        </Cartao>
      ) : null}

      {podeAvaliar ? (
        <Cartao estilo={{ gap: esp(3) }}>
          <Text style={tx.subtitulo}>Como foi o atendimento?</Text>
          <View style={{ flexDirection: 'row', gap: esp(2) }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setNota(n)}
                accessibilityRole="radio"
                accessibilityLabel={`${n} estrela${n > 1 ? 's' : ''}`}
                accessibilityState={{ checked: nota === n }}
                hitSlop={6}
              >
                <Star size={34} color={cores.destaque} fill={n <= nota ? cores.destaque : 'transparent'} />
              </Pressable>
            ))}
          </View>
          <Campo rotulo="Comentário (opcional)" value={comentario} onChangeText={setComentario} maxLength={500} />
          <Botao
            titulo="Enviar avaliação"
            desabilitado={nota === 0}
            carregando={ocupado}
            onPress={() => executar(() => ocorrenciaApi.avaliar(o.id, nota, comentario.trim()), 'Avaliação enviada. Obrigado!')}
          />
        </Cartao>
      ) : null}

      {o.nota != null ? (
        <Cartao estilo={{ gap: esp(2) }}>
          <Text style={tx.rotulo}>Avaliação do cidadão</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={20} color={cores.destaque} fill={n <= (o.nota ?? 0) ? cores.destaque : 'transparent'} />
            ))}
          </View>
          {o.comentarioAvaliacao ? <Text style={tx.corpo}>“{o.comentarioAvaliacao}”</Text> : null}
        </Cartao>
      ) : null}

      <Cartao estilo={{ gap: esp(1) }}>
        <Text style={[tx.subtitulo, { marginBottom: esp(2) }]}>Linha do tempo</Text>
        {o.historico.map((h, i) => {
          const atraso = h.comentario?.startsWith('[ATRASO]');
          const cor = atraso ? cores.perigo : statusInfo[h.statusNovo].cor;
          const ultimo = i === o.historico.length - 1;
          return (
            <View key={`${h.data}-${i}`} style={s.evento}>
              <View style={{ alignItems: 'center' }}>
                <View style={[s.bolinha, { backgroundColor: cor }]} />
                {!ultimo ? <View style={s.fio} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: esp(4), gap: 2 }}>
                <Text style={[tx.corpoForte, { color: cor }]}>
                  {atraso ? 'Prazo vencido' : h.statusAnterior && h.statusAnterior !== h.statusNovo
                    ? statusInfo[h.statusNovo].rotulo
                    : 'Registrada'}
                </Text>
                {h.comentario ? (
                  <Text style={tx.corpo}>{h.comentario.replace('[ATRASO] ', '')}</Text>
                ) : null}
                <Text style={tx.legenda}>
                  {dataHora(h.data)} · {h.autor}
                </Text>
              </View>
            </View>
          );
        })}
      </Cartao>
    </ScrollView>
  );
}

/** Barra de passos: Aberta > Em analise > Em andamento > Resolvida. */
function Passos({ status }: { status: Status }) {
  const tx = useTexto();
  if (status === 'CANCELADA') return <Faixa tipo="info" texto="Esta ocorrência foi cancelada pela prefeitura." />;
  const atual = statusInfo[status].passo;
  const passos: Status[] = ['ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO', 'RESOLVIDA'];
  return (
    <View style={s.passos} accessibilityLabel={`Etapa ${atual} de 4: ${statusInfo[status].rotulo}`}>
      {passos.map((p, i) => {
        const feito = statusInfo[p].passo <= atual;
        return (
          <View key={p} style={{ flex: 1, gap: esp(1.5) }}>
            <View style={[s.passo, { backgroundColor: feito ? cores.primariaMedia : cores.linha }]} />
            <Text style={[tx.legenda, { fontSize: 11 * tx.escala, color: feito ? cores.primaria : cores.apagado, fontWeight: feito ? '700' : '500' }]}>
              {i + 1}. {statusInfo[p].rotulo}
            </Text>
          </View>
        );
      })}
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
  conteudo: { padding: esp(4), gap: esp(4), paddingBottom: esp(12), maxWidth: 640, width: '100%', alignSelf: 'center' },
  foto: { width: '100%', height: 210, borderRadius: raio.g, backgroundColor: cores.linha },
  semFoto: { alignItems: 'center', justifyContent: 'center', gap: esp(2), backgroundColor: cores.primariaClara },
  linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.linha, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
  passos: { flexDirection: 'row', gap: esp(2) },
  passo: { height: 6, borderRadius: 3 },
  evento: { flexDirection: 'row', gap: esp(3) },
  bolinha: { width: 14, height: 14, borderRadius: 7, marginTop: 3, borderWidth: 3, borderColor: cores.branco },
  fio: { width: 2, flex: 1, backgroundColor: cores.linha, marginTop: 2 },
});
