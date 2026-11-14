import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Building2, Globe2, LogOut, Type } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTexto } from '../hooks/useTexto';
import { Botao, Cartao } from '../components/ui';
import { cores, esp, gradientes, raio } from '../theme/tema';

/** Nivel de participacao pelos pontos (registrar 10, apoiar 2, resolvida 5). */
function nivel(pontos: number): { nome: string; proximo: number | null } {
  if (pontos >= 150) return { nome: 'Guardião do bairro', proximo: null };
  if (pontos >= 60) return { nome: 'Vizinho engajado', proximo: 150 };
  if (pontos >= 20) return { nome: 'Vizinho atento', proximo: 60 };
  return { nome: 'Recém-chegado', proximo: 20 };
}

export default function PerfilScreen() {
  const { usuario, sair, definirFonteGrande } = useAuth();
  const tx = useTexto();
  if (!usuario) return null;

  const gestor = usuario.papel === 'GESTOR';
  const n = nivel(usuario.pontos);
  const iniciais = usuario.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <LinearGradient colors={gradientes.escuro} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.topo}>
          <View style={s.avatar}>
            {gestor ? <Building2 size={28} color={cores.primaria} /> : <Text style={s.iniciais}>{iniciais}</Text>}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[tx.titulo, { color: cores.branco }]}>{usuario.nome}</Text>
            <Text style={[tx.corpo, { color: '#CFE7DF' }]}>
              {gestor ? 'Gestor da prefeitura' : `Mora em ${usuario.bairro ?? 'São Paulo'}`}
            </Text>
          </View>
        </LinearGradient>

        {!gestor ? (
          <Cartao estilo={{ gap: esp(3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
              <Award size={22} color={cores.destaqueEscuro} />
              <Text style={[tx.subtitulo, { flex: 1 }]}>{n.nome}</Text>
              <Text style={[tx.subtitulo, { color: cores.destaqueEscuro }]}>{usuario.pontos} pts</Text>
            </View>
            {n.proximo ? (
              <>
                <View style={s.trilho}>
                  <View style={[s.barra, { width: `${Math.min(100, (usuario.pontos / n.proximo) * 100)}%` }]} />
                </View>
                <Text style={tx.legenda}>Faltam {n.proximo - usuario.pontos} pontos para o próximo nível.</Text>
              </>
            ) : null}
            <View style={s.numeros}>
              <Numero valor={usuario.registradas} rotulo="relatadas" />
              <Numero valor={usuario.apoios} rotulo="apoios" />
              <Numero valor={usuario.resolvidas} rotulo="resolvidas" />
            </View>
            <Text style={tx.legenda}>Relatar vale 10 pontos, apoiar vale 2 e cada problema seu resolvido vale mais 5.</Text>
          </Cartao>
        ) : null}

        <Cartao estilo={{ gap: esp(3) }}>
          <Text style={tx.subtitulo}>Acessibilidade</Text>
          <View style={s.opcao}>
            <Type size={22} color={cores.primaria} />
            <View style={{ flex: 1 }}>
              <Text style={tx.corpoForte}>Letras maiores</Text>
              <Text style={tx.legenda}>Aumenta os textos e os botões do app. Fica salvo na sua conta.</Text>
            </View>
            <Switch
              value={usuario.fonteGrande}
              onValueChange={definirFonteGrande}
              accessibilityLabel="Letras maiores"
              trackColor={{ true: cores.primariaMedia, false: cores.linha }}
              thumbColor={cores.branco}
            />
          </View>
        </Cartao>

        <Cartao estilo={{ gap: esp(2) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp(2) }}>
            <Globe2 size={20} color={cores.primaria} />
            <Text style={tx.subtitulo}>ODS 11 da ONU</Text>
          </View>
          <Text style={tx.corpo}>
            O Zelo contribui com o Objetivo 11, Cidades e Comunidades Sustentáveis: espaços públicos mais seguros,
            inclusivos e acessíveis, com a população participando da gestão do próprio bairro.
          </Text>
        </Cartao>

        <Botao titulo="Sair da conta" icone={LogOut} variante="perigo" onPress={sair} />
        <Text style={[tx.legenda, { textAlign: 'center' }]}>Zelo 1.0 · Global Solution FIAP 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  const tx = useTexto();
  return (
    <View style={s.numero}>
      <Text style={tx.titulo}>{valor}</Text>
      <Text style={tx.legenda}>{rotulo}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(4), paddingBottom: esp(12), maxWidth: 640, width: '100%', alignSelf: 'center' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: esp(4), padding: esp(5), borderRadius: raio.g + 4 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciais: { fontSize: 22, fontWeight: '800', color: '#3A2500' },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.fundo, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4, backgroundColor: cores.destaque },
  numeros: { flexDirection: 'row', gap: esp(3) },
  numero: { flex: 1, backgroundColor: cores.fundo, borderRadius: raio.m, padding: esp(3), alignItems: 'center' },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: esp(3) },
});
