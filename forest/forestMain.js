import { 
    forestEventSystem, 
    calculateSequestration, 
    calculateForestCostAnalysis, 
    calculateSequestrationMultiSpecies
} from './forestCalcs.js';
import { 
    initForestDOM, 
    cleanupForestDOM,
    getAndValidateForestInputs, 
    showForestError, 
    displayForestResults,
    clearForestErrors,
    resetForestCharts,
    showForestResults
} from './forestDOM.js';
import { initForestIO, cleanupForestIO, getLoadedSpeciesData, isMultiSpeciesMode } from './forestIO.js';
import { analytics } from '../analytics.js'; // Import analytics as a module

// Class to handle the forest calculator functionality
class ForestCalculator {
    constructor() {
        this.results = null;
        this.costAnalysis = null;
        this.initialized = false;
        this.calculationInProgress = false;
        // Track event listeners for proper cleanup
        this.eventListeners = [];
    }
    
    /**
     * Initialize the forest calculator
     */
    init() {
        console.log('Initializing forest calculator');
        
        try {
            // First initialize the event system and check if it was successful
            const eventSystemInitialized = forestEventSystem.init().initialized;
            
            if (!eventSystemInitialized) {
                console.error('Failed to initialize forest event system');
                throw new Error('Forest event system initialization failed');
            }
            
            console.log('Forest event system initialized:', eventSystemInitialized);
            
            // Initialize the DOM module so it registers its callbacks with the event system
            initForestDOM({ setupEventListeners: false });
            
            // Register event handlers with the event system
            // Any methods not registered by the DOM module will be registered here
            forestEventSystem.registerEvents({
                onError: this.handleError.bind(this),
                onResults: this.displayResults.bind(this),
                onReset: this.resetForestCalculator.bind(this),
                // These are already registered by the DOM module
                // onValidationError: getAndValidateForestInputs,
                // showError: showForestError
            });
            
            // Initialize IO components after DOM is ready
            initForestIO();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Mark as initialized
            this.initialized = true;
            
            console.log('Forest calculator initialized successfully');
            
            // Make calculator available globally for debugging
            window.forestCalculator = this;
        } catch (error) {
            console.error('Error initializing forest calculator:', error);
            // Use the event system to show errors
            if (forestEventSystem.initialized) {
                forestEventSystem.showError(`Initialization error: ${error.message}`);
            } else {
                // Fallback if event system isn't available
                const errorMsg = `Forest calculator initialization failed: ${error.message}`;
                console.error(errorMsg);
                alert(errorMsg); // Simple fallback to alert the user
            }
        }
    }
    
