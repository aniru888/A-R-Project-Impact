import { displayErrorMessage, clearErrorMessage, validateFormInput, setInputFeedback } from '../domUtils.js';
import { calculateSequestration, calculateSequestrationMultiSpecies, calculateForestCostAnalysis } from './forestCalcs.js';
import { formatNumber, formatCO2e, exportToCsv } from '../utils.js';
import { createChart } from '../domUtils.js'; // Ensure createChart is imported
import { trackEvent } from '../analytics.js'; // Import trackEvent

let sequestrationChartInstance = null;

/**
 * Initialize forest calculator DOM elements and event listeners
 * @param {Object} options - Configuration options
 */
export function initForestDOM(options = {}) {
    // Initialize form validation
    setupForestFormValidation();
    
    // Set up event listeners
    document.getElementById('calculateForestBtn').addEventListener('click', handleForestCalculation);
    document.getElementById('resetForestBtn').addEventListener('click', resetForestForm);
    document.getElementById('speciesSelect').addEventListener('change', handleSpeciesChange);
    document.getElementById('exportForestResultsBtn').addEventListener('click', exportForestResults);
    document.getElementById('forestFileUploadBtn').addEventListener('click', () => document.getElementById('forestSpeciesFile').click());
    document.getElementById('forestSpeciesFile').addEventListener('change', handleSpeciesFileUpload);
    
    // Initialize tooltips
    initializeForestTooltips();
    
    // Setup additional conditional form elements
    setupConditionalFormElements();
    
    // Setup forest calculation listeners
    setupForestCalculationListeners();
    
    // Setup forest reset listener
    setupForestResetListener();
    
    console.log('Forest DOM module initialized');
}

/**
 * Setup form validation for forest calculator inputs
 */
function setupForestFormValidation() {
    const forestForm = document.getElementById('forestCalcForm');
    
    // Define validation rules for each input
    const validationRules = {
        'projectDuration': { min: 1, max: 100, required: true, type: 'number', message: 'Duration must be between 1-100 years' },
        'plantingDensity': { min: 100, max: 10000, required: true, type: 'number', message: 'Density must be between 100-10000 trees/ha' },
        'projectArea': { min: 0.1, max: 1000000, required: true, type: 'number', message: 'Area must be at least 0.1 ha' },
        'growthRate': { min: 1, max: 30, required: false, type: 'number', message: 'Growth rate must be between 1-30 m³/ha/yr' },
        'woodDensity': { min: 0.1, max: 1.5, required: false, type: 'number', message: 'Wood density must be between 0.1-1.5 tdm/m³' },
        'bef': { min: 1.0, max: 3.0, required: false, type: 'number', message: 'BEF must be between 1.0-3.0' },
        'rsr': { min: 0.1, max: 0.8, required: false, type: 'number', message: 'Root-Shoot Ratio must be between 0.1-0.8' },
        'carbonFraction': { min: 0.4, max: 0.6, required: false, type: 'number', message: 'Carbon Fraction must be between 0.4-0.6' },
        'survivalRate': { min: 50, max: 100, required: false, type: 'number', message: 'Survival Rate must be between 50-100%' },
        'projectCost': { min: 0, max: null, required: false, type: 'number', message: 'Project cost must be a positive number' }
    };
    
    // Add input event listeners to all form fields
    const inputFields = forestForm.querySelectorAll('input[type="number"], input[type="text"], select');
    inputFields.forEach(input => {
        const fieldName = input.id;
        const rules = validationRules[fieldName];
        
        if (rules) {
            input.addEventListener('input', () => {
                validateFormInput(input, rules);
            });
            
            // Initial validation
            validateFormInput(input, rules);
        }
    });
}

/**
 * Handle species selection change
 * @param {Event} event - Change event
 */
