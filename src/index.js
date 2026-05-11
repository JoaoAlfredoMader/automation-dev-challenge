const logger = require('./utils/logger');
const { runPipeline } = require('./pipeline');

async function main() {
  const results = await runPipeline();

  if (results.success) {
    logger.info('Pipeline finalizado. Verifique os logs acima para o resumo completo.');
    process.exit(0);
  } else {
    logger.error(`Erro fatal no pipeline: ${results.error}`);
    process.exit(1);
  }
}

main();
