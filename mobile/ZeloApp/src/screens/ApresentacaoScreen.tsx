import React, { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, CircleCheck, Construction, MapPin, ThumbsUp } from 'lucide-react-native';
import { useTexto } from '../hooks/useTexto';
import { Botao, Placa } from '../components/ui';
import { cores, esp, fontes, raio, statusInfo } from '../theme/tema';
import type { RaizParams } from '../navigation/tipos';

export const CHAVE_APRESENTACAO = 'zelo.apresentacao.vista';

interface Passo {
  titulo: string;
  texto: string;
  Ilustracao: () => React.ReactElement;
}

/** Ilustracoes montadas com pedacos reais da interface do app. */
function IlustraRelatar() {
  return (
    <View style={il.palco}>
      <View>
      <View style={[il.cartao, { transform: [{ rotate: '-4deg' }] }]}>
        <View style={il.foto}>
          <Construction size={40} color={cores.placa} />
        </View>
        <Text style={il.titulo}>Buraco na faixa de ônibus</Text>
        <View style={il.linhaMeta}>
          <MapPin size={14} color={cores.tintaSuave} />
          <Text style={il.meta}>Av. Jacu-Pêssego, 1200</Text>
        </View>
      </View>
      <View style={[il.selo, { right: -22, top: -18, backgroundColor: cores.sinal }]}>
        <Camera size={22} color={cores.tinta} />
      </View>
      </View>
    </View>
  );
}

function IlustraApoiar() {
  return (
    <View style={il.palco}>
      <View style={il.cartao}>
        <Text style={il.titulo}>Três postes apagados</Text>
        <View style={{ flexDirection: 'row', marginTop: esp(3), marginBottom: esp(2) }}>
          {[
            ['AR', cores.placa, cores.branco],
            ['JF', cores.sinal, cores.tinta],
            ['MC', cores.ok, cores.branco],
            ['CM', cores.tintaSuave, cores.branco],
          ].map(([ini, fundo, cor], i) => (
            <View key={ini} style={[il.avatar, { marginLeft: i ? -6 : 0, backgroundColor: fundo, zIndex: 4 - i }]}>
              <Text style={[il.avatarTexto, { color: cor }]}>{ini}</Text>
            </View>
          ))}
        </View>
        <View style={il.linhaMeta}>
          <ThumbsUp size={14} color={cores.placa} />
          <Text style={[il.meta, { color: cores.placa }]}>4 vizinhos confirmaram</Text>
        </View>
        <View style={il.trilho}>
          <View style={[il.barra, { width: '78%' }]} />
        </View>
        <Text style={il.meta}>Prioridade 78 de 100</Text>
      </View>
    </View>
  );
}

function IlustraAcompanhar() {
  const passos = ['ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO', 'RESOLVIDA'] as const;
  return (
    <View style={il.palco}>
      <View style={il.cartao}>
        <Placa texto="ZL-2026-000042" tamanho="p" />
        <View style={{ gap: esp(2.5), marginTop: esp(4) }}>
          {passos.map((p, i) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2.5) }}>
              {i < 3 ? (
                <CircleCheck size={18} color={statusInfo[p].cor} />
              ) : (
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: cores.linha }} />
              )}
              <Text style={[il.meta, { color: i < 3 ? cores.tinta : cores.apagado, fontFamily: fontes.semi }]}>
                {statusInfo[p].rotulo}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const PASSOS: Passo[] = [
  {
    titulo: 'Viu um problema na rua? Relate em um minuto.',
    texto: 'Tire a foto, marque no mapa e diga se há risco ou se atrapalha quem tem deficiência. O pedido vai direto para o órgão responsável.',
    Ilustracao: IlustraRelatar,
  },
  {
    titulo: 'Um pedido com dez apoios vale mais que dez pedidos repetidos.',
    texto: 'Se alguém já relatou, você confirma que também viu. Cada apoio sobe a prioridade do problema na fila da prefeitura.',
    Ilustracao: IlustraApoiar,
  },
  {
    titulo: 'Acompanhe cada passo, com prazo e protocolo.',
    texto: 'Você recebe aviso quando o status muda e vê no painel do bairro quanto foi resolvido no prazo.',
    Ilustracao: IlustraAcompanhar,
  },
];

