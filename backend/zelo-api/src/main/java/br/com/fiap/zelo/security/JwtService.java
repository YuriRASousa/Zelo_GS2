package br.com.fiap.zelo.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** Emite e valida os tokens JWT (HMAC-SHA256) da API. */
@Service
public class JwtService {

    private final SecretKey chave;
    private final long validadeMs;

    public JwtService(@Value("${zelo.jwt.secret}") String segredo,
                      @Value("${zelo.jwt.expiration-ms}") long validadeMs) {
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
        this.validadeMs = validadeMs;
    }

    /** Token com o id do usuario no subject e o papel numa claim. */
    public String gerar(long idUsuario, String papel) {
        Date agora = new Date();
        return Jwts.builder()
                .subject(Long.toString(idUsuario))
                .claim("papel", papel)
                .issuedAt(agora)
                .expiration(new Date(agora.getTime() + validadeMs))
                .signWith(chave, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Le o token e confere assinatura e validade. Lanca excecao do jjwt
     * quando ele foi adulterado ou expirou.
     */
    public UsuarioLogado ler(String token) {
        Claims claims = Jwts.parser().verifyWith(chave).build()
                .parseSignedClaims(token).getPayload();
        return new UsuarioLogado(Long.parseLong(claims.getSubject()), claims.get("papel", String.class));
    }
}
