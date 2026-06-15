# Formato da planilha e detalhes da API

## Planilha de clientes (.xlsx)

- **Nome**: coluna detectada pelo cabeçalho ("Nome" ou "Cliente"); se não houver
  cabeçalho reconhecível, usa a coluna B. Override: `NAME_COLUMN`.
- **CNH**: coluna detectada pelo cabeçalho ("CNH" ou "Registro"). Override:
  `CNH_COLUMN`. Aceita letra ("C") ou índice 0-based ("2").
- A CNH pode estar como texto ou número; zeros à esquerda perdidos pela planilha
  são tratados na comparação.

## Alternativa em .txt

Um cliente por linha, `NOME;CNH`. A CNH é opcional (sem ela, o cliente vira
"A CONFERIR"). Linhas com `#` são ignoradas.

## API do DOE-SC

- `POST https://portal.doe.sea.sc.gov.br/apis/busca-materia`
- Payload: `{ busca, tipoBusca: 2, pagination: { from, size: 50 }, resumo: false, aCdAssunto: [], aCdCategoria: [] }`
- A URL da matéria vem no campo `extrato`; o HTML renderizado em `preview`.
- Formatos de edital cobertos: decisão da JARI, instauração de processo de
  suspensão, manutenção/anulação de penalidade (CETRAN).
