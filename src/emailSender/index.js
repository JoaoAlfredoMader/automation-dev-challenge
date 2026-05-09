const nodemailer = require('nodemailer');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');

async function sendEmail(reportPath, stats, monthYear) {
  if (!config.smtp.host || !config.smtp.user) {
    logger.warn('Configurações de e-mail não encontradas. Pulando envio de e-mail.');
    return { sent: false, reason: 'Configurações de e-mail não definidas' };
  }

  logger.info('Enviando relatório por e-mail...');

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  const totalLiquido = stats.totalLiquido || 0;
  const totalGlosa = stats.totalGlosa || 0;

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Relatório de Faturamento - ${monthYear}</h2>
        <p>Olá,</p>
        <p>O processamento mensal de faturamento foi concluído com sucesso. Segue em anexo o relatório detalhado.</p>
        
        <h3>Resumo do Processamento</h3>
        <ul>
          <li><strong>Total de Cobranças:</strong> ${stats.total}</li>
          <li><strong>Cobranças em Ambas as Fontes:</strong> ${stats.both}</li>
          <li><strong>Cobranças Apenas no Excel:</strong> ${stats.onlyExcel}</li>
          <li><strong>Cobranças Apenas no CSV:</strong> ${stats.onlyCsv}</li>
          <li><strong>Cobranças com Divergências:</strong> ${stats.divergences}</li>
        </ul>
        
        <h3>Totais Financeiros</h3>
        <ul>
          <li><strong>Valor Líquido Total:</strong> R$ ${totalLiquido.toFixed(2).replace('.', ',')}</li>
          <li><strong>Total de Glosas:</strong> R$ ${totalGlosa.toFixed(2).replace('.', ',')}</li>
        </ul>
        
        <p>Para mais detalhes, consulte as abas do relatório em anexo:</p>
        <ul>
          <li><strong>Resumo:</strong> Visão geral dos totais</li>
          <li><strong>Detalhamento:</strong> Todas as cobranças consolidadas</li>
          <li><strong>Alertas:</strong> Cobranças com inconsistências</li>
        </ul>
        
        <p>Atenciosamente,<br>Sistema de Automação de Faturamento</p>
      </body>
    </html>
  `;

  const mailOptions = {
    from: config.smtp.from,
    to: config.smtp.to,
    subject: `Relatório de Faturamento - ${monthYear}`,
    html: htmlBody,
    attachments: [
      {
        filename: path.basename(reportPath),
        path: reportPath,
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('E-mail enviado com sucesso');
    return { sent: true };
  } catch (error) {
    logger.error(`Erro ao enviar e-mail: ${error.message}`);
    throw error;
  }
}

module.exports = { sendEmail };
