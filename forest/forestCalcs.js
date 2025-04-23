import { validateForestInput, showForestError, clearForestErrors, getAndValidateForestInputs, showForestResults } from './forestDOM.js';
import { formatNumber, formatCO2e } from '../utils.js';
import { trackEvent } from '../analytics.js'; // Import analytics tracking

// Helper function to validate input ranges with defaults
function validateInputRange(value, defaultValue, min = null, max = null) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return defaultValue;
    if (min !== null && parsed < min) return min;
    if (max !== null && parsed > max) return max;
    return parsed;
}

// Helper function to get volume increment based on growth rate
function getVolumeIncrement(growthRate, age) {
    // Use a sigmoid growth curve for more realistic forest growth
    // This creates an S-curve where growth is slower at the beginning,
    // accelerates in the middle years, and then plateaus as the forest matures
    
    // Parameters that define the sigmoid shape
    const midpoint = 10; // Age where growth is at middle of S-curve
    const steepness = 0.3; // How steep the S-curve is
    
    // Calculate sigmoid function value (0 to 1 range)
    const sigmoid = 1 / (1 + Math.exp(-steepness * (age - midpoint)));
    
    // Scale the sigmoid by the growth rate
    // This gives us a more realistic volume increment that changes with forest age
    return growthRate * sigmoid;
}

// Helper function to get growth rate for species
function getGrowthRateForSpecies(speciesKey, explicitRate = null) {
    if (explicitRate !== null && !isNaN(parseFloat(explicitRate))) {
        return parseFloat(explicitRate);
    }
    
    // Default growth rates by species type
    const growthRates = {
        'eucalyptus_fast': 25,
        'teak_moderate': 12,
        'native_slow': 8
    };
    
    return growthRates[speciesKey] || 12; // Default to 12 if species not found
}

// Helper function to parse numbers that might have commas in them
export function parseNumberWithCommas(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Remove any commas and convert to float
    return parseFloat(value.toString().replace(/,/g, ''));
}

// --- Constants ---
export const C_TO_CO2 = 44 / 12; // Conversion factor from C to CO2
export const MIN_DURATION = 4;   // Min project duration in years
export const MAX_DURATION = 50;  // Max project duration in years
export const MIN_DENSITY = 100;  // Min planting density in trees/ha

// --- Growth & Site Modifier Functions ---
/**
 * Calculates the periodic annual increment for a given age
 * @param {Object} growthParams - Growth parameters object
 * @param {number} currentAge - Current stand age
 * @param {number} totalDuration - Total project duration
 * @returns {number} Annual increment value
 */
export function calculateAnnualIncrement(growthParams, currentAge, totalDuration) {
    const peakMAI = growthParams.peakMAI;
    const ageAtPeakMAI = growthParams.ageAtPeakMAI;
    const peakPAI = peakMAI * 1.8; // Peak periodic annual increment
    const endPAI = peakMAI * 0.1; // End-of-life PAI
    
    if (currentAge <= 0) return 0;
    
    let periodicAnnualIncrement;
    if (currentAge <= ageAtPeakMAI) {
        // Growth phase - increases until peak
        const progressRatio = currentAge / ageAtPeakMAI;
        periodicAnnualIncrement = peakPAI * Math.pow(progressRatio, 1.5);
    } else {
        // Decline phase after peak
        const agePastPeak = currentAge - ageAtPeakMAI;
        const declineDuration = Math.max(1, totalDuration - ageAtPeakMAI);
        periodicAnnualIncrement = Math.max(endPAI, peakPAI - (peakPAI - endPAI) * (agePastPeak / declineDuration));
    }
    
    return Math.max(0, periodicAnnualIncrement);
}

/**
 * Gets the age at peak MAI based on species
 * @param {string} speciesName - Name of the species
 * @param {string} speciesKeyFromDropdown - Key from dropdown selection
 * @returns {number} Age at peak MAI
 */
