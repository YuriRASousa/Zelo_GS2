-- =====================================================================
-- ZELO | 04_pkg_indicador.sql
-- Rotinas automaticas de acompanhamento e transparencia:
--   * recalcular_prioridades: reordena a fila (o tempo de espera conta)
--   * detectar_atrasos: marca na linha do tempo quem estourou o prazo
--   * gerar_indicadores: consolida o mes por bairro para o painel publico
--   * executar_rotina_diaria: as tres em sequencia, para o agendador
--
-- Erros de aplicacao:
--   -20201 mes em formato invalido (esperado AAAA-MM)
-- =====================================================================

CREATE OR REPLACE PACKAGE pkg_zl_indicador AS

    -- Marcador que identifica a linha de historico gerada por atraso.
    c_marca_atraso CONSTANT VARCHAR2(10) := '[ATRASO]';

    PROCEDURE recalcular_prioridades(o_qt_atualizadas OUT NUMBER);

    PROCEDURE detectar_atrasos(o_qt_novos_atrasos OUT NUMBER);

    PROCEDURE gerar_indicadores(p_mes IN VARCHAR2, o_qt_bairros OUT NUMBER);

    PROCEDURE executar_rotina_diaria;

    -- Percentual de ocorrencias resolvidas dentro do prazo, por bairro
    -- (NULL quando nada foi resolvido ainda). Usado nas consultas.
    FUNCTION pc_no_prazo_bairro(p_id_bairro NUMBER) RETURN NUMBER;

END pkg_zl_indicador;
/

