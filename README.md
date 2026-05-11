# Pipeline de Automação de Faturamento Hospitalar

Sistema que consolida cobranças de planos de saúde a partir de arquivos Excel (interno) e CSV (convênio), detecta divergências entre as fontes, renomeia laudos em PDF com padrão padronizado e gera relatório Excel com três abas (Resumo, Detalhamento, Alertas). Inclui interface web de controle para execução manual, agendamento cron, gestão de arquivos e visualização de logs.

## Pré-requisitos

- Node.js 18 ou superior
- npm (instalado com o Node.js)
- Git

## Instalação Rápida

```bash
git clone https://github.com/JoaoAlfredoMader/automation-dev-challenge.git
cd automation-dev-challenge
npm install
```

## Como Executar

O projeto pode ser usado de **duas formas**: via interface web (recomendado para testes e controle visual) ou via linha de comando (para automação e cron).

### Opção 1: Interface Web (Recomendado)

```bash
cd web
npm install
npm start
```

Acesse em: **http://localhost:3000**

**Funcionalidades:**
- Dashboard com resumo da última execução
- Botão para executar o pipeline manualmente
- Configuração de cron e SMTP via interface
- Upload/restauração de arquivos de entrada
- Download de relatórios gerados
- Visualização de logs

**Primeiro uso:**
1. Acesse `http://localhost:3000`
2. Vá em **Configurações**
3. Ative o cron e defina horário desejado (padrão: 06:30 seg)
4. (Opcional) Preencha credenciais SMTP para habilitar e-mail
5. Clique em **Salvar Configurações**
6. No Dashboard, clique em **Executar Pipeline** para testar

### Opção 2: Linha de Comando (CLI)

O pipeline roda **sem necessidade de configuração adicional**:

```bash
npm start
```

Ou, caso o PowerShell bloqueie o npm:

```bash
node src/index.js
```

**Comportamento sem configuração de e-mail:**
Se o arquivo `.env` não existir ou não tiver credenciais SMTP preenchidas, o pipeline executa normalmente e **pula o envio de e-mail** com um aviso no log. O relatório Excel e os PDFs renomeados ainda são gerados.

**Exemplo de saída:**
```
Total de cobranças: 197
Cobranças em ambas as fontes: 191
Cobranças apenas no CSV: 6
Cobranças com divergências: 102
Valor líquido total: R$ 116360.00
```

### Para habilitar envio de e-mail (qualquer modo)

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais SMTP:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
EMAIL_FROM=pipeline@empresa.com
EMAIL_TO=gestor@empresa.com
```

## O que o Pipeline Gera

| Saída | Local | Observação |
|-------|-------|------------|
| Relatório Excel | `output/relatorio_faturamento_YYYYMM.xlsx` | 3 abas: Resumo, Detalhamento, Alertas |
| PDFs renomeados | `output/` | Padrão: `CPF-NOME-COB_ID-MMAAAA.pdf` |
| Logs | `logs/pipeline.log` | Logs rotacionados automaticamente |

As pastas `output/` e `logs/` são criadas automaticamente e **não são versionadas** no Git.

## Agendamento com Cron (Linux/macOS)

O repositório inclui o script `run.sh` pronto para agendamento:

```bash
chmod +x run.sh
./run.sh
```

Exemplo de entrada no crontab (segunda-feira às 06:30):

```bash
30 6 * * 1 /caminho/para/automation-dev-challenge/run.sh >> /caminho/para/automation-dev-challenge/logs/cron.log 2>&1
```

O script retorna **exit code 1** em caso de erro, conforme exigido.

## Estrutura do Projeto

```
.
├── data/
│   ├── cobrancas_internas.xlsx    # Dados internos (Excel)
│   ├── cobrancas_convenio.csv     # Dados do convênio (CSV)
│   └── laudos/                    # PDFs originais dos laudos
├── output/                        # Relatórios e PDFs renomeados (gerado)
├── logs/                          # Logs de execução (gerado)
├── src/
│   ├── readers/                   # Leitura de Excel e CSV
│   ├── consolidator/              # Merge e detecção de divergências
│   ├── pdfProcessor/              # Renomeação fuzzy de PDFs
│   ├── reportGenerator/           # Geração do Excel formatado
│   ├── emailSender/               # Envio de e-mail via SMTP
│   ├── utils/                     # Logger e normalizador de strings
│   ├── config/                    # Carregamento de variáveis de ambiente
│   ├── pipeline.js                # Orquestração do pipeline (reutilizável)
│   └── index.js                   # Entry point CLI
├── web/
│   ├── server.js                  # API Express + cron scheduler
│   ├── public/                    # Frontend SPA (HTML/CSS/JS)
│   └── package.json               # Dependências do servidor web
├── run.sh                         # Script shell para execução/cron
├── .env.example                   # Template de configuração (sem valores reais)
├── .gitignore                     # Exclusões de versionamento
├── package.json                   # Dependências do pipeline
└── README.md                      # Este arquivo
```

## Tecnologias Utilizadas

- **Node.js** — runtime principal
- **ExcelJS** — leitura e escrita de arquivos Excel com formatação
- **csv-parser** — leitura de CSV com separador `;`
- **fuzzball** — fuzzy string matching (matching de pacientes e PDFs)
- **Nodemailer** — envio de e-mails SMTP
- **Winston** — logging estruturado
- **Express** — servidor web da interface de controle
- **node-cron** — agendamento de tarefas
- **multer** — upload de arquivos

## Notas para o Avaliador

1. **Clone e execute diretamente**: `npm install && npm start` funciona sem nenhuma configuração adicional.
2. **E-mail é opcional**: o pipeline não falha se o SMTP não estiver configurado.
3. **PDFs originais são preservados**: a renomeação gera cópias em `output/`, mantendo os originais em `data/laudos/`.
4. **Nunca sobrescreve**: se um PDF renomeado já existe em `output/`, ele é pulado.
5. **Retry automático**: se o arquivo Excel de saída estiver aberto no Excel, o sistema tenta 3 vezes antes de gerar com nome alternativo.
6. **Todas as credenciais são via `.env`**: não há valores hardcoded no código. O `.env.example` está com campos vazios.
7. **Interface web roda independentemente**: é um servidor Express separado em `web/` que consome o mesmo `src/pipeline.js`.

## Licença

ISC
