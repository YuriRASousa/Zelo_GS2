import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { AuthProvider } from './src/context/AuthContext';
import { CatalogoProvider } from './src/context/CatalogoContext';
import Navegacao from './src/navigation/Navegacao';
import { cores } from './src/theme/tema';

/**
 * Zelo: zeladoria urbana centrada no cidadao.
 * Global Solution 2 (2026), FIAP | Yuri Sousa, RM 556163.
 */
export default function App() {
  // Barlow vem das placas de transito; so carrega os pesos usados.
  const [fontesProntas] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  // Na web: anel de foco azul para quem navega pelo teclado, no lugar do
  // contorno preto padrao do navegador. Campos de texto ja mostram o foco
  // na propria borda azul.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const estilo = document.createElement('style');
    estilo.textContent = `*:focus { outline: none; } *:focus-visible { outline: 3px solid ${cores.placa}; outline-offset: -3px; } input:focus-visible, textarea:focus-visible { outline: none; }`;
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, []);

  if (!fontesProntas) return <View style={{ flex: 1, backgroundColor: cores.fundo }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CatalogoProvider>
          <StatusBar style="dark" />
          <Navegacao />
        </CatalogoProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
