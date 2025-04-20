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
        this.calculateBtn = document.getElementById('calculateForestBtn'); // Fixed ID to match HTML
        this.resetBtn = document.getElementById('resetForestBtn'); // Fixed ID to match HTML
        this.btnSpinner = document.getElementById('btnSpinner');
        this.errorMessageDiv = document.getElementById('errorMessageForest');
        this.resultsSection = document.getElementById('resultsSectionForest');
        this.projectCostInput = document.getElementById('forestProjectCost'); // Fixed ID to match HTML
        
        console.log('Initializing forest calculator with elements:', {
            form: this.form ? 'Found' : 'Not found',
            calculateBtn: this.calculateBtn ? 'Found' : 'Not found',
            resetBtn: this.resetBtn ? 'Found' : 'Not found',
            errorMessageDiv: this.errorMessageDiv ? 'Found' : 'Not found',
            resultsSection: this.resultsSection ? 'Found' : 'Not found',
            projectCostInput: this.projectCostInput ? 'Found' : 'Not found'
        });

        // Set up calculate button
        if (this.calculateBtn) {
            console.log('Setting up calculate button listener');
            this.calculateBtn.addEventListener('click', this.handleForestFormSubmit.bind(this));
        } else {
            console.warn('Calculate button not found with ID: calculateForestBtn');
        }
        
        // Set up reset button
        if (this.resetBtn) {
            console.log('Setting up reset button listener');
            this.resetBtn.addEventListener('click', this.resetForestCalculator.bind(this));
        }
        
        // Set up reset links on input fields
        if (this.form) {
            this.form.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('reset-btn')) {
                    const inputId = target.getAttribute('data-for');
                    if (inputId) {
                        const input = document.getElementById(inputId);
                        if (input && input.hasAttribute('data-default')) {
                            input.value = input.getAttribute('data-default');
                        }
                    }
                }
            });
        }
        
        // Set up input handlers
        this.setupInputHandlers();
        
        // Set up file uploads - provides functions to handle species file upload
        const fileUploadHandlers = setupForestFileUploads();
        if (fileUploadHandlers) {
            console.log('File upload handlers initialized');
            // The event listeners are set up in setupForestFileUploads
            // We just store methods and state for later access
            this.getSpeciesData = fileUploadHandlers.getSpeciesData;
            this.isActiveFileUpload = fileUploadHandlers.isActiveFileUpload;
        }
        
        // Set up PDF and Excel export buttons
        const generateForestPdfBtn = document.getElementById('generateForestPdfBtn'); // Fixed ID to match HTML
        if (generateForestPdfBtn) {
            generateForestPdfBtn.addEventListener('click', generateForestPdf);
        } else {
            console.warn('PDF button not found with ID: generateForestPdfBtn');
        }

        const exportForestExcelBtn = document.getElementById('exportForestExcelBtn');
        if (exportForestExcelBtn) {
            exportForestExcelBtn.addEventListener('click', exportForestExcel);
        } else {
            console.warn('Excel button not found with ID: exportForestExcelBtn');
        }
        
        // Initialize enhanced features
        this.greenCoverAndCreditsSetup = setupGreenCoverAndCredits(this.speciesData);
        
        console.log('Forest calculator initialization complete');
    }
    
    /**
     * Handle form submission
     */
    handleForestFormSubmit(event) {
        console.log('Forest calculation button clicked');
        if (event) {
            event.preventDefault();
        }
        
        // Show spinner
        if (this.calculateBtn) this.calculateBtn.disabled = true;
        if (this.btnSpinner) this.btnSpinner.style.display = 'inline-block';
        
        // Track calculation attempt
        analytics.trackEvent('forest_calculation_attempt', {
            type: this.activeFileUpload ? 'multi_species' : 'single_species'
        });
        
        setTimeout(() => {
            try {
                console.log('Getting form inputs');
                
                // Get form inputs directly
                const inputs = {
                    projectDuration: parseInt(document.getElementById('projectDuration').value) || 20,
                    projectArea: parseFloat(document.getElementById('projectArea').value) || 10,
                    plantingDensity: parseInt(document.getElementById('plantingDensity').value) || 1600,
                    growthRate: parseFloat(document.getElementById('growthRate').value) || 10,
                    woodDensity: parseFloat(document.getElementById('woodDensity').value) || 0.5,
                    bef: parseFloat(document.getElementById('bef').value) || 1.5,
                    rsr: parseFloat(document.getElementById('rsr').value) || 0.25,
                    carbonFraction: parseFloat(document.getElementById('carbonFraction').value) || 0.47,
                    survivalRate: parseInt(document.getElementById('survivalRate').value) || 85,
                    siteQuality: document.getElementById('siteQuality').value || 'Medium',
                    avgRainfall: document.getElementById('avgRainfall').value || 'Medium',
                    soilType: document.getElementById('soilType').value || 'Loam'
                };
                
                console.log('Form inputs:', inputs);
                
                // Get species data from file upload if present
                const isFileUploadActive = this.isActiveFileUpload ? this.isActiveFileUpload() : false;
                const speciesData = this.getSpeciesData ? this.getSpeciesData() : [];
                
                console.log('Species data from file upload:', {
                    isActive: isFileUploadActive,
                    speciesCount: speciesData.length
                });
                
                // Calculate results
                let results;
                
                // If species data is uploaded, use multi-species calculation
                if (isFileUploadActive && speciesData.length > 0) {
                    console.log('Running multi-species calculation');
                    results = calculateSequestrationMultiSpecies(inputs, speciesData);
                } else {
                    // Basic calculation for single species
                    console.log('Running single species calculation');
                    const annualResults = calculateSequestration(inputs);
                    results = {
                        totalResults: annualResults,
                        speciesResults: [
                            {
                                speciesName: 'Default Species',
                                results: annualResults
                            }
                        ]
                    };
                }
                
                console.log('Calculation complete, displaying results');
                
                // Track successful calculation
                analytics.trackEvent('forest_calculation_success', {
                    type: isFileUploadActive ? 'multi_species' : 'single_species',
                    species: isFileUploadActive ? `${speciesData.length} species` : 'default',
                    duration: inputs.projectDuration,
                    area: inputs.projectArea
                });
                
                // Display results
                displayForestResults(
                    results, 
                    this.resultsSection,
                    document.getElementById('resultsBodyForest'),
                    document.getElementById('sequestrationChart'),
                    this.errorMessageDiv
                );
                
                // Handle cost analysis
                this.handleCostAnalysis(results);
                
                // Update VERs and carbon credits if the enhancement module is set up
                if (this.greenCoverAndCreditsSetup && this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation) {
                    this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation(results);
                }
                
                // Make sure results section is visible
                if (this.resultsSection) {
                    console.log('Found results section, attempting to show');
                    this.resultsSection.classList.remove('hidden');
                    // Scroll to results
                    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
                    console.log('Results should now be visible, hidden class removed');
                } else {
                    console.error('Results section element not found! ID should be resultsSectionForest');
                }
                
            } catch (error) {
                console.error("Calculation error:", error);
                showForestError("An error occurred during calculations. Please check your inputs.", this.errorMessageDiv);
                
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
        console.log('Handling cost analysis');
        
        const projectCost = this.projectCostInput ? parseFloat(this.projectCostInput.value.replace(/,/g, '')) : 0;
        
        // Only calculate costs if there's a valid cost input
        if (!isNaN(projectCost) && projectCost > 0) {
            console.log('Valid project cost found:', projectCost);
            
            // Simple cost analysis calculation
            const finalYear = results.totalResults[results.totalResults.length - 1];
            const totalSequestration = finalYear.cumulativeNetCO2e;
            
            // Cost metrics
            const costPerTonne = projectCost / totalSequestration;
            const costPerHectarePerTonne = costPerTonne / parseFloat(document.getElementById('projectArea').value);
            
            // Update cost analysis display
            document.getElementById('totalSequestrationCostDisplay').textContent = 
                totalSequestration.toLocaleString('en-US', {maximumFractionDigits: 2});
            
            document.getElementById('totalProjectCostDisplay').textContent = 
                projectCost.toLocaleString('en-US');
            
            document.getElementById('costPerTonneDisplay').textContent = 
                costPerTonne.toLocaleString('en-US', {maximumFractionDigits: 2});
            
            document.getElementById('costPerHectarePerTonneDisplay').textContent = 
                costPerHectarePerTonne.toLocaleString('en-US', {maximumFractionDigits: 2});
            
            // Ensure cost analysis section is visible
            const costAnalysisElement = document.getElementById('costAnalysisResults');
            if (costAnalysisElement) {
                costAnalysisElement.classList.remove('hidden');
            }
            
        } else {
            console.log('No valid project cost found, skipping cost analysis');
            // Hide cost analysis section if no valid cost
            const costAnalysisElement = document.getElementById('costAnalysisResults');
            if (costAnalysisElement) {
                costAnalysisElement.classList.add('hidden');
            }
        }
    }
    
    /**
     * Reset the calculator
     */
    resetForestCalculator() {
        console.log('Resetting forest calculator');
        
        // Reset form
        if (this.form) {
            this.form.reset();
        }
        
        // Clear errors
        if (this.errorMessageDiv) {
            this.errorMessageDiv.textContent = '';
            this.errorMessageDiv.classList.add('hidden');
        }
        
        // Reset species data
        this.speciesData = [];
        this.activeFileUpload = false;
        
        const speciesList = document.getElementById('speciesList');
        if (speciesList) {
            speciesList.innerHTML = '';
        }
        
        // Hide results
        if (this.resultsSection) {
            this.resultsSection.classList.add('hidden');
        }
        
        // Reset file input
        const fileInput = document.getElementById('speciesFile');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Track reset event
        analytics.trackEvent('forest_calculator_reset');
        
        console.log('Forest calculator reset complete');
    }
    
    /**
     * Set up input change handlers
     */
    setupInputHandlers() {
        // Set up reset buttons for inputs with default values
        document.querySelectorAll('.reset-btn').forEach(button => {
            const inputId = button.getAttribute('data-for');
            if (inputId) {
                button.addEventListener('click', () => {
                    const input = document.getElementById(inputId);
                    if (input && input.hasAttribute('data-default')) {
                        input.value = input.getAttribute('data-default');
                    }
                });
            }
        });

        // Handle dead attribute slider
        const deadAttributeSlider = document.getElementById('deadAttributeSlider');
        const deadAttributeValue = document.getElementById('deadAttributeValue');
        
        if (deadAttributeSlider && deadAttributeValue) {
            deadAttributeSlider.addEventListener('input', () => {
                deadAttributeValue.textContent = `${deadAttributeSlider.value}%`;
            });
        }
        
        // Handle custom carbon price section toggle
        const carbonPriceSelect = document.getElementById('carbonPriceSelect');
        const customCarbonPriceContainer = document.getElementById('customCarbonPriceContainer');
        
        if (carbonPriceSelect && customCarbonPriceContainer) {
            carbonPriceSelect.addEventListener('change', () => {
                if (carbonPriceSelect.value === 'custom') {
                    customCarbonPriceContainer.classList.remove('hidden');
                } else {
                    customCarbonPriceContainer.classList.add('hidden');
                }
            });
        }
    }
}

// Create a singleton instance
export const forestCalculator = new ForestCalculatorManager();

/**
 * Main setup function for the afforestation calculator
 * @returns Object with public methods
 */
export function setupAfforestationCalculator() {
    console.log('Setting up afforestation calculator');
    
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
