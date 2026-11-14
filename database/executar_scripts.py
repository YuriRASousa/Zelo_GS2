# -*- coding: utf-8 -*-
"""
Instala o banco Oracle do Zelo na ordem certa e confere se tudo compilou.
Substitui o SQL Developer: roda na maquina do desenvolvedor e em pipeline.

Conexao (primeira fonte que existir):
  1. variaveis de ambiente ORACLE_USER, ORACLE_PASSWORD e ORACLE_DSN
     (formato host:porta/servico);
  2. backend/zelo-api/config/oracle.properties, o mesmo arquivo da API.

Uso:
  python executar_scripts.py              instala 01 a 07 (schema sem o Zelo)
  python executar_scripts.py --recriar    roda 99_drop.sql antes (volta ao estado da carga)
  python executar_scripts.py --verificar  nao executa nada, so confere

Sai com codigo diferente de zero quando algum comando falha ou sobra
objeto invalido.
"""
import argparse
import os
import re
import sys
import time
from pathlib import Path

import oracledb

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PASTA = Path(__file__).resolve().parent
FILTRO = r"""(object_name LIKE 'ZL\_%' ESCAPE '\' OR object_name LIKE 'PKG\_ZL\_%' ESCAPE '\'
                         OR object_name LIKE 'TRG\_ZL\_%' ESCAPE '\' OR object_name LIKE 'VW\_ZL\_%' ESCAPE '\'
                         OR object_name LIKE 'SEQ\_ZL\_%' ESCAPE '\')"""
CONFIG = PASTA.parent / "backend" / "zelo-api" / "config" / "oracle.properties"

INSTALACAO = [
    "01_ddl.sql",
    "02_pkg_log.sql",
    "03_pkg_ocorrencia.sql",
    "04_pkg_indicador.sql",
    "05_triggers_views.sql",
    "06_seed.sql",
    "07_job.sql",
]

# Comandos de SQL*Plus que o driver nao entende; sao ignorados.
SQLPLUS = re.compile(
    r"^\s*(SET\s|SHOW\s+ERRORS|PROMPT|SPOOL|WHENEVER|COLUMN\s|EXIT|DEFINE|CLEAR\s)", re.I)
INICIO_BLOCO = re.compile(
    r"^\s*(CREATE\s+(OR\s+REPLACE\s+)?(EDITIONABLE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b|DECLARE\b|BEGIN\b)",
    re.I)


def ler_conexao():
    if os.getenv("ORACLE_USER") and os.getenv("ORACLE_PASSWORD") and os.getenv("ORACLE_DSN"):
        return os.environ["ORACLE_USER"], os.environ["ORACLE_PASSWORD"], os.environ["ORACLE_DSN"]
    props = {}
    for linha in CONFIG.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            props[k.strip()] = v.strip()
    m = re.search(r"@(?://)?([^:/]+):(\d+)[:/](\w+)", props["spring.datasource.url"])
    return props["spring.datasource.username"], props["spring.datasource.password"], \
        f"{m.group(1)}:{m.group(2)}/{m.group(3)}"


def dividir(texto):
    """Quebra o arquivo em comandos. Bloco PL/SQL termina em '/' sozinho
    na linha; comando SQL comum termina em ';' no fim da linha."""
    comandos, atual, em_bloco = [], [], False
    for linha in texto.splitlines():
        corpo = linha.strip()
        if not atual:
            if not corpo or corpo.startswith("--") or SQLPLUS.match(linha):
                continue
            em_bloco = bool(INICIO_BLOCO.match(linha))
        if em_bloco:
            if corpo == "/":
                comandos.append("\n".join(atual).strip())
                atual, em_bloco = [], False
            else:
                atual.append(linha)
        else:
            if corpo.startswith("--"):
                continue
            atual.append(linha)
            if corpo.endswith(";"):
                comandos.append("\n".join(atual).strip().rstrip(";"))
                atual = []
    if atual:
        comandos.append("\n".join(atual).strip().rstrip(";"))
    return [c for c in comandos if c]


def executar_arquivo(cur, arquivo):
    inicio = time.time()
    comandos = dividir((PASTA / arquivo).read_text(encoding="utf-8"))
    for cmd in comandos:
        try:
            cur.execute(cmd)
            if cur.description:
                cur.fetchall()
        except oracledb.DatabaseError as e:
            primeira = cmd.strip().splitlines()[0][:90]
            print(f"  FALHOU: {primeira}\n  {e}")
            raise
    print(f"  ok  {arquivo:<24} {len(comandos):>3} comando(s)  {time.time() - inicio:5.1f}s")


def verificar(cur):
    """Falha se algum objeto do schema estiver invalido ou com erro de compilacao."""
    cur.execute("""SELECT object_type, object_name FROM user_objects
                    WHERE status <> 'VALID' AND """ + FILTRO + """ ORDER BY 1, 2""")
    invalidos = cur.fetchall()
    cur.execute("""SELECT name, type, line, text FROM user_errors
                    WHERE name LIKE 'PKG_ZL%' OR name LIKE 'TRG_ZL%' OR name LIKE 'VW_ZL%'
                    ORDER BY name, sequence""")
    erros = cur.fetchall()
    cur.execute("""SELECT object_type, COUNT(*) FROM user_objects
                    WHERE object_type IN ('TABLE','SEQUENCE','PACKAGE','PACKAGE BODY','TRIGGER','VIEW','INDEX')
                      AND """ + FILTRO + """ GROUP BY object_type ORDER BY 1""")
    print("\nObjetos no schema:")
    for tipo, qtd in cur.fetchall():
        print(f"  {tipo:<14} {qtd:>3}")
    if invalidos or erros:
        print("\nProblemas de compilacao:")
        for tipo, nome in invalidos:
            print(f"  INVALIDO  {tipo} {nome}")
        for nome, tipo, linha, texto in erros:
            print(f"  ERRO      {nome} ({tipo}) linha {linha}: {texto.strip()}")
        return False
    print("\nTodos os objetos estao VALID.")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recriar", action="store_true", help="roda 99_drop.sql antes")
    ap.add_argument("--verificar", action="store_true", help="so confere os objetos")
    args = ap.parse_args()

    usuario, senha, dsn = ler_conexao()
    print(f"Conectando como {usuario} em {dsn.split('/')[0]} ...")
    conn = oracledb.connect(user=usuario, password=senha, dsn=dsn)
    cur = conn.cursor()
    cur.execute("SELECT banner FROM v$version WHERE ROWNUM = 1")
    print(cur.fetchone()[0])

    try:
        if not args.verificar:
            print("\nInstalacao:")
            if args.recriar:
                executar_arquivo(cur, "99_drop.sql")
            for arq in INSTALACAO:
                executar_arquivo(cur, arq)
        conn.commit()
    except oracledb.DatabaseError:
        conn.rollback()
        return 1

    return 0 if verificar(cur) else 1


if __name__ == "__main__":
    sys.exit(main())
