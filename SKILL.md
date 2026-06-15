---
name: publicacoes-doe-sc
metadata:
  version: "1.0"
  owner: "Escritório que instalou o skill"
  review: "Revisar a cada mudança no portal do DOE-SC/DETRAN ou semestralmente"
description: >-
  Busca publicações do DETRAN/SC no Diário Oficial do Estado de Santa Catarina
  (DOE-SC) em nome dos clientes de um escritório, cruzando nome e CNH para
  evitar homônimos, e entrega uma planilha de controle de prazos por edição.
  Use sempre que o usuário pedir para "buscar publicações no DOE-SC", "rodar o
  DOE", "monitorar o DETRAN SC", "ver intimações do DETRAN", "controle de
  prazos de recurso de trânsito em SC", ou subir/apontar uma planilha de
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

A cada execução entrega, na pasta indicada, **um CSV por edição** com:
status (confirmado / a conferir), nome, CNH, processo administrativo, tipo de
decisão, data de publicação, prazo e **data final para recurso**.

## Quando disparar

Sempre que o usuário quiser localizar publicações do DETRAN/SC em nome de seus
clientes ou montar um controle de prazos a partir do DOE-SC. O dado obrigatório
é a **lista de clientes com nome e CNH** — se ela ainda não foi fornecida,
**peça antes de rodar**.

## Passo a passo

### 1. Reunir os parâmetros com o usuário

- **Lista de clientes** (obrigatória): peça para o usuário **subir um arquivo**
  ou **apontar a pasta** que contém:
  - uma planilha `.xlsx` com uma coluna de **nome** e uma coluna de **CNH**
    (o leitor detecta as colunas pelo cabeçalho — "Nome"/"Cliente" e
    "CNH"/"Registro"; se não detectar, peça a letra da coluna), **ou**
  - um `.txt` no formato `NOME;CNH` (um cliente por linha).
- **Pasta de saída** (opcional): onde salvar os CSVs. Se não houver pasta real
  do usuário, use a pasta de trabalho da sessão e avise que é temporária.
- A CNH é o que permite o cruzamento. Clientes sem CNH aparecem como
  **A CONFERIR**, não são descartados.

### 2. Garantir as dependências (uma vez)

A partir da pasta do skill, instale e compile:

```bash
npm install
npm run build
```

Se `dist/` e `node_modules/` já existirem, pode pular este passo.

### 3. Rodar o motor

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

O motor imprime, na última linha após `__RESUMO_JSON__`, um JSON com:
`ok, total, confirmados, aConferir, edicoes, clientesComPublicacao, arquivos,
diretorioCsv, usouHistorico, emailEnviado`. Em erro, imprime
`{"ok": false, "erro": "..."}`.

### 4. Apresentar o resultado (sempre)

- Leia a linha JSON após `__RESUMO_JSON__`.
- Mostre os CSVs gerados ao usuário (cards de arquivo) e um resumo no chat:
  total encontrado, quantos **confirmados** e quantos **a conferir**, e os
  **prazos de recurso mais próximos**.
- Destaque os itens **A CONFERIR** — são os que exigem checagem manual (nome
  bateu, mas o edital não trouxe CNH).

### 5. Em caso de erro

Se o JSON vier com `ok: false`, explique a causa (planilha não encontrada,
coluna de nome/CNH não detectada, falha de rede na API do DOE) e oriente o
ajuste — normalmente informar a coluna correta ou conferir o caminho do arquivo.

## Observações

- Cada busca é **independente** por padrão neste modo (sem deduplicação) — o
  usuário recebe tudo o que for encontrado naquela execução.
- Os dados dos clientes não saem da máquina do usuário: a API do DOE recebe
  apenas o nome para a consulta; o cruzamento de CNH é local.
- Detalhes do formato da planilha e da API estão em `references/formato.md`.
