package br.com.fiap.zelo.config;

import br.com.fiap.zelo.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Regras de acesso:
 * <ul>
 *   <li>mapa, detalhe, catalogo, painel publico e fotos: abertos, porque a
 *       transparencia faz parte da proposta;</li>
 *   <li>registrar, apoiar, avaliar e perfil: cidadao logado;</li>
 *   <li>/api/gestor/**: somente papel GESTOR.</li>
 * </ul>
 */
@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final List<String> origens;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          @Value("${zelo.cors.allowed-origins}") List<String> origens) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.origens = origens;
    }

    @Bean
    public SecurityFilterChain filtros(HttpSecurity http) throws Exception {
        http
                .cors(c -> c.configurationSource(cors()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        // /error liberado: sem isso um 403 vira 401, porque o
                        // encaminhamento interno para a pagina de erro chega anonimo.
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/gestor/**").hasRole("GESTOR")
                        .requestMatchers(HttpMethod.GET, "/api/ocorrencias/minhas", "/api/ocorrencias/apoiadas").authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/api/ocorrencias", "/api/ocorrencias/*", "/api/ocorrencias/duplicada",
                                "/api/catalogo/**", "/api/painel/**", "/api/fotos/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * O login e conferido no AuthService contra o hash do banco. Este bean
     * so existe para o Spring nao criar um usuario em memoria com senha
     * gerada, que nunca seria usado.
     */
    @Bean
    public UserDetailsService semUsuarioEmMemoria() {
        return nome -> {
            throw new UsernameNotFoundException(nome);
        };
    }

    @Bean
    public CorsConfigurationSource cors() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(origens);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
