import { forestEventSystem } from './forestCalcs.js';
import { analytics } from '../analytics.js';

// Default species template for CSV import
const SPECIES_CSV_TEMPLATE = `Species Name,Number of Trees,Growth Rate (m³/ha/yr),Wood Density (tdm/m³),BEF,Root-Shoot Ratio,Carbon Fraction,Survival Rate (%)
Pine,400,10,0.42,1.3,0.25,0.47,85
Eucalyptus,400,25,0.55,1.3,0.24,0.47,90
Oak,200,5,0.65,1.4,0.25,0.47,80
Mixed Native,600,8,0.5,1.4,0.25,0.47,85`;

// Species currently loaded
let loadedSpeciesData = null;

// Track whether file upload has been used
let hasUsedFileUpload = false;

// Track initialization state
let initialized = false;

/**
 * Initialize the IO functionality for forest calculator
 */
export function initForestIO() {
    if (initialized) {
        console.log('Forest IO module already initialized');
        return;
    }
    
    console.log('Initializing forest IO module');
    
    try {
        // Ensure event system is initialized
        forestEventSystem.init();
        
        // Setup file upload handlers
        setupSpeciesUploadHandler();
        
        // Setup download template handler
        setupDownloadTemplateHandler();
        
        // Setup export results handler
        setupExportResultsHandler();
        
        // Register with forestEventSystem if needed
        forestEventSystem.registerEvents({
            dataUpdated: (data) => {
                console.log('IO module received data update event:', data?.speciesData?.length || 0, 'species');
                loadedSpeciesData = data?.speciesData;
            }
        });
        
        // Mark as initialized
        initialized = true;
        
        console.log('Forest IO module initialized successfully');
    } catch (error) {
        console.error('Error initializing forest IO module:', error);
        forestEventSystem.showError(`IO initialization error: ${error.message}`);
    }
}

/**
 * Cleanup the forest IO module
 */
export function cleanupForestIO() {
    console.log('Cleaning up forest IO module');
    
    try {
        // Reset module state
        loadedSpeciesData = null;
        hasUsedFileUpload = false;
        initialized = false;
        
        // Clean up event listeners would be handled here if needed
        
        console.log('Forest IO module cleanup complete');
    } catch (error) {
        console.error('Error cleaning up forest IO module:', error);
    }
}

/**
 * Set up the species file upload handler
 */
function setupSpeciesUploadHandler() {
    // Look for both the dedicated uploader and the file input in the drag/drop zone
    const uploader = document.getElementById('speciesFileUpload');
    const fileInput = document.getElementById('speciesFile');
    const uploadBtn = document.getElementById('uploadSpeciesBtn');
    
    // Set up dedicated uploader if it exists
    if (uploader && uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            uploader.click();
        });
        
        uploader.addEventListener('change', handleSpeciesFileUpload);
        console.log('Dedicated species file uploader initialized');
    }
    
    // Also set up the drag/drop zone file input which is always present in the UI
    if (fileInput) {
        fileInput.addEventListener('change', handleSpeciesFileUpload);
        console.log('Species file drag/drop input initialized');
        
        // Add drag and drop functionality to the container
        const dropZone = fileInput.closest('.file-upload');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    // Manually trigger the change event
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                }
            });
            
            console.log('Drag and drop functionality initialized for species upload');
        }
    }
    
    if (!uploader && !fileInput) {
        console.warn('No file upload elements found for species data');
    }
}

/**
 * Handle species file upload
 * @param {Event} event - Upload event
 */