function handleSpeciesChange(event) {
    const species = event.target.value;
    const growthRateField = document.getElementById('growthRate');
    const woodDensityField = document.getElementById('woodDensity');
    const befField = document.getElementById('bef');
    const rsrField = document.getElementById('rsr');
    
    // Track species selection in analytics
    if (window.trackAnalytics) {
        window.trackAnalytics('forest_species_selected', {
            species: species,
            timestamp: new Date().toISOString()
        });
    }
    
    // Set default values based on species
    switch (species) {
        case 'eucalyptus_fast':
            growthRateField.value = '18';
            woodDensityField.value = '0.45';
            befField.value = '1.5';
            rsrField.value = '0.24';
            break;
        case 'teak_moderate':
            growthRateField.value = '10';
            woodDensityField.value = '0.68';
            befField.value = '1.4';
            rsrField.value = '0.27';
            break;
        case 'native_slow':
            growthRateField.value = '5';
            woodDensityField.value = '0.53';
            befField.value = '1.6';
            rsrField.value = '0.32';
            break;
        default:
            growthRateField.value = '10';
            woodDensityField.value = '0.5';
            befField.value = '1.5';
            rsrField.value = '0.25';
    }
    
    // Trigger validation to update any feedback
    const fields = [growthRateField, woodDensityField, befField, rsrField];
    fields.forEach(field => field.dispatchEvent(new Event('input')));
}

/**
 * Handle forest calculation button click
 */
function handleForestCalculation() {
    try {
        // Track calculation button click
        trackEvent('forest_calculation_button_click', { timestamp: new Date().toISOString() });

        // Clear previous errors
        clearErrorMessage('forestErrorMessage');
        
        // Get form data
        const formData = getForestFormData();
        
        // Validate all inputs before calculation
        if (!validateAllForestInputs(formData)) {
            return; // Stop if validation fails
        }
        
        // Track forest calculation in analytics
        if (window.trackAnalytics) {
            window.trackAnalytics('forest_calculation_performed', {
                species: formData.species,
                duration: formData.projectDuration,
                area: formData.projectArea,
                density: formData.plantingDensity,
                timestamp: new Date().toISOString()
            });
        }
        
        // Calculate results
        let results;
        
        // Check if we have multi-species data
        if (window.speciesData && window.speciesData.length > 0) {
            // Call multi-species calculation
            const multiResults = calculateSequestrationMultiSpecies(formData, window.speciesData);
            results = multiResults.totalResults; // Use the total results for display
            
            // Store species results for possible detailed view
            window.speciesResults = multiResults.speciesResults;
            
            // Enable species details button
            document.getElementById('showSpeciesDetailsBtn').classList.remove('hidden');
        } else {
            // Call single species calculation
            results = calculateSequestration(formData);
        }
        
        // Calculate cost metrics if project cost is provided
        let costAnalysis = null;
        if (formData.projectCost && parseFloat(formData.projectCost) > 0) {
            costAnalysis = calculateForestCostAnalysis(results, parseFloat(formData.projectCost));
        }
        
        // Display results
        displayForestResults(results, costAnalysis);
        
        // Show the results section
        document.getElementById('forestResultsSection').classList.remove('hidden');
        document.getElementById('forestResultsSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Calculation error:', error);
        displayErrorMessage('forestErrorMessage', `Error calculating results: ${error.message}`);
    }
}

/**
 * Get and validate all form inputs
 * @returns {Object} Form data object with all input values
 */
function getForestFormData() {
    return {
        projectDuration: document.getElementById('projectDuration').value,
        plantingDensity: document.getElementById('plantingDensity').value,
        projectArea: document.getElementById('projectArea').value,
        species: document.getElementById('speciesSelect').value,
        growthRate: document.getElementById('growthRate').value,
        woodDensity: document.getElementById('woodDensity').value,
        bef: document.getElementById('bef').value,
        rsr: document.getElementById('rsr').value,
        carbonFraction: document.getElementById('carbonFraction').value,
        survivalRate: document.getElementById('survivalRate').value,
        projectCost: document.getElementById('projectCost').value,
        siteQuality: document.getElementById('siteQuality').value,
        avgRainfall: document.getElementById('avgRainfall').value,
        soilType: document.getElementById('soilType').value
    };
}

/**
 * Validate all forest calculator inputs
 * @param {Object} formData - Form data to validate
 * @returns {boolean} True if all inputs are valid
 */
