package br.com.fiap.zelo.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.apache.tomcat.util.http.InvalidParameterException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.stream.Collectors;

/**
 * Formato unico de erro para o app: {@code status}, {@code mensagem} pronta
 * para exibir e, quando houver, {@code referenciaId}.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErroResponse(Instant instante, int status, String mensagem, String caminho, Long referenciaId) {
    }

    /**
     * Codigo ORA para status HTTP. Inexistente vira 404, conflito de estado
     * vira 409, falta de permissao vira 403 e o restante e entrada invalida.
     */
    @ExceptionHandler(RegraNegocioException.class)
    public ResponseEntity<ErroResponse> regra(RegraNegocioException ex, HttpServletRequest req) {
        HttpStatus status = switch (ex.getCodigo()) {
            case 20101, 20102, 20103, 20115, 20124 -> HttpStatus.NOT_FOUND;
            case 20105, 20106, 20107, 20108, 20110, 20112, 20113, 20120, 20122 -> HttpStatus.CONFLICT;
            case 20109, 20111, 20119, 20121 -> HttpStatus.FORBIDDEN;
            // 20104, 20114, 20116, 20117 (motivo), 20118 (comentario), 20123 (foto
            // da solucao fora de RESOLVIDA) e 20201 caem no 400 abaixo.
            case 20401 -> HttpStatus.UNAUTHORIZED;
            default -> HttpStatus.BAD_REQUEST;
        };
        return montar(status, ex.getMessage(), req, ex.getReferenciaId());
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErroResponse> banco(DataAccessException ex, HttpServletRequest req) {
        RuntimeException traduzida = OracleErrors.traduzir(ex);
        if (traduzida instanceof RegraNegocioException regra) {
            return regra(regra, req);
        }
        log.error("Falha de banco em {}", req.getRequestURI(), ex);
        return montar(HttpStatus.SERVICE_UNAVAILABLE,
                "Não foi possível falar com o banco agora. Tente de novo em instantes.", req, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErroResponse> validacao(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return montar(HttpStatus.BAD_REQUEST, msg.isBlank() ? "Dados inválidos." : msg, req, null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErroResponse> corpoInvalido(HttpMessageNotReadableException ex, HttpServletRequest req) {
        return montar(HttpStatus.BAD_REQUEST, "Corpo da requisição inválido.", req, null);
    }

    /** Inclui parametro de URL com codificacao invalida (o Tomcat rejeita a decodificacao). */
    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
            InvalidParameterException.class})
    public ResponseEntity<ErroResponse> parametro(Exception ex, HttpServletRequest req) {
        return montar(HttpStatus.BAD_REQUEST, "Parâmetro inválido ou ausente na requisição.", req, null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErroResponse> rotaInexistente(NoResourceFoundException ex, HttpServletRequest req) {
        return montar(HttpStatus.NOT_FOUND, "Recurso não encontrado.", req, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErroResponse> negado(AccessDeniedException ex, HttpServletRequest req) {
        return montar(HttpStatus.FORBIDDEN, "Acesso negado.", req, null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErroResponse> argumento(IllegalArgumentException ex, HttpServletRequest req) {
        return montar(HttpStatus.BAD_REQUEST, ex.getMessage(), req, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErroResponse> geral(Exception ex, HttpServletRequest req) {
        log.error("Erro inesperado em {}", req.getRequestURI(), ex);
        return montar(HttpStatus.INTERNAL_SERVER_ERROR, "Erro inesperado no servidor.", req, null);
    }

    private ResponseEntity<ErroResponse> montar(HttpStatus status, String mensagem, HttpServletRequest req, Long ref) {
        return ResponseEntity.status(status)
                .body(new ErroResponse(Instant.now(), status.value(), mensagem, req.getRequestURI(), ref));
    }
}
