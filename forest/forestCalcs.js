import { formatNumber, formatCO2e } from '../utils.js';

// Create central event system that will be imported by other modules
export const forestEventSystem = {
    callbacks: {},
    initialized: false,
    
    /**
     * Initialize the event system
     */
    init() {
        if (this.initialized) {
            console.log('Forest event system already initialized');
            return this;
        }
        
        console.log('Initializing forest event system at:', new Date().toISOString());
        console.trace('Initialization stack trace');
        
        this.callbacks = {};
        this.initialized = true;
        console.log('Forest event system initialized successfully');
        return this;
    },
    
    /**
     * Register event callbacks
     * @param {Object} events - Key-value pairs of event names and callbacks
     */
    registerEvents(events) {
        // Auto-initialize if not already done
        if (!this.initialized) {
            this.init();
        }
        
        for (const [eventName, callback] of Object.entries(events)) {
            this.callbacks[eventName] = callback;
        }
        
        console.log('Forest event callbacks registered:', Object.keys(events).join(', '));
        return this;
    },
    
    /**
     * Trigger an event
     * @param {string} eventName - Name of the event to trigger
     * @param  {...any} args - Arguments to pass to the callback
     * @returns {any} - Return value from the callback
     */
    trigger(eventName, ...args) {
        if (this.callbacks[eventName]) {
            try {
                return this.callbacks[eventName](...args);
            } catch (error) {
                console.error(`Error triggering event ${eventName}:`, error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(`Error in ${eventName}: ${error.message}`);
                }
                // Add user-friendly error display
                if (this.callbacks.showError) {
                    this.callbacks.showError(`An error occurred while processing ${eventName}. Please try again.`);
                }
            }
        } else {
            console.log(`No handler registered for event: ${eventName}`);
        }
    },
    
    // Convenience methods for common events
    showError(message, element) {
        if (this.callbacks.showError) {
            this.callbacks.showError(message, element);
        } else {
            console.error(message);
        }
    },
    
    onResults(results) {
        if (this.callbacks.onResults) {
            this.callbacks.onResults(results);
        }
    },
    
    onReset() {
        if (this.callbacks.onReset) {
            this.callbacks.onReset();
        }
    },
    
    onValidationError(errorDiv) {
        if (this.callbacks.onValidationError) {
            return this.callbacks.onValidationError(errorDiv);
        }
        return null;
    },
    
    dataUpdated(data) {
        if (this.callbacks.dataUpdated) {
            this.callbacks.dataUpdated(data);
        }
    }
};

// Constants used in forest sequestration calculations
const CARBON_FRACTION_DEFAULT = 0.47;
const FOREST_MORTALITY_FACTOR = 0.15; // 15% mortality rate by default
const CO2_TO_C_RATIO = 44 / 12; // Ratio to convert carbon to CO2e
const YEAR_INTERVALS = 5; // Calculate results every 5 years
const DEFAULT_SURVIVAL_RATE = 85; // 85% survival rate by default

/**
 * Calculate forest sequestration over time
 * @param {Object} inputs - Forest calculation inputs
 * @returns {Array<Object>} Array of yearly sequestration results
 */
