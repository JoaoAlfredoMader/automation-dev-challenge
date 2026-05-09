const fs = require('fs').promises;
const path = require('path');
const fuzzball = require('fuzzball');
const logger = require('../utils/logger');
const { normalizeString } = require('../utils/normalizer');

const SIMILARITY_THRESHOLD = 70;

async function renamePdfs(dataDir, outputDir, consolidatedRecords) {
  const laudosDir = path.join(dataDir, 'laudos');
  logger.info(`Processando PDFs em: ${laudosDir}`);

  const files = await fs.readdir(laudosDir);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

  logger.info(`${pdfFiles.length} PDFs encontrados`);

  const results = {
    renamed: 0,
    skipped: 0,
    notFound: 0,
    mappings: [],
  };

  // Agrupa registros por paciente (para encontrar múltiplos laudos do mesmo paciente)
  const recordsByPatient = {};
  for (const record of consolidatedRecords) {
    const patientName = record.paciente_csv || record.paciente_excel;
    if (!patientName) continue;
    
    if (!recordsByPatient[patientName]) {
      recordsByPatient[patientName] = [];
    }
    recordsByPatient[patientName].push(record);
  }

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(laudosDir, pdfFile);
    const pdfName = path.parse(pdfFile).name;
    const normalizedPdfName = normalizeString(pdfName);

    // Tenta encontrar o melhor match por similaridade de nome
    let bestMatch = null;
    let bestScore = 0;

    for (const [patientName, records] of Object.entries(recordsByPatient)) {
      const score = fuzzball.partial_ratio(normalizedPdfName, patientName);
      if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
        bestScore = score;
        bestMatch = { patientName, records, score };
      }
    }

    if (!bestMatch) {
      logger.warn(`Não foi possível identificar paciente para: ${pdfFile}`);
      results.notFound++;
      continue;
    }

    // Se há múltiplos registros para o mesmo paciente, usa a data do nome do PDF
    // ou pega o primeiro registro
    let targetRecord = bestMatch.records[0];
    
    // Tenta extrair data do nome do PDF (padrões como _DD_MM ou MMYYYY)
    const datePatterns = [
      /(\d{2})[._](\d{2})/,  // DD_MM ou MM_YY
      /(\d{2})(\d{4})/,       // MMYYYY
    ];

    for (const pattern of datePatterns) {
      const match = normalizedPdfName.match(pattern);
      if (match) {
        // Tenta encontrar registro com data correspondente
        const day = match[1];
        const month = match[2].length === 2 ? match[2] : match[2].substring(0, 2);
        
        const matchingRecord = bestMatch.records.find(r => {
          const recordDate = r.dt_realizacao || r.data_atendimento;
          if (!recordDate) return false;
          const [recYear, recMonth, recDay] = recordDate.split('-');
          return recDay === day && recMonth === month;
        });

        if (matchingRecord) {
          targetRecord = matchingRecord;
          break;
        }
      }
    }

    // Extrai mês e ano da data do registro para o nome do arquivo
    const recordDate = targetRecord.dt_realizacao || targetRecord.data_atendimento;
    let mmYYYY = '';
    if (recordDate) {
      const [year, month] = recordDate.split('-');
      mmYYYY = `${month}${year}`;
    } else {
      mmYYYY = '000000';
    }

    const cpf = targetRecord.cpf || '00000000000';
    const patientNameFormatted = (targetRecord.paciente_csv || targetRecord.paciente_excel || 'DESCONHECIDO')
      .replace(/[^A-Z]/g, '');
    const idCobranca = targetRecord.id_cobranca || 'UNKNOWN';

    const newFileName = `${cpf}-${patientNameFormatted}-${idCobranca}-${mmYYYY}.pdf`;
    const newFilePath = path.join(outputDir, newFileName);

    // Verifica se arquivo de destino já existe
    try {
      await fs.access(newFilePath);
      logger.warn(`Arquivo de destino já existe, pulando: ${newFileName}`);
      results.skipped++;
      results.mappings.push({
        original: pdfFile,
        newName: newFileName,
        status: 'skipped_exists',
        record: targetRecord.id_cobranca,
        similarity: bestScore,
      });
    } catch {
      // Arquivo não existe, pode copiar
      try {
        await fs.copyFile(pdfPath, newFilePath);
        logger.info(`Renomeado: ${pdfFile} -> ${newFileName}`);
        results.renamed++;
        results.mappings.push({
          original: pdfFile,
          newName: newFileName,
          status: 'renamed',
          record: targetRecord.id_cobranca,
          similarity: bestScore,
        });
      } catch (error) {
        logger.error(`Erro ao renomear ${pdfFile}: ${error.message}`);
        results.notFound++;
      }
    }
  }

  logger.info(`Processamento de PDFs concluído: ${results.renamed} renomeados, ${results.skipped} pulados, ${results.notFound} não identificados`);
  return results;
}

module.exports = { renamePdfs };
