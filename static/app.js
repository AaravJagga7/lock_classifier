// --- DOM Element Selectors ---
// Tab Navigation
const menuItems = document.querySelectorAll('.menu-item');
const viewSections = document.querySelectorAll('.view-section');
const navBreadcrumb = document.getElementById('navBreadcrumb');

// Dashboard View
const dashTotal = document.getElementById('dashTotal');
const dashWarning = document.getElementById('dashWarning');
const dashWarningTrend = document.getElementById('dashWarningTrend');
const dashError = document.getElementById('dashError');
const dashErrorTrend = document.getElementById('dashErrorTrend');
const dashSources = document.getElementById('dashSources');
const dashChartBars = document.getElementById('dashChartBars');
const dashSourceBars = document.getElementById('dashSourceBars');

// Log Ingestion View
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileInfoBox = document.getElementById('fileInfoBox');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFileBtn');
const classifyBtn = document.getElementById('classifyBtn');
const ingestRowCount = document.getElementById('ingestRowCount');
const ingestEmptyState = document.getElementById('ingestEmptyState');
const ingestLoaderView = document.getElementById('ingestLoaderView');
const ingestLoaderStatus = document.getElementById('ingestLoaderStatus');
const ingestTableWrapper = document.getElementById('ingestTableWrapper');
const ingestTable = document.getElementById('ingestTable');
const ingestTableHeader = document.getElementById('ingestTableHeader');
const ingestTableBody = document.getElementById('ingestTableBody');
const ingestSuccessBox = document.getElementById('ingestSuccessBox');
const downloadBtn = document.getElementById('downloadBtn');

const ingestTabs = document.querySelectorAll('.ingest-tab');
const uploadSourceForm = document.getElementById('uploadSourceForm');
const scrapeSourceForm = document.getElementById('scrapeSourceForm');
const scrapeUrlInput = document.getElementById('scrapeUrlInput');
const scrapeSubmitBtn = document.getElementById('scrapeSubmitBtn');
const scrapeSuccessBox = document.getElementById('scrapeSuccessBox');
const scrapeMsg = document.getElementById('scrapeMsg');
const scrapeUrlDisplay = document.getElementById('scrapeUrlDisplay');
const removeScrapeBtn = document.getElementById('removeScrapeBtn');

// Incidents View
const incidentSearch = document.getElementById('incidentSearch');
const incidentSeverityFilter = document.getElementById('incidentSeverityFilter');
const incidentSourceFilter = document.getElementById('incidentSourceFilter');
const incidentsEmptyState = document.getElementById('incidentsEmptyState');
const incidentsTableWrapper = document.getElementById('incidentsTableWrapper');
const incidentsTableBody = document.getElementById('incidentsTableBody');
const incidentDetailContent = document.getElementById('incidentDetailContent');

// Root Cause Analysis View
const runRcaBtn = document.getElementById('runRcaBtn');
const rcaEmptyState = document.getElementById('rcaEmptyState');
const rcaEmptyText = document.getElementById('rcaEmptyText');
const rcaLoaderView = document.getElementById('rcaLoaderView');
const rcaLoaderStatus = document.getElementById('rcaLoaderStatus');
const rcaReport = document.getElementById('rcaReport');


// --- Application State ---
let selectedFile = null;
let parsedCSVRows = [];
let classifiedCSVText = "";
let classifiedCSVBlob = null;
let classifiedCSVRows = [];
let incidentLogs = [];
let activeIncident = null;
let loaderInterval = null;


// --- Tab Navigation Switcher ---
menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Reset navigation active status
        menuItems.forEach(mi => mi.classList.remove('active'));
        item.classList.add('active');
        
        // Hide all views and show selected
        const targetViewId = item.getAttribute('data-target');
        viewSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetViewId) {
                section.classList.add('active');
            }
        });
        
        // Update Nav breadcrumb title
        const tabTitle = item.querySelector('span:last-child').textContent;
        navBreadcrumb.textContent = tabTitle;
    });
});


