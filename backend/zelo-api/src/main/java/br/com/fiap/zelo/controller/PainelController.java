package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.dto.PainelDtos.PainelResponse;
import br.com.fiap.zelo.service.PainelService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Painel publico de transparencia. */
@RestController
@RequestMapping("/api/painel")
public class PainelController {

    private final PainelService service;

    public PainelController(PainelService service) {
        this.service = service;
    }

    @Operation(summary = "Numeros do bairro (ou da cidade, sem bairroId)")
    @GetMapping
    public PainelResponse painel(@RequestParam(required = false) Long bairroId) {
        return service.painel(bairroId);
    }
}
