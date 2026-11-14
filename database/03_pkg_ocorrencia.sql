-- =====================================================================
-- ZELO | 03_pkg_ocorrencia.sql
-- Regras do ciclo de vida da ocorrencia: registro, apoio da vizinhanca,
-- mudanca de status pelo gestor e avaliacao do cidadao.
--
-- Erros de aplicacao (o backend transforma em status HTTP):
--   -20101 usuario inexistente          -20109 usuario nao e gestor
--   -20102 categoria inexistente        -20110 transicao de status invalida
--   -20103 bairro inexistente           -20111 so o autor pode avaliar
--   -20104 titulo curto demais          -20112 ocorrencia ainda nao resolvida
--   -20105 ja existe ocorrencia igual   -20113 ocorrencia ja avaliada
--   -20106 apoio na propria ocorrencia  -20114 nota fora de 1 a 5
--   -20107 ocorrencia encerrada         -20115 ocorrencia inexistente
--   -20108 apoio repetido               -20116 coordenada fora do limite
-- =====================================================================

CREATE OR REPLACE PACKAGE pkg_zl_ocorrencia AS

    -- Raio (metros) em que duas ocorrencias da mesma categoria sao
    -- consideradas o mesmo problema.
    c_raio_duplicada CONSTANT NUMBER := 60;

    -- Contexto da mudanca de status, lido pelo trigger de historico.
    -- Fica preenchido so durante o UPDATE feito por atualizar_status.
    g_comentario VARCHAR2(500);
    g_usuario    NUMBER;

    -- Distancia aproximada em metros entre dois pontos (equiretangular,
    -- precisa o bastante para escala de bairro).
    FUNCTION distancia_m(p_lat1 NUMBER, p_lon1 NUMBER,
                         p_lat2 NUMBER, p_lon2 NUMBER) RETURN NUMBER DETERMINISTIC;

    -- Nota de 0 a 100 que ordena a fila do gestor.
    FUNCTION calcular_prioridade(p_id_ocorrencia NUMBER) RETURN NUMBER;

    -- Prazo de atendimento: SLA da categoria, cortado pela metade quando
    -- ha risco a pessoas.
    FUNCTION calcular_prazo(p_id_categoria NUMBER, p_risco CHAR,
                            p_abertura DATE) RETURN DATE;

    -- Protocolo legivel para o cidadao, ex.: ZL-2026-000042.
    FUNCTION gerar_protocolo(p_id_ocorrencia NUMBER, p_abertura DATE) RETURN VARCHAR2;

    -- Ocorrencia aberta da mesma categoria a menos de c_raio_duplicada
    -- metros. Devolve o id ou NULL.
    FUNCTION buscar_duplicada(p_id_categoria NUMBER,
                              p_lat NUMBER, p_lon NUMBER) RETURN NUMBER;

    PROCEDURE registrar(
        p_id_usuario     IN  NUMBER,
        p_id_categoria   IN  NUMBER,
        p_id_bairro      IN  NUMBER,
        p_titulo         IN  VARCHAR2,
        p_descricao      IN  VARCHAR2,
        p_endereco       IN  VARCHAR2,
        p_lat            IN  NUMBER,
        p_lon            IN  NUMBER,
        p_foto           IN  VARCHAR2,
        p_risco          IN  CHAR,
        p_acessibilidade IN  CHAR,
        o_id_ocorrencia  OUT NUMBER,
        o_protocolo      OUT VARCHAR2);

    PROCEDURE apoiar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                     o_qt_apoios OUT NUMBER, o_prioridade OUT NUMBER);

    PROCEDURE atualizar_status(p_id_ocorrencia IN NUMBER, p_id_gestor IN NUMBER,
                               p_novo_status IN VARCHAR2, p_comentario IN VARCHAR2);

    PROCEDURE avaliar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                      p_nota IN NUMBER, p_comentario IN VARCHAR2);

END pkg_zl_ocorrencia;
/

