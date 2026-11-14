import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNavigationContainerRef, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ArrowLeft, ChartColumn, ClipboardList, ListChecks, Map, Plus, RefreshCw, UserRound, WifiOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Botao, Carregando, Vazio } from '../components/ui';
import { cores, fontes, raio } from '../theme/tema';
import { urlWeb } from '../config/api';
import type { AbasParams, RaizParams } from './tipos';
import ApresentacaoScreen, { CHAVE_APRESENTACAO } from '../screens/ApresentacaoScreen';
import EntrarScreen from '../screens/EntrarScreen';
import InicioScreen from '../screens/InicioScreen';
import MinhasScreen from '../screens/MinhasScreen';
import PainelScreen from '../screens/PainelScreen';
import PerfilScreen from '../screens/PerfilScreen';
import FilaScreen from '../screens/FilaScreen';
import DetalheScreen from '../screens/DetalheScreen';
import NovaOcorrenciaScreen from '../screens/NovaOcorrenciaScreen';
import NotificacoesScreen from '../screens/NotificacoesScreen';
import EditarPerfilScreen from '../screens/EditarPerfilScreen';
import LogsScreen from '../screens/LogsScreen';

const Pilha = createNativeStackNavigator<RaizParams>();
const navegacaoRef = createNavigationContainerRef<RaizParams>();
const CHAVE_DESTINO = 'zelo.destino';

/**
 * Link de ocorrencia aberto sem login (/ocorrencia/42): o id fica guardado
 * e a ocorrencia abre logo depois que a pessoa entra.
 */
function guardarDestino() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const m = window.location.pathname.match(/^\/ocorrencia\/(\d+)/);
  if (m) window.sessionStorage.setItem(CHAVE_DESTINO, m[1]);
}

function lerDestino(): number | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const id = window.sessionStorage.getItem(CHAVE_DESTINO);
  window.sessionStorage.removeItem(CHAVE_DESTINO);
  return id ? Number(id) : null;
}

/**
 * Seta de voltar do cabecalho. Se a tela foi aberta por link direto e nao
 * ha para onde voltar, leva ao mapa em vez de ficar sem saida.
 */
function BotaoVoltar({ navigation }: { navigation: NativeStackNavigationProp<RaizParams> }) {
  return (
    <Pressable
      onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'Abas' }] }))}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={8}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}
    >
      <ArrowLeft size={24} color={cores.placa} />
    </Pressable>
  );
}

/**
 * Enderecos de cada tela. Na web o botao voltar do navegador navega dentro
 * do app e cada ocorrencia tem link proprio (/ocorrencia/42), usado no
 * compartilhar.
 */
const LINKS: LinkingOptions<RaizParams> = {
  prefixes: [urlWeb(), 'zelo://'],
  config: {
    screens: {
      Apresentacao: 'boas-vindas',
      Entrar: 'entrar',
      Abas: {
        screens: {
          Inicio: '',
          Minhas: 'acompanhar',
          Painel: 'painel',
          Perfil: 'perfil',
          Fila: 'fila',
          Relatar: 'atalho-relatar',
        },
      },
      Detalhe: { path: 'ocorrencia/:id', parse: { id: Number } },
      Nova: 'relatar',
      Notificacoes: 'avisos',
      EditarPerfil: 'perfil/editar',
      Logs: 'rotinas',
    },
  },
};
const Abas = createBottomTabNavigator<AbasParams>();

function TelaVaziaRelatar() {
  return <View />;
}

/** Botao central "Relatar": quadrado amarelo de sinalizacao, abre o formulario. */
function IconeRelatar() {
  return (
    <View
      style={{
        width: 54,
        height: 54,
        borderRadius: raio.m,
        marginTop: -22,
        backgroundColor: cores.sinal,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: cores.superficie,
        transform: [{ rotate: '45deg' }],
      }}
    >
      <View style={{ transform: [{ rotate: '-45deg' }] }}>
        <Plus size={26} color={cores.tinta} strokeWidth={2.8} />
      </View>
    </View>
  );
}

