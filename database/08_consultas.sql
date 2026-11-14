-- =====================================================================
-- ZELO | 08_consultas.sql
-- Consultas para conferir o banco e para a demonstracao em video.
-- =====================================================================

-- 1. Fila do gestor: o que atender primeiro
SELECT cd_protocolo, nm_categoria, nm_bairro, st_ocorrencia,
       nr_prioridade, qt_apoios, fl_risco, fl_acessibilidade, fl_atrasada,
       TO_CHAR(dt_prazo, 'DD/MM/YYYY') AS prazo
  FROM vw_zl_ocorrencia
 WHERE st_ocorrencia IN ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO')
 ORDER BY nr_prioridade DESC, dt_abertura;

-- 2. Linha do tempo de uma ocorrencia
SELECT h.dt_evento, h.st_anterior, h.st_novo, h.ds_comentario, u.nm_usuario
  FROM zl_historico h
  LEFT JOIN zl_usuario u ON u.id_usuario = h.id_usuario
 WHERE h.id_ocorrencia = 1
 ORDER BY h.dt_evento, h.id_historico;

-- 3. Indicadores por bairro (gerados pela rotina)
SELECT b.nm_bairro, i.cd_mes, i.qt_abertas, i.qt_resolvidas, i.qt_atrasadas,
       i.nr_tempo_medio, i.pc_no_prazo, i.nr_nota_media, i.nr_taxa_mil_hab
  FROM zl_indicador i
  JOIN zl_bairro b ON b.id_bairro = i.id_bairro
 ORDER BY i.cd_mes DESC, b.nm_bairro;

-- 4. Problemas mais relatados em cada bairro
SELECT b.nm_bairro, r.nm_categoria, r.qt_total, r.qt_em_aberto, r.qt_resolvidas
  FROM vw_zl_ranking_categoria r
  JOIN zl_bairro b ON b.id_bairro = r.id_bairro
 ORDER BY b.nm_bairro, r.qt_total DESC;

-- 5. Ranking de engajamento dos cidadaos
SELECT nm_usuario, nr_pontos,
       (SELECT COUNT(*) FROM zl_ocorrencia o WHERE o.id_usuario = u.id_usuario) AS registradas,
       (SELECT COUNT(*) FROM zl_apoio a WHERE a.id_usuario = u.id_usuario) AS apoios
  FROM zl_usuario u
 WHERE tp_papel = 'CIDADAO'
 ORDER BY nr_pontos DESC;

-- 6. Percentual resolvido no prazo por bairro (function do pacote)
SELECT nm_bairro, pkg_zl_indicador.pc_no_prazo_bairro(id_bairro) AS pc_no_prazo
  FROM zl_bairro
 ORDER BY 2 DESC NULLS LAST;

-- 7. Ultimas execucoes das rotinas
SELECT dt_execucao, nm_rotina, tp_nivel, qt_linhas, ds_mensagem
  FROM zl_log_rotina
 ORDER BY id_log DESC
 FETCH FIRST 15 ROWS ONLY;
