import { displayErrorMessage, clearErrorMessage, validateFormInput, setInputFeedback } from '../domUtils.js';
import { calculateSequestration, calculateSequestrationMultiSpecies, calculateForestCostAnalysis, parseNumberWithCommas } from './forestCalcs.js';
import { formatNumber, formatCO2e, exportToCsv } from '../utils.js';
import { createChart } from '../domUtils.js'; // Ensure createChart is imported
import { analytics } from '../analytics.js'; // Import analytics as a module

// Ensure consistent event tracking that won't break functionality
function trackEvent(eventName, eventData = {}) {
    try {
        if (analytics && typeof analytics.trackEvent === 'function') {
            analytics.trackEvent(eventName, eventData);
        }
    } catch (error) {
        console.error('Error tracking event:', error);
    }
}

// Keep track of the chart instance globally within this module
let sequestrationChartInstance = null;

/**
 * Reset forest charts (destroy if exists)
 */
export function resetForestCharts() {
    if (sequestrationChartInstance) {
        console.log("Destroying existing forest chart instance.");
        sequestrationChartInstance.destroy();
        sequestrationChartInstance = null;
    }
     // Clear canvas content as fallback
     const canvas = document.getElementById('sequestrationChart');
     if (canvas) {
         const ctx = canvas.getContext('2d');
         ctx.clearRect(0, 0, canvas.width, canvas.height);
     }
}


/**
 * Initialize forest calculator DOM elements and event listeners
 * @param {Object} options - Configuration options
 */
export function initForestDOM(options = {}) {
    // Initialize form validation
    setupForestFormValidation();
    
    // Initialize tooltips
    initializeForestTooltips();
    
    // Setup additional conditional form elements
    setupConditionalFormElements();
    
    // Only set up event listeners if the forestMain module isn't handling them
    if (options.setupEventListeners !== false) {
        console.log('Setting up event listeners from forestDOM module');
        // Set up event listeners
        document.getElementById('calculateForestBtn')?.addEventListener('click', handleForestCalculation);
        document.getElementById('resetForestBtn')?.addEventListener('click', resetForestForm);
        document.getElementById('speciesSelect')?.addEventListener('change', handleSpeciesChange);
        document.getElementById('exportForestResultsBtn')?.addEventListener('click', exportForestResults);
        
        // File upload handlers
        const fileUploadBtn = document.getElementById('forestFileUploadBtn');
        const speciesFileInput = document.getElementById('forestSpeciesFile');
        
        if (fileUploadBtn && speciesFileInput) {
            fileUploadBtn.addEventListener('click', () => speciesFileInput.click());
            speciesFileInput.addEventListener('change', handleSpeciesFileUpload);
        }
    } else {
        console.log('Event listeners will be handled by forestMain module');
    }
    
    console.log('Forest DOM module initialized');
}

/**
 * Handle forest calculation request (used when called directly from DOM)
 * This function is needed for the DOM-based event listener approach
 */
function handleForestCalculation(event) {
    console.log('Forest calculation handler in forestDOM called');
    event.preventDefault();

    // If window.forestCalculator exists, delegate to its handler
    if (window.forestCalculator && typeof window.forestCalculator.handleForestFormSubmit === 'function') {
        window.forestCalculator.handleForestFormSubmit(event);
    } else {
        console.error('Forest calculator not initialized properly, cannot proceed with calculation');
        showForestError('System initialization error. Please refresh the page and try again.');
    }
}

/**
 * Reset forest form (used when called directly from DOM)
 */
function resetForestForm() {
    console.log('Forest reset handler in forestDOM called');
    
    // If window.forestCalculator exists, delegate to its handler
    if (window.forestCalculator && typeof window.forestCalculator.resetForestCalculator === 'function') {
        window.forestCalculator.resetForestCalculator();
    } else {
        // Fallback reset functionality
        const form = document.getElementById('calculatorForm');
        if (form) form.reset();
        
        const resultsSection = document.getElementById('resultsSectionForest');
        if (resultsSection) resultsSection.classList.add('hidden');
        
        clearForestErrors();
        resetForestCharts();
    }
}

/**
 * Export forest results to desired format
 */
function exportForestResults() {
    console.log('Forest export handler in forestDOM called');
    
    // Get results from the table
    const table = document.getElementById('resultsTableForest');
    if (!table) {
        console.error('Results table not found');
        return;
    }
    
    // Convert table to CSV and download
    try {
        exportToCsv(table, 'forest_sequestration_results.csv');
    } catch (error) {
        console.error('Error exporting results:', error);
        showForestError('Error exporting results: ' + error.message);
    }
}

