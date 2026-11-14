package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.dto.NotificacaoDtos.NaoLidasResponse;
import br.com.fiap.zelo.dto.NotificacaoDtos.NotificacaoResponse;
import br.com.fiap.zelo.security.UsuarioLogado;
import br.com.fiap.zelo.service.NotificacaoService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Notificacoes do usuario logado (cidadao ou gestor). */
@RestController
@RequestMapping("/api/notificacoes")
public class NotificacaoController {

    private final NotificacaoService service;

    public NotificacaoController(NotificacaoService service) {
        this.service = service;
    }

    @Operation(summary = "Ultimas 50 notificacoes, das mais novas para as mais antigas")
    @GetMapping
    public List<NotificacaoResponse> listar(@AuthenticationPrincipal UsuarioLogado usuario) {
        return service.listar(usuario.id());
    }

    @Operation(summary = "Quantidade de notificacoes nao lidas (contador do sininho)")
    @GetMapping("/nao-lidas")
    public NaoLidasResponse naoLidas(@AuthenticationPrincipal UsuarioLogado usuario) {
        return service.naoLidas(usuario.id());
    }

    @Operation(summary = "Marcar uma notificacao como lida (404 se nao for do usuario)")
    @PostMapping("/{id}/lida")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marcarLida(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado usuario) {
        service.marcarLida(id, usuario.id());
    }

    @Operation(summary = "Marcar todas as notificacoes como lidas")
    @PostMapping("/lidas")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marcarTodas(@AuthenticationPrincipal UsuarioLogado usuario) {
        service.marcarTodas(usuario.id());
    }
}
