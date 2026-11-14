import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Accessibility, ShieldAlert, ThumbsUp } from 'lucide-react-native';
import IconeCategoria from './Icone';
import { StatusBadge } from './ui';
import { useTexto } from '../hooks/useTexto';
import { corPrioridade, cores, esp, raio } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import { dataCurta } from '../utils/formato';

interface Props {
  item: OcorrenciaResumo;
  onAbrir: (id: number) => void;
  mostrarPrioridade?: boolean;
}

/**
 * Card da lista. Envolvido em React.memo: quando a lista recarrega, so os
 * cards cujo item mudou sao redesenhados. O onAbrir recebe o id (e nao uma
 * funcao nova por item), o que mantem a comparacao do memo estavel.
 */
function OcorrenciaCard({ item, onAbrir, mostrarPrioridade }: Props) {
  const tx = useTexto();
  return (
    <Pressable
      onPress={() => onAbrir(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.categoria}: ${item.titulo}. ${item.bairro}. ${item.apoios} apoio${item.apoios === 1 ? '' : 's'}.`}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
    >
      <View style={s.icone}>
        <IconeCategoria nome={item.icone} tamanho={22} />
      </View>
      <View style={{ flex: 1, gap: esp(1.5) }}>
        <Text style={tx.legenda} numberOfLines={1}>
          {item.categoria} · {item.bairro}
        </Text>
        <Text style={tx.subtitulo} numberOfLines={2}>
          {item.titulo}
        </Text>
        <StatusBadge status={item.status} atrasada={item.atrasada} />
        <View style={s.rodape}>
          <View style={s.meta}>
            <ThumbsUp size={14} color={cores.tintaSuave} />
            <Text style={tx.legenda}>{item.apoios} apoio{item.apoios === 1 ? '' : 's'}</Text>
          </View>
          {item.risco ? (
            <View style={s.meta}>
              <ShieldAlert size={14} color={cores.perigo} />
              <Text style={[tx.legenda, { color: cores.perigo }]}>Risco</Text>
            </View>
          ) : null}
          {item.acessibilidade ? (
            <View style={s.meta}>
              <Accessibility size={14} color={cores.info} />
              <Text style={[tx.legenda, { color: cores.info }]}>Acessibilidade</Text>
            </View>
          ) : null}
          <Text style={[tx.legenda, { marginLeft: 'auto' }]}>{dataCurta(item.abertura)}</Text>
        </View>
        {mostrarPrioridade ? (
          <View style={s.prioridade} accessibilityLabel={`Prioridade ${item.prioridade} de 100`}>
            <View style={s.trilho}>
              <View style={[s.barra, { width: `${item.prioridade}%`, backgroundColor: corPrioridade(item.prioridade) }]} />
            </View>
            <Text style={[tx.legenda, { color: corPrioridade(item.prioridade), fontWeight: '800' }]}>{item.prioridade}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default memo(OcorrenciaCard);

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: esp(3),
    backgroundColor: cores.branco,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: esp(4),
  },
  icone: {
    width: 44,
    height: 44,
    borderRadius: raio.m,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: esp(3), flexWrap: 'wrap', marginTop: esp(1) },
  meta: { flexDirection: 'row', alignItems: 'center', gap: esp(1) },
  prioridade: { flexDirection: 'row', alignItems: 'center', gap: esp(2), marginTop: esp(1) },
  trilho: { flex: 1, height: 6, borderRadius: 3, backgroundColor: cores.linha, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
});