/**
 * Setup form validation for forest calculator inputs
 */
function setupForestFormValidation() {
    const forestForm = document.getElementById('calculatorForm');
    
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
    if (forestForm) {
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
    } else {
        console.error('Calculator form not found with ID: calculatorForm');
    }
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
 * Get and validate all form inputs from the Forest tab.
 * Shows error messages directly on the UI.
 * @param {HTMLElement} errorDiv - The element to display general validation errors.
 * @returns {Object|null} Form data object with parsed values if valid, otherwise null.
 */
export function getAndValidateForestInputs(errorDiv) {
    const inputs = {};
    let isValid = true;

    const fields = [
        { id: 'projectDuration', type: 'int', min: 1, max: 100, required: true },
        { id: 'projectArea', type: 'float', min: 0.1, step: 0.1, required: true },
        { id: 'plantingDensity', type: 'int', min: 100, max: 10000, required: true },
        { id: 'growthRate', type: 'float', min: 1, max: 50, step: 0.1, required: false, default: 10 },
        { id: 'woodDensity', type: 'float', min: 0.1, max: 1.5, step: 0.01, required: false, default: 0.5 },
        { id: 'bef', type: 'float', min: 1.0, max: 3.0, step: 0.01, required: false, default: 1.5 },
        { id: 'rsr', type: 'float', min: 0.1, max: 0.8, step: 0.01, required: false, default: 0.25 },
        { id: 'carbonFraction', type: 'float', min: 0.4, max: 0.6, step: 0.01, required: false, default: 0.47 },
        { id: 'survivalRate', type: 'int', min: 50, max: 100, required: false, default: 85 },
        { id: 'siteQuality', type: 'string', required: false, default: 'Medium' },
        { id: 'avgRainfall', type: 'string', required: false, default: 'Medium' },
        { id: 'soilType', type: 'string', required: false, default: 'Loam' },
        // Enhanced features inputs
        { id: 'initialGreenCover', type: 'float', min: 0, step: 0.1, required: false, default: 0 },
        { id: 'totalGeographicalArea', type: 'float', min: 0.1, step: 0.1, required: false, default: 100 },
        { id: 'riskRate', type: 'int', min: 0, max: 100, required: false, default: 15 },
        { id: 'deadAttributeSlider', type: 'int', min: 0, max: 100, required: false, default: 0 },
        { id: 'forestProjectCost', type: 'float', min: 0, required: false, default: null },
        // Carbon price needs special handling
    ];

    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) {
            console.warn(`Input element not found: ${field.id}`);
            return; // Skip if element doesn't exist
        }

        let value = element.value;
        let parsedValue;

        // Handle empty optional fields
        if (!value && !field.required) {
            parsedValue = field.default;
        } else if (!value && field.required) {
            isValid = false;
            setInputFeedback(element, false, 'This field is required.');
        } else {
            // Parse based on type
            switch (field.type) {
                case 'int':
                    parsedValue = parseInt(value, 10);
                    if (isNaN(parsedValue)) {
                        isValid = false; setInputFeedback(element, false, 'Must be a whole number.');
                    }
                    break;
                case 'float':
                     // Allow for comma separators in cost input
                     if (field.id === 'forestProjectCost') {
                         value = value.replace(/,/g, '');
                     }
                    parsedValue = parseFloat(value);
                    if (isNaN(parsedValue)) {
                        isValid = false; setInputFeedback(element, false, 'Must be a number.');
                    }
                    break;
                case 'string':
                    parsedValue = value; // No parsing needed
                    break;
                default:
                    parsedValue = value;
            }

            // Check min/max constraints if parsing was successful
            if (!isNaN(parsedValue)) {
                let message = '';
                if (field.min !== undefined && parsedValue < field.min) {
                    isValid = false; message = `Value must be at least ${field.min}.`;
                }
                if (field.max !== undefined && parsedValue > field.max) {
                    isValid = false; message = message ? `${message} Max: ${field.max}.` : `Value must be no more than ${field.max}.`;
                }
                 if (!isValid && message) {
                     setInputFeedback(element, false, message);
                 } else if (isValid) {
                     setInputFeedback(element, true); // Mark as valid
                 }
            } else if (field.required && !parsedValue) {
                 // Handles case where required string field might be empty after trim, etc.
                 isValid = false;
                 setInputFeedback(element, false, 'This field is required.');
            } else if (!field.required && !parsedValue && field.default === null) {
                 // Handle optional fields that default to null (like cost)
                 parsedValue = null;
                 setInputFeedback(element, true); // Valid if empty and optional
            } else {
                 setInputFeedback(element, true); // Assume valid if not required and not a number field
            }
        }
        inputs[field.id] = parsedValue;
    });

     // Special handling for carbon price (select or custom input)
     const carbonPriceSelect = document.getElementById('carbonPriceSelect');
     const customCarbonPriceInput = document.getElementById('customCarbonPrice');
     let carbonPrice = 10; // Default
     if (carbonPriceSelect) {
         if (carbonPriceSelect.value === 'custom' && customCarbonPriceInput) {
             const customPrice = parseFloat(customCarbonPriceInput.value);
             if (!isNaN(customPrice) && customPrice >= 0) {
                 carbonPrice = customPrice;
                 setInputFeedback(customCarbonPriceInput, true);
             } else {
                 isValid = false;
                 setInputFeedback(customCarbonPriceInput, false, 'Custom price must be a non-negative number.');
             }
         } else if (carbonPriceSelect.value !== 'custom') {
             carbonPrice = parseFloat(carbonPriceSelect.value);
             if (isNaN(carbonPrice)) { // Should not happen with select options
                 isValid = false;
                 console.error("Invalid value from carbon price select dropdown.");
                 carbonPrice = 10; // Fallback
             }
         }
     }
     inputs['carbonPrice'] = carbonPrice; // Add to inputs object


    if (!isValid) {
        showForestError("Please correct the errors in the form.", errorDiv);
        return null; // Indicate validation failure
    }

    // Clear general error message if validation passes
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.classList.add('hidden');
    }
    return inputs; // Return parsed and validated inputs
}

