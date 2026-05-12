const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const BACKUP_DIR = path.join(__dirname, 'data-backup');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer config (dinâmico por diretório)
function getUploadStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });
}
const defaultUpload = multer({ storage: getUploadStorage(DATA_DIR) });

// ===================== HELPERS =====================

async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { cron: { enabled: false }, env: {} };
  }
}

async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function writeEnvFile(env) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  const content = lines.join('\n') + '\n';
  await fs.writeFile(ENV_FILE, content);
}

async function readEnvFile() {
  try {
    const content = await fs.readFile(ENV_FILE, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        env[line.substring(0, eq)] = line.substring(eq + 1);
      }
    });
    return env;
  } catch {
    return {};
  }
}

async function backupDefaultFiles() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(DATA_DIR);
    for (const file of files) {
      const src = path.join(DATA_DIR, file);
      const dest = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(src);
      if (stat.isFile()) {
        await fs.copyFile(src, dest);
      } else if (stat.isDirectory()) {
        // simple directory copy
        await fs.mkdir(dest, { recursive: true });
        const subFiles = await fs.readdir(src);
        for (const sub of subFiles) {
          await fs.copyFile(path.join(src, sub), path.join(dest, sub));
        }
      }
    }
  } catch (e) {
    console.log('Backup error:', e.message);
  }
}

async function restoreDefaultFiles() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    // clear data dir first
    const current = await fs.readdir(DATA_DIR);
    for (const f of current) {
      const p = path.join(DATA_DIR, f);
      const stat = await fs.stat(p);
      if (stat.isFile()) await fs.unlink(p);
      else if (stat.isDirectory()) {
        const subs = await fs.readdir(p);
        for (const s of subs) await fs.unlink(path.join(p, s));
        await fs.rmdir(p);
      }
    }
    // restore backup
    for (const file of files) {
      const src = path.join(BACKUP_DIR, file);
      const dest = path.join(DATA_DIR, file);
      const stat = await fs.stat(src);
      if (stat.isFile()) {
        await fs.copyFile(src, dest);
      } else if (stat.isDirectory()) {
        await fs.mkdir(dest, { recursive: true });
        const subFiles = await fs.readdir(src);
        for (const sub of subFiles) {
          await fs.copyFile(path.join(src, sub), path.join(dest, sub));
        }
      }
    }
    return true;
  } catch (e) {
    console.log('Restore error:', e.message);
    return false;
  }
}

// Ensure backup exists on startup
backupDefaultFiles();

// ===================== CRON =====================

let cronJob = null;

function scheduleCron(config) {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  if (!config.cron || !config.cron.enabled) return;

  const { hour, minute, dayOfWeek } = config.cron;
  const cronExpr = `${minute} ${hour} * * ${dayOfWeek}`;

  if (!cron.validate(cronExpr)) {
    console.log('Invalid cron expression:', cronExpr);
    return;
  }

  cronJob = cron.schedule(cronExpr, async () => {
    console.log('Running scheduled pipeline...');
    await runPipelineJob();
  });

  console.log(`Cron scheduled: ${cronExpr}`);
}

async function runPipelineJob() {
  const config = await loadConfig();
  config.lastRun = new Date().toISOString();
  config.lastRunStatus = 'running';
  await saveConfig(config);

  const previousCwd = process.cwd();
  
  try {
    // Muda para a raiz do projeto para que os paths relativos funcionem
    process.chdir(ROOT_DIR);
    
    // Recarrega o .env e limpa cache dos módulos para usar config atualizada
    require('dotenv').config({ path: ENV_FILE, override: true });
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/pipeline')];
    
    const { runPipeline } = require('../src/pipeline');
    const results = await runPipeline();
    
    config.lastRunStatus = results.success ? 'success' : 'error';
    if (results.error) config.lastRunError = results.error;
    else delete config.lastRunError;
    // Status real do envio de e-mail
    if (results.emailResult) {
      config.lastEmailSent = results.emailResult.sent;
      if (results.emailResult.reason) config.lastEmailError = results.emailResult.reason;
      else delete config.lastEmailError;
    } else {
      delete config.lastEmailSent;
      delete config.lastEmailError;
    }
    await saveConfig(config);
    return results;
  } catch (e) {
    config.lastRunStatus = 'error';
    config.lastRunError = e.message;
    delete config.lastEmailSent;
    delete config.lastEmailError;
    await saveConfig(config);
    return { success: false, error: e.message };
  } finally {
    // Restaura o diretório original
    process.chdir(previousCwd);
  }
}