CREATE OR REPLACE PACKAGE BODY pkg_zl_indicador AS

    -- -----------------------------------------------------------------
    -- Processa em lotes de 200 (BULK COLLECT ... LIMIT): a memoria da
    -- sessao fica constante mesmo com milhares de ocorrencias abertas, e
    -- o FORALL manda cada lote ao motor SQL de uma vez so.
    -- -----------------------------------------------------------------
    PROCEDURE recalcular_prioridades(o_qt_atualizadas OUT NUMBER) IS
        TYPE t_ids    IS TABLE OF zl_ocorrencia.id_ocorrencia%TYPE;
        TYPE t_notas  IS TABLE OF zl_ocorrencia.nr_prioridade%TYPE;
        v_ids   t_ids;
        v_notas t_notas := t_notas();

        CURSOR c_abertas IS
            SELECT id_ocorrencia
              FROM zl_ocorrencia
             WHERE st_ocorrencia IN ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO');
    BEGIN
        o_qt_atualizadas := 0;
        OPEN c_abertas;
        LOOP
            FETCH c_abertas BULK COLLECT INTO v_ids LIMIT 200;
            EXIT WHEN v_ids.COUNT = 0;

            v_notas.DELETE;
            v_notas.EXTEND(v_ids.COUNT);
            FOR i IN 1 .. v_ids.COUNT LOOP
                v_notas(i) := pkg_zl_ocorrencia.calcular_prioridade(v_ids(i));
            END LOOP;

            FORALL i IN 1 .. v_ids.COUNT
                UPDATE zl_ocorrencia
                   SET nr_prioridade = v_notas(i)
                 WHERE id_ocorrencia = v_ids(i)
                   AND nr_prioridade <> v_notas(i);

            o_qt_atualizadas := o_qt_atualizadas + SQL%ROWCOUNT;
        END LOOP;
        CLOSE c_abertas;

        pkg_zl_log.registrar('RECALCULAR_PRIORIDADES',
            o_qt_atualizadas || ' ocorrencia(s) mudaram de prioridade.', o_qt_atualizadas);
    EXCEPTION
        WHEN OTHERS THEN
            IF c_abertas%ISOPEN THEN CLOSE c_abertas; END IF;
            pkg_zl_log.registrar('RECALCULAR_PRIORIDADES', SQLERRM, 0, 'ERRO');
            RAISE;
    END recalcular_prioridades;

    -- -----------------------------------------------------------------
    PROCEDURE detectar_atrasos(o_qt_novos_atrasos OUT NUMBER) IS
    BEGIN
        INSERT INTO zl_historico (id_historico, id_ocorrencia, st_anterior, st_novo,
                                  ds_comentario, id_usuario)
        SELECT seq_zl_historico.NEXTVAL, o.id_ocorrencia, o.st_ocorrencia, o.st_ocorrencia,
               c_marca_atraso || ' Prazo de atendimento vencido em '
               || TO_CHAR(o.dt_prazo, 'DD/MM/YYYY')
               || '. Prioridade elevada automaticamente.',
               NULL
          FROM zl_ocorrencia o
         WHERE o.st_ocorrencia IN ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO')
           AND o.dt_prazo < SYSDATE
           AND NOT EXISTS (SELECT 1 FROM zl_historico h
                            WHERE h.id_ocorrencia = o.id_ocorrencia
                              AND h.ds_comentario LIKE c_marca_atraso || '%');

        o_qt_novos_atrasos := SQL%ROWCOUNT;

        pkg_zl_log.registrar('DETECTAR_ATRASOS',
            o_qt_novos_atrasos || ' nova(s) ocorrencia(s) com prazo vencido.',
            o_qt_novos_atrasos,
            CASE WHEN o_qt_novos_atrasos > 0 THEN 'AVISO' ELSE 'INFO' END);
    END detectar_atrasos;

    -- -----------------------------------------------------------------
    -- MERGE: rodar duas vezes no mesmo mes atualiza a linha em vez de
    -- duplicar. Bairro sem nenhuma ocorrencia tambem ganha linha (zerada),
    -- para o painel mostrar que esta tudo em dia ali.
    -- -----------------------------------------------------------------
    PROCEDURE gerar_indicadores(p_mes IN VARCHAR2, o_qt_bairros OUT NUMBER) IS
        v_inicio DATE;
        v_fim    DATE;
    BEGIN
        IF p_mes IS NULL OR NOT REGEXP_LIKE(p_mes, '^[0-9]{4}-(0[1-9]|1[0-2])$') THEN
            RAISE_APPLICATION_ERROR(-20201, 'Informe o mês no formato AAAA-MM.');
        END IF;

        v_inicio := TO_DATE(p_mes || '-01', 'YYYY-MM-DD');
        v_fim    := ADD_MONTHS(v_inicio, 1);

        MERGE INTO zl_indicador d
        USING (
            SELECT b.id_bairro,
                   NVL(a.qt_abertas, 0)    AS qt_abertas,
                   NVL(r.qt_resolvidas, 0) AS qt_resolvidas,
                   NVL(a.qt_atrasadas, 0)  AS qt_atrasadas,
                   r.tempo_medio,
                   r.pc_no_prazo,
                   r.nota_media,
                   ROUND(NVL(a.qt_abertas, 0) * 1000 / b.nr_populacao, 2) AS taxa
              FROM zl_bairro b
              LEFT JOIN (
                    SELECT id_bairro,
                           COUNT(*) AS qt_abertas,
                           SUM(CASE WHEN (dt_resolucao IS NULL AND dt_prazo < SYSDATE
                                          AND st_ocorrencia <> 'CANCELADA')
                                      OR dt_resolucao > dt_prazo
                                    THEN 1 ELSE 0 END) AS qt_atrasadas
                      FROM zl_ocorrencia
                     WHERE dt_abertura >= v_inicio AND dt_abertura < v_fim
                     GROUP BY id_bairro) a ON a.id_bairro = b.id_bairro
              LEFT JOIN (
                    SELECT o.id_bairro,
                           COUNT(*) AS qt_resolvidas,
                           ROUND(AVG(o.dt_resolucao - o.dt_abertura), 1) AS tempo_medio,
                           ROUND(100 * SUM(CASE WHEN o.dt_resolucao <= o.dt_prazo THEN 1 ELSE 0 END)
                                 / COUNT(*), 1) AS pc_no_prazo,
                           ROUND(AVG(av.nr_nota), 2) AS nota_media
                      FROM zl_ocorrencia o
                      LEFT JOIN zl_avaliacao av ON av.id_ocorrencia = o.id_ocorrencia
                     WHERE o.st_ocorrencia = 'RESOLVIDA'
                       AND o.dt_resolucao >= v_inicio AND o.dt_resolucao < v_fim
                     GROUP BY o.id_bairro) r ON r.id_bairro = b.id_bairro
        ) s
        ON (d.id_bairro = s.id_bairro AND d.cd_mes = p_mes)
        WHEN MATCHED THEN UPDATE SET
            d.qt_abertas      = s.qt_abertas,
            d.qt_resolvidas   = s.qt_resolvidas,
            d.qt_atrasadas    = s.qt_atrasadas,
            d.nr_tempo_medio  = s.tempo_medio,
            d.pc_no_prazo     = s.pc_no_prazo,
            d.nr_nota_media   = s.nota_media,
            d.nr_taxa_mil_hab = s.taxa,
            d.dt_geracao      = SYSDATE
        WHEN NOT MATCHED THEN INSERT (
            id_bairro, cd_mes, qt_abertas, qt_resolvidas, qt_atrasadas,
            nr_tempo_medio, pc_no_prazo, nr_nota_media, nr_taxa_mil_hab)
        VALUES (
            s.id_bairro, p_mes, s.qt_abertas, s.qt_resolvidas, s.qt_atrasadas,
            s.tempo_medio, s.pc_no_prazo, s.nota_media, s.taxa);

        o_qt_bairros := SQL%ROWCOUNT;

        pkg_zl_log.registrar('GERAR_INDICADORES',
            'Indicadores de ' || p_mes || ' gerados para ' || o_qt_bairros || ' bairro(s).',
            o_qt_bairros);
    END gerar_indicadores;

    -- -----------------------------------------------------------------
    -- Ponto de entrada do agendador (DBMS_SCHEDULER, ver 07_job.sql) e
    -- do botao "rodar rotinas" do gestor. E a unica rotina que confirma a
    -- transacao, porque roda sozinha, sem a API em volta.
    -- -----------------------------------------------------------------
    PROCEDURE executar_rotina_diaria IS
        v_prioridades NUMBER;
        v_atrasos     NUMBER;
        v_bairros     NUMBER;
    BEGIN
        detectar_atrasos(v_atrasos);
        recalcular_prioridades(v_prioridades);
        gerar_indicadores(TO_CHAR(SYSDATE, 'YYYY-MM'), v_bairros);
        COMMIT;

        pkg_zl_log.registrar('ROTINA_DIARIA',
            'Atrasos: ' || v_atrasos || ' | prioridades: ' || v_prioridades
            || ' | bairros: ' || v_bairros, v_atrasos + v_prioridades + v_bairros);
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pkg_zl_log.registrar('ROTINA_DIARIA', SQLERRM, 0, 'ERRO');
            RAISE;
    END executar_rotina_diaria;

    -- -----------------------------------------------------------------
    FUNCTION pc_no_prazo_bairro(p_id_bairro NUMBER) RETURN NUMBER IS
        v_pc NUMBER;
    BEGIN
        SELECT ROUND(100 * SUM(CASE WHEN dt_resolucao <= dt_prazo THEN 1 ELSE 0 END)
                     / NULLIF(COUNT(*), 0), 1)
          INTO v_pc
          FROM zl_ocorrencia
         WHERE id_bairro = p_id_bairro
           AND st_ocorrencia = 'RESOLVIDA';
        RETURN v_pc;
    END pc_no_prazo_bairro;

END pkg_zl_indicador;
/
