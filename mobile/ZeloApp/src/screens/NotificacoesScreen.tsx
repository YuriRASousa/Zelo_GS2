import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellOff, CheckCheck, Hourglass, MessageSquare, RefreshCcw, ThumbsUp } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTexto } from '../hooks/useTexto';
import { foiCancelada } from '../config/api';
import { notificacaoApi } from '../services/zelo';
import { Botao, Divisor, Esqueleto, Faixa, Vazio } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';
import { dataHora } from '../utils/formato';
import type { Notificacao, TipoNotificacao } from '../types';
import type { RaizParams } from '../navigation/tipos';

const ICONE: Record<TipoNotificacao, { Icone: typeof ThumbsUp; cor: string; fundo: string }> = {
  STATUS: { Icone: RefreshCcw, cor: cores.placa, fundo: cores.placaClara },
  ATRASO: { Icone: Hourglass, cor: cores.perigo, fundo: cores.perigoClaro },
  APOIO: { Icone: ThumbsUp, cor: cores.sinalEscuro, fundo: cores.sinalClaro },
  COMENTARIO: { Icone: MessageSquare, cor: cores.tintaSuave, fundo: cores.linhaSuave },
};

/**
 * Avisos gerados pelo banco: mudanca de status (para quem relatou e quem
 * apoiou), prazo vencido, apoio novo e comentario. Tocar abre a ocorrencia
 * e marca o aviso como lido.
 */
export default function NotificacoesScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { atualizarNaoLidas } = useAuth();
  const tx = useTexto();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErro(null);
    setCarregando(true);
    try {
      setItens(await notificacaoApi.listar(sinal));
    } catch (e) {
      if (!foiCancelada(e)) setErro((e as Error).message);
    } finally {
      if (!sinal?.aborted) setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controle = new AbortController();
      carregar(controle.signal);
      return () => controle.abort();
    }, [carregar]),
  );

  async function abrir(n: Notificacao) {
    if (!n.lida) {
      setItens((lista) => lista.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      notificacaoApi.marcarLida(n.id).then(atualizarNaoLidas).catch(() => {});
    }
    navegacao.navigate('Detalhe', { id: n.ocorrenciaId });
  }

  async function marcarTodas() {
    setMarcando(true);
    try {
      await notificacaoApi.marcarTodas();
      setItens((lista) => lista.map((x) => ({ ...x, lida: true })));
      await atualizarNaoLidas();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setMarcando(false);
    }
  }

  const naoLidas = itens.filter((n) => !n.lida).length;

  return (
    <FlatList
      data={itens}
      keyExtractor={(n) => String(n.id)}
      contentContainerStyle={s.conteudo}
      refreshControl={<RefreshControl refreshing={carregando && itens.length > 0} onRefresh={() => carregar()} tintColor={cores.placa} />}
      ListHeaderComponent={
        <View style={{ gap: esp(3), marginBottom: esp(3) }}>
          {erro ? <Faixa tipo="erro" texto={erro} /> : null}
          {naoLidas > 0 ? (
            <View style={s.cabecalho}>
              <Text style={tx.rotulo}>
                {naoLidas} {naoLidas === 1 ? 'aviso novo' : 'avisos novos'}
              </Text>
              <Botao
                titulo="Marcar todas como lidas"
                icone={CheckCheck}
                variante="secundario"
                compacto
                carregando={marcando}
                onPress={marcarTodas}
                estilo={{ alignSelf: 'flex-start' }}
              />
            </View>
          ) : null}
          {carregando && itens.length === 0 ? (
            <View style={s.bloco}>
              <Esqueleto linhas={4} />
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item: n, index }) => {
        const v = ICONE[n.tipo] ?? ICONE.STATUS;
        return (
          <View
            style={[
              { backgroundColor: cores.superficie },
              index === 0 && { borderTopLeftRadius: raio.g, borderTopRightRadius: raio.g },
              index === itens.length - 1 && { borderBottomLeftRadius: raio.g, borderBottomRightRadius: raio.g },
            ]}
          >
            {index ? <Divisor estilo={{ marginLeft: esp(16) }} /> : null}
            <Pressable
              onPress={() => abrir(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n.lida ? '' : 'Não lida. '}${n.titulo}. ${n.mensagem}`}
              style={({ pressed }) => [s.item, pressed && { opacity: 0.85 }]}
            >
              <View style={[s.icone, { backgroundColor: v.fundo }]}>
                <v.Icone size={19} color={v.cor} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[tx.corpoForte, !n.lida && { color: cores.tinta }]}>{n.titulo}</Text>
                <Text style={tx.corpo}>{n.mensagem}</Text>
                <Text style={tx.legenda} numberOfLines={1}>
                  {n.protocolo}
                </Text>
                <Text style={tx.legenda}>{dataHora(n.data)}</Text>
              </View>
              {!n.lida ? <View style={s.ponto} /> : null}
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        carregando ? null : (
          <Vazio
            icone={BellOff}
            titulo="Nenhum aviso por enquanto"
            texto="Quando a prefeitura mudar o status de algo que você relatou ou apoiou, o aviso aparece aqui."
          />
        )
      }
    />
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), paddingBottom: esp(12), maxWidth: 680, width: '100%', alignSelf: 'center' },
  cabecalho: { gap: esp(2) },
  bloco: { backgroundColor: cores.superficie, borderRadius: raio.g, padding: esp(5) },
  item: { flexDirection: 'row', gap: esp(3), padding: esp(4), alignItems: 'flex-start' },
  icone: { width: 40, height: 40, borderRadius: raio.p, alignItems: 'center', justifyContent: 'center' },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.placa, marginTop: 6 },
});
