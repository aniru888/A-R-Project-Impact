import { formatCO2e } from '../utils.js';
import { analytics } from '../analytics.js';

// Ensure consistent event tracking that won't break functionality  
function trackEvent(eventName, eventData = {}) {
    try {
        if (window.analytics && typeof window.analytics.trackEvent === 'function') {
            window.analytics.trackEvent(eventName, eventData);
        } else if (typeof analytics !== 'undefined' && typeof analytics.trackEvent === 'function') {
            analytics.trackEvent(eventName, eventData);
        } else {
            console.log(`Analytics event (not tracked): ${eventName}`, eventData);
        }
    } catch (error) {
        console.error('Error tracking event:', error);
    }
}

// --- Enhanced Afforestation Calculator Features ---
export function setupGreenCoverAndCredits(speciesData) {
    // Define variables for access across event handlers
    let deadAttributePercentage = 0;
    let carbonPrice = 10;
    let lastCalculationResults = null; // Local variable to store calculation results
    
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

    // --- Green Cover Calculation ---
    function updateGreenCoverMetrics() {
        console.log('Updating green cover metrics');
        
        // Get inputs with fallbacks to defaults
        const initialGreenCover = parseFloat(initialGreenCoverInput?.value) || 0;
        const projectArea = parseFloat(projectAreaInputGC?.value) || 0;
        const survivalRatePercent = parseFloat(survivalRateInputGC?.value) || 85;
        const totalArea = parseFloat(totalGeographicalAreaInput?.value) || 100;
        const survivalRate = survivalRatePercent / 100;
        
        // Calculate final green cover (initial + project area adjusted for survival)
        const actualProjectArea = projectArea * survivalRate;
        const finalGreenCover = initialGreenCover + actualProjectArea;
        const absoluteIncrease = finalGreenCover - initialGreenCover;
        
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

    // --- Carbon Credits & Risk Calculation ---
    function updateCarbonCreditsCalculation(results) {
        console.log('Updating carbon credits calculation');
        
        // Store the results for future updates
        lastCalculationResults = results;
        
        // Ensure we have results and the final year
        if (!results || !results.totalResults || !results.totalResults.length) {
            console.warn('No valid results for carbon credits calculation');
            return;
        }
        
        const finalYear = results.totalResults[results.totalResults.length - 1];
        
        // Get the total sequestration - use raw value if available, otherwise parse from formatted
        let finalCO2e = 0;
        if (typeof finalYear.rawCumulativeNetCO2e === 'number') {
            // Use raw value if available
            finalCO2e = finalYear.rawCumulativeNetCO2e;
        } else if (typeof finalYear.cumulativeNetCO2e === 'string') {
            // Parse from formatted string if raw not available
            finalCO2e = parseFloat(finalYear.cumulativeNetCO2e.replace(/[^0-9.-]+/g, '')) || 0;
        }
        
        if (finalCO2e <= 0) {
            console.warn('Invalid or non-positive CO2e value for carbon credits calculation:', finalCO2e);
            
            // Set display elements to show zeros instead of showing nothing
            if (totalVERs) totalVERs.textContent = '0.00';
            if (estimatedRevenue) estimatedRevenue.textContent = '0.00';
            
            return {
                originalCO2e: 0,
                bufferedCO2e: 0,
                finalVERs: 0,
                revenue: 0
            };
        }
        
        // Get risk rate (as decimal) from input
        const riskRate = riskRateInput ? (parseFloat(riskRateInput.value) / 100) : 0.15;
        
        // Apply risk buffer to get VERs
        const bufferedCO2e = finalCO2e * (1 - riskRate);
        
        // Apply dead attribute (non-additionality) percentage
        const finalVERs = bufferedCO2e * (1 - (deadAttributePercentage / 100));
        
        // Calculate estimated revenue using carbon price
        const revenue = finalVERs * carbonPrice;
        
        // Update display with proper formatting
        if (totalVERs) {
            totalVERs.textContent = finalVERs.toLocaleString('en-US', {maximumFractionDigits: 2});
        }
        
        if (estimatedRevenue) {
            estimatedRevenue.textContent = revenue.toLocaleString('en-US', {maximumFractionDigits: 2});
        }
        
        // Update additional display elements with calculation details if they exist
        const riskBufferElement = document.getElementById('riskBuffer');
        if (riskBufferElement) {
            const riskBufferAmount = finalCO2e * riskRate;
            riskBufferElement.textContent = riskBufferAmount.toLocaleString('en-US', {maximumFractionDigits: 2}) + ' tCO₂e';
        }
        
        const nonAddElement = document.getElementById('nonAdditionality');
        if (nonAddElement) {
            const nonAddAmount = bufferedCO2e * (deadAttributePercentage / 100);
            nonAddElement.textContent = nonAddAmount.toLocaleString('en-US', {maximumFractionDigits: 2}) + ' tCO₂e';
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
