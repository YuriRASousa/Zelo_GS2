package br.com.fiap.zelo.service;

import br.com.fiap.zelo.dto.OcorrenciaDtos.ApoioResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.CriadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.DuplicadaResponse;
import br.com.fiap.zelo.dto.OcorrenciaDtos.NovaOcorrenciaRequest;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaDetalhe;
import br.com.fiap.zelo.dto.OcorrenciaDtos.OcorrenciaResumo;
import br.com.fiap.zelo.exception.RegraNegocioException;
import br.com.fiap.zelo.repository.OcorrenciaRepository;
import br.com.fiap.zelo.security.UsuarioLogado;
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

    /** Busca livre maior que isso nao e titulo nem protocolo. */
    private static final int BUSCA_MAXIMA = 80;

    public List<OcorrenciaResumo> listar(Long bairroId, Long categoriaId, String busca,
                                         boolean incluirEncerradas, Integer limite) {
        int n = limite == null ? 100 : Math.max(1, Math.min(limite, LIMITE_MAXIMO));
        String termo = busca == null || busca.isBlank() ? null : busca.trim();
        if (termo != null && termo.length() > BUSCA_MAXIMA) {
            throw new IllegalArgumentException("A busca aceita até " + BUSCA_MAXIMA + " letras.");
        }
        return repo.listar(bairroId, categoriaId, termo, incluirEncerradas, n);
    }

    /** Detalhe visto por quem chama ({@code usuario} nulo = visitante sem login). */
    public OcorrenciaDetalhe detalhe(long id, UsuarioLogado usuario) {
        return detalhe(id, usuario == null ? null : usuario.id(), usuario != null && usuario.gestor());
    }

    private OcorrenciaDetalhe detalhe(long id, Long usuarioId, boolean gestor) {
        return repo.detalhe(id, usuarioId, gestor)
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

    /** Comentario na linha do tempo; quem pode e validado no pkg_zl_ocorrencia.comentar. */
    @Transactional
    public void comentar(long ocorrenciaId, long usuarioId, String texto) {
        repo.comentar(ocorrenciaId, usuarioId, texto);
    }

    /** O autor desiste enquanto a ocorrencia ainda esta ABERTA. */
    @Transactional
    public OcorrenciaDetalhe cancelarPeloAutor(long ocorrenciaId, UsuarioLogado usuario, String motivo) {
        repo.cancelarPeloAutor(ocorrenciaId, usuario.id(), motivo);
        return detalhe(ocorrenciaId, usuario);
    }

    public List<OcorrenciaResumo> fila(Long bairroId, Long categoriaId, boolean somenteAtrasadas) {
        return repo.fila(bairroId, categoriaId, somenteAtrasadas);
    }

    /**
     * A foto da solucao segue o mesmo caminho da foto do registro: conferida
     * antes de tudo; o nome vai para o banco e o arquivo so e escrito depois
     * que a procedure aceitou a troca (se ela recusar, nada fica no disco).
     * Se a gravacao do arquivo falhar, a excecao desfaz a transacao.
     */
    @Transactional
    public OcorrenciaDetalhe atualizarStatus(long ocorrenciaId, UsuarioLogado gestor, String status,
                                             String comentario, String fotoSolucaoBase64) {
        var foto = fotos.validar(fotoSolucaoBase64);
        String nome = foto.map(fotos::nomeNovo).orElse(null);
        repo.atualizarStatus(ocorrenciaId, gestor.id(), status, comentario, nome);
        if (foto.isPresent()) {
            fotos.gravar(foto.get(), nome);
        }
        try {
            return detalhe(ocorrenciaId, gestor);
        } catch (RuntimeException e) {
            if (nome != null) {
                fotos.apagar(nome);
            }
            throw e;
        }
    }
}
