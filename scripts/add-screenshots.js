const fs = require('fs');
const path = require('path');

// to run:
// node scripts/add-screenshots.js

// Configuration
const SCREENSHOTS_DIR = 'screenshots';
const README_PATH = 'README.md';
const IMAGE_SECTION_HEADER = '\n## Screenshots\n';

// Read the screenshots directory
function getScreenshots() {
    try {
        return fs.readdirSync(SCREENSHOTS_DIR)
            .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
            .map(file => file.replace(/\s+/g, '%20')) // URL encode spaces
            .sort();
    } catch (error) {
        console.error('Error reading screenshots directory:', error);
        return [];
    }
}

// Generate markdown for images
function generateImageMarkdown(screenshots) {
    return screenshots.map(screenshot => {
        // Create readable title from filename
        const title = screenshot
            .replace(/%20/g, ' ')
            .replace(/\.[^/.]+$/, '')  // Remove extension
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
            
        // Update image path to remove '../' since README is now in root
        const imagePath = `${SCREENSHOTS_DIR}/${screenshot}`;
        
        return `### ${title}\n![${title}](${imagePath})\n`;
    }).join('\n');
}

// Update README with screenshots
function updateReadme() {
    try {
        // Read existing README
        let content = fs.readFileSync(README_PATH, 'utf8');
        
        // Remove existing screenshots section if it exists
        content = content.replace(/## Screenshots[\s\S]*$/, '');
        
        // Get screenshots
        const screenshots = getScreenshots();
        
        if (screenshots.length === 0) {
            console.log('No screenshots found in directory');
            return;
        }
        
        // Add new screenshots section
        const imageSection = IMAGE_SECTION_HEADER + generateImageMarkdown(screenshots);
        content += imageSection;
        
        // Write updated README
        fs.writeFileSync(README_PATH, content);
        console.log(`Added ${screenshots.length} screenshots to README.md`);
        
        // Log all processed screenshots for verification
        console.log('\nProcessed screenshots:');
        screenshots.forEach(screenshot => console.log(`- ${screenshot}`));
        
    } catch (error) {
        console.error('Error updating README:', error);
    }
}

// Run the script
updateReadme(); 