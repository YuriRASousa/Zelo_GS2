package br.com.fiap.zelo.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

/** Entradas e saidas das ocorrencias. */
public final class OcorrenciaDtos {

    private OcorrenciaDtos() {
    }

    public record NovaOcorrenciaRequest(
            @NotNull(message = "Escolha a categoria.") Long categoriaId,
            @NotNull(message = "Escolha o bairro.") Long bairroId,
            @NotBlank(message = "Dê um título ao problema.") @Size(max = 120, message = "Título com até 120 letras.") String titulo,
            @Size(max = 1000, message = "Descrição com até 1000 letras.") String descricao,
            @Size(max = 200) String endereco,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            boolean risco,
            boolean acessibilidade,
            /** JPEG ja reduzido pelo app, em base64 (sem o prefixo data:). Opcional. */
            String fotoBase64) {
    }

    public record CriadaResponse(long id, String protocolo) {
    }

    public record ApoioResponse(int apoios, int prioridade) {
    }

    public record StatusRequest(
            @NotBlank(message = "Informe o novo status.") String status,
            @Size(max = 500) String comentario) {
    }

    public record AvaliacaoRequest(
            @NotNull @Min(value = 1, message = "Nota de 1 a 5.") @Max(value = 5, message = "Nota de 1 a 5.") Integer nota,
            @Size(max = 500) String comentario) {
    }

    /** Item da lista e do mapa: sem descricao nem historico, para a resposta ficar leve. */
    public record OcorrenciaResumo(
            long id, String protocolo, String titulo,
            long categoriaId, String categoria, String icone,
            long bairroId, String bairro,
            double latitude, double longitude,
            String status, int prioridade, int apoios,
            boolean risco, boolean acessibilidade, boolean atrasada,
            boolean temFoto, LocalDateTime abertura, LocalDateTime prazo) {
    }

    public record HistoricoResponse(
            LocalDateTime data, String statusAnterior, String statusNovo, String comentario, String autor) {
    }

    public record OcorrenciaDetalhe(
            long id, String protocolo, String titulo, String descricao, String endereco,
            long categoriaId, String categoria, String icone, String orgao,
            long bairroId, String bairro,
            double latitude, double longitude, String foto,
            String status, int prioridade, int apoios,
            boolean risco, boolean acessibilidade, boolean atrasada,
            LocalDateTime abertura, LocalDateTime prazo, LocalDateTime resolucao,
            String autor, boolean souAutor, boolean jaApoiei,
            Integer nota, String comentarioAvaliacao,
            List<HistoricoResponse> historico) {
    }

    public record DuplicadaResponse(Long id, String protocolo, String titulo) {
    }
}
