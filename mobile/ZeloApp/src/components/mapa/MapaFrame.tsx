import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapaRef, MensagemMapa } from './mapaHtml';

interface Props {
  html: string;
  aoReceber: (m: MensagemMapa) => void;
  estilo?: StyleProp<ViewStyle>;
}

/**
 * Versao celular (iOS/Android): WebView. A versao web fica em
 * MapaFrame.web.tsx; o Metro escolhe o arquivo pela plataforma.
 */
const MapaFrame = forwardRef<MapaRef, Props>(function MapaFrame({ html, aoReceber, estilo }, ref) {
  const webview = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    enviar: (m) => webview.current?.injectJavaScript(`window.zeloReceber(${JSON.stringify(m)}); true;`),
  }));

  return (
    <WebView
      ref={webview}
      originWhitelist={['*']}
      source={{ html }}
      style={[{ flex: 1 }, estilo]}
      javaScriptEnabled
      onMessage={(e) => {
        try {
          aoReceber(JSON.parse(e.nativeEvent.data));
        } catch {
          // mensagem que nao e do mapa: ignora
        }
      }}
    />
  );
});

export default MapaFrame;
