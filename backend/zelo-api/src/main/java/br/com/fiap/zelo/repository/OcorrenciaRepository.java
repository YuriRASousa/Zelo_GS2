package br.com.fiap.zelo.repository;

import br.com.fiap.zelo.dto.OcorrenciaDtos.ApoioResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.CriadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.DuplicadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.HistoricoResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.NovaOcorrenciaRequest;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaDetalhe;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaResumo;
import org.springframework.jdbc.core.CallableStatementCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Consultas em VW_ZL_OCORRENCIA e chamadas ao pacote PKG_ZL_OCORRENCIA.
 *
 * <p>As escritas passam todas pelas procedures: a API nao faz INSERT nem
 * UPDATE direto em ZL_OCORRENCIA. Assim a regra (prazo, prioridade,
 * duplicidade, transicao de status) vale igual para qualquer cliente.</p>
 */
@Repository
public class OcorrenciaRepository {

    /** Colunas da lista: sem descricao, so o necessario para card e marcador. */
    private static final String COLUNAS_RESUMO = """
            id_ocorrencia, cd_protocolo, ds_titulo, id_categoria, nm_categoria, ds_icone,
            id_bairro, nm_bairro, nr_latitude, nr_longitude, st_ocorrencia, nr_prioridade,
            qt_apoios, fl_risco, fl_acessibilidade, fl_atrasada, ds_foto, dt_abertura, dt_prazo
            """;

    private static final RowMapper<OcorrenciaResumo> RESUMO = (rs, i) -> new OcorrenciaResumo(
            rs.getLong("id_ocorrencia"),
            rs.getString("cd_protocolo"),
            rs.getString("ds_titulo"),
            rs.getLong("id_categoria"),
            rs.getString("nm_categoria"),
            rs.getString("ds_icone"),
            rs.getLong("id_bairro"),
            rs.getString("nm_bairro"),
            rs.getDouble("nr_latitude"),
            rs.getDouble("nr_longitude"),
            rs.getString("st_ocorrencia"),
            rs.getInt("nr_prioridade"),
            rs.getInt("qt_apoios"),
            Colunas.flag(rs, "fl_risco"),
            Colunas.flag(rs, "fl_acessibilidade"),
            Colunas.flag(rs, "fl_atrasada"),
            rs.getString("ds_foto") != null,
            Colunas.data(rs, "dt_abertura"),
            Colunas.data(rs, "dt_prazo"));

    private final JdbcTemplate jdbc;

    public OcorrenciaRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    /**
     * Lista para o mapa e o feed. Ordena por prioridade e corta em
     * {@code limite} linhas no proprio banco (FETCH FIRST), para nunca
     * trazer a cidade inteira para a memoria da API ou do celular.
     *
     * <p>Os filtros sao opcionais e todo valor vindo do usuario entra como
     * parametro bind: so pedacos fixos de SQL sao concatenados.</p>
     */
    public List<OcorrenciaResumo> listar(Long bairroId, Long categoriaId, String busca,
                                         boolean incluirEncerradas, int limite) {
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUNAS_RESUMO)
                .append(" FROM vw_zl_ocorrencia WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        filtroBairroCategoria(sql, args, bairroId, categoriaId);
        if (busca != null) {
            // Sem diferenciar maiuscula nem acento: os dois lados passam
            // pela mesma pkg_zl_ocorrencia.normalizar.
            sql.append(" AND (pkg_zl_ocorrencia.normalizar(cd_protocolo)"
                            + " LIKE '%' || pkg_zl_ocorrencia.normalizar(?) || '%' ESCAPE '\\'")
               .append(" OR pkg_zl_ocorrencia.normalizar(ds_titulo)"
                            + " LIKE '%' || pkg_zl_ocorrencia.normalizar(?) || '%' ESCAPE '\\')");
            String padrao = escaparLike(busca);
            args.add(padrao);
            args.add(padrao);
        }
        if (!incluirEncerradas) {
            sql.append(" AND st_ocorrencia IN ('ABERTA','EM_ANALISE','EM_ANDAMENTO')");
        }
        sql.append(" ORDER BY nr_prioridade DESC, dt_abertura DESC FETCH FIRST ? ROWS ONLY");
        args.add(limite);
        return jdbc.query(sql.toString(), RESUMO, args.toArray());
    }

    private static void filtroBairroCategoria(StringBuilder sql, List<Object> args, Long bairroId, Long categoriaId) {
        if (bairroId != null) {
            sql.append(" AND id_bairro = ?");
            args.add(bairroId);
        }
        if (categoriaId != null) {
            sql.append(" AND id_categoria = ?");
            args.add(categoriaId);
        }
    }

