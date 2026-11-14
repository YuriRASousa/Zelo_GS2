-- =====================================================================
-- ZELO | 03_pkg_ocorrencia.sql
-- Regras do ciclo de vida da ocorrencia: registro, apoio da vizinhanca,
-- mudanca de status pelo gestor, comentarios, cancelamento pelo autor,
-- avaliacao do cidadao e as notificacoes que cada evento gera.
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
--   -20117 cancelamento sem motivo (minimo 5 letras)
--   -20118 comentario fora de 3 a 500 letras
--   -20119 sem permissao para comentar (nao e autor, apoiador nem gestor)
--   -20121 so o autor pode cancelar a propria ocorrencia
--   -20122 autor so cancela enquanto a ocorrencia esta ABERTA
--   -20123 foto da solucao fora do status RESOLVIDA
--   -20124 notificacao inexistente (ou de outro usuario)
-- =====================================================================

-- ---------------------------------------------------------------------
-- PKG_ZL_NOTIFICACAO: quem fica sabendo de cada evento.
--   troca de status -> autor e apoiadores (menos quem fez a troca)
--   atraso          -> autor
--   apoio novo      -> autor
--   comentario      -> autor e apoiadores, menos quem comentou
-- Vem antes do PKG_ZL_OCORRENCIA porque ele chama estas rotinas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_zl_notificacao AS

    -- Rotulo do status do jeito que o cidadao le ("Em análise").
    FUNCTION rotulo_status(p_status VARCHAR2) RETURN VARCHAR2 DETERMINISTIC;

    -- Grava uma notificacao. Tipo fora da lista e recusado pelo CHECK.
    PROCEDURE criar(p_id_usuario    IN NUMBER,
                    p_id_ocorrencia IN NUMBER,
                    p_tipo          IN VARCHAR2,
                    p_titulo        IN VARCHAR2,
                    p_mensagem      IN VARCHAR2);

    PROCEDURE status_alterado(p_id_ocorrencia IN NUMBER,
                              p_novo_status   IN VARCHAR2,
                              p_comentario    IN VARCHAR2,
                              p_quem_alterou  IN NUMBER);

    PROCEDURE atraso(p_id_ocorrencia IN NUMBER);

    PROCEDURE apoio_recebido(p_id_ocorrencia IN NUMBER, p_id_apoiador IN NUMBER);

    PROCEDURE comentario_novo(p_id_ocorrencia IN NUMBER, p_id_autor_comentario IN NUMBER,
                              p_texto IN VARCHAR2);

    -- Marca uma notificacao do proprio usuario como lida (-20124 se nao for dele).
    PROCEDURE marcar_lida(p_id_notificacao IN NUMBER, p_id_usuario IN NUMBER);

    PROCEDURE marcar_todas(p_id_usuario IN NUMBER, o_qt OUT NUMBER);

    FUNCTION nao_lidas(p_id_usuario NUMBER) RETURN NUMBER;

END pkg_zl_notificacao;
/