// Initialize cron
loadConfig().then(cfg => scheduleCron(cfg));

// ===================== API ROUTES =====================

// Status
app.get('/api/status', async (req, res) => {
  const config = await loadConfig();
  const outputFiles = [];
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    for (const f of files) {
      if (f.endsWith('.xlsx')) {
        const stat = await fs.stat(path.join(OUTPUT_DIR, f));
        outputFiles.push({ name: f, size: stat.size, date: stat.mtime });
      }
    }
  } catch {}
  
  res.json({
    cron: config.cron,
    lastRun: config.lastRun,
    lastRunStatus: config.lastRunStatus,
    lastRunError: config.lastRunError,
    lastEmailSent: config.lastEmailSent,
    lastEmailError: config.lastEmailError,
    reports: outputFiles.sort((a, b) => new Date(b.date) - new Date(a.date)),
  });
});

// Run pipeline
app.post('/api/run', async (req, res) => {
  res.json({ message: 'Pipeline iniciado', status: 'running' });
  // run async after response
  setTimeout(() => runPipelineJob(), 100);
});

// Config
app.get('/api/config', async (req, res) => {
  const config = await loadConfig();
  res.json(config);
});

app.post('/api/config', async (req, res) => {
  const { cron: cronCfg, env } = req.body;
  const config = await loadConfig();
  
  if (cronCfg) {
    config.cron = cronCfg;
  }
  if (env) {
    config.env = env;
    await writeEnvFile(env);
  }
  
  await saveConfig(config);
  scheduleCron(config);
  res.json({ message: 'Configuração salva', config });
});

// Files
app.get('/api/files', async (req, res) => {
  const files = [];
  const subDir = req.query.dir || '';
  const targetDir = subDir ? path.join(DATA_DIR, subDir) : DATA_DIR;
  
  // Segurança: impedir path traversal
  if (!targetDir.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const stat = await fs.stat(path.join(targetDir, entry.name));
        files.push({
          name: entry.name,
          size: stat.size,
          modified: stat.mtime,
          type: 'file',
        });
      } else if (entry.isDirectory()) {
        const subFiles = await fs.readdir(path.join(targetDir, entry.name));
        files.push({
          name: entry.name,
          type: 'directory',
          count: subFiles.length,
        });
      }
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  res.json(files);
});

app.post('/api/files/upload', (req, res) => {
  const subDir = req.query.dir || '';
  const destDir = subDir ? path.join(DATA_DIR, subDir) : DATA_DIR;
  
  // Segurança
  if (!destDir.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const uploadHandler = multer({ storage: getUploadStorage(destDir) }).single('file');
  uploadHandler(req, res, (err) => {
    if (err || !req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ message: 'Arquivo enviado', file: req.file.originalname });
  });
});

app.delete('/api/files/:name', async (req, res) => {
  const subDir = req.query.dir || '';
  const filePath = path.join(DATA_DIR, subDir, req.params.name);
  
  // Segurança
  if (!filePath.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  try {
    await fs.unlink(filePath);
    res.json({ message: 'Arquivo removido' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files/restore', async (req, res) => {
  const ok = await restoreDefaultFiles();
  if (ok) res.json({ message: 'Arquivos padrão restaurados' });
  else res.status(500).json({ error: 'Falha ao restaurar' });
});

// Logs
app.get('/api/logs', async (req, res) => {
  try {
    const files = await fs.readdir(LOGS_DIR);
    const logFiles = [];
    for (const f of files) {
      if (f.endsWith('.log')) {
        const stat = await fs.stat(path.join(LOGS_DIR, f));
        logFiles.push({ name: f, size: stat.size, date: stat.mtime });
      }
    }
    res.json(logFiles.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch {
    res.json([]);
  }
});

app.get('/api/logs/:name', async (req, res) => {
  try {
    const content = await fs.readFile(path.join(LOGS_DIR, req.params.name), 'utf8');
    res.type('text/plain').send(content);
  } catch {
    res.status(404).json({ error: 'Log não encontrado' });
  }
});

// Output / Reports
app.get('/api/output', async (req, res) => {
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    const reports = [];
    for (const f of files) {
      if (f.endsWith('.xlsx')) {
        const stat = await fs.stat(path.join(OUTPUT_DIR, f));
        reports.push({ name: f, size: stat.size, date: stat.mtime });
      }
    }
    res.json(reports.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch {
    res.json([]);
  }
});

app.get('/api/output/download/:name', async (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.name);
  res.download(filePath);
});

// Serve index for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Interface web rodando em http://localhost:${PORT}`);
});
