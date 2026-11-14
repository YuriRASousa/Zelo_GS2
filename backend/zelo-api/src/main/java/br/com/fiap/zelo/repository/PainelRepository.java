package br.com.fiap.zelo.repository;

import br.com.fiap.zelo.dto.PainelDtos.Agora;
import br.com.fiap.zelo.dto.PainelDtos.CategoriaRanking;
import br.com.fiap.zelo.dto.PainelDtos.CidadaoRanking;
import br.com.fiap.zelo.dto.PainelDtos.IndicadorMes;
import br.com.fiap.zelo.dto.PainelDtos.LogResponse;
import br.com.fiap.zelo.dto.PainelDtos.RotinaResponse;
import org.springframework.jdbc.core.CallableStatementCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.List;

/**
 * Painel de transparencia (ZL_INDICADOR, VW_ZL_RANKING_CATEGORIA) e as
 * rotinas do pacote PKG_ZL_INDICADOR. Com {@code bairroId} nulo os
 * numeros sao da cidade toda.
 */
@Repository
public class PainelRepository {

    private final JdbcTemplate jdbc;

    public PainelRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String nomeBairro(long id) {
        return jdbc.query("SELECT nm_bairro FROM zl_bairro WHERE id_bairro = ?",
                (rs, i) -> rs.getString(1), id).stream().findFirst().orElse(null);
    }

    public Agora agora(Long bairroId) {
        String filtro = bairroId != null ? " WHERE id_bairro = ?" : "";
        Object[] args = bairroId != null ? new Object[]{bairroId} : new Object[]{};
        return jdbc.queryForObject("""
                SELECT NVL(SUM(CASE WHEN st_ocorrencia IN ('ABERTA','EM_ANALISE','EM_ANDAMENTO') THEN 1 END), 0) AS em_aberto,
                       NVL(SUM(CASE WHEN st_ocorrencia IN ('ABERTA','EM_ANALISE','EM_ANDAMENTO')
                                     AND dt_prazo < SYSDATE THEN 1 END), 0) AS atrasadas,
                       NVL(SUM(CASE WHEN st_ocorrencia = 'RESOLVIDA' THEN 1 END), 0) AS resolvidas,
                       NVL(SUM(qt_apoios), 0) AS apoios,
                       ROUND(100 * SUM(CASE WHEN st_ocorrencia = 'RESOLVIDA' AND dt_resolucao <= dt_prazo THEN 1 ELSE 0 END)
                             / NULLIF(SUM(CASE WHEN st_ocorrencia = 'RESOLVIDA' THEN 1 END), 0), 1) AS pc_no_prazo
                  FROM zl_ocorrencia""" + filtro,
                (rs, i) -> new Agora(rs.getInt("em_aberto"), rs.getInt("atrasadas"), rs.getInt("resolvidas"),
                        rs.getInt("apoios"), Colunas.decimal(rs, "pc_no_prazo")), args);
    }

    /** Ultimos 6 meses consolidados pela rotina (cidade = soma dos bairros). */
    public List<IndicadorMes> meses(Long bairroId) {
        if (bairroId != null) {
            return jdbc.query("""
                    SELECT cd_mes, qt_abertas, qt_resolvidas, qt_atrasadas, nr_tempo_medio,
                           pc_no_prazo, nr_nota_media, nr_taxa_mil_hab, dt_geracao
                      FROM zl_indicador WHERE id_bairro = ?
                     ORDER BY cd_mes DESC FETCH FIRST 6 ROWS ONLY
                    """, (rs, i) -> mes(rs), bairroId);
        }
        return jdbc.query("""
                SELECT i.cd_mes,
                       SUM(i.qt_abertas) AS qt_abertas,
                       SUM(i.qt_resolvidas) AS qt_resolvidas,
                       SUM(i.qt_atrasadas) AS qt_atrasadas,
                       ROUND(SUM(i.nr_tempo_medio * i.qt_resolvidas) / NULLIF(SUM(i.qt_resolvidas), 0), 1) AS nr_tempo_medio,
                       ROUND(SUM(i.pc_no_prazo * i.qt_resolvidas) / NULLIF(SUM(i.qt_resolvidas), 0), 1) AS pc_no_prazo,
                       ROUND(AVG(i.nr_nota_media), 2) AS nr_nota_media,
                       ROUND(SUM(i.qt_abertas) * 1000 / SUM(b.nr_populacao), 2) AS nr_taxa_mil_hab,
                       MAX(i.dt_geracao) AS dt_geracao
                  FROM zl_indicador i JOIN zl_bairro b ON b.id_bairro = i.id_bairro
                 GROUP BY i.cd_mes
                 ORDER BY i.cd_mes DESC FETCH FIRST 6 ROWS ONLY
                """, (rs, i) -> mes(rs));
    }