function validateAllForestInputs(formData) {
    const requiredFields = ['projectDuration', 'plantingDensity', 'projectArea'];
    let isValid = true;
    
    // Check required fields
    for (const field of requiredFields) {
        const value = formData[field];
        if (!value || isNaN(parseFloat(value))) {
            displayErrorMessage('forestErrorMessage', `Please enter a valid value for ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
            isValid = false;
            
            // Add visual feedback on the field
            setInputFeedback(document.getElementById(field), false, 'This field is required');
        }
    }
    
    return isValid;
}

/**
 * Display forest calculation results
 * @param {Object} results - Calculation results object containing totalResults and speciesResults
 * @param {HTMLElement} resultsSectionElement - Results section element
 * @param {HTMLElement} resultsBodyElement - Results table body element
 * @param {HTMLElement} chartElement - Chart canvas element
 * @param {HTMLElement} errorMessageElement - Error message element
 */
export function displayForestResults(results, resultsSectionElement, resultsBodyElement, chartElement, errorMessageElement) {
    try {
        console.log('Displaying forest results:', results);
        
        // Ensure elements exist
        if (!resultsSectionElement) {
            console.error('Results section element not found');
            // Try to get it by ID as fallback
            resultsSectionElement = document.getElementById('resultsSectionForest');
            console.log('Attempted fallback to get results section by ID:', resultsSectionElement ? 'Found' : 'Not found');
            if (!resultsSectionElement) return;
        }

        if (!resultsBodyElement) {
            console.error('Results body element not found');
            // Try to get it by ID as fallback
            resultsBodyElement = document.getElementById('resultsBodyForest');
            console.log('Attempted fallback to get results body by ID:', resultsBodyElement ? 'Found' : 'Not found');
            if (!resultsBodyElement) return;
        }

        // Clear previous results
        resultsBodyElement.innerHTML = '';

        // Get the actual results array
        const resultsData = results.totalResults || results;
        
        if (!Array.isArray(resultsData) || resultsData.length === 0) {
            console.error('Invalid results data:', resultsData);
            if (errorMessageElement) {
                showForestError('No valid calculation results to display', errorMessageElement);
            }
            return;
        }

        // Get the final year results for summary
        const finalYear = resultsData[resultsData.length - 1];
        const totalNetCO2Element = document.getElementById('totalNetCO2e');
        
        if (totalNetCO2Element) {
            totalNetCO2Element.textContent = `${finalYear.cumulativeNetCO2e.toLocaleString()} tCO₂e`;
        }
        
        // Update the results table with all years data
        resultsData.forEach(result => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${result.year}</td>
                <td>${result.age}</td>
                <td>${result.volumeIncrement.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                <td>${result.netAnnualCO2e.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                <td>${result.cumulativeNetCO2e.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
            `;
            
            resultsBodyElement.appendChild(row);
        });
        
        // Update the chart if chart element exists
        if (chartElement) {
            updateSequestrationChart(resultsData, chartElement.id);
        }
        
        // Show the results section
        resultsSectionElement.classList.remove('hidden');
        
        // Scroll to results section after a short delay
        setTimeout(() => {
            resultsSectionElement.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
    } catch (error) {
        console.error('Error displaying results:', error);
        if (errorMessageElement) {
            showForestError(`Error displaying results: ${error.message}`, errorMessageElement);
        }
    }
}

/**
 * Updates the sequestration chart with new data.
 * @param {Array} annualData - Array of annual sequestration data.
 * @param {string} canvasId - ID of the canvas element
 */
function updateSequestrationChart(annualData, canvasId = 'sequestrationChart') {
    try {
        console.log('Updating sequestration chart with data for', annualData.length, 'years');
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.error('Chart canvas element not found:', canvasId);
            return;
        }

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }

        const labels = annualData.map(d => `Year ${d.year}`);
        const cumulativeData = annualData.map(d => d.cumulativeNetCO2e);
        const annualDataPoints = annualData.map(d => d.netAnnualCO2e);

        // Destroy existing chart if it exists
        if (window.sequestrationChart instanceof Chart) {
            window.sequestrationChart.destroy();
        }

        // Create new chart
        window.sequestrationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cumulative Net CO₂e Sequestered (tCO₂e)',
                        data: cumulativeData,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        type: 'line',
                        fill: true,
                        yAxisID: 'yCumulative',
                        tension: 0.1
                    },
                    {
                        label: 'Net Annual CO₂e Sequestered (tCO₂e/yr)',
                        data: annualDataPoints,
                        borderColor: 'rgb(255, 159, 64)',
                        backgroundColor: 'rgba(255, 159, 64, 0.5)',
                        type: 'bar',
                        yAxisID: 'yAnnual',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Project Year'
                        }
                    },
                    yCumulative: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Cumulative Net CO₂e (tCO₂e)'
                        },
                        beginAtZero: true
                    },
                    yAnnual: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Annual Net CO₂e (tCO₂e/yr)'
                        },
                        grid: {
                            drawOnChartArea: false, 
                        },
                        beginAtZero: true
                    }
                }
            }
        });
        
        console.log('Chart successfully created');
    } catch (error) {
        console.error('Error creating chart:', error);
    }
}

