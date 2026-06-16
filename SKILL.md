---
name: publicacoes-doe-sc
metadata:
  version: "1.1"
  owner: "Escritório que instalou o skill"
  review: "Revisar a cada mudança no portal do DOE-SC/DETRAN ou semestralmente"
description: >-
  Busca publicações do DETRAN/SC no Diário Oficial do Estado de Santa Catarina
  (DOE-SC) em nome dos clientes de um escritório, cruzando nome e CNH para
  evitar homônimos, e entrega uma planilha de controle de prazos e um painel
  HTML. Use sempre que o usuário pedir para "buscar publicações no DOE-SC",
  "rodar o DOE", "monitorar o DETRAN SC", "ver intimações do DETRAN", "controle
  de prazos de recurso de trânsito em SC", ou subir/apontar uma planilha de
  clientes (nome e CNH) para busca no Diário Oficial de Santa Catarina.
  Específico do DOE-SC/DETRAN — para intimações nacionais por OAB, use a skill
  publicacoes-djen.
---

# Publicações DOE-SC / DETRAN — buscador e controle de prazos

Este skill consulta a **API pública do Diário Oficial de Santa Catarina**
(DOE-SC) em busca de publicações do **DETRAN/SC** (editais da JARI, instauração
de processo de suspensão, manutenção/anulação de penalidade) que mencionem os
clientes do escritório. Para cada cliente, confirma o resultado **cruzando o
nome com a CNH** — se a CNH do edital bate com a cadastrada, marca CONFIRMADO;
se diverge, descarta como homônimo; se o edital não traz CNH, marca A CONFERIR.

A cada execução entrega, na pasta indicada:

1. **um CSV por edição** (status, nome, CNH, processo, tipo de decisão, data de
   publicação, prazo e data final para recurso) e um `resultados.json` técnico;
2. **`Buscador_Publicacoes_DOE.xlsx`** — planilha de controle única, ordenada por
   prazo, com semáforo e um bloco de controle (amarelo) preservado entre
   execuções pelo ID da matéria;
3. **`Dashboard_DOE.html`** — painel de leitura rápida (KPIs, barras e tabela
   filtrável), que abre em qualquer navegador sem depender de internet;
4. uma **cópia datada em `Versões/`** da planilha e do painel.

## Quando disparar

Sempre que o usuário quiser localizar publicações do DETRAN/SC em nome de seus
clientes ou montar um controle de prazos/painel a partir do DOE-SC.

## Passo a passo

### 1. Reunir os parâmetros com o usuário

**Ao acionar, sempre peça a planilha (upload) ou a pasta antes de rodar** — o
motor só deve abrir um arquivo `.xlsx` de origem confiável, indicado pelo próprio
usuário. Não rode sobre arquivos de procedência desconhecida.

- **Planilha de clientes** (obrigatória): peça ao usuário para **apontar a pasta
  (ou subir o arquivo) com a planilha `.xlsx`** que contém uma coluna de **nome**
  e uma coluna de **CNH**. O leitor detecta as colunas pelo cabeçalho
  ("Nome"/"Cliente" e "CNH"/"Registro"); se não detectar, peça a letra da coluna
  (`NAME_COLUMN` / `CNH_COLUMN`). A skill **não** mantém lista de clientes
  embutida — os dados são sempre os do `.xlsx` indicado por quem usa.
- **Pasta de saída** (opcional): onde salvar os arquivos. Prefira uma pasta real
  do usuário (ex.: uma pasta conectada do OneDrive/Drive), para persistir e
  servir à automação. Se não houver, use a pasta de trabalho da sessão e avise
  que é temporária.
- A CNH é o que permite o cruzamento. Clientes sem CNH aparecem como
  **A CONFERIR**, não são descartados.

### 2. Garantir as dependências (uma vez)

A partir da pasta do skill:

```bash
npm install
npm run build
```

Se você instalou pelo **pacote `.skill`** (que já traz `dist/` compilado), basta
instalar as dependências de runtime: `npm install --omit=dev`.

O gerador da planilha/painel usa `openpyxl`:

```bash
pip install openpyxl --break-system-packages -q
```

### 3. Rodar o motor (busca)

Aponte para a lista do usuário, com histórico desligado (busca independente) e
sem e-mail (entrega só por arquivos):

```bash
CLIENTS_FILE="<arquivo .xlsx ou .txt do usuário>" \
USE_HISTORY=false \
CSV_DIR="<pasta de saída>" \
node dist/index.js
```

Se a auto-detecção de coluna falhar, acrescente `NAME_COLUMN=B` e/ou
`CNH_COLUMN=C` (letra da coluna ou índice 0-based).

