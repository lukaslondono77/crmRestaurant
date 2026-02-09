#!/usr/bin/env node

/**
 * Production Monitoring — Cloudignite Backend
 * Lightweight checks: response times, health, upload dirs, optional alerts.
 *
 * Usage: node scripts/monitor-production.js [baseURL] [adminToken]
 * Example: node scripts/monitor-production.js https://api.yourdomain.com
 *          node scripts/monitor-production.js https://api.yourdomain.com "Bearer <jwt>"
 *
 * Env: API_URL, ADMIN_TOKEN, RESPONSE_TIME_THRESHOLD_MS (default 2000),
 *      DISK_FREE_PCT_THRESHOLD (default 10), ALERT_EMAIL_ENABLED, ALERT_SLACK_ENABLED, ALERT_SMS_ENABLED.
 *
 * Without token: only healthz (and detailed) are checked.
 * With token: also checks /api/dashboard/metrics response time.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = process.argv[2] || process.env.API_URL || 'http://localhost:8000';
const ADMIN_TOKEN = process.argv[3] || process.env.ADMIN_TOKEN || null;
const RESPONSE_TIME_THRESHOLD_MS = parseInt(process.env.RESPONSE_TIME_THRESHOLD_MS, 10) || 2000;
const DISK_FREE_PCT_THRESHOLD = parseInt(process.env.DISK_FREE_PCT_THRESHOLD, 10) || 10;
const baseUrl = new URL(BASE_URL);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

function request(method, pathname, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: baseUrl.hostname,
      port: baseUrl.port || (isHttps ? 443 : 80),
      path: pathname.startsWith('/') ? pathname : `/${pathname}`,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const req = client.request(opts, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        let json;
        try { json = data ? JSON.parse(data) : {}; } catch (_) { json = {}; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function checkResponseTime(endpoint, token) {
  const start = Date.now();
  try {
    await request('GET', endpoint, null, token);
    return Date.now() - start;
  } catch (e) {
    return null;
  }
}

async function checkDatabaseHealth() {
  try {
    const res = await request('GET', '/api/healthz?detailed=1');
    const d = res.data;
    const ok = res.status === 200 && (d?.database === 'connected' || d?.database === true);
    return {
      healthy: !!ok,
      database: d?.database,
      uptimeSeconds: d?.uptimeSeconds,
      memory: d?.memory
    };
  } catch (e) {
    return { healthy: false, error: e.message };
  }
}

function checkUploadDirs() {
  const root = path.join(__dirname, '..');
  const dirs = ['uploads', 'uploads/invoices', 'uploads/pos', 'uploads/waste'].map((p) =>
    path.join(root, p)
  );
  const existing = dirs.filter((d) => {
    try {
      return fs.existsSync(d) && fs.statSync(d).isDirectory();
    } catch (_) {
      return false;
    }
  });
  return { existing: existing.length, total: dirs.length, allExist: existing.length === dirs.length };
}

function checkDiskSpace(uploadsPath) {
  try {
    const resolved = path.resolve(path.join(__dirname, '..', 'uploads'));
    const out = execSync(`df -k "${resolved}"`, { encoding: 'utf8' });
    const lines = out.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].split(/\s+/);
    const size = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const avail = parseInt(parts[3], 10) * 1024;
    const freePct = size > 0 ? (avail / size) * 100 : 0;
    return { free: avail, size, freePercentage: Math.round(freePct * 10) / 10 };
  } catch (_) {
    return null;
  }
}

function generateAlert(metric, threshold, currentValue, higherIsWorse = true) {
  const over = higherIsWorse ? currentValue > threshold : currentValue < threshold;
  if (!over || currentValue == null) return null;
  return {
    severity: 'HIGH',
    message: `${metric} ${higherIsWorse ? 'exceeded' : 'below'} threshold: ${currentValue} ${higherIsWorse ? '>' : '<'} ${threshold}`,
    timestamp: new Date().toISOString()
  };
}

/** Alert notifier. Configure via env: ALERT_EMAIL_ENABLED, ALERT_SLACK_ENABLED, ALERT_SMS_ENABLED (1/true to enable). */
class AlertNotifier {
  constructor(config = {}) {
    const env = (k) => /^1|true|yes$/i.test(process.env[k] || '');
    this.config = {
      email: config.email || { enabled: env('ALERT_EMAIL_ENABLED') },
      slack: config.slack || { enabled: env('ALERT_SLACK_ENABLED') },
      sms: config.sms || { enabled: env('ALERT_SMS_ENABLED') }
    };
  }

