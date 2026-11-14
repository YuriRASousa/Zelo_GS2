/** Gera os icones do app (pino do Zelo sobre fundo verde) em mobile/ZeloApp/assets. Uso: node gerar_icone.js */
const sharp = require('sharp');
const path = require('path');
const destino = path.join(__dirname, '..', '..', 'mobile', 'ZeloApp', 'assets');
const pino = (escala, cor = '#F2A93B') => `<g transform="translate(512 500) scale(${escala}) translate(-12 -12)">
  <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="${cor}"/>
  <circle cx="12" cy="10" r="2.8" fill="#0B5D4B"/></g>`;
const fundo = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A2A23"/><stop offset="1" stop-color="#12806A"/></linearGradient></defs>`;
const svg = (conteudo, comFundo = true) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${fundo}${comFundo ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}${conteudo}</svg>`);
(async () => {
  await sharp(svg(pino(26))).png().toFile(path.join(destino, 'icon.png'));
  await sharp(svg(pino(18))).png().toFile(path.join(destino, 'android-icon-foreground.png'));
  await sharp(svg('', true)).png().toFile(path.join(destino, 'android-icon-background.png'));
  await sharp(svg(pino(18, '#000000'), false)).png().toFile(path.join(destino, 'android-icon-monochrome.png'));
  await sharp(svg(pino(22), false)).png().toFile(path.join(destino, 'splash-icon.png'));
  await sharp(svg(pino(30))).resize(48, 48).png().toFile(path.join(destino, 'favicon.png'));
  console.log('icones gerados');
})();
