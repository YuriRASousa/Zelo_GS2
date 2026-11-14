package br.com.fiap.zelo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Ponto de entrada da API do Zelo.
 *
 * <p>A API e fina de proposito: autentica, valida a entrada, guarda a foto
 * e repassa as operacoes para os pacotes PL/SQL (PKG_ZL_OCORRENCIA e
 * PKG_ZL_INDICADOR), onde moram as regras de negocio.</p>
 */
@SpringBootApplication
public class ZeloApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZeloApiApplication.class, args);
    }
}
