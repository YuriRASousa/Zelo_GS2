-- =====================================================================
-- ZELO | 02_pkg_log.sql
-- Log das rotinas em transacao autonoma: a linha de log fica gravada
-- mesmo quando a rotina que chamou faz ROLLBACK por causa de um erro.
-- =====================================================================

CREATE OR REPLACE PACKAGE pkg_zl_log AS
    -- Grava uma linha em ZL_LOG_ROTINA e confirma so ela.
    PROCEDURE registrar(
        p_rotina   IN VARCHAR2,
        p_mensagem IN VARCHAR2,
        p_linhas   IN NUMBER   DEFAULT 0,
        p_nivel    IN VARCHAR2 DEFAULT 'INFO');
END pkg_zl_log;
/

CREATE OR REPLACE PACKAGE BODY pkg_zl_log AS

    PROCEDURE registrar(
        p_rotina   IN VARCHAR2,
        p_mensagem IN VARCHAR2,
        p_linhas   IN NUMBER   DEFAULT 0,
        p_nivel    IN VARCHAR2 DEFAULT 'INFO')
    IS
        PRAGMA AUTONOMOUS_TRANSACTION;
    BEGIN
        INSERT INTO zl_log_rotina (id_log, nm_rotina, ds_mensagem, qt_linhas, tp_nivel)
        VALUES (seq_zl_log.NEXTVAL,
                SUBSTR(p_rotina, 1, 60),
                SUBSTR(p_mensagem, 1, 500),
                NVL(p_linhas, 0),
                CASE WHEN p_nivel IN ('INFO', 'AVISO', 'ERRO') THEN p_nivel ELSE 'INFO' END);
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log nunca pode derrubar a operacao principal.
            ROLLBACK;
    END registrar;

END pkg_zl_log;
/