    /**
     * Cleanup resources and event listeners
     */
    cleanup() {
        console.log('Cleaning up forest calculator resources');
        
        try {
            // Remove our event listeners
            this.removeEventListeners();
            
            // Clean up the IO module
            cleanupForestIO();
            
            // Clean up the DOM module
            cleanupForestDOM();
            
            // Reset state
            this.results = null;
            this.costAnalysis = null;
            this.initialized = false;
            
            console.log('Forest calculator cleanup complete');
        } catch (error) {
            console.error('Error cleaning up forest calculator:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        console.log('Setting up forest calculator event listeners');
        
        // Form submission
        this._addEventListenerWithCleanup('calculateForestBtn', 'click', this.handleForestFormSubmit.bind(this));
        
        // Reset button
        this._addEventListenerWithCleanup('resetForestBtn', 'click', this.resetForestCalculator.bind(this));
        
        // Species selection
        this._addEventListenerWithCleanup('speciesSelect', 'change', this.handleSpeciesChange.bind(this));
        
        // Export results button
        this._addEventListenerWithCleanup('exportResultsBtn', 'click', this.exportResults.bind(this));
    }
    
    /**
     * Helper to add event listener with cleanup tracking
     * @param {string} elementId - Element ID
     * @param {string} eventType - Event type (click, change, etc)
     * @param {Function} handler - Event handler
     * @private
     */
    _addEventListenerWithCleanup(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            // Store bound handler for removal
            const listenerInfo = { element, eventType, handler };
            element.addEventListener(eventType, handler);
            this.eventListeners.push(listenerInfo);
            
            console.log(`Added ${eventType} listener to ${elementId}`);
        } else {
            console.warn(`Element ${elementId} not found, skipping event listener`);
        }
    }
    
    /**
     * Remove all event listeners
     */
    removeEventListeners() {
        console.log('Removing forest calculator event listeners');
        
        this.eventListeners.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        
        this.eventListeners = [];
    }
    
    /**
     * Handle form submission
     * @param {Event} event - Form submission event
     */
    handleForestFormSubmit(event) {
        event.preventDefault();
        
        if (this.calculationInProgress) {
            console.log('Calculation already in progress, ignoring request');
            return;
        }
        
        try {
            console.log('Processing form submission');
            this.calculationInProgress = true;
            
            // Get error message container
            const errorMessageElement = document.getElementById('errorMessageForest');
            
            // Validate inputs
            const inputs = getAndValidateForestInputs(errorMessageElement);
            
            if (!inputs) {
                console.error('Input validation failed');
                this.calculationInProgress = false;
                return;
            }
            
            // Check if in multi-species mode
            if (isMultiSpeciesMode()) {
                console.log('Performing multi-species calculation');
                
                // Get species data
                const speciesData = getLoadedSpeciesData();
                
                // Perform calculation
                this.results = calculateSequestrationMultiSpecies(inputs, speciesData);
                
            } else {
                console.log('Performing single-species calculation');
                
                // Perform calculation
                const results = calculateSequestration(inputs);
                
                // Format as same structure as multi-species result
                this.results = {
                    totalResults: results,
                    speciesResults: [{
                        speciesName: inputs.species,
                        numberOfTrees: inputs.density * inputs.area,
                        results: results
                    }]
                };
            }
            
            // Calculate cost analysis if project cost is provided
            if (inputs.projectCost && inputs.projectCost > 0) {
                const resultsToUse = this.results.totalResults || this.results;
                this.costAnalysis = calculateForestCostAnalysis(
                    inputs.projectCost,
                    inputs.area,
                    resultsToUse
                );
            } else {
                this.costAnalysis = null;
            }
            
            // Log basic results summary
            const finalResults = (this.results.totalResults || this.results);
            const finalResult = finalResults[finalResults.length - 1];
            
            console.log('Calculation complete. Total sequestration:', finalResult.cumulativeNetCO2e);
            
            // Track successful calculation
            analytics.trackEvent('forest_calculation_success', {
                duration: inputs.duration,
                area: inputs.area,
                species: inputs.species,
                multiSpecies: isMultiSpeciesMode(),
                totalSequestration: finalResult.rawCumulativeNetCO2e
            });
            
            // Display results
            this.displayResults();
        } catch (error) {
            console.error('Error calculating forest sequestration:', error);
            showForestError(`Calculation error: ${error.message}`);
            
            // Track calculation error
            analytics.trackEvent('forest_calculation_error', {
                error: error.message
            });
        } finally {
            this.calculationInProgress = false;
        }
    }
    
    /**
     * Display calculation results
     */
    displayResults() {
        try {
            if (!this.results) {
                console.error('No results to display');
                return;
            }
            
            console.log('Displaying forest calculation results');
            
            // Get necessary DOM elements
            const resultsSection = document.getElementById('resultsSectionForest');
            const resultsBody = document.getElementById('resultsBodyForest');
            const chartElement = document.getElementById('sequestrationChart');
            const errorMessageElement = document.getElementById('errorMessageForest');
            
            // Use the totalResults if available, otherwise use the direct results
            const resultsToDisplay = this.results.totalResults || this.results;
            
            // Display results in the DOM
            displayForestResults(
                resultsToDisplay, 
                resultsSection, 
                resultsBody, 
                chartElement,
                errorMessageElement
            );
            
            // Display cost analysis if available
            this.displayCostAnalysis();
            
            // Force results section to be visible
            if (resultsSection) {
                // First ensure it's in the DOM properly
                resultsSection.classList.remove('hidden');
                resultsSection.style.display = 'block';
                resultsSection.style.visibility = 'visible';
                resultsSection.style.opacity = '1';
                
                // Add inline styles to overcome any CSS that might hide it
                resultsSection.setAttribute('style', 
                    'display: block !important; ' +
                    'visibility: visible !important; ' +
                    'opacity: 1 !important; ' +
                    'height: auto !important; ' + 
                    'overflow: visible !important;'
                );
                
                // Scroll to results
                setTimeout(() => {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }, 100);
                
                console.log('Results section display styles applied:', 
                    getComputedStyle(resultsSection).display,
                    getComputedStyle(resultsSection).visibility
                );
            } else {
                console.error('Results section element not found in DOM');
            }
            
            showForestResults(resultsSection);
            
        } catch (error) {
            console.error('Error displaying results:', error);
            showForestError(`Error displaying results: ${error.message}`);
        }
    }
    
    /**
     * Display cost analysis results
     */
    displayCostAnalysis() {
        try {
            // Get cost analysis container
            const costAnalysisSection = document.getElementById('costAnalysisSection');
            if (!costAnalysisSection) return;
            
            // Check if we have cost analysis data
            if (!this.costAnalysis) {
                costAnalysisSection.classList.add('hidden');
                return;
            }
            
            // Update cost analysis fields
            const totalCostElement = document.getElementById('totalProjectCost');
            const costPerTonneElement = document.getElementById('costPerTonne');
            const costPerHectareElement = document.getElementById('costPerHectare');
            const establishmentCostElement = document.getElementById('establishmentCost');
            const maintenanceCostElement = document.getElementById('maintenanceCost');
            const monitoringCostElement = document.getElementById('monitoringCost');
            const otherCostElement = document.getElementById('otherCosts');
            
            if (totalCostElement) totalCostElement.textContent = this.costAnalysis.totalProjectCost;
            if (costPerTonneElement) costPerTonneElement.textContent = this.costAnalysis.costPerTonne;
            if (costPerHectareElement) costPerHectareElement.textContent = this.costAnalysis.costPerHectare;
            
            // Update cost breakdown
            if (establishmentCostElement) establishmentCostElement.textContent = this.costAnalysis.costBreakdown.establishment;
            if (maintenanceCostElement) maintenanceCostElement.textContent = this.costAnalysis.costBreakdown.maintenance;
            if (monitoringCostElement) monitoringCostElement.textContent = this.costAnalysis.costBreakdown.monitoring;
            if (otherCostElement) otherCostElement.textContent = this.costAnalysis.costBreakdown.other;
            
            // Show cost analysis section
            costAnalysisSection.classList.remove('hidden');
            
            console.log('Cost analysis displayed successfully');
        } catch (error) {
            console.error('Error displaying cost analysis:', error);
        }
    }
    
    /**
     * Reset the calculator
     */
    resetForestCalculator() {
        console.log('Resetting forest calculator');
        
        try {
            // Reset form
            const form = document.getElementById('calculatorForm');
            if (form) form.reset();
            
            // Reset results
            this.results = null;
            this.costAnalysis = null;
            
            // Hide results section
            const resultsSection = document.getElementById('resultsSectionForest');
            if (resultsSection) {
                resultsSection.classList.add('hidden');
                resultsSection.style.display = 'none';
            }
            
            // Hide cost analysis section
            const costAnalysisSection = document.getElementById('costAnalysisSection');
            if (costAnalysisSection) costAnalysisSection.classList.add('hidden');
            
            // Clear error messages
            clearForestErrors();
            
            // Reset charts
            resetForestCharts();
            
            // Hide multi-species message
            const multiSpeciesModeMessage = document.getElementById('multiSpeciesModeMessage');
            if (multiSpeciesModeMessage) multiSpeciesModeMessage.classList.add('hidden');
            
            // Clear species list
            const speciesListContainer = document.getElementById('speciesListContainer');
            if (speciesListContainer) {
                speciesListContainer.innerHTML = '';
                speciesListContainer.classList.add('hidden');
            }
            
            // Track reset event
            analytics.trackEvent('forest_calculator_reset', {
                timestamp: new Date().toISOString()
            });
            
            console.log('Calculator reset complete');
        } catch (error) {
            console.error('Error resetting calculator:', error);
        }
    }
    
    /**
     * Handle species change
     * @param {Event} event - Change event
     */
    handleSpeciesChange(event) {
        const species = event.target.value;
        console.log('Species changed to:', species);
        
        try {
            // Update default values based on species
            const speciesDefaults = {
                'pine': { growthRate: 10, woodDensity: 0.42, bef: 1.3, rsr: 0.25 },
                'eucalyptus': { growthRate: 25, woodDensity: 0.55, bef: 1.3, rsr: 0.24 },
                'oak': { growthRate: 5, woodDensity: 0.65, bef: 1.4, rsr: 0.25 },
                'teak': { growthRate: 12, woodDensity: 0.65, bef: 1.5, rsr: 0.27 },
                'mixed': { growthRate: 8, woodDensity: 0.5, bef: 1.4, rsr: 0.25 },
                'mangrove': { growthRate: 7, woodDensity: 0.71, bef: 1.9, rsr: 0.28 },
                'bamboo': { growthRate: 30, woodDensity: 0.5, bef: 1.3, rsr: 0.5 },
                'poplar': { growthRate: 15, woodDensity: 0.35, bef: 1.3, rsr: 0.23 },
                'default': { growthRate: 8, woodDensity: 0.5, bef: 1.4, rsr: 0.25 }
            };
            
            // Get the default values for the selected species, or use general defaults
            let defaults = speciesDefaults.default;
            for (const key in speciesDefaults) {
                if (species.toLowerCase().includes(key)) {
                    defaults = speciesDefaults[key];
                    break;
                }
            }
            
            // Update input fields
            const growthRateInput = document.getElementById('growthRate');
            const woodDensityInput = document.getElementById('woodDensity');
            const befInput = document.getElementById('bef');
            const rsrInput = document.getElementById('rsr');
            
            if (growthRateInput) growthRateInput.value = defaults.growthRate;
            if (woodDensityInput) woodDensityInput.value = defaults.woodDensity;
            if (befInput) befInput.value = defaults.bef;
            if (rsrInput) rsrInput.value = defaults.rsr;
            
            // Track species change
            analytics.trackEvent('forest_species_change', {
                species: species,
                defaults: defaults
            });
        } catch (error) {
            console.error('Error updating species defaults:', error);
        }
    }
    
    /**
     * Export results to CSV
     */
    exportResults() {
        // This is handled by forestIO.js
        console.log('Export results request delegated to IO module');
    }
    
    /**
     * Handle errors
     * @param {string} message - Error message
     * @param {HTMLElement} errorDiv - Error display element
     */
    handleError(message, errorDiv) {
        console.error('Forest calculator error:', message);
        showForestError(message, errorDiv);
        
        // Track error
        analytics.trackEvent('forest_calculator_error', {
            message: message,
            timestamp: new Date().toISOString()
        });
    }
}

// Export a setup function for the main application to call
export function setupAfforestationCalculator(options = {}) {
    console.log('Setting up afforestation calculator module');
    
    // Check if already initialized via the global instance
    if (window.forestCalculator && window.forestCalculator.initialized) {
        console.log('Afforestation calculator already initialized, skipping setup');
        return window.forestCalculator;
    }
    
    // Create and initialize calculator
    const forestCalculator = new ForestCalculator();
    forestCalculator.init();
    
    // Export for global access
    window.forestCalculator = forestCalculator;
    
    return forestCalculator;
}

// Keep this export for direct initialization when needed
export function initForestCalculator() {
    console.log('Initializing forest calculator from module export');
    return setupAfforestationCalculator();
}