function handleSpeciesFileUpload(event) {
    console.log('File upload detected');
    
    try {
        const file = event.target.files[0];
        
        if (!file) {
            console.log('No file selected');
            return;
        }
        
        // Track file upload usage
        analytics.trackEvent('forest_species_upload', {
            fileType: file.type,
            fileSize: file.size
        });
        
        hasUsedFileUpload = true;
        
        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
        
        // Show loading indicator
        forestEventSystem.trigger('showLoading', 'Processing species data...');
        
        // Use FileReader to read the file
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                console.log(`File content loaded, length: ${content.length} characters`);
                
                // Detect if it's CSV or JSON
                if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
                    console.log('Detected CSV file, parsing...');
                    // Parse CSV
                    const speciesData = parseSpeciesCSV(content);
                    console.log('CSV parsing successful:', speciesData);
                    handleSpeciesData(speciesData);
                } else if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
                    console.log('Detected JSON file, parsing...');
                    // Parse JSON
                    const speciesData = JSON.parse(content);
                    console.log('JSON parsing successful:', speciesData);
                    handleSpeciesData(Array.isArray(speciesData) ? speciesData : [speciesData]);
                } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                    console.log('Excel file detected. Converting to CSV first...');
                    forestEventSystem.showError('Excel files are not directly supported. Please save as CSV and try again.');
                    forestEventSystem.trigger('hideLoading');
                } else {
                    throw new Error('Unsupported file format. Please upload a CSV file with species data.');
                }
            } catch (error) {
                console.error('Error processing file:', error);
                forestEventSystem.showError(`Error processing species file: ${error.message}. Please check the file format.`);
                forestEventSystem.trigger('hideLoading');
            }
        };
        
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            forestEventSystem.showError('Error reading file. Please try again with a different file.');
            forestEventSystem.trigger('hideLoading');
        };
        
        // Read the file
        reader.readAsText(file);
        
    } catch (error) {
        console.error('Error handling file upload:', error);
        forestEventSystem.showError(`File upload error: ${error.message}`);
        forestEventSystem.trigger('hideLoading');
    }
}

/**
 * Parse CSV data into species objects
 * @param {string} csvData - CSV content
 * @returns {Array<Object>} Array of species objects
 */
function parseSpeciesCSV(csvData) {
    try {
        console.log('Starting CSV parsing, content length:', csvData.length);
        
        // Split by line with support for different line endings
        const lines = csvData.split(/\r?\n/);
        console.log(`CSV has ${lines.length} lines`);
        
        if (lines.length < 2) {
            throw new Error('CSV file must contain a header row and at least one data row.');
        }
        
        // Get headers and normalize them
        const headerLine = lines[0].trim();
        console.log('Header row:', headerLine);
        
        // Handle both comma and semicolon separators
        const separator = headerLine.includes(',') ? ',' : (headerLine.includes(';') ? ';' : ',');
        const headers = headerLine.split(separator).map(header => header.trim());
        
        if (headers.length < 2) {
            throw new Error(`CSV headers are invalid. Found: ${headerLine}`);
        }
        
        console.log(`Found ${headers.length} headers:`, headers);
        
        // Check for required headers
        const requiredHeaders = ['Species Name', 'Number of Trees'];
        for (const requiredHeader of requiredHeaders) {
            // Check for exact match or case-insensitive match
            const headerExists = headers.some(h => 
                h === requiredHeader || 
                h.toLowerCase() === requiredHeader.toLowerCase()
            );
            
            if (!headerExists) {
                throw new Error(`CSV is missing required header: ${requiredHeader}`);
            }
        }
        
        // Parse data rows
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            const values = line.split(separator).map(value => value.trim());
            
            if (values.length !== headers.length) {
                console.warn(`Line ${i + 1} has ${values.length} values but should have ${headers.length}. Line: ${line}`);
                // Try to fix by adding empty values if there are too few
                while (values.length < headers.length) values.push('');
                // Or truncate if too many
                if (values.length > headers.length) values.length = headers.length;
            }
            
            // Create object mapping headers to values
            const speciesObj = {};
            
            headers.forEach((header, index) => {
                // Use the header as is, looking for exact header name
                speciesObj[header] = values[index] || '';
            });
            
            data.push(speciesObj);
        }
        
        console.log(`Successfully parsed ${data.length} species records`);
        
        if (data.length === 0) {
            throw new Error('No valid species data found in CSV file.');
        }
        
        // Validate species data
        data.forEach((species, index) => {
            // Ensure Number of Trees is a number
            if (species['Number of Trees']) {
                const trees = parseInt(species['Number of Trees']);
                if (isNaN(trees)) {
                    console.warn(`Invalid number of trees for species at row ${index + 2}: ${species['Number of Trees']}`);
                } else {
                    species['Number of Trees'] = trees.toString();
                }
            }
        });
        
        return data;
    } catch (error) {
        console.error('Error parsing CSV:', error);
        throw new Error(`Invalid CSV format: ${error.message}`);
    }
}