export function getAgeAtPeakMAI(speciesName, speciesKeyFromDropdown = null, speciesData = []) {
    // If we have species data from an upload, try to find it there first
    if (speciesData && speciesData.length > 0) {
        for (const species of speciesData) {
            // Try to find a direct match by name
            if (species['Species Name'] && species['Species Name'].toLowerCase().includes(speciesName.toLowerCase())) {
                if (species['Age at Peak MAI'] && !isNaN(parseFloat(species['Age at Peak MAI']))) {
                    return parseFloat(species['Age at Peak MAI']);
                }
            }
        }
    }

    // Default ages at peak MAI for different species
    if (speciesKeyFromDropdown === 'eucalyptus_fast' || speciesName.toLowerCase().includes('eucalypt')) {
        return 10; // Eucalyptus peaks early
    } else if (speciesKeyFromDropdown === 'teak_moderate' || speciesName.toLowerCase().includes('teak')) {
        return 15; // Teak peaks at middle age
    } else if (speciesKeyFromDropdown === 'native_slow' || speciesName.toLowerCase().includes('native')) {
        return 25; // Native/slow-growth species peak later
    }
    
    // Default to 20 years if species not recognized
    return 20;
}

/**
 * Calculates site modifiers based on site conditions and species traits
 * @param {string} siteQuality - Quality of the site
 * @param {string} avgRainfall - Average rainfall category
 * @param {string} soilType - Type of soil
 * @param {Object} speciesInfo - Species traits information
 * @returns {Object} Object containing site modifiers
 */
export function getSiteModifiers(siteQuality, avgRainfall, soilType, speciesInfo) {
    // Default modifier is 1.0 (no change)
    let qualityMod = 1.0;
    let rainfallMod = 1.0;
    let soilMod = 1.0;
    
    // Site quality modifier
    switch (siteQuality) {
        case 'Good':
            qualityMod = 1.2;
            break;
        case 'Medium':
            qualityMod = 1.0;
            break;
        case 'Poor':
            qualityMod = 0.8;
            break;
        default:
            qualityMod = 1.0;
    }
    
    // Rainfall modifier
    switch (avgRainfall) {
        case 'High':
            rainfallMod = 1.15;
            break;
        case 'Medium':
            rainfallMod = 1.0;
            break;
        case 'Low':
            rainfallMod = 0.85;
            break;
        default:
            rainfallMod = 1.0;
    }
    
    // Soil type modifier
    switch (soilType) {
        case 'Loam':
            soilMod = 1.1;
            break;
        case 'Sandy':
            soilMod = 0.95;
            break;
        case 'Clay':
            soilMod = 0.9;
            break;
        case 'Degraded':
            soilMod = 0.8;
            break;
        default:
            soilMod = 1.0;
    }
    
    // Adjust modifiers based on species traits if available
    if (speciesInfo) {
        const speciesName = speciesInfo.species || '';
        const isDroughtTolerant = speciesInfo.droughtTolerant || false;
        const isWaterSensitive = speciesInfo.waterSensitive || false;
        const preferredSoil = speciesInfo.preferredSoil || '';
        
        // If species name is available but no specific traits, try to infer them
        if (speciesName && (!isDroughtTolerant && !isWaterSensitive && !preferredSoil)) {
            // Example logic - would be better with a proper species database
            if (!isDroughtTolerant && (speciesName.includes('acacia') || speciesName.includes('casuarina') || 
                speciesName.includes('native_slow'))) {
                isDroughtTolerant = true;
            }
            
            if (!isWaterSensitive && (speciesName.includes('eucalyptus') || speciesName.includes('pine'))) {
                isWaterSensitive = speciesName.includes('eucalyptus_fast');
            }
        }
    }

    // Apply species-specific adjustments
    return {
        qualityModifier: qualityMod,
        rainfallModifier: rainfallMod,
        soilModifier: soilMod,
        combinedModifier: qualityMod * rainfallMod * soilMod
    };
}

/**
 * Calculate risk rate for a project based on various factors
 * @param {string} projectType - Type of project (forest, etc.)
 * @param {Object} inputs - Calculation inputs
 * @returns {number} Risk rate as decimal (0-1)
 */
