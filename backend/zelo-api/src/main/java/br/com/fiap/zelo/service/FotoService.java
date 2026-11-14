package br.com.fiap.zelo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Guarda as fotos das ocorrencias em disco. No banco fica so o nome do
 * arquivo: imagem dentro de tabela deixaria cada consulta da lista mais
 * pesada e o backup do schema maior sem necessidade.
 */
@Service
public class FotoService {

    private static final Pattern NOME_VALIDO = Pattern.compile("^[0-9a-f-]{36}\\.(jpg|png)$");

    private final Path pasta;
    private final int tamanhoMaximo;

    public FotoService(@Value("${zelo.fotos.pasta}") String pasta,
                       @Value("${zelo.fotos.tamanho-maximo-bytes}") int tamanhoMaximo) throws IOException {
        this.pasta = Path.of(pasta).toAbsolutePath().normalize();
        this.tamanhoMaximo = tamanhoMaximo;
        Files.createDirectories(this.pasta);
    }

    /** Imagem ja decodificada e conferida, pronta para gravar. */
    public record FotoValidada(byte[] bytes, String extensao) {
    }

    /**
     * Decodifica e confere tamanho e tipo pelo conteudo (assinatura do
     * arquivo), nao pela extensao que o cliente diz. Devolve vazio quando
     * nao veio foto.
     */
    public Optional<FotoValidada> validar(String base64) {
        if (base64 == null || base64.isBlank()) {
            return Optional.empty();
        }
        String limpo = base64.contains(",") ? base64.substring(base64.indexOf(',') + 1) : base64;
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(limpo.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("A foto enviada está corrompida.");
        }
        if (bytes.length > tamanhoMaximo) {
            throw new IllegalArgumentException("A foto passou de " + (tamanhoMaximo / 1000) + " KB.");
        }
        if (bytes.length > 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return Optional.of(new FotoValidada(bytes, "jpg"));
        }
        if (bytes.length > 8 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
            return Optional.of(new FotoValidada(bytes, "png"));
        }
        throw new IllegalArgumentException("Envie a foto em JPG ou PNG.");
    }

    public String gravar(FotoValidada foto) {
        return gravar(foto, nomeNovo(foto));
    }

    /**
     * Nome aleatorio para a foto, sem gravar ainda. Permite registrar o nome
     * no banco primeiro e so escrever o arquivo se o banco aceitar: recusa
     * de regra nao deixa arquivo orfao no disco.
     */
    public String nomeNovo(FotoValidada foto) {
        return UUID.randomUUID() + "." + foto.extensao();
    }

    public String gravar(FotoValidada foto, String nome) {
        if (!NOME_VALIDO.matcher(nome).matches()) {
            throw new IllegalArgumentException("Nome de foto inválido.");
        }
        try {
            Files.write(pasta.resolve(nome), foto.bytes());
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível salvar a foto.", e);
        }
        return nome;
    }

    public void apagar(String nome) {
        try {
            Files.deleteIfExists(pasta.resolve(nome));
        } catch (IOException ignorado) {
            // arquivo orfao nao impede nada; some na proxima limpeza
        }
    }

    /** Caminho do arquivo, so para nomes gerados por esta classe (sem path traversal). */
    public Optional<Path> localizar(String nome) {
        if (nome == null || !NOME_VALIDO.matcher(nome).matches()) {
            return Optional.empty();
        }
        Path arquivo = pasta.resolve(nome).normalize();
        return arquivo.startsWith(pasta) && Files.exists(arquivo) ? Optional.of(arquivo) : Optional.empty();
    }
}
