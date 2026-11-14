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

    /** Perfil com os numeros de participacao do cidadao. */
    public record UsuarioResponse(
            long id, String nome, String email, String papel,
            Long bairroId, String bairro, int pontos, boolean fonteGrande,
            int registradas, int apoios, int resolvidas) {
    }

    public record AuthResponse(String token, UsuarioResponse usuario) {
    }
}
