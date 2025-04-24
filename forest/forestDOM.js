import { formatNumber, formatCO2e } from '../utils.js';
import { uiManager, createElement, querySelectorAll, querySelector, toggleClass } from '../domUtils.js';
import { forestEventSystem } from './forestCalcs.js';

// State variables
let chartInstance = null;
let initialized = false;
// Track registered event listeners for proper cleanup
const registeredEventListeners = new Map();

/**
 * Initialize the forest DOM module
 * @param {Object} options - Initialization options
 * @returns {Object} - Exported functions for interacting with the DOM
 */
export function initForestDOM(options = {}) {
    console.log('Initializing forest DOM module');
    
    if (initialized) {
        console.log('Forest DOM already initialized, skipping');
        return;
    }
    
    try {
        const { setupEventListeners = true } = options;
        
        // Initialize the event system first
        forestEventSystem.init();
        
        // Set up form fields
        setupFormFields();
        
        // Setup event listeners if requested
        if (setupEventListeners) {
            setupForestEventListeners();
        }
        
        // Register DOM-related callbacks with the event system
        registerDOMWithEventSystem();
        
        // Set initialization flag
        initialized = true;
        
        console.log('Forest DOM initialized successfully');
    } catch (error) {
        console.error('Error initializing forest DOM:', error);
        showForestError(`DOM initialization error: ${error.message}`);
    }
}

/**
 * Cleanup the forest DOM module - unregister event listeners
 */
export function cleanupForestDOM() {
    console.log('Cleaning up forest DOM module');
    
    try {
        // Clean up registered event listeners
        registeredEventListeners.forEach((listeners, elementId) => {
            const element = document.getElementById(elementId);
            if (element) {
                listeners.forEach(({ eventType, handler }) => {
                    element.removeEventListener(eventType, handler);
                    console.log(`Removed ${eventType} listener from ${elementId}`);
                });
            }
        });
        
        // Clear the tracking map
        registeredEventListeners.clear();
        
        // Reset charts
        resetForestCharts();
        
        // Reset initialization flag
        initialized = false;
        
        console.log('Forest DOM cleanup complete');
    } catch (error) {
        console.error('Error during forest DOM cleanup:', error);
    }
}

/**
 * Helper function to safely add event listener and track it for cleanup
 * @param {string} elementId - The ID of the element to attach listener to
 * @param {string} eventType - The event type (click, change, etc)
 * @param {Function} handler - The event handler function
 */
