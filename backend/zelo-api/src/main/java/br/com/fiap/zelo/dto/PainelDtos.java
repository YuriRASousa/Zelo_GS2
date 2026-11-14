package br.com.fiap.zelo.dto;

import java.time.LocalDateTime;
import java.util.List;

/** Painel de transparencia e rotinas do gestor. */
public final class PainelDtos {

    private PainelDtos() {
    }

    /** Numeros ao vivo, direto das tabelas. */
    public record Agora(int emAberto, int atrasadas, int resolvidas, int apoios, Double pcNoPrazo) {
    }

    /** Linha de ZL_INDICADOR, gerada pela rotina mensal. */
    public record IndicadorMes(
            String mes, int abertas, int resolvidas, int atrasadas,
            Double tempoMedioDias, Double pcNoPrazo, Double notaMedia, Double taxaMilHab,
            LocalDateTime geradoEm) {
    }

    public record CategoriaRanking(String categoria, String icone, int total, int emAberto, int resolvidas) {
    }

    public record CidadaoRanking(String nome, int pontos) {
    }

    public record PainelResponse(
            Long bairroId, String bairro, Agora agora,
            List<IndicadorMes> meses, List<CategoriaRanking> categorias, List<CidadaoRanking> cidadaos) {
    }

    public record RotinaResponse(int atrasosDetectados, int prioridadesAjustadas, int bairrosConsolidados, String mes) {
    }

    public record LogResponse(LocalDateTime data, String rotina, String nivel, int linhas, String mensagem) {
    }
}
