package br.com.fiap.zelo.service;

import br.com.fiap.zelo.dto.NotificacaoDtos.NaoLidasResponse;
import br.com.fiap.zelo.dto.NotificacaoDtos.NotificacaoResponse;
import br.com.fiap.zelo.repository.NotificacaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Sininho do app: lista, contador e marcar como lida. */
@Service
public class NotificacaoService {

    /** O app mostra as ultimas 50; as mais antigas continuam no banco. */
    private static final int LIMITE = 50;

    private final NotificacaoRepository repo;

    public NotificacaoService(NotificacaoRepository repo) {
        this.repo = repo;
    }

    public List<NotificacaoResponse> listar(long usuarioId) {
        return repo.doUsuario(usuarioId, LIMITE);
    }

    public NaoLidasResponse naoLidas(long usuarioId) {
        return new NaoLidasResponse(repo.naoLidas(usuarioId));
    }

    /** Notificacao de outra pessoa da 404 (-20124), sem revelar que existe. */
    @Transactional
    public void marcarLida(long notificacaoId, long usuarioId) {
        repo.marcarLida(notificacaoId, usuarioId);
    }

    @Transactional
    public void marcarTodas(long usuarioId) {
        repo.marcarTodas(usuarioId);
    }
}
