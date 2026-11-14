package br.com.fiap.zelo.security;

/**
 * Quem esta chamando a API, lido do proprio JWT.
 *
 * <p>Como id e papel ja vem assinados no token, o filtro nao precisa ir ao
 * banco a cada requisicao: uma consulta a menos por chamada, o que pesa
 * num banco remoto como o da FIAP.</p>
 */
public record UsuarioLogado(long id, String papel) {

    public boolean gestor() {
        return "GESTOR".equals(papel);
    }
}
