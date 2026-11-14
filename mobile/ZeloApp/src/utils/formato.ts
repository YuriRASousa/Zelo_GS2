/** Formatacao de datas e numeros em portugues, sem biblioteca externa. */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function ler(iso: string): Date {
  // A API manda LocalDateTime sem fuso ("2026-11-05T16:00:00"): e horario local.
  return new Date(iso.length === 19 ? iso : iso.replace('Z', ''));
}

export function dataCurta(iso: string): string {
  const d = ler(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function dataHora(iso: string): string {
  const d = ler(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** "2026-11" vira "novembro de 2026". */
export function mesPorExtenso(codigo: string): string {
  const [ano, mes] = codigo.split('-').map(Number);
  return `${MESES_LONGOS[mes - 1].toLowerCase()} de ${ano}`;
}

export function nomeMes(codigo: string): string {
  const [ano, mes] = codigo.split('-').map(Number);
  return `${MESES_LONGOS[mes - 1]} ${ano}`;
}

/** "faltam 3 dias" / "venceu ha 2 dias" / "vence hoje". */
export function prazoRelativo(iso: string): { texto: string; vencido: boolean } {
  const prazo = ler(iso);
  const agora = new Date();
  // Dias de calendario (meia-noite a meia-noite), nunca pela hora: prazo
  // em 13 nov visto em 14 nov "venceu ha 1 dia".
  const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((meiaNoite(prazo) - meiaNoite(agora)) / 86400000);
  if (prazo.getTime() < agora.getTime()) {
    const atraso = Math.max(0, -dias);
    if (atraso === 0) return { texto: 'venceu hoje', vencido: true };
    return { texto: `venceu há ${atraso} dia${atraso === 1 ? '' : 's'}`, vencido: true };
  }
  if (dias === 0) return { texto: 'vence hoje', vencido: false };
  if (dias === 1) return { texto: 'vence amanhã', vencido: false };
  return { texto: `faltam ${dias} dias`, vencido: false };
}

export function pct(valor: number | null | undefined): string {
  return valor == null ? '–' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Protocolo com hifen inseparavel (U+2011): nao quebra no meio dentro de uma frase. */
export function protocoloInteiro(protocolo: string): string {
  return protocolo.replace(/-/g, '‑');
}
