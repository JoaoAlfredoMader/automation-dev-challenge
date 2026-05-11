# Pipeline de Automação de Faturamento Hospitalar

Consolida cobranças do Excel e CSV, detecta divergências, renomeia laudos em PDF e gera relatório Excel.

## Pré-requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Configuração

Copie o arquivo de exemplo e ajuste se necessário:

```bash
cp .env.example .env
```

O `.env` já vem com valores padrão. Para habilitar o envio de e-mail, descomente e preencha as variáveis SMTP.

## Execução

```bash
npm start
```

Ou direto pelo Node.js (se o PowerShell bloquear o npm):

```bash
node src/index.js
```

## O que gera

| Arquivo | Local |
|---------|-------|
| Relatório Excel | `output/relatorio_faturamento_YYYYMM.xlsx` |
| PDFs renomeados | `output/` |
| Logs | `logs/pipeline.log` |

As pastas `output/` e `logs/` são criadas automaticamente e **não são versionadas**.

## Interface Web (Opcional)

Painel de controle para executar o pipeline, gerenciar arquivos, configurar cron e visualizar relatórios.

```bash
cd web
npm install
npm start
```

Acesse em `http://localhost:3000`.

Funcionalidades:
- Dashboard com resumo da última execução
- Execução manual do pipeline
- Configuração de cron e SMTP via interface
- Upload/restauração de arquivos de entrada
- Download de relatórios gerados
- Visualização de logs

## Estrutura

- `src/readers/` — leitura de Excel e CSV
- `src/consolidator/` — merge e detecção de divergências
- `src/pdfProcessor/` — renomeação de PDFs
- `src/reportGenerator/` — geração do Excel
- `src/emailSender/` — envio de e-mail (opcional)
- `src/pipeline.js` — orquestração do pipeline (reutilizável por CLI e web)
- `data/` — arquivos de entrada
- `web/` — interface web de controle