/**
 * Display error message for forest calculator
 * @param {string} message - Error message
 * @param {HTMLElement} errorElement - Error element to use (optional)
 */
export function showForestError(message, errorElement = null) {
    const errorDiv = errorElement || document.getElementById('errorMessageForest');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        // Ensure error is visible
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Fallback if element not found
        console.error('Forest calculator error:', message);
        alert(`Error: ${message}`);
    }
}

/**
 * Clear forest error messages
 */
export function clearForestErrors() {
    const errorDiv = document.getElementById('errorMessageForest');
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.classList.add('hidden');
    }
}

/**
 * Reset forest calculator form
 */
function resetForestForm() {
    // Track form reset event
    trackEvent('forest_form_reset', { timestamp: new Date().toISOString() });

    // Clear the form
    document.getElementById('forestCalcForm').reset();
    
    // Reset to default values
    document.getElementById('speciesSelect').value = 'teak_moderate';
    document.getElementById('projectDuration').value = '10';
    document.getElementById('plantingDensity').value = '1600';
    document.getElementById('projectArea').value = '10';
    document.getElementById('growthRate').value = '10';
    document.getElementById('woodDensity').value = '0.5';
    document.getElementById('bef').value = '1.5';
    document.getElementById('rsr').value = '0.25';
    document.getElementById('carbonFraction').value = '0.47';
    document.getElementById('survivalRate').value = '85';
    document.getElementById('projectCost').value = '';
    
    // Clear errors
    clearErrorMessage('forestErrorMessage');
    
    // Clear any validation feedback
    const inputs = document.getElementById('forestCalcForm').querySelectorAll('input, select');
    inputs.forEach(input => {
        input.classList.remove('border-red-500', 'border-green-500');
        const feedbackEl = document.getElementById(`${input.id}-feedback`);
        if (feedbackEl) feedbackEl.textContent = '';
    });
    
    // Hide results section
    document.getElementById('forestResultsSection').classList.add('hidden');
    
    // Reset species data 
    window.speciesData = null;
    window.speciesResults = null;
    
    // Hide species details button
    document.getElementById('showSpeciesDetailsBtn').classList.add('hidden');
    
    // Reset file input 
    const fileInput = document.getElementById('forestSpeciesFile');
    if (fileInput) fileInput.value = '';
    
    // Update file upload status
    const uploadStatus = document.getElementById('speciesFileStatus');
    if (uploadStatus) {
        uploadStatus.textContent = 'No file selected';
        uploadStatus.classList.remove('text-green-500');
        uploadStatus.classList.add('text-gray-500');
    }
}

/**
 * Handle species file upload
 * @param {Event} event - Change event
 */
function handleSpeciesFileUpload(event) {
    const file = event.target.files[0];
    const uploadStatus = document.getElementById('speciesFileStatus');
    
    if (!file) {
        uploadStatus.textContent = 'No file selected';
        uploadStatus.classList.remove('text-green-500');
        uploadStatus.classList.add('text-gray-500');
        window.speciesData = null;
        return;
    }
    
    // Track file upload attempt
    trackEvent('forest_file_upload_attempt', {
        filename: file.name,
        filesize: file.size,
        filetype: file.type,
        timestamp: new Date().toISOString()
    });
    
    // Check file type (.csv or .xlsx)
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        uploadStatus.textContent = 'Invalid file type. Please upload a CSV or Excel file.';
        uploadStatus.classList.remove('text-green-500');
        uploadStatus.classList.add('text-red-500');
        event.target.value = '';
        window.speciesData = null;
        
        // Track invalid file upload
        trackEvent('forest_file_upload_error', {
            error_type: 'invalid_file_type',
            filename: file.name,
            filetype: fileExtension,
            timestamp: new Date().toISOString()
        });
        return;
    }
    
    // Process the file based on type
    if (fileExtension === '.csv') {
        processCsvFile(file);
    } else {
        // For Excel files, we need additional library
        // This would require implementation of Excel processing or conversion to CSV
        uploadStatus.textContent = 'Excel files will be supported in a future update. Please use CSV format.';
        uploadStatus.classList.remove('text-green-500');
        uploadStatus.classList.add('text-yellow-500');
        event.target.value = '';
        window.speciesData = null;
    }
}

