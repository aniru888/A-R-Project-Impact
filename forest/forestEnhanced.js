import { getAndValidateForestInputs } from './forestCalcs.js'; // Assuming validation function is here
import { formatCO2e } from '../utils.js'; // Import formatting utility
import { analytics } from '../analytics.js'; // Import analytics for tracking

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

let lastCalculationResults = null; // Store last results for updates

// --- Enhanced Afforestation Calculator Features ---
export function setupGreenCoverAndCredits(speciesData) {
    // Define global variables for access across event handlers
    let deadAttributePercentage = 0;
    let carbonPrice = 10;
    let lastCalculationResults = null;
    
    // Get necessary DOM elements
    const initialGreenCoverInput = document.getElementById('initialGreenCover');
    const totalGeographicalAreaInput = document.getElementById('totalGeographicalArea');
    const carbonPriceSelect = document.getElementById('carbonPriceSelect');
    const customCarbonPriceContainer = document.getElementById('customCarbonPriceContainer');
    const customCarbonPriceInput = document.getElementById('customCarbonPrice');
    const riskRateInput = document.getElementById('riskRate');
    const deadAttributeInput = document.getElementById('deadAttribute');
    
    // Output elements
    const initialGreenCoverPercentage = document.getElementById('initialGreenCoverPercentage');
    const finalGreenCoverPercentage = document.getElementById('finalGreenCoverPercentage');
    const absoluteGreenCoverIncrease = document.getElementById('absoluteGreenCoverIncrease');
    const totalVERs = document.getElementById('totalVERs');
    const estimatedRevenue = document.getElementById('estimatedRevenue');
    
    // Risk factors (can be updated from UI or data)
    let riskFactors = { fire: 5, insect: 3, disease: 2 }; // Example defaults

    // --- Event Listeners for Enhanced Features ---
    if (deadAttributeInput) {
        // Initialize display
        deadAttributePercentage = parseFloat(deadAttributeInput.value);

        // Listen for input changes
        deadAttributeInput.addEventListener('input', function() {
            deadAttributePercentage = parseFloat(this.value);
            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
        
        // Add change event listener for analytics tracking when user finishes setting the value
        deadAttributeInput.addEventListener('change', function() {
            trackEvent('forest_dead_attribute_set', {
                value: deadAttributePercentage
            });
        });
    }

    // Setup carbon price selector
    if (carbonPriceSelect) {
        carbonPriceSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (selectedValue === 'custom') {
                customCarbonPriceContainer?.classList.remove('hidden');
                if (customCarbonPriceInput && customCarbonPriceInput.value) {
                    carbonPrice = parseFloat(customCarbonPriceInput.value);
                }
            } else {
                customCarbonPriceContainer?.classList.add('hidden');
                carbonPrice = parseFloat(selectedValue);
            }
            
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
            
            trackEvent('forest_carbon_price_set', {
                price: carbonPrice,
                priceType: selectedValue === 'custom' ? 'custom' : 'preset'
            });
        });
        
        // Initialize carbon price from select value
        carbonPrice = parseFloat(carbonPriceSelect.value === 'custom' && customCarbonPriceInput ? 
            customCarbonPriceInput.value : carbonPriceSelect.value);
    }
    
    // Setup custom carbon price input
    if (customCarbonPriceInput) {
        customCarbonPriceInput.addEventListener('input', function() {
            if (carbonPriceSelect?.value === 'custom') {
                carbonPrice = parseFloat(this.value) || 0;
                if (lastCalculationResults) {
                    updateCarbonCreditsCalculation(lastCalculationResults);
                }
            }
        });
        
        customCarbonPriceInput.addEventListener('change', function() {
            trackEvent('forest_custom_carbon_price_set', {
                value: parseFloat(this.value) || 0
            });
        });
    }
    
    // Setup risk rate input
    if (riskRateInput) {
        riskRateInput.addEventListener('input', function() {
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
        
        riskRateInput.addEventListener('change', function() {
            trackEvent('forest_risk_rate_set', {
                value: parseFloat(this.value) || 0
            });
        });
    }

    // --- Green Cover Calculation ---
    function updateGreenCoverMetrics() {
        // Get initial green cover and total area
        const initialGreenCover = parseFloat(initialGreenCoverInput?.value) || 0;
        const projectAreaInput = document.getElementById('projectArea'); // Need project area
        const totalAreaInput = document.getElementById('totalGeographicalArea');

        // Use project area as total area if total area input is empty or invalid
        let totalArea = parseFloat(totalAreaInput?.value);
        if (isNaN(totalArea) || totalArea <= 0) {
            totalArea = parseFloat(projectAreaInput?.value) || 0;
            // Optionally auto-populate total area if using project area, but might confuse user
            // if (totalArea > 0 && totalAreaInput) {
            //      totalAreaInput.value = totalArea;
            // }
        }

        // Get project area and survival rate
        const projectArea = parseFloat(projectAreaInput?.value) || 0;
        const survivalRateInput = document.getElementById('survivalRate');
        // Use survival rate from input, default to 90% if invalid/missing
        let survivalRate = (parseFloat(survivalRateInput?.value) / 100);
        if (isNaN(survivalRate) || survivalRate < 0 || survivalRate > 1) {
            console.warn("Invalid survival rate for green cover calc, using 0.9");
            survivalRate = 0.9;
        }

        // The effective area added with survival rate consideration
        const effectiveAreaAdded = projectArea * survivalRate;

        // Calculate the final green cover
        const finalGreenCover = initialGreenCover + effectiveAreaAdded;

        // Calculate absolute increase
        const absoluteIncrease = effectiveAreaAdded;

        // Calculate percentages (ensure we don't divide by zero)
        const initialPercentage = totalArea > 0 ? (initialGreenCover / totalArea * 100) : 0;
        const finalPercentage = totalArea > 0 ? (finalGreenCover / totalArea * 100) : 0;

        // Update the display elements if they exist
        if (initialGreenCoverPercentage) {
            initialGreenCoverPercentage.textContent = `${initialPercentage.toFixed(1)}%`;
        }

        if (finalGreenCoverPercentage) {
            finalGreenCoverPercentage.textContent = `${finalPercentage.toFixed(1)}%`;
        }

        if (absoluteGreenCoverIncrease) {
            absoluteGreenCoverIncrease.textContent = `${absoluteIncrease.toFixed(2)} ha`;
        }

        return {
            initialCover: initialGreenCover,
            finalCover: finalGreenCover,
            addedCover: absoluteIncrease,
            initialPercentage,
            finalPercentage
        };
    }

    // Attach event listeners for green cover inputs
    if (initialGreenCoverInput) {
        initialGreenCoverInput.addEventListener('input', updateGreenCoverMetrics);
        initialGreenCoverInput.addEventListener('blur', function() {
            trackEvent('forest_initial_green_cover_set', {
                value: parseFloat(this.value) || 0
            });
        });
    }

    if (totalGeographicalAreaInput) {
        totalGeographicalAreaInput.addEventListener('input', updateGreenCoverMetrics);
        totalGeographicalAreaInput.addEventListener('blur', function() {
            trackEvent('forest_geographical_area_set', {
                value: parseFloat(this.value) || 0
            });
        });
    }
    
    // Also listen to project area and survival rate as they affect green cover
    const projectAreaInputGC = document.getElementById('projectArea');
    const survivalRateInputGC = document.getElementById('survivalRate');
    if (projectAreaInputGC) projectAreaInputGC.addEventListener('input', updateGreenCoverMetrics);
    if (survivalRateInputGC) survivalRateInputGC.addEventListener('input', updateGreenCoverMetrics);

    // --- Carbon Credits & Risk Calculation ---
    function updateCarbonCreditsCalculation(results) {
        lastCalculationResults = results;

        // Get risk rate (buffer pool percentage)
        const riskRate = parseFloat(riskRateInput?.value) / 100 || 0;
        
        // Get final sequestered CO2e
        let finalCO2e = 0;
        if (results && results.totalResults && results.totalResults.length > 0) {
            const finalYearData = results.totalResults[results.totalResults.length - 1];
            finalCO2e = parseFloat(finalYearData.cumulativeNetCO2e);
        } else if (typeof results === 'number') {
            finalCO2e = results; // Handle case where a direct number is passed
        }

        // Calculate VERs (Verified Emission Reductions) after accounting for risk buffer and dead attributes
        const bufferedCO2e = finalCO2e * (1 - riskRate);
        const finalVERs = bufferedCO2e * (1 - (deadAttributePercentage / 100));
        
        // Calculate estimated revenue using carbon price
        const revenue = finalVERs * carbonPrice;
        
        // Update display
        if (totalVERs) {
            totalVERs.textContent = finalVERs.toLocaleString('en-US', {maximumFractionDigits: 2});
        }
        
        if (estimatedRevenue) {
            estimatedRevenue.textContent = revenue.toLocaleString('en-US', {maximumFractionDigits: 2});
        }
        
        return {
            originalCO2e: finalCO2e,
            bufferedCO2e,
            finalVERs,
            revenue
        };
    }

    // Run initial calculations
    updateGreenCoverMetrics();
    
    // Return functions to allow calling from outside
    return {
        updateGreenCoverMetrics,
        updateCarbonCreditsCalculation,
        getCarbonPrice: () => carbonPrice,
        getRiskRate: () => parseFloat(riskRateInput?.value) / 100 || 0,
        getDeadAttribute: () => deadAttributePercentage / 100
    };
}
