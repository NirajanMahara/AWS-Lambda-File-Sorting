// AWS Configuration
AWS.config.region = 'ca-central-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ca-central-1:9b265c77-c096-4c9d-95a9-c554d90e8493'
});

const s3 = new AWS.S3();
const INPUT_BUCKET = 'sortin-nirajan-0921977';
const OUTPUT_BUCKET = 'sortout-nirajan-0921977';

// Initialize file history array
let fileHistory = [];

document.getElementById('uploadButton').addEventListener('click', handleFileUpload);

// File validation function
function validateFile(file) {
    const allowedTypes = ['.txt', '.csv', '.srt'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(extension)) {
        throw new Error('Please upload a .txt, .csv, or .srt file');
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size must be less than 10MB');
    }
    return true;
}

// History management functions
// Update addToHistory function to prevent duplicates
function addToHistory(fileName, actualKey) {
    // Check if this file is already in history
    const existingIndex = fileHistory.findIndex(item => item.key === actualKey);
    
    const historyItem = {
        sortedFileName: actualKey.split('/').pop(),
        timestamp: new Date().toISOString(),
        key: actualKey
    };
    
    if (existingIndex !== -1) {
        // Update existing entry instead of adding duplicate
        fileHistory[existingIndex] = historyItem;
    } else {
        // Add new entry
        fileHistory.unshift(historyItem);
        // Keep only the last 5 entries
        if (fileHistory.length > 5) {
            fileHistory.pop();
        }
    }
    
    // Update display and save to localStorage
    updateHistoryDisplay();
    localStorage.setItem('fileHistory', JSON.stringify(fileHistory));
}

// Add function to refresh history from S3
async function refreshFileHistory() {
    try {
        const params = {
            Bucket: OUTPUT_BUCKET,
            Prefix: 'sorted_'
        };
        
        const data = await s3.listObjects(params).promise();
        const files = data.Contents
            .map(obj => ({
                key: obj.Key,
                lastModified: obj.LastModified
            }))
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
            .slice(0, 5);  // Keep only the 5 most recent files
            
        fileHistory = files.map(file => ({
            sortedFileName: file.key.split('/').pop(),
            timestamp: new Date(file.lastModified).toISOString(),
            key: file.key
        }));
        
        updateHistoryDisplay();
        localStorage.setItem('fileHistory', JSON.stringify(fileHistory));
    } catch (error) {
        console.error('Error refreshing history:', error);
    }
}

// Call refreshFileHistory when page loads
document.addEventListener('DOMContentLoaded', refreshFileHistory);