function AbasPrincipais() {
  const { usuario } = useAuth();
  const gestor = usuario?.papel === 'GESTOR';
  const grande = usuario?.fonteGrande;

  return (
    <Abas.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.placa,
        tabBarInactiveTintColor: cores.apagado,
        tabBarLabelStyle: { fontSize: grande ? 13.5 : 12, fontFamily: fontes.semi },
        tabBarStyle: {
          height: grande ? 76 : 68,
          paddingTop: 6,
          paddingBottom: 9,
          borderTopColor: cores.linhaSuave,
          backgroundColor: cores.superficie,
        },
      }}
    >
      {gestor ? (
        <Abas.Screen
          name="Fila"
          component={FilaScreen}
          options={{ title: 'Fila', tabBarIcon: ({ color }) => <ListChecks color={color} size={23} /> }}
        />
      ) : null}
      <Abas.Screen
        name="Inicio"
        component={InicioScreen}
        options={{ title: 'Mapa', tabBarIcon: ({ color }) => <Map color={color} size={23} /> }}
      />
      {!gestor ? (
        <>
          <Abas.Screen
            name="Minhas"
            component={MinhasScreen}
            options={{ title: 'Pedidos', tabBarIcon: ({ color }) => <ClipboardList color={color} size={23} /> }}
          />
          <Abas.Screen
            name="Relatar"
            component={TelaVaziaRelatar}
            options={{
              title: 'Relatar',
              tabBarIcon: () => <IconeRelatar />,
              tabBarLabel: ({ color }) => (
                <Text style={{ color, fontSize: grande ? 13.5 : 12, fontFamily: fontes.semi }}>Relatar</Text>
              ),
              tabBarAccessibilityLabel: 'Relatar um novo problema',
            }}
            listeners={({ navigation }) => ({
              tabPress: (e) => {
                e.preventDefault();
                navigation.getParent()?.navigate('Nova');
              },
            })}
          />
        </>
      ) : null}
      <Abas.Screen
        name="Painel"
        component={PainelScreen}
        options={{ title: 'Painel', tabBarIcon: ({ color }) => <ChartColumn color={color} size={23} /> }}
      />
      <Abas.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{ title: 'Perfil', tabBarIcon: ({ color }) => <UserRound color={color} size={23} /> }}
      />
    </Abas.Navigator>
  );
}

export default function Navegacao() {
  const { usuario, carregando, semConexao, tentarDeNovo } = useAuth();
  const escala = usuario?.fonteGrande ? 1.3 : 1;
  const [apresentacaoVista, setApresentacaoVista] = useState<boolean | null>(null);

  if (!usuario) guardarDestino();

  /** Depois do login, abre a ocorrencia do link que estava esperando. */
  const abrirDestino = useCallback(() => {
    if (!usuario || !navegacaoRef.isReady()) return;
    const id = lerDestino();
    if (id && navegacaoRef.getCurrentRoute()?.name !== 'Detalhe') navegacaoRef.navigate('Detalhe', { id });
  }, [usuario]);

  useEffect(() => {
    abrirDestino();
  }, [abrirDestino]);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_APRESENTACAO)
      .then((v) => setApresentacaoVista(v === 'sim'))
      .catch(() => setApresentacaoVista(true));
  }, []);

  if (carregando || apresentacaoVista === null) return <Carregando texto="Abrindo o Zelo" />;
  if (semConexao) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo, justifyContent: 'center' }}>
        <Vazio
          icone={WifiOff}
          titulo="Sem conexão com o servidor"
          texto="Sua sessão continua salva. Confira a internet e tente de novo."
          acao={<Botao titulo="Tentar de novo" icone={RefreshCw} onPress={tentarDeNovo} />}
        />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navegacaoRef} onReady={abrirDestino} linking={LINKS} documentTitle={{ formatter: (o, rota) => `Zelo · ${o?.title ?? rota?.name ?? ''}` }}>
      <Pilha.Navigator
        screenOptions={({ navigation }) => ({
          headerLeft: () => <BotaoVoltar navigation={navigation as NativeStackNavigationProp<RaizParams>} />,
          headerTintColor: cores.placa,
          headerTitleStyle: { fontFamily: fontes.condensadaNegrito, fontSize: Math.round(21 * escala), color: cores.tinta },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: cores.fundo },
          contentStyle: { backgroundColor: cores.fundo },
        })}
      >
        {usuario ? (
          <>
            <Pilha.Screen name="Abas" component={AbasPrincipais} options={{ headerShown: false }} />
            <Pilha.Screen name="Detalhe" component={DetalheScreen} options={{ title: 'Ocorrência' }} />
            <Pilha.Screen
              name="Nova"
              component={NovaOcorrenciaScreen}
              options={{ title: 'Relatar problema', presentation: 'modal' }}
            />
            <Pilha.Screen name="Notificacoes" component={NotificacoesScreen} options={{ title: 'Notificações' }} />
            <Pilha.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ title: 'Editar perfil' }} />
            {usuario.papel === 'GESTOR' ? (
              <Pilha.Screen name="Logs" component={LogsScreen} options={{ title: 'Execuções das rotinas' }} />
            ) : null}
          </>
        ) : (
          <>
            {!apresentacaoVista ? (
              <Pilha.Screen name="Apresentacao" component={ApresentacaoScreen} options={{ headerShown: false }} />
            ) : null}
            <Pilha.Screen name="Entrar" component={EntrarScreen} options={{ headerShown: false }} />
          </>
        )}
      </Pilha.Navigator>
    </NavigationContainer>
  );
}
