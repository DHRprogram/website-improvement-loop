#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const IN = resolve(process.argv[2] || 'artifacts/USER_TEST/AGGREGATE.json');
const OUT = resolve(process.argv[3] || 'artifacts/REPORT.html');

if (!existsSync(IN)) { console.error('Missing ' + IN); process.exit(1); }
const agg = JSON.parse(readFileSync(IN, 'utf8'));

const issues = (agg.top_issues || []).slice(0, 30);
const heatmap = (agg.page_heatmap || []).slice(0, 20);
const attacks = (agg.attack_summary || {});
const a11y = agg.a11y || {};

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>User Test Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:1000px;margin:0 auto;padding:20px;background:#f5f5f5;color:#222}
.card{background:#fff;border-radius:8px;padding:20px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.1)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}
th{background:#f0f0f0;font-weight:600}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}
.P0{background:#e74c3c;color:#fff} .P1{background:#e67e22;color:#fff} .P2{background:#f1c40f} .P3{background:#ecf0f1}
h2{color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:4px}
</style></head><body>
<h1>User Test Report</h1>
<p>Generated: ${agg.generated_at || ''} | Personas: ${agg.personas_count || 0} | Steps: ${agg.total_steps || 0}</p>
<div class="card"><h2>Friction Overview</h2>
<canvas id="frictionChart" height="200"></canvas>
<table><tr><th>Persona</th><th>Tasks</th><th>Friction Avg</th><th>Blockers</th></tr>
${(agg.personas || []).map(p => '<tr><td>'+p.persona+'</td><td>'+p.tasks_completed+'/'+p.tasks_total+'</td><td>'+p.friction_avg+'</td><td>'+p.blockers.length+'</td></tr>').join('')}
</table></div>
<div class="card"><h2>Top Issues</h2>
<canvas id="severityChart" height="150"></canvas>
<table><tr><th>Issue</th><th>Sev</th><th>Freq</th></tr>
${issues.map(i => '<tr><td>'+i.issue.slice(0,80)+'</td><td><span class="badge '+i.worst_severity+'">'+i.worst_severity+'</span></td><td>'+i.frequency+'</td></tr>').join('')}
</table></div>
<div class="card"><h2>Page Heatmap</h2>
<canvas id="heatmapChart" height="150"></canvas></div>
<div class="card"><h2>Adversarial</h2><p>Total: ${attacks.total || 0} | Reproduced: ${attacks.reproduced || 0}</p>
<table><tr><th>Sev</th><th>Count</th></tr>
${Object.entries(attacks.by_severity || {}).map(([s,c]) => '<tr><td>'+s+'</td><td>'+c+'</td></tr>').join('')}
</table></div>
${a11y.total !== undefined ? '<div class="card"><h2>Accessibility</h2><p>Total violations: '+a11y.total+'</p><table><tr><th>Sev</th><th>Count</th></tr>' + Object.entries(a11y.by_severity || {}).map(([s,c]) => '<tr><td>'+s+'</td><td>'+c+'</td></tr>').join('') + '</table></div>' : ''}
<script>
new Chart(document.getElementById('frictionChart'),{type:'bar',data:{labels:[${(agg.personas||[]).map(p=>'"'+p.persona+'"').join(',')}],datasets:[{label:'Friction Avg',data:[${(agg.personas||[]).map(p=>p.friction_avg).join(',')}],backgroundColor:'#3498db'}]},options:{scales:{y:{beginAtZero:true}}}});
new Chart(document.getElementById('severityChart'),{type:'doughnut',data:{labels:['P0','P1','P2','P3'],datasets:[{data:[${['P0','P1','P2','P3'].map(s=>issues.filter(i=>i.worst_severity===s).length).join(',')}],backgroundColor:['#e74c3c','#e67e22','#f1c40f','#95a5a6']}]}});
new Chart(document.getElementById('heatmapChart'),{type:'bar',data:{labels:[${heatmap.map(h=>'"'+h.url.slice(0,20)+'"').join(',')}],datasets:[{label:'Friction Sum',data:[${heatmap.map(h=>h.friction_sum).join(',')}],backgroundColor:'#2ecc71'}]},options:{scales:{y:{beginAtZero:true}}}});
</script></body></html>`;
writeFileSync(OUT, html);
console.log('[HTML] Report: ' + OUT);