// Add new function for format conversion and download
async function downloadHistoryFileWithFormat(key, fileName, format) {
    try {
        console.log(`Attempting to download with key: ${key} in format: ${format}`);
        
        const params = {
            Bucket: OUTPUT_BUCKET,
            Key: key
        };

        showProgress();
        updateProgress(25);
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Downloading file...';

        const data = await s3.getObject(params).promise();
        const content = data.Body.toString('utf-8');
        
        // Convert content based on format
        let downloadContent;
        let mimeType;
        let fileExtension;
        
        switch(format) {
            case 'srt':
                downloadContent = content;
                mimeType = 'text/plain';
                fileExtension = '.srt';
                break;
            case 'csv':
                downloadContent = content;  // Already in CSV format
                mimeType = 'text/csv';
                fileExtension = '.csv';
                break;
            case 'json':
                const lines = content.trim().split('\n');
                const headers = ['Name', 'Address', 'Suite/Apt', 'City', 'Country', 
                               'Phone', 'Age', 'Occupation', 'UUID', 'DOB'];
                const jsonData = lines.map(line => {
                    const values = line.split(',');
                    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
                });
                downloadContent = JSON.stringify(jsonData, null, 2);
                mimeType = 'application/json';
                fileExtension = '.json';
                break;
            default:
                throw new Error('Unsupported format');
        }

        const blob = new Blob([downloadContent], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace('.srt', fileExtension);
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        updateProgress(100);
        statusElement.textContent = 'Download complete!';
        setTimeout(hideProgress, 1000);

    } catch (error) {
        console.error('Download failed:', error);
        const errorDiv = document.getElementById('error-message');
        errorDiv.style.display = 'block';
        errorDiv.textContent = `Download failed: ${error.message}`;
        hideProgress();
    }
}

// Update updateHistoryDisplay function
function updateHistoryDisplay() {
    const historyElement = document.getElementById('fileHistory');
    if (!historyElement) return;

    historyElement.innerHTML = fileHistory.map(item => `
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

// Modified handleFileUpload function
async function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    const errorDiv = document.getElementById('error-message');
    const statusElement = document.getElementById('status');
    const originalContentElement = document.getElementById('originalContent');
    const sortedContentElement = document.getElementById('sortedContent');
    
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    try {
        if (!file) {
            throw new Error('Please select a file first.');
        }

        // Validate file
        validateFile(file);

        // Read and display original file
        const originalContent = await readFile(file);
        originalContentElement.innerHTML = formatCSVContent(originalContent);

        // Show progress bar at start
        showProgress();
        updateProgress(0);
        
        // Upload phase (0-40%)
        statusElement.textContent = 'Uploading file...';
        await uploadToS3(file, (uploadProgress) => {
            updateProgress(uploadProgress * 0.4); // 0-40%
        });
        
        // Processing phase (40-70%)
        statusElement.textContent = 'Processing file...';
        updateProgress(40);
        await new Promise(resolve => {
            let progress = 40;
            const interval = setInterval(() => {
                progress += 2;
                if (progress <= 70) {
                    updateProgress(progress);
                } else {
                    clearInterval(interval);
                    resolve();
                }
            }, 200);
        });
        
        // Wait for the sorted file to appear in the bucket
        const sortedKey = await waitForSortedFile(file.name);
        console.log('Found sorted file:', sortedKey);
        
        // Add to history with the actual key
        addToHistory(file.name, sortedKey);
        
        // Retrieval phase (70-100%)
        statusElement.textContent = 'Retrieving sorted file...';
        updateProgress(70);
        const sortedContent = await getSortedFile(file.name);
        
        // Complete
        updateProgress(100);
        statusElement.textContent = 'Complete!';
        
        // Display content and highlight differences
        sortedContentElement.innerHTML = formatCSVContent(sortedContent);
        highlightDifferences(originalContent, sortedContent);
        
        // Hide progress after a delay
        setTimeout(() => {
            hideProgress();
        }, 1000);
        
    } catch (error) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = error.message;
        hideProgress();
    }
}

// Load history from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedHistory = localStorage.getItem('fileHistory');
    if (savedHistory) {
        fileHistory = JSON.parse(savedHistory);
        updateHistoryDisplay();
    }
});

async function uploadToS3(file, progressCallback) {
    const params = {
        Bucket: INPUT_BUCKET,
        Key: file.name,
        Body: file,
        ContentType: 'text/plain'
    };

    try {
        await s3.upload(params, {
            partSize: 1024 * 1024 * 5, // 5 MB chunks
            queueSize: 1
        }).on('httpUploadProgress', function(evt) {
            const percentLoaded = Math.round((evt.loaded * 100) / evt.total);
            progressCallback(percentLoaded);
        }).promise();
    } catch (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
}

async function getSortedFile(fileName) {
    try {
        // List objects in the bucket to find the correct file
        const listParams = {
            Bucket: OUTPUT_BUCKET,
            Prefix: 'sorted_'
        };
        
        const listedObjects = await s3.listObjectsV2(listParams).promise();
        
        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            throw new Error('No sorted file found');
        }

        // Get the most recent file
        const sortedFile = listedObjects.Contents
            .sort((a, b) => b.LastModified - a.LastModified)[0];

        // Get the file content
        const getParams = {
            Bucket: OUTPUT_BUCKET,
            Key: sortedFile.Key
        };

        const data = await s3.getObject(getParams).promise();
        return data.Body.toString('utf-8');
    } catch (error) {
        throw new Error(`Failed to retrieve sorted file: ${error.message}`);
    }
}

function showProgress() {
    const progressSection = document.querySelector('.progress-section');
    const progressBar = document.querySelector('.progress');
    progressSection.style.display = 'block';
    progressBar.style.width = '0%';
}

function hideProgress() {
    const progressSection = document.querySelector('.progress-section');
    progressSection.style.display = 'none';
}

function updateProgress(percent) {
    const progressBar = document.querySelector('.progress');
    progressBar.style.width = `${percent}%`;
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Add this function to format the CSV content
function formatCSVContent(csvContent) {
    const lines = csvContent.trim().split('\n');
    let formattedHtml = '<div class="csv-table">';
    
    // Headers for the CSV columns
    const headers = [
        'Name', 'Address', 'Suite/Apt', 'City', 'Country', 
        'Phone', 'Age', 'Occupation', 'UUID', 'DOB'
    ];
    
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
            formattedHtml += `<div class="csv-cell">${cell.trim()}</div>`;
        });
        formattedHtml += '</div>';
    });
    
    formattedHtml += '</div>';
    return formattedHtml;
}

// Update the highlightDifferences function
function highlightDifferences(original, sorted) {
    const originalElement = document.getElementById('originalContent');
    const sortedElement = document.getElementById('sortedContent');
    
    // Format both contents
    originalElement.innerHTML = formatCSVContent(original);
    sortedElement.innerHTML = formatCSVContent(sorted);
    
    // Get all rows for comparison
    const originalRows = originalElement.querySelectorAll('.csv-row:not(.header)');
    const sortedRows = sortedElement.querySelectorAll('.csv-row:not(.header)');
    
    // Create a map of original content for comparison
    const originalMap = new Map();
    originalRows.forEach((row, index) => {
        originalMap.set(row.textContent, index);
    });
    
    // Highlight rows that have moved
    sortedRows.forEach((row, newIndex) => {
        const originalIndex = originalMap.get(row.textContent);
        if (originalIndex !== newIndex) {
            row.classList.add('highlight-different');
            originalRows[originalIndex].classList.add('highlight-different');
        }
    });
}

// Add this function to help with debugging
async function listBucketContents() {
    try {
        const params = {
            Bucket: OUTPUT_BUCKET,
            Prefix: 'sorted_'
        };
        const data = await s3.listObjects(params).promise();
        console.log('Bucket contents:', data.Contents.map(item => item.Key));
    } catch (error) {
        console.error('Error listing bucket:', error);
    }
}

// Call this when the page loads to see what's in the bucket
document.addEventListener('DOMContentLoaded', listBucketContents);

// Add function to wait for the sorted file
async function waitForSortedFile(fileName) {
    const baseFileName = fileName.replace('.txt', '');
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const params = {
                Bucket: OUTPUT_BUCKET,
                Prefix: `sorted_`
            };
            
            const data = await s3.listObjects(params).promise();
            const files = data.Contents.map(obj => obj.Key);
            
            // Sort files by last modified (newest first)
            const sortedFiles = files.sort((a, b) => {
                return b.localeCompare(a);
            });
            
            // Find the most recent file matching our base filename
            const matchingFile = sortedFiles.find(key => 
                key.includes(baseFileName) && key.endsWith('.srt')
            );
            
            if (matchingFile) {
                return matchingFile;
            }
        } catch (error) {
            console.error('Error checking for sorted file:', error);
        }
        
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    throw new Error('Timeout waiting for sorted file');
}