    /** {@code %}, {@code _} e {@code \} digitados pelo usuario viram texto literal no LIKE. */
    static String escaparLike(String texto) {
        return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public List<OcorrenciaResumo> doUsuario(long usuarioId) {
        return jdbc.query("SELECT " + COLUNAS_RESUMO + " FROM vw_zl_ocorrencia WHERE id_usuario = ?"
                + " ORDER BY dt_abertura DESC", RESUMO, usuarioId);
    }

    public List<OcorrenciaResumo> apoiadasPor(long usuarioId) {
        return jdbc.query("SELECT " + COLUNAS_RESUMO + " FROM vw_zl_ocorrencia v WHERE EXISTS"
                + " (SELECT 1 FROM zl_apoio a WHERE a.id_ocorrencia = v.id_ocorrencia AND a.id_usuario = ?)"
                + " ORDER BY dt_abertura DESC", RESUMO, usuarioId);
    }

    /** Fila do gestor: tudo que esta em aberto, da maior prioridade para a menor. */
    public List<OcorrenciaResumo> fila(Long bairroId, Long categoriaId, boolean somenteAtrasadas) {
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUNAS_RESUMO)
                .append(" FROM vw_zl_ocorrencia WHERE st_ocorrencia IN ('ABERTA','EM_ANALISE','EM_ANDAMENTO')");
        List<Object> args = new ArrayList<>();
        filtroBairroCategoria(sql, args, bairroId, categoriaId);
        if (somenteAtrasadas) {
            sql.append(" AND fl_atrasada = 'S'");
        }
        sql.append(" ORDER BY nr_prioridade DESC, dt_prazo");
        return jdbc.query(sql.toString(), RESUMO, args.toArray());
    }

