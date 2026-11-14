-- =====================================================================
-- ZELO | 06_seed.sql
-- Carga de demonstracao. As datas sao relativas a SYSDATE, entao o
-- banco sempre fica com:
--   * ocorrencias recentes (ultimas 6 semanas), algumas no prazo, algumas
--     atrasadas e algumas resolvidas e avaliadas;
--   * historico de ~6 meses: ocorrencias antigas ja resolvidas (ou
--     canceladas com motivo), espalhadas pelos meses e bairros, para o
--     grafico mes a mes do painel ter dados reais;
--   * notificacoes coerentes com cada evento (as dos ultimos 7 dias ficam
--     como nao lidas).
--
-- Logins (senha):
--   ana@zelo.app       123456     cidada, Itaquera
--   joaquim@zelo.app   123456     cidadao idoso, fonte grande ligada
--   mariana@zelo.app   123456     cidada cadeirante, Vila Mariana
--   carlos@zelo.app    123456     cidadao, Capao Redondo
--   gestor@zelo.app    gestor123  gestor da prefeitura
--
-- De proposito, a carga NAO roda detectar_atrasos nem gera os
-- indicadores do mes atual: assim as rotinas tem trabalho de verdade
-- na demonstracao. Os 5 meses anteriores ja saem consolidados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bairros (populacao aproximada dos distritos, para a taxa por mil hab.)
-- ---------------------------------------------------------------------
INSERT INTO zl_bairro VALUES (1, 'Itaquera',      'Zona Leste', 204871, -23.536300, -46.455900);
INSERT INTO zl_bairro VALUES (2, 'Vila Mariana',  'Zona Sul',   130484, -23.589000, -46.634000);
INSERT INTO zl_bairro VALUES (3, 'Capão Redondo', 'Zona Sul',   268729, -23.671900, -46.779400);
INSERT INTO zl_bairro VALUES (4, 'Santana',       'Zona Norte', 118797, -23.502400, -46.624900);
INSERT INTO zl_bairro VALUES (5, 'Pinheiros',     'Zona Oeste',  65364, -23.567400, -46.693000);
INSERT INTO zl_bairro VALUES (6, 'Brasilândia',   'Zona Norte', 264918, -23.456500, -46.687000);

-- ---------------------------------------------------------------------
-- Categorias: prazo (dias), peso (1-5) e orgao responsavel.
-- O icone e o nome do icone Lucide usado pelo aplicativo.
-- ---------------------------------------------------------------------
INSERT INTO zl_categoria VALUES (1, 'Buraco na via',            'construction',  15, 4, 'Subprefeitura / Conservação viária');
INSERT INTO zl_categoria VALUES (2, 'Iluminação apagada',       'lightbulb-off',  5, 4, 'Departamento de Iluminação Pública');
INSERT INTO zl_categoria VALUES (3, 'Calçada e acessibilidade', 'accessibility', 30, 3, 'Subprefeitura / Calçadas');
INSERT INTO zl_categoria VALUES (4, 'Lixo e entulho',           'trash-2',        3, 3, 'Limpeza urbana');
INSERT INTO zl_categoria VALUES (5, 'Vazamento de água',        'droplets',       2, 5, 'Companhia de saneamento');
INSERT INTO zl_categoria VALUES (6, 'Árvore com risco',         'tree-pine',      7, 5, 'Subprefeitura / Áreas verdes');
INSERT INTO zl_categoria VALUES (7, 'Sinalização de trânsito',  'traffic-cone',  10, 3, 'Engenharia de tráfego');
INSERT INTO zl_categoria VALUES (8, 'Alagamento e bueiro',      'cloud-rain',     5, 4, 'Drenagem urbana');

-- ---------------------------------------------------------------------
-- Usuarios (hash BCrypt das senhas acima). Cadastro antigo o bastante
-- para cobrir o historico de 6 meses.
-- ---------------------------------------------------------------------
INSERT INTO zl_usuario (id_usuario, nm_usuario, ds_email, ds_senha_hash, tp_papel, id_bairro, fl_fonte_grande, dt_cadastro)
VALUES (seq_zl_usuario.NEXTVAL, 'Ana Paula Ribeiro', 'ana@zelo.app',
        '$2b$10$a6yfgeNbyWNbJtGyas7zv.5C2muryYLS2kSY/XqmFet6VmQ422YSm', 'CIDADAO', 1, 'N', TRUNC(SYSDATE) - 210);
