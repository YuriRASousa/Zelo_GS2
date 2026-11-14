import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CatalogoProvider } from './src/context/CatalogoContext';
import Navegacao from './src/navigation/Navegacao';

/**
 * Zelo: zeladoria urbana centrada no cidadao.
 * Global Solution 2 (2026), FIAP | Yuri Sousa, RM 556163.
 */
export default function App() {
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
