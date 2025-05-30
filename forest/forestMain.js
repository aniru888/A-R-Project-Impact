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
import { initForestListHandlers } from './forestListHandlers.js'; // Import our new module
import { setupGreenCoverAndCredits } from './forestEnhanced.js'; // Import enhanced features
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
            
            // Initialize the list handlers
            initForestListHandlers();
            
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
        
        // Since there's no direct speciesSelect in the HTML, look for individual species-related inputs
        // Instead of the dropdown, we'll listen for changes on specific species factor inputs
        const speciesInputs = ['siteQuality', 'avgRainfall', 'soilType', 'survivalRate'];
        speciesInputs.forEach(inputId => {
            this._addEventListenerWithCleanup(inputId, 'change', this.handleSpeciesChange.bind(this));
        });
        
        // Export results button - match the ID in the HTML
        this._addEventListenerWithCleanup('exportForestExcelBtn', 'click', this.exportResults.bind(this));
        
        // Add listener for PDF generation as well
        this._addEventListenerWithCleanup('generateForestPdfBtn', 'click', this.generatePdf.bind(this));
    }
    
    /**
     * Helper to add event listener with cleanup tracking
     * @param {string} elementId - Element ID
     * @param {string} eventType - Event type (click, change, etc)
     * @param {Function} handler - Event handler
     * @private
     */
    _addEventListenerWithCleanup(elementId, eventType, handler) {
        let element = document.getElementById(elementId);
        if (element) {
            // Check if the element already has the _hasClickListener property set by the backup script
            if (element._hasClickListener && eventType === 'click') {
                console.log(`Element ${elementId} already has a click listener from backup script, removing it`);
                // Clone the element to remove all event listeners
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                
                // Update our reference to the new element
                element = newElement;
            }
            
            // Store bound handler for removal
            const listenerInfo = { element, eventType, handler };
            element.addEventListener(eventType, handler);
            
            // Mark this element as having our listener
            element._mainHandlerAdded = true;
            
            this.eventListeners.push(listenerInfo);
            
            console.log(`Added ${eventType} listener to ${elementId} (main calculator)`);
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
            
            // Log the raw results object immediately after calculation
            console.log('Raw calculation results:', JSON.stringify(this.results, null, 2));
            
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
            
            // Display results in the DOM - this function now handles visibility and scrolling
            displayForestResults(
                resultsToDisplay, 
                resultsSection, 
                resultsBody, 
                chartElement,
                errorMessageElement
            );
            
            // Display cost analysis if available
            this.displayCostAnalysis();
            
            // Update Enhanced Features (Carbon Credits and Green Cover)
            this.updateEnhancedFeatures(); // This function handles showing its sections
            
        } catch (error) {
            console.error('Error displaying results:', error);
            showForestError(`Error displaying results: ${error.message}`);
        }
    }
    
    /**
     * Update enhanced features like carbon credits and green cover
     */
    updateEnhancedFeatures() {
        try {
            console.log('Updating enhanced features for forest results');
            
            // Initialize or get the enhanced features handler
            if (!this.enhancedFeaturesHandler) {
                // Set up enhanced features (carbon credits and green cover)
                const speciesData = isMultiSpeciesMode() ? getLoadedSpeciesData() : [];
                this.enhancedFeaturesHandler = setupGreenCoverAndCredits(speciesData);
            }
            
            // Use the handler to update calculations based on current results
            if (this.enhancedFeaturesHandler && typeof this.enhancedFeaturesHandler.updateCarbonCreditsCalculation === 'function') {
                // Update green cover metrics first (doesn't need results)
                this.enhancedFeaturesHandler.updateGreenCoverMetrics();
                
                // Update carbon credits based on sequestration results
                this.enhancedFeaturesHandler.updateCarbonCreditsCalculation(this.results);
                
                // Make sure the relevant sections are visible
                const carbonCreditsSection = document.getElementById('carbonCreditsSection');
                if (carbonCreditsSection) {
                    carbonCreditsSection.classList.remove('hidden');
                    // Let CSS handle display: block based on class removal
                }
                
                const greenCoverSection = document.getElementById('greenCoverSection');
                if (greenCoverSection) {
                    greenCoverSection.classList.remove('hidden');
                    // Let CSS handle display: block based on class removal
                }
                
                console.log('Enhanced features updated successfully');
            } else {
                console.warn('Enhanced features handler not available or missing methods');
            }
        } catch (error) {
            console.error('Error updating enhanced features:', error);
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
            this.enhancedFeaturesHandler = null;
            
            // Hide results section using class manipulation
            const resultsSection = document.getElementById('resultsSectionForest');
            if (resultsSection) {
                resultsSection.classList.add('hidden'); // Add hidden class
                resultsSection.classList.remove('show-results'); // Remove showing class
                // resultsSection.style.display = 'none'; // Avoid direct style manipulation
            }
            
            // Hide enhanced features sections
            const carbonCreditsSection = document.getElementById('carbonCreditsSection');
            if (carbonCreditsSection) carbonCreditsSection.classList.add('hidden');
            
            const greenCoverSection = document.getElementById('greenCoverSection');
            if (greenCoverSection) greenCoverSection.classList.add('hidden');
            
            // Reset enhanced features display elements
            const totalVERs = document.getElementById('totalVERs');
            if (totalVERs) totalVERs.textContent = '--';
            
            const estimatedRevenue = document.getElementById('estimatedRevenue');
            if (estimatedRevenue) estimatedRevenue.textContent = '--';
            
            const initialGreenCoverPercentage = document.getElementById('initialGreenCoverPercentage');
            if (initialGreenCoverPercentage) initialGreenCoverPercentage.textContent = '0.0%';
            
            const finalGreenCoverPercentage = document.getElementById('finalGreenCoverPercentage');
            if (finalGreenCoverPercentage) finalGreenCoverPercentage.textContent = '0.0%';
            
            const absoluteGreenCoverIncrease = document.getElementById('absoluteGreenCoverIncrease');
            if (absoluteGreenCoverIncrease) absoluteGreenCoverIncrease.textContent = '0.00 ha';
            
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
     * Generate PDF from results
     */
    generatePdf() {
        try {
            console.log('Generating PDF for forest results');
            
            // First check if we have results to export
            if (!this.results) {
                console.error('No results available to generate PDF');
                showForestError('No results available to generate PDF. Please run a calculation first.');
                return;
            }
            
            // Get the results section for conversion to PDF
            const resultsSection = document.getElementById('resultsSectionForest');
            if (!resultsSection) {
                console.error('Results section not found in DOM');
                showForestError('Error generating PDF: Results section not found.');
                return;
            }
            
            // Use the html2canvas and jsPDF libraries if available
            if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
                console.error('PDF generation libraries not available');
                showForestError('PDF generation requires html2canvas and jsPDF libraries.');
                return;
            }
            
            // Show loading indicator if possible
            const loadingIndicator = document.createElement('div');
            loadingIndicator.textContent = 'Generating PDF...';
            loadingIndicator.style.position = 'fixed';
            loadingIndicator.style.top = '50%';
            loadingIndicator.style.left = '50%';
            loadingIndicator.style.transform = 'translate(-50%, -50%)';
            loadingIndicator.style.padding = '10px 20px';
            loadingIndicator.style.backgroundColor = '#059669';
            loadingIndicator.style.color = 'white';
            loadingIndicator.style.borderRadius = '4px';
            loadingIndicator.style.zIndex = '9999';
            document.body.appendChild(loadingIndicator);
            
            // Generate PDF after a short delay to allow the loading indicator to render
            setTimeout(() => {
                try {
                    // Use html2canvas to convert the results section to an image
                    html2canvas(resultsSection, {
                        scale: 1,
                        useCORS: true,
                        logging: false,
                        allowTaint: true
                    }).then(canvas => {
                        // Create a new jsPDF instance
                        const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();
                        
                        // Calculate dimensions to fit the content to the page
                        const canvasWidth = canvas.width;
                        const canvasHeight = canvas.height;
                        const ratio = canvasWidth / canvasHeight;
                        const pageRatio = pdfWidth / pdfHeight;
                        
                        let imgWidth, imgHeight;
                        
                        if (ratio > pageRatio) {
                            // If the canvas is wider relative to its height than the page
                            imgWidth = pdfWidth;
                            imgHeight = imgWidth / ratio;
                        } else {
                            // If the canvas is taller relative to its width than the page
                            imgHeight = pdfHeight * 0.9; // Leave some margin
                            imgWidth = imgHeight * ratio;
                        }
                        
                        // Convert canvas to dataURL and add to PDF
                        const imgData = canvas.toDataURL('image/png');
                        pdf.addImage(imgData, 'PNG', 
                                     (pdfWidth - imgWidth) / 2, 20, // Center horizontally, add margin at top
                                     imgWidth, imgHeight);
                        
                        // Save the PDF
                        pdf.save('forest_sequestration_results.pdf');
                        
                        // Track PDF generation
                        analytics.trackEvent('forest_pdf_export', {
                            timestamp: new Date().toISOString()
                        });
                        
                        // Remove the loading indicator
                        document.body.removeChild(loadingIndicator);
                        
                        console.log('PDF generated successfully');
                    }).catch(error => {
                        console.error('Error generating canvas for PDF:', error);
                        showForestError(`Error generating PDF: ${error.message}`);
                        document.body.removeChild(loadingIndicator);
                    });
                } catch (error) {
                    console.error('Error in PDF generation process:', error);
                    showForestError(`Error generating PDF: ${error.message}`);
                    document.body.removeChild(loadingIndicator);
                }
            }, 100);
        } catch (error) {
            console.error('Error in PDF generation:', error);
            showForestError(`Error generating PDF: ${error.message}`);
        }
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
