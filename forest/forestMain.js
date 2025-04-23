import { 
    calculateSequestration, 
    calculateSequestrationMultiSpecies,
    getAndValidateForestInputs,
    calculateForestCostAnalysis
} from './forestCalcs.js';

import { 
    displayForestResults,
    showForestError,
    clearForestErrors,
    validateForestInput,
    resetForestCharts
} from './forestDOM.js';

import {
    downloadExcelTemplate,
    generateForestPdf,
    exportForestExcel,
    setupForestFileUploads
} from './forestIO.js';

import { setupGreenCoverAndCredits } from './forestEnhanced.js';

import { analytics } from '../analytics.js';

// Track forest calculator events
function trackEvent(eventName, eventData = {}) {
    try {
        if (analytics && typeof analytics.trackEvent === 'function') {
            analytics.trackEvent(eventName, eventData);
        }
    } catch (error) {
        console.error('Error tracking event:', error);
    }
}

export const C_TO_CO2 = 44 / 12;
export const MIN_DURATION = 4;
export const MAX_DURATION = 50;
export const MIN_DENSITY = 100;

export class ForestCalculatorManager {
    constructor() {
        this.speciesData = [];
        this.activeFileUpload = false;
        this.greenCoverAndCreditsSetup = null;
        this.form = null;
        this.calculateBtn = null;
        this.resetBtn = null;
        this.errorMessageDiv = null;
        this.resultsSection = null;
        this.resultsBodyElement = null;
        this.chartElement = null;
        this.projectCostInput = null;
        this.getSpeciesData = () => this.speciesData;
        this.isActiveFileUpload = () => this.activeFileUpload;
        this.lastCalculationResults = null;
    }
    
    init() {
        console.log('Initializing Forest Calculator Manager');
        
        // Get DOM elements
        this.form = document.getElementById('calculatorForm');
        this.calculateBtn = document.getElementById('calculateForestBtn');
        this.resetBtn = document.getElementById('resetForestBtn');
        this.errorMessageDiv = document.getElementById('errorMessageForest');
        this.resultsSection = document.getElementById('resultsSectionForest');
        this.resultsBodyElement = document.getElementById('resultsBodyForest');
        this.chartElement = document.getElementById('sequestrationChart');
        this.projectCostInput = document.getElementById('forestProjectCost');
        this.exportExcelBtn = document.getElementById('exportForestExcelBtn');
        this.generatePdfBtn = document.getElementById('generateForestPdfBtn');
        this.speciesElement = document.getElementById('species');
        
        // Check if all required elements are found
        if (!this.form || !this.calculateBtn || !this.resetBtn || !this.errorMessageDiv || !this.resultsSection) {
            console.error('Critical DOM elements not found. Forest calculator might not work correctly.');
            return false;
        } else {
            console.log('All critical DOM elements found.');
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        try {
            // Set up file uploads
            setupForestFileUploads();
            
            // Set up green cover and credits features
            this.greenCoverAndCreditsSetup = setupGreenCoverAndCredits(this.speciesData);
            
            // Mark initialization as complete
            window.forestCalculator = this;
            console.log('Forest Calculator Manager initialized successfully');
            
            return true;
        } catch (error) {
            console.error('Error during Forest Calculator initialization:', error);
            return false;
        }
    }
    
    setupEventListeners() {
        console.log('Setting up forest calculator event listeners');
        
        // Calculate button click handler
        if (this.calculateBtn) {
            this.calculateBtn.addEventListener('click', this.handleForestFormSubmit.bind(this));
            console.log('Calculate button listener attached');
        }
        
        // Reset button click handler
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', this.resetForestCalculator.bind(this));
            console.log('Reset button listener attached');
        }
        
        // Species selection change handler
        if (this.speciesElement) {
            this.speciesElement.addEventListener('change', this.handleSpeciesChange.bind(this));
            console.log('Species selection listener attached');
        }
        
        // Excel export handler
        if (this.exportExcelBtn) {
            this.exportExcelBtn.addEventListener('click', () => {
                exportForestExcel();
            });
            console.log('Excel export button listener attached');
        }
        
        // PDF generation handler
        if (this.generatePdfBtn) {
            this.generatePdfBtn.addEventListener('click', () => {
                generateForestPdf();
            });
            console.log('PDF generation button listener attached');
        }
    }
    
