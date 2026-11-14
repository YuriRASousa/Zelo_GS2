import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type { MapaRef, MensagemMapa } from './mapaHtml';

interface Props {
  html: string;
  aoReceber: (m: MensagemMapa) => void;
  estilo?: StyleProp<ViewStyle>;
}

/**
 * Versao web: o mesmo HTML do Leaflet num iframe. A conversa com o app usa
 * postMessage, filtrando pela origem da mensagem (so o proprio iframe).
 * O ouvinte e removido quando a tela desmonta, para nao vazar memoria.
 */
const MapaFrame = forwardRef<MapaRef, Props>(function MapaFrame({ html, aoReceber, estilo }, ref) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const callback = useRef(aoReceber);
  callback.current = aoReceber;

  useImperativeHandle(ref, () => ({
    enviar: (m) => iframe.current?.contentWindow?.postMessage(JSON.stringify(m), '*'),
  }));

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return;
      try {
        callback.current(JSON.parse(e.data));
      } catch {
        // ignora
      }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, estilo]}>
      <iframe
        ref={iframe}
        srcDoc={html}
        title="Mapa de ocorrências"
        style={{ border: 'none', width: '100%', height: '100%' }}
      />
    </View>
  );
});

export default MapaFrame;
