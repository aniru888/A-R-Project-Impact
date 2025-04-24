import { forestEventSystem } from './forestCalcs.js';
import { formatCO2e } from '../utils.js'; // Import formatting utility
import { analytics } from '../analytics.js'; // Import analytics module for tracking

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
    const uploader = document.getElementById('speciesFileUpload');
    const uploadBtn = document.getElementById('uploadSpeciesBtn');
    
    if (uploader && uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            uploader.click();
        });
        
        uploader.addEventListener('change', handleSpeciesFileUpload);
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
        
        // Use FileReader to read the file
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                
                // Detect if it's CSV or JSON
                if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
                    // Parse CSV
                    const speciesData = parseSpeciesCSV(content);
                    handleSpeciesData(speciesData);
                } else if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
                    // Parse JSON
                    const speciesData = JSON.parse(content);
                    handleSpeciesData(Array.isArray(speciesData) ? speciesData : [speciesData]);
                } else {
                    throw new Error('Unsupported file format. Please upload a CSV or JSON file.');
                }
            } catch (error) {
                console.error('Error processing file:', error);
                forestEventSystem.showError(`Error processing species file: ${error.message}`);
            }
        };
        
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            forestEventSystem.showError('Error reading file. Please try again.');
        };
        
        // Read the file
        if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsText(file);
        }
        
    } catch (error) {
        console.error('Error handling file upload:', error);
        forestEventSystem.showError(`File upload error: ${error.message}`);
    }
}

/**
 * Parse CSV data into species objects
 * @param {string} csvData - CSV content
 * @returns {Array<Object>} Array of species objects
 */
function parseSpeciesCSV(csvData) {
    try {
        // Split by line
        const lines = csvData.split(/\r?\n/);
        
        // Get headers
        const headers = lines[0].split(',').map(header => header.trim());
        
        // Parse data rows
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            const values = line.split(',').map(value => value.trim());
            
            // Create object mapping headers to values
            const speciesObj = {};
            
            headers.forEach((header, index) => {
                speciesObj[header] = values[index] || '';
            });
            
            data.push(speciesObj);
        }
        
        return data;
    } catch (error) {
        console.error('Error parsing CSV:', error);
        throw new Error('Invalid CSV format. Please check your file and try again.');
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
