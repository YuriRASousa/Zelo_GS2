import { useMemo } from 'react';
import { TextStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { cores, fontes } from '../theme/tema';

/**
 * Escala tipografica do app. Respeita a preferencia "letras maiores" do
 * perfil (idosos e baixa visao) e so recalcula quando ela muda.
 * Titulos em Barlow Condensed (o desenho das placas), texto em Barlow.
 */
export function useTexto() {
  const { usuario } = useAuth();
  const escala = usuario?.fonteGrande ? 1.3 : 1;

  return useMemo(() => {
    const t = (fontFamily: string, fontSize: number, color = cores.tinta, altura = 1.32): TextStyle => ({
      fontFamily,
      fontSize: Math.round(fontSize * escala),
      lineHeight: Math.round(fontSize * escala * altura),
      color,
    });
    return {
      escala,
      display: t(fontes.condensadaNegrito, 34, cores.tinta, 1.08),
      titulo: t(fontes.condensadaNegrito, 26, cores.tinta, 1.12),
      tituloMenor: t(fontes.condensadaNegrito, 21, cores.tinta, 1.15),
      subtitulo: t(fontes.semi, 17),
      corpo: t(fontes.regular, 15.5, cores.tintaSuave, 1.42),
      corpoForte: t(fontes.semi, 15.5),
      legenda: t(fontes.media, 13, cores.apagado),
      rotulo: t(fontes.semi, 13.5, cores.tintaSuave),
      botao: t(fontes.negrito, 16, cores.branco, 1.2),
      numero: t(fontes.condensadaNegrito, 36, cores.tinta, 1.05),
    };
  }, [escala]);
}