INSERT INTO zl_usuario (id_usuario, nm_usuario, ds_email, ds_senha_hash, tp_papel, id_bairro, fl_fonte_grande, dt_cadastro)
VALUES (seq_zl_usuario.NEXTVAL, 'Joaquim Ferreira', 'joaquim@zelo.app',
        '$2b$10$a6yfgeNbyWNbJtGyas7zv.5C2muryYLS2kSY/XqmFet6VmQ422YSm', 'CIDADAO', 1, 'S', TRUNC(SYSDATE) - 200);
INSERT INTO zl_usuario (id_usuario, nm_usuario, ds_email, ds_senha_hash, tp_papel, id_bairro, fl_fonte_grande, dt_cadastro)
VALUES (seq_zl_usuario.NEXTVAL, 'Mariana Costa', 'mariana@zelo.app',
        '$2b$10$a6yfgeNbyWNbJtGyas7zv.5C2muryYLS2kSY/XqmFet6VmQ422YSm', 'CIDADAO', 2, 'N', TRUNC(SYSDATE) - 195);
INSERT INTO zl_usuario (id_usuario, nm_usuario, ds_email, ds_senha_hash, tp_papel, id_bairro, fl_fonte_grande, dt_cadastro)
VALUES (seq_zl_usuario.NEXTVAL, 'Carlos Mendes', 'carlos@zelo.app',
        '$2b$10$a6yfgeNbyWNbJtGyas7zv.5C2muryYLS2kSY/XqmFet6VmQ422YSm', 'CIDADAO', 3, 'N', TRUNC(SYSDATE) - 190);
INSERT INTO zl_usuario (id_usuario, nm_usuario, ds_email, ds_senha_hash, tp_papel, id_bairro, fl_fonte_grande, dt_cadastro)
VALUES (seq_zl_usuario.NEXTVAL, 'Equipe Subprefeitura', 'gestor@zelo.app',
        '$2b$10$THVGDPv0ReC5f3roSJHWj.ZA.fKzPvFr4i9NKIqiUv4MHogsv0BX.', 'GESTOR', NULL, 'N', TRUNC(SYSDATE) - 240);

COMMIT;