// --- CSV Formatting/Parsing Helpers ---
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Client-side CSV cell extractor
function parseCSV(text) {
    let lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i+1];
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') { i++; }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') {
        lines.push(row);
    }
    return lines;
}


// --- Ingestion File Upload Events ---
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

['dragleave', 'dragend'].forEach(type => {
    dropzone.addEventListener(type, () => {
        dropzone.classList.remove('dragover');
    });
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
    }
});

removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetIngestState();
});

classifyBtn.addEventListener('click', runIngestClassification);

// --- Ingestion Source Tab Switching ---
ingestTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        ingestTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const type = tab.getAttribute('data-tab');
        if (type === 'upload') {
            uploadSourceForm.style.display = 'flex';
            scrapeSourceForm.style.display = 'none';
        } else {
            uploadSourceForm.style.display = 'none';
            scrapeSourceForm.style.display = 'flex';
        }
    });
});

// --- Ingestion Web Scraper Events ---
scrapeSubmitBtn.addEventListener('click', runWebScraperIngest);
removeScrapeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetIngestState();
});

// Handle Select File
function handleFileSelection(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Format error: Please choose a valid CSV file.');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    
    dropzone.style.display = 'none';
    fileInfoBox.style.display = 'flex';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rawRows = parseCSV(text);
        
        parsedCSVRows = rawRows.filter(r => r.length > 0 && r.some(cell => cell.trim() !== ""));
        
        if (parsedCSVRows.length < 2) {
            alert('Dataset error: CSV must contain a header and at least 1 record.');
            resetIngestState();
            return;
        }
        
        const headers = parsedCSVRows[0].map(h => h.trim());
        const srcIdx = headers.indexOf('source');
        const msgIdx = headers.indexOf('log_message');
        
        if (srcIdx === -1 || msgIdx === -1) {
            alert("Header error: CSV must contain 'source' and 'log_message' columns.");
            resetIngestState();
            return;
        }
        
        renderIngestTable(headers, parsedCSVRows.slice(1, 15));
        
        ingestRowCount.textContent = `${parsedCSVRows.length - 1} logs`;
        ingestRowCount.style.display = 'inline-flex';
        
        classifyBtn.classList.remove('btn-disabled');
        classifyBtn.disabled = false;
    };
    reader.readAsText(file);
}

// Render preview in Ingest Tab
function renderIngestTable(headers, rows) {
    ingestEmptyState.style.display = 'none';
    ingestTableWrapper.style.display = 'block';
    
    // Header
    ingestTableHeader.innerHTML = '';
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        ingestTableHeader.appendChild(th);
    });
    
    // Rows
    ingestTableBody.innerHTML = '';
    rows.forEach(r => {
        const tr = document.createElement('tr');
        r.forEach(c => {
            const td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
        });
        ingestTableBody.appendChild(tr);
    });
}

// Reset Ingest Tab
function resetIngestState() {
    selectedFile = null;
    parsedCSVRows = [];
    classifiedCSVText = "";
    classifiedCSVBlob = null;
    classifiedCSVRows = [];
    incidentLogs = [];
    activeIncident = null;
    
    fileInput.value = '';
    dropzone.style.display = 'block';
    fileInfoBox.style.display = 'none';
    
    classifyBtn.classList.add('btn-disabled');
    classifyBtn.disabled = true;
    
    ingestTableWrapper.style.display = 'none';
    ingestEmptyState.style.display = 'flex';
    ingestLoaderView.style.display = 'none';
    ingestRowCount.style.display = 'none';
    ingestSuccessBox.style.display = 'none';
    
    scrapeSuccessBox.style.display = 'none';
    scrapeSubmitBtn.style.display = 'inline-flex';
    scrapeSubmitBtn.classList.remove('btn-disabled');
    scrapeSubmitBtn.disabled = false;
    
    runRcaBtn.classList.add('btn-disabled');
    runRcaBtn.disabled = true;
    
    rcaEmptyState.style.display = 'flex';
    rcaEmptyText.textContent = "Please upload a log dataset in the Ingestion module first to enable diagnosis.";
    rcaReport.style.display = 'none';
    rcaLoaderView.style.display = 'none';
    
    if (loaderInterval) clearInterval(loaderInterval);
    
    clearDashboardData();
    clearIncidentsData();
}

