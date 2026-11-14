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

/**
 * Tira ou escolhe a foto e reduz antes de enviar.
 *
 * Uma foto de celular tem 3 a 5 MB e 4000 px de largura. Redimensionada
 * para 1024 px em JPEG 55% ela fica perto de 150 KB: menos memoria no
 * aparelho, menos dados moveis do cidadao e upload mais rapido. As
 * referencias nativas da imagem sao liberadas logo depois do uso.
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
  const contexto = ImageManipulator.manipulate(original.uri);
  if ((original.width ?? LARGURA_MAXIMA + 1) > LARGURA_MAXIMA) contexto.resize({ width: LARGURA_MAXIMA });
  const imagem = await contexto.renderAsync();
  try {
    const salvo = await imagem.saveAsync({ compress: QUALIDADE, format: SaveFormat.JPEG, base64: true });
    const base64 = salvo.base64 ?? '';
    return { uri: salvo.uri, base64, kb: Math.round((base64.length * 3) / 4 / 1024) };
  } finally {
    imagem.release();
    contexto.release();
  }
}