-- ---------------------------------------------------------------------
-- Ocorrencias com historico e notificacoes. Os ids de usuario seguem a
-- ordem acima: 1 Ana, 2 Joaquim, 3 Mariana, 4 Carlos, 5 Gestor.
--
-- Os helpers usam as mesmas rotinas de notificacao do app e depois
-- voltam a data de cada linha para o dia do evento.
-- ---------------------------------------------------------------------
DECLARE
    c_gestor CONSTANT NUMBER := 5;
    v_id NUMBER;

    -- Ultimo id de notificacao antes de um evento (para datar as novas).
    FUNCTION marca RETURN NUMBER IS
        v NUMBER;
    BEGIN
        SELECT NVL(MAX(id_notificacao), 0) INTO v FROM zl_notificacao;
        RETURN v;
    END marca;

    PROCEDURE datar_notificacoes(p_desde NUMBER, p_dt DATE) IS
    BEGIN
        UPDATE zl_notificacao SET dt_criacao = p_dt WHERE id_notificacao > p_desde;
    END datar_notificacoes;

    FUNCTION nova_em(p_usuario NUMBER, p_cat NUMBER, p_bairro NUMBER,
                     p_titulo VARCHAR2, p_desc VARCHAR2, p_end VARCHAR2,
                     p_lat NUMBER, p_lon NUMBER, p_risco CHAR, p_acess CHAR,
                     p_dt DATE) RETURN NUMBER
    IS
        v_novo NUMBER := seq_zl_ocorrencia.NEXTVAL;
    BEGIN
        INSERT INTO zl_ocorrencia (
            id_ocorrencia, cd_protocolo, id_usuario, id_categoria, id_bairro,
            ds_titulo, ds_descricao, ds_endereco, nr_latitude, nr_longitude,
            fl_risco, fl_acessibilidade, dt_abertura, dt_prazo)
        VALUES (
            v_novo, pkg_zl_ocorrencia.gerar_protocolo(v_novo, p_dt),
            p_usuario, p_cat, p_bairro, p_titulo, p_desc, p_end, p_lat, p_lon,
            p_risco, p_acess, p_dt,
            pkg_zl_ocorrencia.calcular_prazo(p_cat, p_risco, p_dt));
        RETURN v_novo;
    END nova_em;

    FUNCTION nova(p_usuario NUMBER, p_cat NUMBER, p_bairro NUMBER,
                  p_titulo VARCHAR2, p_desc VARCHAR2, p_end VARCHAR2,
                  p_lat NUMBER, p_lon NUMBER, p_risco CHAR, p_acess CHAR,
                  p_dias NUMBER) RETURN NUMBER
    IS
    BEGIN
        RETURN nova_em(p_usuario, p_cat, p_bairro, p_titulo, p_desc, p_end, p_lat, p_lon,
                       p_risco, p_acess,
                       TRUNC(SYSDATE) - p_dias + (9 + MOD(p_dias * 7, 10)) / 24);
    END nova;

    PROCEDURE mover_em(p_id NUMBER, p_status VARCHAR2, p_coment VARCHAR2, p_dt DATE) IS
        v_marca NUMBER := marca;
    BEGIN
        pkg_zl_ocorrencia.g_comentario := p_coment;
        pkg_zl_ocorrencia.g_usuario    := c_gestor;
        UPDATE zl_ocorrencia
           SET st_ocorrencia = p_status,
               dt_resolucao  = CASE WHEN p_status = 'RESOLVIDA' THEN p_dt END
         WHERE id_ocorrencia = p_id;
        pkg_zl_ocorrencia.g_comentario := NULL;
        pkg_zl_ocorrencia.g_usuario    := NULL;
        -- O trigger grava com SYSDATE; aqui a data volta para o passado.
        UPDATE zl_historico SET dt_evento = p_dt
         WHERE id_historico = (SELECT MAX(id_historico) FROM zl_historico WHERE id_ocorrencia = p_id);
        pkg_zl_notificacao.status_alterado(p_id, p_status, p_coment, c_gestor);
        datar_notificacoes(v_marca, p_dt);
    END mover_em;

    PROCEDURE mover(p_id NUMBER, p_status VARCHAR2, p_coment VARCHAR2, p_dias NUMBER) IS
    BEGIN
        mover_em(p_id, p_status, p_coment, TRUNC(SYSDATE) - p_dias + 14 / 24);
    END mover;

    PROCEDURE apoio_em(p_id NUMBER, p_usuario NUMBER, p_dt DATE) IS
        v_marca NUMBER := marca;
    BEGIN
        INSERT INTO zl_apoio VALUES (p_id, p_usuario, p_dt);
        UPDATE zl_ocorrencia SET qt_apoios = qt_apoios + 1 WHERE id_ocorrencia = p_id;
        pkg_zl_notificacao.apoio_recebido(p_id, p_usuario);
        datar_notificacoes(v_marca, p_dt);
    END apoio_em;

    PROCEDURE apoio(p_id NUMBER, p_usuario NUMBER, p_dias NUMBER) IS
    BEGIN
        apoio_em(p_id, p_usuario, TRUNC(SYSDATE) - p_dias + 0.5);
    END apoio;

    PROCEDURE comentario(p_id NUMBER, p_usuario NUMBER, p_texto VARCHAR2, p_dias NUMBER) IS
        v_marca  NUMBER := marca;
        v_dt     DATE   := TRUNC(SYSDATE) - p_dias + 11 / 24;
    BEGIN
        INSERT INTO zl_historico (id_historico, id_ocorrencia, st_anterior, st_novo,
                                  ds_comentario, id_usuario, tp_evento, dt_evento)
        SELECT seq_zl_historico.NEXTVAL, id_ocorrencia, st_ocorrencia, st_ocorrencia,
               p_texto, p_usuario, 'COMENTARIO', v_dt
          FROM zl_ocorrencia WHERE id_ocorrencia = p_id;
        pkg_zl_notificacao.comentario_novo(p_id, p_usuario, p_texto);
        datar_notificacoes(v_marca, v_dt);
    END comentario;

    PROCEDURE avaliacao(p_id NUMBER, p_nota NUMBER, p_coment VARCHAR2) IS
    BEGIN
        INSERT INTO zl_avaliacao (id_ocorrencia, nr_nota, ds_comentario, dt_avaliacao)
        SELECT p_id, p_nota, p_coment, LEAST(dt_resolucao + 1, SYSDATE)
          FROM zl_ocorrencia WHERE id_ocorrencia = p_id;
    END avaliacao;

    -- -----------------------------------------------------------------
    -- Textos do historico de 6 meses (2 variacoes por categoria).
    -- -----------------------------------------------------------------
    FUNCTION titulo_hist(p_cat NUMBER, p_v NUMBER) RETURN VARCHAR2 IS
    BEGIN
        RETURN CASE p_cat * 10 + p_v
            WHEN 11 THEN 'Buraco na pista perto do ponto de ônibus'
            WHEN 12 THEN 'Asfalto afundado na esquina'
            WHEN 21 THEN 'Poste apagado no meio do quarteirão'
            WHEN 22 THEN 'Lâmpada do poste piscando a noite toda'
            WHEN 31 THEN 'Calçada quebrada com degrau alto'
            WHEN 32 THEN 'Rampa de acessibilidade danificada'
            WHEN 41 THEN 'Lixo acumulado na esquina'
            WHEN 42 THEN 'Entulho de obra deixado na calçada'
            WHEN 51 THEN 'Vazamento de água na calçada'
            WHEN 52 THEN 'Cano estourado na sarjeta'
            WHEN 61 THEN 'Galho ameaçando cair sobre a calçada'
            WHEN 62 THEN 'Árvore com cupim e tronco oco'
            WHEN 71 THEN 'Faixa de pedestre apagada'
            WHEN 72 THEN 'Placa de velocidade derrubada'
            WHEN 81 THEN 'Bueiro entupido na esquina'
            ELSE         'Rua alaga com qualquer chuva'
        END;
    END titulo_hist;

    FUNCTION descricao_hist(p_cat NUMBER) RETURN VARCHAR2 IS
    BEGIN
        RETURN CASE p_cat
            WHEN 1 THEN 'Os carros desviam de repente e já teve moto caindo aqui.'
            WHEN 2 THEN 'O trecho fica escuro e os moradores evitam passar à noite.'
            WHEN 3 THEN 'Quem usa cadeira de rodas ou carrinho de bebê precisa ir pela rua.'
            WHEN 4 THEN 'O acúmulo atrai ratos e o cheiro está forte.'
            WHEN 5 THEN 'A água escorre o dia todo pela calçada.'
            WHEN 6 THEN 'Com vento forte a árvore balança muito perto da fiação.'
            WHEN 7 THEN 'Os motoristas não respeitam a travessia sem a sinalização.'
            ELSE        'Quando chove a água invade a calçada e o portão das casas.'
        END;
    END descricao_hist;

    FUNCTION solucao_hist(p_cat NUMBER) RETURN VARCHAR2 IS
    BEGIN
        RETURN CASE p_cat
            WHEN 1 THEN 'Buraco tapado e asfalto nivelado.'
            WHEN 2 THEN 'Lâmpada trocada por LED.'
            WHEN 3 THEN 'Calçada refeita com rampa no padrão de acessibilidade.'
            WHEN 4 THEN 'Material recolhido e área limpa.'
            WHEN 5 THEN 'Tubulação consertada pela companhia de saneamento.'
            WHEN 6 THEN 'Poda de segurança realizada.'
            WHEN 7 THEN 'Sinalização refeita.'
            ELSE        'Galeria desobstruída e bueiro limpo.'
        END;
    END solucao_hist;

    FUNCTION rua_hist(p_bairro NUMBER, p_v NUMBER) RETURN VARCHAR2 IS
    BEGIN
        RETURN CASE p_bairro * 10 + p_v
            WHEN 11 THEN 'Av. Itaquera'
            WHEN 12 THEN 'Rua Gregório Ramalho'
            WHEN 13 THEN 'Rua Victório Santim'
            WHEN 21 THEN 'Rua Joaquim Távora'
            WHEN 22 THEN 'Rua França Pinto'
            WHEN 23 THEN 'Rua Domingos de Morais'
            WHEN 31 THEN 'Estrada de Itapecerica'
            WHEN 32 THEN 'Av. Ellis Maas'
            WHEN 33 THEN 'Rua Comendador Antunes dos Santos'
            WHEN 41 THEN 'Av. Cruzeiro do Sul'
            WHEN 42 THEN 'Rua Voluntários da Pátria'
            WHEN 43 THEN 'Rua Dr. César'
            WHEN 51 THEN 'Rua Teodoro Sampaio'
            WHEN 52 THEN 'Rua dos Pinheiros'
            WHEN 53 THEN 'Rua Cardeal Arcoverde'
            WHEN 61 THEN 'Av. Inajar de Souza'
            WHEN 62 THEN 'Rua Parapuã'
            ELSE         'Av. Deputado Cantídio Sampaio'
        END;
    END rua_hist;

    -- -----------------------------------------------------------------
    -- Historico: 8 ocorrencias por mes nos 5 meses anteriores ao atual.
    -- Todas encerradas (resolvidas, quase todas avaliadas, e algumas
    -- canceladas com motivo). Uma em cada tres estoura o prazo, para o
    -- "% no prazo" do painel nao ficar artificialmente em 100%.
    -- -----------------------------------------------------------------
    PROCEDURE gerar_historico IS
        v_oc     NUMBER;
        v_cat    NUMBER;
        v_bairro NUMBER;
        v_autor  NUMBER;
        v_risco  CHAR(1);
        v_ab     DATE;
        v_prazo  DATE;
        v_res    DATE;
        v_dias   NUMBER;
        v_atraso BOOLEAN;
        v_nota   NUMBER;
        v_lat    NUMBER;
        v_lon    NUMBER;
        v_ap1    NUMBER;
        v_ap2    NUMBER;
    BEGIN
        FOR k IN 1 .. 5 LOOP
            FOR j IN 1 .. 8 LOOP
                v_bairro := MOD(k * 3 + j, 6) + 1;
                v_cat    := MOD(k + j * 3, 8) + 1;
                v_autor  := MOD(k + j, 4) + 1;
                v_risco  := CASE WHEN MOD(j, 3) = 0 THEN 'S' ELSE 'N' END;
                v_ab     := ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -k)
                            + MOD(j * 7 + k * 3, 24) + (8 + MOD(j * 5 + k, 10)) / 24;

                SELECT nr_latitude  + (MOD(j * 37 + k * 11, 40) - 20) / 2500,
                       nr_longitude + (MOD(j * 53 + k * 17, 40) - 20) / 2500
                  INTO v_lat, v_lon
                  FROM zl_bairro WHERE id_bairro = v_bairro;

                v_oc := nova_em(v_autor, v_cat, v_bairro,
                                titulo_hist(v_cat, 1 + MOD(j + k, 2)),
                                descricao_hist(v_cat),
                                rua_hist(v_bairro, 1 + MOD(j, 3)) || ', ' || (100 + MOD(j * k * 37, 1900)),
                                ROUND(v_lat, 6), ROUND(v_lon, 6), v_risco,
                                CASE WHEN v_cat = 3 THEN 'S' ELSE 'N' END, v_ab);

                SELECT dt_prazo INTO v_prazo FROM zl_ocorrencia WHERE id_ocorrencia = v_oc;
                v_atraso := MOD(j + k, 3) = 0;
                v_dias   := CASE WHEN v_atraso THEN (v_prazo - v_ab) + 2 + MOD(j, 4)
                                 ELSE GREATEST(1, CEIL((v_prazo - v_ab) * 0.6)) END;
                v_res    := LEAST(v_ab + v_dias, TRUNC(SYSDATE) - 1 + 15 / 24);

                -- Vizinhos confirmam no dia seguinte (antes de qualquer andamento).
                IF MOD(j, 2) = 0 THEN
                    v_ap1 := MOD(v_autor, 4) + 1;
                    apoio_em(v_oc, v_ap1, v_ab + 0.3);
                    IF MOD(j, 4) = 0 THEN
                        v_ap2 := MOD(v_autor + 1, 4) + 1;
                        apoio_em(v_oc, v_ap2, v_ab + 0.4);
                    END IF;
                END IF;

                mover_em(v_oc, 'EM_ANALISE', 'Equipe de vistoria enviada ao local.',
                         v_ab + (v_res - v_ab) / 3);

                IF j = 8 AND MOD(k, 2) = 1 THEN
                    mover_em(v_oc, 'CANCELADA',
                             'Vistoria constatou que o serviço é da concessionária; o pedido foi '
                             || 'encaminhado a ela com o número deste protocolo.',
                             v_ab + (v_res - v_ab) / 2);
                ELSE
                    mover_em(v_oc, 'EM_ANDAMENTO', 'Serviço programado com a equipe responsável.',
                             v_ab + 2 * (v_res - v_ab) / 3);
                    mover_em(v_oc, 'RESOLVIDA', solucao_hist(v_cat), v_res);

                    IF MOD(j, 4) <> 3 THEN
                        v_nota := 5 - MOD(j * k, 3);
                        IF v_atraso THEN
                            v_nota := GREATEST(2, v_nota - 1);
                        END IF;
                        avaliacao(v_oc, v_nota,
                                  CASE v_nota
                                      WHEN 5 THEN 'Resolveram rápido, obrigado.'
                                      WHEN 4 THEN 'Ficou bom, mas demorou um pouco.'
                                      WHEN 3 THEN 'Resolveu, mas o acabamento ficou ruim.'
                                      ELSE 'Demorou demais para atender.'
                                  END);
                    END IF;
                END IF;
            END LOOP;
        END LOOP;
    END gerar_historico;