    /**
     * Detalhe com linha do tempo. {@code gestor} libera o comentario mesmo
     * sem ser autor nem apoiador (a mesma regra do pkg_zl_ocorrencia.comentar).
     */
    public Optional<OcorrenciaDetalhe> detalhe(long id, Long usuarioId, boolean gestor) {
        List<HistoricoResponse> historico = historico(id);
        boolean jaApoiei = usuarioId != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM zl_apoio WHERE id_ocorrencia = ? AND id_usuario = ?",
                (rs, i) -> rs.getInt(1) == 1, id, usuarioId));

        return jdbc.query("SELECT * FROM vw_zl_ocorrencia WHERE id_ocorrencia = ?", (rs, i) -> {
            String status = rs.getString("st_ocorrencia");
            boolean souAutor = usuarioId != null && usuarioId == rs.getLong("id_usuario");
            boolean emAberto = !"RESOLVIDA".equals(status) && !"CANCELADA".equals(status);
            return new OcorrenciaDetalhe(
                rs.getLong("id_ocorrencia"),
                rs.getString("cd_protocolo"),
                rs.getString("ds_titulo"),
                rs.getString("ds_descricao"),
                rs.getString("ds_endereco"),
                rs.getLong("id_categoria"),
                rs.getString("nm_categoria"),
                rs.getString("ds_icone"),
                rs.getString("nm_orgao"),
                rs.getLong("id_bairro"),
                rs.getString("nm_bairro"),
                rs.getDouble("nr_latitude"),
                rs.getDouble("nr_longitude"),
                rs.getString("ds_foto"),
                status,
                rs.getInt("nr_prioridade"),
                rs.getInt("qt_apoios"),
                Colunas.flag(rs, "fl_risco"),
                Colunas.flag(rs, "fl_acessibilidade"),
                Colunas.flag(rs, "fl_atrasada"),
                Colunas.data(rs, "dt_abertura"),
                Colunas.data(rs, "dt_prazo"),
                Colunas.data(rs, "dt_resolucao"),
                primeiroNome(rs.getString("nm_usuario")),
                souAutor,
                jaApoiei,
                Colunas.inteiro(rs, "nr_nota"),
                rs.getString("ds_avaliacao"),
                rs.getString("ds_foto_solucao"),
                souAutor && "ABERTA".equals(status),
                usuarioId != null && emAberto && (souAutor || jaApoiei || gestor),
                historico);
        }, id).stream().findFirst();
    }

    private List<HistoricoResponse> historico(long id) {
        return jdbc.query("""
                SELECT h.dt_evento, h.st_anterior, h.st_novo, h.ds_comentario, h.tp_evento,
                       u.nm_usuario, u.tp_papel
                  FROM zl_historico h
                  LEFT JOIN zl_usuario u ON u.id_usuario = h.id_usuario
                 WHERE h.id_ocorrencia = ?
                 ORDER BY h.dt_evento, h.id_historico
                """, (rs, i) -> {
            String papel = rs.getString("tp_papel");
            String autor = papel == null ? "Sistema Zelo"
                    : "GESTOR".equals(papel) ? rs.getString("nm_usuario")
                    : primeiroNome(rs.getString("nm_usuario"));
            return new HistoricoResponse(Colunas.data(rs, "dt_evento"), rs.getString("st_anterior"),
                    rs.getString("st_novo"), rs.getString("ds_comentario"), autor,
                    rs.getString("tp_evento"), papel);
        }, id);
    }

    /** Ocorrencia aberta da mesma categoria num raio de 60 m (function do pacote). */
    public Optional<DuplicadaResponse> duplicada(long categoriaId, double lat, double lon) {
        Long id = jdbc.queryForObject("SELECT pkg_zl_ocorrencia.buscar_duplicada(?, ?, ?) FROM dual",
                (rs, i) -> {
                    long v = rs.getLong(1);
                    return rs.wasNull() ? null : v;
                }, categoriaId, lat, lon);
        if (id == null) {
            return Optional.empty();
        }
        return jdbc.query("SELECT id_ocorrencia, cd_protocolo, ds_titulo FROM zl_ocorrencia WHERE id_ocorrencia = ?",
                (rs, i) -> new DuplicadaResponse(rs.getLong(1), rs.getString(2), rs.getString(3)), id)
                .stream().findFirst();
    }

    public void definirFoto(long id, String nomeArquivo) {
        jdbc.update("UPDATE zl_ocorrencia SET ds_foto = ? WHERE id_ocorrencia = ?", nomeArquivo, id);
    }

    // ------------------------------------------------------------------
    // Procedures
    // ------------------------------------------------------------------

    public CriadaResponse registrar(long usuarioId, NovaOcorrenciaRequest r) {
        return jdbc.execute("{call pkg_zl_ocorrencia.registrar(?,?,?,?,?,?,?,?,?,?,?,?,?,?)}",
                (CallableStatementCallback<CriadaResponse>) cs -> {
                    cs.setLong(1, usuarioId);
                    cs.setLong(2, r.categoriaId());
                    cs.setLong(3, r.bairroId());
                    cs.setString(4, r.titulo());
                    cs.setString(5, r.descricao());
                    cs.setString(6, r.endereco());
                    cs.setDouble(7, r.latitude());
                    cs.setDouble(8, r.longitude());
                    cs.setNull(9, Types.VARCHAR);
                    cs.setString(10, Colunas.sn(r.risco()));
                    cs.setString(11, Colunas.sn(r.acessibilidade()));
                    cs.registerOutParameter(12, Types.NUMERIC);
                    cs.registerOutParameter(13, Types.VARCHAR);
                    cs.setString(14, Colunas.sn(r.ignorarDuplicada()));
                    cs.execute();
                    return new CriadaResponse(cs.getLong(12), cs.getString(13));
                });
    }

    public ApoioResponse apoiar(long ocorrenciaId, long usuarioId) {
        return jdbc.execute("{call pkg_zl_ocorrencia.apoiar(?,?,?,?)}",
                (CallableStatementCallback<ApoioResponse>) cs -> {
                    cs.setLong(1, ocorrenciaId);
                    cs.setLong(2, usuarioId);
                    cs.registerOutParameter(3, Types.NUMERIC);
                    cs.registerOutParameter(4, Types.NUMERIC);
                    cs.execute();
                    return new ApoioResponse(cs.getInt(3), cs.getInt(4));
                });
    }

    public void atualizarStatus(long ocorrenciaId, long gestorId, String status, String comentario,
                                String fotoSolucao) {
        jdbc.execute("{call pkg_zl_ocorrencia.atualizar_status(?,?,?,?,?)}",
                (CallableStatementCallback<Void>) cs -> {
                    cs.setLong(1, ocorrenciaId);
                    cs.setLong(2, gestorId);
                    cs.setString(3, status);
                    cs.setString(4, comentario);
                    cs.setString(5, fotoSolucao);
                    cs.execute();
                    return null;
                });
    }

    public void comentar(long ocorrenciaId, long usuarioId, String texto) {
        jdbc.execute("{call pkg_zl_ocorrencia.comentar(?,?,?)}",
                (CallableStatementCallback<Void>) cs -> {
                    cs.setLong(1, ocorrenciaId);
                    cs.setLong(2, usuarioId);
                    cs.setString(3, texto);
                    cs.execute();
                    return null;
                });
    }

    public void cancelarPeloAutor(long ocorrenciaId, long usuarioId, String motivo) {
        jdbc.execute("{call pkg_zl_ocorrencia.cancelar_pelo_autor(?,?,?)}",
                (CallableStatementCallback<Void>) cs -> {
                    cs.setLong(1, ocorrenciaId);
                    cs.setLong(2, usuarioId);
                    cs.setString(3, motivo);
                    cs.execute();
                    return null;
                });
    }

    public void avaliar(long ocorrenciaId, long usuarioId, int nota, String comentario) {
        jdbc.execute("{call pkg_zl_ocorrencia.avaliar(?,?,?,?)}",
                (CallableStatementCallback<Void>) cs -> {
                    cs.setLong(1, ocorrenciaId);
                    cs.setLong(2, usuarioId);
                    cs.setInt(3, nota);
                    cs.setString(4, comentario);
                    cs.execute();
                    return null;
                });
    }

    /** "Ana Paula Ribeiro" vira "Ana Paula R.": o mapa e publico, o sobrenome nao precisa ser. */
    static String primeiroNome(String nome) {
        if (nome == null || nome.isBlank()) {
            return "Cidadao";
        }
        String[] partes = nome.trim().split("\\s+");
        if (partes.length == 1) {
            return partes[0];
        }
        StringBuilder sb = new StringBuilder(partes[0]);
        for (int i = 1; i < partes.length - 1; i++) {
            sb.append(' ').append(partes[i]);
        }
        return sb.append(' ').append(partes[partes.length - 1].charAt(0)).append('.').toString();
    }
}
