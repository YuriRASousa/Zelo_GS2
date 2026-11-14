import React from 'react';
import {
  Accessibility,
  CircleAlert,
  CloudRain,
  Construction,
  Droplets,
  LightbulbOff,
  type LucideIcon,
  TrafficCone,
  Trash2,
  TreePine,
} from 'lucide-react-native';

/**
 * O banco guarda o nome do icone de cada categoria (ZL_CATEGORIA.DS_ICONE).
 * O mapa abaixo importa so os icones usados, e nao a biblioteca inteira,
 * o que deixa o pacote do app menor.
 */
const ICONES: Record<string, LucideIcon> = {
  construction: Construction,
  'lightbulb-off': LightbulbOff,
  accessibility: Accessibility,
  'trash-2': Trash2,
  droplets: Droplets,
  'tree-pine': TreePine,
  'traffic-cone': TrafficCone,
  'cloud-rain': CloudRain,
};

interface Props {
  nome: string;
  tamanho?: number;
  cor?: string;
  espessura?: number;
}

export default function IconeCategoria({ nome, tamanho = 20, cor = '#0B5D4B', espessura = 2 }: Props) {
  const Componente = ICONES[nome] ?? CircleAlert;
  return <Componente size={tamanho} color={cor} strokeWidth={espessura} />;
}
