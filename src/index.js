const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const logger = require('./utils/logger');
const { readExcel } = require('./readers/excelReader');
const { readCSV } = require('./readers/csvReader');
const { consolidateData } = require('./consolidator');
const { renamePdfs } = require('./pdfProcessor');
const { generateReport } = require('./reportGenerator');
const { sendEmail } = require('./emailSender');

async function ensureDirectories() {
  await fs.mkdir(config.paths.output, { recursive: true });
  await fs.mkdir(config.paths.logs, { recursive: true });
}

async function main() {
  try {
    logger.info('========================================');
    logger.info('Iniciando pipeline de faturamento');
    logger.info('========================================');

    await ensureDirectories();

    // 1. Leitura dos arquivos
    logger.info('Etapa 1: Leitura dos arquivos de entrada');
    const excelRecords = await readExcel(config.paths.data);
    const csvRecords = await readCSV(config.paths.data);

    // 2. Consolidação
    logger.info('Etapa 2: Consolidação dos dados');
    const { consolidated, divergences, stats } = consolidateData(excelRecords, csvRecords);

    // Calcula totais financeiros
    stats.totalLiquido = consolidated.reduce((sum, r) => sum + (r.vl_liquido || 0), 0);
    stats.totalGlosa = consolidated.reduce((sum, r) => sum + (r.vl_glosa || 0), 0);

    // 3. Renomeação de PDFs
    logger.info('Etapa 3: Renomeação dos laudos em PDF');
    const pdfResults = await renamePdfs(config.paths.data, config.paths.output, consolidated);

    // 4. Geração do relatório
    logger.info('Etapa 4: Geração do relatório Excel');
    // Determina o mês/ano a partir dos dados (usa o primeiro registro como referência)
    const firstDate = consolidated.find(r => r.dt_realizacao || r.data_atendimento);
    let monthYear = '202411'; // fallback
    if (firstDate) {
      const date = firstDate.dt_realizacao || firstDate.data_atendimento;
      if (date && date.includes('-')) {
        const [year, month] = date.split('-');
        monthYear = `${year}${month}`;
      }
    }
    const reportPath = await generateReport(config.paths.output, consolidated, divergences, stats, pdfResults, monthYear);

    // 5. Envio de e-mail
    logger.info('Etapa 5: Envio do relatório por e-mail');
    let emailResult;
    try {
      emailResult = await sendEmail(reportPath, stats, monthYear);
    } catch (error) {
      logger.error(`Falha no envio de e-mail: ${error.message}`);
      emailResult = { sent: false, reason: error.message };
    }

    // Resumo final
    logger.info('========================================');
    logger.info('Pipeline concluído com sucesso!');
    logger.info(`Total de cobranças: ${stats.total}`);
    logger.info(`Cobranças em ambas as fontes: ${stats.both}`);
    logger.info(`Cobranças apenas no Excel: ${stats.onlyExcel}`);
    logger.info(`Cobranças apenas no CSV: ${stats.onlyCsv}`);
    logger.info(`Cobranças com divergências: ${stats.divergences}`);
    logger.info(`Valor líquido total: R$ ${stats.totalLiquido.toFixed(2)}`);
    logger.info(`PDFs renomeados: ${pdfResults.renamed}`);
    logger.info(`PDFs pulados: ${pdfResults.skipped}`);
    logger.info(`PDFs não identificados: ${pdfResults.notFound}`);
    logger.info(`Relatório: ${reportPath}`);
    logger.info(`E-mail enviado: ${emailResult.sent ? 'Sim' : 'Não'}${emailResult.reason ? ` (${emailResult.reason})` : ''}`);
    logger.info('========================================');

    process.exit(0);
  } catch (error) {
    logger.error(`Erro fatal no pipeline: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
