// forestMain.js - Main entry point for the afforestation calculator

// Import dependencies
import { 
    calculateSequestration, 
    calculateSpeciesSequestration, 
    calculateSequestrationMultiSpecies,
    calculateForestCostAnalysis
} from './forestCalcs.js';

import { 
    updateForestTable, 
    updateForestChart, 
    displayForestResults,
    showForestError,
    clearForestErrors,
    validateForestInput,
    resetForestCharts,
    getAndValidateForestInputs
} from './forestDOM.js';

import {
    downloadExcelTemplate,
    handleSpeciesFileUpload,
    generateForestPdf,
    exportForestExcel,
    initializeForestIO,
    setupForestFileUploads
} from './forestIO.js';

import { setupGreenCoverAndCredits } from './forestEnhanced.js';

// Import analytics for tracking user interactions
import { analytics } from '../analytics.js';

// Constants
export const C_TO_CO2 = 44 / 12;
export const MIN_DURATION = 4;
export const MAX_DURATION = 50;
export const MIN_DENSITY = 100;

/**
 * Forest Calculator Manager Class
 * Handles all functionality related to the forest carbon calculator
 */
export class ForestCalculatorManager {
    constructor() {
        // State variables
        this.speciesData = []; // Store uploaded species data
        this.activeFileUpload = false; // Track if file upload is being used
        this.greenCoverAndCreditsSetup = null; // Store exported functions from setupGreenCoverAndCredits
        
        // Form elements (initialized in init())
        this.form = null;
        this.calculateBtn = null;
        this.resetBtn = null;
        this.btnSpinner = null;
        this.errorMessageDiv = null;
        this.resultsSection = null;
        this.projectCostInput = null;
    }
    
