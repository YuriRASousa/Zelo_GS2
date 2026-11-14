import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react-native';
import { useTexto } from '../hooks/useTexto';
import { cores, esp, raio, statusInfo } from '../theme/tema';
import type { Status } from '../types';

/** Componentes basicos reutilizados em todas as telas. */

// ---------------------------------------------------------------------
interface BotaoProps {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'destaque' | 'perigo' | 'fantasma';
  icone?: LucideIcon;
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  dica?: string;
}

export function Botao({ titulo, onPress, variante = 'primario', icone: Icone, carregando, desabilitado, estilo, dica }: BotaoProps) {
  const tx = useTexto();
  const paleta = {
    primario: { fundo: cores.primaria, texto: cores.branco, borda: cores.primaria },
    secundario: { fundo: cores.branco, texto: cores.primaria, borda: cores.linha },
    destaque: { fundo: cores.destaque, texto: '#3A2500', borda: cores.destaque },
    perigo: { fundo: cores.perigoClaro, texto: cores.perigo, borda: cores.perigoClaro },
    fantasma: { fundo: 'transparent', texto: cores.primaria, borda: 'transparent' },
  }[variante];
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      style={({ pressed }) => [
        s.botao,
        { backgroundColor: paleta.fundo, borderColor: paleta.borda, opacity: inativo ? 0.55 : pressed ? 0.85 : 1 },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={paleta.texto} />
      ) : (
        <>
          {Icone ? <Icone size={19 * tx.escala} color={paleta.texto} strokeWidth={2.2} /> : null}
          <Text style={[tx.botao, { color: paleta.texto }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
interface CampoProps extends TextInputProps {
  rotulo: string;
  erro?: string | null;
}

export function Campo({ rotulo, erro, style, ...resto }: CampoProps) {
  const tx = useTexto();
  return (
    <View style={{ gap: esp(1.5) }}>
      <Text style={tx.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.apagado}
        style={[s.campo, { fontSize: 16 * tx.escala }, erro ? { borderColor: cores.perigo } : null, style]}
        {...resto}
      />
      {erro ? <Text style={[tx.legenda, { color: cores.perigo }]}>{erro}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------
export function Chip({ texto, ativo, onPress, icone: Icone }: { texto: string; ativo: boolean; onPress: () => void; icone?: LucideIcon }) {
  const tx = useTexto();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      style={[s.chip, ativo ? { backgroundColor: cores.primaria, borderColor: cores.primaria } : null]}
    >
      {Icone ? <Icone size={15} color={ativo ? cores.branco : cores.tintaSuave} /> : null}
      <Text style={[tx.legenda, { color: ativo ? cores.branco : cores.tintaSuave, fontWeight: '700' }]}>{texto}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
export function StatusBadge({ status, atrasada }: { status: Status; atrasada?: boolean }) {
  const tx = useTexto();
  const info = statusInfo[status];
  return (
    <View style={{ flexDirection: 'row', gap: esp(1.5), flexWrap: 'wrap' }}>
      <View style={[s.badge, { backgroundColor: info.fundo }]} accessibilityLabel={`Status ${info.rotulo}`}>
        <View style={[s.ponto, { backgroundColor: info.cor }]} />
        <Text style={[tx.legenda, { color: info.cor, fontWeight: '700' }]}>{info.rotulo}</Text>
      </View>
      {atrasada ? (
        <View style={[s.badge, { backgroundColor: cores.perigoClaro }]}>
          <Text style={[tx.legenda, { color: cores.perigo, fontWeight: '700' }]}>Prazo vencido</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------
/**
 * Mensagem na propria tela (sucesso, erro ou aviso). Substitui o
 * Alert.alert, que nao aparece na versao web do React Native.
 */
export function Faixa({ tipo, texto, acao }: { tipo: 'sucesso' | 'erro' | 'info'; texto: string; acao?: React.ReactNode }) {
  const tx = useTexto();
  const p = {
    sucesso: { fundo: '#DDF4EA', cor: '#05603A', Icone: CircleCheck },
    erro: { fundo: cores.perigoClaro, cor: cores.perigo, Icone: CircleAlert },
    info: { fundo: cores.infoClaro, cor: cores.info, Icone: Info },
  }[tipo];
  return (
    <View style={[s.faixa, { backgroundColor: p.fundo }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <p.Icone size={20} color={p.cor} />
      <View style={{ flex: 1, gap: esp(2) }}>
        <Text style={[tx.corpo, { color: p.cor, fontWeight: '600' }]}>{texto}</Text>
        {acao}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  const tx = useTexto();
  return (
    <View style={s.centro}>
      <ActivityIndicator size="large" color={cores.primaria} />
      <Text style={tx.legenda}>{texto}</Text>
    </View>
  );
}

export function Vazio({ icone: Icone, titulo, texto }: { icone: LucideIcon; titulo: string; texto: string }) {
  const tx = useTexto();
  return (
    <View style={[s.centro, { paddingVertical: esp(12) }]}>
      <View style={s.vazioIcone}>
        <Icone size={28} color={cores.primaria} />
      </View>
      <Text style={[tx.subtitulo, { textAlign: 'center' }]}>{titulo}</Text>
      <Text style={[tx.corpo, { textAlign: 'center', maxWidth: 300 }]}>{texto}</Text>
    </View>
  );
}

export function Cartao({ children, estilo }: { children: React.ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[s.cartao, estilo]}>{children}</View>;
}

const s = StyleSheet.create({
  botao: {
    minHeight: 50,
    borderRadius: raio.m,
    borderWidth: 1.5,
    paddingHorizontal: esp(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: esp(2),
  },
  campo: {
    minHeight: 50,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.branco,
    paddingHorizontal: esp(4),
    paddingVertical: esp(3),
    color: cores.tinta,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(1.5),
    paddingHorizontal: esp(3.5),
    minHeight: 36,
    borderRadius: raio.total,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.branco,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(1.5),
    paddingHorizontal: esp(2.5),
    paddingVertical: esp(1),
    borderRadius: raio.total,
  },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  faixa: { flexDirection: 'row', gap: esp(3), padding: esp(4), borderRadius: raio.m, alignItems: 'flex-start' },
  centro: { alignItems: 'center', justifyContent: 'center', gap: esp(3), padding: esp(6), flex: 1 },
  vazioIcone: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartao: {
    backgroundColor: cores.branco,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: esp(4),
  },
});
