package br.com.fiap.zelo.repository;

import br.com.fiap.zelo.dto.NotificacaoDtos.NotificacaoResponse;
import org.springframework.jdbc.core.CallableStatementCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.List;

/**
 * Leitura de ZL_NOTIFICACAO e chamadas ao PKG_ZL_NOTIFICACAO. A API nunca
 * cria notificacao: elas nascem no banco, junto com o evento que avisam.
 */
@Repository
public class NotificacaoRepository {

    private final JdbcTemplate jdbc;

    public NotificacaoRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mais novas primeiro; usa o indice (id_usuario, fl_lida, dt_criacao DESC). */
    public List<NotificacaoResponse> doUsuario(long usuarioId, int limite) {
        return jdbc.query("""
                SELECT n.id_notificacao, n.id_ocorrencia, o.cd_protocolo, n.tp_notificacao,
                       n.ds_titulo, n.ds_mensagem, n.fl_lida, n.dt_criacao
                  FROM zl_notificacao n
                  JOIN zl_ocorrencia o ON o.id_ocorrencia = n.id_ocorrencia
                 WHERE n.id_usuario = ?
                 ORDER BY n.dt_criacao DESC, n.id_notificacao DESC
                 FETCH FIRST ? ROWS ONLY
                """, (rs, i) -> new NotificacaoResponse(
                rs.getLong("id_notificacao"),
                rs.getLong("id_ocorrencia"),
                rs.getString("cd_protocolo"),
                rs.getString("tp_notificacao"),
                rs.getString("ds_titulo"),
                rs.getString("ds_mensagem"),
                Colunas.flag(rs, "fl_lida"),
                Colunas.data(rs, "dt_criacao")), usuarioId, limite);
    }

    public int naoLidas(long usuarioId) {
        Integer qt = jdbc.queryForObject("SELECT pkg_zl_notificacao.nao_lidas(?) FROM dual",
                Integer.class, usuarioId);
        return qt == null ? 0 : qt;
    }

    public void marcarLida(long notificacaoId, long usuarioId) {
        jdbc.execute("{call pkg_zl_notificacao.marcar_lida(?,?)}",
                (CallableStatementCallback<Void>) cs -> {
                    cs.setLong(1, notificacaoId);
                    cs.setLong(2, usuarioId);
                    cs.execute();
                    return null;
                });
    }

    public int marcarTodas(long usuarioId) {
        return jdbc.execute("{call pkg_zl_notificacao.marcar_todas(?,?)}",
                (CallableStatementCallback<Integer>) cs -> {
                    cs.setLong(1, usuarioId);
                    cs.registerOutParameter(2, Types.NUMERIC);
                    cs.execute();
                    return cs.getInt(2);
                });
    }
}