CREATE OR REPLACE PACKAGE BODY pkg_zl_notificacao AS

    -- -----------------------------------------------------------------
    FUNCTION rotulo_status(p_status VARCHAR2) RETURN VARCHAR2 DETERMINISTIC IS
    BEGIN
        RETURN CASE p_status
                   WHEN 'ABERTA'       THEN 'Aberta'
                   WHEN 'EM_ANALISE'   THEN 'Em análise'
                   WHEN 'EM_ANDAMENTO' THEN 'Em andamento'
                   WHEN 'RESOLVIDA'    THEN 'Resolvida'
                   WHEN 'CANCELADA'    THEN 'Cancelada'
                   ELSE p_status
               END;
    END rotulo_status;

    -- -----------------------------------------------------------------
    PROCEDURE criar(p_id_usuario    IN NUMBER,
                    p_id_ocorrencia IN NUMBER,
                    p_tipo          IN VARCHAR2,
                    p_titulo        IN VARCHAR2,
                    p_mensagem      IN VARCHAR2)
    IS
    BEGIN
        INSERT INTO zl_notificacao (id_notificacao, id_usuario, id_ocorrencia, tp_notificacao,
                                    ds_titulo, ds_mensagem)
        VALUES (seq_zl_notificacao.NEXTVAL, p_id_usuario, p_id_ocorrencia, p_tipo,
                SUBSTR(p_titulo, 1, 100), SUBSTR(p_mensagem, 1, 500));
    END criar;

    -- -----------------------------------------------------------------
    -- O autor recebe "sua ocorrencia"; quem apoiou recebe "a ocorrencia
    -- que voce apoiou". Quem fez a troca (o gestor, ou o autor quando ele
    -- mesmo cancela) nao recebe aviso do proprio gesto.
    -- -----------------------------------------------------------------
    PROCEDURE status_alterado(p_id_ocorrencia IN NUMBER,
                              p_novo_status   IN VARCHAR2,
                              p_comentario    IN VARCHAR2,
                              p_quem_alterou  IN NUMBER)
    IS
        v_autor     zl_ocorrencia.id_usuario%TYPE;
        v_protocolo zl_ocorrencia.cd_protocolo%TYPE;
        v_titulo    VARCHAR2(100);
        v_detalhe   VARCHAR2(400);
    BEGIN
        SELECT id_usuario, cd_protocolo INTO v_autor, v_protocolo
          FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia;

        v_titulo := CASE p_novo_status
                        WHEN 'EM_ANALISE'   THEN 'Ocorrência em análise'
                        WHEN 'EM_ANDAMENTO' THEN 'Atendimento em andamento'
                        WHEN 'RESOLVIDA'    THEN 'Problema resolvido'
                        WHEN 'CANCELADA'    THEN 'Ocorrência cancelada'
                        ELSE 'Status atualizado'
                    END;
        v_detalhe := CASE WHEN TRIM(p_comentario) IS NOT NULL
                          THEN ' Comentário: ' || SUBSTR(TRIM(p_comentario), 1, 300) END;

        IF v_autor <> NVL(p_quem_alterou, -1) THEN
            criar(v_autor, p_id_ocorrencia, 'STATUS', v_titulo,
                  'Sua ocorrência ' || v_protocolo || ' mudou para "'
                  || rotulo_status(p_novo_status) || '".' || v_detalhe
                  || CASE WHEN p_novo_status = 'RESOLVIDA'
                          THEN ' Conte como ficou: avalie o atendimento.' END);
        END IF;

        FOR a IN (SELECT id_usuario FROM zl_apoio
                   WHERE id_ocorrencia = p_id_ocorrencia
                     AND id_usuario <> NVL(p_quem_alterou, -1)) LOOP
            criar(a.id_usuario, p_id_ocorrencia, 'STATUS', v_titulo,
                  'A ocorrência ' || v_protocolo || ', que você apoiou, mudou para "'
                  || rotulo_status(p_novo_status) || '".' || v_detalhe);
        END LOOP;
    END status_alterado;

    -- -----------------------------------------------------------------
    PROCEDURE atraso(p_id_ocorrencia IN NUMBER) IS
    BEGIN
        INSERT INTO zl_notificacao (id_notificacao, id_usuario, id_ocorrencia, tp_notificacao,
                                    ds_titulo, ds_mensagem)
        SELECT seq_zl_notificacao.NEXTVAL, o.id_usuario, o.id_ocorrencia, 'ATRASO',
               'Prazo de atendimento vencido',
               'O prazo da sua ocorrência ' || o.cd_protocolo || ' venceu em '
               || TO_CHAR(o.dt_prazo, 'fmDD "de" month', 'NLS_DATE_LANGUAGE=PORTUGUESE')
               || '. A prioridade dela subiu automaticamente na fila da prefeitura.'
          FROM zl_ocorrencia o
         WHERE o.id_ocorrencia = p_id_ocorrencia;
    END atraso;

    -- -----------------------------------------------------------------
    PROCEDURE apoio_recebido(p_id_ocorrencia IN NUMBER, p_id_apoiador IN NUMBER) IS
    BEGIN
        INSERT INTO zl_notificacao (id_notificacao, id_usuario, id_ocorrencia, tp_notificacao,
                                    ds_titulo, ds_mensagem)
        SELECT seq_zl_notificacao.NEXTVAL, o.id_usuario, o.id_ocorrencia, 'APOIO',
               'Novo apoio na sua ocorrência',
               'Um vizinho também viu o problema da ocorrência ' || o.cd_protocolo
               || CASE WHEN o.qt_apoios = 1 THEN '. É o primeiro apoio'
                       ELSE '. Agora são ' || o.qt_apoios || ' apoios' END
               || ', e ela sobe na fila de atendimento da prefeitura.'
          FROM zl_ocorrencia o
         WHERE o.id_ocorrencia = p_id_ocorrencia
           AND o.id_usuario <> p_id_apoiador;
    END apoio_recebido;

    -- -----------------------------------------------------------------
    PROCEDURE comentario_novo(p_id_ocorrencia IN NUMBER, p_id_autor_comentario IN NUMBER,
                              p_texto IN VARCHAR2)
    IS
        v_nome      zl_usuario.nm_usuario%TYPE;
        v_papel     zl_usuario.tp_papel%TYPE;
        v_protocolo zl_ocorrencia.cd_protocolo%TYPE;
        v_quem      VARCHAR2(120);
        v_trecho    VARCHAR2(200);
    BEGIN
        SELECT nm_usuario, tp_papel INTO v_nome, v_papel
          FROM zl_usuario WHERE id_usuario = p_id_autor_comentario;
        SELECT cd_protocolo INTO v_protocolo
          FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia;

        -- Cidadao aparece so pelo primeiro nome (o app e publico).
        v_quem := CASE WHEN v_papel = 'GESTOR' THEN 'A prefeitura'
                       ELSE REGEXP_SUBSTR(TRIM(v_nome), '^\S+') END;
        v_trecho := SUBSTR(TRIM(p_texto), 1, 150)
                    || CASE WHEN LENGTH(TRIM(p_texto)) > 150 THEN '...' END;

        FOR d IN (SELECT id_usuario FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia
                  UNION
                  SELECT id_usuario FROM zl_apoio WHERE id_ocorrencia = p_id_ocorrencia) LOOP
            IF d.id_usuario <> p_id_autor_comentario THEN
                criar(d.id_usuario, p_id_ocorrencia, 'COMENTARIO',
                      'Novo comentário',
                      v_quem || ' comentou: "' || v_trecho || '"');
            END IF;
        END LOOP;
    END comentario_novo;

    -- -----------------------------------------------------------------
    PROCEDURE marcar_lida(p_id_notificacao IN NUMBER, p_id_usuario IN NUMBER) IS
    BEGIN
        -- O filtro pelo dono impede marcar (ou descobrir) a notificacao
        -- de outra pessoa: para quem nao e dono, ela "nao existe".
        UPDATE zl_notificacao
           SET fl_lida = 'S'
         WHERE id_notificacao = p_id_notificacao
           AND id_usuario = p_id_usuario;
        IF SQL%ROWCOUNT = 0 THEN
            RAISE_APPLICATION_ERROR(-20124, 'Notificação não encontrada.');
        END IF;
    END marcar_lida;

    -- -----------------------------------------------------------------
    PROCEDURE marcar_todas(p_id_usuario IN NUMBER, o_qt OUT NUMBER) IS
    BEGIN
        UPDATE zl_notificacao
           SET fl_lida = 'S'
         WHERE id_usuario = p_id_usuario
           AND fl_lida = 'N';
        o_qt := SQL%ROWCOUNT;
    END marcar_todas;

    -- -----------------------------------------------------------------
    FUNCTION nao_lidas(p_id_usuario NUMBER) RETURN NUMBER IS
        v_qt NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_qt FROM zl_notificacao
         WHERE id_usuario = p_id_usuario AND fl_lida = 'N';
        RETURN v_qt;
    END nao_lidas;

