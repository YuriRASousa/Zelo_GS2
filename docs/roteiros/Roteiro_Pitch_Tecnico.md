# Roteiro | Vídeo Pitch Técnico (até 5 minutos)

**Vale nota (GS2).** Demonstrar o app funcionando, explicar as escolhas técnicas e o protótipo. YouTube **não listado**, link no `.txt`.

## Antes de gravar (5 minutos de preparo)

1. Deixe o banco no estado inicial (ocorrências de exemplo, sem os atrasos marcados, para a rotina ter o que fazer na gravação):
   ```
   cd database
   python executar_scripts.py --recriar
   ```
2. Suba a API e o app: `scripts\iniciar_api.bat` e `scripts\iniciar_app.bat`.
3. No Chrome, abra `http://localhost:8082`, aperte `F12`, ative o modo celular (`Ctrl + Shift + M`) e escolha um aparelho (ex.: iPhone 12 Pro). Feche o DevTools depois, o tamanho fica.
4. Deixe abertos em abas: o Swagger (`http://localhost:8080/swagger-ui.html`), o VS Code com `database/03_pkg_ocorrencia.sql` e o arquivo `docs/modelo/DER_Zelo.png`.
5. Gravador de tela: `Win + Alt + R` (Xbox Game Bar) ou OBS. Microfone ligado.

Tempo previsto: **4 min 45 s**.

---

### 0:00 a 0:25 | Abertura (rosto ou tela inicial do app)

> "Esse é o Zelo, um aplicativo de zeladoria urbana feito em React Native, com API em Spring Boot e as regras de negócio em PL/SQL no Oracle da FIAP. Vou mostrar as funcionalidades e as decisões técnicas por trás de cada uma."

### 0:25 a 0:50 | Arquitetura (mostre o DER)

> "São três camadas. O app em React Native com Expo, que roda em Android, iOS e web com o mesmo código. Uma API Spring Boot fina, que autentica com JWT e chama o banco. E o Oracle, com nove tabelas e três pacotes PL/SQL. A decisão principal foi deixar a regra no banco: protocolo, prazo, prioridade e transição de status valem igual para qualquer cliente."

### 0:50 a 1:40 | Funcionalidade 1: relatar (app, conta da Ana)

- Clique em **Cidadã (Ana)** e **Entrar**.
- Toque em **+ Relatar**. Escolha **Calçada e acessibilidade**.
- No mapa, toque perto do marcador da ocorrência ZL-2026-000004 (Itaquera, perto do posto de saúde).

> "Quando eu marco o local, o app consulta a function buscar_duplicada no banco. Existe uma ocorrência da mesma categoria a menos de 60 metros, então ele sugere apoiar a existente. Isso evita fila cheia de pedidos repetidos."

- Troque a categoria para **Lixo e entulho** (o aviso some), escreva o título, ligue **Atrapalha quem tem deficiência**, escolha uma foto na **Galeria**.

> "A foto é reduzida no aparelho para no máximo 1024 pixels e JPEG 55 por cento. Uma foto de celular de 4 megabytes vira uns 150 KB. Isso é gerenciamento de memória e economia de dados do cidadão."

- **Enviar.** Mostre o protocolo.

> "Protocolo, prazo e prioridade foram calculados pela procedure registrar do pacote PKG_ZL_OCORRENCIA. A primeira linha da linha do tempo foi criada por um trigger."

### 1:40 a 2:20 | Funcionalidade 2: mapa e apoio

- Volte ao **Mapa**. Mostre os marcadores e a lista.

> "A lista vem ordenada pela prioridade calculada no banco: gravidade da categoria, apoios, risco, acessibilidade, tempo de espera e atraso. A FlatList é virtualizada e os cards usam React.memo, então só o que está na tela fica na memória."

- Abra uma ocorrência que a Ana **não** criou e não apoiou (ex.: filtro **Santana** > **Placa de PARE caída**) e toque **Também vi esse problema**.

> "O apoio passa pela procedure apoiar, que recusa apoio repetido ou na própria ocorrência, e a prioridade sobe na hora."

### 2:20 a 2:50 | Funcionalidade 3: acompanhar e acessibilidade

- Aba **Minhas**: mostre "Relatei" e "Apoiei". Abra uma resolvida e mostre a avaliação e a linha do tempo.
- Aba **Perfil**: ligue **Letras maiores** e volte ao mapa.

> "O modo de letras maiores fica salvo na conta, pensado para idosos. Todos os botões têm rótulo para leitor de tela."

### 2:50 a 3:50 | Gestor e automação PL/SQL

- Perfil > **Sair**. Entre como **Gestor da prefeitura**.

> "O gestor vê a fila por prioridade."

- Toque **Rodar rotinas agora**.

> "Esse botão chama o pacote PKG_ZL_INDICADOR: detectar_atrasos grava na linha do tempo cada ocorrência com prazo vencido, recalcular_prioridades usa BULK COLLECT com LIMIT e FORALL para processar em lotes com memória constante, e gerar_indicadores faz um MERGE que consolida o mês por bairro. Num banco com privilégio de job, o script 07 agenda isso todo dia às 6 horas."

- Abra a ocorrência de lixo que a Ana criou, escreva um comentário e toque **Mover para Em análise**.

> "A procedure atualizar_status confere se o usuário é gestor e se a transição é permitida. Se eu tentasse pular direto para resolvida, o banco recusaria. A linha do tempo é gravada pelo trigger, com o comentário e o nome do gestor."

- Aba **Painel**: mostre o mês atual que apareceu depois da rotina.

### 3:50 a 4:30 | Banco e testes (VS Code / terminal)

- Mostre rapidamente `03_pkg_ocorrencia.sql` (a fórmula da prioridade) e rode no terminal:
  ```
  python testar_regras.py
  ```

> "Esse script roda 26 casos contra o Oracle da FIAP, cada regra e cada recusa, dentro de uma transação que é desfeita no fim. Todos passam."

- Mostre o Swagger por 5 segundos.

> "A API tem Swagger com todas as rotas. Na lista do mapa, a compressão gzip reduz a resposta de 7,7 para 1,5 KB, e o catálogo e as fotos vêm com cache."

### 4:30 a 4:45 | Fechamento

> "O código, o README, o DER, o MER e a documentação completa estão no GitHub. Esse foi o Zelo, Global Solution 2026. Obrigado."
