const fuzzball = require('fuzzball');
const logger = require('../utils/logger');
const { normalizeString } = require('../utils/normalizer');

const SIMILARITY_THRESHOLD = 80;

function findMatch(excelRecord, csvRecords) {
  // Tenta matching direto por ID
  const directMatch = csvRecords.find(csv => 
    normalizeString(csv.num_guia) === normalizeString(excelRecord.id_cobranca)
  );
  if (directMatch) return { record: directMatch, method: 'id' };

  // Se não encontrar, tenta fuzzy matching por nome + data + valor aproximado
  let bestMatch = null;
  let bestScore = 0;

  for (const csv of csvRecords) {
    const nameScore = fuzzball.token_set_ratio(excelRecord.paciente, csv.nome_beneficiario);
    
    // Verifica se datas batem (considerando formatos diferentes)
    const excelDate = excelRecord.data_atendimento;
    const csvDate = csv.dt_realizacao;
    const dateMatch = excelDate === csvDate;

    // Verifica se valores são próximos (com tolerância para arredondamento)
    const valorDiff = Math.abs(excelRecord.valor - csv.vl_liquido);
    const valorMatch = valorDiff <= 0.5; // tolerância de R$ 0,50

    // Score combinado: nome é mais importante, data e valor ajudam
    let score = nameScore;
    if (dateMatch) score += 10;
    if (valorMatch) score += 10;

    if (score > bestScore && nameScore >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestMatch = csv;
    }
  }

  if (bestMatch) {
    return { record: bestMatch, method: 'fuzzy', score: bestScore };
  }

  return null;
}

function consolidateData(excelRecords, csvRecords) {
  logger.info('Iniciando consolidação de dados...');

  const consolidated = [];
  const divergences = [];
  const csvMatched = new Set();
  const excelMatched = new Set();

  // 1. Match registros do Excel com CSV
  for (const excelRecord of excelRecords) {
    const match = findMatch(excelRecord, csvRecords);
    
    if (match) {
      csvMatched.add(match.record.num_guia);
      excelMatched.add(excelRecord.id_cobranca);

      const record = {
        id_cobranca: excelRecord.id_cobranca,
        paciente_excel: excelRecord.paciente,
        paciente_csv: match.record.nome_beneficiario,
        cpf: match.record.cpf_beneficiario,
        registro_ans_excel: excelRecord.registro_ans,
        registro_ans_csv: match.record.ans,
        nome_operadora: match.record.nome_operadora,
        procedimento_excel: excelRecord.procedimento,
        procedimento_csv: match.record.descricao_servico,
        cod_tuss: match.record.cod_tuss,
        data_atendimento: excelRecord.data_atendimento,
        dt_realizacao: match.record.dt_realizacao,
        dt_lancamento: match.record.dt_lancamento,
        valor_excel: excelRecord.valor,
        vl_servico: match.record.vl_servico,
        vl_glosa: match.record.vl_glosa,
        vl_liquido: match.record.vl_liquido,
        fonte: 'ambas',
        match_method: match.method,
        divergencias: [],
      };

      // Detecta divergências
      // 1. Divergência de valor
      const valorDiff = Math.abs(excelRecord.valor - match.record.vl_liquido);
      if (valorDiff > 0.01) {
        record.divergencias.push(`Valor diferente: Excel=R$${excelRecord.valor.toFixed(2)}, CSV=R$${match.record.vl_liquido.toFixed(2)}`);
      }

      // 2. Divergência de nome
      const nameScore = fuzzball.token_set_ratio(excelRecord.paciente, match.record.nome_beneficiario);
      if (nameScore < 100) {
        record.divergencias.push(`Nome diferente: Excel="${excelRecord.paciente}", CSV="${match.record.nome_beneficiario}" (similaridade: ${nameScore}%)`);
      }

      // 3. Divergência de código ANS
      if (normalizeString(excelRecord.registro_ans) !== normalizeString(match.record.ans)) {
        record.divergencias.push(`Código ANS diferente: Excel=${excelRecord.registro_ans}, CSV=${match.record.ans}`);
      }

      if (record.divergencias.length > 0) {
        divergences.push(record);
      }

      consolidated.push(record);
    } else {
      // Registro só no Excel
      logger.warn(`Cobrança ${excelRecord.id_cobranca} não encontrada no CSV`);
      consolidated.push({
        id_cobranca: excelRecord.id_cobranca,
        paciente_excel: excelRecord.paciente,
        paciente_csv: null,
        cpf: null,
        registro_ans_excel: excelRecord.registro_ans,
        registro_ans_csv: null,
        nome_operadora: null,
        procedimento_excel: excelRecord.procedimento,
        procedimento_csv: null,
        cod_tuss: null,
        data_atendimento: excelRecord.data_atendimento,
        dt_realizacao: null,
        dt_lancamento: null,
        valor_excel: excelRecord.valor,
        vl_servico: null,
        vl_glosa: null,
        vl_liquido: null,
        fonte: 'excel',
        match_method: null,
        divergencias: ['Cobrança presente apenas no Excel'],
      });
      divergences.push(consolidated[consolidated.length - 1]);
    }
  }

  // 2. Registros só no CSV
  for (const csvRecord of csvRecords) {
    if (!csvMatched.has(csvRecord.num_guia)) {
      logger.warn(`Cobrança ${csvRecord.num_guia} não encontrada no Excel`);
      consolidated.push({
        id_cobranca: csvRecord.num_guia,
        paciente_excel: null,
        paciente_csv: csvRecord.nome_beneficiario,
        cpf: csvRecord.cpf_beneficiario,
        registro_ans_excel: null,
        registro_ans_csv: csvRecord.ans,
        nome_operadora: csvRecord.nome_operadora,
        procedimento_excel: null,
        procedimento_csv: csvRecord.descricao_servico,
        cod_tuss: csvRecord.cod_tuss,
        data_atendimento: csvRecord.dt_realizacao,
        dt_realizacao: csvRecord.dt_realizacao,
        dt_lancamento: csvRecord.dt_lancamento,
        valor_excel: null,
        vl_servico: csvRecord.vl_servico,
        vl_glosa: csvRecord.vl_glosa,
        vl_liquido: csvRecord.vl_liquido,
        fonte: 'csv',
        match_method: null,
        divergencias: ['Cobrança presente apenas no CSV'],
      });
      divergences.push(consolidated[consolidated.length - 1]);
    }
  }

  logger.info(`Consolidação concluída: ${consolidated.length} registros, ${divergences.length} com divergências`);

  return {
    consolidated,
    divergences,
    stats: {
      total: consolidated.length,
      onlyExcel: consolidated.filter(r => r.fonte === 'excel').length,
      onlyCsv: consolidated.filter(r => r.fonte === 'csv').length,
      both: consolidated.filter(r => r.fonte === 'ambas').length,
      divergences: divergences.length,
    }
  };
}

module.exports = { consolidateData };
