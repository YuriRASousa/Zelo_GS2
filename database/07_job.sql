-- =====================================================================
-- ZELO | 07_job.sql (opcional)
-- Agenda a rotina diaria para rodar sozinha todo dia as 6h.
-- Precisa do privilegio CREATE JOB. Se o schema nao tiver, o bloco so
-- avisa e segue: a mesma rotina continua disponivel pelo botao do gestor
-- no aplicativo (POST /api/gestor/rotinas).
-- =====================================================================
BEGIN
    BEGIN
        DBMS_SCHEDULER.DROP_JOB('JOB_ZL_ROTINA_DIARIA', force => TRUE);
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;

    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'JOB_ZL_ROTINA_DIARIA',
        job_type        => 'STORED_PROCEDURE',
        job_action      => 'PKG_ZL_INDICADOR.EXECUTAR_ROTINA_DIARIA',
        start_date      => TRUNC(SYSTIMESTAMP) + 1 + 6 / 24,
        repeat_interval => 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0',
        enabled         => TRUE,
        comments        => 'Zelo: atrasos, prioridades e indicadores do mes');
    pkg_zl_log.registrar('JOB', 'Job JOB_ZL_ROTINA_DIARIA agendado para as 06:00.');
EXCEPTION
    WHEN OTHERS THEN
        pkg_zl_log.registrar('JOB', 'Job nao agendado: ' || SQLERRM, 0, 'AVISO');
END;
/