export function calculateRiskRate(projectType, inputs, speciesData = null) {
    // Get risk rate input if available
    const riskRateInput = document.getElementById('riskRate');
    const riskRate = riskRateInput ? parseFloat(riskRateInput.value) / 100 : 0.15;
    
    // Ensure it's a valid number between 0-1
    if (isNaN(riskRate) || riskRate < 0) return 0.15; // default 15%
    if (riskRate > 1) return 1;
    
    return riskRate;
}

// --- Sequestration Calculation Functions ---
/**
 * Calculates sequestration for a single species over time
 * @param {Object} inputs - Calculation inputs
 * @returns {Array} Array of annual results
 */
export function calculateSequestration(inputs) {
    // Add debug logging
    console.log('Starting calculation with inputs:', inputs);
    
    // Track calculation start with basic metrics
    trackEvent('forest_sequestration_calculation_start', {
        projectArea: inputs.projectArea,
        projectDuration: inputs.projectDuration,
        species: inputs.species,
        timestamp: new Date().toISOString()
    });
    
    try {
        // Validate inputs or assign defaults
        const duration = validateInputRange(inputs.projectDuration, 10, MIN_DURATION, MAX_DURATION);
        const density = validateInputRange(inputs.plantingDensity, 1600, 100, 10000);
        const area = validateInputRange(inputs.projectArea, 10, 0.1, 1000000);
        const growthRate = getGrowthRateForSpecies(inputs.species, inputs.growthRate);
        const woodDensity = validateInputRange(inputs.woodDensity, 0.5, 0.1, 1.5);
        const bef = validateInputRange(inputs.bef, 1.5, 1.0, 3.0);
        const rsr = validateInputRange(inputs.rsr, 0.25, 0.1, 0.8);
        const carbonFraction = validateInputRange(inputs.carbonFraction, 0.47, 0.4, 0.6);
        const survivalRate = validateInputRange(inputs.survivalRate, 85, 50, 100) / 100;
            
        // Get risk rate based on inputs and species
        const riskRate = calculateRiskRate('forest', inputs);
            
        // Calculate actual trees planted (accounting for survival)
        const actualTrees = Math.round(density * area * survivalRate);
            
        // Initial conditions
        let results = [];
        let cumulativeCarbonStock = 0;
        let cumulativeNetCO2e = 0;
            
        // Calculate sequestration for each year
        for (let year = 1; year <= duration; year++) {
            // Tree age calculation
            const age = year;
                
            // Volume increment (based on growth curve)
            const volumeIncrement = getVolumeIncrement(growthRate, age);
                
            // Calculate biomass for the year
            const stemBiomass = volumeIncrement * woodDensity;
            const aboveGroundBiomass = stemBiomass * bef;
            const belowGroundBiomass = aboveGroundBiomass * rsr;
            const totalBiomass = aboveGroundBiomass + belowGroundBiomass;
                
            // Calculate carbon stock
            const carbonStock = totalBiomass * carbonFraction * actualTrees;
            cumulativeCarbonStock += carbonStock;
                
            // Apply risk rate to get net carbon
            const netCarbon = carbonStock * (1 - riskRate);
                
            // Convert to CO2 equivalent
            const annualCO2e = netCarbon * C_TO_CO2; 
            cumulativeNetCO2e += annualCO2e;
                
            // Store results for this year with both formatted and raw values
            results.push({
                year,
                age,
                volumeIncrement: formatNumber(volumeIncrement, 3),
                netAnnualCO2e: formatCO2e(annualCO2e),
                cumulativeNetCO2e: formatCO2e(cumulativeNetCO2e),
                // Add raw values for calculations
                rawVolumeIncrement: volumeIncrement,
                rawNetAnnualCO2e: annualCO2e,
                rawCumulativeNetCO2e: cumulativeNetCO2e
            });
        }
        
        // Add debug at end
        console.log(`Calculation complete. Generated ${results.length} year results.`);
        console.log('First row example:', results[0]);
        console.log('Last row example:', results[results.length-1]);
            
        trackEvent('forest_sequestration_calculation_complete', {
            projectArea: inputs.projectArea,
            projectDuration: inputs.projectDuration,
            species: inputs.species,
            totalCO2e: cumulativeNetCO2e, // Use raw value for accurate tracking
            timestamp: new Date().toISOString()
        });
            
        // Show results after calculation is complete
        showForestResults();
            
        return results;
    } catch (error) {
        console.error('Calculation error:', error);
        // Track calculation errors
        trackEvent('forest_sequestration_calculation_error', {
            error: error.message,
            inputs: JSON.stringify(inputs),
            timestamp: new Date().toISOString()
        });
        throw error; // Re-throw to be caught by the main error handler
    }
}