/**
 * Process CSV file upload for species data
 * @param {File} file - The CSV file
 */
function processCsvFile(file) {
    const reader = new FileReader();
    const uploadStatus = document.getElementById('speciesFileStatus');
    
    reader.onload = function(e) {
        try {
            const contents = e.target.result;
            const lines = contents.split(/\r?\n/);
            
            // Check if file has content
            if (lines.length < 2) {
                throw new Error('File appears to be empty or has no data rows');
            }
            
            // Parse header and validate required columns
            const headers = lines[0].split(',').map(h => h.trim());
            const requiredColumns = ['Species Name'];
            
            // Check for required columns
            for (const col of requiredColumns) {
                if (!headers.includes(col)) {
                    throw new Error(`Missing required column: ${col}`);
                }
            }
            
            // Parse data rows
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue; // Skip empty lines
                
                const values = lines[i].split(',').map(v => v.trim());
                
                // Create object mapping headers to values
                const rowObj = {};
                headers.forEach((header, index) => {
                    rowObj[header] = values[index] || '';
                });
                
                // Only add rows that have a species name
                if (rowObj['Species Name']) {
                    data.push(rowObj);
                }
            }
            
            // Update global species data
            window.speciesData = data;
            
            // Update status
            uploadStatus.textContent = `File loaded successfully: ${data.length} species`;
            uploadStatus.classList.remove('text-red-500', 'text-gray-500');
            uploadStatus.classList.add('text-green-500');
            
        } catch (error) {
            console.error('Error processing CSV:', error);
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadStatus.classList.remove('text-green-500', 'text-gray-500');
            uploadStatus.classList.add('text-red-500');
            window.speciesData = null;
        }
    };
    
    reader.onerror = function() {
        uploadStatus.textContent = 'Error reading the file';
        uploadStatus.classList.remove('text-green-500', 'text-gray-500');
        uploadStatus.classList.add('text-red-500');
        window.speciesData = null;
    };
    
    reader.readAsText(file);
}

/**
 * Export forest results to CSV
 */
function exportForestResults() {
    // Track CSV export event
    trackEvent('forest_csv_export', { timestamp: new Date().toISOString() });

    // Get the results table
    const table = document.getElementById('forestResultsTable');
    
    // Check if there are results to export
    if (!table || table.rows.length <= 1) {
        displayErrorMessage('forestErrorMessage', 'No results to export');
        return;
    }
    
    // Track CSV export in analytics
    if (window.trackAnalytics) {
        window.trackAnalytics('forest_csv_export', {
            rows_exported: table.querySelectorAll('tbody tr').length,
            timestamp: new Date().toISOString()
        });
    }
    
    // Extract headers
    const headers = [];
    const headerRow = table.querySelector('thead tr');
    headerRow.querySelectorAll('th').forEach(th => {
        headers.push(th.textContent);
    });
    
    // Extract data
    const data = [];
    table.querySelectorAll('tbody tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => {
            row.push(td.textContent);
        });
        data.push(row);
    });
    
    // Call the export function from utils.js
    exportToCsv('forest_carbon_results.csv', headers, data);
}

/**
 * Initialize tooltips for forest calculator
 */
