package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.service.FotoService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Entrega as fotos. O nome do arquivo e aleatorio e nunca muda, entao a
 * resposta pode ficar em cache por 30 dias: o app baixa cada foto uma vez.
 */
@RestController
@RequestMapping("/api/fotos")
public class FotoController {

    private final FotoService fotos;

    public FotoController(FotoService fotos) {
        this.fotos = fotos;
    }

    @GetMapping("/{nome}")
    public ResponseEntity<Resource> foto(@PathVariable String nome) {
        return fotos.localizar(nome)
                .<ResponseEntity<Resource>>map(caminho -> ResponseEntity.ok()
                        .contentType(nome.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic().immutable())
                        .body(new FileSystemResource(caminho)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