// --- API Call: Web Scraper ---
function runWebScraperIngest() {
    const url = scrapeUrlInput.value.trim();
    if (!url) {
        alert("Please enter a valid webpage URL.");
        return;
    }
    
    ingestTableWrapper.style.display = 'none';
    ingestEmptyState.style.display = 'none';
    ingestLoaderView.style.display = 'flex';
    scrapeSubmitBtn.classList.add('btn-disabled');
    scrapeSubmitBtn.disabled = true;
    
    const steps = [
        "Resolving target domain...",
        "Establishing HTTP connection...",
        "Downloading HTML markup payload...",
        "Parsing HTML structural nodes...",
        "Extracting log-row items...",
        "Sanitizing source & message strings...",
        "Compiling logs array preview..."
    ];
    
    let stepIdx = 0;
    ingestLoaderStatus.textContent = steps[stepIdx];
    loaderInterval = setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        ingestLoaderStatus.textContent = steps[stepIdx];
    }, 1500);
    
    fetch('/scrape/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url })
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Web scraping execution failed.');
        }
        return res.json();
    })
    .then(data => {
        const logs = data.logs;
        
        parsedCSVRows = [ ["source", "log_message"] ];
        logs.forEach(item => {
            parsedCSVRows.push([item.source, item.message]);
        });
        
        scrapeSuccessBox.style.display = 'flex';
        scrapeMsg.textContent = `Scraped ${logs.length} logs`;
        scrapeUrlDisplay.textContent = url;
        scrapeUrlDisplay.title = url;
        scrapeSubmitBtn.style.display = 'none';
        
        renderIngestTable(["source", "log_message"], parsedCSVRows.slice(1, 15));
        
        ingestRowCount.textContent = `${logs.length} logs`;
        ingestRowCount.style.display = 'inline-flex';
        
        let csvContent = "source,log_message\n";
        logs.forEach(log => {
            let escapedMsg = log.message.replace(/"/g, '""');
            csvContent += `"${log.source}","${escapedMsg}"\n`;
        });
        let blob = new Blob([csvContent], { type: 'text/csv' });
        selectedFile = new File([blob], "scraped_logs.csv", { type: 'text/csv' });
        
        classifyBtn.classList.remove('btn-disabled');
        classifyBtn.disabled = false;
        
        clearInterval(loaderInterval);
        ingestLoaderView.style.display = 'none';
    })
    .catch(err => {
        console.error(err);
        alert(`Scraper Failure: ${err.message}`);
        clearInterval(loaderInterval);
        resetIngestState();
    });
}

