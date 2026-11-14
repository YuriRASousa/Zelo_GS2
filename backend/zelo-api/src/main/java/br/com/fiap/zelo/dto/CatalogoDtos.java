package br.com.fiap.zelo.dto;

/** Tabelas de apoio que o app carrega uma vez e guarda em memoria. */
public final class CatalogoDtos {

    private CatalogoDtos() {
    }

    public record BairroResponse(long id, String nome, String regiao, double latitude, double longitude) {
    }

    public record CategoriaResponse(long id, String nome, String icone, int prazoDias, int peso, String orgao) {
    }
}