/**
 * Handle processed species data
 * @param {Array<Object>} speciesData - Processed species data
 */
function handleSpeciesData(speciesData) {
    try {
        // Validate the data
        if (!Array.isArray(speciesData) || speciesData.length === 0) {
            throw new Error('No valid species data found in the file.');
        }
        
        // Check if we have the minimum required fields
        const requiredFields = ['Species Name', 'Number of Trees'];
        
        const missingFields = speciesData.some(species => {
            return requiredFields.some(field => !species[field]);
        });
        
        if (missingFields) {
            console.warn('Some species are missing required fields');
        }
        
        // Store the species data
        loadedSpeciesData = speciesData;
        
        // Use the event system to display the species list and update factors
        forestEventSystem.trigger('displaySpeciesList', speciesData);
        forestEventSystem.trigger('updateConversionFactors', speciesData[0]);
        forestEventSystem.trigger('updateSiteFactors', speciesData[0]);
        
        // Show multi-species mode message
        const multiSpeciesModeMessage = document.getElementById('multiSpeciesModeMessage');
        if (multiSpeciesModeMessage) {
            multiSpeciesModeMessage.classList.remove('hidden');
            multiSpeciesModeMessage.textContent = `Multi-species mode active with ${speciesData.length} species loaded`;
        }
        
        // Notify the event system about the new data
        forestEventSystem.dataUpdated({ speciesData });
        
        console.log('Successfully loaded and processed', speciesData.length, 'species');
    } catch (error) {
        console.error('Error handling species data:', error);
        forestEventSystem.showError(`Error processing species data: ${error.message}`);
    }
}

/**
 * Get loaded species data
 * @returns {Array<Object>|null} Loaded species data or null
 */
export function getLoadedSpeciesData() {
    return loadedSpeciesData;
}

/**
 * Check if multi-species mode is active
 * @returns {boolean} True if multi-species mode is active
 */
export function isMultiSpeciesMode() {
    return Array.isArray(loadedSpeciesData) && loadedSpeciesData.length > 0;
}

/**
 * Set up the download template handler
 */
function setupDownloadTemplateHandler() {
    const downloadBtn = document.getElementById('downloadTemplateBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            downloadSpeciesTemplate();
        });
    }
}

/**
 * Download species template file
 */
function downloadSpeciesTemplate() {
    try {
        // Create a blob with the CSV template
        const blob = new Blob([SPECIES_CSV_TEMPLATE], { type: 'text/csv' });
        
        // Create a temporary download link
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'species_template.csv';
        
        // Add to document, click, and remove
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Track template download
        analytics.trackEvent('forest_template_download', {
            timestamp: new Date().toISOString()
        });
        
        console.log('Template download initiated');
    } catch (error) {
        console.error('Error downloading template:', error);
        forestEventSystem.showError(`Error downloading template: ${error.message}`);
    }
}

/**
 * Set up the export results handler
 */
function setupExportResultsHandler() {
    const exportBtn = document.getElementById('exportResultsBtn');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportForestResults();
        });
    }
}

/**
 * Export forest results to CSV
 */
function exportForestResults() {
    try {
        // Get the results table
        const resultsTable = document.getElementById('resultsTableForest');
        
        if (!resultsTable) {
            console.error('Results table not found');
            forestEventSystem.showError('No results available to export.');
            return;
        }
        
        // Create CSV content
        let csvContent = '';
        
        // Add headers
        const headerRow = resultsTable.querySelector('thead tr');
        if (headerRow) {
            const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim());
            csvContent += headers.join(',') + '\n';
        }
        
        // Add data rows
        const dataRows = resultsTable.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
            csvContent += cells.join(',') + '\n';
        });
        
        // Create a blob and download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'forest_sequestration_results.csv';
        
        // Add to document, click, and remove
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Track export
        analytics.trackEvent('forest_results_export', {
            timestamp: new Date().toISOString(),
            format: 'csv'
        });
        
        console.log('Results export initiated');
    } catch (error) {
        console.error('Error exporting results:', error);
        forestEventSystem.showError(`Error exporting results: ${error.message}`);
    }
}