  async sendAlert(alert) {
    if (this.config.email?.enabled) {
      console.log(`[EMAIL ALERT] ${alert.severity}: ${alert.message}`);
    }
    if (this.config.slack?.enabled) {
      console.log(`[SLACK ALERT] ${alert.severity}: ${alert.message}`);
    }
    if (this.config.sms?.enabled && alert.severity === 'HIGH') {
      console.log(`[SMS ALERT] ${alert.severity}: ${alert.message}`);
    }
    if (!this.config.email?.enabled && !this.config.slack?.enabled && !this.config.sms?.enabled) {
      console.log(`[ALERT] ${alert.severity}: ${alert.message}`);
    }
  }
}

async function runChecks() {
  const checks = {};
  const alerts = [];

  checks.health = await checkDatabaseHealth();
  if (!checks.health.healthy) {
    alerts.push({
      severity: 'HIGH',
      message: `Database health check failed: ${checks.health.error || 'not connected'}`,
      timestamp: new Date().toISOString()
    });
  }

  checks.uploadDirs = checkUploadDirs();
  if (!checks.uploadDirs.allExist) {
    alerts.push({
      severity: 'MEDIUM',
      message: `Upload directories: ${checks.uploadDirs.existing}/${checks.uploadDirs.total} exist`,
      timestamp: new Date().toISOString()
    });
  }

  const disk = checkDiskSpace();
  checks.diskSpace = disk;
  if (disk) {
    const a = generateAlert('Disk free %', DISK_FREE_PCT_THRESHOLD, disk.freePercentage, false);
    if (a) alerts.push(a);
  }

  let responseTime = null;
  if (ADMIN_TOKEN) {
    responseTime = await checkResponseTime('/api/dashboard/metrics', ADMIN_TOKEN);
    checks.responseTimeMs = responseTime;
    const a = generateAlert('Response time (ms)', RESPONSE_TIME_THRESHOLD_MS, responseTime, true);
    if (a) alerts.push(a);
  }

  return { checks, alerts };
}

async function main() {
  console.log('\n📊 Cloudignite — Production Monitor\n');
  console.log(`   API: ${BASE_URL}`);
  console.log(`   Token: ${ADMIN_TOKEN ? 'provided' : 'not provided (health-only checks)'}\n`);

  const { checks, alerts } = await runChecks();

  console.log('CHECKS:');
  console.log(`  Health:     ${checks.health.healthy ? '✅ OK' : '❌ FAIL'}${checks.health.error ? ` (${checks.health.error})` : ''}`);
  console.log(`  Upload dirs: ${checks.uploadDirs.existing}/${checks.uploadDirs.total} exist`);
  if (checks.diskSpace) {
    console.log(`  Disk free:  ${checks.diskSpace.freePercentage}%`);
  } else {
    console.log(`  Disk free:  N/A (df not available)`);
  }
  if (checks.responseTimeMs != null) {
    console.log(`  /api/dashboard/metrics: ${checks.responseTimeMs} ms`);
  }

  if (alerts.length) {
    console.log('\nALERTS:');
    const notifier = new AlertNotifier();
    for (const a of alerts) {
      console.log(`  ${a.severity}: ${a.message}`);
      await notifier.sendAlert(a);
    }
  } else {
    console.log('\n✅ No alerts.');
  }
  console.log('');
}

main().catch((e) => {
  console.error('Monitor error:', e.message);
  process.exit(1);
});