/**
 * Display forest calculation results
 * @param {Object} results - Calculation results object (containing totalResults and potentially speciesResults)
 * @param {HTMLElement} resultsSectionElement - Results section element
 * @param {HTMLElement} resultsBodyElement - Results table body element
 * @param {HTMLElement} chartElement - Chart canvas element
 * @param {HTMLElement} errorMessageElement - Error message element
 */
export function displayForestResults(results, resultsSectionElement, resultsBodyElement, chartElement, errorMessageElement) {
    try {
        console.log('Attempting to display forest results...');

        // Ensure elements exist
        if (!resultsSectionElement || !resultsBodyElement || !chartElement || !errorMessageElement) {
            console.error('Required DOM elements missing for displaying results:', {
                resultsSectionFound: !!resultsSectionElement,
                resultsBodyFound: !!resultsBodyElement,
                chartFound: !!chartElement,
                errorDivFound: !!errorMessageElement
            });
            if(errorMessageElement) showForestError("Internal error: Could not find required elements to display results.", errorMessageElement);
            return; // Stop if elements are missing
        }
        
        // Clear previous errors shown in the results area
        errorMessageElement.textContent = '';
        errorMessageElement.classList.add('hidden');

        // Clear previous results table content
        resultsBodyElement.innerHTML = '';

        // Get the actual results array (handle potential structure differences)
        const resultsData = results?.totalResults || (Array.isArray(results) ? results : null);

        if (!Array.isArray(resultsData) || resultsData.length === 0) {
            console.error('Invalid or empty results data received:', results);
            showForestError('Calculation completed, but no valid results data was generated.', errorMessageElement);
            // Hide the results section if data is invalid
            resultsSectionElement.classList.add('hidden');
            return;
        }

        console.log(`Displaying results for ${resultsData.length} years.`);

        // Get the final year results for summary
        const finalYear = resultsData[resultsData.length - 1];

        if (!finalYear) {
             throw new Error("Final year data is missing in results.");
        }

        // --- Update Summary Metrics ---
        const totalNetCO2Element = document.getElementById('totalNetCO2e');
        if (totalNetCO2Element) {
            totalNetCO2Element.textContent = formatCO2e(finalYear.cumulativeNetCO2e);
        } else console.warn("Element 'totalNetCO2e' not found.");

        // Ecosystem Maturity (Example calculation, adjust as needed)
        const ecosystemMaturityElement = document.getElementById('ecosystemMaturity');
        if (ecosystemMaturityElement) {
            // Example: Use Age at Peak MAI if available from species data, else default
            let peakMAIAge = 20; // Default
            // If multi-species, maybe average or use dominant species? For now, keep default.
            const maturityPercentage = Math.min(100, Math.round((finalYear.age / peakMAIAge) * 100));
            ecosystemMaturityElement.textContent = `${maturityPercentage}%`;
        } else console.warn("Element 'ecosystemMaturity' not found.");

        // VERs and Revenue are typically updated by forestEnhanced.js after this function runs.
        // We can set defaults here in case that module fails or isn't used.
        const totalVERsElement = document.getElementById('totalVERs');
        if (totalVERsElement && (!totalVERsElement.textContent || totalVERsElement.textContent === '--')) {
            totalVERsElement.textContent = formatCO2e(finalYear.cumulativeNetCO2e); // Default to total CO2e
        } else if (!totalVERsElement) console.warn("Element 'totalVERs' not found.");

        const estimatedRevenueElement = document.getElementById('estimatedRevenue');
        if (estimatedRevenueElement && (!estimatedRevenueElement.textContent || estimatedRevenueElement.textContent === '--')) {
             // Use a default price for placeholder
             const defaultCarbonPrice = 10; // Match default select option
             const revenue = finalYear.cumulativeNetCO2e * defaultCarbonPrice;
            estimatedRevenueElement.textContent = `$${revenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else if (!estimatedRevenueElement) console.warn("Element 'estimatedRevenue' not found.");
        // --- End Summary Metrics ---


        // --- Update Results Table ---
        resultsData.forEach(result => {
            if (!result) return; // Skip if a year's result is missing
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.year ?? 'N/A'}</td>
                <td>${result.age ?? 'N/A'}</td>
                <td>${result.volumeIncrement !== undefined ? result.volumeIncrement.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'N/A'}</td>
                <td>${result.netAnnualCO2e !== undefined ? result.netAnnualCO2e.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'N/A'}</td>
                <td>${result.cumulativeNetCO2e !== undefined ? result.cumulativeNetCO2e.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'N/A'}</td>
            `;
            resultsBodyElement.appendChild(row);
        });
        // --- End Results Table ---

        // --- Update Chart ---
        updateSequestrationChart(resultsData, chartElement.id); // Pass canvas ID
        // --- End Chart ---

        // --- Make Results Visible ---
        resultsSectionElement.classList.remove('hidden');
        resultsSectionElement.style.display = 'block'; // Ensure display style allows visibility

        console.log('Results section visibility updated:', {
            elementId: resultsSectionElement.id,
            hasClassHidden: resultsSectionElement.classList.contains('hidden'),
            displayStyle: resultsSectionElement.style.display
        });

        // Scroll to results section after a short delay to ensure rendering
        setTimeout(() => {
            resultsSectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log("Scrolled to results section.");
        }, 150);
        // --- End Visibility ---

    } catch (error) {
        console.error('Error displaying results:', error);
        // Show error in the designated message area
        if (errorMessageElement) {
            showForestError(`Error displaying results: ${error.message}. Check console for details.`, errorMessageElement);
        }
        // Attempt to hide the results section if an error occurred during display
        if (resultsSectionElement) {
            resultsSectionElement.classList.add('hidden');
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
        console.log(`Updating chart '${canvasId}' with ${annualData.length} years of data.`);

        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.error('Chart canvas element not found:', canvasId);
            return;
        }

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library is not loaded.');
            // Optionally display a message on the canvas
             const context = ctx.getContext('2d');
             context.clearRect(0, 0, ctx.width, ctx.height);
             context.fillStyle = '#dc3545'; // Red color for error
             context.font = '16px Arial';
             context.textAlign = 'center';
             context.fillText('Error: Chart library not loaded.', ctx.width / 2, ctx.height / 2);
            return;
        }

        const labels = annualData.map(d => `Year ${d.year}`);
        const cumulativeData = annualData.map(d => d.cumulativeNetCO2e);
        const annualDataPoints = annualData.map(d => d.netAnnualCO2e);

        // Destroy existing chart instance if it exists
        if (sequestrationChartInstance) {
            console.log("Destroying previous chart instance before creating new one.");
            sequestrationChartInstance.destroy();
            sequestrationChartInstance = null; // Clear the reference
        }

        // Create new chart and store the instance
        sequestrationChartInstance = new Chart(ctx, {
            type: 'bar', // Overall type, but datasets can override
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cumulative Net CO₂e (tCO₂e)', // Simplified label
                        data: cumulativeData,
                        borderColor: 'rgb(54, 162, 235)', // Blue
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        type: 'line', // Line chart for cumulative
                        fill: true,
                        yAxisID: 'yCumulative',
                        tension: 0.1
                    },
                    {
                        label: 'Annual Net CO₂e (tCO₂e/yr)', // Simplified label
                        data: annualDataPoints,
                        borderColor: 'rgb(255, 159, 64)', // Orange
                        backgroundColor: 'rgba(255, 159, 64, 0.5)',
                        type: 'bar', // Bar chart for annual
                        yAxisID: 'yAnnual',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart to fill container height
                interaction: {
                    mode: 'index', // Show tooltips for all datasets at the same index
                    intersect: false, // Tooltip triggers even if not directly hovering over point/bar
                },
                plugins: { // Use plugins object for title etc. in Chart.js v3+
                     title: {
                         display: true,
                         text: 'Estimated Carbon Sequestration Over Time'
                     },
                     tooltip: {
                         callbacks: {
                             label: function(context) {
                                 let label = context.dataset.label || '';
                                 if (label) {
                                     label += ': ';
                                 }
                                 if (context.parsed.y !== null) {
                                     label += context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                 }
                                 return label;
                             }
                         }
                     }
                 },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Project Year'
                        }
                    },
                    yCumulative: { // Left Y-axis for cumulative
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Cumulative Net CO₂e (tCO₂e)'
                        },
                        beginAtZero: true,
                         grid: { // Keep grid lines for this axis
                             drawOnChartArea: true,
                         }
                    },
                    yAnnual: { // Right Y-axis for annual
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Annual Net CO₂e (tCO₂e/yr)'
                        },
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false, // Hide grid lines for the secondary axis
                        }
                    }
                }
            }
        });

        console.log(`Chart '${canvasId}' updated successfully.`);
    } catch (error) {
        console.error(`Error updating chart '${canvasId}':`, error);
         // Try to show error on canvas
         const canvas = document.getElementById(canvasId);
         if (canvas) {
             const context = canvas.getContext('2d');
             context.clearRect(0, 0, canvas.width, canvas.height);
             context.fillStyle = '#dc3545';
             context.font = '16px Arial';
             context.textAlign = 'center';
             context.fillText(`Error creating chart: ${error.message}`, canvas.width / 2, ctx.height / 2, canvas.width * 0.9); // Add max width
         }
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
        console.error("Forest Error Display:", message); // Log error for debugging
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        // Ensure error is visible by scrolling to it
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Fallback if element not found
        console.error('Forest calculator error (element not found):', message);
        alert(`Error: ${message}`); // Use alert as last resort
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
 * Displays a list of species parsed from the uploaded file.
 * @param {Array<Object>} speciesData - Array of species objects.
 * @param {HTMLElement} listElement - The UL or DIV element to display the list in.
 */
export function displaySpeciesList(speciesData, listElement) {
    if (!listElement) {
        console.error("Species list element not provided for display.");
        return;
    }

    listElement.innerHTML = ''; // Clear previous list

    if (!speciesData || speciesData.length === 0) {
        listElement.innerHTML = '<p class="text-sm text-gray-500">No species data found in the file.</p>';
        return;
    }

    const count = speciesData.length;
    
    // Create a more comprehensive display of species data
    const tableContainer = document.createElement('div');
    tableContainer.className = 'species-data-container mt-3';
    
    // Add header with count and information
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-2';
    header.innerHTML = `
        <h4 class="text-md font-medium text-green-700">Successfully loaded ${count} species</h4>
        <span class="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">Will be used for calculation</span>
    `;
    tableContainer.appendChild(header);
    
    // Create table for species data
    const table = document.createElement('table');
    table.className = 'species-list-table w-full text-sm';
    
    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Species</th>
            <th>Trees</th>
            <th>Growth Rate (m³/ha/yr)</th>
            <th>Wood Density</th>
            <th>Survival (%)</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    // Add all species to the table
    speciesData.forEach((species, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-gray-50' : '';
        
        // Format the species data for display
        row.innerHTML = `
            <td class="font-medium">${species['Species Name'] || 'Unknown'}</td>
            <td class="text-right">${formatNumber(species['Number of Trees'])}</td>
            <td class="text-right">${formatNumber(species['Growth Rate (m³/ha/yr)'])}</td>
            <td class="text-right">${formatNumber(species['Wood Density (tdm/m³)'] || '-')}</td>
            <td class="text-right">${formatNumber(species['Survival Rate (%)'] || '85')}%</td>
        `;
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    // Add information about the calculation
    const infoText = document.createElement('p');
    infoText.className = 'text-sm text-gray-600 mt-2';
    infoText.innerHTML = 'These species will be used for multi-species calculation when you click "Calculate Net Sequestration"';
    tableContainer.appendChild(infoText);
    
    listElement.appendChild(tableContainer);
    listElement.classList.remove('hidden'); // Ensure the container is visible
}

// Helper function for number formatting in the table
function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') {
        return value.toLocaleString(undefined, {
            maximumFractionDigits: 2
        });
    }
    return value;
}

/**
 * Updates the conversion factor inputs based on the first species data.
 * @param {Object} species - The first species object from the uploaded data.
 */
export function updateConversionFactors(species) {
    const fields = ['growthRate', 'woodDensity', 'bef', 'rsr', 'carbonFraction'];
    const sourceHeaders = ['Growth Rate (m³/ha/yr)', 'Wood Density (tdm/m³)', 'BEF', 'Root-Shoot Ratio', 'Carbon Fraction'];

    fields.forEach((fieldId, index) => {
        const input = document.getElementById(fieldId);
        const header = sourceHeaders[index];
        if (input && species[header] !== undefined && species[header] !== null && !isNaN(parseFloat(species[header]))) {
            input.value = parseFloat(species[header]);
            console.log(`Updated ${fieldId} from file to: ${input.value}`);
        } else if (input) {
             console.log(`No valid value for ${fieldId} in file, keeping existing value: ${input.value}`);
        }
    });
}

/**
 * Updates the site factor inputs based on the first species data.
 * @param {Object} species - The first species object from the uploaded data.
 */
export function updateSiteFactors(species) {
    const fields = ['siteQuality', 'avgRainfall', 'soilType', 'survivalRate'];
    const sourceHeaders = ['Site Quality', 'Average Rainfall', 'Soil Type', 'Survival Rate (%)'];

     fields.forEach((fieldId, index) => {
        const input = document.getElementById(fieldId);
        const header = sourceHeaders[index];
        if (input && species[header] !== undefined && species[header] !== null) {
             // Special handling for survival rate (needs parsing)
             if (fieldId === 'survivalRate') {
                 const rate = parseInt(species[header], 10);
                 if (!isNaN(rate) && rate >= 0 && rate <= 100) {
                     input.value = rate;
                     console.log(`Updated ${fieldId} from file to: ${input.value}`);
                 } else {
                      console.log(`Invalid Survival Rate value ('${species[header]}') in file for ${fieldId}, keeping existing value: ${input.value}`);
                 }
             } else { // For select dropdowns
                 // Check if the value from the file is a valid option
                 const optionExists = Array.from(input.options).some(opt => opt.value.toLowerCase() === String(species[header]).toLowerCase());
                 if (optionExists) {
                     input.value = Array.from(input.options).find(opt => opt.value.toLowerCase() === String(species[header]).toLowerCase()).value;
                     console.log(`Updated ${fieldId} from file to: ${input.value}`);
                 } else {
                      console.log(`Value '${species[header]}' from file is not a valid option for ${fieldId}, keeping existing value: ${input.value}`);
                 }
             }
        } else if (input) {
             console.log(`No value for ${fieldId} in file, keeping existing value: ${input.value}`);
        }
    });
}

/**
 * Handle species file upload and parse the data
 * @param {Event} event - Change event
 */
function handleSpeciesFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        showForestError('No file selected for upload.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        try {
            const speciesData = parseSpeciesFile(contents);
            if (speciesData && speciesData.length > 0) {
                // Display species list
                const speciesListElement = document.getElementById('speciesList');
                displaySpeciesList(speciesData, speciesListElement);

                // Update conversion factors and site factors based on the first species
                updateConversionFactors(speciesData[0]);
                updateSiteFactors(speciesData[0]);

                // Track successful file upload
                trackEvent('forest_species_file_uploaded', {
                    fileName: file.name,
                    speciesCount: speciesData.length,
                    timestamp: new Date().toISOString()
                });
            } else {
                showForestError('No valid species data found in the file.');
            }
        } catch (error) {
            console.error('Error parsing species file:', error);
            showForestError('Error parsing species file. Please check the file format.');
        }
    };
    reader.readAsText(file);
}

/**
 * Parse species file content
 * @param {string} contents - File contents
 * @returns {Array<Object>} Parsed species data
 */
function parseSpeciesFile(contents) {
    const lines = contents.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const speciesData = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(value => value.trim());
        const species = {};

        headers.forEach((header, index) => {
            species[header] = parseNumberWithCommas(values[index]);
        });

        speciesData.push(species);
    }

    return speciesData;
}
