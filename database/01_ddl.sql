-- =====================================================================
-- ZELO | Zeladoria urbana centrada no cidadao
-- Global Solution 2 (2026) | Yuri Sousa, RM 556163
--
-- 01_ddl.sql: tabelas, sequences, restricoes e indices.
-- Prefixo ZL_ para conviver no mesmo schema com outros projetos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bairros atendidos. A populacao serve para calcular a taxa de
-- ocorrencias por mil habitantes nos indicadores.
-- ---------------------------------------------------------------------
CREATE TABLE zl_bairro (
    id_bairro      NUMBER(6)      NOT NULL,
    nm_bairro      VARCHAR2(80)   NOT NULL,
    nm_regiao      VARCHAR2(40)   NOT NULL,
    nr_populacao   NUMBER(8)      NOT NULL,
    nr_latitude    NUMBER(9,6)    NOT NULL,
    nr_longitude   NUMBER(9,6)    NOT NULL,
    CONSTRAINT pk_zl_bairro PRIMARY KEY (id_bairro),
    CONSTRAINT uk_zl_bairro_nome UNIQUE (nm_bairro),
    CONSTRAINT ck_zl_bairro_pop CHECK (nr_populacao > 0)
);

-- ---------------------------------------------------------------------
-- Categorias de problema. Cada uma tem o prazo de atendimento (SLA) e o
-- peso usado no calculo de prioridade (1 a 5).
-- ---------------------------------------------------------------------
CREATE TABLE zl_categoria (
    id_categoria   NUMBER(4)      NOT NULL,
    nm_categoria   VARCHAR2(60)   NOT NULL,
    ds_icone       VARCHAR2(30)   NOT NULL,
    nr_prazo_dias  NUMBER(3)      NOT NULL,
    nr_peso        NUMBER(1)      NOT NULL,
    nm_orgao       VARCHAR2(80)   NOT NULL,
    CONSTRAINT pk_zl_categoria PRIMARY KEY (id_categoria),
    CONSTRAINT uk_zl_categoria_nome UNIQUE (nm_categoria),
    CONSTRAINT ck_zl_categoria_prazo CHECK (nr_prazo_dias BETWEEN 1 AND 180),
    CONSTRAINT ck_zl_categoria_peso CHECK (nr_peso BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------
-- Usuarios. CIDADAO registra e apoia; GESTOR e o servidor da
-- prefeitura que atualiza o andamento.
-- ---------------------------------------------------------------------
CREATE TABLE zl_usuario (
    id_usuario     NUMBER(10)     NOT NULL,
    nm_usuario     VARCHAR2(100)  NOT NULL,
    ds_email       VARCHAR2(120)  NOT NULL,
    ds_senha_hash  VARCHAR2(100)  NOT NULL,
    tp_papel       VARCHAR2(10)   DEFAULT 'CIDADAO' NOT NULL,
    id_bairro      NUMBER(6),
    nr_pontos      NUMBER(8)      DEFAULT 0 NOT NULL,
    fl_fonte_grande CHAR(1)       DEFAULT 'N' NOT NULL,
    dt_cadastro    DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uk_zl_usuario_email UNIQUE (ds_email),
    CONSTRAINT ck_zl_usuario_papel CHECK (tp_papel IN ('CIDADAO', 'GESTOR')),
    CONSTRAINT ck_zl_usuario_fonte CHECK (fl_fonte_grande IN ('S', 'N')),
    CONSTRAINT fk_zl_usuario_bairro FOREIGN KEY (id_bairro)
        REFERENCES zl_bairro (id_bairro)
);

-- ---------------------------------------------------------------------
-- Ocorrencia: o problema relatado pelo cidadao. Protocolo, prazo e
-- prioridade sao calculados pelo PL/SQL, nunca pelo aplicativo.
-- ---------------------------------------------------------------------
CREATE TABLE zl_ocorrencia (
    id_ocorrencia     NUMBER(10)     NOT NULL,
    cd_protocolo      VARCHAR2(20)   NOT NULL,
    id_usuario        NUMBER(10)     NOT NULL,
    id_categoria      NUMBER(4)      NOT NULL,
    id_bairro         NUMBER(6)      NOT NULL,
    ds_titulo         VARCHAR2(120)  NOT NULL,
    ds_descricao      VARCHAR2(1000),
    ds_endereco       VARCHAR2(200),
    nr_latitude       NUMBER(9,6)    NOT NULL,
    nr_longitude      NUMBER(9,6)    NOT NULL,
    ds_foto           VARCHAR2(200),
    ds_foto_solucao   VARCHAR2(200),
    fl_risco          CHAR(1)        DEFAULT 'N' NOT NULL,
    fl_acessibilidade CHAR(1)        DEFAULT 'N' NOT NULL,
    st_ocorrencia     VARCHAR2(15)   DEFAULT 'ABERTA' NOT NULL,
    nr_prioridade     NUMBER(3)      DEFAULT 0 NOT NULL,
    qt_apoios         NUMBER(6)      DEFAULT 0 NOT NULL,
    dt_abertura       DATE           DEFAULT SYSDATE NOT NULL,
    dt_prazo          DATE           NOT NULL,
    dt_resolucao      DATE,
    CONSTRAINT pk_zl_ocorrencia PRIMARY KEY (id_ocorrencia),
    CONSTRAINT uk_zl_ocorrencia_protocolo UNIQUE (cd_protocolo),
    CONSTRAINT ck_zl_ocorrencia_status CHECK (st_ocorrencia IN
        ('ABERTA', 'EM_ANALISE', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA')),
    CONSTRAINT ck_zl_ocorrencia_risco CHECK (fl_risco IN ('S', 'N')),
    CONSTRAINT ck_zl_ocorrencia_acess CHECK (fl_acessibilidade IN ('S', 'N')),
    CONSTRAINT ck_zl_ocorrencia_prior CHECK (nr_prioridade BETWEEN 0 AND 100),
    CONSTRAINT ck_zl_ocorrencia_datas CHECK (dt_resolucao IS NULL OR dt_resolucao >= dt_abertura),
    CONSTRAINT fk_zl_ocorrencia_usuario FOREIGN KEY (id_usuario)
        REFERENCES zl_usuario (id_usuario),
    CONSTRAINT fk_zl_ocorrencia_categoria FOREIGN KEY (id_categoria)
        REFERENCES zl_categoria (id_categoria),
    CONSTRAINT fk_zl_ocorrencia_bairro FOREIGN KEY (id_bairro)
        REFERENCES zl_bairro (id_bairro)
);

-- ---------------------------------------------------------------------
-- Apoio: outro morador confirma que viu o mesmo problema. Chave
-- composta impede apoiar duas vezes a mesma ocorrencia.
-- ---------------------------------------------------------------------
CREATE TABLE zl_apoio (
    id_ocorrencia  NUMBER(10)     NOT NULL,
    id_usuario     NUMBER(10)     NOT NULL,
    dt_apoio       DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_apoio PRIMARY KEY (id_ocorrencia, id_usuario),
    CONSTRAINT fk_zl_apoio_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES zl_ocorrencia (id_ocorrencia) ON DELETE CASCADE,
    CONSTRAINT fk_zl_apoio_usuario FOREIGN KEY (id_usuario)
        REFERENCES zl_usuario (id_usuario)
);

-- ---------------------------------------------------------------------
-- Linha do tempo da ocorrencia. Preenchida pelo trigger de status,
-- entao o historico existe mesmo se alguem mudar o status por fora da API.
-- ---------------------------------------------------------------------
CREATE TABLE zl_historico (
    id_historico     NUMBER(12)    NOT NULL,
    id_ocorrencia    NUMBER(10)    NOT NULL,
    st_anterior      VARCHAR2(15),
    st_novo          VARCHAR2(15)  NOT NULL,
    ds_comentario    VARCHAR2(500),
    id_usuario       NUMBER(10),
    tp_evento        VARCHAR2(12)  DEFAULT 'STATUS' NOT NULL,
    dt_evento        DATE          DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_historico PRIMARY KEY (id_historico),
    CONSTRAINT ck_zl_historico_tipo CHECK (tp_evento IN ('REGISTRO', 'STATUS', 'COMENTARIO', 'ATRASO')),
    CONSTRAINT fk_zl_historico_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES zl_ocorrencia (id_ocorrencia) ON DELETE CASCADE,
    CONSTRAINT fk_zl_historico_usuario FOREIGN KEY (id_usuario)
        REFERENCES zl_usuario (id_usuario)
);

-- ---------------------------------------------------------------------
-- Notificacoes dentro do app: troca de status, atraso, apoio novo e
-- comentario. Geradas pelo PKG_ZL_NOTIFICACAO, nunca pela API.
-- ---------------------------------------------------------------------
CREATE TABLE zl_notificacao (
    id_notificacao   NUMBER(12)    NOT NULL,
    id_usuario       NUMBER(10)    NOT NULL,
    id_ocorrencia    NUMBER(10)    NOT NULL,
    tp_notificacao   VARCHAR2(12)  NOT NULL,
    ds_titulo        VARCHAR2(100) NOT NULL,
    ds_mensagem      VARCHAR2(500) NOT NULL,
    fl_lida          CHAR(1)       DEFAULT 'N' NOT NULL,
    dt_criacao       DATE          DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_notificacao PRIMARY KEY (id_notificacao),
    CONSTRAINT ck_zl_notificacao_tipo CHECK (tp_notificacao IN ('STATUS', 'ATRASO', 'APOIO', 'COMENTARIO')),
    CONSTRAINT ck_zl_notificacao_lida CHECK (fl_lida IN ('S', 'N')),
    CONSTRAINT fk_zl_notificacao_usuario FOREIGN KEY (id_usuario)
        REFERENCES zl_usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_zl_notificacao_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES zl_ocorrencia (id_ocorrencia) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Avaliacao do atendimento, feita pelo autor depois de resolvida.
-- Relacao 1:1 com a ocorrencia (a PK e a propria FK).
-- ---------------------------------------------------------------------
CREATE TABLE zl_avaliacao (
    id_ocorrencia  NUMBER(10)     NOT NULL,
    nr_nota        NUMBER(1)      NOT NULL,
    ds_comentario  VARCHAR2(500),
    dt_avaliacao   DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_avaliacao PRIMARY KEY (id_ocorrencia),
    CONSTRAINT ck_zl_avaliacao_nota CHECK (nr_nota BETWEEN 1 AND 5),
    CONSTRAINT fk_zl_avaliacao_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES zl_ocorrencia (id_ocorrencia) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Indicadores consolidados por bairro e mes. Gerados pela rotina
-- PKG_ZL_INDICADOR.gerar_indicadores e lidos pelo painel de transparencia.
-- ---------------------------------------------------------------------
CREATE TABLE zl_indicador (
    id_bairro         NUMBER(6)     NOT NULL,
    cd_mes            CHAR(7)       NOT NULL,
    qt_abertas        NUMBER(6)     DEFAULT 0 NOT NULL,
    qt_resolvidas     NUMBER(6)     DEFAULT 0 NOT NULL,
    qt_atrasadas      NUMBER(6)     DEFAULT 0 NOT NULL,
    nr_tempo_medio    NUMBER(6,1),
    pc_no_prazo       NUMBER(5,1),
    nr_nota_media     NUMBER(3,2),
    nr_taxa_mil_hab   NUMBER(7,2),
    dt_geracao        DATE          DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_indicador PRIMARY KEY (id_bairro, cd_mes),
    CONSTRAINT ck_zl_indicador_mes CHECK (REGEXP_LIKE(cd_mes, '^[0-9]{4}-[0-9]{2}$')),
    CONSTRAINT fk_zl_indicador_bairro FOREIGN KEY (id_bairro)
        REFERENCES zl_bairro (id_bairro)
);

-- ---------------------------------------------------------------------
-- Log das rotinas automaticas (quem rodou, o que fez, quantas linhas).
-- ---------------------------------------------------------------------
CREATE TABLE zl_log_rotina (
    id_log         NUMBER(12)     NOT NULL,
    nm_rotina      VARCHAR2(60)   NOT NULL,
    ds_mensagem    VARCHAR2(500)  NOT NULL,
    qt_linhas      NUMBER(8)      DEFAULT 0 NOT NULL,
    tp_nivel       VARCHAR2(5)    DEFAULT 'INFO' NOT NULL,
    dt_execucao    DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_zl_log_rotina PRIMARY KEY (id_log),
    CONSTRAINT ck_zl_log_nivel CHECK (tp_nivel IN ('INFO', 'AVISO', 'ERRO'))
);

-- ---------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------
CREATE SEQUENCE seq_zl_usuario    START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_zl_ocorrencia START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_zl_historico  START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_zl_log        START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_zl_notificacao START WITH 1 INCREMENT BY 1 NOCACHE;

-- ---------------------------------------------------------------------
-- Indices para as consultas que o app faz o tempo todo: mapa por bairro
-- e status, fila do gestor por prioridade, "minhas ocorrencias" e
-- notificacoes.
-- ---------------------------------------------------------------------
CREATE INDEX ix_zl_ocorr_bairro_status ON zl_ocorrencia (id_bairro, st_ocorrencia);
CREATE INDEX ix_zl_ocorr_prioridade    ON zl_ocorrencia (st_ocorrencia, nr_prioridade DESC);
CREATE INDEX ix_zl_ocorr_usuario       ON zl_ocorrencia (id_usuario, dt_abertura DESC);
CREATE INDEX ix_zl_ocorr_categoria     ON zl_ocorrencia (id_categoria);
CREATE INDEX ix_zl_apoio_usuario       ON zl_apoio (id_usuario);
CREATE INDEX ix_zl_historico_ocorr     ON zl_historico (id_ocorrencia, dt_evento);
CREATE INDEX ix_zl_usuario_bairro      ON zl_usuario (id_bairro);
-- Sininho do app: "nao lidas do usuario, mais novas primeiro".
CREATE INDEX ix_zl_notif_usuario       ON zl_notificacao (id_usuario, fl_lida, dt_criacao DESC);
CREATE INDEX ix_zl_notif_ocorrencia    ON zl_notificacao (id_ocorrencia);
