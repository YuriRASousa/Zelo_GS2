package br.com.fiap.zelo.controller;

import br.com.fiap.zelo.dto.CatalogoDtos.BairroResponse;
import br.com.fiap.zelo.dto.CatalogoDtos.CategoriaResponse;
import br.com.fiap.zelo.repository.CatalogoRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Bairros e categorias. Respondem com Cache-Control de 1 hora: sao tabelas
 * que quase nunca mudam, entao o app e o navegador reaproveitam a resposta.
 */
@RestController
@RequestMapping("/api/catalogo")
public class CatalogoController {

    private static final CacheControl UMA_HORA = CacheControl.maxAge(Duration.ofHours(1)).cachePublic();

    private final CatalogoRepository repo;

    public CatalogoController(CatalogoRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/bairros")
    public ResponseEntity<List<BairroResponse>> bairros() {
        return ResponseEntity.ok().cacheControl(UMA_HORA).body(repo.bairros());
    }

    @GetMapping("/categorias")
    public ResponseEntity<List<CategoriaResponse>> categorias() {
        return ResponseEntity.ok().cacheControl(UMA_HORA).body(repo.categorias());
    }
}
