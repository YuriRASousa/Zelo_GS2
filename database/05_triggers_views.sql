-- =====================================================================
-- ZELO | 05_triggers_views.sql
-- Triggers da linha do tempo e views usadas pela API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Primeira linha da linha do tempo: "Ocorrencia registrada".
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_zl_ocorrencia_ai
AFTER INSERT ON zl_ocorrencia
FOR EACH ROW
BEGIN
    INSERT INTO zl_historico (id_historico, id_ocorrencia, st_anterior, st_novo,
                              ds_comentario, id_usuario, dt_evento)
    VALUES (seq_zl_historico.NEXTVAL, :NEW.id_ocorrencia, NULL, :NEW.st_ocorrencia,
            'Ocorrência registrada pelo cidadão. Protocolo ' || :NEW.cd_protocolo || '.',
            :NEW.id_usuario, :NEW.dt_abertura);
END;
/

-- ---------------------------------------------------------------------
-- Toda troca de status vira uma linha do historico, com o comentario e
-- o gestor passados por pkg_zl_ocorrencia.atualizar_status. Se a troca
-- vier de fora da API (UPDATE direto), a linha ainda e gravada, so que
-- sem autor: a auditoria nao depende de quem chamou.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_zl_ocorrencia_status_au
AFTER UPDATE OF st_ocorrencia ON zl_ocorrencia
FOR EACH ROW
WHEN (NEW.st_ocorrencia <> OLD.st_ocorrencia)
BEGIN
    INSERT INTO zl_historico (id_historico, id_ocorrencia, st_anterior, st_novo,
                              ds_comentario, id_usuario)
    VALUES (seq_zl_historico.NEXTVAL, :NEW.id_ocorrencia, :OLD.st_ocorrencia,
            :NEW.st_ocorrencia,
            NVL(pkg_zl_ocorrencia.g_comentario, 'Status alterado.'),
            pkg_zl_ocorrencia.g_usuario);
END;
/

-- ---------------------------------------------------------------------
-- Impede que alguem altere protocolo ou autor depois de aberta: sao a
-- prova que o cidadao tem do pedido.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_zl_ocorrencia_imutavel_bu
BEFORE UPDATE OF cd_protocolo, id_usuario, dt_abertura ON zl_ocorrencia
FOR EACH ROW
BEGIN
    IF :NEW.cd_protocolo <> :OLD.cd_protocolo
       OR :NEW.id_usuario <> :OLD.id_usuario
       OR :NEW.dt_abertura <> :OLD.dt_abertura THEN
        RAISE_APPLICATION_ERROR(-20120, 'Protocolo, autor e data de abertura não podem ser alterados.');
    END IF;
END;
/

-- ---------------------------------------------------------------------
-- View do mapa e das listas: ja traz nomes, distancia nao (depende de
-- quem pergunta) e o indicador de atraso calculado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_zl_ocorrencia AS
SELECT o.id_ocorrencia,
       o.cd_protocolo,
       o.id_usuario,
       u.nm_usuario,
       o.id_categoria,
       c.nm_categoria,
       c.ds_icone,
       c.nm_orgao,
       o.id_bairro,
       b.nm_bairro,
       o.ds_titulo,
       o.ds_descricao,
       o.ds_endereco,
       o.nr_latitude,
       o.nr_longitude,
       o.ds_foto,
       o.fl_risco,
       o.fl_acessibilidade,
       o.st_ocorrencia,
       o.nr_prioridade,
       o.qt_apoios,
       o.dt_abertura,
       o.dt_prazo,
       o.dt_resolucao,
       CASE WHEN o.st_ocorrencia IN ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO')
             AND o.dt_prazo < SYSDATE THEN 'S' ELSE 'N' END AS fl_atrasada,
       av.nr_nota,
       av.ds_comentario AS ds_avaliacao
  FROM zl_ocorrencia o
  JOIN zl_usuario   u ON u.id_usuario   = o.id_usuario
  JOIN zl_categoria c ON c.id_categoria = o.id_categoria
  JOIN zl_bairro    b ON b.id_bairro    = o.id_bairro
  LEFT JOIN zl_avaliacao av ON av.id_ocorrencia = o.id_ocorrencia;

-- ---------------------------------------------------------------------
-- Ranking de problemas por bairro e categoria (painel de transparencia).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_zl_ranking_categoria AS
SELECT o.id_bairro,
       c.id_categoria,
       c.nm_categoria,
       c.ds_icone,
       COUNT(*) AS qt_total,
       SUM(CASE WHEN o.st_ocorrencia IN ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO')
                THEN 1 ELSE 0 END) AS qt_em_aberto,
       SUM(CASE WHEN o.st_ocorrencia = 'RESOLVIDA' THEN 1 ELSE 0 END) AS qt_resolvidas
  FROM zl_ocorrencia o
  JOIN zl_categoria c ON c.id_categoria = o.id_categoria
 GROUP BY o.id_bairro, c.id_categoria, c.nm_categoria, c.ds_icone;
