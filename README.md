# Desafio Plansul - Pipeline de Automação de Faturamento Hospitalar

Pipeline de automação para consolidação de cobranças hospitalares, renomeação de laudos médicos e geração de relatórios de faturamento.

## O que este pipeline faz

1. **Lê** os arquivos de cobrança do Excel (equipe interna) e CSV (sistema do convênio)
2. **Consolida** os dados em um único dataset, detectando divergências de valor, nome e código ANS
3. **Renomeia** os laudos em PDF para o padrão `CPF-NOMEPACIENTE-IDCOBRANCA-MMYYYY.pdf`
4. **Gera** um relatório Excel formatado com 3 abas (Resumo, Detalhamento, Alertas)
5. **Envia** o relatório por e-mail (opcional, via SMTP)

## Pré-requisitos

- Node.js 18+
- npm
- Git

## Instalação

```bash
# Clone o repositório
git clone https://github.com/JoaoAlfredoMader/automation-dev-challenge.git
cd automation-dev-challenge

# Instale as dependências
npm install
```

## Configuração

O pipeline usa variáveis de ambiente para configuração. Siga os passos:

### 1. Crie o arquivo `.env`

```bash
cp .env.example .env
```

### 2. Configure o SMTP (opcional - apenas para envio de e-mail)

Edite o `.env` e preencha as credenciais:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-app-password
EMAIL_FROM=seu-email@gmail.com
EMAIL_TO=destinatario@empresa.com
```

#### Para testes com Mailtrap (recomendado):

1. Crie uma conta gratuita em [mailtrap.io](https://mailtrap.io)
2. Vá em **Email Testing** → **Inboxes** → selecione sua inbox
3. Copie as credenciais de **SMTP** (host, port, user, password)
4. Cole no `.env`

#### Para usar Gmail:

1. Ative a autenticação de 2 fatores na sua conta Google
2. Gere uma **App Password** em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use essa App Password no campo `SMTP_PASS` (não use sua senha normal!)

> **Nota:** Se o SMTP não estiver configurado, o pipeline roda normalmente e apenas pula o envio de e-mail.

## Execução

### Via npm

```bash
npm start
```

### Via Node.js direto (se npm estiver bloqueado no PowerShell)

```bash
node src/index.js
```

### Via shell script (Linux/Mac)

```bash
bash run.sh
```

## O que acontece quando executa

O pipeline executa 5 etapas em sequência:

1. **Leitura dos arquivos** → lê `data/cobrancas_internas.xlsx` (191 registros) e `data/cobrancas_convenio.csv` (197 registros)
2. **Consolidação** → une os dados, detecta 102 divergências (valores, nomes, códigos ANS)
3. **Renomeação de PDFs** → vincula laudos aos registros por similaridade de nome
4. **Geração do relatório** → cria `output/relatorio_faturamento_YYYYMM.xlsx` com 3 abas
5. **Envio de e-mail** → envia o relatório (se SMTP configurado)

## Estrutura do Projeto

```
automation-dev-challenge/
├── src/
│   ├── config/           # Configurações e variáveis de ambiente
│   ├── utils/            # Utilitários (logger, normalização de strings)
│   ├── readers/          # Leitura de Excel e CSV
│   ├── consolidator/     # Lógica de merge e detecção de divergências
│   ├── pdfProcessor/     # Renomeação de laudos em PDF
│   ├── reportGenerator/  # Geração do relatório Excel
│   ├── emailSender/      # Envio de e-mail via SMTP
│   └── index.js          # Orquestrador do pipeline
├── data/                 # Arquivos de entrada (não versionar outputs)
│   ├── cobrancas_internas.xlsx
│   ├── cobrancas_convenio.csv
│   └── laudos/           # Laudos em PDF
├── output/               # Arquivos gerados (PDFs renomeados, relatórios)
├── logs/                 # Logs de execução
├── run.sh                # Script de execução com logging
├── .env.example          # Exemplo de variáveis de ambiente
├── .gitignore            # Arquivos ignorados pelo Git
├── package.json          # Dependências do projeto
├── README.md             # Este arquivo
└── RESPOSTAS.md          # Respostas ao questionário do desafio
```

## Saídas do Pipeline

Após a execução, você encontrará:

| Local | Arquivos |
|-------|----------|
| `output/` | PDFs renomeados no padrão `CPF-NOMEPACIENTE-IDCOBRANCA-MMYYYY.pdf` |
| `output/` | `relatorio_faturamento_YYYYMM.xlsx` (3 abas: Resumo, Detalhamento, Alertas) |
| `logs/` | `pipeline.log` com todo o histórico de execução |

> **Nota:** As pastas `output/` e `logs/` são criadas automaticamente na primeira execução. Elas **não são versionadas** no Git (estão no `.gitignore`).

## Tratamento de Erros

O pipeline é resiliente a:

- **Colunas faltantes** nos arquivos de entrada → lança erro descritivo e encerra com código 1
- **Valores inválidos** → converte para 0 e continua
- **Falha no envio de e-mail** → loga o erro mas não quebra o pipeline
- **PDFs não identificados** → registra no log e continua
- **Execução duplicada** → não sobrescreve PDFs já renomeados (idempotente)

Em caso de erro fatal, o script retorna código de saída **1**.

## Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **exceljs** - Leitura e escrita de arquivos Excel com formatação
- **csv-parser** - Parsing de CSV com separador customizado (`;`)
- **fuzzball** - Algoritmos de similaridade de texto (fuzzy matching)
- **nodemailer** - Envio de e-mails via SMTP
- **winston** - Logging estruturado com timestamps
- **dotenv** - Gerenciamento de variáveis de ambiente

## Agendamento Automático (Linux/Mac)

Para executar toda segunda-feira às 06h30, adicione ao crontab:

```bash
crontab -e
```

E adicione a linha:

```cron
30 6 * * 1 /caminho/completo/para/automation-dev-challenge/run.sh >> /caminho/completo/para/automation-dev-challenge/logs/cron.log 2>&1
```

## Licença

MIT
