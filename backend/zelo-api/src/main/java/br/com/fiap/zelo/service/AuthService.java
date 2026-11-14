package br.com.fiap.zelo.service;

import br.com.fiap.zelo.dto.AuthDtos.AuthResponse;
import br.com.fiap.zelo.dto.AuthDtos.CadastroRequest;
import br.com.fiap.zelo.dto.AuthDtos.LoginRequest;
import br.com.fiap.zelo.dto.AuthDtos.PerfilRequest;
import br.com.fiap.zelo.dto.AuthDtos.TrocarSenhaRequest;
import br.com.fiap.zelo.dto.AuthDtos.UsuarioResponse;
import br.com.fiap.zelo.exception.RegraNegocioException;
import br.com.fiap.zelo.repository.UsuarioRepository;
import br.com.fiap.zelo.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cadastro, login e perfil do usuario. */
@Service
public class AuthService {

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UsuarioRepository usuarios, PasswordEncoder encoder, JwtService jwt) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    /**
     * Mensagem igual para e-mail inexistente e senha errada, para ninguem
     * descobrir pelo login quais e-mails estao cadastrados.
     */
    public AuthResponse login(LoginRequest req) {
        var cred = usuarios.credencialPorEmail(req.email())
                .filter(c -> encoder.matches(req.senha(), c.hash()))
                .orElseThrow(() -> new RegraNegocioException(20401, "E-mail ou senha incorretos."));
        return new AuthResponse(jwt.gerar(cred.id(), cred.papel()), perfil(cred.id()));
    }

    @Transactional
    public AuthResponse cadastrar(CadastroRequest req) {
        if (usuarios.emailEmUso(req.email())) {
            throw new RegraNegocioException(20120, "Este e-mail já tem cadastro. Tente entrar.");
        }
        long id = usuarios.inserir(req.nome(), req.email(), encoder.encode(req.senha()), req.bairroId());
        return new AuthResponse(jwt.gerar(id, "CIDADAO"), perfil(id));
    }

    public UsuarioResponse perfil(long id) {
        return usuarios.perfil(id)
                .orElseThrow(() -> new RegraNegocioException(20101, "Usuário não encontrado."));
    }

    /**
     * Nome e bairro. Cidadao precisa de bairro (e o padrao do mapa e do
     * painel); o gestor pode ficar sem.
     */
    @Transactional
    public UsuarioResponse atualizarPerfil(long id, PerfilRequest req) {
        String papel = usuarios.papel(id)
                .orElseThrow(() -> new RegraNegocioException(20101, "Usuário não encontrado."));
        if (req.bairroId() == null && !"GESTOR".equals(papel)) {
            throw new IllegalArgumentException("Escolha o seu bairro.");
        }
        if (req.bairroId() != null && !usuarios.bairroExiste(req.bairroId())) {
            throw new RegraNegocioException(20103, "Bairro não encontrado.");
        }
        usuarios.atualizarPerfil(id, req.nome(), req.bairroId());
        return perfil(id);
    }

    /** Confere a senha atual com BCrypt antes de gravar o hash da nova. */
    @Transactional
    public void trocarSenha(long id, TrocarSenhaRequest req) {
        String hashAtual = usuarios.hashSenha(id)
                .orElseThrow(() -> new RegraNegocioException(20101, "Usuário não encontrado."));
        if (!encoder.matches(req.senhaAtual(), hashAtual)) {
            throw new RegraNegocioException(20401, "A senha atual não confere.");
        }
        if (encoder.matches(req.novaSenha(), hashAtual)) {
            throw new IllegalArgumentException("A nova senha precisa ser diferente da atual.");
        }
        usuarios.atualizarSenha(id, encoder.encode(req.novaSenha()));
    }

    @Transactional
    public UsuarioResponse atualizarFonte(long id, boolean fonteGrande) {
        usuarios.atualizarFonteGrande(id, fonteGrande);
        return perfil(id);
    }
}
