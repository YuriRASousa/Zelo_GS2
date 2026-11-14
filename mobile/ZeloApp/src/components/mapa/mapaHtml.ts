/**
 * Pagina do mapa (Leaflet + OpenStreetMap), carregada uma unica vez dentro
 * da WebView (celular) ou de um iframe (web). Depois de pronta, os
 * marcadores chegam por mensagem: trocar o filtro nao recarrega a pagina
 * nem os blocos do mapa, so redesenha os pontos.
 *
 * Mensagens recebidas (do app):
 *   { tipo: 'marcadores', itens: [{ id, lat, lon, cor, rotulo, destaque }] }
 *   { tipo: 'centro', lat, lon, zoom }
 *   { tipo: 'escolha', lat, lon }        modo de marcar o local do problema
 * Mensagens enviadas (para o app):
 *   { tipo: 'pronto' } | { tipo: 'abrir', id } | { tipo: 'ponto', lat, lon }
 */
export function mapaHtml(lat: number, lon: number, zoom: number): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #m { margin: 0; height: 100%; width: 100%; background: #E8EEEA; }
  .pino { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff;
          box-shadow: 0 2px 6px rgba(10,42,35,.35); }
  .pino.destaque { width: 28px; height: 28px; outline: 3px solid rgba(200,52,31,.35); }
  .alvo { width: 34px; height: 34px; margin-left: -4px; margin-top: -26px; }
  .leaflet-tooltip { font: 600 12px system-ui, sans-serif; border-radius: 8px; }
</style>
</head><body><div id="m"></div>
<script>
  var mapa = L.map('m', { zoomControl: false, attributionControl: true }).setView([${lat}, ${lon}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);

  var camada = L.layerGroup().addTo(mapa);
  var alvo = null;
  var modoEscolha = false;

  function enviar(m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else window.parent.postMessage(s, '*');
  }

  var iconeAlvo = L.divIcon({ className: '', iconSize: [34, 34],
    html: '<svg class="alvo" viewBox="0 0 24 24" fill="#C8341F" stroke="#fff" stroke-width="1.5"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>' });

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
      m.itens.forEach(function (it) {
        var icone = L.divIcon({ className: '', iconSize: [22, 22],
          html: '<div class="pino' + (it.destaque ? ' destaque' : '') + '" style="background:' + it.cor + '"></div>' });
        L.marker([it.lat, it.lon], { icon: icone, title: it.rotulo, keyboard: true })
          .bindTooltip(it.rotulo, { direction: 'top', offset: [0, -10] })
          .on('click', function () { enviar({ tipo: 'abrir', id: it.id }); })
          .addTo(camada);
      });
    } else if (m.tipo === 'centro') {
      mapa.flyTo([m.lat, m.lon], m.zoom || mapa.getZoom(), { duration: 0.6 });
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
}

export type MensagemMapa =
  | { tipo: 'pronto' }
  | { tipo: 'abrir'; id: number }
  | { tipo: 'ponto'; lat: number; lon: number };

export interface MapaRef {
  enviar: (mensagem: object) => void;
}