/**
 * Calculates sequestration for a single species with specific parameters
 * @param {Object} inputs - Calculation inputs including species-specific data
 * @returns {Array} Array of annual results
 */
export function calculateSpeciesSequestration(inputs) {
    // Track species-specific calculation
    trackEvent('forest_species_calculation_start', {
        species: inputs.species,
        timestamp: new Date().toISOString()
    });
    
    try {
        const duration = validateInputRange(inputs.projectDuration, 10, MIN_DURATION, MAX_DURATION);
        const density = validateInputRange(inputs.plantingDensity, 1600, 100, 10000);
        const area = validateInputRange(inputs.projectArea, 10, 0.1, 1000000);
        const growthRate = inputs.growthRate || getGrowthRateForSpecies(inputs.species);
        const woodDensity = validateInputRange(inputs.woodDensity, 0.5, 0.1, 1.5);
        const bef = validateInputRange(inputs.bef, 1.5, 1.0, 3.0);
        const rsr = validateInputRange(inputs.rsr, 0.25, 0.1, 0.8);
        const carbonFraction = validateInputRange(inputs.carbonFraction, 0.47, 0.4, 0.6);
        const survivalRate = validateInputRange(inputs.survivalRate, 85, 50, 100) / 100;
        
        // Calculate species specific risk rate from inputs
        const riskRate = calculateRiskRate('forest', inputs);
        
        // Calculate actual trees planted (accounting for survival)
        // For species-specific, we're looking at the portion of the total area, so adjust by percent
        const speciesArea = area / (inputs._totalSpecies || 1);
        const actualTrees = Math.round(density * speciesArea * survivalRate);
        
        // Initial conditions
        let results = [];
        let cumulativeCarbonStock = 0;
        let cumulativeNetCO2e = 0;
        
        // Calculate sequestration for each year
        for (let year = 1; year <= duration; year++) {
            // Same calculation as in calculateSequestration
            const age = year;
            const volumeIncrement = getVolumeIncrement(growthRate, age);
            
            const stemBiomass = volumeIncrement * woodDensity;
            const aboveGroundBiomass = stemBiomass * bef;
            const belowGroundBiomass = aboveGroundBiomass * rsr;
            const totalBiomass = aboveGroundBiomass + belowGroundBiomass;
            
            const carbonStock = totalBiomass * carbonFraction * actualTrees;
            cumulativeCarbonStock += carbonStock;
            
            const netCarbon = carbonStock * (1 - riskRate);
            const annualCO2e = netCarbon * C_TO_CO2; 
            cumulativeNetCO2e += annualCO2e;
            
            // Store results for this year with both raw and formatted values
            results.push({
                year,
                age,
                volumeIncrement: formatNumber(volumeIncrement, 3),
                netAnnualCO2e: formatCO2e(annualCO2e),
                cumulativeNetCO2e: formatCO2e(cumulativeNetCO2e),
                rawVolumeIncrement: volumeIncrement,
                rawNetAnnualCO2e: annualCO2e,
                rawCumulativeNetCO2e: cumulativeNetCO2e
            });
        }
        
        // Track successful species calculation
        trackEvent('forest_species_calculation_complete', {
            species: inputs.species,
            totalCO2e: cumulativeNetCO2e, // Use raw value for accurate tracking
            timestamp: new Date().toISOString()
        });
        
        return results;
    } catch (error) {
        // Track species calculation errors
        trackEvent('forest_species_calculation_error', {
            species: inputs.species,
            error: error.message,
            timestamp: new Date().toISOString()
        });
        console.error("Species calculation error:", error);
        throw new Error(`Error calculating species sequestration: ${error.message}`);
    }
}

