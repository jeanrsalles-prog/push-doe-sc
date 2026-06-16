# push-doe-sc

Busca publicações do **DETRAN/SC** no Diário Oficial de Santa Catarina (DOE-SC)
em nome dos clientes de um escritório, **cruzando nome e CNH** para evitar
homônimos, e entrega uma **planilha de controle de prazos** e um **painel HTML**.

## Como funciona

Para cada cliente: busca por nome na API pública do DOE, confirma que a matéria é
do DETRAN e que o nome aparece no resumo, e cruza a CNH. Se a CNH do edital bate
com a cadastrada, o resultado é **CONFIRMADO**; se diverge, é descartado como
homônimo; se o edital não traz CNH, fica **A CONFERIR**. Extrai CNH, processo
administrativo, tipo de decisão, prazo e a data final para recurso.

## Dados de clientes

A ferramenta **não acompanha nenhuma lista de clientes**. Cada usuário aponta a
**pasta com a sua planilha `.xlsx`** (uma coluna de **nome** e uma de **CNH** —
detectadas pelo cabeçalho "Nome"/"Cliente" e "CNH"/"Registro"; para forçar, use
`NAME_COLUMN` / `CNH_COLUMN`). Os dados são lidos apenas dessa planilha, em
tempo de execução, e **nunca são versionados** — o `.gitignore` bloqueia
`*.xlsx`, `clientes.txt`, `.env`, `csv/` e `data/vistos.json` (LGPD).

## Instalação

```bash
npm install
npm run build
```

## Uso

```bash
CLIENTS_FILE="<pasta>/clientes.xlsx" USE_HISTORY=false CSV_DIR="<pasta de saída>" node dist/index.js
python3 scripts/montar_relatorio.py --entrada "<pasta de saída>/resultados.json" --saida "<pasta de saída>"
```

Entregáveis na pasta de saída: um CSV por edição, `Buscador_Publicacoes_DOE.xlsx`
(planilha de controle com semáforo de prazos), `Dashboard_DOE.html` (painel) e
cópias datadas em `Versões/`. O e-mail é opcional (só com SMTP configurado).

## Configuração

Copie `.env.example` para `.env` e ajuste. Variáveis principais:

| Variável | Função |
|---|---|
| `CLIENTS_FILE` | caminho da planilha `.xlsx` de clientes |
| `NAME_COLUMN` / `CNH_COLUMN` | colunas da planilha (opcional; auto-detecta) |
| `CSV_DIR` | pasta de saída |
| `USE_HISTORY` | `true` evita repetir publicações; `false` = busca independente |
| `SMTP_*`, `EMAIL_*` | e-mail (opcional — em branco, entrega só arquivos) |

## Skill

Instale como skill no Claude. Ao acionar, ela pede a pasta com o `.xlsx`, roda a
busca (sem histórico), gera a planilha e o painel e entrega no chat. Ver `SKILL.md`.
