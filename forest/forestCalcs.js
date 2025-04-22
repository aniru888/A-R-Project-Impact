import { validateForestInput, showForestError, clearForestErrors } from './forestDOM.js';
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
    // First check if it's in the uploaded species data
    const specificData = speciesData.find(s => s['Species Name'] === speciesName);
    if (specificData && specificData['Age at Peak MAI'] && !isNaN(parseFloat(specificData['Age at Peak MAI']))) {
        return parseFloat(specificData['Age at Peak MAI']);
    }
    
    // If not found in data, check for dropdown selection
    if (speciesKeyFromDropdown) {
        const ageAtMaxMAI = { 'eucalyptus_fast': 10, 'teak_moderate': 15, 'native_slow': 20 };
        return ageAtMaxMAI[speciesKeyFromDropdown] || 15; // Default to 15 if not in the mapping
    }
    
    // Try to infer from species name
    if (speciesName && speciesName.toLowerCase().includes('eucalyptus')) return 10;
    if (speciesName && speciesName.toLowerCase().includes('teak')) return 15;
    
    // Default value
    return 15;
}

/**
 * Gets the peak MAI value based on species selection
 * @param {string} speciesKey - Species key from dropdown
 * @returns {number} Peak MAI value
 */
export function getPeakMAIFromDropdown(speciesKey) {
    const maxMAI = { 'eucalyptus_fast': 25, 'teak_moderate': 12, 'native_slow': 8 };
    return maxMAI[speciesKey] || 10; // Default to 10 if not found
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
    // Base Modifiers
    let qualityModifier = 1.0; // Default for 'Medium'
    if (siteQuality === 'Good') qualityModifier = 1.2;
    if (siteQuality === 'Poor') qualityModifier = 0.7;

    let rainfallModifier = 1.0; // Default for 'Medium'
    if (avgRainfall === 'High') rainfallModifier = 1.05;
    if (avgRainfall === 'Low') rainfallModifier = 0.8;

    let soilModifier = 1.0; // Default for 'Medium' or 'Loam'
    if (soilType === 'Sandy') soilModifier = 0.9;
    if (soilType === 'Clay') soilModifier = 0.9;
    if (soilType === 'Degraded') soilModifier = 0.65;

    // Species Interaction Adjustments
    let isDroughtTolerant = false;
    let isWaterSensitive = false;
    let prefersSandy = false;
    let prefersLoam = false;

    // Check for species traits if available
    if (speciesInfo) {
        // Check based on species name patterns if no explicit traits are given
        const speciesName = (speciesInfo.name || '').toLowerCase();
        
        // Try to get explicit traits first
        isDroughtTolerant = speciesInfo.droughtTolerance === 'High';
        isWaterSensitive = speciesInfo.waterSensitivity === 'High';
        prefersSandy = speciesInfo.soilPref === 'Sandy';
        prefersLoam = speciesInfo.soilPref === 'Loam';
        
        // If no explicit traits, try to infer from species name
        if (speciesName) {
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
    if (avgRainfall === 'Low' && isDroughtTolerant) {
        rainfallModifier = 0.9; // Less penalty for drought-tolerant species
    }
    
    if (avgRainfall === 'High' && isWaterSensitive) {
        rainfallModifier = 0.95; // Penalize water-sensitive species in high rain
    }
    
    if (soilType === 'Sandy' && prefersSandy) {
        soilModifier = 1.0; // No penalty if species likes sandy soil
    }
    
    if (soilType === 'Clay' && isWaterSensitive) {
        soilModifier = 0.8; // Higher penalty on clay if sensitive
    }

    // Calculate combined modifiers with safety caps
    const combinedModifier = qualityModifier * rainfallModifier * soilModifier;
    const finalGrowthModifier = Math.max(0.1, Math.min(1.5, combinedModifier)); // Cap between 0.1 and 1.5
    
    return {
        growthModifier: finalGrowthModifier
    };
}

/**
 * Calculates risk rate based on project and environment factors
 * @param {string} projectType - Type of project
 * @param {Object} inputs - Project inputs
 * @param {Array} [speciesData] - Optional array of species data for multi-species risk calculation
 * @returns {number} Risk rate as a decimal
 */
export function calculateRiskRate(projectType, inputs, speciesData = null) {
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
        if (speciesData && speciesData.length > 1) {
            riskRate -= Math.min(0.05, speciesData.length * 0.01);
        }
        
        // Species adaptation can reduce risk
        if (inputs.speciesInfo && inputs.speciesInfo.droughtTolerance === 'High') {
            riskRate -= 0.02; // Lower risk with drought-tolerant species
        }
    }
    
    // Ensure risk rate is within reasonable bounds (5% to 25%)
    return Math.max(0.05, Math.min(0.25, riskRate));
}

// --- Input Validation Functions ---
/**
 * Gets and validates all forest calculator inputs
 * @returns {Object|null} Validated inputs object or null if invalid
 */
export function getAndValidateForestInputs() {
    clearForestErrors();
    let errors = [];
    let validationError = null;
    
    // Track the start of input validation
    trackEvent('forest_input_validation_start', { timestamp: new Date().toISOString() });
    
    const projectAreaInput = document.getElementById('projectArea');
    validationError = validateForestInput(projectAreaInput, 0.1, null, 'Project Area');
    if (validationError) errors.push(validationError);

    const plantingDensityInput = document.getElementById('plantingDensity');
    validationError = validateForestInput(plantingDensityInput, MIN_DENSITY, null, 'Planting Density');
    if (validationError) errors.push(validationError);

    const projectDurationInput = document.getElementById('projectDuration');
    validationError = validateForestInput(projectDurationInput, MIN_DURATION, MAX_DURATION, 'Project Duration');
    if (validationError) errors.push(validationError);

    const baselineRateInput = document.getElementById('baselineRate');
    validationError = validateForestInput(baselineRateInput, null, null, 'Baseline Rate');
    if (validationError) errors.push(validationError);
    
    const survivalRateInput = document.getElementById('survivalRate');
    validationError = validateForestInput(survivalRateInput, 50, 100, 'Survival Rate');
    if (validationError) errors.push(validationError);

    // Validate conversion factors
    const conversionInputs = document.querySelectorAll('#calculatorForm .factor-container input');
    conversionInputs.forEach(input => {
        validationError = validateForestInput(input, 0, null, input.previousElementSibling.textContent);
        if (validationError) errors.push(validationError);
    });

    if (errors.length > 0) {
        // Track validation errors
        trackEvent('forest_input_validation_error', { 
            errors: errors.length,
            errorDetails: errors.join(', '),
            timestamp: new Date().toISOString() 
        });
        showForestError(errors.join('<br>'));
        return null;
    }
    
    // Track successful validation
    trackEvent('forest_input_validation_success', { timestamp: new Date().toISOString() });
    
    const speciesInput = document.getElementById('species');
    
    return {
        projectArea: parseFloat(projectAreaInput.value),
        plantingDensity: parseFloat(plantingDensityInput.value),
        species: speciesInput.value,
        projectDuration: parseInt(projectDurationInput.value),
        baselineRatePerHa: parseFloat(baselineRateInput.value),
        woodDensity: parseFloat(document.getElementById('woodDensity').value),
        bef: parseFloat(document.getElementById('bef').value),
        rsr: parseFloat(document.getElementById('rsr').value),
        carbonFraction: parseFloat(document.getElementById('carbonFraction').value),
        siteQuality: document.getElementById('siteQuality').value,
        avgRainfall: document.getElementById('avgRainfall').value,
        soilType: document.getElementById('soilType').value,
        survivalRate: parseFloat(survivalRateInput.value) / 100, // Convert to decimal
        speciesData: window.forestIO.getSpeciesData() // Include species data if available
    };
}

// --- Sequestration Calculation Functions ---
/**
 * Calculates sequestration for a single species over time
 * @param {Object} inputs - Calculation inputs
 * @returns {Array} Array of annual results
 */
export function calculateSequestration(inputs) {
    // Track calculation start with basic metrics
    trackEvent('forest_sequestration_calculation_start', {
        projectArea: inputs.projectArea,
        projectDuration: inputs.projectDuration,
        species: inputs.species,
        timestamp: new Date().toISOString()
    });
    
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
        
    // Track successful calculation completion
    trackEvent('forest_sequestration_calculation_complete', {
        projectArea: inputs.projectArea,
        projectDuration: inputs.projectDuration,
        species: inputs.species,
        totalCO2e: cumulativeNetCO2e, // Use raw value for accurate tracking
        timestamp: new Date().toISOString()
    });
        
    return results;
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
                // Add raw values for calculations
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
    // Track multi-species calculation with species count
    trackEvent('forest_multi_species_calculation_start', {
        speciesCount: speciesData.length,
        projectArea: inputs.projectArea,
        projectDuration: inputs.projectDuration,
        timestamp: new Date().toISOString()
    });
    
    try {
        // Validate base inputs
        const duration = validateInputRange(inputs.projectDuration, 10, MIN_DURATION, MAX_DURATION);
        const area = validateInputRange(inputs.projectArea, 10, 0.1, 1000000);
        
        // Prepare results arrays with raw numerical values for aggregation
        let totalResults = new Array(duration).fill().map((_, i) => ({
            year: i + 1,
            age: i + 1,
            rawVolumeIncrement: 0,
            rawNetAnnualCO2e: 0,
            rawCumulativeNetCO2e: 0
        }));
        
        let speciesResults = [];
        
        // Calculate sequestration for each species
        for (const species of speciesData) {
            // Create species-specific inputs
            const speciesInputs = {
                projectDuration: duration,
                projectArea: area,
                plantingDensity: species['Number of Trees'] / area || inputs.plantingDensity,
                species: inputs.species, // Use default species for curve if specific one not provided
                woodDensity: species['Wood Density (tdm/m³)'] || inputs.woodDensity,
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
            
            // Calculate sequestration for this species
            const singleSpeciesResult = calculateSpeciesSequestration(speciesInputs);
            
            // Add to species results array
            speciesResults.push({
                speciesName: species['Species Name'] || 'Unknown Species',
                results: singleSpeciesResult
            });
            
            // Add to total results using the raw numerical values (not formatted strings)
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
        
        return {
            totalResults: formattedTotalResults,
            speciesResults
        };
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