    /**
     * Initialize the calculator
     */
    init() {
        // Get form elements
        this.form = document.getElementById('calculatorForm');
        this.calculateBtn = document.getElementById('calculateBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.btnSpinner = document.getElementById('btnSpinner');
        this.errorMessageDiv = document.getElementById('errorMessageForest');
        this.resultsSection = document.getElementById('resultsSectionForest');
        this.projectCostInput = document.getElementById('projectCost');
        
        // Set up form submission
        this.form?.addEventListener('submit', this.handleForestFormSubmit.bind(this));
        
        // Set up reset button
        if (this.form) {
            this.form.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('reset-btn')) {
                    this.resetForestCalculator();
                }
            });
        }
        
        // Direct reset button handler
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', this.resetForestCalculator.bind(this));
        }
        
        // Set up input handlers
        this.setupInputHandlers();
        
        // Set up file uploads - provides functions to handle species file upload
        const fileUploadHandlers = setupForestFileUploads();
        if (fileUploadHandlers) {
            const speciesFileEl = document.getElementById('speciesFile');
            if (speciesFileEl && fileUploadHandlers.handleSpeciesFileUpload) {
                speciesFileEl.addEventListener('change', (event) => {
                    const result = fileUploadHandlers.handleSpeciesFileUpload(event);
                    if (result) {
                        this.speciesData = result.speciesData;
                        this.activeFileUpload = result.activeFileUpload;
                        
                        // Initialize green cover and carbon credits
                        if (setupGreenCoverAndCredits) {
                            this.greenCoverAndCreditsSetup = setupGreenCoverAndCredits(this.speciesData);
                        }
                    }
                });
            }
        }
        
        // Set up PDF and Excel export buttons
        const printForestPdfBtn = document.getElementById('printForestPdfBtn');
        if (printForestPdfBtn) {
            printForestPdfBtn.addEventListener('click', generateForestPdf);
        }

        const exportForestExcelBtn = document.getElementById('exportForestExcelBtn');
        if (exportForestExcelBtn) {
            exportForestExcelBtn.addEventListener('click', exportForestExcel);
        }
        
        // Initialize enhanced features
        this.greenCoverAndCreditsSetup = setupGreenCoverAndCredits(this.speciesData);
    }
    
    /**
     * Handle form submission
     */
    handleForestFormSubmit(event) {
        event.preventDefault();
        
        // Show spinner
        if (this.calculateBtn) this.calculateBtn.disabled = true;
        if (this.btnSpinner) this.btnSpinner.style.display = 'inline-block';
        
        // Track calculation attempt
        analytics.trackEvent('forest_calculation_attempt', {
            type: this.activeFileUpload ? 'multi_species' : 'single_species'
        });
        
        setTimeout(() => {
            try {
                // Validate inputs
                const inputs = getAndValidateForestInputs();
                if (!inputs) {
                    if (this.calculateBtn) this.calculateBtn.disabled = false;
                    if (this.btnSpinner) this.btnSpinner.style.display = 'none';
                    // Track validation failure
                    analytics.trackEvent('forest_validation_error');
                    return;
                }
                
                // Get results
                let results;
                
                // If species data is uploaded, use multi-species calculation
                if (this.activeFileUpload && this.speciesData && this.speciesData.length > 0) {
                    results = calculateSequestrationMultiSpecies(inputs, this.speciesData);
                } else {
                    // Basic calculation for single species
                    const annualResults = calculateSequestration(inputs);
                    results = {
                        totalResults: annualResults,
                        speciesResults: [
                            {
                                speciesName: inputs.species === 'eucalyptus_fast' ? 'Eucalyptus' : 
                                             inputs.species === 'teak_moderate' ? 'Teak' : 'Native Species',
                                results: annualResults
                            }
                        ]
                    };
                }
                
                // Track successful calculation
                analytics.trackEvent('forest_calculation_success', {
                    type: this.activeFileUpload ? 'multi_species' : 'single_species',
                    species: this.activeFileUpload ? `${this.speciesData.length} species` : inputs.species,
                    duration: inputs.projectDuration,
                    area: inputs.projectArea
                });
                
                // Display results
                displayForestResults(
                    results, 
                    document.getElementById('resultsSectionForest'),
                    document.getElementById('resultsBodyForest'),
                    document.getElementById('sequestrationChart'),
                    this.errorMessageDiv
                );
                
                // Handle cost analysis
                this.handleCostAnalysis(results);
                
                // Update VERs and carbon credits if the enhancement module is set up
                if (this.greenCoverAndCreditsSetup) {
                    this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation(results);
                }
                
            } catch (error) {
                console.error("Calculation error:", error);
                showForestError("An error occurred during calculations. Please check your inputs.");
                
                // Track calculation error
                analytics.trackEvent('forest_calculation_error', {
                    error: error.message
                });
            } finally {
                // Hide spinner
                if (this.calculateBtn) this.calculateBtn.disabled = false;
                if (this.btnSpinner) this.btnSpinner.style.display = 'none';
            }
        }, 100); // Small delay for UI responsiveness
    }
    
    /**
     * Handle cost analysis calculations and display
     */
    handleCostAnalysis(results) {
        const rawProjectCost = this.projectCostInput?.value?.replace(/[^\d,]/g, '').replace(/,/g, '') || "0";
        const projectCost = parseInt(rawProjectCost);
        
        // Only calculate costs if there's a valid cost input
        if (!isNaN(projectCost) && projectCost > 0) {
            const costAnalysis = calculateForestCostAnalysis(results.totalResults, projectCost);
            
            // Update cost analysis display
            document.getElementById('totalSequestration').textContent = costAnalysis.totalSequestration;
            document.getElementById('totalProjectCost').textContent = costAnalysis.totalProjectCost;
            document.getElementById('costPerTonne').textContent = costAnalysis.costPerTonne;
            
            const costBreakdownDiv = document.getElementById('costBreakdown');
            if (costBreakdownDiv) {
                costBreakdownDiv.innerHTML = costAnalysis.costBreakdown;
            }
        } else {
            // Display N/A for cost metrics if no valid cost provided
            document.getElementById('totalSequestration').textContent = parseFloat(results.totalResults[results.totalResults.length - 1].cumulativeNetCO2e).toLocaleString('en-IN', {maximumFractionDigits: 2, minimumFractionDigits: 2}) + ' tCO₂e';
            document.getElementById('totalProjectCost').textContent = 'N/A';
            document.getElementById('costPerTonne').textContent = 'N/A';
        }
    }
    
    /**
     * Reset the calculator
     */
    resetForestCalculator() {
        // Reset form
        this.form?.reset();
        
        // Clear errors
        clearForestErrors();
        
        // Reset species data
        this.speciesData = [];
        this.activeFileUpload = false;
        const speciesList = document.getElementById('speciesList');
        if (speciesList) speciesList.innerHTML = '';
        
        // Hide results
        if (this.resultsSection) this.resultsSection.classList.add('hidden');
        
        // Reset charts
        resetForestCharts(document.getElementById('sequestrationChart'));
        
        // Reset any species-specific charts
        const speciesChartsContainer = document.querySelector('#forestProjectContent .species-charts-container');
        if (speciesChartsContainer) speciesChartsContainer.innerHTML = '';
        
        // Track reset event
        analytics.trackEvent('forest_calculator_reset');
    }
    
    /**
     * Set up input change handlers
     */
    setupInputHandlers() {
        // Set up listeners for all inputs to clear errors on change
        const forestInputs = document.querySelectorAll('#calculatorForm .input-field');
        forestInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    input.classList.remove('input-error');
                    if (this.errorMessageDiv) this.errorMessageDiv.classList.add('hidden');
                });
            }
        });

        // Format project cost input with thousands separators
        if (this.projectCostInput) {
            this.projectCostInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^\d,]/g, '');
                value = value.replace(/,/g, '');
                if (value) {
                    value = parseInt(value).toLocaleString('en-IN');
                }
                e.target.value = value;
            });
        }
    }
    
    /**
     * Calculate risk rate for a project
     */
    calculateRiskRate(projectType, inputs) {
        // Base risk rates for different project types
        const baseRisk = {
            forest: 0.1, // 10% base risk for forest projects
            water: 0.05  // 5% base risk for water projects
        };
        
        let riskRate = baseRisk[projectType] || 0.1; // Default to 10% if project type not recognized
        
        if (projectType === 'forest') {
            // Adjust risk based on site quality
            if (inputs.siteQuality === 'Poor') riskRate += 0.05; // Higher risk for poor site
            if (inputs.siteQuality === 'Good') riskRate -= 0.03; // Lower risk for good site
            
            // Adjust risk based on rainfall
            if (inputs.avgRainfall === 'Low') riskRate += 0.03; // Higher risk in low rainfall areas
            
            // Adjust risk based on soil type
            if (inputs.soilType === 'Degraded') riskRate += 0.04; // Higher risk on degraded soil
            
            // Adjust risk based on species diversity (lower risk with more species)
            if (this.speciesData && this.speciesData.length > 1) {
                riskRate -= Math.min(0.05, this.speciesData.length * 0.01);
            }
        }
        
        // Ensure risk rate is within reasonable bounds (5% to 25%)
        return Math.max(0.05, Math.min(0.25, riskRate));
    }
}

// Create a singleton instance
export const forestCalculator = new ForestCalculatorManager();

/**
 * Main setup function for the afforestation calculator
 * @returns Object with public methods
 */
export function setupAfforestationCalculator() {
    // Initialize the calculator manager
    forestCalculator.init();
    
    // Return any functions that need to be accessed by other modules
    return {
        resetForestCalculator: forestCalculator.resetForestCalculator.bind(forestCalculator),
        handleForestFormSubmit: forestCalculator.handleForestFormSubmit.bind(forestCalculator)
    };
}

// Helper function to parse numbers with commas
export function parseNumberWithCommas(str) {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, '')) || 0;
}
