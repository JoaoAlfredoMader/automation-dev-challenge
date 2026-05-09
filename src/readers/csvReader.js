const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const logger = require('../utils/logger');
const { normalizeString, normalizeHeader } = require('../utils/normalizer');

async function readCSV(dataDir) {
  const filePath = path.join(dataDir, 'cobrancas_convenio.csv');
  logger.info(`Lendo arquivo CSV: ${filePath}`);

  return new Promise((resolve, reject) => {
    const records = [];
    const expectedColumns = [
      'num_guia', 'nome_beneficiario', 'cpf_beneficiario', 'ans',
      'nome_operadora', 'descricao_servico', 'cod_tuss',
      'dt_realizacao', 'dt_lancamento', 'vl_servico', 'vl_glosa', 'vl_liquido'
    ];

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ';' }))
      .on('headers', (headers) => {
        const normalizedHeaders = headers.map(h => normalizeHeader(h));
        const missingColumns = expectedColumns.filter(col => 
          !normalizedHeaders.includes(col)
        );
        if (missingColumns.length > 0) {
          reject(new Error(`Colunas faltantes no CSV: ${missingColumns.join(', ')}`));
        }
      })
      .on('data', (data) => {
        const record = {};
        for (const [key, value] of Object.entries(data)) {
          const normalizedKey = normalizeHeader(key);
          
          if (normalizedKey === 'nome_beneficiario' || normalizedKey === 'descricao_servico' || normalizedKey === 'nome_operadora') {
            record[normalizedKey] = normalizeString(value || '');
          } else if (['vl_servico', 'vl_glosa', 'vl_liquido'].includes(normalizedKey)) {
            // Valores com vírgula como separador decimal
            record[normalizedKey] = parseFloat((value || '0').replace('.', '').replace(',', '.')) || 0;
          } else if (normalizedKey === 'cpf_beneficiario') {
            record[normalizedKey] = (value || '').replace(/\D/g, '');
          } else {
            record[normalizedKey] = (value || '').trim();
          }
        }
        
        if (record.num_guia) {
          records.push(record);
        }
      })
      .on('end', () => {
        logger.info(`${records.length} registros lidos do CSV`);
        resolve(records);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

module.exports = { readCSV };
