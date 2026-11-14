import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartColumn, ClipboardList, ListChecks, Map, Plus, UserRound } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Carregando } from '../components/ui';
import { cores } from '../theme/tema';
import type { AbasParams, RaizParams } from './tipos';
import EntrarScreen from '../screens/EntrarScreen';
import InicioScreen from '../screens/InicioScreen';
import MinhasScreen from '../screens/MinhasScreen';
import PainelScreen from '../screens/PainelScreen';
import PerfilScreen from '../screens/PerfilScreen';
import FilaScreen from '../screens/FilaScreen';
import DetalheScreen from '../screens/DetalheScreen';
import NovaOcorrenciaScreen from '../screens/NovaOcorrenciaScreen';

const Pilha = createNativeStackNavigator<RaizParams>();
const Abas = createBottomTabNavigator<AbasParams>();

function Vazio() {
  return <View />;
}

/** Botao central "Relatar": abre o formulario por cima das abas. */
function IconeRelatar({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        marginTop: -18,
        backgroundColor: focused ? cores.primariaMedia : cores.primaria,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: cores.branco,
      }}
    >
      <Plus size={26} color={cores.branco} strokeWidth={2.6} />
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
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.apagado,
        tabBarLabelStyle: { fontSize: grande ? 13 : 11.5, fontWeight: '700' },
        tabBarStyle: { height: grande ? 74 : 66, paddingTop: 6, paddingBottom: 8, borderTopColor: cores.linha },
      }}
    >
      {gestor ? (
        <Abas.Screen
          name="Fila"
          component={FilaScreen}
          options={{ title: 'Fila', tabBarIcon: ({ color }) => <ListChecks color={color} size={22} /> }}
        />
      ) : null}
      <Abas.Screen
        name="Inicio"
        component={InicioScreen}
        options={{ title: 'Mapa', tabBarIcon: ({ color }) => <Map color={color} size={22} /> }}
      />
      {!gestor ? (
        <>
          <Abas.Screen
            name="Minhas"
            component={MinhasScreen}
            options={{ title: 'Minhas', tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} /> }}
          />
          <Abas.Screen
            name="Relatar"
            component={Vazio}
            options={{
              title: 'Relatar',
              tabBarIcon: ({ focused }) => <IconeRelatar focused={focused} />,
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
        options={{ title: 'Painel', tabBarIcon: ({ color }) => <ChartColumn color={color} size={22} /> }}
      />
      <Abas.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{ title: 'Perfil', tabBarIcon: ({ color }) => <UserRound color={color} size={22} /> }}
      />
    </Abas.Navigator>
  );
}

export default function Navegacao() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <Carregando texto="Abrindo o Zelo..." />;

  return (
    <NavigationContainer
      documentTitle={{ formatter: (o, rota) => `Zelo · ${o?.title ?? rota?.name ?? ''}` }}
    >
      <Pilha.Navigator
        screenOptions={{
          headerTintColor: cores.primaria,
          headerTitleStyle: { fontWeight: '700', color: cores.tinta },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: cores.fundo },
          contentStyle: { backgroundColor: cores.fundo },
        }}
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
          </>
        ) : (
          <Pilha.Screen name="Entrar" component={EntrarScreen} options={{ headerShown: false }} />
        )}
      </Pilha.Navigator>
    </NavigationContainer>
  );
}