/**
 * Calculates sequestration for multiple species from uploaded data
 * @param {Object} inputs - Common project inputs
 * @param {Array} speciesData - Array of species data objects
 * @returns {Object} Object with totalResults and speciesResults
 */
export function calculateSequestrationMultiSpecies(inputs, speciesData) {
    // Track multi-species calculation start
    trackEvent('forest_multi_species_calculation_start', {
        speciesCount: speciesData.length,
        projectArea: inputs.projectArea,
        projectDuration: inputs.projectDuration,
        timestamp: new Date().toISOString()
    });
    
    try {
        if (!Array.isArray(speciesData) || speciesData.length === 0) {
            throw new Error('No species data provided for multi-species calculation');
        }
        
        console.log(`Starting multi-species calculation with ${speciesData.length} species`);
        
        // Initialize total and per-species results
        let totalResults = [];
        const speciesResults = {};
        
        // Initialize total results array structure
        for (let i = 1; i <= inputs.projectDuration; i++) {
            totalResults.push({
                year: i,
                age: i,
                rawVolumeIncrement: 0,
                rawNetAnnualCO2e: 0,
                rawCumulativeNetCO2e: 0
            });
        }
        
        // Calculate sequestration for each species and aggregate
        for (const species of speciesData) {
            // Skip species with missing essential data
            if (!species['Species Name'] || !species['Number of Trees'] || !species['Growth Rate (m³/ha/yr)']) {
                console.warn('Skipping species with missing essential data:', species);
                continue;
            }
            
            // Create inputs for this species
            const speciesInputs = {
                ...inputs, // Base inputs from the form
                species: species['Species Name'],
                plantingDensity: parseInt(species['Number of Trees'] || inputs.plantingDensity),
                growthRate: parseFloat(species['Growth Rate (m³/ha/yr)'] || inputs.growthRate),
                woodDensity: parseFloat(species['Wood Density (tdm/m³)'] || inputs.woodDensity),
                bef: species['BEF'] || inputs.bef,
                rsr: species['Root-Shoot Ratio'] || inputs.rsr,
                carbonFraction: species['Carbon Fraction'] || inputs.carbonFraction,
                survivalRate: species['Survival Rate (%)'] || inputs.survivalRate,
                growthRate: species['Growth Rate (m³/ha/yr)'] || inputs.growthRate,
                siteQuality: species['Site Quality'] || inputs.siteQuality,
                avgRainfall: species['Average Rainfall'] || inputs.avgRainfall,
                soilType: species['Soil Type'] || inputs.soilType,
                _totalSpecies: speciesData.length // Pass total number of species
            };
            
            // Calculate for this species
            const singleSpeciesResult = calculateSpeciesSequestration(speciesInputs);
            
            // Store species-specific results
            speciesResults[species['Species Name']] = singleSpeciesResult;
            
            // Add to total results
            for (let i = 0; i < singleSpeciesResult.length; i++) {
                totalResults[i].rawVolumeIncrement += singleSpeciesResult[i].rawVolumeIncrement;
                totalResults[i].rawNetAnnualCO2e += singleSpeciesResult[i].rawNetAnnualCO2e;
                totalResults[i].rawCumulativeNetCO2e += singleSpeciesResult[i].rawCumulativeNetCO2e;
            }
        }
        
        // Format total results only after all aggregation is complete
        const formattedTotalResults = totalResults.map(result => ({
            year: result.year,
            age: result.age,
            volumeIncrement: formatNumber(result.rawVolumeIncrement, 3),
            netAnnualCO2e: formatCO2e(result.rawNetAnnualCO2e),
            cumulativeNetCO2e: formatCO2e(result.rawCumulativeNetCO2e)
        }));
        
        // Track successful multi-species calculation
        trackEvent('forest_multi_species_calculation_complete', {
            speciesCount: speciesData.length,
            projectArea: inputs.projectArea,
            projectDuration: inputs.projectDuration,
            totalCO2e: totalResults[totalResults.length - 1].rawCumulativeNetCO2e,
            timestamp: new Date().toISOString()
        });
        
        const result = {
            totalResults: formattedTotalResults,
            speciesResults
        };
        
        // Show results after calculation is complete
        showForestResults();
        
        return result;
    } catch (error) {
        // Track multi-species calculation errors
        trackEvent('forest_multi_species_calculation_error', {
            speciesCount: speciesData.length,
            error: error.message,
            timestamp: new Date().toISOString()
        });
        console.error("Multi-species calculation error:", error);
        throw new Error(`Error calculating multi-species sequestration: ${error.message}`);
    }
}

