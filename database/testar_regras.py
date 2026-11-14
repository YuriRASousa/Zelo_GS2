# -*- coding: utf-8 -*-
"""
Testa as regras do PL/SQL do Zelo direto no banco: cada caminho feliz e
cada recusa (RAISE_APPLICATION_ERROR) dos pacotes.

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

    # --- rotinas automaticas -----------------------------------------
    def atrasos():
        qt = cur.var(int)
        cur.callproc("pkg_zl_indicador.detectar_atrasos", [qt])
        primeira = qt.getvalue()
        cur.callproc("pkg_zl_indicador.detectar_atrasos", [qt])
        assert primeira > 0 and qt.getvalue() == 0, (primeira, qt.getvalue())
        return f"{primeira} atrasada(s) marcadas; segunda execucao marcou 0 (nao duplica)"

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
        print(f"  {'ok  ' if passou else 'FALHA'} {nome:<48} {detalhe}")
    print(f"\n{ok}/{len(resultados)} casos passaram. Transacao desfeita: banco no estado da carga.")
    return 0 if ok == len(resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
