import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, LogIn, MapPin, UserPlus, UserRound } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { Botao, Campo, Chip, Faixa } from '../components/ui';
import { cores, esp, gradientes, raio, sombra } from '../theme/tema';

/** Entrada e cadastro na mesma tela, com atalhos para as contas de demonstracao. */
export default function EntrarScreen() {
  const { entrar, cadastrar } = useAuth();
  const { bairros } = useCatalogo();
  const tx = useTexto();

  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [bairroId, setBairroId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
    if (!email.includes('@')) return setErro('Informe um e-mail válido.');
    if (senha.length < 6) return setErro('A senha tem pelo menos 6 caracteres.');
    if (modo === 'cadastro') {
      if (nome.trim().length < 3) return setErro('Informe o seu nome.');
      if (!bairroId) return setErro('Escolha o seu bairro para ver o que acontece perto de você.');
    }
    setEnviando(true);
    try {
      if (modo === 'entrar') await entrar(email, senha);
      else await cadastrar(nome, email, senha, bairroId!);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  function demo(e: string, s: string) {
    setModo('entrar');
    setEmail(e);
    setSenha(s);
    setErro(null);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: cores.fundo }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: esp(8) }}>
      <LinearGradient colors={gradientes.escuro} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.topo}>
        <SafeAreaView edges={['top']} style={{ gap: esp(5) }}>
          <View style={s.marca}>
            <View style={s.logo}>
              <MapPin size={26} color={cores.primaria} strokeWidth={2.6} />
            </View>
            <Text style={s.nomeMarca}>zelo</Text>
          </View>
          <Text style={[tx.display, { color: cores.branco, maxWidth: 340 }]}>Sua rua merece cuidado.</Text>
          <Text style={[tx.corpo, { color: '#CFE7DF', maxWidth: 360 }]}>
            Relate buracos, postes apagados e calçadas sem acesso. A vizinhança confirma, a prefeitura prioriza e
            você acompanha cada passo.
          </Text>
        </SafeAreaView>
      </LinearGradient>

        <View style={s.conteudo}>
          <View style={[s.cartao, sombra(2)]}>
            <View style={s.abas} accessibilityRole="tablist">
              {(['entrar', 'cadastro'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setModo(m);
                    setErro(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modo === m }}
                  style={[s.aba, modo === m && s.abaAtiva]}
                >
                  <Text style={[tx.corpoForte, { color: modo === m ? cores.primaria : cores.apagado }]}>
                    {m === 'entrar' ? 'Entrar' : 'Criar conta'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {modo === 'cadastro' ? (
              <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Como quer ser chamado" autoComplete="name" />
            ) : null}
            <Campo
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              placeholder="Mínimo de 6 caracteres"
              secureTextEntry
              onSubmitEditing={enviar}
            />
            {modo === 'cadastro' ? (
              <View style={{ gap: esp(2) }}>
                <Text style={tx.rotulo}>Seu bairro</Text>
                <View style={s.chips}>
                  {bairros.map((b) => (
                    <Chip key={b.id} texto={b.nome} ativo={bairroId === b.id} onPress={() => setBairroId(b.id)} />
                  ))}
                </View>
              </View>
            ) : null}

            {erro ? <Faixa tipo="erro" texto={erro} /> : null}

            <Botao
              titulo={modo === 'entrar' ? 'Entrar' : 'Criar minha conta'}
              icone={modo === 'entrar' ? LogIn : UserPlus}
              onPress={enviar}
              carregando={enviando}
            />
          </View>

          <View style={{ gap: esp(2) }}>
            <Text style={[tx.legenda, { textAlign: 'center' }]}>Contas de demonstração</Text>
            <View style={[s.chips, { justifyContent: 'center' }]}>
              <Chip texto="Cidadã (Ana)" icone={UserRound} ativo={false} onPress={() => demo('ana@zelo.app', '123456')} />
              <Chip texto="Idoso (Joaquim)" icone={UserRound} ativo={false} onPress={() => demo('joaquim@zelo.app', '123456')} />
              <Chip texto="Gestor da prefeitura" icone={Building2} ativo={false} onPress={() => demo('gestor@zelo.app', 'gestor123')} />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  topo: { paddingHorizontal: esp(6), paddingBottom: esp(16), paddingTop: esp(6) },
  marca: { flexDirection: 'row', alignItems: 'center', gap: esp(2.5) },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nomeMarca: { color: cores.branco, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  conteudo: { padding: esp(5), gap: esp(5), marginTop: -esp(12), maxWidth: 520, width: '100%', alignSelf: 'center' },
  cartao: { backgroundColor: cores.branco, borderRadius: raio.g + 4, padding: esp(5), gap: esp(4) },
  abas: { flexDirection: 'row', backgroundColor: cores.fundo, borderRadius: raio.m, padding: 4 },
  aba: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: raio.p },
  abaAtiva: { backgroundColor: cores.branco, ...sombra(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) },
});