// --- API Call: Log Classification ---
function runIngestClassification() {
    if (!selectedFile) return;
    
    ingestTableWrapper.style.display = 'none';
    ingestLoaderView.style.display = 'flex';
    classifyBtn.classList.add('btn-disabled');
    classifyBtn.disabled = true;
    removeFileBtn.style.display = 'none'; // Lock removal
    
    const steps = [
        "Sending dataset payload...",
        "Parsing structures & validation...",
        "Resolving regex patterns...",
        "Evaluating semantic transformer embedding context...",
        "Synthesizing regression model outcomes...",
        "Routing unclassified tokens to DeepSeek model...",
        "Compiling dataset classification schema...",
        "Structuring targets..."
    ];
    
    let idx = 0;
    ingestLoaderStatus.textContent = steps[idx];
    loaderInterval = setInterval(() => {
        idx = (idx + 1) % steps.length;
        ingestLoaderStatus.textContent = steps[idx];
    }, 2000);
    
    const fd = new FormData();
    fd.append('file', selectedFile);
    
    fetch('/classify/', {
        method: 'POST',
        body: fd
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Internal classification server error.');
        }
        return res.blob();
    })
    .then(blob => {
        classifiedCSVBlob = blob;
        
        const rdr = new FileReader();
        rdr.onload = function(e) {
            classifiedCSVText = e.target.result;
            const rawRows = parseCSV(classifiedCSVText);
            
            classifiedCSVRows = rawRows.filter(r => r.length > 0 && r.some(cell => cell.trim() !== ""));
            
            if (classifiedCSVRows.length < 2) {
                throw new Error("Returned data contains no classification records.");
            }
            
            // Render the updated classified preview table
            const headers = classifiedCSVRows[0].map(h => h.trim());
            const targetLabelIdx = headers.indexOf('target_label');
            
            renderIngestTable(headers, classifiedCSVRows.slice(1, 15));
            
            // Format labels in preview with badges
            const rowsInDOM = ingestTableBody.querySelectorAll('tr');
            rowsInDOM.forEach(tr => {
                const cell = tr.children[targetLabelIdx];
                if (cell) {
                    const text = cell.textContent.trim();
                    cell.innerHTML = `<span class="badge ${getBadgeClass(text)}">${text}</span>`;
                }
            });
            
            // Process modules data
            processDashboardStatistics();
            processIncidentsRecords();
            
            // Unlock UI actions
            clearInterval(loaderInterval);
            ingestLoaderView.style.display = 'none';
            ingestSuccessBox.style.display = 'flex';
            removeFileBtn.style.display = 'block';
            
            // Enable RCA triggers
            if (incidentLogs.length > 0) {
                runRcaBtn.classList.remove('btn-disabled');
                runRcaBtn.disabled = false;
                rcaEmptyText.textContent = `Found ${incidentLogs.length} anomalies. Click the button above to execute AI diagnosis.`;
            } else {
                rcaEmptyText.textContent = "Dataset processed successfully, but no warning/error anomalies were detected to diagnose.";
            }
        };
        rdr.readAsText(blob);
    })
    .catch(err => {
        console.error(err);
        alert(`Classification Failure: ${err.message}`);
        clearInterval(loaderInterval);
        resetIngestState();
    });
}

// Map target labels to styles
function getBadgeClass(label) {
    const text = label.toLowerCase();
    if (text.includes('error') || text.includes('fail') || text.includes('err')) return 'badge-error';
    if (text.includes('warn') || text.includes('alert')) return 'badge-warning';
    if (text.includes('crit') || text.includes('fatal') || text.includes('emerg')) return 'badge-critical';
    if (text.includes('info') || text.includes('debug')) return 'badge-info';
    if (text.includes('ok') || text.includes('success') || text.includes('clean')) return 'badge-success';
    return 'badge-info';
}


// --- Module 1: Dashboard Calculations ---
function clearDashboardData() {
    dashTotal.textContent = "0";
    dashWarning.textContent = "0";
    dashWarningTrend.textContent = "0% of total";
    dashWarningTrend.className = "metric-trend trend-neutral";
    dashError.textContent = "0";
    dashErrorTrend.textContent = "0% of total";
    dashErrorTrend.className = "metric-trend trend-neutral";
    dashSources.textContent = "0";
    
    dashChartBars.innerHTML = `
        <div class="empty-state" style="padding: 2rem 0;">
            <div class="empty-state-icon">📊</div>
            <p>No distribution data available. Upload log files in the Log Ingestion module.</p>
        </div>`;
    dashSourceBars.innerHTML = `
        <div class="empty-state" style="padding: 2rem 0;">
            <div class="empty-state-icon">🏢</div>
            <p>No activity data available.</p>
        </div>`;
}