export function calculateSequestration(inputs) {
    console.log('Calculating forest sequestration for inputs:', inputs);
    
    try {
        // Extract and validate inputs
        const {
            area,
            density,
            growthRate,
            woodDensity,
            bef,
            rsr,
            carbonFraction = CARBON_FRACTION_DEFAULT,
            duration,
            mortalityRate = FOREST_MORTALITY_FACTOR,
            harvestInterval = 0,
            species = 'Generic'
        } = inputs;
        
        // The total number of trees planted
        const totalTrees = area * density;
        
        // Calculate the survival rate from mortality rate
        const survivalRate = 1 - mortalityRate;
        
        // Check if any inputs are invalid
        if (area <= 0 || density <= 0 || growthRate <= 0 || duration <= 0) {
            forestEventSystem.showError('All inputs must be positive numbers.');
            return null;
        }
        
        // Array to store yearly results
        const results = [];
        
        // Calculate yearly sequestration
        for (let year = 0; year <= duration; year++) {
            // Only add results for every interval year and the final year
            if (year % YEAR_INTERVALS === 0 || year === duration) {
                // Calculate survival based on survival rate and years
                const survivingTrees = totalTrees * Math.pow(survivalRate, year);
                
                // Growing stock volume (m³) = area (ha) * MAI (m³/ha/yr) * year
                const growingStock = area * growthRate * year;
                
                // Calculate above-ground biomass
                const aboveGroundBiomass = growingStock * woodDensity * bef;
                
                // Calculate below-ground biomass using root-to-shoot ratio
                const belowGroundBiomass = aboveGroundBiomass * rsr;
                
                // Total biomass (tonnes dry matter)
                const totalBiomass = aboveGroundBiomass + belowGroundBiomass;
                
                // Carbon content (tonnes C)
                const carbonContent = totalBiomass * carbonFraction;
                
                // Convert carbon to CO2 equivalent (tonnes CO2e)
                const co2e = carbonContent * CO2_TO_C_RATIO;
                
                // Calculate losses due to mortality
                const mortalityLoss = year > 0 ? results[results.length - 1].cumulativeLosses * mortalityRate : 0;
                const cumulativeLosses = year > 0 ? results[results.length - 1].cumulativeLosses + mortalityLoss : 0;
                
                // Calculate net CO2e after accounting for losses
                const netCO2e = co2e - cumulativeLosses;
                
                // Apply harvest cycle if applicable
                let harvestedCO2e = 0;
                if (harvestInterval > 0 && year > 0 && year % harvestInterval === 0) {
                    // Assume 70% of above-ground biomass is harvested
                    harvestedCO2e = aboveGroundBiomass * 0.7 * carbonFraction * CO2_TO_C_RATIO;
                }
                
                // Format the result values
                const formattedCO2e = formatCO2e(co2e);
                const formattedNetCO2e = formatCO2e(netCO2e);
                
                // Store raw values for calculations and formatted values for display
                results.push({
                    year,
                    growingStock: formatNumber(growingStock),
                    rawGrowingStock: growingStock,
                    aboveGroundBiomass: formatNumber(aboveGroundBiomass),
                    rawAboveGroundBiomass: aboveGroundBiomass,
                    belowGroundBiomass: formatNumber(belowGroundBiomass),
                    rawBelowGroundBiomass: belowGroundBiomass,
                    totalBiomass: formatNumber(totalBiomass),
                    rawTotalBiomass: totalBiomass,
                    carbonContent: formatNumber(carbonContent),
                    rawCarbonContent: carbonContent,
                    co2e: formattedCO2e,
                    rawCO2e: co2e,
                    annualSequestration: year > 0 ? formatCO2e(co2e - results[results.length - 1].rawCO2e) : '0',
                    rawAnnualSequestration: year > 0 ? co2e - results[results.length - 1].rawCO2e : 0,
                    mortalityLoss: formatCO2e(mortalityLoss),
                    rawMortalityLoss: mortalityLoss,
                    cumulativeLosses: formatCO2e(cumulativeLosses),
                    rawCumulativeLosses: cumulativeLosses,
                    netCO2e: formattedNetCO2e,
                    rawNetCO2e: netCO2e,
                    harvestedCO2e: formatCO2e(harvestedCO2e),
                    rawHarvestedCO2e: harvestedCO2e,
                    survivingTrees: Math.round(survivingTrees),
                    cumulativeNetCO2e: formattedNetCO2e,
                    rawCumulativeNetCO2e: netCO2e,
                    species: species
                });
            }
        }
        
        console.log('Sequestration calculation completed:', results.length, 'data points');
        
        return results;
    } catch (error) {
        console.error('Error calculating sequestration:', error);
        forestEventSystem.showError(`Calculation error: ${error.message}`);
        return null;
    }
}

/**
 * Calculate sequestration for multiple species
 * @param {Object} commonInputs - Common inputs for all species
 * @param {Array<Object>} speciesData - Array of species data
 * @returns {Object} Combined results for all species
 */