END pkg_zl_notificacao;
/

CREATE OR REPLACE PACKAGE pkg_zl_ocorrencia AS

    -- Raio (metros) em que duas ocorrencias da mesma categoria sao
    -- consideradas o mesmo problema.
    c_raio_duplicada CONSTANT NUMBER := 60;

    -- Limites de texto livre.
    c_min_motivo     CONSTANT NUMBER := 5;
    c_min_comentario CONSTANT NUMBER := 3;
    c_max_comentario CONSTANT NUMBER := 500;

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
        o_protocolo      OUT VARCHAR2,
        p_ignorar_duplicada IN CHAR DEFAULT 'N');

    PROCEDURE apoiar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                     o_qt_apoios OUT NUMBER, o_prioridade OUT NUMBER);

    -- p_foto_solucao: nome do arquivo da foto do servico pronto; so e
    -- aceita quando o novo status e RESOLVIDA. CANCELADA exige motivo.
    PROCEDURE atualizar_status(p_id_ocorrencia IN NUMBER, p_id_gestor IN NUMBER,
                               p_novo_status IN VARCHAR2, p_comentario IN VARCHAR2,
                               p_foto_solucao IN VARCHAR2 DEFAULT NULL);

    PROCEDURE avaliar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                      p_nota IN NUMBER, p_comentario IN VARCHAR2);

    -- Comentario na linha do tempo: autor, quem apoiou ou gestor, so com
    -- a ocorrencia ainda em aberto. Avisa autor e apoiadores.
    PROCEDURE comentar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                       p_texto IN VARCHAR2);

    -- O proprio autor desiste do pedido enquanto ninguem da prefeitura
    -- comecou a analisar (status ABERTA). Motivo obrigatorio.
    PROCEDURE cancelar_pelo_autor(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                                  p_motivo IN VARCHAR2);

    -- Maiusculas e sem acento, para a busca "calcada" achar "Calçada".
    FUNCTION normalizar(p_texto VARCHAR2) RETURN VARCHAR2 DETERMINISTIC;

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
        o_protocolo      OUT VARCHAR2,
        p_ignorar_duplicada IN CHAR DEFAULT 'N')
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
        -- 'S' quando o cidadao viu o aviso e confirmou que e outro problema.
        IF v_duplicada IS NOT NULL AND NVL(p_ignorar_duplicada, 'N') <> 'S' THEN
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

        pkg_zl_log.registrar('REGISTRAR', 'Ocorrência ' || o_protocolo || ' aberta.', 1);
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

        -- Autor fica sabendo que a vizinhanca confirmou o problema.
        pkg_zl_notificacao.apoio_recebido(p_id_ocorrencia, p_id_usuario);
    END apoiar;

    -- -----------------------------------------------------------------
    -- Passo comum a gestor e autor: grava o novo status (o trigger escreve
    -- a linha do tempo com o contexto abaixo), recalcula a prioridade e
    -- avisa autor e apoiadores. As notificacoes saem daqui, e nao do
    -- trigger, para um UPDATE manual de manutencao nao disparar avisos.
    -- -----------------------------------------------------------------
    PROCEDURE trocar_status(p_id_ocorrencia IN NUMBER, p_novo IN VARCHAR2,
                            p_comentario IN VARCHAR2, p_id_usuario IN NUMBER,
                            p_foto_solucao IN VARCHAR2)
    IS
        v_prioridade NUMBER;
    BEGIN
        g_comentario := SUBSTR(TRIM(p_comentario), 1, 500);
        g_usuario    := p_id_usuario;

        UPDATE zl_ocorrencia
           SET st_ocorrencia   = p_novo,
               dt_resolucao    = CASE WHEN p_novo = 'RESOLVIDA' THEN SYSDATE END,
               ds_foto_solucao = CASE WHEN p_novo = 'RESOLVIDA' THEN p_foto_solucao END
         WHERE id_ocorrencia = p_id_ocorrencia;

        g_comentario := NULL;
        g_usuario    := NULL;

        v_prioridade := calcular_prioridade(p_id_ocorrencia);
        UPDATE zl_ocorrencia
           SET nr_prioridade = v_prioridade
         WHERE id_ocorrencia = p_id_ocorrencia;

        pkg_zl_notificacao.status_alterado(p_id_ocorrencia, p_novo, p_comentario, p_id_usuario);
    EXCEPTION
        WHEN OTHERS THEN
            g_comentario := NULL;
            g_usuario    := NULL;
            RAISE;
    END trocar_status;

    -- -----------------------------------------------------------------
    PROCEDURE atualizar_status(p_id_ocorrencia IN NUMBER, p_id_gestor IN NUMBER,
                               p_novo_status IN VARCHAR2, p_comentario IN VARCHAR2,
                               p_foto_solucao IN VARCHAR2 DEFAULT NULL)
    IS
        v_papel  zl_usuario.tp_papel%TYPE;
        v_atual  zl_ocorrencia.st_ocorrencia%TYPE;
        v_autor  zl_ocorrencia.id_usuario%TYPE;
        v_novo   VARCHAR2(15) := UPPER(TRIM(p_novo_status));
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
                'Não é possível passar de "' || pkg_zl_notificacao.rotulo_status(v_atual)
                || '" para "' || NVL(pkg_zl_notificacao.rotulo_status(v_novo), '?') || '".');
        END IF;

        -- Cancelar sem explicar deixa o cidadao sem resposta: o motivo
        -- aparece na linha do tempo e na notificacao.
        IF v_novo = 'CANCELADA' AND NVL(LENGTH(TRIM(p_comentario)), 0) < c_min_motivo THEN
            RAISE_APPLICATION_ERROR(-20117,
                'Para cancelar, explique o motivo com pelo menos ' || c_min_motivo || ' letras.');
        END IF;

        IF TRIM(p_foto_solucao) IS NOT NULL AND v_novo <> 'RESOLVIDA' THEN
            RAISE_APPLICATION_ERROR(-20123,
                'A foto da solução só pode ser enviada ao marcar a ocorrência como resolvida.');
        END IF;

        trocar_status(p_id_ocorrencia, v_novo, p_comentario, p_id_gestor, TRIM(p_foto_solucao));

        -- Quem relatou um problema que foi resolvido ganha pontos extras.
        IF v_novo = 'RESOLVIDA' THEN
            somar_pontos(v_autor, 5);
        END IF;
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

    -- -----------------------------------------------------------------
    PROCEDURE comentar(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                       p_texto IN VARCHAR2)
    IS
        v_papel   zl_usuario.tp_papel%TYPE;
        v_autor   zl_ocorrencia.id_usuario%TYPE;
        v_status  zl_ocorrencia.st_ocorrencia%TYPE;
        v_apoiou  NUMBER;
        v_texto   VARCHAR2(32767) := TRIM(p_texto);
    BEGIN
        BEGIN
            SELECT tp_papel INTO v_papel FROM zl_usuario WHERE id_usuario = p_id_usuario;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20101, 'Usuário ' || p_id_usuario || ' não encontrado.');
        END;

        BEGIN
            SELECT id_usuario, st_ocorrencia INTO v_autor, v_status
              FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20115, 'Ocorrência ' || p_id_ocorrencia || ' não encontrada.');
        END;

        SELECT COUNT(*) INTO v_apoiou FROM zl_apoio
         WHERE id_ocorrencia = p_id_ocorrencia AND id_usuario = p_id_usuario;

        -- Conversa fica entre quem tem relacao com o problema e a
        -- prefeitura; evita a linha do tempo virar mural aberto.
        IF v_papel <> 'GESTOR' AND v_autor <> p_id_usuario AND v_apoiou = 0 THEN
            RAISE_APPLICATION_ERROR(-20119,
                'Só quem registrou, quem apoiou ou a prefeitura pode comentar nesta ocorrência. '
                || 'Apoie o problema para participar da conversa.');
        END IF;

        IF v_status IN ('RESOLVIDA', 'CANCELADA') THEN
            RAISE_APPLICATION_ERROR(-20107, 'Esta ocorrência já foi encerrada e não recebe mais comentários.');
        END IF;

        IF NVL(LENGTH(v_texto), 0) < c_min_comentario OR LENGTH(v_texto) > c_max_comentario THEN
            RAISE_APPLICATION_ERROR(-20118,
                'O comentário precisa ter de ' || c_min_comentario || ' a ' || c_max_comentario || ' letras.');
        END IF;

        INSERT INTO zl_historico (id_historico, id_ocorrencia, st_anterior, st_novo,
                                  ds_comentario, id_usuario, tp_evento)
        VALUES (seq_zl_historico.NEXTVAL, p_id_ocorrencia, v_status, v_status,
                v_texto, p_id_usuario, 'COMENTARIO');

        pkg_zl_notificacao.comentario_novo(p_id_ocorrencia, p_id_usuario, v_texto);
    END comentar;

    -- -----------------------------------------------------------------
    PROCEDURE cancelar_pelo_autor(p_id_ocorrencia IN NUMBER, p_id_usuario IN NUMBER,
                                  p_motivo IN VARCHAR2)
    IS
        v_autor  zl_ocorrencia.id_usuario%TYPE;
        v_status zl_ocorrencia.st_ocorrencia%TYPE;
        v_prot   zl_ocorrencia.cd_protocolo%TYPE;
    BEGIN
        IF NOT usuario_existe(p_id_usuario) THEN
            RAISE_APPLICATION_ERROR(-20101, 'Usuário ' || p_id_usuario || ' não encontrado.');
        END IF;

        BEGIN
            SELECT id_usuario, st_ocorrencia, cd_protocolo INTO v_autor, v_status, v_prot
              FROM zl_ocorrencia WHERE id_ocorrencia = p_id_ocorrencia
               FOR UPDATE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20115, 'Ocorrência ' || p_id_ocorrencia || ' não encontrada.');
        END;

        IF v_autor <> p_id_usuario THEN
            RAISE_APPLICATION_ERROR(-20121, 'Somente quem registrou pode cancelar a ocorrência.');
        END IF;

        IF v_status <> 'ABERTA' THEN
            RAISE_APPLICATION_ERROR(-20122,
                'A prefeitura já começou a cuidar desta ocorrência ("'
                || pkg_zl_notificacao.rotulo_status(v_status)
                || '"), então ela não pode mais ser cancelada pelo aplicativo.');
        END IF;

        IF NVL(LENGTH(TRIM(p_motivo)), 0) < c_min_motivo THEN
            RAISE_APPLICATION_ERROR(-20117,
                'Conte o motivo do cancelamento com pelo menos ' || c_min_motivo || ' letras.');
        END IF;

        trocar_status(p_id_ocorrencia, 'CANCELADA',
                      'Cancelada por quem registrou. Motivo: ' || TRIM(p_motivo),
                      p_id_usuario, NULL);

        -- Devolve os pontos do registro: registrar e cancelar em seguida
        -- nao pode virar atalho para subir no ranking.
        UPDATE zl_usuario
           SET nr_pontos = GREATEST(nr_pontos - 10, 0)
         WHERE id_usuario = p_id_usuario;

        pkg_zl_log.registrar('CANCELAR_PELO_AUTOR', 'Ocorrência ' || v_prot || ' cancelada por quem relatou.', 1);
    END cancelar_pelo_autor;

    -- -----------------------------------------------------------------
    FUNCTION normalizar(p_texto VARCHAR2) RETURN VARCHAR2 DETERMINISTIC IS
    BEGIN
        RETURN UPPER(TRANSLATE(p_texto,
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'));
    END normalizar;

END pkg_zl_ocorrencia;
/
