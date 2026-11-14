package br.com.fiap.zelo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Entradas e saidas de cadastro, login e perfil. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.") String email,
            @NotBlank(message = "Informe a senha.") String senha) {
    }

    public record CadastroRequest(
            @NotBlank(message = "Informe o seu nome.") @Size(min = 3, max = 100, message = "Nome com 3 a 100 letras.") String nome,
            @NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.") String email,
            @NotBlank(message = "Crie uma senha.") @Size(min = 6, max = 60, message = "A senha precisa de pelo menos 6 caracteres.") String senha,
            @NotNull(message = "Escolha o seu bairro.") Long bairroId) {
    }

    public record PreferenciasRequest(boolean fonteGrande) {
    }

    /** Edicao do perfil. Bairro e obrigatorio para cidadao (o gestor pode ficar sem). */
    public record PerfilRequest(
            @NotBlank(message = "Informe o seu nome.") @Size(min = 3, max = 100, message = "Nome com 3 a 100 letras.") String nome,
            Long bairroId) {
    }

    public record TrocarSenhaRequest(
            @NotBlank(message = "Informe a senha atual.") String senhaAtual,
            @NotBlank(message = "Crie a nova senha.") @Size(min = 6, max = 60, message = "A nova senha precisa ter de 6 a 60 caracteres.") String novaSenha) {
    }

    /** Perfil com os numeros de participacao do cidadao e as notificacoes nao lidas. */
    public record UsuarioResponse(
            long id, String nome, String email, String papel,
            Long bairroId, String bairro, int pontos, boolean fonteGrande,
            int registradas, int apoios, int resolvidas, int naoLidas) {
    }

    public record AuthResponse(String token, UsuarioResponse usuario) {
    }
}
