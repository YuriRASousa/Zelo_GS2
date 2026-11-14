import type { NavigatorScreenParams } from '@react-navigation/native';

export type AbasParams = {
  Inicio: undefined;
  Minhas: undefined;
  Relatar: undefined;
  Painel: undefined;
  Perfil: undefined;
  Fila: undefined;
};

export type RaizParams = {
  Apresentacao: undefined;
  Entrar: undefined;
  Abas: NavigatorScreenParams<AbasParams>;
  Detalhe: { id: number };
  Nova: undefined;
  Notificacoes: undefined;
  EditarPerfil: undefined;
  Logs: undefined;
};
