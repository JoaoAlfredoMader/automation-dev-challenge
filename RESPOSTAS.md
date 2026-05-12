# Respostas ao Questionário — Desenvolvedor de Automação Júnior

## Parte 1 — Sobre o que você construiu

### 1.1
O pipeline lê duas fontes de cobrança (planilha interna e exportação do convênio), identifica divergências entre elas (valores, nomes e códigos de convênio diferentes), renomeia os laudos em PDF para um padrão único e gera um relatório Excel com resumo, detalhamento e alertas. O relatório é enviado por e-mail automaticamente ao final.

### 1.2
A etapa mais difícil foi configurar o envio de e-mail. Tentei usar o Gmail com App Password, mas perdi muito tempo com erros de autenticação e configurações de segurança. Percebi que estava gastando mais tempo no SMTP do que no pipeline em si, então mudei para o Mailtrap, serviço de sandbox para testes de e-mail. Funcionou imediatamente e me permitiu focar na lógica principal do desafio.

### 1.3
- **Valor diferente:** o CSV prevalece, pois o desafio define o CSV como "fonte mais completa e confiável". O `vl_liquido` é usado como referência.
- **Só no CSV:** incluo no relatório como "Cobrança presente apenas no CSV" e marco como divergência. Não descarto o registro.
- **Grafias diferentes:** uso fuzzy matching (`token_set_ratio`) com threshold de 80%. Se o score for inferior a 100%, registro como divergência de nome.

### 1.4
A lógica normaliza o nome do PDF (remove acentos, espaços, converte para maiúsculas) e faz `partial_ratio` contra o nome de cada paciente consolidado. Se o score for >= 70%, considera vinculado. Para refinar quando um paciente tem múltiplos laudos, tento extrair data do nome do arquivo (padrões como `_DD_MM`) e busco o registro com data correspondente.

O maior risco é empate entre dois pacientes com nomes parecidos (ex: João Souza X João Silva). Uma forma de evitar esse problema é usar o partial_ratio, que dá mais importância para as partes do texto que são parecidas, além de tentar encontrar correspondências usando a data presente no nome do arquivo.

### 1.5
A quantidade de PDFs não identificáveis me surpreendeu: 216 de 324. Muitos arquivos não tinham o nome do paciente de forma clara, então foram registrados como "não identificado" no log e no relatório, sem parar o processamento.

---

## Parte 2 — Sobre as decisões técnicas

### 2.1
Escolhi Node.js porque é a stack com a qual tenho mais familiaridade.

Bibliotecas:
- `exceljs`: leitura e escrita de Excel com formatação rica (cores, largura de colunas).
- `csv-parser`: simples e eficiente para CSV com separador `;`.
- `fuzzball`: port do Python `fuzzywuzzy` para fuzzy string matching.
- `nodemailer`: padrão de mercado para envio de e-mail via SMTP.
- `winston`: logging estruturado com rotação e níveis.

Alternativas descartadas: Python (menos familiaridade), SheetJS/`xlsx` (formatação limitada), `fast-csv` (mais complexo do que necessário).

### 2.2
Separei o código por responsabilidade:
- `src/readers/`: I/O de Excel e CSV.
- `src/consolidator/`: lógica de merge e detecção de divergências.
- `src/pdfProcessor/`: renomeação de PDFs.
- `src/reportGenerator/`: geração do Excel formatado.
- `src/emailSender/`: envio de e-mail.
- `src/utils/`: normalizador de strings e logger compartilhado.
- `src/pipeline.js`: orquestração que encadeia tudo.

Essa estrutura facilita a manutenção: se amanhã mudar o formato do Excel, só alterar `readers/excelReader.js`.

### 2.3
- **Excel com coluna faltante:** `readExcel` valida os headers contra uma lista esperada e responde com erro avisando que tem colunas faltando. O pipeline captura e encerra com exit code.
- **vl_liquido vazio ou texto:** `parseFloat` converte texto inválido para 0. O pipeline não quebra, mas o valor zero pode gerar uma divergência de valor no relatório.
- **PDFs com nomes parecidos:** o algoritmo pega o primeiro match com score >= 70%. Não há desempate sofisticado — isso é uma limitação conhecida.
- **Pipeline roda 2x sem mudança nos dados:** PDFs já existentes em `output/` são pulados (`fs.access` + skip). O relatório pode dar `EBUSY` se estiver aberto no Excel — há retry automático (3 tentativas, 1s de delay).