function processDashboardStatistics() {
    if (classifiedCSVRows.length < 2) return;
    
    const headers = classifiedCSVRows[0].map(h => h.trim());
    const sourceIdx = headers.indexOf('source');
    const labelIdx = headers.indexOf('target_label');
    
    const totalLogs = classifiedCSVRows.length - 1;
    let warningCount = 0;
    let errorCount = 0;
    const sourceCounts = {};
    const labelCounts = {};
    
    for (let i = 1; i < classifiedCSVRows.length; i++) {
        const row = classifiedCSVRows[i];
        
        // Count sources
        const src = row[sourceIdx]?.trim() || 'Unknown';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        
        // Count labels
        const label = row[labelIdx]?.trim() || 'Unclassified';
        labelCounts[label] = (labelCounts[label] || 0) + 1;
        
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('warn') || lowerLabel.includes('alert')) {
            warningCount++;
        } else if (lowerLabel.includes('error') || lowerLabel.includes('fail') || lowerLabel.includes('crit') || lowerLabel.includes('fatal')) {
            errorCount++;
        }
    }
    
    const numSources = Object.keys(sourceCounts).length;
    const warnPct = ((warningCount / totalLogs) * 100).toFixed(1);
    const errPct = ((errorCount / totalLogs) * 100).toFixed(1);
    
    // Fill metrics
    dashTotal.textContent = totalLogs.toLocaleString();
    dashWarning.textContent = warningCount.toLocaleString();
    dashWarningTrend.textContent = `${warnPct}% of logs`;
    dashWarningTrend.className = `metric-trend ${warningCount > 0 ? 'trend-warning' : 'trend-neutral'}`;
    
    dashError.textContent = errorCount.toLocaleString();
    dashErrorTrend.textContent = `${errPct}% of logs`;
    dashErrorTrend.className = `metric-trend ${errorCount > 0 ? 'trend-danger' : 'trend-neutral'}`;
    
    dashSources.textContent = numSources.toLocaleString();
    
    // Render distributions chart
    renderDashboardLabelBars(labelCounts, totalLogs);
    // Render source activities chart
    renderDashboardSourceBars(sourceCounts, totalLogs);
}

function renderDashboardLabelBars(counts, total) {
    dashChartBars.innerHTML = '';
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    
    sorted.forEach(([label, val]) => {
        const pct = ((val / total) * 100).toFixed(1);
        let color = 'var(--primary)';
        const l = label.toLowerCase();
        if (l.includes('error') || l.includes('fail')) color = 'var(--color-error)';
        else if (l.includes('warn') || l.includes('alert')) color = 'var(--color-warning)';
        else if (l.includes('crit') || l.includes('fatal')) color = 'var(--color-critical)';
        else if (l.includes('info') || l.includes('debug')) color = 'var(--color-info)';
        else if (l.includes('ok') || l.includes('success')) color = 'var(--color-success)';
        
        const item = document.createElement('div');
        item.className = 'bar-item';
        item.innerHTML = `
            <div class="bar-label-row">
                <span>${label}</span>
                <span><strong>${val}</strong> (${pct}%)</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="background-color: ${color}; width: ${pct}%;"></div>
            </div>
        `;
        dashChartBars.appendChild(item);
    });
}

function renderDashboardSourceBars(counts, total) {
    dashSourceBars.innerHTML = '';
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5); // top 5 sources
    
    sorted.forEach(([src, val]) => {
        const pct = ((val / total) * 100).toFixed(1);
        const item = document.createElement('div');
        item.className = 'bar-item';
        item.innerHTML = `
            <div class="bar-label-row">
                <span>${src}</span>
                <span><strong>${val}</strong> logs</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="background-color: var(--color-info); width: ${pct}%;"></div>
            </div>
        `;
        dashSourceBars.appendChild(item);
    });
}


// --- Module 2: Incidents Feed ---
function clearIncidentsData() {
    incidentSearch.value = '';
    incidentSeverityFilter.value = 'ALL';
    incidentSourceFilter.innerHTML = '<option value="ALL">All Sources</option>';
    
    incidentsTableWrapper.style.display = 'none';
    incidentsEmptyState.style.display = 'flex';
    
    incidentDetailContent.innerHTML = `
        <div class="empty-state" style="padding: 2rem 0;">
            <div class="empty-state-icon">🔍</div>
            <p>Select an incident row from the feed to view full diagnostics.</p>
        </div>`;
}

