/**
 * Pagina do mapa (Leaflet + OpenStreetMap), carregada uma unica vez dentro
 * da WebView (celular) ou de um iframe (web). Depois de pronta, os
 * marcadores chegam por mensagem: trocar o filtro nao recarrega a pagina
 * nem os blocos do mapa, so redesenha os pontos.
 *
 * Mensagens recebidas (do app):
 *   { tipo: 'marcadores', itens: [{ id, lat, lon, cor, rotulo, destaque }] }
 *   { tipo: 'centro', lat, lon, zoom, offsetY }
 *   { tipo: 'escolha', lat, lon }        modo de marcar o local do problema
 *   { tipo: 'fixo', lat, lon }           mini mapa do detalhe (sem arrastar)
 * Mensagens enviadas (para o app):
 *   { tipo: 'pronto' } | { tipo: 'abrir', id } | { tipo: 'ponto', lat, lon }
 */
export function mapaHtml(lat: number, lon: number, zoom: number, fixo = false, detalhado = false): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #m { margin: 0; height: 100%; width: 100%; background: #E9EAE4; }
  /* Pino em gota (quadrado girado com uma ponta reta) na cor do status,
     com o icone da categoria em branco. */
  .pino { width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
          border: 2px solid #fff; box-shadow: 0 2px 5px rgba(34,38,43,.4); box-sizing: border-box;
          display: flex; align-items: center; justify-content: center; }
  .pino svg { transform: rotate(45deg); width: 15px; height: 15px; }
  .pino.destaque { box-shadow: 0 0 0 5px rgba(194,51,30,.25), 0 2px 5px rgba(34,38,43,.4); }
  /* Evita as linhas finas entre os blocos do mapa em telas de alta densidade. */
  .leaflet-tile { outline: 1px solid transparent; will-change: transform; }
  .alvo { width: 38px; height: 38px; margin-left: -2px; margin-top: -30px; filter: drop-shadow(0 2px 3px rgba(34,38,43,.4)); }
  .leaflet-tooltip { font: 600 12px Barlow, system-ui, sans-serif; border-radius: 6px; border: 0; box-shadow: 0 2px 8px rgba(34,38,43,.2); }
  .leaflet-control-attribution { font: 10px system-ui, sans-serif; }
  .leaflet-tile-pane { filter: saturate(0.35) brightness(1.06) contrast(0.92); }
</style>
</head><body><div id="m"></div>
<script>
  var FIXO = ${fixo ? 'true' : 'false'};
  var mapa = L.map('m', { zoomControl: false, attributionControl: true,
    dragging: !FIXO, scrollWheelZoom: !FIXO, doubleClickZoom: !FIXO, touchZoom: !FIXO, keyboard: !FIXO
  }).setView([${lat}, ${lon}], ${zoom});
  // OpenStreetMap padrao (sem chave de API), dessaturado por CSS para os
  // marcadores coloridos ganharem destaque.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, maxNativeZoom: 19, detectRetina: ${detalhado ? 'true' : 'false'}, attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);
  mapa.setMaxZoom(18);
  if (!FIXO) L.control.zoom({ position: 'bottomright' }).addTo(mapa);

  var camada = L.layerGroup().addTo(mapa);
  var alvo = null;
  var modoEscolha = false;

  function enviar(m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else window.parent.postMessage(s, '*');
  }

  var iconeAlvo = L.divIcon({ className: '', iconSize: [34, 34],
    html: '<svg class="alvo" viewBox="0 0 24 24" fill="#1A4E9E" stroke="#fff" stroke-width="1.5"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>' });

  function colocarAlvo(lat, lon) {
    if (alvo) alvo.setLatLng([lat, lon]);
    else {
      alvo = L.marker([lat, lon], { icon: iconeAlvo, draggable: true }).addTo(mapa);
      alvo.on('dragend', function () { var p = alvo.getLatLng(); enviar({ tipo: 'ponto', lat: p.lat, lon: p.lng }); });
    }
  }

  mapa.on('click', function (e) {
    if (!modoEscolha) return;
    colocarAlvo(e.latlng.lat, e.latlng.lng);
    enviar({ tipo: 'ponto', lat: e.latlng.lat, lon: e.latlng.lng });
  });

  window.zeloReceber = function (m) {
    if (m.tipo === 'marcadores') {
      camada.clearLayers();
      var pontos = [];
      m.itens.forEach(function (it) {
        var svg = it.icone ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + it.icone + '</svg>' : '';
        var icone = L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 34],
          html: '<div class="pino' + (it.destaque ? ' destaque' : '') + '" style="background:' + it.cor + '">' + svg + '</div>' });
        L.marker([it.lat, it.lon], { icon: icone, title: it.rotulo, keyboard: true })
          .bindTooltip(it.rotulo, { direction: 'top', offset: [0, -30] })
          .on('click', function () { enviar({ tipo: 'abrir', id: it.id }); })
          .addTo(camada);
        pontos.push([it.lat, it.lon]);
      });
      // Cidade toda: enquadra todos os pinos na faixa visivel acima da lista.
      if (m.enquadrar && pontos.length) {
        mapa.fitBounds(pontos, { paddingTopLeft: [40, 150], paddingBottomRight: [40, (m.offsetY || 0) + 40], maxZoom: 14 });
      }
    } else if (m.tipo === 'centro') {
      // offsetY: altura (px) coberta pela folha da lista; o ponto vai para o
      // meio da area que continua visivel.
      var z = m.zoom || mapa.getZoom();
      var alvoPx = mapa.project([m.lat, m.lon], z).add([0, (m.offsetY || 0) / 2]);
      mapa.flyTo(mapa.unproject(alvoPx, z), z, { duration: 0.6 });
    } else if (m.tipo === 'fixo') {
      L.marker([m.lat, m.lon], { icon: iconeAlvo, interactive: false }).addTo(camada);
      mapa.setView([m.lat, m.lon], 16);
    } else if (m.tipo === 'escolha') {
      modoEscolha = true;
      colocarAlvo(m.lat, m.lon);
      mapa.setView([m.lat, m.lon], 17);
    }
  };

  window.addEventListener('message', function (e) {
    try { window.zeloReceber(typeof e.data === 'string' ? JSON.parse(e.data) : e.data); } catch (_) {}
  });
  enviar({ tipo: 'pronto' });
</script>
</body></html>`;
}

export interface Marcador {
  id: number;
  lat: number;
  lon: number;
  cor: string;
  rotulo: string;
  destaque?: boolean;
  /** SVG interno do icone da categoria (ver iconesMapa.ts). */
  icone?: string;
}

export type MensagemMapa =
  | { tipo: 'pronto' }
  | { tipo: 'abrir'; id: number }
  | { tipo: 'ponto'; lat: number; lon: number };

export interface MapaRef {
  enviar: (mensagem: object) => void;
}
