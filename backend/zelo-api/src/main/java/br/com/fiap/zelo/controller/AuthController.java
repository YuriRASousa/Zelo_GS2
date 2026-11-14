package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.dto.AuthDtos.AuthResponse;
import br.com.fiap.zelo.dto.AuthDtos.CadastroRequest;
import br.com.fiap.zelo.dto.AuthDtos.LoginRequest;
import br.com.fiap.zelo.dto.AuthDtos.PreferenciasRequest;
import br.com.fiap.zelo.dto.AuthDtos.UsuarioResponse;
import br.com.fiap.zelo.security.UsuarioLogado;
import br.com.fiap.zelo.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Cadastro, login e perfil. */
@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @Operation(summary = "Entrar com e-mail e senha")
    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return service.login(req);
    }

    @Operation(summary = "Criar conta de cidadao")
    @PostMapping("/auth/cadastro")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse cadastro(@Valid @RequestBody CadastroRequest req) {
        return service.cadastrar(req);
    }

    @Operation(summary = "Perfil e numeros de participacao do usuario logado")
    @GetMapping("/usuarios/me")
    public UsuarioResponse eu(@AuthenticationPrincipal UsuarioLogado usuario) {
        return service.perfil(usuario.id());
    }

    @Operation(summary = "Liga ou desliga a fonte ampliada (acessibilidade)")
    @PatchMapping("/usuarios/me/preferencias")
    public UsuarioResponse preferencias(@AuthenticationPrincipal UsuarioLogado usuario,
                                        @RequestBody PreferenciasRequest req) {
        return service.atualizarFonte(usuario.id(), req.fonteGrande());
    }
}
