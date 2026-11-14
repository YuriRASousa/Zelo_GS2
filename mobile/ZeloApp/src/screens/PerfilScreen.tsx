import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Award, Bell, ChevronRight, Globe2, History, LogOut, PenLine, Type } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTexto } from '../hooks/useTexto';
import { Bloco, Botao, Divisor, Interruptor, Placa } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';
import type { RaizParams } from '../navigation/tipos';

/** Nivel de participacao pelos pontos (relatar 10, apoiar 2, resolvida 5). */
function nivel(pontos: number): { nome: string; proximo: number | null } {
  if (pontos >= 150) return { nome: 'Guardião do bairro', proximo: null };
  if (pontos >= 60) return { nome: 'Vizinho engajado', proximo: 150 };
  if (pontos >= 20) return { nome: 'Vizinho atento', proximo: 60 };
  return { nome: 'Recém-chegado', proximo: 20 };
}

export default function PerfilScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<RaizParams>>();
  const { usuario, sair, definirFonteGrande, naoLidas } = useAuth();
  const tx = useTexto();
  if (!usuario) return null;

  const gestor = usuario.papel === 'GESTOR';
  const n = nivel(usuario.pontos);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={{ gap: esp(3), paddingTop: esp(2) }}>
          <Placa texto={gestor ? 'Subprefeitura' : usuario.bairro ?? 'São Paulo'} tamanho="p" />
          <Text style={tx.titulo}>{usuario.nome}</Text>
          <Text style={tx.corpo}>{usuario.email}</Text>
        </View>

        {!gestor ? (
          <Bloco estilo={{ gap: esp(4) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
              <Award size={22} color={cores.sinalEscuro} />
              <Text style={[tx.subtitulo, { flex: 1 }]}>{n.nome}</Text>
              <Text style={[tx.tituloMenor, { color: cores.sinalEscuro }]}>{usuario.pontos} pts</Text>
            </View>
            {n.proximo ? (
              <View style={{ gap: esp(2) }}>
                <View style={s.trilho}>
                  <View style={[s.barra, { width: `${Math.min(100, (usuario.pontos / n.proximo) * 100)}%` }]} />
                </View>
                <Text style={tx.legenda}>Faltam {n.proximo - usuario.pontos} pontos para o próximo nível.</Text>
              </View>
            ) : (
              <Text style={tx.legenda}>Você chegou ao nível mais alto. Obrigado por cuidar do bairro.</Text>
            )}
            <View style={s.numeros}>
              <Numero valor={usuario.registradas} rotulo="relatadas" />
              <View style={s.sep} />
              <Numero valor={usuario.apoios} rotulo="apoios" />
              <View style={s.sep} />
              <Numero valor={usuario.resolvidas} rotulo="resolvidas" />
            </View>
            <Text style={tx.legenda}>Relatar vale 10 pontos, apoiar vale 2 e cada problema seu resolvido vale mais 5.</Text>
          </Bloco>
        ) : null}

        <Bloco estilo={{ padding: 0 }}>
          <Item icone={PenLine} titulo="Editar nome, bairro e senha" onPress={() => navegacao.navigate('EditarPerfil')} />
          {!gestor ? (
            <>
              <Divisor estilo={{ marginLeft: 56 }} />
              <Item
                icone={Bell}
                titulo="Notificações"
                detalhe={naoLidas ? `${naoLidas} ${naoLidas === 1 ? 'nova' : 'novas'}` : undefined}
                onPress={() => navegacao.navigate('Notificacoes')}
              />
            </>
          ) : null}
          {gestor ? (
            <>
              <Divisor estilo={{ marginLeft: 56 }} />
              <Item icone={History} titulo="Execuções das rotinas" onPress={() => navegacao.navigate('Logs')} />
            </>
          ) : null}
          <Divisor estilo={{ marginLeft: 56 }} />
          <View style={s.item}>
            <Type size={21} color={cores.placa} />
            <View style={{ flex: 1 }}>
              <Text style={tx.corpoForte}>Letras maiores</Text>
              <Text style={tx.legenda}>Aumenta textos e botões. Fica salvo na sua conta.</Text>
            </View>
            <Interruptor valor={usuario.fonteGrande} aoMudar={definirFonteGrande} rotulo="Letras maiores" />
          </View>
        </Bloco>

        <Bloco estilo={{ gap: esp(2) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
            <Globe2 size={20} color={cores.placa} />
            <Text style={tx.subtitulo}>Objetivos da ONU</Text>
          </View>
          <Text style={tx.corpo}>
            O Zelo contribui com o ODS 11, cidades e comunidades sustentáveis: espaço público mais seguro, inclusivo e
            acessível, com a população participando da gestão do bairro. E com o ODS 10, porque o painel mostra se a
            periferia é atendida no mesmo ritmo que o centro.
          </Text>
        </Bloco>

        <Botao titulo="Sair da conta" icone={LogOut} variante="perigo" onPress={sair} />
        <Text style={[tx.legenda, { textAlign: 'center' }]}>Zelo 1.1, Global Solution FIAP 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ icone: Icone, titulo, detalhe, onPress }: { icone: typeof Bell; titulo: string; detalhe?: string; onPress: () => void }) {
  const tx = useTexto();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.item, pressed && { backgroundColor: cores.fundo }]}>
      <Icone size={21} color={cores.placa} />
      <Text style={[tx.corpoForte, { flex: 1 }]}>{titulo}</Text>
      {detalhe ? <Text style={[tx.rotulo, { color: cores.perigo }]}>{detalhe}</Text> : null}
      <ChevronRight size={19} color={cores.apagado} />
    </Pressable>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  const tx = useTexto();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[tx.numero, { fontSize: Math.round(30 * tx.escala) }]}>{valor}</Text>
      <Text style={tx.legenda}>{rotulo}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(5), paddingBottom: esp(20), maxWidth: 640, width: '100%', alignSelf: 'center' },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.fundo, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4, backgroundColor: cores.sinal },
  numeros: { flexDirection: 'row', backgroundColor: cores.fundo, borderRadius: raio.m, paddingVertical: esp(3) },
  sep: { width: 1, backgroundColor: cores.linha },
  item: { flexDirection: 'row', alignItems: 'center', gap: esp(4), minHeight: 62, paddingHorizontal: esp(5), paddingVertical: esp(3) },
});