export function calculateSequestrationMultiSpecies(commonInputs, speciesData) {
    console.log('Calculating sequestration for', speciesData.length, 'species');
    
    try {
        // Check if we have valid species data
        if (!Array.isArray(speciesData) || speciesData.length === 0) {
            forestEventSystem.showError('No species data provided for multi-species calculation');
            return null;
        }
        
        // Extract common inputs
        const {
            area,
            duration,
            projectCost,
            mortalityRate = FOREST_MORTALITY_FACTOR
        } = commonInputs;
        
        // Array to store results for each species
        const speciesResults = [];
        
        // Calculate the total area
        const totalArea = area || 0;
        
        // Precalculate species areas based on the number of trees proportion
        let totalTrees = 0;
        
        // First pass to count total trees
        speciesData.forEach(species => {
            const numberOfTrees = parseInt(species['Number of Trees'] || 0);
            totalTrees += numberOfTrees;
        });
        
        // Calculate sequestration for each species
        speciesData.forEach(species => {
            // Extract species data
            const speciesName = species['Species Name'] || 'Unknown';
            const numberOfTrees = parseInt(species['Number of Trees'] || 0);
            const treesRatio = numberOfTrees / totalTrees;
            const speciesArea = totalArea * treesRatio;
            const density = totalArea > 0 ? numberOfTrees / speciesArea : 1000; // Default to 1000 trees/ha if area is invalid
            const growthRate = parseFloat(species['Growth Rate (m³/ha/yr)'] || 10);
            const woodDensity = parseFloat(species['Wood Density (tdm/m³)'] || 0.5);
            const bef = parseFloat(species['BEF'] || 1.4);
            const rsr = parseFloat(species['Root-Shoot Ratio'] || 0.25);
            const carbonFraction = parseFloat(species['Carbon Fraction'] || CARBON_FRACTION_DEFAULT);
            
            // Parse survival rate if provided, otherwise use default
            const survivalRatePercent = parseFloat(species['Survival Rate (%)'] || DEFAULT_SURVIVAL_RATE);
            const survivalRate = survivalRatePercent / 100;
            const speciesMortalityRate = 1 - survivalRate;
            
            // Create inputs object for this species
            const speciesInputs = {
                area: speciesArea,
                density,
                growthRate,
                woodDensity,
                bef,
                rsr,
                carbonFraction,
                duration,
                mortalityRate: speciesMortalityRate,
                species: speciesName
            };
            
            // Calculate sequestration for this species
            const results = calculateSequestration(speciesInputs);
            
            // Add to species results
            if (results) {
                speciesResults.push({
                    speciesName,
                    numberOfTrees,
                    area: speciesArea,
                    treesRatio,
                    results
                });
            }
        });
        
        // Calculate total sequestration across all species
        const totalResults = [];
        
        // Get the maximum duration from all species results
        const maxDuration = duration;
        
        // For each time interval, sum the sequestration from all species
        for (let year = 0; year <= maxDuration; year += YEAR_INTERVALS) {
            if (year % YEAR_INTERVALS === 0 || year === maxDuration) {
                let totalGrowingStock = 0;
                let totalAboveGroundBiomass = 0;
                let totalBelowGroundBiomass = 0;
                let totalBiomass = 0;
                let totalCarbonContent = 0;
                let totalCO2e = 0;
                let totalNetCO2e = 0;
                let totalAnnualSequestration = 0;
                let totalMortalityLoss = 0;
                let totalCumulativeLosses = 0;
                let totalSurvivingTrees = 0;
                
                // Sum results from each species for this year
                speciesResults.forEach(species => {
                    const yearResult = species.results.find(result => result.year === year);
                    
                    if (yearResult) {
                        totalGrowingStock += yearResult.rawGrowingStock;
                        totalAboveGroundBiomass += yearResult.rawAboveGroundBiomass;
                        totalBelowGroundBiomass += yearResult.rawBelowGroundBiomass;
                        totalBiomass += yearResult.rawTotalBiomass;
                        totalCarbonContent += yearResult.rawCarbonContent;
                        totalCO2e += yearResult.rawCO2e;
                        totalNetCO2e += yearResult.rawNetCO2e;
                        totalAnnualSequestration += yearResult.rawAnnualSequestration;
                        totalMortalityLoss += yearResult.rawMortalityLoss;
                        totalCumulativeLosses += yearResult.rawCumulativeLosses;
                        totalSurvivingTrees += yearResult.survivingTrees;
                    }
                });
                
                // Create a result for this year with totals
                totalResults.push({
                    year,
                    growingStock: formatNumber(totalGrowingStock),
                    rawGrowingStock: totalGrowingStock,
                    aboveGroundBiomass: formatNumber(totalAboveGroundBiomass),
                    rawAboveGroundBiomass: totalAboveGroundBiomass,
                    belowGroundBiomass: formatNumber(totalBelowGroundBiomass),
                    rawBelowGroundBiomass: totalBelowGroundBiomass,
                    totalBiomass: formatNumber(totalBiomass),
                    rawTotalBiomass: totalBiomass,
                    carbonContent: formatNumber(totalCarbonContent),
                    rawCarbonContent: totalCarbonContent,
                    co2e: formatCO2e(totalCO2e),
                    rawCO2e: totalCO2e,
                    annualSequestration: formatCO2e(totalAnnualSequestration),
                    rawAnnualSequestration: totalAnnualSequestration,
                    mortalityLoss: formatCO2e(totalMortalityLoss),
                    rawMortalityLoss: totalMortalityLoss,
                    cumulativeLosses: formatCO2e(totalCumulativeLosses),
                    rawCumulativeLosses: totalCumulativeLosses,
                    netCO2e: formatCO2e(totalNetCO2e),
                    rawNetCO2e: totalNetCO2e,
                    survivingTrees: Math.round(totalSurvivingTrees),
                    cumulativeNetCO2e: formatCO2e(totalNetCO2e),
                    rawCumulativeNetCO2e: totalNetCO2e,
                    species: 'All Species'
                });
            }
        }
        
        // Return both the individual species results and the total
        return {
            totalResults,
            speciesResults
        };
    } catch (error) {
        console.error('Error in multi-species calculation:', error);
        forestEventSystem.showError(`Multi-species calculation error: ${error.message}`);
        return null;
    }
}

