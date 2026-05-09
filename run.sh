#!/bin/bash

# Pipeline de Automação de Faturamento Hospitalar
# 
# Para agendamento automático via cron (segunda-feira às 06h30):
# 30 6 * * 1 /caminho/para/desafio-plansul/run.sh >> /caminho/para/desafio-plansul/logs/cron.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configura log com timestamp
LOG_FILE="logs/pipeline_$(date +%Y%m%d_%H%M%S).log"

# Executa o pipeline
node src/index.js 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERRO: Pipeline falhou com código $EXIT_CODE" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pipeline executado com sucesso" | tee -a "$LOG_FILE"
exit 0
