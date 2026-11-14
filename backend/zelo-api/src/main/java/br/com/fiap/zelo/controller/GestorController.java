package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaDetalhe;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaResumo;
import br.com.fiap.zelo.dto.OcorrenciaDtos.StatusRequest;
import br.com.fiap.zelo.dto.PainelDtos.LogResponse;
import br.com.fiap.zelo.dto.PainelDtos.RotinaResponse;
import br.com.fiap.zelo.security.UsuarioLogado;
import br.com.fiap.zelo.service.OcorrenciaService;
import br.com.fiap.zelo.service.PainelService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Area do servidor da prefeitura (papel GESTOR). */
@RestController
@RequestMapping("/api/gestor")
public class GestorController {

    private final OcorrenciaService ocorrencias;
    private final PainelService painel;

    public GestorController(OcorrenciaService ocorrencias, PainelService painel) {
        this.ocorrencias = ocorrencias;
        this.painel = painel;
    }

    @Operation(summary = "Fila de atendimento ordenada pela prioridade calculada no banco")
    @GetMapping("/fila")
    public List<OcorrenciaResumo> fila() {
        return ocorrencias.fila();
    }

    @Operation(summary = "Avancar o status (a linha do tempo e gravada pelo trigger)")
    @PatchMapping("/ocorrencias/{id}/status")
    public OcorrenciaDetalhe status(@PathVariable long id, @AuthenticationPrincipal UsuarioLogado gestor,
                                    @Valid @RequestBody StatusRequest req) {
        return ocorrencias.atualizarStatus(id, gestor.id(), req.status(), req.comentario());
    }

    @Operation(summary = "Rodar agora a rotina diaria: atrasos, prioridades e indicadores do mes")
    @PostMapping("/rotinas")
    public RotinaResponse rotinas(@RequestParam(required = false) String mes) {
        return painel.executarRotinas(mes);
    }

    @Operation(summary = "Ultimas execucoes registradas em ZL_LOG_ROTINA")
    @GetMapping("/logs")
    public List<LogResponse> logs() {
        return painel.logs();
    }
}
