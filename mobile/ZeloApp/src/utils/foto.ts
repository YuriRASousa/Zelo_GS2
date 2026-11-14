import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface FotoPronta {
  uri: string;
  base64: string;
  /** Tamanho aproximado depois da compressao, para mostrar ao usuario. */
  kb: number;
}

const LARGURA_MAXIMA = 1024;
const QUALIDADE = 0.55;
const TEMPO_MAXIMO_MS = 20000;

/**
 * Tira ou escolhe a foto e reduz antes de enviar.
 *
 * Uma foto de celular tem 3 a 5 MB e 4000 px de largura. Redimensionada
 * para 1024 px em JPEG 55% ela fica perto de 150 KB: menos memoria no
 * aparelho, menos dados moveis do cidadao e upload mais rapido.
 *
 * No celular usa o expo-image-manipulator e libera as referencias nativas
 * logo depois. No navegador desenha num canvas a partir do arquivo
 * escolhido e devolve um data URL: assim a previa nao depende de uma URL
 * blob temporaria, que pode ser revogada antes de a imagem aparecer.
 */
export async function obterFoto(origem: 'camera' | 'galeria'): Promise<FotoPronta | null> {
  const permissao =
    origem === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) {
    throw new Error(
      origem === 'camera'
        ? 'Sem permissão para usar a câmera. Libere nas configurações do aparelho.'
        : 'Sem permissão para acessar as fotos.',
    );
  }

  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const resultado =
    origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (resultado.canceled || !resultado.assets?.length) return null;

  const original = resultado.assets[0];
  const trabalho = Platform.OS === 'web' ? reduzirNoNavegador(original) : reduzirNoAparelho(original);
  return comTempoMaximo(trabalho);
}

function comTempoMaximo<T>(promessa: Promise<T>): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error('Não consegui preparar a foto. Tente outra imagem.')), TEMPO_MAXIMO_MS),
    ),
  ]);
}

async function reduzirNoAparelho(original: ImagePicker.ImagePickerAsset): Promise<FotoPronta> {
  const contexto = ImageManipulator.manipulate(original.uri);
  if ((original.width ?? LARGURA_MAXIMA + 1) > LARGURA_MAXIMA) contexto.resize({ width: LARGURA_MAXIMA });
  const imagem = await contexto.renderAsync();
  try {
    const salvo = await imagem.saveAsync({ compress: QUALIDADE, format: SaveFormat.JPEG, base64: true });
    const base64 = salvo.base64 ?? '';
    if (!base64) throw new Error('Não consegui preparar a foto. Tente outra imagem.');
    // O arquivo salvo continua no cache do app depois do release().
    return { uri: salvo.uri, base64, kb: Math.round((base64.length * 3) / 4 / 1024) };
  } finally {
    imagem.release();
    contexto.release();
  }
}

function reduzirNoNavegador(original: ImagePicker.ImagePickerAsset): Promise<FotoPronta> {
  return new Promise((resolver, rejeitar) => {
    const arquivo = (original as ImagePicker.ImagePickerAsset & { file?: File }).file;
    const urlTemporaria = arquivo ? URL.createObjectURL(arquivo) : null;
    const img = new window.Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, LARGURA_MAXIMA / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * escala);
        canvas.height = Math.round(img.naturalHeight * escala);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALIDADE);
        // Libera o bitmap grande: o canvas zerado e a URL temporaria revogada.
        canvas.width = 0;
        canvas.height = 0;
        if (urlTemporaria) URL.revokeObjectURL(urlTemporaria);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        resolver({ uri: dataUrl, base64, kb: Math.round((base64.length * 3) / 4 / 1024) });
      } catch {
        rejeitar(new Error('Não consegui preparar a foto. Tente outra imagem.'));
      }
    };
    img.onerror = () => {
      if (urlTemporaria) URL.revokeObjectURL(urlTemporaria);
      rejeitar(new Error('Este arquivo não parece ser uma imagem. Escolha uma foto JPG ou PNG.'));
    };
    img.src = urlTemporaria ?? original.uri;
  });
}