CREATE OR REPLACE PACKAGE BODY pkg_zl_ocorrencia AS

    -- -----------------------------------------------------------------
    -- Funcoes auxiliares privadas
    -- -----------------------------------------------------------------
    FUNCTION usuario_existe(p_id NUMBER) RETURN BOOLEAN IS
        v_qt NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_qt FROM zl_usuario WHERE id_usuario = p_id;
        RETURN v_qt > 0;
    END usuario_existe;

    PROCEDURE somar_pontos(p_id_usuario NUMBER, p_pontos NUMBER) IS
    BEGIN
        UPDATE zl_usuario
           SET nr_pontos = nr_pontos + p_pontos
         WHERE id_usuario = p_id_usuario;
    END somar_pontos;

    FUNCTION transicao_valida(p_de VARCHAR2, p_para VARCHAR2) RETURN BOOLEAN IS
    BEGIN
        RETURN (p_de = 'ABERTA'       AND p_para IN ('EM_ANALISE', 'CANCELADA'))
            OR (p_de = 'EM_ANALISE'   AND p_para IN ('EM_ANDAMENTO', 'CANCELADA'))
            OR (p_de = 'EM_ANDAMENTO' AND p_para IN ('RESOLVIDA'));
    END transicao_valida;

    -- -----------------------------------------------------------------
    FUNCTION distancia_m(p_lat1 NUMBER, p_lon1 NUMBER,
                         p_lat2 NUMBER, p_lon2 NUMBER) RETURN NUMBER DETERMINISTIC
    IS
        c_pi        CONSTANT NUMBER := 3.14159265358979;
        c_m_por_grau CONSTANT NUMBER := 111320;
        v_dlat NUMBER;
        v_dlon NUMBER;
    BEGIN
        v_dlat := (p_lat2 - p_lat1) * c_m_por_grau;
        v_dlon := (p_lon2 - p_lon1) * c_m_por_grau
                  * COS(((p_lat1 + p_lat2) / 2) * c_pi / 180);
        RETURN ROUND(SQRT(v_dlat * v_dlat + v_dlon * v_dlon), 1);
    END distancia_m;

    -- -----------------------------------------------------------------
    -- Prioridade = gravidade da categoria + vizinhos que confirmaram +
    -- risco a pessoas + barreira de acessibilidade + tempo de espera +
    -- bonus de atraso. Encerrada nao entra na fila (zero).
    -- -----------------------------------------------------------------
    FUNCTION calcular_prioridade(p_id_ocorrencia NUMBER) RETURN NUMBER IS
        v_peso     zl_categoria.nr_peso%TYPE;
        v_apoios   zl_ocorrencia.qt_apoios%TYPE;
        v_risco    zl_ocorrencia.fl_risco%TYPE;
        v_acess    zl_ocorrencia.fl_acessibilidade%TYPE;
        v_status   zl_ocorrencia.st_ocorrencia%TYPE;
        v_abertura zl_ocorrencia.dt_abertura%TYPE;
        v_prazo    zl_ocorrencia.dt_prazo%TYPE;
        v_total    NUMBER;
    BEGIN
        SELECT c.nr_peso, o.qt_apoios, o.fl_risco, o.fl_acessibilidade,
               o.st_ocorrencia, o.dt_abertura, o.dt_prazo
          INTO v_peso, v_apoios, v_risco, v_acess, v_status, v_abertura, v_prazo
          FROM zl_ocorrencia o
          JOIN zl_categoria c ON c.id_categoria = o.id_categoria
         WHERE o.id_ocorrencia = p_id_ocorrencia;

        IF v_status IN ('RESOLVIDA', 'CANCELADA') THEN
            RETURN 0;
        END IF;

        v_total := v_peso * 8                                     -- ate 40
                 + LEAST(v_apoios * 4, 24)                        -- ate 24
                 + CASE WHEN v_risco = 'S' THEN 15 ELSE 0 END     -- 15
                 + CASE WHEN v_acess = 'S' THEN 10 ELSE 0 END     -- 10
                 + LEAST(TRUNC(SYSDATE - v_abertura), 15)         -- ate 15
                 + CASE WHEN SYSDATE > v_prazo THEN 10 ELSE 0 END; -- 10

        RETURN LEAST(v_total, 100);
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN NULL;
    END calcular_prioridade;

    -- -----------------------------------------------------------------
    FUNCTION calcular_prazo(p_id_categoria NUMBER, p_risco CHAR,
                            p_abertura DATE) RETURN DATE
    IS
        v_dias zl_categoria.nr_prazo_dias%TYPE;
    BEGIN
        SELECT nr_prazo_dias INTO v_dias
          FROM zl_categoria WHERE id_categoria = p_id_categoria;

        IF p_risco = 'S' THEN
            v_dias := GREATEST(CEIL(v_dias / 2), 1);
        END IF;
        RETURN p_abertura + v_dias;
    END calcular_prazo;

    -- -----------------------------------------------------------------
    FUNCTION gerar_protocolo(p_id_ocorrencia NUMBER, p_abertura DATE) RETURN VARCHAR2 IS
    BEGIN
        RETURN 'ZL-' || TO_CHAR(p_abertura, 'YYYY') || '-'
               || LPAD(TO_CHAR(p_id_ocorrencia), 6, '0');
    END gerar_protocolo;

    -- -----------------------------------------------------------------
    FUNCTION buscar_duplicada(p_id_categoria NUMBER,
                              p_lat NUMBER, p_lon NUMBER) RETURN NUMBER
    IS
        v_id NUMBER;
    BEGIN
        -- Pre-filtro por caixa (~0.001 grau = ~110 m) usa o indice e evita
        -- calcular distancia para a cidade inteira.
        SELECT id_ocorrencia INTO v_id
          FROM (SELECT o.id_ocorrencia,
                       distancia_m(p_lat, p_lon, o.nr_latitude, o.nr_longitude) AS dist
                  FROM zl_ocorrencia o
                 WHERE o.id_categoria = p_id_categoria
                   AND o.st_ocorrencia IN ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO')
                   AND o.nr_latitude  BETWEEN p_lat - 0.001 AND p_lat + 0.001
                   AND o.nr_longitude BETWEEN p_lon - 0.001 AND p_lon + 0.001
                 ORDER BY dist)
         WHERE dist <= c_raio_duplicada
           AND ROWNUM = 1;
        RETURN v_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN NULL;
    END buscar_duplicada;

    -- -----------------------------------------------------------------
    PROCEDURE registrar(
        p_id_usuario     IN  NUMBER,
        p_id_categoria   IN  NUMBER,
        p_id_bairro      IN  NUMBER,
        p_titulo         IN  VARCHAR2,
        p_descricao      IN  VARCHAR2,
        p_endereco       IN  VARCHAR2,
        p_lat            IN  NUMBER,
        p_lon            IN  NUMBER,
        p_foto           IN  VARCHAR2,
        p_risco          IN  CHAR,
        p_acessibilidade IN  CHAR,
        o_id_ocorrencia  OUT NUMBER,
        o_protocolo      OUT VARCHAR2)
    IS
        v_qt        NUMBER;
        v_duplicada NUMBER;
        v_protocolo_dup zl_ocorrencia.cd_protocolo%TYPE;
        v_agora     DATE := SYSDATE;
        v_prioridade NUMBER;
        v_risco     CHAR(1) := CASE WHEN p_risco = 'S' THEN 'S' ELSE 'N' END;
        v_acess     CHAR(1) := CASE WHEN p_acessibilidade = 'S' THEN 'S' ELSE 'N' END;
    BEGIN
        IF NOT usuario_existe(p_id_usuario) THEN
            RAISE_APPLICATION_ERROR(-20101, 'Usuário ' || p_id_usuario || ' não encontrado.');
        END IF;

        SELECT COUNT(*) INTO v_qt FROM zl_categoria WHERE id_categoria = p_id_categoria;
        IF v_qt = 0 THEN
            RAISE_APPLICATION_ERROR(-20102, 'Categoria ' || p_id_categoria || ' não existe.');
        END IF;

        SELECT COUNT(*) INTO v_qt FROM zl_bairro WHERE id_bairro = p_id_bairro;
        IF v_qt = 0 THEN
            RAISE_APPLICATION_ERROR(-20103, 'Bairro ' || p_id_bairro || ' não existe.');
        END IF;

        IF LENGTH(TRIM(p_titulo)) < 5 OR p_titulo IS NULL THEN
            RAISE_APPLICATION_ERROR(-20104, 'Descreva o problema com pelo menos 5 letras no título.');
        END IF;

        IF p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180 THEN
            RAISE_APPLICATION_ERROR(-20116, 'Localização inválida.');
        END IF;

        -- Evita a fila do gestor encher de registros do mesmo buraco.
        v_duplicada := buscar_duplicada(p_id_categoria, p_lat, p_lon);
        IF v_duplicada IS NOT NULL THEN
            SELECT cd_protocolo INTO v_protocolo_dup
              FROM zl_ocorrencia WHERE id_ocorrencia = v_duplicada;
            RAISE_APPLICATION_ERROR(-20105,
                'Já existe a ocorrência ' || v_protocolo_dup || ' para este problema aqui perto. '
                || 'Apoie a existente para aumentar a prioridade. [id=' || v_duplicada || ']');
        END IF;

        o_id_ocorrencia := seq_zl_ocorrencia.NEXTVAL;
        o_protocolo     := gerar_protocolo(o_id_ocorrencia, v_agora);

        INSERT INTO zl_ocorrencia (
            id_ocorrencia, cd_protocolo, id_usuario, id_categoria, id_bairro,
            ds_titulo, ds_descricao, ds_endereco, nr_latitude, nr_longitude,
            ds_foto, fl_risco, fl_acessibilidade, st_ocorrencia,
            nr_prioridade, qt_apoios, dt_abertura, dt_prazo)
        VALUES (
            o_id_ocorrencia, o_protocolo, p_id_usuario, p_id_categoria, p_id_bairro,
            TRIM(p_titulo), p_descricao, p_endereco, p_lat, p_lon,
            p_foto, v_risco, v_acess, 'ABERTA',
            0, 0, v_agora, calcular_prazo(p_id_categoria, v_risco, v_agora));

        -- A funcao le ZL_OCORRENCIA, entao o valor e calculado antes do
        -- UPDATE (chamar dentro dele daria ORA-04091, tabela mutante).
        v_prioridade := calcular_prioridade(o_id_ocorrencia);
        UPDATE zl_ocorrencia
           SET nr_prioridade = v_prioridade
         WHERE id_ocorrencia = o_id_ocorrencia;

        somar_pontos(p_id_usuario, 10);

        pkg_zl_log.registrar('REGISTRAR', 'Ocorrencia ' || o_protocolo || ' aberta.', 1);
    END registrar;

    -- -----------------------------------------------------------------
    PROCEDURE apoiar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                     o_qt_apoios OUT NUMBER, o_prioridade OUT NUMBER)
    IS
        v_autor  zl_ocorrencia.id_usuario%TYPE;
        v_status zl_ocorrencia.st_ocorrencia%TYPE;
    BEGIN
        IF NOT usuario_existe(p_id_usuario) THEN
            RAISE_APPLICATION_ERROR(-20101, 'Usuário ' || p_id_usuario || ' não encontrado.');
        END IF;

        BEGIN
            SELECT id_usuario, st_ocorrencia INTO v_autor, v_status
              FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20115, 'Ocorrência ' || p_id_ocorrencia || ' não encontrada.');
        END;

        IF v_autor = p_id_usuario THEN
            RAISE_APPLICATION_ERROR(-20106, 'Você registrou esta ocorrência, ela já conta com o seu apoio.');
        END IF;
        IF v_status IN ('RESOLVIDA', 'CANCELADA') THEN
            RAISE_APPLICATION_ERROR(-20107, 'Esta ocorrência já foi encerrada.');
        END IF;

        BEGIN
            INSERT INTO zl_apoio (id_ocorrencia, id_usuario)
            VALUES (p_id_ocorrencia, p_id_usuario);
        EXCEPTION
            WHEN DUP_VAL_ON_INDEX THEN
                RAISE_APPLICATION_ERROR(-20108, 'Você já apoiou esta ocorrência.');
        END;

        UPDATE zl_ocorrencia
           SET qt_apoios = qt_apoios + 1
         WHERE id_ocorrencia = p_id_ocorrencia
        RETURNING qt_apoios INTO o_qt_apoios;

        o_prioridade := calcular_prioridade(p_id_ocorrencia);
        UPDATE zl_ocorrencia SET nr_prioridade = o_prioridade
         WHERE id_ocorrencia = p_id_ocorrencia;

        somar_pontos(p_id_usuario, 2);
    END apoiar;

    -- -----------------------------------------------------------------
    PROCEDURE atualizar_status(p_id_ocorrencia IN NUMBER, p_id_gestor IN NUMBER,
                               p_novo_status IN VARCHAR2, p_comentario IN VARCHAR2)
    IS
        v_papel  zl_usuario.tp_papel%TYPE;
        v_atual  zl_ocorrencia.st_ocorrencia%TYPE;
        v_autor  zl_ocorrencia.id_usuario%TYPE;
        v_novo   VARCHAR2(15) := UPPER(TRIM(p_novo_status));
        v_prioridade NUMBER;
    BEGIN
        BEGIN
            SELECT tp_papel INTO v_papel FROM zl_usuario WHERE id_usuario = p_id_gestor;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20101, 'Usuário ' || p_id_gestor || ' não encontrado.');
        END;
        IF v_papel <> 'GESTOR' THEN
            RAISE_APPLICATION_ERROR(-20109, 'Somente gestores da prefeitura podem mudar o status.');
        END IF;

        BEGIN
            SELECT st_ocorrencia, id_usuario INTO v_atual, v_autor
              FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20115, 'Ocorrência ' || p_id_ocorrencia || ' não encontrada.');
        END;

        IF NOT transicao_valida(v_atual, v_novo) THEN
            RAISE_APPLICATION_ERROR(-20110,
                'Não é possível passar de ' || v_atual || ' para ' || v_novo || '.');
        END IF;

        -- Contexto para o trigger que escreve a linha do tempo.
        g_comentario := SUBSTR(p_comentario, 1, 500);
        g_usuario    := p_id_gestor;

        UPDATE zl_ocorrencia
           SET st_ocorrencia = v_novo,
               dt_resolucao  = CASE WHEN v_novo = 'RESOLVIDA' THEN SYSDATE END
         WHERE id_ocorrencia = p_id_ocorrencia;

        g_comentario := NULL;
        g_usuario    := NULL;

        v_prioridade := calcular_prioridade(p_id_ocorrencia);
        UPDATE zl_ocorrencia
           SET nr_prioridade = v_prioridade
         WHERE id_ocorrencia = p_id_ocorrencia;

        -- Quem relatou um problema que foi resolvido ganha pontos extras.
        IF v_novo = 'RESOLVIDA' THEN
            somar_pontos(v_autor, 5);
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            g_comentario := NULL;
            g_usuario    := NULL;
            RAISE;
    END atualizar_status;

    -- -----------------------------------------------------------------
    PROCEDURE avaliar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                      p_nota IN NUMBER, p_comentario IN VARCHAR2)
    IS
        v_autor  zl_ocorrencia.id_usuario%TYPE;
        v_status zl_ocorrencia.st_ocorrencia%TYPE;
    BEGIN
        BEGIN
            SELECT id_usuario, st_ocorrencia INTO v_autor, v_status
              FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20115, 'Ocorrência ' || p_id_ocorrencia || ' não encontrada.');
        END;

        IF v_autor <> p_id_usuario THEN
            RAISE_APPLICATION_ERROR(-20111, 'Somente quem registrou pode avaliar o atendimento.');
        END IF;
        IF v_status <> 'RESOLVIDA' THEN
            RAISE_APPLICATION_ERROR(-20112, 'A avaliação fica liberada depois que a ocorrência é resolvida.');
        END IF;
        IF p_nota IS NULL OR p_nota NOT BETWEEN 1 AND 5 THEN
            RAISE_APPLICATION_ERROR(-20114, 'A nota vai de 1 a 5.');
        END IF;

        BEGIN
            INSERT INTO zl_avaliacao (id_ocorrencia, nr_nota, ds_comentario)
            VALUES (p_id_ocorrencia, p_nota, SUBSTR(p_comentario, 1, 500));
        EXCEPTION
            WHEN DUP_VAL_ON_INDEX THEN
                RAISE_APPLICATION_ERROR(-20113, 'Este atendimento já foi avaliado.');
        END;
    END avaliar;

END pkg_zl_ocorrencia;
/
