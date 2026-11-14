# -*- coding: utf-8 -*-
"""
Testa as regras do PL/SQL do Zelo direto no banco: cada caminho feliz e
cada recusa (RAISE_APPLICATION_ERROR) dos pacotes, inclusive comentarios,
cancelamento pelo autor, foto da solucao e as notificacoes geradas.

Tudo roda numa transacao que e desfeita no final, entao o banco volta ao
estado da carga. So as linhas de ZL_LOG_ROTINA ficam, porque o log usa
transacao autonoma (e esse e justamente o comportamento esperado).

Uso:  python testar_regras.py
"""
import sys

import oracledb

from executar_scripts import ler_conexao

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ANA, JOAQUIM, MARIANA, CARLOS, GESTOR = 1, 2, 3, 4, 5
resultados = []


def caso(nome, func, erro_esperado=None):
    try:
        retorno = func()
        if erro_esperado:
            resultados.append((False, nome, f"esperava ORA-{erro_esperado}, mas passou"))
        else:
            resultados.append((True, nome, retorno if retorno is not None else ""))
    except oracledb.DatabaseError as e:
        codigo = e.args[0].code
        msg = str(e.args[0].message).splitlines()[0]
        if erro_esperado and codigo == erro_esperado:
            resultados.append((True, nome, f"recusou: {msg}"))
        else:
            resultados.append((False, nome, msg))


