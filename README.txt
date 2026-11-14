=====================================================================
 ZELO | Zeladoria urbana centrada no cidadão
 Global Solution 2 (2026) | FIAP | CitizenTech
 Yuri Sousa | RM 556163
=====================================================================

O QUE É
-------
Aplicativo em React Native para o cidadão relatar problemas de espaço
público (buraco, poste apagado, calçada sem acessibilidade, lixo,
vazamento, árvore com risco, sinalização, alagamento), a vizinhança
confirmar o problema e todo mundo acompanhar o atendimento da prefeitura
com protocolo, prazo e linha do tempo. ODS 11 da ONU (Cidades e
Comunidades Sustentáveis).

FUNCIONALIDADES PRINCIPAIS (login e cadastro não contam)
  1. Relatar problema com foto, local no mapa e sinais de risco e de
     acessibilidade. Antes de enviar, o banco avisa se já existe a mesma
     ocorrência a menos de 60 m e sugere apoiar a existente.
  2. Mapa do bairro em tela cheia, com busca por protocolo ou título,
     filtro por categoria e lista por prioridade calculada no banco;
     botão "Também vi esse problema" (apoio), que sobe a prioridade.
  3. Acompanhamento: protocolo, etapas, prazo, foto de antes e depois,
     mini mapa, linha do tempo, comentários, compartilhar protocolo,
     cancelar o próprio pedido e avaliar o atendimento (1 a 5 estrelas).
  4. Notificações geradas pelo banco: mudança de status (para quem
     relatou e quem apoiou), prazo vencido, apoio novo e comentário.
  5. Painel da transparência por bairro: em aberto, atrasadas, resolvidas,
     % no prazo, gráfico de 6 meses, problemas mais relatados e ranking.
  6. Área do gestor: fila com filtros, mudança de status com comentário,
     foto da solução, cancelamento só com motivo, rotinas PL/SQL e o
     histórico das execuções.
  7. Perfil: pontos e nível, editar nome e bairro, trocar senha.
  Acessibilidade: modo "letras maiores" salvo na conta, rótulos para
  leitor de tela em todos os controles e alvos de toque de 44 px ou mais.

ESTRUTURA DO REPOSITÓRIO
------------------------
  database/            scripts Oracle (DDL, pacotes PL/SQL, triggers,
                       views, carga, job) + instalador e testes em Python
  backend/zelo-api/    API REST em Spring Boot 4 (Java 21)
  mobile/ZeloApp/      aplicativo React Native (Expo SDK 57, TypeScript)
  docs/DOCUMENTACAO.md documentação técnica completa
  docs/modelo/         DER e MER (PNG e SVG)
  docs/telas/          capturas do aplicativo
  docs/roteiros/       roteiros dos vídeos (pitch e técnico)
  scripts/             atalhos .bat para subir API e app no Windows

REQUISITOS
----------
  - Java 21 (JDK). Maven não precisa: o projeto usa o wrapper mvnw.
  - Node.js 20 ou mais novo.
  - Python 3.10+ com o pacote oracledb (pip install oracledb), só para
    instalar e testar o banco.
  - Acesso a um Oracle 19c (o da FIAP: oracle.fiap.com.br:1521/ORCL).

COMO EXECUTAR
-------------
1) Credenciais do Oracle
   Copie backend/zelo-api/config/oracle.properties.example para
   backend/zelo-api/config/oracle.properties e preencha usuário e senha.
   (Ou defina ORACLE_USER, ORACLE_PASSWORD e ORACLE_URL.) O arquivo real
   está no .gitignore e nunca vai para o repositório.

2) Banco de dados
     cd database
     pip install oracledb
     python executar_scripts.py --recriar
     python testar_regras.py
   O primeiro instala tudo (e recria do zero se já existir); o segundo
   executa 48 casos de teste das regras PL/SQL dentro de uma transação
   que é desfeita no final. Pelo SQL Developer: rode 01 a 07 em ordem.
   Se a API estiver ligada quando o banco for recriado, reinicie a API.

3) API (porta 8080)
     cd backend/zelo-api
     mvnw.cmd spring-boot:run        (Windows)
     ./mvnw spring-boot:run          (Linux/macOS)
   Ou scripts\iniciar_api.bat. Documentação interativa:
   http://localhost:8080/swagger-ui.html

4) Aplicativo
     cd mobile/ZeloApp
     npm install
     npx expo start --web --port 8082     (navegador)
     npx expo start                       (Expo Go no celular)
   Ou scripts\iniciar_app.bat. No celular físico, aponte para o IP do
   computador: EXPO_PUBLIC_API_URL=http://SEU_IP:8080/api npx expo start
   No emulador Android o endereço 10.0.2.2 já é usado automaticamente.

CONTAS DE DEMONSTRAÇÃO (atalhos na tela de entrada)
  ana@zelo.app      123456     cidadã de Itaquera
  joaquim@zelo.app  123456     cidadão idoso, letras maiores ligadas
  mariana@zelo.app  123456     cidadã de Vila Mariana
  carlos@zelo.app   123456     cidadão de Capão Redondo
  gestor@zelo.app   gestor123  gestor da prefeitura

JUSTIFICATIVAS TÉCNICAS (resumo; detalhes em docs/DOCUMENTACAO.md)
-----------------------
  - React Native + Expo: um código só para Android, iOS e web, com
    câmera, GPS e compressão de imagem prontos. Entra na lista de
    tecnologias exigidas e foi a base das fases 5 a 7 do curso.
  - Regras no PL/SQL: protocolo, prazo, prioridade, duplicidade, transição
    de status e indicadores ficam no banco. Qualquer cliente (app, painel,
    script) obedece às mesmas regras, e a API fica fina.
  - Spring Boot com JdbcTemplate: chama os pacotes PL/SQL direto, sem
    camada ORM no caminho; JWT stateless e BCrypt para senha.
  - Leaflet + OpenStreetMap: mapa sem chave de API e sem custo.
  - Fotos em disco, nome no banco: consultas leves e backup menor.
  - Memória e eficiência: listas virtualizadas, React.memo, cancelamento
    de requisição ao sair da tela, foto reduzida de ~4 MB para ~150 KB,
    cache do catálogo, BULK COLLECT/FORALL no PL/SQL, gzip na API
    (lista do mapa cai de 7,7 KB para 1,5 KB). Ver seção 6 da documentação.

LIMITAÇÕES CONHECIDAS
  - O schema de aluno da FIAP não tem o privilégio CREATE JOB. O script
    07_job.sql tenta agendar a rotina diária e, sem permissão, apenas
    registra um aviso no log; a mesma rotina roda pelo botão do gestor.
  - Notificação push ficou fora do escopo desta entrega.