/**
 * Calculate cost analysis for forest project
 * @param {number} projectCost - Total project cost
 * @param {number} area - Project area in hectares
 * @param {Array<Object>} results - Sequestration results
 * @returns {Object} Cost analysis results
 */
export function calculateForestCostAnalysis(projectCost, area, results) {
    try {
        if (!projectCost || projectCost <= 0 || !results || !results.length) {
            console.error('Invalid inputs for cost analysis');
            return null;
        }
        
        // Get the final sequestration result
        const finalResult = results[results.length - 1];
        const totalSequestration = finalResult.rawCumulativeNetCO2e;
        
        // Calculate cost per tonne of CO2e
        const costPerTonne = totalSequestration > 0 ? projectCost / totalSequestration : 0;
        
        // Calculate cost per hectare
        const costPerHectare = area > 0 ? projectCost / area : 0;
        
        // Calculate estimated cost breakdown (simplified)
        const costBreakdown = {
            establishment: formatCO2e(projectCost * 0.4), // 40% for establishment
            maintenance: formatCO2e(projectCost * 0.3),   // 30% for maintenance
            monitoring: formatCO2e(projectCost * 0.2),    // 20% for monitoring
            other: formatCO2e(projectCost * 0.1)          // 10% for other costs
        };
        
        // Return the cost analysis
        return {
            totalProjectCost: formatCO2e(projectCost),
            costPerTonne: formatCO2e(costPerTonne),
            costPerHectare: formatCO2e(costPerHectare),
            costBreakdown
        };
    } catch (error) {
        console.error('Error calculating cost analysis:', error);
        return null;
    }
}