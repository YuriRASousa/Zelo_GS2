import { useMemo } from 'react';
import { TextStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme/tema';

/**
 * Estilos de texto que respeitam a preferencia "fonte ampliada" do perfil
 * (pensada para idosos e pessoas com baixa visao). Recalcula so quando a
 * preferencia muda, nao a cada renderizacao.
 */
export function useTexto() {
  const { usuario } = useAuth();
  const escala = usuario?.fonteGrande ? 1.22 : 1;

  return useMemo(() => {
    const t = (fontSize: number, fontWeight: TextStyle['fontWeight'], color = cores.tinta): TextStyle => ({
      fontSize: Math.round(fontSize * escala),
      lineHeight: Math.round(fontSize * escala * 1.35),
      fontWeight,
      color,
    });
    return {
      escala,
      display: t(28, '800'),
      titulo: t(20, '700'),
      subtitulo: t(16, '700'),
      corpo: t(15, '400', cores.tintaSuave),
      corpoForte: t(15, '600'),
      legenda: t(12.5, '500', cores.apagado),
      rotulo: t(13, '700', cores.tintaSuave),
      botao: t(15.5, '700', cores.branco),
    };
  }, [escala]);
}