function processIncidentsRecords() {
    if (classifiedCSVRows.length < 2) return;
    
    const headers = classifiedCSVRows[0].map(h => h.trim());
    const sourceIdx = headers.indexOf('source');
    const msgIdx = headers.indexOf('log_message');
    const labelIdx = headers.indexOf('target_label');
    
    incidentLogs = [];
    const uniqueSources = new Set();
    
    for (let i = 1; i < classifiedCSVRows.length; i++) {
        const r = classifiedCSVRows[i];
        const src = r[sourceIdx]?.trim() || 'Unknown';
        const msg = r[msgIdx]?.trim() || '';
        const label = r[labelIdx]?.trim() || 'Unclassified';
        
        uniqueSources.add(src);
        
        // Collect all logs, but categorize which ones are incident level warnings/errors
        const item = { index: i, source: src, message: msg, severity: label };
        incidentLogs.push(item);
    }
    
    // Populate incident source filter dropdown
    incidentSourceFilter.innerHTML = '<option value="ALL">All Sources</option>';
    uniqueSources.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        incidentSourceFilter.appendChild(opt);
    });
    
    applyIncidentsFilters();
}

function applyIncidentsFilters() {
    if (incidentLogs.length === 0) {
        incidentsTableWrapper.style.display = 'none';
        incidentsEmptyState.style.display = 'flex';
        return;
    }
    
    const searchVal = incidentSearch.value.toLowerCase().trim();
    const severityVal = incidentSeverityFilter.value;
    const sourceVal = incidentSourceFilter.value;
    
    const filtered = incidentLogs.filter(item => {
        // Source Filter
        if (sourceVal !== 'ALL' && item.source !== sourceVal) return false;
        
        // Search Filter
        if (searchVal !== '') {
            const inSrc = item.source.toLowerCase().includes(searchVal);
            const inMsg = item.message.toLowerCase().includes(searchVal);
            if (!inSrc && !inMsg) return false;
        }
        
        // Severity Filter
        const sev = item.severity.toLowerCase();
        const isAnomaly = sev.includes('warn') || sev.includes('err') || sev.includes('crit') || sev.includes('fail') || sev.includes('fatal');
        
        if (severityVal === 'INCIDENT') {
            return isAnomaly;
        } else if (severityVal !== 'ALL') {
            return sev.includes(severityVal.toLowerCase());
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        incidentsTableWrapper.style.display = 'none';
        incidentsEmptyState.style.display = 'flex';
        return;
    }
    
    incidentsEmptyState.style.display = 'none';
    incidentsTableWrapper.style.display = 'block';
    
    incidentsTableBody.innerHTML = '';
    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td style="font-weight: 500;">${item.source}</td>
            <td title="${item.message}">${item.message}</td>
            <td><span class="badge ${getBadgeClass(item.severity)}">${item.severity}</span></td>
        `;
        
        tr.addEventListener('click', () => {
            // Remove selection class from other rows
            incidentsTableBody.querySelectorAll('tr').forEach(r => r.style.backgroundColor = '');
            tr.style.backgroundColor = '#f1f5f9';
            
            showIncidentDetails(item);
        });
        incidentsTableBody.appendChild(tr);
    });
}

// Incident Search and Select trigger filtering
incidentSearch.addEventListener('input', applyIncidentsFilters);
incidentSeverityFilter.addEventListener('change', applyIncidentsFilters);
incidentSourceFilter.addEventListener('change', applyIncidentsFilters);

function showIncidentDetails(item) {
    activeIncident = item;
    
    incidentDetailContent.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Index Reference</div>
            <div class="detail-value">Row #${item.index}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Service Source</div>
            <div class="detail-value" style="font-weight: 600;">${item.source}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Classification Severity</div>
            <div class="detail-value"><span class="badge ${getBadgeClass(item.severity)}">${item.severity}</span></div>
        </div>
        <div class="detail-row" style="margin-bottom: 0;">
            <div class="detail-label">Raw Log Message</div>
            <div class="detail-value" style="font-family: monospace; font-size: 0.85rem; padding: 0.75rem; background-color: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); white-space: pre-wrap; line-height: 1.5; color: #1e293b;">${item.message}</div>
        </div>
    `;
}


// --- Module 3: AI Root Cause Analysis ---
runRcaBtn.addEventListener('click', executeAiRcaAnalysis);

function executeAiRcaAnalysis() {
    // Gather anomalies (warnings, errors, criticals)
    const anomalies = incidentLogs.filter(item => {
        const s = item.severity.toLowerCase();
        return s.includes('warn') || s.includes('err') || s.includes('crit') || s.includes('fail') || s.includes('fatal');
    });
    
    if (anomalies.length === 0) {
        alert("RCA Error: No Warning or Error anomalies are present in the current dataset to diagnose.");
        return;
    }
    
    rcaEmptyState.style.display = 'none';
    rcaReport.style.display = 'none';
    rcaLoaderView.style.display = 'flex';
    runRcaBtn.classList.add('btn-disabled');
    runRcaBtn.disabled = true;
    
    // Compile log logs text
    const anomalyLogs = anomalies.map(a => `[${a.source}] [${a.severity}] ${a.message}`);
    
    fetch('/analyze/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: anomalyLogs })
    })
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to complete AI diagnosis.');
        }
        return res.json();
    })
    .then(data => {
        const htmlReport = renderMarkdownToHtml(data.diagnosis);
        
        rcaLoaderView.style.display = 'none';
        rcaReport.innerHTML = htmlReport;
        rcaReport.style.display = 'block';
        
        runRcaBtn.classList.remove('btn-disabled');
        runRcaBtn.disabled = false;
    })
    .catch(err => {
        console.error(err);
        alert(`Diagnosis Error: ${err.message}`);
        rcaLoaderView.style.display = 'none';
        rcaEmptyState.style.display = 'flex';
        runRcaBtn.classList.remove('btn-disabled');
        runRcaBtn.disabled = false;
    });
}