// --- Cost Analysis Function ---
/**
 * Calculates cost analysis metrics based on sequestration results
 * @param {Array} results - Sequestration results array
 * @param {number} totalCost - Total project cost
 * @returns {Object} Object with cost analysis metrics
 */
export function calculateForestCostAnalysis(results, totalCost) {
    // Track cost analysis calculation
    trackEvent('forest_cost_analysis_start', {
        totalCost: totalCost,
        timestamp: new Date().toISOString()
    });
    
    try {
        if (!results || !results.length) {
            throw new Error('No results available for cost analysis');
        }

        const finalCumulativeCO2e = parseFloat(results[results.length - 1].cumulativeNetCO2e);
        const projectAreaInput = document.getElementById('projectArea');
        
        // Format for cost analysis return object
        const costAnalysis = {
            totalSequestration: '0.00 tCO₂e',
            totalProjectCost: `₹ ${totalCost.toLocaleString('en-IN')}`,
            costPerTonne: 'N/A',
            costPerHectarePerTonne: 'N/A', 
            costBreakdown: ''
        };
        
        // Prevent division by zero or negative values
        if (isNaN(finalCumulativeCO2e) || finalCumulativeCO2e <= 0) {
            const displayValue = isNaN(finalCumulativeCO2e) ? '0.00' : 
                finalCumulativeCO2e.toLocaleString('en-IN', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                });
            costAnalysis.totalSequestration = `${displayValue} tCO₂e`;
            costAnalysis.costBreakdown = 'Cost calculation not applicable (zero or negative sequestration)';
            return costAnalysis; // Return early with limited info
        }

        const costPerTonne = totalCost / finalCumulativeCO2e;
        const projectArea = parseFloat(projectAreaInput?.value);
        
        if (isNaN(projectArea) || projectArea <= 0) {
            throw new Error('Invalid project area value');
        }

        const costPerHectarePerTonne = (totalCost / projectArea) / finalCumulativeCO2e;
        
        // Update cost analysis object with all values
        costAnalysis.totalSequestration = `${finalCumulativeCO2e.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })} tCO₂e`;
        
        costAnalysis.costPerTonne = `₹ ${costPerTonne.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })}`;
        
        costAnalysis.costPerHectarePerTonne = `₹ ${costPerHectarePerTonne.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })}`;
        
        costAnalysis.costBreakdown = `
            Cost per tCO₂e = ₹${totalCost.toLocaleString('en-IN')} ÷ ${finalCumulativeCO2e.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })} tCO₂e = ₹${costPerTonne.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })} per tCO₂e
        `;
        
        // Track successful cost analysis calculation
        trackEvent('forest_cost_analysis_complete', {
            totalCost: totalCost,
            costPerTonne: costAnalysis.costPerTonne,
            timestamp: new Date().toISOString()
        });
        
        return costAnalysis;
        
    } catch (error) {
        // Track cost analysis errors
        trackEvent('forest_cost_analysis_error', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
        console.error("Cost analysis error:", error);
        showForestError("An error occurred during cost analysis calculations. Please check your inputs.");
        throw error; // Re-throw to be caught by the main error handler
    }
}