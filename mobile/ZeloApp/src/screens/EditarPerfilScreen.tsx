import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyRound, Save } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useCatalogo } from '../context/CatalogoContext';
import { useTexto } from '../hooks/useTexto';
import { Bloco, Botao, Campo, Chip, Faixa } from '../components/ui';
import { cores, esp } from '../theme/tema';

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null;

/** Edita nome e bairro (salvos no banco) e troca a senha conferindo a atual. */
export default function EditarPerfilScreen() {
  const { usuario, atualizarPerfil, trocarSenha } = useAuth();
  const { bairros } = useCatalogo();
  const tx = useTexto();
  const gestor = usuario?.papel === 'GESTOR';

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [bairroId, setBairroId] = useState<number | null>(usuario?.bairroId ?? null);
  const [avisoPerfil, setAvisoPerfil] = useState<Aviso>(null);
  const [salvando, setSalvando] = useState(false);

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [avisoSenha, setAvisoSenha] = useState<Aviso>(null);
  const [trocando, setTrocando] = useState(false);

  const mudouPerfil = nome.trim() !== usuario?.nome || bairroId !== usuario?.bairroId;

  async function salvarPerfil() {
    setAvisoPerfil(null);
    if (nome.trim().length < 3) return setAvisoPerfil({ tipo: 'erro', texto: 'O nome precisa de pelo menos 3 letras.' });
    if (!gestor && !bairroId) return setAvisoPerfil({ tipo: 'erro', texto: 'Escolha o seu bairro.' });
    setSalvando(true);
    try {
      await atualizarPerfil(nome, bairroId ?? 0);
      setAvisoPerfil({ tipo: 'sucesso', texto: 'Perfil salvo. O mapa e o painel passam a abrir no bairro escolhido.' });
    } catch (e) {
      setAvisoPerfil({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSenha() {
    setAvisoSenha(null);
    if (!atual) return setAvisoSenha({ tipo: 'erro', texto: 'Informe a senha atual.' });
    if (nova.length < 6) return setAvisoSenha({ tipo: 'erro', texto: 'A nova senha precisa de pelo menos 6 caracteres.' });
    if (nova !== confirma) return setAvisoSenha({ tipo: 'erro', texto: 'A confirmação não é igual à nova senha.' });
    if (nova === atual) return setAvisoSenha({ tipo: 'erro', texto: 'A nova senha precisa ser diferente da atual.' });
    setTrocando(true);
    try {
      await trocarSenha(atual, nova);
      setAtual('');
      setNova('');
      setConfirma('');
      setAvisoSenha({ tipo: 'sucesso', texto: 'Senha alterada. Use a nova senha no próximo acesso.' });
    } catch (e) {
      setAvisoSenha({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setTrocando(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
        <Bloco estilo={{ gap: esp(4) }}>
          <Text style={tx.tituloMenor}>Seus dados</Text>
          <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" maxLength={100} />
          <Campo rotulo="E-mail" value={usuario?.email ?? ''} editable={false} ajuda="O e-mail identifica sua conta e não pode ser trocado." style={{ backgroundColor: cores.fundo, color: cores.tintaSuave }} />
          {!gestor ? (
            <View style={{ gap: esp(2) }}>
              <Text style={tx.rotulo}>Bairro onde você mora</Text>
              <View style={s.chips}>
                {bairros.map((b) => (
                  <Chip key={b.id} texto={b.nome} ativo={bairroId === b.id} onPress={() => setBairroId(b.id)} />
                ))}
              </View>
            </View>
          ) : null}
          {avisoPerfil ? <Faixa tipo={avisoPerfil.tipo} texto={avisoPerfil.texto} /> : null}
          <Botao titulo="Salvar alterações" icone={Save} onPress={salvarPerfil} carregando={salvando} desabilitado={!mudouPerfil} />
        </Bloco>

        <Bloco estilo={{ gap: esp(4) }}>
          <Text style={tx.tituloMenor}>Trocar senha</Text>
          <Campo rotulo="Senha atual" value={atual} onChangeText={setAtual} secureTextEntry autoComplete="current-password" />
          <Campo rotulo="Nova senha" value={nova} onChangeText={setNova} secureTextEntry autoComplete="new-password" ajuda="Mínimo de 6 caracteres." />
          <Campo rotulo="Repita a nova senha" value={confirma} onChangeText={setConfirma} secureTextEntry autoComplete="new-password" />
          {avisoSenha ? <Faixa tipo={avisoSenha.tipo} texto={avisoSenha.texto} /> : null}
          <Botao titulo="Trocar senha" icone={KeyRound} variante="secundario" onPress={salvarSenha} carregando={trocando} />
        </Bloco>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  conteudo: { padding: esp(4), gap: esp(5), paddingBottom: esp(14), maxWidth: 640, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: esp(2) },
});