### 2.4
Notificações no Slack ou Teams em caso de falha no pipeline.

Banco SQLite para armazenar histórico de execuções e métricas (tempo, taxa de sucesso e percentual de laudos renomeados).

Health check periódico para garantir que o cron continue ativo.

### 2.5
A lógica de desempate de PDFs quando um paciente tem múltiplos laudos é fraca. Hoje só tenta extrair data do nome do arquivo. Com mais tempo, faria matching por CPF + data + procedimento. Também faltam testes automatizados — só fiz testes manuais.

---

## Parte 3 — Visão de evolução

### 3.1
Como próxima evolução, eu colocaria a interface Node.js em um servidor Linux VPS para que ela pudesse ser acessada pela internet, e não apenas no localhost. Assim, o sistema poderia rodar continuamente no servidor e ser acessado pela equipe de qualquer lugar pelo navegador.

Além disso, eu criaria um controle de execuções do pipeline dentro da própria interface, mostrando quando um processo está em andamento, concluído ou com erro. Isso resolve problemas que o cron sozinho não resolve, como execuções duplicadas, falta de acompanhamento em tempo real e dificuldade para identificar falhas sem acessar o servidor manualmente.

### 3.2
Adicionaria um novo reader `src/readers/xmlReader.js` para processar o XML. No consolidator, faria merge dos dados do XML com o dataset consolidado por `num_guia`/`id_cobranca`. Criaria uma nova aba no Excel chamada "Retorno Convênio" com status (aprovada/glosa/negada) e motivo. Adicionaria uma nova divergência: "Status no XML diverge do valor esperado".

### 3.3
Foi feito um painel web de controle que permite executar o pipeline, gerenciar arquivos, configurar cron e visualizar logs. Para evoluir com histórico e filtros, adicionaria SQLite no backend com tabelas `executions` (data, status, totais, métricas) e `reports` (caminho, mes, ano, convenio). Criaria endpoints REST para consulta com filtros. No frontend, adicionaria uma tela de histórico simples mostrando evolução mensal de divergências e laudos processados, além de filtros por mês, convênio e tipo de alerta.

### 3.4
**Deve alertar imediatamente:**
- Pipeline falhou (exit code != 0)
- E-mail não enviou após N tentativas
- Arquivo Excel não foi gerado
- Erro de EBUSY persistente (arquivo bloqueado)

**Não deve alertar:**
- % de PDFs não identificados (varia com os dados)
- Número de divergências (depende da qualidade dos dados de entrada)

---

## Parte 4 — Uso de agentes de IA

### 4.1
Sim. Utilizei Kimi 2.6 da kimi AI para auxiliar e acelerar partes como a configuração inicial do projeto, setup do servidor web Express, revisão do README, correção de erros, o avanço com a interface visual do projeto.

---

## Parte 5 — Contexto pessoal

### 5.1
Comecei a trabalhar com automação na Nanovetores, onde era responsável por criar workflows e dar manutenção em automações já existentes com Power Automate e SharePoint. Foi lá que entendi na prática como automações bem feitas conseguem economizar horas de trabalho manual.

Hoje mantenho automações de prospecção de leads no n8n. Mesmo sendo uma ferramenta low-code, acabo usando bastante JavaScript puro nos blocos de código para implementar funções específicas conforme a necessidade do projeto. O resultado é um processo de busca e organização de leads praticamente automático, o que reduziu bastante o trabalho repetitivo e facilitou o acompanhamento das execuções.

Fora isso, tenho alguns projetos pessoais mais simples, como enviar convites no LinkedIn automaticamente todo dia para manter a conta ativa.

O próximo projeto que quero fazer é uma automação para o setor imobiliário: identificar usuários em plataformas de imóveis que tenham mais de duas ou três propriedades e enviar convites de forma automatizada.

### 5.2
Adicionaria testes unitários, validação de schema nos dados de entrada, um banco SQLite para histórico de execuções e documentação técnica.

### 5.3
O desafio pede para renomear os PDFs, mas não especifica se devem ser movidos ou copiados. Decidi copiar para preservar os dados originais em `data/laudos/`.
