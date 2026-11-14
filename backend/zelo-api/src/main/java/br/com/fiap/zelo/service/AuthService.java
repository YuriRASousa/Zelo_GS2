package br.com.fiap.zelo.service;

import br.com.fiap.zelo.dto.AuthDtos.AuthResponse;
import br.com.fiap.zelo.dto.AuthDtos.CadastroRequest;
import br.com.fiap.zelo.dto.AuthDtos.LoginRequest;
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

    @Transactional
    public UsuarioResponse atualizarFonte(long id, boolean fonteGrande) {
        usuarios.atualizarFonteGrande(id, fonteGrande);
        return perfil(id);
    }
}