BEGIN
    -- Historico antigo primeiro: os protocolos ficam em ordem de abertura.
    gerar_historico;

    -- ===== Itaquera =====
    v_id := nova(1, 1, 1, 'Buraco grande na faixa de ônibus',
        'Buraco de quase um metro na faixa da direita, os ônibus desviam para a outra pista.',
        'Av. Jacu-Pêssego, 1200', -23.537100, -46.457200, 'S', 'N', 9);
    apoio(v_id, 2, 8); apoio(v_id, 4, 6);
    mover(v_id, 'EM_ANALISE', 'Equipe de vistoria agendada.', 7);

    v_id := nova(2, 2, 1, 'Três postes apagados na mesma rua',
        'A rua fica totalmente escura depois das 19h. Moradores voltam do trabalho a pé por aqui.',
        'Rua Gregório Ramalho, 300', -23.534800, -46.453900, 'S', 'N', 12);
    apoio(v_id, 1, 11);
    mover(v_id, 'EM_ANALISE', 'Chamado enviado para a concessionária de iluminação.', 10);
    mover(v_id, 'EM_ANDAMENTO', 'Troca das lâmpadas programada.', 8);

    v_id := nova(1, 4, 1, 'Entulho bloqueando a calçada',
        'Restos de obra ocupam a calçada inteira, quem passa precisa andar pela rua.',
        'Rua Victório Santim, 45', -23.538900, -46.459800, 'N', 'S', 20);
    mover(v_id, 'EM_ANALISE', 'Encaminhado para a limpeza urbana.', 19);
    mover(v_id, 'EM_ANDAMENTO', 'Caminhão de coleta designado.', 15);
    mover(v_id, 'RESOLVIDA', 'Entulho removido e calçada liberada.', 10);
    avaliacao(v_id, 5, 'Resolveram rápido, a calçada ficou livre.');

    v_id := nova(2, 3, 1, 'Calçada sem rampa na esquina do posto de saúde',
        'Não tem rampa de acesso. Quem usa andador ou cadeira de rodas não consegue atravessar.',
        'Rua Augusto Carlos Bauman, 851', -23.540200, -46.454700, 'N', 'S', 34);
    apoio(v_id, 1, 33); apoio(v_id, 3, 30);
    mover(v_id, 'EM_ANALISE', 'Projeto de rampa em avaliação técnica.', 30);

    v_id := nova(4, 8, 1, 'Bueiro entupido alaga a rua quando chove',
        'Com qualquer chuva a água sobe até a calçada e entra nas casas mais baixas.',
        'Rua Ida Kolb, 120', -23.533500, -46.461100, 'S', 'N', 41);
    mover(v_id, 'EM_ANALISE', 'Vistoria da drenagem solicitada.', 40);
    mover(v_id, 'EM_ANDAMENTO', 'Limpeza da galeria em execução.', 39);
    mover(v_id, 'RESOLVIDA', 'Galeria desobstruída.', 36);
    avaliacao(v_id, 4, 'Melhorou bastante, mas demorou alguns dias.');

    -- ===== Vila Mariana =====
    v_id := nova(3, 3, 2, 'Piso tátil arrancado na frente da estação',
        'Pedaço grande do piso tátil foi removido. Pessoas cegas perdem a referência ali.',
        'Rua Domingos de Morais, 1500', -23.589700, -46.634600, 'N', 'S', 6);
    apoio(v_id, 1, 5); apoio(v_id, 2, 5); apoio(v_id, 4, 3);

    v_id := nova(3, 7, 2, 'Semáforo de pedestres sem som',
        'O sinal sonoro para pedestres com deficiência visual parou de funcionar.',
        'Rua Vergueiro x Rua Sena Madureira', -23.590800, -46.636200, 'S', 'S', 15);
    mover(v_id, 'EM_ANALISE', 'Encaminhado à engenharia de tráfego.', 13);

    v_id := nova(1, 2, 2, 'Praça escura à noite',
        'Os refletores da praça estão queimados há semanas.',
        'Praça Dr. Ernesto de Moraes, s/n', -23.587300, -46.632100, 'N', 'N', 28);
    mover(v_id, 'EM_ANALISE', 'Vistoria realizada.', 27);
    mover(v_id, 'EM_ANDAMENTO', 'Refletores encomendados.', 26);
    mover(v_id, 'RESOLVIDA', 'Refletores substituídos por LED.', 24);
    avaliacao(v_id, 5, 'Ficou muito mais segura.');

    -- ===== Capão Redondo =====
    v_id := nova(4, 5, 3, 'Vazamento de água limpa há dias',
        'Água jorrando da calçada, já formou uma poça enorme e desperdiça muita água.',
        'Estrada de Itapecerica, 4800', -23.672500, -46.780100, 'N', 'N', 4);
    apoio(v_id, 1, 3); apoio(v_id, 3, 2);

    v_id := nova(4, 6, 3, 'Árvore inclinada sobre a fiação',
        'Depois do último temporal a árvore ficou inclinada e encostando nos fios.',
        'Rua Dr. Luiz da Fonseca Galvão, 200', -23.669800, -46.776500, 'S', 'N', 11);
    apoio(v_id, 2, 10);
    mover(v_id, 'EM_ANALISE', 'Laudo de risco solicitado.', 9);

    v_id := nova(4, 1, 3, 'Cratera perto da escola',
        'Buraco fundo bem na saída dos alunos.',
        'Rua Comendador Antunes dos Santos, 90', -23.674200, -46.782600, 'S', 'N', 25);
    mover(v_id, 'EM_ANALISE', 'Área sinalizada pela equipe.', 24);
    mover(v_id, 'EM_ANDAMENTO', 'Recapeamento agendado.', 22);
    mover(v_id, 'RESOLVIDA', 'Buraco tapado com asfalto novo.', 19);
    avaliacao(v_id, 3, 'Tapou, mas já está afundando de novo.');

    v_id := nova(1, 4, 3, 'Descarte irregular em terreno baldio',
        'Sofá, colchões e sacos de lixo jogados no terreno.',
        'Rua Ângelo de Candia, 300', -23.670400, -46.785300, 'N', 'N', 2);

    -- ===== Santana =====
    v_id := nova(2, 7, 4, 'Placa de PARE caída',
        'A placa caiu e os carros não param mais no cruzamento.',
        'Rua Voluntários da Pátria x Rua Alfredo Pujol', -23.502900, -46.625800, 'S', 'N', 3);
    apoio(v_id, 4, 2);

    v_id := nova(3, 8, 4, 'Boca de lobo sem tampa',
        'Buraco aberto na sarjeta, alguém pode se machucar.',
        'Rua Dr. César, 500', -23.501700, -46.623100, 'S', 'S', 9);
    mover(v_id, 'EM_ANALISE', 'Encaminhado para a drenagem.', 9);
    mover(v_id, 'EM_ANDAMENTO', 'Tampa nova solicitada.', 8);
    mover(v_id, 'RESOLVIDA', 'Tampa de ferro instalada.', 7);
    avaliacao(v_id, 5, 'Perfeito, obrigado.');

    -- ===== Pinheiros =====
    v_id := nova(3, 3, 5, 'Calçada estreita com poste no meio',
        'O poste ocupa quase toda a calçada, cadeira de rodas não passa.',
        'Rua dos Pinheiros, 700', -23.566200, -46.690400, 'N', 'S', 38);
    apoio(v_id, 1, 37);

    v_id := nova(1, 5, 5, 'Esgoto escorrendo na calçada',
        'Mau cheiro forte e água suja descendo pela calçada.',
        'Rua Cardeal Arcoverde, 1100', -23.565100, -46.688700, 'N', 'N', 8);
    mover(v_id, 'EM_ANALISE', 'Chamado aberto na companhia de saneamento.', 7);
    mover(v_id, 'EM_ANDAMENTO', 'Equipe em campo.', 6);

    -- ===== Brasilandia =====
    v_id := nova(4, 6, 6, 'Galho grande caído na rua',
        'Galho bloqueando metade da pista desde o temporal.',
        'Av. Deputado Cantídio Sampaio, 2500', -23.457100, -46.688200, 'S', 'N', 1);

    v_id := nova(2, 2, 6, 'Rua inteira sem iluminação',
        'Todos os postes da rua apagados, ponto de ônibus fica no escuro.',
        'Rua Parapuã, 800', -23.455200, -46.684900, 'S', 'N', 16);
    apoio(v_id, 1, 15); apoio(v_id, 4, 14); apoio(v_id, 3, 12);


    -- ===== Conversa na linha do tempo (gera notificacoes de comentario) =====
    -- Buraco da Ana na faixa de onibus: a prefeitura responde e um apoiador
    -- complementa.
    SELECT id_ocorrencia INTO v_id FROM zl_ocorrencia
     WHERE ds_titulo = 'Buraco grande na faixa de ônibus';
    comentario(v_id, c_gestor, 'Vistoria marcada para esta semana. A área já foi sinalizada com cones.', 5);
    comentario(v_id, 4, 'Passei hoje cedo e os cones já estão lá, obrigado.', 4);

    -- Rampa do posto de saude (Joaquim), que a Ana apoiou.
    SELECT id_ocorrencia INTO v_id FROM zl_ocorrencia
     WHERE ds_titulo = 'Calçada sem rampa na esquina do posto de saúde';
    comentario(v_id, 2, 'Continuo sem conseguir atravessar com o andador. Alguma previsão da obra?', 3);

    -- Prioridade de todas as ocorrencias, ja com o tempo de espera.
    FOR r IN (SELECT id_ocorrencia FROM zl_ocorrencia) LOOP
        v_id := pkg_zl_ocorrencia.calcular_prioridade(r.id_ocorrencia);
        UPDATE zl_ocorrencia SET nr_prioridade = v_id WHERE id_ocorrencia = r.id_ocorrencia;
    END LOOP;

    -- Pontos de engajamento coerentes com o que cada um fez.
    UPDATE zl_usuario u
       SET nr_pontos =
             10 * (SELECT COUNT(*) FROM zl_ocorrencia o WHERE o.id_usuario = u.id_usuario)
           +  2 * (SELECT COUNT(*) FROM zl_apoio a WHERE a.id_usuario = u.id_usuario)
           +  5 * (SELECT COUNT(*) FROM zl_ocorrencia o
                    WHERE o.id_usuario = u.id_usuario AND o.st_ocorrencia = 'RESOLVIDA');

    -- Quem usa o app ja leu o que chegou ha mais de uma semana; o que e
    -- da ultima semana aparece como novidade no sininho.
    UPDATE zl_notificacao
       SET fl_lida = 'S'
     WHERE dt_criacao < TRUNC(SYSDATE) - 7;

    COMMIT;
END;
/

-- ---------------------------------------------------------------------
-- Indicadores dos 5 meses anteriores ja consolidados (grafico mes a mes
-- do painel). O mes atual fica para a rotina diaria / botao do gestor.
-- ---------------------------------------------------------------------
DECLARE
    v_qt NUMBER;
BEGIN
    FOR k IN REVERSE 1 .. 5 LOOP
        pkg_zl_indicador.gerar_indicadores(TO_CHAR(ADD_MONTHS(SYSDATE, -k), 'YYYY-MM'), v_qt);
    END LOOP;
    COMMIT;
END;
/
