package br.com.fiap.zelo.exception;

/**
 * Operacao recusada por uma regra de negocio.
 *
 * <p>Quase sempre nasce de um RAISE_APPLICATION_ERROR das procedures
 * (codigo -20101 a -20299), traduzido pelo {@link OracleErrors}. O codigo
 * define o status HTTP e a mensagem vai direto para a tela do cidadao.</p>
 */
public class RegraNegocioException extends RuntimeException {

    private final int codigo;
    private final Long referenciaId;

    public RegraNegocioException(int codigo, String mensagem) {
        this(codigo, mensagem, null);
    }

    public RegraNegocioException(int codigo, String mensagem, Long referenciaId) {
        super(mensagem);
        this.codigo = codigo;
        this.referenciaId = referenciaId;
    }

    public int getCodigo() {
        return codigo;
    }

    /** Id de outra ocorrencia citada na recusa (ex.: a duplicada que ja existe). */
    public Long getReferenciaId() {
        return referenciaId;
    }
}