    private static IndicadorMes mes(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new IndicadorMes(rs.getString("cd_mes"), rs.getInt("qt_abertas"), rs.getInt("qt_resolvidas"),
                rs.getInt("qt_atrasadas"), Colunas.decimal(rs, "nr_tempo_medio"), Colunas.decimal(rs, "pc_no_prazo"),
                Colunas.decimal(rs, "nr_nota_media"), Colunas.decimal(rs, "nr_taxa_mil_hab"),
                Colunas.data(rs, "dt_geracao"));
    }

    public List<CategoriaRanking> categorias(Long bairroId) {
        String filtro = bairroId != null ? " WHERE id_bairro = ?" : "";
        Object[] args = bairroId != null ? new Object[]{bairroId} : new Object[]{};
        return jdbc.query("""
                SELECT nm_categoria, ds_icone, SUM(qt_total) AS total,
                       SUM(qt_em_aberto) AS em_aberto, SUM(qt_resolvidas) AS resolvidas
                  FROM vw_zl_ranking_categoria""" + filtro + """
                 GROUP BY nm_categoria, ds_icone
                HAVING SUM(qt_total) > 0
                 ORDER BY total DESC, nm_categoria
                """, (rs, i) -> new CategoriaRanking(rs.getString(1), rs.getString(2), rs.getInt(3),
                rs.getInt(4), rs.getInt(5)), args);
    }

    /** Top 5 por pontos de participacao, so com primeiro nome e inicial. */
    public List<CidadaoRanking> cidadaos(Long bairroId) {
        String filtro = bairroId != null ? " AND id_bairro = ?" : "";
        Object[] args = bairroId != null ? new Object[]{bairroId} : new Object[]{};
        return jdbc.query("SELECT nm_usuario, nr_pontos FROM zl_usuario WHERE tp_papel = 'CIDADAO' AND nr_pontos > 0" + filtro
                        + " ORDER BY nr_pontos DESC, nm_usuario FETCH FIRST 5 ROWS ONLY",
                (rs, i) -> new CidadaoRanking(OcorrenciaRepository.primeiroNome(rs.getString(1)), rs.getInt(2)), args);
    }

    // ------------------------------------------------------------------
    // Rotinas automaticas
    // ------------------------------------------------------------------

    public RotinaResponse executarRotinas(String mes) {
        int atrasos = chamarComContagem("{call pkg_zl_indicador.detectar_atrasos(?)}", null);
        int prioridades = chamarComContagem("{call pkg_zl_indicador.recalcular_prioridades(?)}", null);
        int bairros = chamarComContagem("{call pkg_zl_indicador.gerar_indicadores(?, ?)}", mes);
        return new RotinaResponse(atrasos, prioridades, bairros, mes);
    }

    private int chamarComContagem(String chamada, String mes) {
        return jdbc.execute(chamada, (CallableStatementCallback<Integer>) cs -> {
            int saida = 1;
            if (mes != null) {
                cs.setString(1, mes);
                saida = 2;
            }
            cs.registerOutParameter(saida, Types.NUMERIC);
            cs.execute();
            return cs.getInt(saida);
        });
    }

    public List<LogResponse> logs(int limite) {
        return jdbc.query("""
                SELECT dt_execucao, nm_rotina, tp_nivel, qt_linhas, ds_mensagem
                  FROM zl_log_rotina ORDER BY id_log DESC FETCH FIRST ? ROWS ONLY
                """, (rs, i) -> new LogResponse(Colunas.data(rs, "dt_execucao"), rs.getString("nm_rotina"),
                rs.getString("tp_nivel"), rs.getInt("qt_linhas"), rs.getString("ds_mensagem")), limite);
    }
}
