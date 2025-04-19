// forest/forestEnhanced.js
// Handles enhanced features: Green Cover, Carbon Credits, Risk Factors

import { getAndValidateForestInputs } from './forestCalcs.js'; // Assuming validation function is here
import { formatCO2e } from '../utils.js'; // Import formatting utility
import { analytics } from '../analytics.js'; // Import analytics for tracking

let lastCalculationResults = null; // Store last results for updates

// --- Enhanced Afforestation Calculator Features ---
export function setupGreenCoverAndCredits(speciesData) {
    // Elements for green cover calculations
    const initialGreenCoverInput = document.getElementById('initialGreenCover');
    const totalGeographicalAreaInput = document.getElementById('totalGeographicalArea');
    const absoluteGreenCoverIncreaseEl = document.getElementById('absoluteGreenCoverIncrease');
    const percentageGreenCoverIncreaseEl = document.getElementById('percentageGreenCoverIncrease');
    const initialGreenCoverPercentageEl = document.getElementById('initialGreenCoverPercentage');
    const finalGreenCoverPercentageEl = document.getElementById('finalGreenCoverPercentage');

    // Elements for dead attribute and carbon credits
    const deadAttributeSlider = document.getElementById('deadAttributeSlider');
    const deadAttributeValue = document.getElementById('deadAttributeValue');
    const carbonPriceSelect = document.getElementById('carbonPrice');
    const customCarbonPriceContainer = document.getElementById('customCarbonPriceContainer');
    const customCarbonPriceInput = document.getElementById('customCarbonPrice');

    // Default values
    let deadAttributePercentage = 0; // Default 0%
    let carbonPrice = 5; // Default $5 per ton

    // Risk factors (can be updated from UI or data)
    let riskFactors = { fire: 5, insect: 3, disease: 2 }; // Example defaults

    // --- Event Listeners for Enhanced Features ---
    if (deadAttributeSlider && deadAttributeValue) {
        // Initialize display
        deadAttributeValue.textContent = deadAttributeSlider.value + '%';
        deadAttributePercentage = parseFloat(deadAttributeSlider.value);

        deadAttributeSlider.addEventListener('input', function() {
            deadAttributeValue.textContent = this.value + '%';
            deadAttributePercentage = parseFloat(this.value);
            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
        
        // Add change event listener for analytics tracking when user finishes setting the value
        deadAttributeSlider.addEventListener('change', function() {
            analytics.trackEvent('forest_dead_attribute_adjusted', {
                value: this.value,
                hasCalculation: lastCalculationResults ? true : false
            });
        });
    }

    if (carbonPriceSelect) {
        carbonPriceSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                if (customCarbonPriceContainer) customCarbonPriceContainer.style.display = 'block';
                // Use current custom input value or default if empty
                carbonPrice = parseFloat(customCarbonPriceInput?.value) || 5;
            } else {
                if (customCarbonPriceContainer) customCarbonPriceContainer.style.display = 'none';
                carbonPrice = parseFloat(this.value);
            }

            // Track carbon price selection
            analytics.trackEvent('forest_carbon_price_selected', {
                priceType: this.value === 'custom' ? 'custom' : 'preset',
                value: carbonPrice
            });

            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
    }

    if (customCarbonPriceInput) {
        customCarbonPriceInput.addEventListener('input', function() {
            carbonPrice = parseFloat(this.value) || 5; // Use 5 if input is invalid/empty

            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
        
        // Add blur event listener to track when the user finishes entering a custom value
        customCarbonPriceInput.addEventListener('blur', function() {
            if (carbonPriceSelect.value === 'custom') {
                analytics.trackEvent('forest_custom_carbon_price_set', {
                    value: parseFloat(this.value) || 5
                });
            }
        });
    }

    // Add listeners for green cover inputs
    if (initialGreenCoverInput) {
        initialGreenCoverInput.addEventListener('input', updateGreenCoverMetrics);
        initialGreenCoverInput.addEventListener('blur', function() {
            analytics.trackEvent('forest_initial_green_cover_set', {
                value: parseFloat(this.value) || 0
            });
        });
    }

    if (totalGeographicalAreaInput) {
        totalGeographicalAreaInput.addEventListener('input', updateGreenCoverMetrics);
        totalGeographicalAreaInput.addEventListener('blur', function() {
            analytics.trackEvent('forest_geographical_area_set', {
                value: parseFloat(this.value) || 0
            });
        });
    }
    
    // Also listen to project area and survival rate as they affect green cover
    const projectAreaInputGC = document.getElementById('projectArea');
    const survivalRateInputGC = document.getElementById('survivalRate');
    if (projectAreaInputGC) projectAreaInputGC.addEventListener('input', updateGreenCoverMetrics);
    if (survivalRateInputGC) survivalRateInputGC.addEventListener('input', updateGreenCoverMetrics);

    // --- Helper Functions ---

    // Total combined risk rate (used in calculations)
    function getTotalRiskRate() {
        // Prioritize combined rate from Excel if available and valid
        if (speciesData && speciesData.length > 0 && speciesData[0]['Risk Rate (%)'] !== undefined && !isNaN(parseFloat(speciesData[0]['Risk Rate (%)']))) {
            return parseFloat(speciesData[0]['Risk Rate (%)']) / 100;
        }
        // Fallback: If UI elements for individual risks exist, sum them. Otherwise, use defaults.
        const fireRisk = parseFloat(document.getElementById('fireRisk')?.textContent) || riskFactors.fire;
        const insectRisk = parseFloat(document.getElementById('insectRisk')?.textContent) || riskFactors.insect;
        const diseaseRisk = parseFloat(document.getElementById('diseaseRisk')?.textContent) || riskFactors.disease;
        return (fireRisk + insectRisk + diseaseRisk) / 100;
    }

    // Update risk factor displays (primarily for UI defaults or if data overrides)
    function updateRiskFactorDisplays() {
        // If data is uploaded with a combined rate, maybe disable/hide individual UI displays
        // For now, just display defaults or current values
        const fireRiskEl = document.getElementById('fireRisk');
        const insectRiskEl = document.getElementById('insectRisk');
        const diseaseRiskEl = document.getElementById('diseaseRisk');
        // If speciesData provides a combined rate, maybe show that instead?
        if (speciesData && speciesData.length > 0 && speciesData[0]['Risk Rate (%)'] !== undefined) {
             const combinedRate = speciesData[0]['Risk Rate (%)'];
             // Optionally update a combined display element if it exists
             // const combinedRiskEl = document.getElementById('combinedRiskDisplay');
             // if (combinedRiskEl) combinedRiskEl.textContent = combinedRate.toFixed(1) + '%';
             // Maybe hide individual ones if combined is shown
             if (fireRiskEl) fireRiskEl.textContent = 'N/A';
             if (insectRiskEl) insectRiskEl.textContent = 'N/A';
             if (diseaseRiskEl) diseaseRiskEl.textContent = 'N/A';
        } else {
            // Display individual defaults
            if (fireRiskEl) fireRiskEl.textContent = riskFactors.fire + '%';
            if (insectRiskEl) insectRiskEl.textContent = riskFactors.insect + '%';
            if (diseaseRiskEl) diseaseRiskEl.textContent = riskFactors.disease + '%';
        }
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

        // Calculate percentages
        let initialPercentage = totalArea > 0 ? (initialGreenCover / totalArea) * 100 : 0;
        let finalPercentage = totalArea > 0 ? (finalGreenCover / totalArea) * 100 : 0;
        let percentageIncrease = finalPercentage - initialPercentage;

        // Format and display results (check if elements exist)
        if (absoluteGreenCoverIncreaseEl) absoluteGreenCoverIncreaseEl.textContent = absoluteIncrease.toFixed(2) + ' ha';
        if (percentageGreenCoverIncreaseEl) percentageGreenCoverIncreaseEl.textContent = percentageIncrease.toFixed(2) + '%';
        if (initialGreenCoverPercentageEl) initialGreenCoverPercentageEl.textContent = initialPercentage.toFixed(2) + '%';
        if (finalGreenCoverPercentageEl) finalGreenCoverPercentageEl.textContent = finalPercentage.toFixed(2) + '%';
        
        // Track green cover calculation but throttle to avoid excessive tracking
        // Use a debounce approach to only track after user has stopped making changes
        if (window.greenCoverCalcTimeout) {
            clearTimeout(window.greenCoverCalcTimeout);
        }
        window.greenCoverCalcTimeout = setTimeout(() => {
            analytics.trackEvent('forest_green_cover_calculated', {
                initialGreenCover: initialGreenCover,
                finalGreenCover: finalGreenCover,
                totalArea: totalArea,
                projectArea: projectArea,
                percentageIncrease: percentageIncrease.toFixed(2)
            });
        }, 1000); // Wait 1 second after last change before tracking
    }

    // --- Enhanced Calculation with Risk and Dead Attribute ---
    function updateCarbonCreditsCalculation(results) {
        // Store results for potential updates if sliders/prices change
        lastCalculationResults = results;

        if (!results || !results.length) {
             // Reset displays if no results
             const totalVERsEl = document.getElementById('totalVERs');
             if (totalVERsEl) totalVERsEl.textContent = '0.00';
             const revenueGeneratedEl = document.getElementById('revenueGenerated');
             if (revenueGeneratedEl) revenueGeneratedEl.textContent = '$0.00';
             const carbonRevenueEl = document.getElementById('carbonRevenue'); // If separate element exists
             if (carbonRevenueEl) carbonRevenueEl.textContent = '$0.00';
             // Reset afforestation metrics too
             const areaPlantedEl = document.getElementById('areaPlanted');
             if (areaPlantedEl) areaPlantedEl.textContent = '0';
             const numberOfTreesEl = document.getElementById('numberOfTrees');
             if (numberOfTreesEl) numberOfTreesEl.textContent = '0';
             const survivalRateDisplayEl = document.getElementById('survivalRateDisplay');
             if (survivalRateDisplayEl) survivalRateDisplayEl.textContent = '0.0';
             const ecosystemMaturityEl = document.getElementById('ecosystemMaturity');
             if (ecosystemMaturityEl) ecosystemMaturityEl.textContent = '0';
             const ecosystemProgressEl = document.querySelector('.ecosystem-maturity-progress');
             if (ecosystemProgressEl) ecosystemProgressEl.style.width = '0%';
             updateGreenCoverMetrics(); // Ensure green cover is also reset/updated
             return;
        }

        // Get final cumulative CO2e from results
        const finalCumulativeCO2e = parseFloat(results[results.length - 1].cumulativeNetCO2e) || 0;

        // Apply Dead Attribute percentage reduction
        // Use slider value OR value from speciesData if available
        let currentDeadAttribute = deadAttributePercentage / 100;
        if (speciesData && speciesData.length > 0 && speciesData[0]['Dead Attribute (%)'] !== undefined && !isNaN(parseFloat(speciesData[0]['Dead Attribute (%)']))) {
            currentDeadAttribute = parseFloat(speciesData[0]['Dead Attribute (%)']) / 100;
            // Optionally update slider to match data?
            if (deadAttributeSlider) deadAttributeSlider.value = speciesData[0]['Dead Attribute (%)'];
            if (deadAttributeValue) deadAttributeValue.textContent = speciesData[0]['Dead Attribute (%)'] + '%';
        }

        const adjustedCO2e = finalCumulativeCO2e * (1 - currentDeadAttribute);

        // Calculate VERs (Verified Emission Reductions) - assuming 1 VER = 1 tCO2e adjusted
        const totalVERs = Math.max(0, adjustedCO2e); // Ensure non-negative

        // Get current carbon price
        let currentCarbonPrice = carbonPrice;
        // Check if we're using custom price
        if (carbonPriceSelect && carbonPriceSelect.value === 'custom' && customCarbonPriceInput) {
            currentCarbonPrice = parseFloat(customCarbonPriceInput.value) || 5;
        }

        // Calculate total revenue
        const totalRevenue = totalVERs * currentCarbonPrice;

        // Update displays (check if elements exist)
        const totalVERsEl = document.getElementById('totalVERs');
        if (totalVERsEl) totalVERsEl.textContent = totalVERs.toFixed(2);

        // Also update the main CO2e sequestration display if needed (or keep it as raw value?)
        // For now, assume 'totalNetCO2e' shows the raw cumulative value before adjustments
        const totalNetCO2eEl = document.getElementById('totalNetCO2e');
        if (totalNetCO2eEl) totalNetCO2eEl.textContent = finalCumulativeCO2e.toFixed(2) + ' tCO₂e';

        // Remove CERs display if it exists (or ensure it's hidden/removed in HTML)
        const totalCERsEl = document.getElementById('totalCERs');
        if (totalCERsEl) {
             const cerItem = totalCERsEl.closest('.species-factor-item'); // Assuming structure
             if (cerItem) cerItem.style.display = 'none'; // Hide the whole item
        }

        const revenueGeneratedEl = document.getElementById('revenueGenerated');
        if (revenueGeneratedEl) revenueGeneratedEl.textContent = '$' + totalRevenue.toFixed(2);
        const carbonRevenueEl = document.getElementById('carbonRevenue'); // If separate element exists
        if (carbonRevenueEl) carbonRevenueEl.textContent = '$' + totalRevenue.toFixed(2);

        // Update afforestation metrics display
        const inputs = getAndValidateForestInputs ? getAndValidateForestInputs() : null; // Get validated inputs if available
        if (inputs && !inputs.errors) { // Check if inputs are valid
            const areaPlantedEl = document.getElementById('areaPlanted');
            if (areaPlantedEl) areaPlantedEl.textContent = inputs.projectArea.toFixed(2);

            const numberOfTreesEl = document.getElementById('numberOfTrees');
            if (numberOfTreesEl) {
                 // If multi-species, sum trees from data, else calculate from density
                 let treeCount = 0;
                 if (speciesData && speciesData.length > 0) {
                     treeCount = speciesData.reduce((sum, s) => sum + (s['Number of Trees'] || 0), 0);
                 } else {
                     treeCount = Math.round(inputs.projectArea * inputs.plantingDensity);
                 }
                 numberOfTreesEl.textContent = treeCount.toLocaleString();
            }

            const survivalRateDisplayEl = document.getElementById('survivalRateDisplay');
            if (survivalRateDisplayEl) {
                 // Use average survival rate from species data if available, else use input
                 let avgSurvival = inputs.survivalRate * 100; // Default to input value
                 if (speciesData && speciesData.length > 0) {
                     const validRates = speciesData.map(s => s['Survival Rate (%)']).filter(r => r !== null && !isNaN(r));
                     if (validRates.length > 0) {
                         avgSurvival = validRates.reduce((sum, r) => sum + r, 0) / validRates.length;
                     }
                 }
                 survivalRateDisplayEl.textContent = avgSurvival.toFixed(1);
            }

            // Update Ecosystem Maturity display using the calculated average from results
            const finalEcosystemMaturity = results[results.length - 1]?.ecosystemMaturity || 0;

            const ecosystemMaturityEl = document.getElementById('ecosystemMaturity');
            if (ecosystemMaturityEl) ecosystemMaturityEl.textContent = finalEcosystemMaturity;

            const ecosystemProgressEl = document.querySelector('.ecosystem-maturity-progress');
            if (ecosystemProgressEl) ecosystemProgressEl.style.width = finalEcosystemMaturity + '%';
        } else {
             console.warn("Could not get valid inputs to update afforestation metrics display.");
        }

        // Update risk factors display
        updateRiskFactorDisplays();
    }

    // --- Risk Factor Adjustments ---
    function updateRiskFactors() {
        // Get risk factor inputs
        const fireRiskEl = document.getElementById('fireRisk');
        const pestRiskEl = document.getElementById('pestRisk');
        const droughtRiskEl = document.getElementById('droughtRisk');
        const managementRiskEl = document.getElementById('managementRisk');
        
        // Calculate combined risk
        let fireRisk = parseFloat(fireRiskEl?.value) || 0;
        let pestRisk = parseFloat(pestRiskEl?.value) || 0;
        let droughtRisk = parseFloat(droughtRiskEl?.value) || 0;
        let managementRisk = parseFloat(managementRiskEl?.value) || 0;
        
        // Normalize risk factors to 0-1 scale if they're on a different scale
        fireRisk = fireRisk / 100;
        pestRisk = pestRisk / 100;
        droughtRisk = droughtRisk / 100;
        managementRisk = managementRisk / 100;
        
        // Calculate combined risk (simple average for now, could be weighted)
        const combinedRisk = (fireRisk + pestRisk + droughtRisk + managementRisk) / 4;
        
        // Display combined risk
        const combinedRiskEl = document.getElementById('combinedRisk');
        if (combinedRiskEl) {
            combinedRiskEl.textContent = (combinedRisk * 100).toFixed(1) + '%';
        }
        
        // Apply risk adjustment to carbon calculations 
        updateCarbonStocksWithRisk(combinedRisk);
        
        // Track risk factor adjustment
        analytics.trackEvent('forest_risk_factors_updated', {
            fireRisk: (fireRisk * 100).toFixed(1),
            pestRisk: (pestRisk * 100).toFixed(1),
            droughtRisk: (droughtRisk * 100).toFixed(1),
            managementRisk: (managementRisk * 100).toFixed(1),
            combinedRisk: (combinedRisk * 100).toFixed(1)
        });
        
        return combinedRisk;
    }

    function updateCarbonStocksWithRisk(riskFactor) {
        // Adjust carbon stocks based on risk
        // This is a simplified approach - in reality you might want to
        // apply different risk models based on the project
        
        // Get original carbon stock values
        const originalAboveground = parseFloat(document.getElementById('abovegroundCarbon')?.textContent) || 0;
        const originalBelowground = parseFloat(document.getElementById('belowgroundCarbon')?.textContent) || 0;
        const originalDeadwood = parseFloat(document.getElementById('deadwoodCarbon')?.textContent) || 0;
        const originalLitter = parseFloat(document.getElementById('litterCarbon')?.textContent) || 0;
        const originalSoil = parseFloat(document.getElementById('soilCarbon')?.textContent) || 0;
        const originalTotal = parseFloat(document.getElementById('totalCarbon')?.textContent) || 0;
        
        // Apply risk adjustment (simple reduction based on risk)
        // Risk factor is between 0-1, we invert it to get a retention factor
        const retentionFactor = 1 - riskFactor;
        
        // Calculate adjusted values
        const adjustedAboveground = originalAboveground * retentionFactor;
        const adjustedBelowground = originalBelowground * retentionFactor;
        const adjustedDeadwood = originalDeadwood * retentionFactor;
        const adjustedLitter = originalLitter * retentionFactor;
        const adjustedSoil = originalSoil * retentionFactor;
        const adjustedTotal = originalTotal * retentionFactor;
        
        // Update display with risk-adjusted values
        const riskAdjustedElements = document.querySelectorAll('.risk-adjusted');
        riskAdjustedElements.forEach(element => {
            const originalValue = parseFloat(element.dataset.originalValue) || 0;
            const adjustedValue = originalValue * retentionFactor;
            element.textContent = adjustedValue.toFixed(2);
        });
    }

    // --- Initial Setup Calls ---
    updateGreenCoverMetrics(); // Calculate initial green cover display
    updateRiskFactorDisplays(); // Display initial risk factors

    // Return functions that need to be accessed by the main calculator
    return {
        updateCarbonCreditsCalculation,
        updateGreenCoverMetrics,
        getTotalRiskRate // May be needed by main calculation logic
    };
}
