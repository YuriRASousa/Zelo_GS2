package br.com.fiap.zelo.service;

import br.com.fiap.zelo.dto.OcorrenciaDtos.ApoioResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.CriadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.DuplicadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.NovaOcorrenciaRequest;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaDetalhe;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaResumo;
import br.com.fiap.zelo.exception.RegraNegocioException;
import br.com.fiap.zelo.repository.OcorrenciaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/** Casos de uso do cidadao e do gestor sobre as ocorrencias. */
@Service
public class OcorrenciaService {

    /** Teto da lista do mapa: o celular nunca recebe mais que isso de uma vez. */
    private static final int LIMITE_MAXIMO = 200;

    private final OcorrenciaRepository repo;
    private final FotoService fotos;

    public OcorrenciaService(OcorrenciaRepository repo, FotoService fotos) {
        this.repo = repo;
        this.fotos = fotos;
    }

    public List<OcorrenciaResumo> listar(Long bairroId, boolean incluirEncerradas, Integer limite) {
        int n = limite == null ? 100 : Math.max(1, Math.min(limite, LIMITE_MAXIMO));
        return repo.listar(bairroId, incluirEncerradas, n);
    }

    public OcorrenciaDetalhe detalhe(long id, Long usuarioId) {
        return repo.detalhe(id, usuarioId)
                .orElseThrow(() -> new RegraNegocioException(20115, "Ocorrência não encontrada."));
    }

    public List<OcorrenciaResumo> minhas(long usuarioId) {
        return repo.doUsuario(usuarioId);
    }

    public List<OcorrenciaResumo> apoiadas(long usuarioId) {
        return repo.apoiadasPor(usuarioId);
    }

    public Optional<DuplicadaResponse> duplicada(long categoriaId, double lat, double lon) {
        return repo.duplicada(categoriaId, lat, lon);
    }

    /**
     * A foto e conferida antes de tocar no banco (falha barata primeiro).
     * Se gravar o arquivo der errado, a transacao desfaz a ocorrencia; se o
     * banco falhar depois do arquivo gravado, o arquivo e apagado.
     */
    @Transactional
    public CriadaResponse registrar(long usuarioId, NovaOcorrenciaRequest req) {
        var foto = fotos.validar(req.fotoBase64());
        CriadaResponse criada = repo.registrar(usuarioId, req);
        if (foto.isPresent()) {
            String nome = fotos.gravar(foto.get());
            try {
                repo.definirFoto(criada.id(), nome);
            } catch (RuntimeException e) {
                fotos.apagar(nome);
                throw e;
            }
        }
        return criada;
    }

    @Transactional
    public ApoioResponse apoiar(long ocorrenciaId, long usuarioId) {
        return repo.apoiar(ocorrenciaId, usuarioId);
    }

    @Transactional
    public void avaliar(long ocorrenciaId, long usuarioId, int nota, String comentario) {
        repo.avaliar(ocorrenciaId, usuarioId, nota, comentario);
    }

    public List<OcorrenciaResumo> fila() {
        return repo.fila();
    }

    @Transactional
    public OcorrenciaDetalhe atualizarStatus(long ocorrenciaId, long gestorId, String status, String comentario) {
        repo.atualizarStatus(ocorrenciaId, gestorId, status, comentario);
        return detalhe(ocorrenciaId, gestorId);
    }
}
