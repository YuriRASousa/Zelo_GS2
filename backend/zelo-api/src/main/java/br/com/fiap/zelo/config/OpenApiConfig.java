package br.com.fiap.zelo.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Documentacao interativa em /swagger-ui.html, com botao para colar o JWT. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI zeloOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Zelo API")
                        .description("Zeladoria urbana centrada no cidadao - Global Solution 2 (FIAP)")
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList("bearer"))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }
}
