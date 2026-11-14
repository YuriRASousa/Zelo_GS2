package br.com.fiap.zelo.repository;

import br.com.fiap.zelo.dto.AuthDtos.UsuarioResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/** Acesso a ZL_USUARIO. */
@Repository
public class UsuarioRepository {

    /** Credenciais minimas para conferir o login. */
    public record Credencial(long id, String hash, String papel) {
    }

    private static final String PERFIL = """
            SELECT u.id_usuario, u.nm_usuario, u.ds_email, u.tp_papel, u.id_bairro, b.nm_bairro,
                   u.nr_pontos, u.fl_fonte_grande,
                   (SELECT COUNT(*) FROM zl_ocorrencia o WHERE o.id_usuario = u.id_usuario) AS qt_registradas,
                   (SELECT COUNT(*) FROM zl_apoio a WHERE a.id_usuario = u.id_usuario) AS qt_apoios,
                   (SELECT COUNT(*) FROM zl_ocorrencia o WHERE o.id_usuario = u.id_usuario
                       AND o.st_ocorrencia = 'RESOLVIDA') AS qt_resolvidas
              FROM zl_usuario u
              LEFT JOIN zl_bairro b ON b.id_bairro = u.id_bairro
             WHERE u.id_usuario = ?
            """;

    private final JdbcTemplate jdbc;

    public UsuarioRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Credencial> credencialPorEmail(String email) {
        List<Credencial> r = jdbc.query(
                "SELECT id_usuario, ds_senha_hash, tp_papel FROM zl_usuario WHERE ds_email = ?",
                (rs, i) -> new Credencial(rs.getLong(1), rs.getString(2), rs.getString(3)),
                email.toLowerCase().trim());
        return r.stream().findFirst();
    }

    public boolean emailEmUso(String email) {
        Integer qt = jdbc.queryForObject("SELECT COUNT(*) FROM zl_usuario WHERE ds_email = ?",
                Integer.class, email.toLowerCase().trim());
        return qt != null && qt > 0;
    }

    public long inserir(String nome, String email, String hash, long bairroId) {
        Long id = jdbc.queryForObject("SELECT seq_zl_usuario.NEXTVAL FROM dual", Long.class);
        jdbc.update("""
                INSERT INTO zl_usuario (id_usuario, nm_usuario, ds_email, ds_senha_hash, tp_papel, id_bairro)
                VALUES (?, ?, ?, ?, 'CIDADAO', ?)
                """, id, nome.trim(), email.toLowerCase().trim(), hash, bairroId);
        return id;
    }

    public Optional<UsuarioResponse> perfil(long id) {
        return jdbc.query(PERFIL, (rs, i) -> new UsuarioResponse(
                rs.getLong("id_usuario"),
                rs.getString("nm_usuario"),
                rs.getString("ds_email"),
                rs.getString("tp_papel"),
                Colunas.longo(rs, "id_bairro"),
                rs.getString("nm_bairro"),
                rs.getInt("nr_pontos"),
                Colunas.flag(rs, "fl_fonte_grande"),
                rs.getInt("qt_registradas"),
                rs.getInt("qt_apoios"),
                rs.getInt("qt_resolvidas")), id).stream().findFirst();
    }

    public void atualizarFonteGrande(long id, boolean fonteGrande) {
        jdbc.update("UPDATE zl_usuario SET fl_fonte_grande = ? WHERE id_usuario = ?",
                Colunas.sn(fonteGrande), id);
    }
}
