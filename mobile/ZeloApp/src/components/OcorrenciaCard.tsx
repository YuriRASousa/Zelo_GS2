import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Accessibility, ChevronRight, ShieldAlert, ThumbsUp } from 'lucide-react-native';
import IconeCategoria from './Icone';
import { StatusBadge } from './ui';
import { useTexto } from '../hooks/useTexto';
import { corPrioridade, cores, esp, fontes, raio } from '../theme/tema';
import type { OcorrenciaResumo } from '../types';
import { dataCurta } from '../utils/formato';

interface Props {
  item: OcorrenciaResumo;
  onAbrir: (id: number) => void;
  mostrarPrioridade?: boolean;
}

/**
 * Linha da lista de ocorrencias. React.memo: quando a lista recarrega, so
 * as linhas cujo item mudou sao redesenhadas. onAbrir recebe o id (nao uma
 * funcao nova por linha), o que mantem a comparacao do memo estavel.
 */
function OcorrenciaCard({ item, onAbrir, mostrarPrioridade }: Props) {
  const tx = useTexto();
  const apoios = `${item.apoios} apoio${item.apoios === 1 ? '' : 's'}`;
  return (
    <Pressable
      onPress={() => onAbrir(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.categoria}: ${item.titulo}. ${item.bairro}. ${apoios}.${mostrarPrioridade ? ` Prioridade ${item.prioridade}.` : ''}`}
      style={({ pressed }) => [s.linha, pressed && { backgroundColor: cores.fundo }]}
    >
      <View style={s.icone}>
        <IconeCategoria nome={item.icone} tamanho={22} cor={cores.placa} />
        {item.risco ? <View style={s.alerta} /> : null}
      </View>
      <View style={{ flex: 1, gap: esp(1.5) }}>
        <Text style={tx.legenda} numberOfLines={2}>
          {item.categoria} em {item.bairro}
        </Text>
        <Text style={[tx.corpoForte, { fontSize: Math.round(16.5 * tx.escala) }]} numberOfLines={2}>
          {item.titulo}
        </Text>
        <StatusBadge status={item.status} atrasada={item.atrasada} />
        <View style={s.meta}>
          <View style={s.metaItem}>
            <ThumbsUp size={14} color={cores.tintaSuave} />
            <Text style={tx.legenda}>{apoios}</Text>
          </View>
          {item.risco ? (
            <View style={s.metaItem}>
              <ShieldAlert size={14} color={cores.perigo} />
              <Text style={[tx.legenda, { color: cores.perigo }]}>Risco</Text>
            </View>
          ) : null}
          {item.acessibilidade ? (
            <View style={s.metaItem}>
              <Accessibility size={14} color={cores.placa} />
              <Text style={[tx.legenda, { color: cores.placa }]}>Acessibilidade</Text>
            </View>
          ) : null}
          <Text style={tx.legenda}>{dataCurta(item.abertura)}</Text>
        </View>
      </View>
      {mostrarPrioridade ? (
        <View style={s.prioridade} accessibilityElementsHidden>
          <Text style={[s.nota, { color: corPrioridade(item.prioridade) }]}>{item.prioridade}</Text>
          <Text style={tx.legenda}>prioridade</Text>
        </View>
      ) : (
        <ChevronRight size={20} color={cores.apagado} style={{ alignSelf: 'center' }} />
      )}
    </Pressable>
  );
}

export default memo(OcorrenciaCard);

const s = StyleSheet.create({
  linha: { flexDirection: 'row', gap: esp(3), paddingVertical: esp(4), paddingHorizontal: esp(5) },
  icone: {
    width: 46,
    height: 46,
    borderRadius: raio.p,
    backgroundColor: cores.placaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alerta: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: cores.perigo,
    borderWidth: 2,
    borderColor: cores.superficie,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: esp(3), flexWrap: 'wrap', marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: esp(1) },
  prioridade: { alignItems: 'center', justifyContent: 'center', minWidth: 62 },
  nota: { fontFamily: fontes.condensadaNegrito, fontSize: 28, lineHeight: 30 },
});
