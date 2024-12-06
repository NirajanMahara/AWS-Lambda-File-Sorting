/*
 * Author
 * Name: Nirajan Mahara
 * Student ID: 0921977
 * AWS Lambda File Sorting Application
 */

// AWS Configuration
const AWS_CONFIG = {
    region: 'ca-central-1',
    identityPoolId: 'ca-central-1:9b265c77-c096-4c9d-95a9-c554d90e8493',
    inputBucket: 'sortin-nirajan-0921977',
    outputBucket: 'sortout-nirajan-0921977'
};

// Initialize AWS
AWS.config.region = AWS_CONFIG.region;
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: AWS_CONFIG.identityPoolId
});

const s3 = new AWS.S3();

// State Management
const state = {
    processingStats: {
        totalFiles: 0,
        totalProcessingTime: 0,
        successCount: 0,
        failureCount: 0,
        uploadHistory: []
    },
    fileHistory: [],
    chart: null
};

// DOM Elements
const elements = {
    fileInput: document.getElementById('fileInput'),
    uploadButton: document.getElementById('uploadButton'),
    status: document.getElementById('status'),
    originalContent: document.getElementById('originalContent'),
    sortedContent: document.getElementById('sortedContent'),
    errorMessage: document.getElementById('error-message'),
    progressSection: document.querySelector('.progress-section'),
    progressBar: document.querySelector('.progress'),
    fileHistory: document.getElementById('fileHistory'),
    metrics: {
        totalFiles: document.getElementById('totalFiles'),
        avgProcessingTime: document.getElementById('avgProcessingTime'),
        successRate: document.getElementById('successRate')
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApplication);
elements.uploadButton.addEventListener('click', handleFileUpload);

// Application Initialization
async function initializeApplication() {
    await loadChartJS();
    initializeCharts();
    await loadFileHistory();
    await refreshFileHistory();
    setInterval(refreshFileHistory, 30000); // Refresh every 30 seconds
}

// Chart.js Loading and Initialization
async function loadChartJS() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function initializeCharts() {
    const ctx = document.getElementById('uploadHistoryGraph').getContext('2d');
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Processing Time (ms)',
                data: [],
                borderColor: '#007bff',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// File Upload and Processing
async function handleFileUpload() {
    const startTime = performance.now();
    const file = elements.fileInput.files[0];
    
    resetUI();
    
    try {
        validateFile(file);
        showProgress();
        
        // Read and display original content
        const originalContent = await readFileContent(file);
        displayContent(elements.originalContent, originalContent);
        
        // Upload and process
        await uploadAndProcessFile(file);
        
        // Get and display sorted content
        const sortedContent = await getSortedFile(file.name);
        displayContent(elements.sortedContent, sortedContent);
        
        // Update UI and stats
        const processingTime = Math.round(performance.now() - startTime);
        updateMetrics(processingTime);
        highlightDifferences(originalContent, sortedContent);
        
        completeUpload();
    } catch (error) {
        handleError(error);
    }
}

// File Validation
function validateFile(file) {
    if (!file) throw new Error('Please select a file');
    
    const allowedTypes = ['.txt', '.csv', '.srt'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(extension)) {
        throw new Error('Please upload a .txt, .csv, or .srt file');
    }
    
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
    }
}

// File Operations
async function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

async function uploadAndProcessFile(file) {
    updateProgress(20);
    elements.status.textContent = 'Uploading file...';
    
    await uploadToS3(file);
    
    updateProgress(50);
    elements.status.textContent = 'Processing file...';
    
    const sortedKey = await waitForSortedFile(file.name);
    addToHistory(file.name, sortedKey);
}

async function uploadToS3(file) {
    const params = {
        Bucket: AWS_CONFIG.inputBucket,
        Key: file.name,
        Body: file,
        ContentType: 'text/plain'
    };

    try {
        await s3.upload(params, {
            partSize: 5 * 1024 * 1024, // 5 MB chunks
            queueSize: 1
        }).on('httpUploadProgress', evt => {
            const percentLoaded = Math.round((evt.loaded * 100) / evt.total);
            updateProgress(20 + (percentLoaded * 0.3)); // 20-50% progress
        }).promise();
    } catch (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
}

async function getSortedFile(fileName) {
    try {
        updateProgress(70);
        elements.status.textContent = 'Retrieving sorted file...';
        
        const data = await s3.listObjectsV2({
            Bucket: AWS_CONFIG.outputBucket,
            Prefix: 'sorted_'
        }).promise();
        
        if (!data.Contents?.length) {
            throw new Error('No sorted file found');
        }

        const sortedFile = data.Contents
            .sort((a, b) => b.LastModified - a.LastModified)[0];

        const result = await s3.getObject({
            Bucket: AWS_CONFIG.outputBucket,
            Key: sortedFile.Key
        }).promise();

        return result.Body.toString('utf-8');
    } catch (error) {
        throw new Error(`Failed to retrieve sorted file: ${error.message}`);
    }
}

// History Management
async function loadFileHistory() {
    const savedHistory = localStorage.getItem('fileHistory');
    if (savedHistory) {
        state.fileHistory = JSON.parse(savedHistory);
        updateHistoryDisplay();
    }
}

async function refreshFileHistory() {
    try {
        const data = await s3.listObjectsV2({
            Bucket: AWS_CONFIG.outputBucket,
            Prefix: 'sorted_'
        }).promise();

        if (!data.Contents) return;

        state.fileHistory = data.Contents
            .sort((a, b) => b.LastModified - a.LastModified)
            .slice(0, 5)
            .map(file => ({
                sortedFileName: file.Key.split('/').pop(),
                timestamp: new Date(file.LastModified).toISOString(),
                key: file.Key
            }));

        updateHistoryDisplay();
        localStorage.setItem('fileHistory', JSON.stringify(state.fileHistory));
    } catch (error) {
        console.error('Error refreshing history:', error);
    }
}

function addToHistory(fileName, actualKey) {
    const historyItem = {
        sortedFileName: actualKey.split('/').pop(),
        timestamp: new Date().toISOString(),
        key: actualKey
    };
    
    const existingIndex = state.fileHistory.findIndex(item => item.key === actualKey);
    
    if (existingIndex !== -1) {
        state.fileHistory[existingIndex] = historyItem;
    } else {
        state.fileHistory.unshift(historyItem);
        if (state.fileHistory.length > 5) {
            state.fileHistory.pop();
        }
    }
    
    updateHistoryDisplay();
    localStorage.setItem('fileHistory', JSON.stringify(state.fileHistory));
}

// UI Updates
function updateHistoryDisplay() {
    if (!elements.fileHistory) return;

    elements.fileHistory.innerHTML = state.fileHistory.map(item => `
        <div class="history-item">
            <span class="history-filename">${item.sortedFileName}</span>
            <span class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
            <div class="download-options">
                <button class="history-download" onclick="downloadHistoryFileWithFormat('${item.key}', '${item.sortedFileName}', 'srt')">
                    SRT
                </button>
                <button class="history-download" onclick="downloadHistoryFileWithFormat('${item.key}', '${item.sortedFileName}', 'csv')">
                    CSV
                </button>
                <button class="history-download" onclick="downloadHistoryFileWithFormat('${item.key}', '${item.sortedFileName}', 'json')">
                    JSON
                </button>
            </div>
        </div>
    `).join('');
}

function updateMetrics(processingTime) {
    state.processingStats.totalFiles++;
    state.processingStats.totalProcessingTime += processingTime;
    state.processingStats.successCount++;
    
    const avgTime = Math.round(state.processingStats.totalProcessingTime / state.processingStats.totalFiles);
    const successRate = Math.round((state.processingStats.successCount / state.processingStats.totalFiles) * 100);
    
    elements.metrics.totalFiles.textContent = state.processingStats.totalFiles;
    elements.metrics.avgProcessingTime.textContent = `${avgTime}ms`;
    elements.metrics.successRate.textContent = `${successRate}%`;
    
    updateChart(processingTime);
}

function updateChart(processingTime) {
    if (!state.chart) return;
    
    const timestamp = new Date().toLocaleTimeString();
    state.chart.data.labels.push(timestamp);
    state.chart.data.datasets[0].data.push(processingTime);
    
    if (state.chart.data.labels.length > 10) {
        state.chart.data.labels.shift();
        state.chart.data.datasets[0].data.shift();
    }
    
    state.chart.update();
}

// Progress and Status
function showProgress() {
    elements.progressSection.style.display = 'block';
    elements.progressBar.style.width = '0%';
}

function hideProgress() {
    elements.progressSection.style.display = 'none';
}

function updateProgress(percent) {
    elements.progressBar.style.width = `${percent}%`;
    elements.progressBar.setAttribute('aria-valuenow', percent);
}

// Error Handling
function handleError(error) {
    console.error('Operation failed:', error);
    state.processingStats.failureCount++;
    elements.errorMessage.style.display = 'block';
    elements.errorMessage.textContent = error.message;
    hideProgress();
}

// UI Reset
function resetUI() {
    elements.errorMessage.style.display = 'none';
    elements.originalContent.innerHTML = '';
    elements.sortedContent.innerHTML = '';
}

// Helper Functions
function displayContent(element, content) {
    // Clear existing content
    element.innerHTML = '';
    
    // Create and append the formatted content
    const formattedContent = formatCSVContent(content);
    element.innerHTML = formattedContent;
    
    // Make sure the content is scrollable if needed
    element.style.overflowX = 'auto';
    element.style.overflowY = 'auto';
}

function formatCSVContent(csvContent) {
    const lines = csvContent.trim().split('\n');
    const headers = ['Name', 'Address', 'Suite/Apt', 'City', 'Country', 
                    'Phone', 'Age', 'Occupation', 'UUID', 'DOB'];
    
    let formattedHtml = '<div class="csv-table">';
    
    // Add header row
    formattedHtml += '<div class="csv-row header">';
    headers.forEach(header => {
        formattedHtml += `<div class="csv-cell">${header}</div>`;
    });
    formattedHtml += '</div>';
    
    // Add data rows
    lines.forEach(line => {
        const cells = line.split(',');
        formattedHtml += '<div class="csv-row">';
        cells.forEach(cell => {
            const cleanCell = cell.trim();
            formattedHtml += `
                <div class="csv-cell" data-content="${cleanCell}">
                    ${cleanCell}
                </div>`;
        });
        formattedHtml += '</div>';
    });
    
    return formattedHtml + '</div>';
}

function highlightDifferences(original, sorted) {
    const originalRows = elements.originalContent.querySelectorAll('.csv-row:not(.header)');
    const sortedRows = elements.sortedContent.querySelectorAll('.csv-row:not(.header)');
    
    const originalMap = new Map();
    originalRows.forEach((row, index) => {
        originalMap.set(row.textContent, index);
    });
    
    // Add animation classes with delay
    sortedRows.forEach((row, newIndex) => {
        const originalIndex = originalMap.get(row.textContent);
        if (originalIndex !== newIndex) {
            // Delay the highlight animation
            setTimeout(() => {
                row.classList.add('highlight-different');
                originalRows[originalIndex].classList.add('highlight-different');
            }, newIndex * 100); // Stagger the highlights
        }
    });
}

async function waitForSortedFile(fileName) {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const data = await s3.listObjects({
                Bucket: AWS_CONFIG.outputBucket,
                Prefix: 'sorted_'
            }).promise();
            
            const sortedFiles = data.Contents
                .map(obj => obj.Key)
                .sort((a, b) => b.localeCompare(a));
            
            const matchingFile = sortedFiles.find(key => 
                key.includes(fileName.replace('.txt', '')) && key.endsWith('.srt')
            );
            
            if (matchingFile) return matchingFile;
        } catch (error) {
            console.error('Error checking for sorted file:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    throw new Error('Timeout waiting for sorted file');
}

function completeUpload() {
    updateProgress(100);
    elements.status.textContent = 'Complete!';
    
    // Add sorting animation with improved timing
    const rows = document.querySelectorAll('.csv-row:not(.header)');
    rows.forEach((row, index) => {
        // Remove any existing animation classes
        row.classList.remove('sorting-animation');
        
        // Force a reflow to ensure the animation runs again
        void row.offsetWidth;
        
        // Add the animation class with a slight delay
        setTimeout(() => {
            row.classList.add('sorting-animation');
        }, index * 150); // Increased delay between rows
    });
    
    // Hide progress after all animations complete
    setTimeout(hideProgress, rows.length * 150 + 1000);
}

// File Download
async function downloadHistoryFileWithFormat(key, fileName, format) {
    try {
        showProgress();
        updateProgress(25);
        elements.status.textContent = 'Downloading file...';

        const data = await s3.getObject({
            Bucket: AWS_CONFIG.outputBucket,
            Key: key
        }).promise();
        
        const content = data.Body.toString('utf-8');
        const { downloadContent, mimeType, fileExtension } = formatFileContent(content, format);
        
        downloadFile(downloadContent, fileName.replace('.srt', fileExtension), mimeType);
        
        updateProgress(100);
        elements.status.textContent = 'Download complete!';
        setTimeout(hideProgress, 1000);
    } catch (error) {
        handleError(new Error(`Download failed: ${error.message}`));
    }
}

function formatFileContent(content, format) {
    switch(format) {
        case 'srt':
            return {
                downloadContent: content,
                mimeType: 'text/plain',
                fileExtension: '.srt'
            };
        case 'csv':
            return {
                downloadContent: content,
                mimeType: 'text/csv',
                fileExtension: '.csv'
            };
        case 'json':
            const lines = content.trim().split('\n');
            const headers = ['Name', 'Address', 'Suite/Apt', 'City', 'Country', 
                           'Phone', 'Age', 'Occupation', 'UUID', 'DOB'];
            const jsonData = lines.map(line => {
                const values = line.split(',');
                return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
            });
            return {
                downloadContent: JSON.stringify(jsonData, null, 2),
                mimeType: 'application/json',
                fileExtension: '.json'
            };
        default:
            throw new Error('Unsupported format');
    }
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
