const ExcelJS = require('exceljs');
const path = require('path');
const logger = require('../utils/logger');

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
};

const HEADER_FONT = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const ALERT_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC000' },
};

function formatCurrency(value) {
  if (value === null || value === undefined) return '-';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

async function generateReport(outputDir, consolidated, divergences, stats, pdfResults, monthYear) {
  const fileName = `relatorio_faturamento_${monthYear}.xlsx`;
  const filePath = path.join(outputDir, fileName);
  logger.info(`Gerando relatório: ${filePath}`);

  const workbook = new ExcelJS.Workbook();

  // === ABA 1: RESUMO ===
  const summarySheet = workbook.addWorksheet('Resumo');
  
  summarySheet.addRow(['Relatório de Faturamento Hospitalar']);
  summarySheet.addRow([`Período: ${monthYear}`]);
  summarySheet.addRow([]);
  
  summarySheet.addRow(['Totais do Processamento']);
  summarySheet.addRow(['Métrica', 'Valor']);
  summarySheet.addRow(['Total de Cobranças', stats.total]);
  summarySheet.addRow(['Cobranças em Ambas as Fontes', stats.both]);
  summarySheet.addRow(['Cobranças Apenas no Excel', stats.onlyExcel]);
  summarySheet.addRow(['Cobranças Apenas no CSV', stats.onlyCsv]);
  summarySheet.addRow(['Cobranças com Divergências', stats.divergences]);
  summarySheet.addRow([]);
  
  const totalLiquido = consolidated
    .reduce((sum, r) => sum + (r.vl_liquido || 0), 0);
  const totalGlosa = consolidated
    .reduce((sum, r) => sum + (r.vl_glosa || 0), 0);
  
  summarySheet.addRow(['Financeiro']);
  summarySheet.addRow(['Métrica', 'Valor']);
  summarySheet.addRow(['Valor Líquido Total', formatCurrency(totalLiquido)]);
  summarySheet.addRow(['Total de Glosas', formatCurrency(totalGlosa)]);
  summarySheet.addRow([]);
  
  summarySheet.addRow(['Resultado da Renomeação de Laudos']);
  summarySheet.addRow(['Métrica', 'Valor']);
  summarySheet.addRow(['PDFs Renomeados', pdfResults.renamed]);
  summarySheet.addRow(['PDFs Pulados (já existiam)', pdfResults.skipped]);
  summarySheet.addRow(['PDFs Não Identificados', pdfResults.notFound]);

  // Formatação do header
  [4, 11, 16].forEach(rowNum => {
    const row = summarySheet.getRow(rowNum);
    row.eachCell(cell => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
  });

  summarySheet.columns.forEach(col => {
    col.width = 35;
  });

  // === ABA 2: DETALHAMENTO ===
  const detailSheet = workbook.addWorksheet('Detalhamento');
  
  const detailHeaders = [
    'ID Cobrança', 'Fonte', 'Paciente (Excel)', 'Paciente (CSV)', 'CPF',
    'ANS (Excel)', 'ANS (CSV)', 'Operadora', 'Procedimento (Excel)', 
    'Procedimento (CSV)', 'TUSS', 'Data Atendimento', 'Data Realização',
    'Data Lançamento', 'Valor (Excel)', 'Vl. Serviço', 'Vl. Glosa', 
    'Vl. Líquido', 'Divergências', 'PDF Renomeado'
  ];
  
  detailSheet.addRow(detailHeaders);
  const detailHeaderRow = detailSheet.getRow(1);
  detailHeaderRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });

  for (const record of consolidated) {
    const pdfMapping = pdfResults.mappings.find(m => m.record === record.id_cobranca);
    const pdfName = pdfMapping ? pdfMapping.newName : '-';
    
    const row = detailSheet.addRow([
      record.id_cobranca,
      record.fonte,
      record.paciente_excel || '-',
      record.paciente_csv || '-',
      record.cpf || '-',
      record.registro_ans_excel || '-',
      record.registro_ans_csv || '-',
      record.nome_operadora || '-',
      record.procedimento_excel || '-',
      record.procedimento_csv || '-',
      record.cod_tuss || '-',
      formatDate(record.data_atendimento),
      formatDate(record.dt_realizacao),
      formatDate(record.dt_lancamento),
      formatCurrency(record.valor_excel),
      formatCurrency(record.vl_servico),
      formatCurrency(record.vl_glosa),
      formatCurrency(record.vl_liquido),
      record.divergencias.join('; ') || '-',
      pdfName,
    ]);

    // Destaca linhas com divergências
    if (record.divergencias.length > 0) {
      row.eachCell(cell => {
        cell.fill = ALERT_FILL;
      });
    }
  }

  detailSheet.columns.forEach(col => {
    col.width = 20;
  });

  // === ABA 3: ALERTAS ===
  const alertSheet = workbook.addWorksheet('Alertas');
  
  const alertHeaders = [
    'ID Cobrança', 'Fonte', 'Paciente (Excel)', 'Paciente (CSV)', 'CPF',
    'ANS (Excel)', 'ANS (CSV)', 'Valor (Excel)', 'Vl. Líquido', 
    'Tipo de Divergência', 'Descrição'
  ];
  
  alertSheet.addRow(alertHeaders);
  const alertHeaderRow = alertSheet.getRow(1);
  alertHeaderRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });

  for (const record of divergences) {
    for (const divergence of record.divergencias) {
      let tipo = 'Outro';
      if (divergence.includes('Valor')) tipo = 'Valor';
      else if (divergence.includes('Nome')) tipo = 'Nome';
      else if (divergence.includes('Código ANS')) tipo = 'Código ANS';
      else if (divergence.includes('apenas no')) tipo = 'Fonte Única';

      alertSheet.addRow([
        record.id_cobranca,
        record.fonte,
        record.paciente_excel || '-',
        record.paciente_csv || '-',
        record.cpf || '-',
        record.registro_ans_excel || '-',
        record.registro_ans_csv || '-',
        formatCurrency(record.valor_excel),
        formatCurrency(record.vl_liquido),
        tipo,
        divergence,
      ]);
    }
  }

  alertSheet.columns.forEach(col => {
    col.width = 25;
  });

  // Tenta escrever o arquivo com retry em caso de EBUSY (arquivo aberto no Excel)
  const maxRetries = 3;
  const delayMs = 1000;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Relatório gerado com sucesso: ${filePath}`);
      return filePath;
    } catch (error) {
      lastError = error;
      if (error.code === 'EBUSY' || error.code === 'EPERM') {
        logger.warn(`Arquivo bloqueado (tentativa ${attempt}/${maxRetries}): ${filePath}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } else {
        throw error;
      }
    }
  }

  // Se todas as tentativas falharam, gera com nome alternativo (timestamp)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const altFileName = `relatorio_faturamento_${monthYear}_${timestamp}.xlsx`;
  const altFilePath = path.join(outputDir, altFileName);

  try {
    await workbook.xlsx.writeFile(altFilePath);
    logger.info(`Relatório gerado com nome alternativo: ${altFilePath}`);
    return altFilePath;
  } catch (altError) {
    logger.error(`Falha ao gerar relatório: ${lastError.message}`);
    throw lastError;
  }
}

module.exports = { generateReport };