def main():
    usuario, senha, dsn = ler_conexao()
    conn = oracledb.connect(user=usuario, password=senha, dsn=dsn)
    cur = conn.cursor()

    def registrar(user, cat, bairro, titulo, lat, lon, risco="N", acess="N"):
        o_id = cur.var(int)
        o_prot = cur.var(str)
        cur.callproc("pkg_zl_ocorrencia.registrar",
                     [user, cat, bairro, titulo, "descricao de teste", "Rua Teste, 1",
                      lat, lon, None, risco, acess, o_id, o_prot])
        return o_id.getvalue(), o_prot.getvalue()

    def apoiar(oc, user):
        qt, pr = cur.var(int), cur.var(int)
        cur.callproc("pkg_zl_ocorrencia.apoiar", [oc, user, qt, pr])
        return qt.getvalue(), pr.getvalue()

    def status(oc, user, novo):
        cur.callproc("pkg_zl_ocorrencia.atualizar_status", [oc, user, novo, "teste"])

    def avaliar(oc, user, nota):
        cur.callproc("pkg_zl_ocorrencia.avaliar", [oc, user, nota, "teste"])

    # --- registro ---------------------------------------------------
    novo = {}

    def registrar_ok():
        novo["id"], prot = registrar(ANA, 7, 1, "Placa de rua torta", -23.5000, -46.5000, "S", "N")
        cur.execute("""SELECT st_ocorrencia, nr_prioridade, dt_prazo - dt_abertura,
                              (SELECT COUNT(*) FROM zl_historico WHERE id_ocorrencia = :oc)
                         FROM zl_ocorrencia WHERE id_ocorrencia = :oc""", oc=novo["id"])
        st, pr, prazo, hist = cur.fetchone()
        assert st == "ABERTA" and hist == 1 and round(prazo) == 5, (st, prazo, hist)
        return f"{prot}, prioridade {pr}, prazo {round(prazo)} dias (10 pela metade por risco), historico criado pelo trigger"

    caso("registrar ocorrencia valida", registrar_ok)
    caso("titulo curto", lambda: registrar(ANA, 1, 1, "abc", -23.5, -46.5), 20104)
    caso("categoria inexistente", lambda: registrar(ANA, 99, 1, "Titulo valido", -23.5, -46.5), 20102)
    caso("bairro inexistente", lambda: registrar(ANA, 1, 99, "Titulo valido", -23.5, -46.5), 20103)
    caso("usuario inexistente", lambda: registrar(999, 1, 1, "Titulo valido", -23.5, -46.5), 20101)
    caso("coordenada invalida", lambda: registrar(ANA, 1, 1, "Titulo valido", 123, -46.5), 20116)
    # 30 m da primeira, mesma categoria
    caso("duplicada a 30 m", lambda: registrar(CARLOS, 7, 1, "Placa torta de novo", -23.50027, -46.5000), 20105)
    def registrar_forcado():
        o_id, o_prot = cur.var(int), cur.var(str)
        cur.callproc("pkg_zl_ocorrencia.registrar",
                     [CARLOS, 7, 1, "Outra placa no mesmo poste", "descricao", "Rua Teste, 1",
                      -23.50027, -46.5000, None, "N", "N", o_id, o_prot, "S"])
        return f"{o_prot.getvalue()} aceita com p_ignorar_duplicada = 'S'"

    caso("duplicada confirmada pelo cidadao como outro problema", registrar_forcado)
    caso("mesma categoria a 500 m nao e duplicada",
         lambda: registrar(CARLOS, 7, 1, "Outra placa torta", -23.5045, -46.5000)[1])

    # --- apoio --------------------------------------------------------
    def apoio_ok():
        cur.execute("SELECT nr_prioridade FROM zl_ocorrencia WHERE id_ocorrencia = :1", [novo["id"]])
        antes = cur.fetchone()[0]
        qt, pr = apoiar(novo["id"], CARLOS)
        assert qt == 1 and pr == antes + 4, (qt, antes, pr)
        return f"apoios {qt}, prioridade {antes} -> {pr}"

    caso("apoiar ocorrencia de outro morador", apoio_ok)
    caso("apoiar duas vezes", lambda: apoiar(novo["id"], CARLOS), 20108)
    caso("apoiar a propria", lambda: apoiar(novo["id"], ANA), 20106)
    caso("apoiar ocorrencia inexistente", lambda: apoiar(999999, CARLOS), 20115)

    # --- status -------------------------------------------------------
    caso("cidadao mudando status", lambda: status(novo["id"], ANA, "EM_ANALISE"), 20109)
    caso("pular de ABERTA para RESOLVIDA", lambda: status(novo["id"], GESTOR, "RESOLVIDA"), 20110)
    caso("avaliar antes de resolver", lambda: avaliar(novo["id"], ANA, 5), 20112)

    def fluxo_ok():
        cur.execute("SELECT nr_pontos FROM zl_usuario WHERE id_usuario = :1", [ANA])
        pontos = cur.fetchone()[0]
        for st in ("EM_ANALISE", "EM_ANDAMENTO", "RESOLVIDA"):
            status(novo["id"], GESTOR, st)
        cur.execute("""SELECT o.nr_prioridade, o.dt_resolucao, u.nr_pontos,
                              (SELECT COUNT(*) FROM zl_historico h WHERE h.id_ocorrencia = o.id_ocorrencia
                                  AND h.id_usuario = :gestor)
                         FROM zl_ocorrencia o JOIN zl_usuario u ON u.id_usuario = o.id_usuario
                        WHERE o.id_ocorrencia = :oc""", oc=novo["id"], gestor=GESTOR)
        pr, dt, pts, hist = cur.fetchone()
        assert pr == 0 and dt is not None and pts == pontos + 5 and hist == 3, (pr, dt, pts, hist)
        return "3 linhas de historico com o gestor como autor, prioridade 0, +5 pontos para a autora"

    caso("ABERTA > EM_ANALISE > EM_ANDAMENTO > RESOLVIDA", fluxo_ok)
    caso("apoiar ocorrencia encerrada", lambda: apoiar(novo["id"], JOAQUIM), 20107)

    # --- avaliacao ----------------------------------------------------
    caso("outro usuario avaliando", lambda: avaliar(novo["id"], CARLOS, 5), 20111)
    caso("nota 7", lambda: avaliar(novo["id"], ANA, 7), 20114)
    caso("avaliacao valida", lambda: avaliar(novo["id"], ANA, 4))
    caso("avaliar duas vezes", lambda: avaliar(novo["id"], ANA, 5), 20113)

    # --- trigger de imutabilidade ------------------------------------
    caso("trocar protocolo por UPDATE direto",
         lambda: cur.execute("UPDATE zl_ocorrencia SET cd_protocolo = 'X' WHERE id_ocorrencia = :1",
                             [novo["id"]]), 20120)

    # --- notificacoes: apoio e troca de status ------------------------
    def notificacoes(usuario, oc, tipo=None):
        sql = "SELECT COUNT(*) FROM zl_notificacao WHERE id_usuario = :u AND id_ocorrencia = :o"
        args = {"u": usuario, "o": oc}
        if tipo:
            sql += " AND tp_notificacao = :t"
            args["t"] = tipo
        cur.execute(sql, args)
        return cur.fetchone()[0]

    def notif_apoio_e_status():
        # A ocorrencia do inicio (autora Ana, apoiada pelo Carlos) passou
        # por 3 trocas de status: Ana e Carlos recebem 3 avisos cada; o
        # gestor, que fez a troca, nenhum.
        apoio = notificacoes(ANA, novo["id"], "APOIO")
        st_ana = notificacoes(ANA, novo["id"], "STATUS")
        st_carlos = notificacoes(CARLOS, novo["id"], "STATUS")
        st_gestor = notificacoes(GESTOR, novo["id"])
        assert (apoio, st_ana, st_carlos, st_gestor) == (1, 3, 3, 0), (apoio, st_ana, st_carlos, st_gestor)
        cur.execute("""SELECT ds_mensagem FROM zl_notificacao WHERE id_usuario = :1 AND id_ocorrencia = :2
                        AND tp_notificacao = 'STATUS' ORDER BY id_notificacao DESC FETCH FIRST 1 ROWS ONLY""",
                    [ANA, novo["id"]])
        msg = cur.fetchone()[0]
        assert "Resolvida" in msg and "avalie" in msg, msg
        return f"APOIO 1 para a autora; STATUS 3 para autora e 3 para o apoiador; 0 para o gestor | \"{msg[:60]}...\""

    caso("notificacoes de apoio e de troca de status", notif_apoio_e_status)

    # --- comentarios ----------------------------------------------------
    def comentar(oc, user, texto):
        cur.callproc("pkg_zl_ocorrencia.comentar", [oc, user, texto])

    b = {}

    def preparar_b():
        b["id"], prot = registrar(JOAQUIM, 4, 2, "Entulho na praça do bairro", -23.5950, -46.6400)
        apoiar(b["id"], CARLOS)
        return f"{prot} de Joaquim, apoiada por Carlos"

    caso("preparar ocorrencia B (comentarios e cancelamento)", preparar_b)

    def comentario_autor():
        antes = (notificacoes(JOAQUIM, b["id"], "COMENTARIO"), notificacoes(CARLOS, b["id"], "COMENTARIO"))
        comentar(b["id"], JOAQUIM, "Hoje apareceu mais entulho.")
        depois = (notificacoes(JOAQUIM, b["id"], "COMENTARIO"), notificacoes(CARLOS, b["id"], "COMENTARIO"))
        cur.execute("""SELECT tp_evento, st_anterior, st_novo, id_usuario FROM zl_historico
                        WHERE id_ocorrencia = :1 ORDER BY id_historico DESC FETCH FIRST 1 ROWS ONLY""", [b["id"]])
        tipo, ant, nov, quem = cur.fetchone()
        assert tipo == "COMENTARIO" and ant == nov == "ABERTA" and quem == JOAQUIM, (tipo, ant, nov, quem)
        assert depois[0] == antes[0] and depois[1] == antes[1] + 1, (antes, depois)
        return "historico tipo COMENTARIO; avisou o apoiador, nao o proprio autor"

    def comentario_apoiador():
        antes = notificacoes(JOAQUIM, b["id"], "COMENTARIO")
        comentar(b["id"], CARLOS, "Confirmo, passei por lá agora.")
        assert notificacoes(JOAQUIM, b["id"], "COMENTARIO") == antes + 1
        return "apoiador comentou; autor avisado"

    def comentario_gestor():
        antes = (notificacoes(JOAQUIM, b["id"], "COMENTARIO"), notificacoes(CARLOS, b["id"], "COMENTARIO"))
        comentar(b["id"], GESTOR, "Coleta agendada para quinta-feira.")
        depois = (notificacoes(JOAQUIM, b["id"], "COMENTARIO"), notificacoes(CARLOS, b["id"], "COMENTARIO"))
        assert depois == (antes[0] + 1, antes[1] + 1), (antes, depois)
        cur.execute("""SELECT ds_mensagem FROM zl_notificacao WHERE id_usuario = :1
                        ORDER BY id_notificacao DESC FETCH FIRST 1 ROWS ONLY""", [JOAQUIM])
        msg = cur.fetchone()[0]
        assert msg.startswith("A prefeitura comentou"), msg
        return f"gestor comentou; autor e apoiador avisados | \"{msg}\""

    caso("comentario do autor", comentario_autor)
    caso("comentario de quem apoiou", comentario_apoiador)
    caso("comentario do gestor", comentario_gestor)
    caso("comentario de quem nao e autor nem apoiador", lambda: comentar(b["id"], MARIANA, "Também vi isso."), 20119)
    caso("comentario com 2 letras", lambda: comentar(b["id"], JOAQUIM, "  ok  "), 20118)
    caso("comentario com 501 letras", lambda: comentar(b["id"], JOAQUIM, "a" * 501), 20118)
    caso("comentar ocorrencia inexistente", lambda: comentar(999999, JOAQUIM, "Texto qualquer"), 20115)

    # --- cancelamento pelo autor ---------------------------------------
    def cancelar(oc, user, motivo):
        cur.callproc("pkg_zl_ocorrencia.cancelar_pelo_autor", [oc, user, motivo])

    caso("cancelar ocorrencia de outra pessoa", lambda: cancelar(b["id"], CARLOS, "Nao quero mais"), 20121)
    caso("cancelar com motivo de 3 letras", lambda: cancelar(b["id"], JOAQUIM, "abc"), 20117)
    caso("gestor cancelando sem motivo",
         lambda: cur.callproc("pkg_zl_ocorrencia.atualizar_status", [b["id"], GESTOR, "CANCELADA", "ok"]), 20117)

    def cancelar_ok():
        cur.execute("SELECT nr_pontos FROM zl_usuario WHERE id_usuario = :1", [JOAQUIM])
        pontos = cur.fetchone()[0]
        st_carlos = notificacoes(CARLOS, b["id"], "STATUS")
        st_joaquim = notificacoes(JOAQUIM, b["id"], "STATUS")
        cancelar(b["id"], JOAQUIM, "Um vizinho já recolheu o entulho.")
        cur.execute("""SELECT o.st_ocorrencia, o.nr_prioridade, u.nr_pontos,
                              (SELECT ds_comentario FROM zl_historico h WHERE h.id_ocorrencia = o.id_ocorrencia
                                  AND h.tp_evento = 'STATUS' ORDER BY id_historico DESC FETCH FIRST 1 ROWS ONLY)
                         FROM zl_ocorrencia o JOIN zl_usuario u ON u.id_usuario = o.id_usuario
                        WHERE o.id_ocorrencia = :1""", [b["id"]])
        st, pr, pts, coment = cur.fetchone()
        assert st == "CANCELADA" and pr == 0 and pts == pontos - 10, (st, pr, pts, pontos)
        assert "vizinho já recolheu" in coment, coment
        assert notificacoes(CARLOS, b["id"], "STATUS") == st_carlos + 1
        assert notificacoes(JOAQUIM, b["id"], "STATUS") == st_joaquim
        return f"CANCELADA, -10 pontos, apoiador avisado | historico: \"{coment}\""

    caso("autor cancela a propria ocorrencia ABERTA", cancelar_ok)
    caso("comentar ocorrencia cancelada", lambda: comentar(b["id"], JOAQUIM, "Ainda tem um pouco"), 20107)

    c = {}

    def preparar_c():
        c["id"], prot = registrar(MARIANA, 5, 5, "Vazamento na esquina da praça", -23.5600, -46.6900)
        cur.callproc("pkg_zl_ocorrencia.atualizar_status", [c["id"], GESTOR, "EM_ANALISE", "Vistoria agendada."])
        assert notificacoes(MARIANA, c["id"], "STATUS") == 1
        return f"{prot} de Mariana, ja EM_ANALISE (autora avisada)"

    caso("preparar ocorrencia C (foto da solucao)", preparar_c)
    caso("autor cancelando depois que a prefeitura analisou",
         lambda: cancelar(c["id"], MARIANA, "Já resolveram por conta"), 20122)

    # --- foto da solucao ------------------------------------------------
    def status_foto(oc, novo_status, foto):
        cur.callproc("pkg_zl_ocorrencia.atualizar_status", [oc, GESTOR, novo_status, "teste", foto])

    caso("foto da solucao fora de RESOLVIDA",
         lambda: status_foto(c["id"], "EM_ANDAMENTO", "00000000-0000-0000-0000-000000000000.jpg"), 20123)

    def foto_ok():
        status_foto(c["id"], "EM_ANDAMENTO", None)
        status_foto(c["id"], "RESOLVIDA", "00000000-0000-0000-0000-000000000000.jpg")
        cur.execute("""SELECT st_ocorrencia, ds_foto_solucao FROM vw_zl_ocorrencia
                        WHERE id_ocorrencia = :1""", [c["id"]])
        st, foto = cur.fetchone()
        assert st == "RESOLVIDA" and foto.startswith("00000000"), (st, foto)
        return f"RESOLVIDA com ds_foto_solucao = {foto} (lido pela view)"

    caso("foto da solucao ao resolver", foto_ok)

    def gestor_cancela_ok():
        d_id, prot = registrar(CARLOS, 2, 3, "Poste piscando na viela", -23.6800, -46.7700)
        cur.callproc("pkg_zl_ocorrencia.atualizar_status",
                     [d_id, GESTOR, "CANCELADA", "Poste é da rede particular do condomínio."])
        cur.execute("SELECT st_ocorrencia FROM zl_ocorrencia WHERE id_ocorrencia = :1", [d_id])
        assert cur.fetchone()[0] == "CANCELADA"
        assert notificacoes(CARLOS, d_id, "STATUS") == 1
        return f"{prot} cancelada com motivo; autor avisado"

    caso("gestor cancela com motivo", gestor_cancela_ok)

    # --- marcar como lida -------------------------------------------------
    def lida_de_outro():
        cur.execute("""SELECT MAX(id_notificacao) FROM zl_notificacao WHERE id_usuario = :1""", [JOAQUIM])
        nid = cur.fetchone()[0]
        cur.callproc("pkg_zl_notificacao.marcar_lida", [nid, CARLOS])

    def lidas_ok():
        cur.execute("""SELECT MAX(id_notificacao) FROM zl_notificacao WHERE id_usuario = :1""", [JOAQUIM])
        nid = cur.fetchone()[0]
        cur.callproc("pkg_zl_notificacao.marcar_lida", [nid, JOAQUIM])
        cur.execute("SELECT fl_lida FROM zl_notificacao WHERE id_notificacao = :1", [nid])
        assert cur.fetchone()[0] == "S"
        qt = cur.var(int)
        cur.callproc("pkg_zl_notificacao.marcar_todas", [JOAQUIM, qt])
        restantes = cur.callfunc("pkg_zl_notificacao.nao_lidas", int, [JOAQUIM])
        assert qt.getvalue() > 0 and restantes == 0, (qt.getvalue(), restantes)
        return f"uma marcada; depois {qt.getvalue()} de uma vez; nao_lidas = 0"

    caso("marcar notificacao de outro usuario", lida_de_outro, 20124)
    caso("marcar lida e marcar todas", lidas_ok)

    # --- rotinas automaticas -----------------------------------------
    def atrasos():
        cur.execute("SELECT NVL(MAX(id_notificacao), 0) FROM zl_notificacao")
        marca = cur.fetchone()[0]
        qt = cur.var(int)
        cur.callproc("pkg_zl_indicador.detectar_atrasos", [qt])
        primeira = qt.getvalue()
        cur.callproc("pkg_zl_indicador.detectar_atrasos", [qt])
        assert primeira > 0 and qt.getvalue() == 0, (primeira, qt.getvalue())
        # Uma notificacao ATRASO por ocorrencia atrasada, sempre para o autor.
        cur.execute("""SELECT COUNT(*),
                              SUM(CASE WHEN n.id_usuario = o.id_usuario AND n.tp_notificacao = 'ATRASO'
                                       THEN 1 ELSE 0 END)
                         FROM zl_notificacao n JOIN zl_ocorrencia o ON o.id_ocorrencia = n.id_ocorrencia
                        WHERE n.id_notificacao > :1""", [marca])
        total, do_autor = cur.fetchone()
        cur.execute("SELECT COUNT(*) FROM zl_historico WHERE tp_evento = 'ATRASO'")
        hist = cur.fetchone()[0]
        assert total == primeira and do_autor == primeira and hist == primeira, (total, do_autor, hist, primeira)
        return (f"{primeira} atrasada(s) marcadas (historico tipo ATRASO) e {total} notificacao(oes) "
                f"para o autor; segunda execucao marcou 0 (nao duplica)")

    def prioridades():
        qt = cur.var(int)
        cur.callproc("pkg_zl_indicador.recalcular_prioridades", [qt])
        return f"{qt.getvalue()} prioridade(s) ajustadas"

    def indicadores():
        qt = cur.var(int)
        cur.execute("SELECT TO_CHAR(SYSDATE, 'YYYY-MM') FROM dual")
        mes = cur.fetchone()[0]
        cur.callproc("pkg_zl_indicador.gerar_indicadores", [mes, qt])
        cur.callproc("pkg_zl_indicador.gerar_indicadores", [mes, qt])
        cur.execute("SELECT COUNT(*), SUM(qt_abertas), SUM(qt_resolvidas) FROM zl_indicador WHERE cd_mes = :1", [mes])
        linhas, ab, res = cur.fetchone()
        assert linhas == 6, linhas
        return f"{mes}: 6 bairros (rodou 2x sem duplicar), {ab} abertas, {res} resolvidas"

    caso("detectar_atrasos", atrasos)
    caso("recalcular_prioridades (BULK COLLECT/FORALL)", prioridades)
    caso("gerar_indicadores com MERGE", indicadores)
    caso("mes invalido", lambda: cur.callproc("pkg_zl_indicador.gerar_indicadores",
                                              ["2026-13", cur.var(int)]), 20201)

    conn.rollback()
    conn.close()

    ok = sum(1 for r in resultados if r[0])
    for passou, nome, detalhe in resultados:
        print(f"  {'ok  ' if passou else 'FALHA'} {nome:<52} {detalhe}")
    print(f"\n{ok}/{len(resultados)} casos passaram. Transacao desfeita: banco no estado da carga.")
    return 0 if ok == len(resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
