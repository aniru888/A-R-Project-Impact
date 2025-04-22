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
    generateForestPdf,
    exportForestExcel,
    setupForestFileUploads
} from './forestIO.js';

import { setupGreenCoverAndCredits } from './forestEnhanced.js';

import { analytics } from '../analytics.js';

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
        this.projectCostInput = null;
        this.getSpeciesData = () => [];
        this.isActiveFileUpload = () => false;
    }
    
    init() {
        this.form = document.getElementById('calculatorForm');
        this.calculateBtn = document.getElementById('calculateForestBtn');
        this.resetBtn = document.getElementById('resetForestBtn');
        this.errorMessageDiv = document.getElementById('errorMessageForest');
        this.resultsSection = document.getElementById('resultsSectionForest');
        this.projectCostInput = document.getElementById('forestProjectCost');
        
        console.log('Initializing forest calculator with elements:', {
            form: this.form ? 'Found' : 'Not found',
            calculateBtn: this.calculateBtn ? 'Found' : 'Not found',
            resetBtn: this.resetBtn ? 'Found' : 'Not found',
            errorMessageDiv: this.errorMessageDiv ? 'Found' : 'Not found',
            resultsSection: this.resultsSection ? 'Found' : 'Not found',
            projectCostInput: this.projectCostInput ? 'Found' : 'Not found'
        });

        if (this.calculateBtn) {
            console.log('Setting up calculate button listener');
            this.calculateBtn.addEventListener('click', this.handleForestFormSubmit.bind(this));
        } else {
            console.warn('Calculate button not found with ID: calculateForestBtn');
        }
        
        if (this.resetBtn) {
            console.log('Setting up reset button listener');
            this.resetBtn.addEventListener('click', this.resetForestCalculator.bind(this));
        }
        
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
        
        this.setupInputHandlers();
        
        const fileUploadHandlers = setupForestFileUploads();
        if (fileUploadHandlers) {
            console.log('File upload handlers initialized');
            this.getSpeciesData = fileUploadHandlers.getSpeciesData;
            this.isActiveFileUpload = fileUploadHandlers.isActiveFileUpload;
        }
        
        const generateForestPdfBtn = document.getElementById('generateForestPdfBtn');
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
        
        this.greenCoverAndCreditsSetup = setupGreenCoverAndCredits(this.getSpeciesData);
        
        console.log('Forest calculator initialization complete');
    }
    
    handleForestFormSubmit(event) {
        console.log('Forest calculation button clicked');
        if (event) {
            event.preventDefault();
        }
        
        if (this.calculateBtn) this.calculateBtn.disabled = true;
        
        clearForestErrors();

        const isFileUploadActive = this.isActiveFileUpload();
        const currentSpeciesData = this.getSpeciesData();

        analytics.trackEvent('forest_calculation_attempt', {
            type: isFileUploadActive ? 'multi_species' : 'single_species',
            species_count: isFileUploadActive ? currentSpeciesData.length : 0
        });

        setTimeout(() => {
            try {
                console.log('Getting form inputs for calculation');

                const inputs = getAndValidateForestInputs(this.errorMessageDiv);
                if (!inputs) {
                    console.error("Input validation failed. Calculation stopped.");
                    throw new Error("Input validation failed.");
                }

                console.log('Form inputs validated:', inputs);
                console.log('Species data state for calculation:', {
                    isActive: isFileUploadActive,
                    speciesCount: currentSpeciesData.length
                });

                let results;

                if (isFileUploadActive && currentSpeciesData.length > 0) {
                    console.log('Running multi-species calculation');
                    results = calculateSequestrationMultiSpecies(inputs, currentSpeciesData);
                    if (!results || !results.totalResults || results.totalResults.length === 0) {
                        throw new Error("Multi-species calculation returned invalid results.");
                    }
                } else {
                    console.log('Running single species calculation');
                    const annualResults = calculateSequestration(inputs);
                    if (!annualResults || annualResults.length === 0) {
                        throw new Error("Single-species calculation returned invalid results.");
                    }
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

                console.log('Calculation complete, attempting to display results');

                analytics.trackEvent('forest_calculation_success', {
                    type: isFileUploadActive ? 'multi_species' : 'single_species',
                    species: isFileUploadActive ? `${currentSpeciesData.length} species` : 'default',
                    duration: inputs.projectDuration,
                    area: inputs.projectArea
                });

                displayForestResults(
                    results,
                    this.resultsSection,
                    document.getElementById('resultsBodyForest'),
                    document.getElementById('sequestrationChart'),
                    this.errorMessageDiv
                );

                this.handleCostAnalysis(results);

                if (this.greenCoverAndCreditsSetup && this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation) {
                    this.greenCoverAndCreditsSetup.updateCarbonCreditsCalculation(results);
                }

                if (this.resultsSection && this.resultsSection.classList.contains('hidden')) {
                    console.warn("Results section still hidden after displayForestResults call. Forcing removal.");
                    this.resultsSection.classList.remove('hidden');
                    this.resultsSection.style.display = 'block';
                    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
                } else if (this.resultsSection) {
                    console.log("Results section should be visible.");
                    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
                } else {
                    console.error('Results section element not found after calculation!');
                }

            } catch (error) {
                console.error("Calculation or display error:", error);
                showForestError(`Calculation failed: ${error.message}. Please check inputs and console.`, this.errorMessageDiv);

                analytics.trackEvent('forest_calculation_error', {
                    error: error.message
                });
                if (this.resultsSection) {
                    this.resultsSection.classList.add('hidden');
                }
            } finally {
                if (this.calculateBtn) this.calculateBtn.disabled = false;
                console.log("Calculation process finished.");
            }
        }, 50);
    }
    
    handleCostAnalysis(results) {
        console.log('Handling cost analysis');
        
        const projectCost = this.projectCostInput ? parseFloat(this.projectCostInput.value.replace(/,/g, '')) : 0;
        
        if (!isNaN(projectCost) && projectCost > 0) {
            console.log('Valid project cost found:', projectCost);
            
            const finalYear = results.totalResults[results.totalResults.length - 1];
            const totalSequestration = finalYear.cumulativeNetCO2e;
            
            const costPerTonne = projectCost / totalSequestration;
            const costPerHectarePerTonne = costPerTonne / parseFloat(document.getElementById('projectArea').value);
            
            document.getElementById('totalSequestrationCostDisplay').textContent = 
                totalSequestration.toLocaleString('en-US', {maximumFractionDigits: 2});
            
            document.getElementById('totalProjectCostDisplay').textContent = 
                projectCost.toLocaleString('en-US');
            
            document.getElementById('costPerTonneDisplay').textContent = 
                costPerTonne.toLocaleString('en-US', {maximumFractionDigits: 2});
            
            document.getElementById('costPerHectarePerTonneDisplay').textContent = 
                costPerHectarePerTonne.toLocaleString('en-US', {maximumFractionDigits: 2});
            
            const costAnalysisElement = document.getElementById('costAnalysisResults');
            if (costAnalysisElement) {
                costAnalysisElement.classList.remove('hidden');
            }
            
        } else {
            console.log('No valid project cost found, skipping cost analysis');
            const costAnalysisElement = document.getElementById('costAnalysisResults');
            if (costAnalysisElement) {
                costAnalysisElement.classList.add('hidden');
            }
        }
    }
    
    resetForestCalculator() {
        console.log('Resetting forest calculator');
        
        if (this.form) {
            this.form.reset();
            // Reset dead attribute input to default value of 0
            const deadAttributeInput = document.getElementById('deadAttribute');
            if (deadAttributeInput) deadAttributeInput.value = 0;
            
            const carbonPriceSelect = document.getElementById('carbonPriceSelect');
            if (carbonPriceSelect) carbonPriceSelect.value = '10';
            const customCarbonPriceContainer = document.getElementById('customCarbonPriceContainer');
            if (customCarbonPriceContainer) customCarbonPriceContainer.classList.add('hidden');
        }
        
        if (this.errorMessageDiv) {
            this.errorMessageDiv.textContent = '';
            this.errorMessageDiv.classList.add('hidden');
        }
        
        this.speciesData = [];
        this.activeFileUpload = false;
        
        const speciesList = document.getElementById('speciesList');
        if (speciesList) {
            speciesList.innerHTML = '';
        }
        
        if (this.resultsSection) {
            this.resultsSection.classList.add('hidden');
        }
        
        const fileInput = document.getElementById('speciesFile');
        if (fileInput) {
            fileInput.value = '';
        }
        
        resetForestCharts();
        
        analytics.trackEvent('forest_calculator_reset');
        
        console.log('Forest calculator reset complete');
    }
    
    setupInputHandlers() {
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

        const deadAttributeInput = document.getElementById('deadAttribute');
        if (deadAttributeInput) {
            // Make sure input is initialized with default value
            if (deadAttributeInput.value === '') {
                deadAttributeInput.value = 0;
            }
        }
        
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

export const forestCalculator = new ForestCalculatorManager();

export function setupAfforestationCalculator() {
    console.log('Setting up afforestation calculator module');

    forestCalculator.init();

    console.log('Afforestation calculator module setup complete');

    return {
        resetForestCalculator: forestCalculator.resetForestCalculator.bind(forestCalculator),
        handleForestFormSubmit: forestCalculator.handleForestFormSubmit.bind(forestCalculator)
    };
}

export function parseNumberWithCommas(str) {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, '')) || 0;
}

// Expose key functions to global scope for backup event handlers
// This ensures that even if the ES6 module initialization fails,
// the backup handlers will have access to these functions
if (typeof window !== 'undefined') {
    window.forestCalculator = forestCalculator;
}
