import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react-native';
import { useTexto } from '../hooks/useTexto';
import { cores, esp, fontes, raio, statusInfo } from '../theme/tema';
import type { Status } from '../types';

/** Componentes basicos de todas as telas. */

// ---------------------------------------------------------------------
/**
 * Placa de rua: retangulo azul com filete branco por dentro, como as
 * placas com nome de rua de Sao Paulo. E o elemento-assinatura do Zelo
 * (logo, protocolo, bairro). Usada com parcimonia, um por tela.
 */
export function Placa({
  texto,
  tamanho = 'm',
  estilo,
  rotuloAcessivel,
}: {
  texto: string;
  tamanho?: 'p' | 'm' | 'g';
  estilo?: StyleProp<ViewStyle>;
  rotuloAcessivel?: string;
}) {
  const tx = useTexto();
  const medidas = {
    p: { fonte: 14, px: 8, py: 3, filete: 2 },
    m: { fonte: 19, px: 12, py: 5, filete: 3 },
    g: { fonte: 34, px: 18, py: 7, filete: 4 },
  }[tamanho];
  return (
    <View
      style={[{ backgroundColor: cores.placa, borderRadius: raio.placa, padding: medidas.filete, alignSelf: 'flex-start' }, estilo]}
      accessibilityLabel={rotuloAcessivel ?? texto}
    >
      <View style={{ borderWidth: 1.5, borderColor: cores.branco, borderRadius: raio.placa - 2, paddingHorizontal: medidas.px, paddingVertical: medidas.py }}>
        <Text
          style={{
            fontFamily: fontes.condensadaNegrito,
            color: cores.branco,
            fontSize: Math.round(medidas.fonte * tx.escala),
            lineHeight: Math.round(medidas.fonte * tx.escala * 1.1),
            letterSpacing: 0.4,
          }}
          selectable
        >
          {texto}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
interface BotaoProps {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'sinal' | 'secundario' | 'perigo' | 'fantasma';
  icone?: LucideIcon;
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  dica?: string;
  compacto?: boolean;
}

export function Botao({ titulo, onPress, variante = 'primario', icone: Icone, carregando, desabilitado, estilo, dica, compacto }: BotaoProps) {
  const tx = useTexto();
  const p = {
    primario: { fundo: cores.placa, texto: cores.branco, borda: cores.placa },
    sinal: { fundo: cores.sinal, texto: cores.tinta, borda: cores.sinal },
    secundario: { fundo: cores.superficie, texto: cores.placa, borda: cores.linha },
    perigo: { fundo: cores.perigoClaro, texto: cores.perigo, borda: cores.perigoClaro },
    fantasma: { fundo: 'transparent', texto: cores.placa, borda: 'transparent' },
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
        compacto && { minHeight: 44, paddingHorizontal: esp(4) },
        { backgroundColor: p.fundo, borderColor: p.borda, opacity: inativo ? 0.5 : 1 },
        pressed && !inativo && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={p.texto} />
      ) : (
        <>
          {Icone ? <Icone size={19 * tx.escala} color={p.texto} strokeWidth={2.2} /> : null}
          <Text style={[tx.botao, { color: p.texto }, compacto && { fontSize: Math.round(15 * tx.escala) }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Botao redondo so com icone (sininho, voltar, compartilhar). */
export function BotaoIcone({
  icone: Icone,
  rotulo,
  onPress,
  contador,
  claro,
}: {
  icone: LucideIcon;
  rotulo: string;
  onPress: () => void;
  contador?: number;
  claro?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={contador ? `${rotulo}, ${contador} não lidas` : rotulo}
      hitSlop={6}
      style={({ pressed }) => [s.botaoIcone, claro && { backgroundColor: 'rgba(255,255,255,0.94)' }, pressed && { opacity: 0.8 }]}
    >
      <Icone size={21} color={cores.tinta} strokeWidth={2} />
      {contador ? (
        <View style={s.contador}>
          <Text style={s.contadorTexto}>{contador > 9 ? '9+' : contador}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
interface CampoProps extends TextInputProps {
  rotulo: string;
  erro?: string | null;
  ajuda?: string;
}

export function Campo({ rotulo, erro, ajuda, style, ...resto }: CampoProps) {
  const tx = useTexto();
  const [foco, setFoco] = React.useState(false);
  return (
    <View style={{ gap: esp(1.5) }}>
      <Text style={tx.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.apagado}
        onFocus={(e) => {
          setFoco(true);
          resto.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          resto.onBlur?.(e);
        }}
        style={[
          s.campo,
          { fontSize: Math.round(16 * tx.escala), fontFamily: fontes.regular },
          foco && { borderColor: cores.placa },
          erro ? { borderColor: cores.perigo } : null,
          style as StyleProp<TextStyle>,
        ]}
        {...resto}
      />
      {erro ? <Text style={[tx.legenda, { color: cores.perigo }]}>{erro}</Text> : ajuda ? <Text style={tx.legenda}>{ajuda}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------
/** Interruptor na paleta do app (bolinha branca, trilho azul), inclusive na web. */
export function Interruptor({ valor, aoMudar, rotulo }: { valor: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  // activeThumbColor so existe no react-native-web; no celular e ignorado.
  const somenteWeb = { activeThumbColor: cores.branco, activeTrackColor: cores.placa } as object;
  return (
    <Switch
      value={valor}
      onValueChange={aoMudar}
      accessibilityLabel={rotulo}
      trackColor={{ true: cores.placa, false: cores.linha }}
      thumbColor={cores.branco}
      {...somenteWeb}
    />
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
      aria-pressed={ativo}
      style={({ pressed }) => [s.chip, ativo && s.chipAtivo, pressed && { opacity: 0.85 }]}
    >
      {Icone ? <Icone size={15} color={ativo ? cores.branco : cores.tintaSuave} strokeWidth={2.2} /> : null}
      <Text style={[tx.rotulo, { color: ativo ? cores.branco : cores.tinta }]}>{texto}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
export function StatusBadge({ status, atrasada }: { status: Status; atrasada?: boolean }) {
  const tx = useTexto();
  const info = statusInfo[status];
  return (
    <View style={{ flexDirection: 'row', gap: esp(1.5), flexWrap: 'wrap' }}>
      <View style={[s.badge, { backgroundColor: info.fundo }]} accessibilityLabel={`Status: ${info.rotulo}`}>
        <View style={[s.ponto, { backgroundColor: info.cor }]} />
        <Text style={[tx.legenda, { color: info.cor, fontFamily: fontes.semi }]}>{info.rotulo}</Text>
      </View>
      {atrasada ? (
        <View style={[s.badge, { backgroundColor: cores.perigoClaro }]} accessibilityLabel="Prazo vencido">
          <Text style={[tx.legenda, { color: cores.perigo, fontFamily: fontes.semi }]}>Prazo vencido</Text>
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
    sucesso: { fundo: cores.okClaro, cor: cores.ok, Icone: CircleCheck },
    erro: { fundo: cores.perigoClaro, cor: cores.perigo, Icone: CircleAlert },
    info: { fundo: cores.placaClara, cor: cores.placaEscura, Icone: Info },
  }[tipo];
  return (
    <View style={[s.faixa, { backgroundColor: p.fundo }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <p.Icone size={20} color={p.cor} />
      <View style={{ flex: 1, gap: esp(3) }}>
        <Text style={[tx.corpo, { color: p.cor, fontFamily: fontes.semi }]}>{texto}</Text>
        {acao}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
export function Carregando({ texto = 'Carregando' }: { texto?: string }) {
  const tx = useTexto();
  return (
    <View style={s.centro} accessibilityLabel={texto}>
      <ActivityIndicator size="large" color={cores.placa} />
      <Text style={tx.legenda}>{texto}</Text>
    </View>
  );
}

/** Blocos cinza no formato do conteudo enquanto a lista carrega. */
export function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <View style={{ gap: esp(5), paddingVertical: esp(2) }} accessibilityLabel="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: esp(3) }}>
          <View style={[s.osso, { width: 44, height: 44, borderRadius: raio.p }]} />
          <View style={{ flex: 1, gap: esp(2) }}>
            <View style={[s.osso, { width: '45%', height: 10 }]} />
            <View style={[s.osso, { width: '85%', height: 14 }]} />
            <View style={[s.osso, { width: '30%', height: 10 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Vazio({ icone: Icone, titulo, texto, acao }: { icone: LucideIcon; titulo: string; texto: string; acao?: React.ReactNode }) {
  const tx = useTexto();
  return (
    <View style={[s.centro, { paddingVertical: esp(10) }]}>
      <View style={s.vazioIcone}>
        <Icone size={26} color={cores.placa} />
      </View>
      <Text style={[tx.subtitulo, { textAlign: 'center' }]}>{titulo}</Text>
      <Text style={[tx.corpo, { textAlign: 'center', maxWidth: 300 }]}>{texto}</Text>
      {acao}
    </View>
  );
}

/** Bloco branco de conteudo. Raio maior que o de chips e placas, de proposito. */
export function Bloco({ children, estilo }: { children: React.ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[s.bloco, estilo]}>{children}</View>;
}

export function Divisor({ estilo }: { estilo?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: cores.linhaSuave }, estilo]} />;
}

const s = StyleSheet.create({
  botao: {
    minHeight: 52,
    borderRadius: raio.m,
    borderWidth: 1.5,
    paddingHorizontal: esp(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: esp(2),
  },
  botaoIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.linhaSuave,
  },
  contador: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: cores.perigo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: cores.superficie,
  },
  contadorTexto: { color: cores.branco, fontFamily: fontes.negrito, fontSize: 10.5 },
  campo: {
    minHeight: 52,
    borderRadius: raio.p,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
    paddingHorizontal: esp(4),
    paddingVertical: esp(3),
    color: cores.tinta,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(1.5),
    paddingHorizontal: esp(3.5),
    minHeight: 44,
    borderRadius: raio.total,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  chipAtivo: { backgroundColor: cores.placa, borderColor: cores.placa },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: esp(1.5),
    paddingHorizontal: esp(2.5),
    paddingVertical: 3,
    borderRadius: raio.placa,
  },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  faixa: { flexDirection: 'row', gap: esp(3), padding: esp(4), borderRadius: raio.m, alignItems: 'flex-start' },
  centro: { alignItems: 'center', justifyContent: 'center', gap: esp(3), padding: esp(6), flex: 1 },
  vazioIcone: {
    width: 60,
    height: 60,
    borderRadius: raio.m,
    backgroundColor: cores.placaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloco: { backgroundColor: cores.superficie, borderRadius: raio.g, padding: esp(5) },
  osso: { backgroundColor: cores.linhaSuave, borderRadius: 4 },
});
