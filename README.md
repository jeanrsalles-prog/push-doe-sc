# PUSH-DOE-SC

Monitor de publicações do **DETRAN/SC** no Diário Oficial de Santa Catarina
(DOE-SC). Lê uma lista de clientes (nome + CNH), consulta a API pública do DOE,
filtra as publicações do DETRAN, **cruza nome e CNH** para evitar homônimos e
entrega um relatório (CSV por edição, e e-mail opcional).

## Como funciona

Para cada cliente: busca por nome na API do DOE, confirma que a matéria é do
DETRAN e que o nome aparece de fato no resumo, e cruza a CNH. Se a CNH do edital
bate com a cadastrada, o resultado é **CONFIRMADO**; se diverge, é descartado
como homônimo; se o edital não traz CNH, fica **A CONFERIR**. Extrai CNH,
processo administrativo, tipo de decisão, prazo e a data final para recurso.

## Instalação

```bash
npm install
npm run build
```

## Lista de clientes

Aceita dois formatos (via `CLIENTS_FILE`):

- **Planilha `.xlsx`** — colunas de nome e CNH detectadas pelo cabeçalho
  ("Nome"/"Cliente" e "CNH"/"Registro"). Para forçar, use `NAME_COLUMN` e
  `CNH_COLUMN` (letra ou índice 0-based).
- **Texto `.txt`** — uma linha por cliente, `NOME;CNH`. Veja `clientes.exemplo.txt`.

> Os arquivos `clientes.txt`, `.env` e `data/vistos.json` contêm dados pessoais
> e **não são versionados** (LGPD).

## Configuração

Copie `.env.example` para `.env` e ajuste. Variáveis principais:

| Variável | Função |
|---|---|
| `CLIENTS_FILE` | caminho do `.xlsx` ou `.txt` de clientes |
| `NAME_COLUMN` / `CNH_COLUMN` | colunas da planilha (opcional; auto-detecta) |
| `CSV_DIR` | pasta de saída dos CSVs |
| `USE_HISTORY` | `true` evita repetir publicações; `false` = busca independente |
| `SMTP_*`, `EMAIL_*` | e-mail (opcional — em branco, entrega só arquivos) |

## Modos de uso

1. **Local (Cowork / linha de comando)** — aponte `CLIENTS_FILE` para a planilha
   e rode `npm run search`. Relatório como arquivos (e e-mail, se configurado).
2. **Skill** — instale como skill no Claude; ao pedir a busca, ela solicita o
   arquivo de clientes, roda o motor (sem histórico) e entrega o relatório no
   chat. Veja `SKILL.md`.
3. **Automático (GitHub Actions)** — execução quinzenal sem intervenção, com
   envio por e-mail. Requer os dados de clientes disponíveis ao runner e os
   `Secrets` de SMTP. Atenção à LGPD ao versionar dados de clientes.

## Comandos

```bash
npm run search            # busca (uma execução)
npm run build             # compila para dist/
npm start                 # roda a versão compilada
npm run exportar-clientes # gera clientes.txt (NOME;CNH) a partir do .xlsx
```
