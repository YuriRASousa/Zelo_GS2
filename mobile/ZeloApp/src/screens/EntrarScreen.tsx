import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, Eye, EyeOff, LogIn, UserPlus, UserRound } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { Bloco, Botao, Campo, Chip, Divisor, Faixa, Placa } from '../components/ui';
import { cores, esp, raio } from '../theme/tema';

type Erros = Partial<Record<'nome' | 'email' | 'senha' | 'bairro', string>>;

/** Entrada e cadastro na mesma tela, com atalhos para as contas de demonstracao. */
export default function EntrarScreen() {
  const { entrar, cadastrar } = useAuth();
  const { bairros } = useCatalogo();
  const tx = useTexto();

  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [bairroId, setBairroId] = useState<number | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function validar(): boolean {
    const e: Erros = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Informe um e-mail válido, como voce@email.com.';
    if (senha.length < 6) e.senha = 'A senha tem pelo menos 6 caracteres.';
    if (modo === 'cadastro') {
      if (nome.trim().length < 3) e.nome = 'Informe seu nome com pelo menos 3 letras.';
      if (!bairroId) e.bairro = 'Escolha o bairro onde você mora.';
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar() {
    setErro(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      if (modo === 'entrar') await entrar(email, senha);
      else await cadastrar(nome, email, senha, bairroId!);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  function trocarModo(m: 'entrar' | 'cadastro') {
    setModo(m);
    setErros({});
    setErro(null);
  }

  function demo(e: string, s: string) {
    trocarModo('entrar');
    setEmail(e);
    setSenha(s);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.conteudo}>
          <View style={{ gap: esp(4) }}>
            <Placa texto="Zelo" tamanho="g" rotuloAcessivel="Zelo" />
            <Text style={tx.display} accessibilityRole="header">
              Sua rua merece cuidado.
            </Text>
            <Text style={tx.corpo}>
              Relate buraco, poste apagado ou calçada sem rampa. A vizinhança confirma, a prefeitura prioriza e você
              acompanha cada passo.
            </Text>
          </View>

          <Bloco estilo={{ gap: esp(4) }}>
            <View style={s.abas} accessibilityRole="tablist">
              {(['entrar', 'cadastro'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => trocarModo(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modo === m }}
                  style={[s.aba, modo === m && s.abaAtiva]}
                >
                  <Text style={[tx.corpoForte, { color: modo === m ? cores.tinta : cores.apagado }]}>
                    {m === 'entrar' ? 'Entrar' : 'Criar conta'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {modo === 'cadastro' ? (
              <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Como quer ser chamado" autoComplete="name" erro={erros.nome} />
            ) : null}
            <Campo
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              erro={erros.email}
            />
            <View>
              <Campo
                rotulo="Senha"
                value={senha}
                onChangeText={setSenha}
                placeholder="Mínimo de 6 caracteres"
                secureTextEntry={!verSenha}
                onSubmitEditing={enviar}
                erro={erros.senha}
                style={{ paddingRight: 52 }}
              />
              <Pressable
                onPress={() => setVerSenha((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                style={s.olho}
                hitSlop={8}
              >
                {verSenha ? <EyeOff size={20} color={cores.tintaSuave} /> : <Eye size={20} color={cores.tintaSuave} />}
              </Pressable>
            </View>
            {modo === 'cadastro' ? (
              <View style={{ gap: esp(2) }}>
                <Text style={tx.rotulo}>Seu bairro</Text>
                <View style={s.chips}>
                  {bairros.map((b) => (
                    <Chip key={b.id} texto={b.nome} ativo={bairroId === b.id} onPress={() => setBairroId(b.id)} />
                  ))}
                </View>
                {erros.bairro ? <Text style={[tx.legenda, { color: cores.perigo }]}>{erros.bairro}</Text> : null}
              </View>
            ) : null}

            {erro ? <Faixa tipo="erro" texto={erro} /> : null}

            <Botao
              titulo={modo === 'entrar' ? 'Entrar' : 'Criar minha conta'}
              icone={modo === 'entrar' ? LogIn : UserPlus}
              onPress={enviar}
              carregando={enviando}
            />
          </Bloco>

          <View style={{ gap: esp(2) }}>
            <Text style={tx.rotulo}>Entrar com uma conta de demonstração</Text>
            <View style={s.demos}>
              {[
                { rotulo: 'Ana, cidadã de Itaquera', e: 'ana@zelo.app', s: '123456', Icone: UserRound },
                { rotulo: 'Joaquim, idoso com letras maiores', e: 'joaquim@zelo.app', s: '123456', Icone: UserRound },
                { rotulo: 'Equipe da subprefeitura (gestor)', e: 'gestor@zelo.app', s: 'gestor123', Icone: Building2 },
              ].map((d, i) => (
                <View key={d.e}>
                  {i ? <Divisor /> : null}
                  <Pressable
                    onPress={() => demo(d.e, d.s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Preencher com ${d.rotulo}`}
                    style={({ pressed }) => [s.demo, pressed && { backgroundColor: cores.fundo }]}
                  >
                    <d.Icone size={18} color={cores.placa} />
                    <Text style={[tx.corpoForte, { flex: 1 }]}>{d.rotulo}</Text>
                    <Text style={tx.legenda}>{d.e}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(6), gap: esp(7), maxWidth: 520, width: '100%', alignSelf: 'center', paddingTop: esp(10) },
  abas: { flexDirection: 'row', backgroundColor: cores.fundo, borderRadius: raio.p, padding: 4 },
  aba: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: raio.p - 3 },
  abaAtiva: { backgroundColor: cores.superficie },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) },
  olho: { position: 'absolute', right: 14, top: 38, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  demos: { backgroundColor: cores.superficie, borderRadius: raio.m, overflow: 'hidden' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: esp(3), minHeight: 54, paddingHorizontal: esp(4) },
});