    // Update species data from file uploads with detailed logging
    setSpeciesData(data) {
        if (Array.isArray(data)) {
            console.log(`%c[ForestCalculator] Setting species data: ${data.length} species detected`, 'color: #4CAF50; font-weight: bold');
            console.log(`%c[ForestCalculator] Species data sample:`, 'color: #4CAF50', {
                firstSpecies: data[0],
                totalSpecies: data.length,
                timestamp: new Date().toISOString()
            });
            
            this.speciesData = data;
            this.activeFileUpload = data.length > 0;
            
            // Log active state change
            console.log(`%c[ForestCalculator] Active file upload state set to: ${this.activeFileUpload}`, 
                this.activeFileUpload ? 'color: #4CAF50; font-weight: bold' : 'color: #F44336');
            
            // Track event if analytics is available
            try {
                if (analytics && typeof analytics.trackEvent === 'function') {
                    analytics.trackEvent('forest_species_data_set', {
                        count: data.length,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('Error tracking species data event:', error);
            }
            
            return true;
        } else {
            console.error('Invalid species data format. Expected an array but received:', typeof data);
            this.speciesData = [];
            this.activeFileUpload = false;
            return false;
        }
    }
    
    // Species selection change handler
    handleSpeciesChange(event) {
        const species = event.target.value;
        const growthRateField = document.getElementById('growthRate');
        const woodDensityField = document.getElementById('woodDensity');
        const befField = document.getElementById('bef');
        const rsrField = document.getElementById('rsr');
        
        // Track species selection in analytics
        trackEvent('forest_species_selected', {
            species: species,
            timestamp: new Date().toISOString()
        });
        
        // Set default values based on species with safety checks
        if (growthRateField && woodDensityField && befField && rsrField) {
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
        } else {
            console.error('Some form fields for species values not found in DOM');
        }
    }
    
    // Handle form submission with enhanced logging and input prioritization
    handleForestFormSubmit(event) {
        event.preventDefault();
        console.log('%c[ForestCalculator] Calculation initiated', 'color: #2196F3; font-weight: bold');
        
        // Clear previous errors
        if (this.errorMessageDiv) {
            clearForestErrors(this.errorMessageDiv);
        }
        
        // Log species data state before validation
        console.log(`%c[ForestCalculator] Species data status: ${this.speciesData.length} species, activeFileUpload: ${this.activeFileUpload}`, 
            this.activeFileUpload ? 'color: #4CAF50' : 'color: #FF9800');
        
        // Validate inputs from the form
        const inputs = getAndValidateForestInputs(this.errorMessageDiv);
        if (!inputs) {
            console.error('[ForestCalculator] Form validation failed, stopping calculation');
            trackEvent('forest_calculation_validation_failed', {
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        try {
            let results;
            
            // Determine calculation method based on whether species data is uploaded
            if (this.activeFileUpload && this.speciesData.length > 0) {
                console.log('%c[ForestCalculator] Using multi-species calculation with uploaded data', 'color: #4CAF50');
                console.log(`[ForestCalculator] Processing ${this.speciesData.length} species from uploaded file`);
                
                // Add species data to inputs and ensure form defaults are preserved when needed
                const enhancedInputs = {
                    ...inputs,
                    speciesData: this.speciesData
                };
                
                // Log the combined inputs for debugging
                console.log('[ForestCalculator] Combined inputs for calculation:', enhancedInputs);
                
                results = calculateSequestrationMultiSpecies(enhancedInputs, this.speciesData);
                
                trackEvent('forest_calculation_completed', {
                    method: 'multi-species',
                    speciesCount: this.speciesData.length,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log('%c[ForestCalculator] Using single species calculation with default values', 'color: #FF9800');
                // Log the inputs being used for calculation
                console.log('[ForestCalculator] Form inputs for calculation:', inputs);
                
                results = calculateSequestration(inputs);
                
                trackEvent('forest_calculation_completed', {
                    method: 'single-species',
                    species: inputs.species,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Store results for later use
            this.lastCalculationResults = results;
            console.log('%c[ForestCalculator] Calculation completed successfully', 'color: #4CAF50');
            
            // Process cost analysis if cost input is provided
            if (this.projectCostInput && this.projectCostInput.value) {
                const totalCost = parseFloat(this.projectCostInput.value.replace(/,/g, ''));
                if (!isNaN(totalCost) && totalCost > 0) {
                    console.log('[ForestCalculator] Calculating cost analysis');
                    const costAnalysis = calculateForestCostAnalysis(
                        this.activeFileUpload ? results.totalResults : results, 
                        totalCost
                    );
                    
                    // Display cost analysis results
                    this.displayCostAnalysis(costAnalysis);
                }
            }
            
            // Display calculation results with detailed logging
            console.log('[ForestCalculator] Attempting to display results...');
            const displaySuccess = this.displayResults(results);
            
            if (displaySuccess) {
                console.log('%c[ForestCalculator] Results displayed successfully', 'color: #4CAF50');
            } else {
                console.error('[ForestCalculator] Failed to display results');
            }
            
            // Update green cover and carbon credits if setup exists
            if (this.greenCoverAndCreditsSetup && typeof this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation === 'function') {
                this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation(results);
                console.log('[ForestCalculator] Green cover and carbon credits calculation updated');
            }
            
        } catch (error) {
            console.error('%c[ForestCalculator] Calculation error:', 'color: #F44336', error);
            if (this.errorMessageDiv) {
                showForestError(`Error calculating results: ${error.message}`, this.errorMessageDiv);
            }
            
            trackEvent('forest_calculation_error', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Display calculation results
    displayResults(results) {
        // Ensure we have the DOM elements needed
        if (!this.resultsSection || !this.resultsBodyElement || !this.chartElement) {
            console.error('Required DOM elements for displaying results not found');
            console.log('Results section:', this.resultsSection ? 'Found' : 'Missing');
            console.log('Results body:', this.resultsBodyElement ? 'Found' : 'Missing');
            console.log('Chart element:', this.chartElement ? 'Found' : 'Missing');
            return false;
        }
        
        // Get the final results array depending on calculation method
        const resultsArray = Array.isArray(results) ? results : 
                           (results.totalResults ? results.totalResults : null);
        
        if (!resultsArray) {
            console.error('Results not in expected format');
            console.log('Results object:', results);
            return false;
        }
        
        try {
            console.log('Attempting to display results...');
            
            // Display results using the DOM module
            displayForestResults(
                results,
                this.resultsSection,
                this.resultsBodyElement,
                this.chartElement,
                this.errorMessageDiv
            );
            
            // Force show results by removing hidden class and adding needed classes
            console.log('Forcing results section to be visible');
            this.resultsSection.classList.remove('hidden');
            this.resultsSection.classList.add('show-results');
            this.resultsSection.style.display = 'block';
            this.resultsSection.style.visibility = 'visible';
            this.resultsSection.style.opacity = '1';
            
            // Log visibility status for debugging
            console.log('Results section visibility state:', {
                hidden: this.resultsSection.classList.contains('hidden'),
                showResults: this.resultsSection.classList.contains('show-results'),
                display: this.resultsSection.style.display,
                visibility: this.resultsSection.style.visibility,
                computedStyle: window.getComputedStyle(this.resultsSection).display
            });
            
            // Update summary metrics
            this.updateSummaryMetrics(resultsArray);
            
            // Add direct DOM check for results section position and dimensions
            console.log('Results section rect:', this.resultsSection.getBoundingClientRect());
            
            // Scroll to results with a slight delay to ensure rendering is complete
            setTimeout(() => {
                this.resultsSection.scrollIntoView({ behavior: 'smooth' });
                console.log('Scrolled to results section');
            }, 100);
            
            return true;
        } catch (error) {
            console.error('Error displaying results:', error);
            return false;
        }
    }
    
    // Update summary metrics in the results section
    updateSummaryMetrics(results) {
        if (!results || !results.length) return;
        
        const finalResult = results[results.length - 1];
        const totalNetCO2eElement = document.getElementById('totalNetCO2e');
        
        if (totalNetCO2eElement && finalResult) {
            totalNetCO2eElement.textContent = finalResult.cumulativeNetCO2e || "0.00";
        }
    }
    
    // Display cost analysis results
    displayCostAnalysis(costAnalysis) {
        if (!costAnalysis) return;
        
        const totalSeqElement = document.getElementById('totalSequestrationCostDisplay');
        const totalCostElement = document.getElementById('totalProjectCostDisplay');
        const costPerTonneElement = document.getElementById('costPerTonneDisplay');
        const costPerHaPerTonneElement = document.getElementById('costPerHectarePerTonneDisplay');
        const costBreakdownElement = document.getElementById('costBreakdown');
        
        if (totalSeqElement) totalSeqElement.textContent = costAnalysis.totalSequestration || "0.00";
        if (totalCostElement) totalCostElement.textContent = costAnalysis.totalProjectCost || "₹ 0";
        if (costPerTonneElement) costPerTonneElement.textContent = costAnalysis.costPerTonne || "₹ 0";
        if (costPerHaPerTonneElement) costPerHaPerTonneElement.textContent = costAnalysis.costPerHectarePerTonne || "₹ 0";
        if (costBreakdownElement) costBreakdownElement.innerHTML = costAnalysis.costBreakdown || "";
    }
    
    // Reset the calculator to initial state
    resetForestCalculator() {
        console.log('Resetting forest calculator');
        
        // Reset the form if it exists
        if (this.form) {
            this.form.reset();
        }
        
        // Hide results section
        if (this.resultsSection) {
            this.resultsSection.classList.add('hidden');
        }
        
        // Clear error messages
        clearForestErrors(this.errorMessageDiv);
        
        // Reset charts
        resetForestCharts();
        
        // Track reset event
        trackEvent('forest_calculator_reset', {
            timestamp: new Date().toISOString()
        });
        
        // Clear last results
        this.lastCalculationResults = null;
    }
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing Forest Calculator');
    
    try {
        const forestCalculator = new ForestCalculatorManager();
        
        // Store the instance globally for access from other scripts
        window.forestCalculator = forestCalculator;
        
        // Initialize the calculator
        const initialized = forestCalculator.init();
        
        if (initialized) {
            console.log('Forest Calculator initialized successfully and ready for use');
        } else {
            console.error('Forest Calculator initialization failed or incomplete');
            
            // Setup fallback handlers if initialization failed
            console.warn('Setting up fallback handlers due to initialization failure');
            setupFallbackHandlers();
        }
    } catch (error) {
        console.error('Critical error during Forest Calculator initialization:', error);
        setupFallbackHandlers();
    }
    
    function setupFallbackHandlers() {
        // Provide basic fallback functionality if initialization fails
        window.forestCalculator = {
            getSpeciesData: () => [],
            isActiveFileUpload: () => false
        };
    }
});

// Export functions to global scope for backup handlers
window.forestIO = {
    downloadExcelTemplate,
    generateForestPdf,
    exportForestExcel,
    getSpeciesData: () => window.forestCalculator ? window.forestCalculator.getSpeciesData() : []
};
