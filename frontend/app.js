// AWS Configuration
AWS.config.region = 'ca-central-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ca-central-1:9b265c77-c096-4c9d-95a9-c554d90e8493'
});

const s3 = new AWS.S3();
const INPUT_BUCKET = 'sortin-nirajan-0921977';
const OUTPUT_BUCKET = 'sortout-nirajan-0921977';

document.getElementById('uploadButton').addEventListener('click', handleFileUpload);

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

        if (!file.name.endsWith('.txt')) {
            throw new Error('Please select a .txt file.');
        }

        // Read and display original file
        const originalContent = await readFile(file);
        originalContentElement.textContent = originalContent;

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
        
        // Retrieval phase (70-100%)
        statusElement.textContent = 'Retrieving sorted file...';
        updateProgress(70);
        const sortedContent = await getSortedFile(file.name);
        
        // Complete
        updateProgress(100);
        statusElement.textContent = 'Complete!';
        
        // Display content and highlight differences
        sortedContentElement.textContent = sortedContent;
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