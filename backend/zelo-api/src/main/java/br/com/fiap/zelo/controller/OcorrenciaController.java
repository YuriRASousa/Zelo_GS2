package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.dto.OcorrenciaDtos.ApoioResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.AvaliacaoRequest;
import br.com.fiap.zelo.dto.OcorrenciaDtos.CriadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.DuplicadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.NovaOcorrenciaRequest;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaDetalhe;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaResumo;
import br.com.fiap.zelo.security.UsuarioLogado;
import br.com.fiap.zelo.service.OcorrenciaService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Funcionalidades do cidadao: registrar, ver no mapa, apoiar, acompanhar e avaliar. */
@RestController
@RequestMapping("/api/ocorrencias")
public class OcorrenciaController {

    private final OcorrenciaService service;

    public OcorrenciaController(OcorrenciaService service) {
        this.service = service;
    }

    @Operation(summary = "Ocorrencias para o mapa, da maior prioridade para a menor")
    @GetMapping
    public List<OcorrenciaResumo> listar(@RequestParam(required = false) Long bairroId,
                                         @RequestParam(defaultValue = "false") boolean incluirEncerradas,
                                         @RequestParam(required = false) Integer limite) {
        return service.listar(bairroId, incluirEncerradas, limite);
    }

    @Operation(summary = "Ocorrencias registradas pelo usuario logado")
    @GetMapping("/minhas")
    public List<OcorrenciaResumo> minhas(@AuthenticationPrincipal UsuarioLogado usuario) {
        return service.minhas(usuario.id());
    }

    @Operation(summary = "Ocorrencias que o usuario logado apoiou")
    @GetMapping("/apoiadas")
    public List<OcorrenciaResumo> apoiadas(@AuthenticationPrincipal UsuarioLogado usuario) {
        return service.apoiadas(usuario.id());
    }

    @Operation(summary = "Existe ocorrencia aberta igual a menos de 60 m? (204 quando nao existe)")
    @GetMapping("/duplicada")
    public ResponseEntity<DuplicadaResponse> duplicada(@RequestParam long categoriaId,
                                                       @RequestParam double lat, @RequestParam double lon) {
        return service.duplicada(categoriaId, lat, lon)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Operation(summary = "Detalhe com linha do tempo")
    @GetMapping("/{id}")
    public OcorrenciaDetalhe detalhe(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado usuario) {
        return service.detalhe(id, usuario == null ? null : usuario.id());
    }

    @Operation(summary = "Registrar problema (protocolo, prazo e prioridade calculados no PL/SQL)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CriadaResponse registrar(@AuthenticationPrincipal UsuarioLogado usuario,
                                    @Valid @RequestBody NovaOcorrenciaRequest req) {
        return service.registrar(usuario.id(), req);
    }

    @Operation(summary = "Apoiar: confirmar que tambem viu o problema")
    @PostMapping("/{id}/apoios")
    public ApoioResponse apoiar(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado usuario) {
        return service.apoiar(id, usuario.id());
    }

    @Operation(summary = "Avaliar o atendimento depois de resolvido")
    @PostMapping("/{id}/avaliacao")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void avaliar(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado usuario,
                        @Valid @RequestBody AvaliacaoRequest req) {
        service.avaliar(id, usuario.id(), req.nota(), req.comentario());
    }
}
