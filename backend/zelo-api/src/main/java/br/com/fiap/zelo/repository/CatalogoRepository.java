package br.com.fiap.zelo.repository;

import br.com.fiap.zelo.dto.CatalogoDtos.BairroResponse;
import br.com.fiap.zelo.dto.CatalogoDtos.CategoriaResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Bairros e categorias (tabelas pequenas, quase nunca mudam). */
@Repository
public class CatalogoRepository {

    private final JdbcTemplate jdbc;

    public CatalogoRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<BairroResponse> bairros() {
        return jdbc.query("""
                SELECT id_bairro, nm_bairro, nm_regiao, nr_latitude, nr_longitude
                  FROM zl_bairro ORDER BY nm_bairro
                """, (rs, i) -> new BairroResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getDouble(4), rs.getDouble(5)));
    }

    public List<CategoriaResponse> categorias() {
        return jdbc.query("""
                SELECT id_categoria, nm_categoria, ds_icone, nr_prazo_dias, nr_peso, nm_orgao
                  FROM zl_categoria ORDER BY nr_peso DESC, nm_categoria
                """, (rs, i) -> new CategoriaResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getInt(4), rs.getInt(5), rs.getString(6)));
    }
}
