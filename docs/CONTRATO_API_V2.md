# Contrato da API v2 (funções completas)

Combinado entre banco/API e o app. Rotas existentes continuam iguais; abaixo só o que muda ou é novo.
Erro sempre `{ instante, status, mensagem, caminho, referenciaId }`.

## Ocorrências

`GET /api/ocorrencias?bairroId&categoriaId&busca&incluirEncerradas&limite`
- `categoriaId` opcional; `busca` opcional (casa com protocolo ou título, sem diferenciar maiúscula/acento quando possível).

`OcorrenciaDetalhe` ganha:
- `fotoSolucao: string | null` (nome do arquivo, servido em `/api/fotos/{nome}`)
- `podeCancelar: boolean` (autor + status ABERTA)
- `podeComentar: boolean` (autor, apoiador ou gestor; e ocorrência não encerrada)
- itens do `historico` ganham `tipo: 'REGISTRO' | 'STATUS' | 'COMENTARIO' | 'ATRASO'` e `papelAutor: 'CIDADAO' | 'GESTOR' | null`

`POST /api/ocorrencias/{id}/comentarios` body `{ texto }` (3 a 500 letras) → 204. Autor, apoiador ou gestor.
`POST /api/ocorrencias/{id}/cancelar` body `{ motivo }` → 200 `OcorrenciaDetalhe`. Só o autor, só ABERTA.

## Gestor

`GET /api/gestor/fila?bairroId&categoriaId&somenteAtrasadas`
`PATCH /api/gestor/ocorrencias/{id}/status` body `{ status, comentario, fotoSolucaoBase64? }`
- `CANCELADA` exige comentário (motivo) com 5+ letras → 400 senão.
- `fotoSolucaoBase64` opcional, aceito quando `status = RESOLVIDA`.
`GET /api/gestor/logs` (já existe) → `[{ data, rotina, nivel, linhas, mensagem }]`

## Notificações (cidadão e gestor)

`GET /api/notificacoes` → últimas 50: `[{ id, ocorrenciaId, protocolo, tipo, titulo, mensagem, lida, data }]`
- `tipo`: `STATUS` | `ATRASO` | `APOIO` | `COMENTARIO`
`GET /api/notificacoes/nao-lidas` → `{ total }`
`POST /api/notificacoes/{id}/lida` → 204
`POST /api/notificacoes/lidas` → 204 (marca todas)

Quem recebe:
- mudança de status: autor e todos que apoiaram
- atraso detectado pela rotina: autor
- apoio novo: autor
- comentário: autor e apoiadores, menos quem comentou

## Perfil

`PUT /api/usuarios/me` body `{ nome, bairroId }` → `UsuarioResponse`
`POST /api/usuarios/me/senha` body `{ senhaAtual, novaSenha }` → 204 (401 se a atual estiver errada)
`UsuarioResponse` ganha `naoLidas: number`.

## Painel

Sem mudança de formato. A carga passa a ter histórico de 6 meses para o gráfico mês a mês.