function safeAddEventListener(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Element ${elementId} not found, skipping event listener`);
        return;
    }
    
    // Create bound handler to ensure we can remove it later
    const boundHandler = handler.bind(null);
    
    // Add the event listener
    element.addEventListener(eventType, boundHandler);
    
    // Track the listener for cleanup
    if (!registeredEventListeners.has(elementId)) {
        registeredEventListeners.set(elementId, []);
    }
    
    registeredEventListeners.get(elementId).push({
        eventType,
        handler: boundHandler
    });
    
    console.log(`Added ${eventType} listener to ${elementId}`);
}

/**
 * Register DOM-related callbacks with the forestEventSystem
 */
function registerDOMWithEventSystem() {
    forestEventSystem.registerEvents({
        showError: showForestError,
        onResults: (resultsSection) => showForestResults(resultsSection),
        onReset: clearForestErrors,
        onValidationError: getAndValidateForestInputs,
        onDisplayResults: displayForestResults
    });
    
    console.log('DOM callbacks registered with forest event system');
}

/**
 * Set up the forest calculator form fields
 */
function setupFormFields() {
    try {
        console.log('Setting up forest form fields');
        
        // Get form elements
        const form = document.getElementById('calculatorForm');
        
        // If the form doesn't exist, we're not on the right page
        if (!form) {
            console.log('Calculator form not found, not on forest calculator page');
            return;
        }
        
        // Set default values with correct field IDs
        const defaults = {
            projectArea: 100,
            plantingDensity: 1600,
            growthRate: 10,
            woodDensity: 0.5,
            bef: 1.5,
            rsr: 0.25,
            carbonFraction: 0.47,
            projectDuration: 50,
            survivalRate: 85,
            forestProjectCost: 0,
            species: 'mixed'
        };
        
        // Apply default values to form
        for (const [fieldId, value] of Object.entries(defaults)) {
            const input = document.getElementById(fieldId);
            if (input && (!input.value || input.value === '0')) {
                input.value = value;
                console.log(`Set default value for ${fieldId}: ${value}`);
            }
        }
        
        // Set default values for selects that may not be caught above
        const speciesInput = document.getElementById('species');
        if (speciesInput && speciesInput.tagName.toLowerCase() === 'select' && !speciesInput.value) {
            // Find the first option or use 'mixed'
            const firstOption = speciesInput.querySelector('option');
            if (firstOption) {
                speciesInput.value = firstOption.value;
            } else {
                speciesInput.value = 'mixed';
            }
        }
        
        // Initialize validation
        setupFormValidation(form);
    } catch (error) {
        console.error('Error setting up form fields:', error);
    }
}

/**
 * Set up form validation
 * @param {HTMLFormElement} form - The form element
 */
function setupFormValidation(form) {
    if (!form) return;
    
    console.log('Setting up form validation');
    
    // Setup validation logic for each field with correct IDs and ranges
    const validationRules = {
        projectArea: { min: 0.1, max: 10000, required: true, type: 'number' },
        plantingDensity: { min: 100, max: 10000, required: true, type: 'number' },
        growthRate: { min: 1, max: 50, required: true, type: 'number' },
        woodDensity: { min: 0.1, max: 1.5, required: true, type: 'number' },
        bef: { min: 1.0, max: 3.0, required: true, type: 'number' },
        rsr: { min: 0.1, max: 0.8, required: true, type: 'number' },
        carbonFraction: { min: 0.4, max: 0.6, required: true, type: 'number' },
        projectDuration: { min: 1, max: 200, required: true, type: 'number' },
        survivalRate: { min: 0, max: 100, required: true, type: 'number' },
        forestProjectCost: { min: 0, max: 1000000000, required: false, type: 'number' },
        riskRate: { min: 0, max: 100, required: false, type: 'number' },
        deadAttribute: { min: 0, max: 100, required: false, type: 'number' }
    };
    
    // Add validation event listeners using consistent IDs
    for (const [fieldId, rules] of Object.entries(validationRules)) {
        const input = document.getElementById(fieldId);
        if (!input) {
            console.warn(`Field ${fieldId} not found for validation setup`);
            continue;
        }
        
        input.addEventListener('change', function() {
            const isValid = validateInput(input, rules);
            // Use setInputFeedback from domUtils.js if available
            if (window.uiManager && typeof uiManager.setInputFeedback === 'function') {
                uiManager.setInputFeedback(
                    input, 
                    isValid ? 'valid' : 'invalid',
                    isValid ? '' : input.validationMessage || 'Invalid input'
                );
            }
        });
        
        input.addEventListener('blur', function() {
            validateInput(input, rules);
        });
    }
}

/**
 * Validate a single input field
 * @param {HTMLInputElement} input - The input element
 * @param {Object} rules - Validation rules
 * @returns {boolean} - Whether the input is valid
 */
function validateInput(input, rules) {
    try {
        // Clear previous validation errors
        input.classList.remove('invalid');
        const errorSpan = input.nextElementSibling;
        if (errorSpan && errorSpan.classList.contains('error-message')) {
            errorSpan.textContent = '';
        }
        
        // Skip validation if the field is optional and empty
        if (!rules.required && (!input.value || input.value.trim() === '')) {
            return true;
        }
        
        let value;
        
        // Type validation
        if (rules.type === 'number') {
            value = parseFloat(input.value);
            if (isNaN(value)) {
                markInvalid(input, 'Please enter a valid number');
                return false;
            }
        } else {
            value = input.value;
        }
        
        // Required validation
        if (rules.required && (!value || value.toString().trim() === '')) {
            markInvalid(input, 'This field is required');
            return false;
        }
        
        // Range validation for numbers
        if (rules.type === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                markInvalid(input, `Value must be at least ${rules.min}`);
                return false;
            }
            if (rules.max !== undefined && value > rules.max) {
                markInvalid(input, `Value must be at most ${rules.max}`);
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error validating input:', error);
        return false;
    }
}

/**
 * Mark an input as invalid
 * @param {HTMLInputElement} input - The input element
 * @param {string} message - Error message
 */
function markInvalid(input, message) {
    input.classList.add('invalid');
    
    // Find or create error message span
    let errorSpan = input.nextElementSibling;
    if (!errorSpan || !errorSpan.classList.contains('error-message')) {
        errorSpan = document.createElement('span');
        errorSpan.className = 'error-message';
        input.parentNode.insertBefore(errorSpan, input.nextSibling);
    }
    
    errorSpan.textContent = message;
}

/**
 * Setup forest event listeners with tracking for cleanup
 */
export function setupForestEventListeners() {
    console.log('Setting up forest event listeners');
    
    try {
        // Advanced options toggle
        safeAddEventListener('advancedToggle', 'click', function() {
            const advancedSection = document.getElementById('advancedOptions');
            const advancedToggle = document.getElementById('advancedToggle');
            
            if (advancedSection && advancedToggle) {
                advancedSection.classList.toggle('hidden');
                advancedToggle.textContent = advancedSection.classList.contains('hidden')
                    ? 'Show Advanced Options'
                    : 'Hide Advanced Options';
            }
        });
        
        // Results toggle
        safeAddEventListener('resultsToggle', 'click', function() {
            const detailedResults = document.getElementById('detailedResults');
            const resultsToggle = document.getElementById('resultsToggle');
            
            if (detailedResults && resultsToggle) {
                detailedResults.classList.toggle('hidden');
                resultsToggle.textContent = detailedResults.classList.contains('hidden')
                    ? 'Show Detailed Results'
                    : 'Hide Detailed Results';
            }
        });
        
        // Help tooltips - handles separately as they're selected by class
        setupTooltips();
        
        console.log('Forest event listeners setup complete');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

/**
 * Setup tooltips with tracking
 */
function setupTooltips() {
    const tooltips = document.querySelectorAll('.tooltip-trigger');
    
    tooltips.forEach((tooltip, index) => {
        // Create unique ID for tracking if not present
        if (!tooltip.id) {
            tooltip.id = `tooltip-trigger-${index}`;
        }
        
        // Add event listeners
        safeAddEventListener(tooltip.id, 'mouseenter', showTooltip);
        safeAddEventListener(tooltip.id, 'mouseleave', hideTooltip);
        safeAddEventListener(tooltip.id, 'focus', showTooltip);
        safeAddEventListener(tooltip.id, 'blur', hideTooltip);
    });
}

/**
 * Show a tooltip
 * @param {Event} event - The event that triggered the tooltip
 */
function showTooltip(event) {
    const tooltipText = event.target.getAttribute('data-tooltip');
    if (!tooltipText) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    
    document.body.appendChild(tooltip);
    
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    
    event.target.tooltip = tooltip;
}

/**
 * Hide a tooltip
 * @param {Event} event - The event that triggered hiding the tooltip
 */
function hideTooltip(event) {
    if (event.target.tooltip) {
        event.target.tooltip.remove();
        event.target.tooltip = null;
    }
}

/**
 * Reset forest charts
 */
export function resetForestCharts() {
    console.log('Resetting forest charts');
    
    try {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
    } catch (error) {
        console.error('Error resetting charts:', error);
    }
}

/**
 * Clear forest error messages
 */
export function clearForestErrors() {
    console.log('Clearing forest errors');
    
    try {
        const errorElements = document.querySelectorAll('.error-message, #errorMessageForest');
        
        errorElements.forEach(element => {
            if (element) {
                element.textContent = '';
                element.classList.add('hidden');
            }
        });
    } catch (error) {
        console.error('Error clearing error messages:', error);
    }
}

/**
 * Display a forest error message
 * @param {string} message - Error message
 * @param {HTMLElement} [errorDiv] - Element to display the error in
 * @returns {void}
 */
export function showForestError(message, errorDiv) {
    console.error('Forest error:', message);
    
    try {
        // If no error div is provided, look for the default one
        errorDiv = errorDiv || document.getElementById('errorMessageForest');
        
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            errorDiv.scrollIntoView({ behavior: 'smooth' });
        } else {
            // If we can't find any error div, show an alert
            console.warn('No error display element found, showing alert');
            alert(`Forest Calculator Error: ${message}`);
        }
    } catch (error) {
        console.error('Error showing error message:', error);
        alert(`Forest Calculator Error: ${message}`);
    }
}

/**
 * Get and validate calculator inputs
 * @param {HTMLElement} [errorMessageElement] - Element to display error messages
 * @returns {Object|null} - Validated inputs or null if validation fails
 */
export function getAndValidateForestInputs(errorMessageElement) {
    console.log('Getting and validating forest inputs');
    
    try {
        // Get values from form fields using consistent IDs
        const area = parseFloat(document.getElementById('projectArea')?.value);
        const density = parseFloat(document.getElementById('plantingDensity')?.value);
        const growthRate = parseFloat(document.getElementById('growthRate')?.value);
        const woodDensity = parseFloat(document.getElementById('woodDensity')?.value);
        const bef = parseFloat(document.getElementById('bef')?.value);
        const rsr = parseFloat(document.getElementById('rsr')?.value);
        const carbonFraction = parseFloat(document.getElementById('carbonFraction')?.value || CARBON_FRACTION_DEFAULT);
        const duration = parseFloat(document.getElementById('projectDuration')?.value);
        const survivalRate = parseFloat(document.getElementById('survivalRate')?.value || 85);
        const mortalityRate = survivalRate > 0 ? (100 - survivalRate) / 100 : 0.15;
        const projectCost = parseFloat(document.getElementById('forestProjectCost')?.value || 0);
        const species = document.getElementById('species')?.value || 'Generic';
        
        // Validate inputs
        if (isNaN(area) || area <= 0) {
            showForestError('Please enter a valid project area greater than 0', errorMessageElement);
            return null;
        }
        
        if (isNaN(density) || density <= 0) {
            showForestError('Please enter a valid planting density greater than 0', errorMessageElement);
            return null;
        }
        
        if (isNaN(growthRate) || growthRate <= 0) {
            showForestError('Please enter a valid growth rate greater than 0', errorMessageElement);
            return null;
        }
        
        if (isNaN(woodDensity) || woodDensity <= 0) {
            showForestError('Please enter a valid wood density greater than 0', errorMessageElement);
            return null;
        }
        
        if (isNaN(bef) || bef < 1) {
            showForestError('Please enter a valid biomass expansion factor greater than or equal to 1', errorMessageElement);
            return null;
        }
        
        if (isNaN(rsr) || rsr <= 0 || rsr > 0.8) {
            showForestError('Please enter a valid root-to-shoot ratio between 0 and 0.8', errorMessageElement);
            return null;
        }
        
        if (isNaN(carbonFraction) || carbonFraction <= 0 || carbonFraction > 0.6) {
            showForestError('Please enter a valid carbon fraction between 0 and 0.6', errorMessageElement);
            return null;
        }
        
        if (isNaN(duration) || duration <= 0 || duration > 200) {
            showForestError('Please enter a valid project duration between 1 and 200 years', errorMessageElement);
            return null;
        }
        
        if (isNaN(mortalityRate) || mortalityRate < 0 || mortalityRate > 0.5) {
            showForestError('Please enter a valid mortality rate between 0 and 0.5', errorMessageElement);
            return null;
        }
        
        if (projectCost && (isNaN(projectCost) || projectCost < 0)) {
            showForestError('Project cost must be a positive number', errorMessageElement);
            return null;
        }
        
        return {
            area,
            density,
            growthRate,
            woodDensity,
            bef,
            rsr,
            carbonFraction,
            duration,
            mortalityRate,
            projectCost,
            species
        };
    } catch (error) {
        console.error('Error validating inputs:', error);
        showForestError(`Validation error: ${error.message}`, errorMessageElement);
        return null;
    }
}

/**
 * Create a sequestration chart
 * @param {Array<Object>} results - Sequestration results
 * @param {HTMLElement} chartElement - Element to render the chart in
 */
function createSequestrationChart(results, chartElement) {
    try {
        console.log('Creating sequestration chart');
        
        if (!chartElement || !window.Chart) {
            console.error('Chart element or Chart.js not found');
            return;
        }
        
        // Clean up existing chart
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        // Prepare data
        const years = results.map(result => result.year);
        const co2eData = results.map(result => result.rawCO2e);
        const netCO2eData = results.map(result => result.rawNetCO2e);
        
        // Create chart
        const ctx = chartElement.getContext('2d');
        
        chartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Gross CO₂e Sequestration',
                        data: co2eData,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: 'Net CO₂e Sequestration',
                        data: netCO2eData,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'CO₂e Sequestration Over Time'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += formatCO2e(context.parsed.y);
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
                            text: 'Years'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'CO₂e (tonnes)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
        
        console.log('Chart created successfully');
    } catch (error) {
        console.error('Error creating chart:', error);
    }
}

/**
 * Show the forest results section
 * @param {HTMLElement} resultsSection - Results section element
 */
export function showForestResults(resultsSection) {
    if (!resultsSection) {
        console.error('Results section not found');
        return;
    }
    
    resultsSection.classList.remove('hidden');
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Display forest calculation results
 * @param {Array<Object>} results - Sequestration results
 * @param {HTMLElement} resultsSection - Results section element
 * @param {HTMLElement} resultsBody - Results body element
 * @param {HTMLElement} chartElement - Chart element
 * @param {HTMLElement} errorMessageElement - Error message element
 * @returns {boolean} Whether results were displayed successfully
 */
export function displayForestResults(results, resultsSection, resultsBody, chartElement, errorMessageElement) {
    console.log('Displaying forest results');
    
    try {
        if (!results || !results.length) {
            showForestError('No results to display', errorMessageElement);
            return false;
        }

        // Debug the results to ensure we have valid data
        console.log('Results to display:', results.length, 'data points');
        console.log('First result:', results[0]);
        console.log('Last result:', results[results.length-1]);
        
        // Clear any existing error messages
        clearForestErrors();
        
        // Create chart
        if (chartElement) {
            createSequestrationChart(results, chartElement);
        }
        
        // Display summary results
        const finalResult = results[results.length - 1];
        const initialResult = results[0];
        
        const totalCO2e = finalResult.netCO2e;
        const annualAverage = results.length > 1
            ? formatCO2e(finalResult.rawNetCO2e / finalResult.year)
            : '0';
        
        const summaryElement = document.getElementById('resultsSummary');
        if (summaryElement) {
            summaryElement.innerHTML = `
                <div class="result-item">
                    <span class="result-label">Total CO₂e Sequestered:</span>
                    <span class="result-value">${totalCO2e}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Annual Average:</span>
                    <span class="result-value">${annualAverage}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Duration:</span>
                    <span class="result-value">${finalResult.year} years</span>
                </div>
            `;
        }
        
        // Display detailed results in table
        if (resultsBody) {
            // Clear existing results
            resultsBody.innerHTML = '';
            
            console.log('Populating table with', results.length, 'rows');
            
            // Add results rows
            results.forEach((result, index) => {
                const row = document.createElement('tr');
                
                // Add debugging class to help identify rows
                row.className = 'result-row';
                
                row.innerHTML = `
                    <td>${result.year}</td>
                    <td>${result.growingStock}</td>
                    <td>${result.aboveGroundBiomass}</td>
                    <td>${result.belowGroundBiomass}</td>
                    <td>${result.carbonContent}</td>
                    <td>${result.co2e}</td>
                    <td>${result.mortalityLoss}</td>
                    <td>${result.netCO2e}</td>
                `;
                
                resultsBody.appendChild(row);
                
                // Log first and last row for debugging
                if (index === 0 || index === results.length - 1) {
                    console.log(`Row ${index} HTML:`, row.outerHTML);
                }
            });
            
            // Ensure the table is visible
            const resultsTable = document.getElementById('resultsTableForest');
            if (resultsTable) {
                resultsTable.style.display = 'table';
                resultsTable.style.visibility = 'visible';
                resultsTable.style.opacity = '1';
                console.log('Ensured results table is visible');
            }
        }
        
        // Show results section using multiple approaches to ensure visibility
        if (resultsSection) {
            // Remove any hiding classes
            resultsSection.classList.remove('hidden');
            
            // Add explicit visibility styles with !important to override any CSS
            resultsSection.setAttribute('style', `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                height: auto !important;
                overflow: visible !important;
            `);
            
            // Add a class to explicitly show results
            resultsSection.classList.add('show-results');
            
            // Scroll to it
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log('Scrolled to results section');
            }, 100);
        }
        
        console.log('Results displayed successfully');
        
        return true;
    } catch (error) {
        console.error('Error displaying results:', error);
        showForestError(`Error displaying results: ${error.message}`, errorMessageElement);
        return false;
    }
}
