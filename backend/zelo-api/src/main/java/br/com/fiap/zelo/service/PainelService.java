package br.com.fiap.zelo.service;

import br.com.fiap.zelo.dto.PainelDtos.LogResponse;
import br.com.fiap.zelo.dto.PainelDtos.PainelResponse;
import br.com.fiap.zelo.dto.PainelDtos.RotinaResponse;
import br.com.fiap.zelo.repository.PainelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.util.List;

/** Painel de transparencia e rotinas automaticas. */
@Service
public class PainelService {

    private final PainelRepository repo;

    public PainelService(PainelRepository repo) {
        this.repo = repo;
    }

    public PainelResponse painel(Long bairroId) {
        String nome = bairroId == null ? "Cidade toda" : repo.nomeBairro(bairroId);
        if (bairroId != null && nome == null) {
            throw new IllegalArgumentException("Bairro não encontrado.");
        }
        return new PainelResponse(bairroId, nome, repo.agora(bairroId), repo.meses(bairroId),
                repo.categorias(bairroId), repo.cidadaos(bairroId));
    }

    /**
     * Mesma sequencia da rotina diaria do banco (atrasos, prioridades,
     * indicadores do mes), numa transacao so: ou tudo entra, ou nada.
     */
    @Transactional
    public RotinaResponse executarRotinas(String mes) {
        String alvo = (mes == null || mes.isBlank()) ? YearMonth.now().toString() : mes;
        return repo.executarRotinas(alvo);
    }

    public List<LogResponse> logs() {
        return repo.logs(20);
    }
}
