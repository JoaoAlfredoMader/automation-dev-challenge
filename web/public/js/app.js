// ===================== UTILS =====================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatBytes(bytes) {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR');
}

function translateStatus(status) {
  const map = {
    success: 'Sucesso',
    error: 'Erro',
    running: 'Executando',
  };
  return map[status] || status || '-';
}

// ===================== NAVIGATION =====================

const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');

const pageNames = {
  dashboard: 'Dashboard',
  files: 'Gerenciador de Arquivos',
  config: 'Configurações',
  reports: 'Relatórios',
  logs: 'Logs de Execução',
};

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    
    pageTitle.textContent = pageNames[page];
    
    // Load page data
    if (page === 'dashboard') loadDashboard();
    if (page === 'files') loadFiles();
    if (page === 'config') loadConfig();
    if (page === 'reports') loadReports();
    if (page === 'logs') loadLogs();
  });
});

// ===================== API CALLS =====================

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ===================== DASHBOARD =====================

async function loadDashboard() {
  try {
    const status = await api('/status');
    
    document.getElementById('dash-last-run').textContent = status.lastRun 
      ? formatDate(status.lastRun) 
      : 'Nunca executado';
    
    const statusEl = document.getElementById('dash-last-status');
    statusEl.textContent = translateStatus(status.lastRunStatus);
    statusEl.className = status.lastRunStatus === 'success' ? 'text-success' : 
                         status.lastRunStatus === 'error' ? 'text-error' : '';
    
    const errorRow = document.getElementById('dash-error-row');
    if (status.lastRunError) {
      errorRow.style.display = 'flex';
      document.getElementById('dash-last-error').textContent = status.lastRunError;
    } else {
      errorRow.style.display = 'none';
    }
    
    // Status real do e-mail (não assume enviado só porque o pipeline deu sucesso)
    const emailStatusEl = document.getElementById('dash-email-status');
    if (status.lastEmailSent === true) {
      emailStatusEl.textContent = 'Enviado';
      emailStatusEl.className = 'text-success';
    } else if (status.lastEmailSent === false) {
      emailStatusEl.textContent = status.lastEmailError || 'Não enviado (SMTP não configurado)';
      emailStatusEl.className = 'text-error';
    } else {
      emailStatusEl.textContent = '-';
      emailStatusEl.className = '';
    }
    
    // Cron badge
    const cronBadge = document.getElementById('cron-status');
    if (status.cron && status.cron.enabled) {
      const dayMap = { '1': 'seg', '2': 'ter', '3': 'qua', '4': 'qui', '5': 'sex', '6': 'sab', '0': 'dom', '*': 'todo dia' };
      const day = dayMap[status.cron.dayOfWeek] || status.cron.dayOfWeek;
      const h = String(status.cron.hour).padStart(2, '0');
      const m = String(status.cron.minute).padStart(2, '0');
      cronBadge.textContent = `Agendamento: ${h}:${m} (${day})`;
    } else {
      cronBadge.textContent = 'Agendamento desativado';
    }
    
    // If we have reports, get stats from the latest
    if (status.reports && status.reports.length > 0) {
      // We don't have stats in status API, so just show report count
      document.getElementById('dash-total').textContent = status.reports.length + ' relatórios';
    }
  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

// ===================== FILES =====================

async function loadFiles() {
  const tbody = document.getElementById('files-table-body');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';
  
  try {
    const files = await api('/files');
    
    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum arquivo encontrado</td></tr>';
      return;
    }
    
    tbody.innerHTML = files.map(f => `
      <tr>
        <td><strong>${f.name}</strong></td>
        <td>${f.type === 'directory' ? 'Pasta' : 'Arquivo'}</td>
        <td>${f.type === 'directory' ? f.count + ' itens' : formatBytes(f.size)}</td>
        <td>
          ${f.type !== 'directory' ? `
            <button class="btn btn-danger btn-sm" onclick="deleteFile('${f.name}')">
              Remover
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Erro: ${e.message}</td></tr>`;
  }
}

async function deleteFile(name) {
  if (!confirm(`Remover o arquivo "${name}"?`)) return;
  try {
    await api(`/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
    showToast(`Arquivo "${name}" removido`, 'success');
    loadFiles();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// File upload
document.getElementById('file-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Arquivo "${file.name}" importado com sucesso`, 'success');
    loadFiles();
  } catch (e) {
    showToast(e.message, 'error');
  }
  
  e.target.value = '';
});

// Restore default
document.getElementById('btn-restore-files').addEventListener('click', async () => {
  if (!confirm('Restaurar todos os arquivos para o padrão original?\nIsso removerá os arquivos importados.')) return;
  try {
    await api('/files/restore', { method: 'POST' });
    showToast('Arquivos padrão restaurados', 'success');
    loadFiles();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ===================== CONFIG =====================

async function loadConfig() {
  try {
    const cfg = await api('/config');
    
    // Cron
    document.getElementById('cron-enabled').checked = cfg.cron?.enabled ?? true;
    document.getElementById('cron-hour').value = cfg.cron?.hour ?? 6;
    document.getElementById('cron-minute').value = cfg.cron?.minute ?? 30;
    document.getElementById('cron-day').value = String(cfg.cron?.dayOfWeek ?? 1);
    
    // Env
    const env = cfg.env || {};
    document.getElementById('env-smtp-host').value = env.SMTP_HOST || '';
    document.getElementById('env-smtp-port').value = env.SMTP_PORT || '';
    document.getElementById('env-smtp-user').value = env.SMTP_USER || '';
    document.getElementById('env-smtp-pass').value = env.SMTP_PASS || '';
    document.getElementById('env-email-from').value = env.EMAIL_FROM || '';
    document.getElementById('env-email-to').value = env.EMAIL_TO || '';
  } catch (e) {
    showToast('Erro ao carregar configurações', 'error');
  }
}

document.getElementById('btn-save-config').addEventListener('click', async () => {
  const cronCfg = {
    enabled: document.getElementById('cron-enabled').checked,
    hour: parseInt(document.getElementById('cron-hour').value),
    minute: parseInt(document.getElementById('cron-minute').value),
    dayOfWeek: document.getElementById('cron-day').value,
  };
  
  const env = {
    SMTP_HOST: document.getElementById('env-smtp-host').value,
    SMTP_PORT: document.getElementById('env-smtp-port').value,
    SMTP_USER: document.getElementById('env-smtp-user').value,
    SMTP_PASS: document.getElementById('env-smtp-pass').value,
    EMAIL_FROM: document.getElementById('env-email-from').value,
    EMAIL_TO: document.getElementById('env-email-to').value,
    DATA_DIR: './data',
    OUTPUT_DIR: './output',
    LOGS_DIR: './logs',
  };
  
  try {
    await api('/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cron: cronCfg, env }),
    });
    showToast('Configurações salvas com sucesso!', 'success');
    loadDashboard(); // refresh cron badge
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ===================== REPORTS =====================

async function loadReports() {
  const tbody = document.getElementById('reports-table-body');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';
  
  try {
    const reports = await api('/output');
    
    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum relatório gerado ainda</td></tr>';
      return;
    }
    
    tbody.innerHTML = reports.map(r => `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${formatBytes(r.size)}</td>
        <td>${formatDate(r.date)}</td>
        <td>
          <a href="/api/output/download/${encodeURIComponent(r.name)}" class="btn btn-primary btn-sm">
            Download
          </a>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Erro: ${e.message}</td></tr>`;
  }
}

// ===================== LOGS =====================

async function loadLogs() {
  const container = document.getElementById('logs-list');
  container.innerHTML = '<p class="text-center">Carregando...</p>';
  
  try {
    const logs = await api('/logs');
    
    if (logs.length === 0) {
      container.innerHTML = '<p class="text-center">Nenhum log encontrado</p>';
      return;
    }
    
    container.innerHTML = logs.map(l => `
      <div class="log-item" onclick="viewLog('${l.name}')">
        <span>${l.name}</span>
        <span>${formatBytes(l.size)} · ${formatDate(l.date)}</span>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p class="text-center text-error">Erro: ${e.message}</p>`;
  }
}

async function viewLog(name) {
  try {
    const res = await fetch(`/api/logs/${encodeURIComponent(name)}`);
    const content = await res.text();
    document.getElementById('log-viewer-title').textContent = name;
    document.getElementById('log-content').textContent = content;
    document.getElementById('log-viewer').style.display = 'block';
  } catch (e) {
    showToast('Erro ao carregar log', 'error');
  }
}

document.getElementById('btn-close-log').addEventListener('click', () => {
  document.getElementById('log-viewer').style.display = 'none';
});

// ===================== RUN PIPELINE =====================

document.getElementById('btn-run-now').addEventListener('click', async () => {
  if (!confirm('Executar o pipeline de faturamento agora?')) return;
  
  showToast('Pipeline iniciado! Acompanhe nos logs...', 'success');
  
  try {
    await api('/run', { method: 'POST' });
    // Poll for updates
    setTimeout(() => {
      loadDashboard();
      loadReports();
      loadLogs();
    }, 5000);
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ===================== INIT =====================

loadDashboard();