function initializeForestTooltips() {
    // Define tooltip content for each input
    const tooltips = {
        'projectDuration': 'Duration of the project in years (1-100)',
        'plantingDensity': 'Number of trees planted per hectare',
        'projectArea': 'Total area of the project in hectares',
        'speciesSelect': 'Select tree species or type',
        'growthRate': 'Mean Annual Increment (MAI) in m³/ha/yr',
        'woodDensity': 'Wood basic density in tonnes dry matter per m³',
        'bef': 'Biomass Expansion Factor for converting stem biomass to above-ground biomass',
        'rsr': 'Root-to-Shoot Ratio for estimating below-ground biomass',
        'carbonFraction': 'Carbon fraction of dry matter (IPCC default is 0.47)',
        'survivalRate': 'Expected percentage of trees that will survive',
        'projectCost': 'Total project cost for economic analysis (optional)',
        'siteQuality': 'Quality of the planting site',
        'avgRainfall': 'Average annual rainfall at the site',
        'soilType': 'Soil condition at the planting site'
    };
    
    // Add tooltip listeners to each input with a tooltip
    Object.keys(tooltips).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Set aria-describedby attribute
            const tooltipId = `tooltip-${id}`;
            element.setAttribute('aria-describedby', tooltipId);
            
            // Create tooltip element if needed
            let tooltipElement = document.getElementById(tooltipId);
            if (!tooltipElement) {
                tooltipElement = document.createElement('div');
                tooltipElement.id = tooltipId;
                tooltipElement.classList.add('tooltip', 'hidden');
                tooltipElement.setAttribute('role', 'tooltip');
                tooltipElement.textContent = tooltips[id];
                
                // Add tooltip to DOM
                const formGroup = element.closest('.form-group');
                if (formGroup) {
                    formGroup.appendChild(tooltipElement);
                } else {
                    element.parentNode.appendChild(tooltipElement);
                }
            }
            
            // Add event listeners
            element.addEventListener('mouseenter', () => {
                tooltipElement.classList.remove('hidden');
            });
            
            element.addEventListener('mouseleave', () => {
                tooltipElement.classList.add('hidden');
            });
            
            element.addEventListener('focus', () => {
                tooltipElement.classList.remove('hidden');
            });
            
            element.addEventListener('blur', () => {
                tooltipElement.classList.add('hidden');
            });
        }
    });
}

/**
 * Setup conditional form elements that should be shown/hidden based on other inputs
 */
function setupConditionalFormElements() {
    // Show advanced options toggle
    const advancedToggle = document.getElementById('toggleAdvancedOptions');
    const advancedSection = document.getElementById('advancedForestOptions');
    
    if (advancedToggle && advancedSection) {
        advancedToggle.addEventListener('click', () => {
            const isVisible = !advancedSection.classList.contains('hidden');
            
            if (isVisible) {
                advancedSection.classList.add('hidden');
                advancedToggle.textContent = 'Show Advanced Options';
            } else {
                advancedSection.classList.remove('hidden');
                advancedToggle.textContent = 'Hide Advanced Options';
                
                // Smooth scroll to show the advanced section
                advancedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    
    // Project cost section toggle
    const showCostToggle = document.getElementById('toggleCostInput');
    const costInputs = document.getElementById('projectCostSection');
    
    if (showCostToggle && costInputs) {
        showCostToggle.addEventListener('change', () => {
            if (showCostToggle.checked) {
                costInputs.classList.remove('hidden');
            } else {
                costInputs.classList.add('hidden');
            }
        });
    }
}

/**
 * Setup forest calculation listeners
 */
function setupForestCalculationListeners() {
    const calculateButton = document.getElementById('calculate-forest-impact');
    if (calculateButton) {
        calculateButton.addEventListener('click', function() {
            // Track calculation attempt in analytics
            if (window.trackAnalytics) {
                window.trackAnalytics('forest_calculation_initiated', {
                    timestamp: new Date().toISOString()
                });
            }
            
            if (validateForestForm()) {
                calculateForestImpact();
                
                // Track successful calculation in analytics
                if (window.trackAnalytics) {
                    window.trackAnalytics('forest_calculation_completed', {
                        timestamp: new Date().toISOString()
                    });
                }
            } else {
                // Track failed calculation in analytics
                if (window.trackAnalytics) {
                    window.trackAnalytics('forest_calculation_failed_validation', {
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }
}

/**
 * Setup forest reset listener
 */
function setupForestResetListener() {
    const resetButton = document.getElementById('reset-forest-form');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            resetForestForm();
            
            // Track form reset in analytics
            if (window.trackAnalytics) {
                window.trackAnalytics('forest_form_reset', {
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
}

// Export functions for potential use in other modules
export {
    initForestDOM,
    handleForestCalculation,
    resetForestForm,
    handleSpeciesFileUpload,
    exportForestResults
};