// Custom Markdown to HTML client-side compilation
function renderMarkdownToHtml(md) {
    if (!md) return "";
    let html = md;
    
    // Escape HTML characters to protect script layout injection
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Headings (H3, H2, H1)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold styles
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Fenced inline code tags
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Lists formatting (Contiguous bullet items parsing)
    const lines = html.split('\n');
    let finalHtml = '';
    let inList = false;
    
    for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) {
                finalHtml += '<ul>';
                inList = true;
            }
            finalHtml += `<li>${trimmed.substring(2)}</li>`;
        } else if (/^\d+\.\s+(.*$)/.test(trimmed)) {
            const listContent = trimmed.replace(/^\d+\.\s+/, '');
            if (!inList) {
                finalHtml += '<ol>';
                inList = true;
            }
            finalHtml += `<li>${listContent}</li>`;
        } else {
            if (inList) {
                // Determine closing type
                if (finalHtml.lastIndexOf('<ul>') > finalHtml.lastIndexOf('<ol>')) {
                    finalHtml += '</ul>';
                } else {
                    finalHtml += '</ol>';
                }
                inList = false;
            }
            finalHtml += trimmed !== '' ? `<p>${trimmed}</p>` : '';
        }
    }
    
    if (inList) {
        if (finalHtml.lastIndexOf('<ul>') > finalHtml.lastIndexOf('<ol>')) {
            finalHtml += '</ul>';
        } else {
            finalHtml += '</ol>';
        }
    }
    
    return finalHtml;
}


// --- Actions: Labeled Output CSV download ---
downloadBtn.addEventListener('click', () => {
    if (!classifiedCSVBlob) return;
    
    const url = window.URL.createObjectURL(classifiedCSVBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const origName = selectedFile ? selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) : 'logs';
    a.download = `${origName}_classified_report.csv`;
    
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
});
