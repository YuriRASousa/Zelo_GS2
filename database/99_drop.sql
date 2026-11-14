-- =====================================================================
-- ZELO | 99_drop.sql
-- Remove todos os objetos do Zelo (e so eles). Ignora o que nao existir,
-- entao pode rodar num schema vazio.
-- =====================================================================
BEGIN
    FOR r IN (SELECT object_name, object_type FROM user_objects
               WHERE object_type IN ('VIEW', 'TRIGGER', 'PACKAGE', 'TABLE', 'SEQUENCE')
                 AND (object_name LIKE 'ZL\_%' ESCAPE '\'
                   OR object_name LIKE 'PKG\_ZL\_%' ESCAPE '\'
                   OR object_name LIKE 'TRG\_ZL\_%' ESCAPE '\'
                   OR object_name LIKE 'VW\_ZL\_%' ESCAPE '\'
                   OR object_name LIKE 'SEQ\_ZL\_%' ESCAPE '\')
               ORDER BY DECODE(object_type, 'VIEW', 1, 'TRIGGER', 2, 'PACKAGE', 3, 'TABLE', 4, 5)) LOOP
        BEGIN
            IF r.object_type = 'TABLE' THEN
                EXECUTE IMMEDIATE 'DROP TABLE ' || r.object_name || ' CASCADE CONSTRAINTS PURGE';
            ELSE
                EXECUTE IMMEDIATE 'DROP ' || r.object_type || ' ' || r.object_name;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END;
/
BEGIN
    DBMS_SCHEDULER.DROP_JOB('JOB_ZL_ROTINA_DIARIA', force => TRUE);
EXCEPTION
    WHEN OTHERS THEN NULL;
END;
/
