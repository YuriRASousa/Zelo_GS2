package br.com.fiap.zelo.exception;

import org.springframework.dao.DataAccessException;

import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Traduz o erro de aplicacao do Oracle para {@link RegraNegocioException}.
 *
 * <p>Uma recusa chega assim do driver:</p>
 * <pre>
 * ORA-20105: Ja existe a ocorrencia ZL-2026-000003 ... [id=3]
 * ORA-06512: at "RM556163.PKG_ZL_OCORRENCIA", line 240
 * </pre>
 * <p>Fica so a primeira linha. O trecho {@code [id=N]}, quando existe, sai
 * da mensagem e vira o campo {@code referenciaId} da resposta, para o app
 * conseguir abrir a ocorrencia citada.</p>
 */
public final class OracleErrors {

    private static final Pattern ERRO_APLICACAO = Pattern.compile("ORA-(2\\d{4}):\\s*([^\\n\\r]+)");
    private static final Pattern REFERENCIA = Pattern.compile("\\s*\\[id=(\\d+)]");

    private OracleErrors() {
    }

    /** Devolve a excecao traduzida, ou a original quando nao e regra de negocio. */
    public static RuntimeException traduzir(DataAccessException ex) {
        Throwable causa = ex;
        while (causa != null) {
            if (causa instanceof SQLException sql) {
                Matcher m = ERRO_APLICACAO.matcher(String.valueOf(sql.getMessage()));
                if (m.find()) {
                    String mensagem = m.group(2).trim();
                    Long referencia = null;
                    Matcher ref = REFERENCIA.matcher(mensagem);
                    if (ref.find()) {
                        referencia = Long.parseLong(ref.group(1));
                        mensagem = ref.replaceAll("").trim();
                    }
                    return new RegraNegocioException(Integer.parseInt(m.group(1)), mensagem, referencia);
                }
            }
            causa = causa.getCause();
        }
        return ex;
    }
}