O motor imprime, após `__RESUMO_JSON__`, um JSON com: `ok, total, confirmados,
aConferir, edicoes, clientesComPublicacao, arquivos, diretorioCsv,
usouHistorico, emailEnviado`. Em erro, imprime `{"ok": false, "erro": "..."}`.
Ele também grava um `resultados.json` na pasta de saída — é o que o gerador lê.

> **Janela de tempo:** a busca por nome traz todo o histórico do nome no DOE
> (pode incluir editais antigos). Para recortar um período curto, filtre por data
> de publicação ao montar o relatório, ou ligue o histórico (`USE_HISTORY=true`)
> para que rodadas seguintes só tragam novidades.

### 4. Gerar a planilha de controle e o painel (sempre)

Depois da busca, rode o gerador apontando para a mesma pasta:

```bash
python3 scripts/montar_relatorio.py \
  --entrada "<pasta de saída>/resultados.json" \
  --saida "<pasta de saída>" \
  --urgente 5 \
  --titulo "<nome do escritório>"
```

Ele cria `Buscador_Publicacoes_DOE.xlsx`, `Dashboard_DOE.html` e a cópia em
`Versões/`, e imprime, após `__RESUMO_RELATORIO__`, um JSON com `total,
confirmados, aConferir, vencidos, urgentes, semPrazo, planilha, dashboard,
versoes`. Se a pasta anterior já tiver a planilha, o **bloco de controle**
(Status, Responsável, Prazo fatal, Providência, Data da ciência) é **preservado
por ID**.

### 5. Apresentar o resultado (sempre)

- Leia os dois JSONs (`__RESUMO_JSON__` da busca e `__RESUMO_RELATORIO__`).
- Mostre ao usuário a **planilha** e o **painel** (cards de arquivo) e um resumo
  no chat: total, confirmados, a conferir e os **prazos de recurso mais próximos**.
- Destaque os itens **A CONFERIR** — nome bateu, mas o edital não trouxe CNH.

### 6. Em caso de erro

Se um JSON vier com `ok: false`, explique a causa (planilha não encontrada,
coluna de nome/CNH não detectada, falha de rede na API do DOE) e oriente o
ajuste — normalmente informar a coluna correta ou conferir o caminho do arquivo.

## O que a planilha entrega

Colunas: Status busca (CONFIRMADO / A CONFERIR) · Cliente · CNH · Nº Processo
administrativo · Tipo de decisão · Data publicação · Prazo (dias) · Data final
p/ recurso · **[bloco de controle, amarelo:] Status · Responsável · Prazo fatal
(confirmado) · Providência · Data da ciência** · Edição · ID · Link oficial.

**Semáforo** por dias corridos até a data final estimada de recurso: vermelho
escuro = vencido (estimado); vermelho ≤ limite de urgência; amarelo 6–10; verde
11+; sem cor = sem prazo no edital. As linhas vêm em ordem cronológica crescente
(vence primeiro no topo); as sem prazo ao final. O **bloco de controle é
preservado entre execuções** casando pelo `ID`: o que a controladoria editar não
se perde quando o arquivo é regerado.

## Segurança e dados (LGPD)

- A busca envia à API pública do DOE **apenas o nome** do cliente; o cruzamento
  de CNH é **local**. CNH não sai da máquina.
- Os entregáveis contêm nome e CNH — **dado pessoal**: trate como uso interno.
- O `.gitignore` já exclui `clientes.txt`, `*.xlsx`, `csv/`, `data/vistos.json` e
  `.env`, então **abrir o repositório de código não expõe dados de cliente**.
- **Atenção ao modo agendado (GitHub Actions):** se ligado, ele faz commit do
  `data/vistos.json` (que guarda nomes) de volta ao repositório. Num repositório
  **público**, isso exporia nomes. Para uso público, mantenha o histórico fora do
  versionamento (artefato/segredo do CI) ou hasheie os nomes. No uso manual/local
  isto não acontece.
- O envio por e-mail (opcional) valida os destinatários e exige TLS. Mantenha o
  `SMTP_PASS` como **senha de aplicativo** no `.env` (nunca versionado).
- Manutenção: rode `npm audit` periodicamente. O `xlsx` (SheetJS) tem avisos sem
  correção no npm — por isso o `.xlsx` deve vir sempre do próprio escritório.

## Observações

- Cada busca é **independente** por padrão neste modo (sem deduplicação) — o
  usuário recebe tudo o que for encontrado naquela execução.
- Os prazos são **apoio**: a data final é estimada do prazo escrito no edital; a
  data fatal real é a conferida nos autos.
- Detalhes do formato da planilha e da API estão em `references/formato.md`.