export default function ApresentacaoScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { width } = useWindowDimensions();
  const tx = useTexto();
  const lista = useRef<FlatList<Passo>>(null);
  const [indice, setIndice] = useState(0);
  const [alturaLista, setAlturaLista] = useState(0);
  const largura = Math.min(width, 560);

  async function concluir() {
    await AsyncStorage.setItem(CHAVE_APRESENTACAO, 'sim').catch(() => {});
    navegacao.replace('Entrar');
  }

  function avancar() {
    if (indice < PASSOS.length - 1) {
      lista.current?.scrollToIndex({ index: indice + 1, animated: true });
      setIndice(indice + 1);
    } else {
      concluir();
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={[s.topo, { width: largura }]}>
        <Placa texto="Zelo" tamanho="m" />
        <Pressable onPress={concluir} accessibilityRole="button" hitSlop={10}>
          <Text style={[tx.rotulo, { color: cores.placa }]}>Pular</Text>
        </Pressable>
      </View>

      <FlatList
        ref={lista}
        data={PASSOS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.titulo}
        style={{ flex: 1, alignSelf: 'center', width: largura }}
        onLayout={(e) => setAlturaLista(e.nativeEvent.layout.height)}
        getItemLayout={(_, i) => ({ length: largura, offset: largura * i, index: i })}
        onMomentumScrollEnd={(e) => setIndice(Math.round(e.nativeEvent.contentOffset.x / largura))}
        renderItem={({ item }) => (
          <View style={{ width: largura, height: alturaLista || undefined, paddingHorizontal: esp(6), gap: esp(8), justifyContent: 'center' }}>
            <item.Ilustracao />
            <View style={{ gap: esp(3) }}>
              <Text style={tx.display} accessibilityRole="header">
                {item.titulo}
              </Text>
              <Text style={tx.corpo}>{item.texto}</Text>
            </View>
          </View>
        )}
      />

      <View style={[s.rodape, { width: largura }]}>
        <View style={s.pontos} accessibilityLabel={`Passo ${indice + 1} de ${PASSOS.length}`}>
          {PASSOS.map((p, i) => (
            <View key={p.titulo} style={[s.ponto, i === indice && s.pontoAtivo]} />
          ))}
        </View>
        <Botao
          titulo={indice === PASSOS.length - 1 ? 'Começar' : 'Continuar'}
          onPress={avancar}
          variante="primario"
          estilo={{ minWidth: 150 }}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: esp(6), alignSelf: 'center' },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: esp(6),
    paddingVertical: esp(5),
    alignSelf: 'center',
  },
  pontos: { flexDirection: 'row', gap: esp(2) },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.linha },
  pontoAtivo: { width: 26, backgroundColor: cores.placa },
});

const il = StyleSheet.create({
  palco: { height: 250, alignItems: 'center', justifyContent: 'center' },
  cartao: {
    width: 250,
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    padding: esp(5),
    borderWidth: 1,
    borderColor: cores.linhaSuave,
  },
  foto: {
    height: 110,
    borderRadius: raio.m,
    backgroundColor: cores.placaClara,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: esp(3),
  },
  titulo: { fontFamily: fontes.semi, fontSize: 16, color: cores.tinta },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: esp(1.5), marginTop: esp(1.5) },
  meta: { fontFamily: fontes.media, fontSize: 13, color: cores.tintaSuave },
  selo: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: raio.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: cores.fundo,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.placa,
    borderWidth: 3,
    borderColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: cores.branco, fontFamily: fontes.negrito, fontSize: 11 },
  trilho: { height: 6, borderRadius: 3, backgroundColor: cores.linhaSuave, marginTop: esp(3), marginBottom: esp(1.5) },
  barra: { height: 6, borderRadius: 3, backgroundColor: cores.perigo },
});
