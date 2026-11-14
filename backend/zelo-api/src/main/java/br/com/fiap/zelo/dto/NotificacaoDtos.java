package br.com.fiap.zelo.dto;

import java.time.LocalDateTime;

/** Notificacoes do sininho (geradas pelo PKG_ZL_NOTIFICACAO). */
public final class NotificacaoDtos {

    private NotificacaoDtos() {
    }

    /** {@code tipo}: STATUS, ATRASO, APOIO ou COMENTARIO. */
    public record NotificacaoResponse(
            long id, long ocorrenciaId, String protocolo, String tipo,
            String titulo, String mensagem, boolean lida, LocalDateTime data) {
    }

    public record NaoLidasResponse(int total) {
    }
}
