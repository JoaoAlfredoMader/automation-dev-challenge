const ExcelJS = require('exceljs');
const path = require('path');
const logger = require('../utils/logger');
const { normalizeString, normalizeHeader } = require('../utils/normalizer');

async function readExcel(dataDir) {
  const filePath = path.join(dataDir, 'cobrancas_internas.xlsx');
  logger.info(`Lendo arquivo Excel: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const records = [];
  const expectedColumns = ['id_cobranca', 'paciente', 'registro_ans', 'procedimento', 'data_atendimento', 'valor'];

  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value?.toString() || '');
  });

  // Validação de colunas
  const missingColumns = expectedColumns.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`Colunas faltantes no Excel: ${missingColumns.join(', ')}`);
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const record = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      
      let value = cell.value;
      
      // Normalizações específicas
      if (header === 'paciente' || header === 'procedimento') {
        value = normalizeString(value?.toString() || '');
      } else if (header === 'valor') {
        value = parseFloat(value?.toString().replace(',', '.').replace('R$', '').trim()) || 0;
      } else if (header === 'data_atendimento') {
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        } else {
          value = value?.toString().trim() || '';
        }
      } else {
        value = value?.toString().trim() || '';
      }
      
      record[header] = value;
    });

    if (record.id_cobranca) {
      records.push(record);
    }
  });

  logger.info(`${records.length} registros lidos do Excel`);
  return records;
}

module.exports = { readExcel };
