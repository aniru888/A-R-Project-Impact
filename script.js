// script.js

// --- Helper Functions (General) ---
function parseNumberWithCommas(str) {
    return parseFloat(String(str).replace(/,/g, '')) || 0;
}

function formatCO2e(text) {
    return typeof text === 'string' ? text.replace(/CO₂e/g, 'CO2e') : text;
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Debounce function to limit the rate at which a function can fire
function debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

// --- Tooltip Functions ---
function positionTooltip(tooltip, element, position = 'top') {
    // Use requestAnimationFrame for smooth positioning
    requestAnimationFrame(() => {
        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        const margin = 8;

        let top, left;
        
        // Calculate initial position
        switch (position) {
            case 'top':
                top = elementRect.top + scrollY - tooltipRect.height - margin;
                left = elementRect.left + scrollX + (elementRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = elementRect.bottom + scrollY + margin;
                left = elementRect.left + scrollX + (elementRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = elementRect.top + scrollY + (elementRect.height - tooltipRect.height) / 2;
                left = elementRect.left + scrollX - tooltipRect.width - margin;
                break;
            case 'right':
                top = elementRect.top + scrollY + (elementRect.height - tooltipRect.height) / 2;
                left = elementRect.right + scrollX + margin;
                break;
        }

        // Check viewport boundaries and adjust if needed
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position if tooltip goes outside viewport
        if (left < margin) {
            left = margin;
        } else if (left + tooltipRect.width > viewportWidth - margin) {
            left = viewportWidth - tooltipRect.width - margin;
        }

        // Adjust vertical position if tooltip goes outside viewport
        if (top < margin) {
            if (position === 'top') {
                // Flip to bottom
                top = elementRect.bottom + scrollY + margin;
                position = 'bottom';
            } else {
                top = margin;
            }
        } else if (top + tooltipRect.height > viewportHeight + scrollY - margin) {
            if (position === 'bottom') {
                // Flip to top
                top = elementRect.top + scrollY - tooltipRect.height - margin;
                position = 'top';
            } else {
                top = viewportHeight + scrollY - tooltipRect.height - margin;
            }
        }

        // Apply position with hardware acceleration
        tooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        tooltip.style.top = '0';
        tooltip.style.left = '0';
        tooltip.dataset.position = position;
    });
}

function initializeTooltips() {
    const elements = document.querySelectorAll('[title]');
    let activeTooltip = null;
    let tooltipTimer = null;

    elements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            // Clear any existing timer
            if (tooltipTimer) {
                clearTimeout(tooltipTimer);
                tooltipTimer = null;
            }
            
            // If there's already an active tooltip, remove it
            if (activeTooltip) {
                activeTooltip.remove();
                activeTooltip = null;
            }

            // Store original title and remove to prevent default browser tooltip
            element._title = element.getAttribute('title');
            if (!element._title) return; // Don't create tooltip if title is empty
            element.removeAttribute('title');

            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = element._title;
            document.body.appendChild(tooltip);
            activeTooltip = tooltip;

            // Position tooltip
            positionTooltip(tooltip, element);
            tooltip.classList.add('active');
        });

        element.addEventListener('mouseleave', () => {
            tooltipTimer = setTimeout(() => {
                if (activeTooltip) {
                    activeTooltip.remove();
                    activeTooltip = null;
                }
                // Restore title attribute
                if (element._title) {
                    element.setAttribute('title', element._title);
                    element._title = null;
                }
                tooltipTimer = null;
            }, 100);
        });
    });

    // Global listeners to ensure tooltips don't hang
    document.addEventListener('scroll', () => {
        if (activeTooltip) {
            activeTooltip.remove();
            activeTooltip = null;
            
            // Restore titles for all elements
            elements.forEach(element => {
                if (element._title) {
                    element.setAttribute('title', element._title);
                    element._title = null;
                }
            });
        }
        
        if (tooltipTimer) {
            clearTimeout(tooltipTimer);
            tooltipTimer = null;
        }
    }, { passive: true });
    
    document.addEventListener('click', () => {
        if (activeTooltip) {
            activeTooltip.remove();
            activeTooltip = null;
            
            // Restore titles for all elements
            elements.forEach(element => {
                if (element._title) {
                    element.setAttribute('title', element._title);
                    element._title = null;
                }
            });
        }
    });
}

// --- Main DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Library Checks ---
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        // ... (error handling) ...
        return;
    }
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF is not loaded');
        // ... (error handling) ...
        return;
    }
    if (typeof XLSX === 'undefined') {
        console.error('XLSX library is not loaded');
        // ... (error handling) ...
        return;
    }

    // --- Project Switcher Logic ---
    const projectTabs = document.querySelectorAll('.project-tab');
    const projectContents = document.querySelectorAll('.project-content');
    
    projectTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const projectType = this.getAttribute('data-project');
            
            projectTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            projectContents.forEach(content => {
                content.classList.toggle('active', content.getAttribute('data-project') === projectType);
            });
            
            document.body.setAttribute('data-project', projectType);
            document.title = projectType === 'water' ? 'Water Project Impact Estimator' : 'Afforestation & Reforestation Impact Estimator';
            localStorage.setItem('currentProject', projectType);
        });
    });
    
    const savedProject = localStorage.getItem('currentProject');
    if (savedProject) {
        const tabToActivate = document.querySelector(`.project-tab[data-project="${savedProject}"]`);
        if (tabToActivate) {
            tabToActivate.click(); // Simulate click to activate the saved project
        }
    } else {
        // Ensure default (forest) is active if nothing is saved
        document.querySelector('.project-tab[data-project="forest"]')?.click();
    }

    // --- Afforestation Calculator Setup ---
    setupAfforestationCalculator();

    // --- Water Project Calculator Setup ---
    setupWaterCalculator();

    // --- Initialize Tooltips ---
    initializeTooltips(); // Consolidated tooltip initialization

    // --- Add Template Download Button ---
    addTemplateDownloadButton();
});

// --- Afforestation Calculator Logic ---
function setupAfforestationCalculator() {
    // --- DOM Element References (Forest) ---
    const form = document.getElementById('calculatorForm');
    if (!form) return; // Don't run if the forest form isn't present

    const resultsSection = document.getElementById('resultsSectionForest'); // Corrected ID
    const resultsBody = document.getElementById('resultsBodyForest'); // Corrected ID
    const calculateBtn = document.getElementById('calculateForestBtn'); // Corrected ID
    const btnText = document.getElementById('btnTextForest'); // Corrected ID
    const btnSpinner = document.getElementById('btnSpinnerForest'); // Corrected ID
    const errorMessageDiv = document.getElementById('errorMessageForest'); // Corrected ID
    const sequestrationChartCanvas = document.getElementById('sequestrationChart');
    const speciesInput = document.getElementById('species');
    let sequestrationChart = null;

    const projectAreaInput = document.getElementById('projectArea');
    const plantingDensityInput = document.getElementById('plantingDensity');
    const projectDurationInput = document.getElementById('projectDuration');
    const baselineRateInput = document.getElementById('baselineRate');
    const conversionInputs = document.querySelectorAll('#calculatorForm .factor-container input'); // Scope to forest form
    const projectCostInput = document.getElementById('forestProjectCost'); // Corrected ID
    const costPerTonneElement = document.getElementById('costPerTonne');
    const totalProjectCostElement = document.getElementById('totalProjectCost');

    const forestInputs = [projectAreaInput, plantingDensityInput, projectDurationInput, baselineRateInput, speciesInput, ...conversionInputs, projectCostInput]; // Added projectCostInput

    // --- Constants & Configuration (Forest) ---
    const C_TO_CO2 = 44 / 12;
    const MIN_DURATION = 4;
    const MAX_DURATION = 50;
    const MIN_DENSITY = 100;

    let speciesData = []; // Forest-specific species data

    // --- Growth Data Functions (Forest) ---
    // ... (calculateAnnualIncrement, getAgeAtPeakMAI, getPeakMAIFromDropdown) ...
    function calculateAnnualIncrement(growthParams, currentAge, totalDuration) {
        const peakMAI = growthParams.peakMAI;
        const ageAtPeakMAI = growthParams.ageAtPeakMAI;
        const peakPAI = peakMAI * 1.8;
        const endPAI = peakMAI * 0.1;
        if (currentAge <= 0) return 0;
        let periodicAnnualIncrement;
        if (currentAge <= ageAtPeakMAI) {
            const progressRatio = currentAge / ageAtPeakMAI;
            periodicAnnualIncrement = peakPAI * Math.pow(progressRatio, 1.5);
        } else {
            const agePastPeak = currentAge - ageAtPeakMAI;
            const declineDuration = Math.max(1, totalDuration - ageAtPeakMAI);
            periodicAnnualIncrement = Math.max(endPAI, peakPAI - (peakPAI - endPAI) * (agePastPeak / declineDuration));
        }
        return Math.max(0, periodicAnnualIncrement);
    }

    function getAgeAtPeakMAI(speciesName, speciesKeyFromDropdown = null) {
        const specificData = speciesData.find(s => s['Species Name'] === speciesName);
        if (specificData && specificData['Age at Peak MAI'] && !isNaN(parseFloat(specificData['Age at Peak MAI']))) {
            return parseFloat(specificData['Age at Peak MAI']);
        }
        if (speciesKeyFromDropdown) {
            const ageAtMaxMAI = { 'eucalyptus_fast': 10, 'teak_moderate': 15, 'native_slow': 20 };
            return ageAtMaxMAI[speciesKeyFromDropdown] || 15;
        }
        if (speciesName && speciesName.toLowerCase().includes('eucalyptus')) return 10;
        if (speciesName && speciesName.toLowerCase().includes('teak')) return 15;
        return 15;
    }

    function getPeakMAIFromDropdown(speciesKey) {
        const maxMAI = { 'eucalyptus_fast': 25, 'teak_moderate': 12, 'native_slow': 8 };
        return maxMAI[speciesKey] || 10;
    }


    // --- Input Validation Function (Forest) ---
    function validateForestInput(inputElement, min, max, name) {
        // ... (validateInput implementation, renamed) ...
        const value = parseFloat(inputElement.value);
        let error = null;

        if (inputElement.type === 'number' && inputElement.value !== '' && !/^\-?\d*\.?\d*$/.test(inputElement.value)) {
            error = `${name} must contain only numeric values.`;
        } else if (isNaN(value)) {
            error = `${name} must be a number.`;
        } else if (min !== null && value < min) {
            error = `${name} must be at least ${min}.`;
        } else if (max !== null && value > max) {
            error = `${name} cannot exceed ${max}.`;
        } else if (value <= 0 && ['woodDensity', 'bef', 'rsr', 'carbonFraction'].includes(inputElement.id)) {
            error = `${name} must be greater than 0.`;
        }

        if (error) {
            inputElement.classList.add('input-error');
            return error;
        } else {
            inputElement.classList.remove('input-error');
            return null;
        }
    }

    // --- Site Modifiers Function (Forest) ---
    function getSiteModifiers(siteQuality, avgRainfall, soilType, speciesInfo) {
        // ... (getSiteModifiers implementation) ...
        // Base Modifiers
        let qualityModifier = 1.0;
        if (siteQuality === 'Good') qualityModifier = 1.2;
        if (siteQuality === 'Poor') qualityModifier = 0.7;

        let rainfallModifier = 1.0;
        if (avgRainfall === 'High') rainfallModifier = 1.05;
        if (avgRainfall === 'Low') rainfallModifier = 0.8;

        let soilModifier = 1.0;
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
                    isWaterSensitive = speciesName.includes('eucalyptus_fast'); // Example: fast-growing eucalyptus is water-sensitive
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
        const finalGrowthModifier = Math.max(0.1, Math.min(1.5, combinedModifier)); // Caps: 0.1 to 1.5

        return {
            growthModifier: finalGrowthModifier
        };
    }

    // --- Get & Validate All Inputs (Forest) ---
    function getAndValidateForestInputs() {
        // ... (getAndValidateInputs implementation, renamed) ...
        clearForestErrors();
        let errors = [];
        let validationError = null;

        validationError = validateForestInput(projectAreaInput, 0.1, null, 'Project Area');
        if (validationError) errors.push(validationError);

        validationError = validateForestInput(plantingDensityInput, MIN_DENSITY, null, 'Planting Density');
        if (validationError) errors.push(validationError);

        validationError = validateForestInput(projectDurationInput, MIN_DURATION, MAX_DURATION, 'Project Duration');
        if (validationError) errors.push(validationError);

        // Standardize baseline rate validation
        validationError = validateForestInput(baselineRateInput, null, null, 'Baseline Rate');
        if (validationError) errors.push(validationError);
        
        // NEW: Validate survival rate
        const survivalRateInput = document.getElementById('survivalRate');
        validationError = validateForestInput(survivalRateInput, 50, 100, 'Survival Rate');
        if (validationError) errors.push(validationError);

        // Validate conversion factors
        conversionInputs.forEach(input => {
            validationError = validateForestInput(input, 0, null, input.previousElementSibling.textContent);
            if (validationError) errors.push(validationError);
        });

        if (errors.length > 0) {
            showForestError(errors.join('<br>'));
            return null;
        }

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
            // NEW: Add site and climate factors
            siteQuality: document.getElementById('siteQuality').value,
            avgRainfall: document.getElementById('avgRainfall').value,
            soilType: document.getElementById('soilType').value,
            survivalRate: parseFloat(survivalRateInput.value) / 100 // Convert to decimal
        };
    }

    // --- Error Handling Functions (Forest) ---
    function showForestError(message) {
        if (errorMessageDiv) { // Add check for safety
            errorMessageDiv.innerHTML = message;
            errorMessageDiv.classList.remove('hidden');
        } else {
            console.error("Error message div ('errorMessageForest') not found.");
        }
    }

    function clearForestErrors() {
        if (errorMessageDiv) { // Add check for safety
            errorMessageDiv.innerHTML = '';
            errorMessageDiv.classList.add('hidden');
        }
        // Also remove error class from inputs
        const forestInputsForError = document.querySelectorAll('#calculatorForm .input-field');
        forestInputsForError.forEach(input => input?.classList.remove('input-error'));
    }

    // --- Calculation Functions (Forest) ---
    function calculateSequestration(inputs) {
        // Calculate risk rate based on project inputs
        const projectRiskRate = inputs.riskRate || 0.1; // Use provided risk rate or default to 10%
        
        let cumulativeNetCO2e = 0;
        const annualResults = [];
        const totalAnnualBaselineEmissions = inputs.baselineRatePerHa * inputs.projectArea;
        
        // Create speciesInfo object for species traits
        const speciesInfo = {
            name: inputs.species,
            // Simple trait inference from species name
            droughtTolerance: inputs.species.includes('native_slow') ? 'High' : 'Medium',
            waterSensitivity: inputs.species.includes('eucalyptus_fast') ? 'High' : 'Low',
            soilPref: inputs.species.includes('teak') ? 'Loam' : 'Medium'
        };
        
        // Get site modifiers based on site conditions and species traits
        const siteModifiers = getSiteModifiers(inputs.siteQuality, inputs.avgRainfall, inputs.soilType, speciesInfo);
        
        const growthParams = {
            peakMAI: getPeakMAIFromDropdown(inputs.species),
            ageAtPeakMAI: getAgeAtPeakMAI(null, inputs.species)
        };
        
        // Track ecosystem maturity for display
        let ecosystemMaturity = 0;
        
        for (let year = 1; year <= inputs.projectDuration; year++) {
            const standAge = year;
            // Calculate base annual increment
            const baseAnnualIncrement = calculateAnnualIncrement(growthParams, standAge, inputs.projectDuration);
            
            // Apply site modifier to growth
            const annualVolumeIncrementPerHa = baseAnnualIncrement * siteModifiers.growthModifier;
            
            const stemBiomassIncrement = annualVolumeIncrementPerHa * inputs.woodDensity;
            const abovegroundBiomassIncrement = stemBiomassIncrement * inputs.bef;
            const belowgroundBiomassIncrement = abovegroundBiomassIncrement * inputs.rsr;
            const totalBiomassIncrement = abovegroundBiomassIncrement + belowgroundBiomassIncrement;
            const carbonIncrement = totalBiomassIncrement * inputs.carbonFraction;
            const grossAnnualCO2ePerHa = carbonIncrement * C_TO_CO2;
            
            // Apply survival rate AND risk adjustment to gross CO2e
            const effectiveSurvivalRate = inputs.survivalRate * (1 - projectRiskRate);
            const grossAnnualCO2eTotal = grossAnnualCO2ePerHa * inputs.projectArea * effectiveSurvivalRate;
            
            const netAnnualCO2eTotal = grossAnnualCO2eTotal - totalAnnualBaselineEmissions;
            cumulativeNetCO2e += netAnnualCO2eTotal;
            
            // Calculate ecosystem maturity as a percentage of age at peak MAI
            ecosystemMaturity = Math.min(100, Math.round((year / growthParams.ageAtPeakMAI) * 100));
            
            annualResults.push({
                year: year,
                age: standAge,
                volumeIncrement: annualVolumeIncrementPerHa.toFixed(2),
                grossAnnualCO2e: grossAnnualCO2eTotal.toFixed(2),
                netAnnualCO2e: netAnnualCO2eTotal.toFixed(2),
                cumulativeNetCO2e: cumulativeNetCO2e.toFixed(2),
                ecosystemMaturity: ecosystemMaturity
            });
        }
        return annualResults;
    }

    function calculateSpeciesSequestration(inputs) {
        // ... (calculateSpeciesSequestration implementation) ...
        let cumulativeNetCO2e = 0; // Track cumulative NET for this species
        const annualResults = [];
        // Calculate proportional baseline emissions for this species
        const speciesBaselineShare = inputs.baselineRatePerHa * inputs.proportionalArea; // Use proportional area
        
        // Get conversion factors from inputs or default form values
        const woodDensity = inputs.woodDensity || parseFloat(document.getElementById('woodDensity').value);
        const bef = inputs.bef || parseFloat(document.getElementById('bef').value);
        const rsr = inputs.rsr || parseFloat(document.getElementById('rsr').value);
        const carbonFraction = inputs.carbonFraction || parseFloat(document.getElementById('carbonFraction').value);
        
        // Create speciesInfo object for species traits
        const speciesInfo = {
            name: inputs.speciesName,
            droughtTolerance: inputs.droughtTolerance || null,
            waterSensitivity: inputs.waterSensitivity || null,
            soilPref: inputs.soilPref || null
        };
        
        // Get site factors (use species-specific ones if available, else defaults)
        const siteQuality = inputs.siteQuality || document.getElementById('siteQuality').value;
        const avgRainfall = inputs.avgRainfall || document.getElementById('avgRainfall').value;
        const soilType = inputs.soilType || document.getElementById('soilType').value;
        const survivalRate = inputs.survivalRate !== undefined ? inputs.survivalRate : 
                            (parseFloat(document.getElementById('survivalRate').value) / 100);
        
        // Get site modifiers based on site conditions and species traits
        const siteModifiers = getSiteModifiers(siteQuality, avgRainfall, soilType, speciesInfo);
        
        const growthParams = {
            peakMAI: inputs.growthRate,
            ageAtPeakMAI: getAgeAtPeakMAI(inputs.speciesName)
        };
        
        // Track ecosystem maturity for this species
        let ecosystemMaturity = 0;
        
        for (let year = 1; year <= inputs.projectDuration; year++) {
            const standAge = year;
            
            // Calculate base annual increment
            const baseAnnualIncrement = calculateAnnualIncrement(growthParams, standAge, inputs.projectDuration);
            
            // Apply site modifier to growth
            const annualVolumeIncrementPerHa = baseAnnualIncrement * siteModifiers.growthModifier;
            
            const stemBiomassIncrement = annualVolumeIncrementPerHa * woodDensity;
            const abovegroundBiomassIncrement = stemBiomassIncrement * bef;
            const belowgroundBiomassIncrement = abovegroundBiomassIncrement * rsr;
            const totalBiomassIncrement = abovegroundBiomassIncrement + belowgroundBiomassIncrement;
            const carbonIncrement = totalBiomassIncrement * carbonFraction;
            const grossAnnualCO2ePerHa = carbonIncrement * C_TO_CO2;
            
            // Apply survival rate AND species-specific risk adjustment to gross CO2e
            const speciesRiskRate = inputs.riskRate !== undefined ? inputs.riskRate : 0.1; // Use passed risk rate or default
            const effectiveSurvivalRate = survivalRate * (1 - speciesRiskRate);
            const grossAnnualCO2eTotal = grossAnnualCO2ePerHa * inputs.proportionalArea * effectiveSurvivalRate;
            
            // Calculate net CO2e with proportional baseline
            const netAnnualCO2e = grossAnnualCO2eTotal - speciesBaselineShare;
            cumulativeNetCO2e += netAnnualCO2e;
            
            // Calculate ecosystem maturity for this species
            ecosystemMaturity = Math.min(100, Math.round((year / growthParams.ageAtPeakMAI) * 100));
            
            annualResults.push({
                year: year,
                age: standAge,
                volumeIncrement: annualVolumeIncrementPerHa.toFixed(2),
                grossAnnualCO2e: grossAnnualCO2eTotal.toFixed(2),
                netAnnualCO2e: netAnnualCO2e.toFixed(2),
                cumulativeNetCO2e: cumulativeNetCO2e.toFixed(2),
                ecosystemMaturity: ecosystemMaturity // Include maturity
            });
        }

        return annualResults;
    }

    function calculateSequestrationMultiSpecies(inputs) {
        const results = {
            speciesResults: [],
            totalResults: Array(inputs.projectDuration).fill(null).map((_, i) => ({
                year: i + 1,
                age: i + 1,
                volumeIncrement: 0,
                grossAnnualCO2e: 0, // Track total gross
                netAnnualCO2e: 0,   // Track total net
                cumulativeNetCO2e: 0, // Track cumulative total net
                ecosystemMaturity: 0 // Track ecosystem maturity
            }))
        };
        const totalAnnualBaselineEmissions = inputs.baselineRatePerHa * inputs.projectArea;
        
        // Calculate total trees for proportional area calculation
        const totalTrees = speciesData.reduce((sum, species) => sum + species['Number of Trees'], 0);
        
        // Get overall project risk rate - consistent across all species
        const projectRiskRate = inputs.riskRate || 0.1; // Use provided risk rate or default to 10%
        
        // Track overall ecosystem maturity (averaged across species)
        let ecosystemMaturitySum = 0;
        
        speciesData.forEach(species => {
            // Calculate proportional area based on tree count
            const proportionalArea = inputs.projectArea * (species['Number of Trees'] / totalTrees);
            
            // Get species-specific risk rate if available, otherwise use project risk rate
            const speciesRiskRate = species['Risk Rate (%)'] !== undefined && !isNaN(parseFloat(species['Risk Rate (%)']))
                ? parseFloat(species['Risk Rate (%)']) / 100
                : projectRiskRate;
            
            const speciesInputs = {
                ...inputs,
                speciesName: species['Species Name'],
                numTrees: species['Number of Trees'],
                proportionalArea: proportionalArea, // Store for area-based calculations
                growthRate: species['Growth Rate (m³/ha/yr)'],
                woodDensity: species['Wood Density (tdm/m³)'] || inputs.woodDensity,
                bef: species['BEF'] || inputs.bef,
                rsr: species['Root-Shoot Ratio'] || inputs.rsr,
                carbonFraction: species['Carbon Fraction'] || inputs.carbonFraction,
                // Add site factors and species traits from Excel or use default
                siteQuality: species['Site Quality'] || inputs.siteQuality,
                avgRainfall: species['Average Rainfall'] || inputs.avgRainfall,
                soilType: species['Soil Type'] || inputs.soilType,
                survivalRate: species['Survival Rate (%)'] ? parseFloat(species['Survival Rate (%)']) / 100 : inputs.survivalRate,
                droughtTolerance: species['Drought Tolerance'] || null,
                waterSensitivity: species['Water Sensitivity'] || null,
                soilPref: species['Soil Preference'] || null,
                riskRate: speciesRiskRate // Pass the species-specific risk rate
            };
            
            const speciesAnnualResults = calculateSpeciesSequestration(speciesInputs);
            
            results.speciesResults.push({
                speciesName: species['Species Name'],
                results: speciesAnnualResults,
                conversionFactors: {} // Placeholder if needed later
            });
            
            // Aggregate results into the totalResults array
            speciesAnnualResults.forEach((yearResult, index) => {
                results.totalResults[index].volumeIncrement += parseFloat(yearResult.volumeIncrement);
                results.totalResults[index].grossAnnualCO2e += parseFloat(yearResult.grossAnnualCO2e);
                results.totalResults[index].netAnnualCO2e += parseFloat(yearResult.netAnnualCO2e); // Aggregate NET
                
                // Add ecosystem maturity from species (we'll calculate average later)
                ecosystemMaturitySum += yearResult.ecosystemMaturity || 0;
            });
        });
        
        // Calculate cumulative total net sequestration and average ecosystem maturity
        let cumulativeTotalNet = 0;
        const speciesCount = speciesData.length;
        
        results.totalResults.forEach((totalYearResult, index) => {
            cumulativeTotalNet += totalYearResult.netAnnualCO2e;
            totalYearResult.cumulativeNetCO2e = cumulativeTotalNet;
            
            // Format numbers for display
            totalYearResult.volumeIncrement = totalYearResult.volumeIncrement.toFixed(2);
            totalYearResult.grossAnnualCO2e = totalYearResult.grossAnnualCO2e.toFixed(2);
            totalYearResult.netAnnualCO2e = totalYearResult.netAnnualCO2e.toFixed(2);
            totalYearResult.cumulativeNetCO2e = totalYearResult.cumulativeNetCO2e.toFixed(2);
            
            // Calculate average ecosystem maturity for this year (across all species)
            // If there are species-specific maturity values, we'll average them
            if (results.speciesResults && results.speciesResults.length > 0) {
                const yearMaturitySum = results.speciesResults.reduce((sum, species) => {
                    return sum + (species.results[index].ecosystemMaturity || 0);
                }, 0);
                totalYearResult.ecosystemMaturity = Math.round(yearMaturitySum / speciesCount);
            } else {
                // Fallback calculation if species don't have maturity data
                totalYearResult.ecosystemMaturity = Math.min(100, Math.round((totalYearResult.year / 20) * 100));
            }
            totalYearResult.age = totalYearResult.year; // Ensure age is set
        });
        
        return results;
    }


    // --- Cost Analysis Function (Forest) ---
    function calculateForestCostAnalysis(results, totalCost) {
        // ... (calculateCostAnalysis implementation, renamed) ...
        try {
            if (!results || !results.length) {
                throw new Error('No results available for cost analysis');
            }

            const finalCumulativeCO2e = parseFloat(results[results.length - 1].cumulativeNetCO2e);
            
            // Prevent division by zero or negative values
            if (isNaN(finalCumulativeCO2e) || finalCumulativeCO2e <= 0) {
                const displayValue = isNaN(finalCumulativeCO2e) ? '0.00' : 
                    finalCumulativeCO2e.toLocaleString('en-IN', {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2
                    });
                document.getElementById('totalSequestration').textContent = `${displayValue} tCO₂e`;
                
                document.getElementById('costPerTonne').textContent = 'N/A';
                document.getElementById('totalProjectCost').textContent = `₹ ${totalCost.toLocaleString('en-IN')}`;
                document.getElementById('costPerHectarePerTonne').textContent = 'N/A';
                document.getElementById('costBreakdown').innerHTML = 
                    `Cost calculation not applicable (zero or negative sequestration)`;
                
                return; // Exit early
            }

            const costPerTonne = totalCost / finalCumulativeCO2e;
            const projectArea = parseFloat(projectAreaInput.value);
            if (isNaN(projectArea) || projectArea <= 0) {
                throw new Error('Invalid project area value');
            }

            const costPerHectarePerTonne = (totalCost / projectArea) / finalCumulativeCO2e;
            
            // Update displays with validation
            document.getElementById('totalSequestration').textContent = `${finalCumulativeCO2e.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })} tCO₂e`;
            
            document.getElementById('costPerTonne').textContent = `₹ ${costPerTonne.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })}`;
            document.getElementById('totalProjectCost').textContent = `₹ ${totalCost.toLocaleString('en-IN')}`;
            document.getElementById('costPerHectarePerTonne').textContent = `₹ ${costPerHectarePerTonne.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })}`;

            // Update calculation breakdown
            document.getElementById('costBreakdown').innerHTML = `
                Cost per tCO₂e = ₹${totalCost.toLocaleString('en-IN')} ÷ ${finalCumulativeCO2e.toLocaleString('en-IN', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                })} tCO₂e = ₹${costPerTonne.toLocaleString('en-IN', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                })} per tCO₂e
            `;
        } catch (error) {
            console.error("Cost analysis error:", error);
            showForestError("An error occurred during cost analysis calculations. Please check your inputs.");
            throw error; // Re-throw to be caught by the main error handler
        }
    }

    // --- DOM Update Functions (Forest) ---
    function updateForestTable(results) {
        // ... (updateTable implementation, renamed) ...
        resultsBody.innerHTML = '';
        results.forEach(result => {
            const row = resultsBody.insertRow();
            row.innerHTML = `
                <td>${result.year}</td>
                <td>${result.age}</td>
                <td>${result.volumeIncrement}</td>
                <td>${result.netAnnualCO2e}</td>
                <td>${result.cumulativeNetCO2e}</td>
            `;
        });
    }

    function updateForestChart(results) {
        try {
            if (!window.Chart) {
                throw new Error('Chart.js library is not loaded');
            }

            const chartLabels = results.map(r => `Year ${r.year}`);
            const chartData = results.map(r => parseFloat(r.cumulativeNetCO2e));

            const sequestrationChartCanvas = document.getElementById('sequestrationChart');
            if (!sequestrationChartCanvas) {
                throw new Error('Chart canvas not found');
            }

            const ctx = sequestrationChartCanvas.getContext('2d');
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

            // Get reference to the chart instance or create a new one
            let sequestrationChart = Chart.getChart(sequestrationChartCanvas);
            if (sequestrationChart) {
                sequestrationChart.destroy();
            }
            
            sequestrationChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Cumulative CO₂e Sequestration',
                        data: chartData,
                        borderColor: '#10b981', // Use CSS variable? var(--primary-light)
                        backgroundColor: 'rgba(16, 185, 129, 0.05)', // Use CSS variable?
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#059669', // Use CSS variable? var(--primary)
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#059669', // Use CSS variable? var(--primary)
                        pointHoverBorderWidth: 2,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        cubicInterpolationMode: 'monotone'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    layout: {
                        padding: { top: 20, right: 25, bottom: 20, left: 25 }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0, 0, 0, 0.05)', lineWidth: 1 },
                            border: { dash: [4, 4] },
                            ticks: { 
                                padding: 10, color: '#4b5563', 
                                font: { size: 11, family: "'Inter', sans-serif" },
                                callback: function(value) { return value.toLocaleString() + ' tCO₂e'; }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { 
                                padding: 8, color: '#4b5563', 
                                font: { size: 11, family: "'Inter', sans-serif" },
                                maxRotation: 45, minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true, position: 'top', align: 'center',
                            labels: { boxWidth: 12, padding: 15, color: '#1f2937', font: { size: 12, family: "'Inter', sans-serif", weight: '500' } }
                        },
                        tooltip: {
                            enabled: true, backgroundColor: 'rgba(17, 24, 39, 0.8)',
                            titleFont: { size: 13, family: "'Inter', sans-serif", weight: '600' },
                            bodyFont: { size: 12, family: "'Inter', sans-serif" },
                            padding: 12, cornerRadius: 6, displayColors: false,
                            callbacks: { 
                                label: function(context) { 
                                    return `${context.parsed.y.toLocaleString()} tCO₂e sequestered`; 
                                } 
                            }
                        }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        } catch (error) {
            console.error("Chart creation error:", error);
            return;
        }
    }

    function displayForestResults(results) {
        try {
            // Get the correct DOM elements from the forest project content
            const resultsBodyForest = document.getElementById('resultsBodyForest');
            const resultsSectionForest = document.getElementById('resultsSectionForest');
            
            // Update table with results
            if (resultsBodyForest) {
                resultsBodyForest.innerHTML = '';
                results.totalResults.forEach(result => {
                    const row = resultsBodyForest.insertRow();
                    row.innerHTML = `
                        <td>${result.year}</td>
                        <td>${result.age}</td>
                        <td>${result.volumeIncrement}</td>
                        <td>${result.netAnnualCO2e}</td>
                        <td>${result.cumulativeNetCO2e}</td>
                    `;
                });
            }
            
            // Clear any existing charts first
            const existingCharts = document.querySelectorAll('#forestProjectContent .species-chart-card');
            existingCharts.forEach(chart => chart.remove());
            
            // Update main cumulative chart
            updateForestChart(results.totalResults);
            
            // Create container for species charts if it doesn't exist
            let chartsContainer = document.querySelector('#forestProjectContent .species-charts-container');
            if (!chartsContainer) {
                chartsContainer = document.createElement('div');
                chartsContainer.className = 'species-charts-container';
                // Ensure sequestrationChartCanvas exists before inserting
                const sequestrationChartCanvas = document.getElementById('sequestrationChart');
                if (sequestrationChartCanvas && sequestrationChartCanvas.parentElement) {
                    sequestrationChartCanvas.parentElement.insertAdjacentElement('afterend', chartsContainer);
                } else {
                    console.error("Could not find parent element for species charts container.");
                }
            } else {
                chartsContainer.innerHTML = ''; // Clear existing charts
            }
            
            // Create individual species charts
            results.speciesResults.forEach(speciesResult => {
                const chartCard = document.createElement('div');
                chartCard.className = 'species-chart-card';
                
                const canvas = document.createElement('canvas');
                chartCard.innerHTML = `<h4 class="species-chart-title">${speciesResult.speciesName}</h4>`;
                chartCard.appendChild(canvas);
                chartsContainer.appendChild(chartCard);
                
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: speciesResult.results.map(r => `Year ${r.year}`),
                        datasets: [{
                            label: `${speciesResult.speciesName} Cumulative CO₂e`,
                            data: speciesResult.results.map(r => parseFloat(r.cumulativeNetCO2e)),
                            borderColor: getRandomColor(),
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'tCO₂e' }
                            }
                        }
                    }
                });
            });
            
            // Make results visible and scroll to them
            if (resultsSectionForest) {
                resultsSectionForest.classList.remove('hidden');
                resultsSectionForest.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error("Error displaying results:", error);
            const errorMessageForest = document.getElementById('errorMessageForest');
            if (errorMessageForest) {
                errorMessageForest.innerHTML = "An error occurred while displaying the results.";
                errorMessageForest.classList.remove('hidden');
            }
        }
    }

    // --- Form Submission Handler (Forest) ---
    function handleForestFormSubmit(event) {
        event.preventDefault();
        const calculateBtn = document.getElementById('calculateForestBtn');
        const btnText = document.getElementById('btnTextForest');
        const btnSpinner = document.getElementById('btnSpinnerForest');
        const resultsSection = document.getElementById('resultsSectionForest');
        const errorMessageDiv = document.getElementById('errorMessageForest');
        
        calculateBtn.disabled = true;
        calculateBtn.classList.add('calculating');
        resultsSection.classList.add('hidden');
        clearForestErrors();

        setTimeout(() => {
            try {
                const inputs = getAndValidateForestInputs();
                
                if (!inputs) {
                    throw new Error('Input validation failed');
                }

                if (!inputs.species && !speciesData.length) {
                    throw new Error('No species selected and no species data uploaded');
                }
                
                // Initialize the enhanced features (Green Cover, Credits, etc.)
                const afforestationFeatures = setupGreenCoverAndCredits();
                
                // Calculate risk rate for the project
                const projectRiskRate = calculateRiskRate('forest', inputs);
                
                // Store risk rate for later use in reporting
                inputs.riskRate = projectRiskRate;

                // Display the risk rate in the UI
                // const riskRateElement = document.getElementById('forestRiskRate'); // Element doesn't exist yet
                // if (riskRateElement) {
                //     riskRateElement.textContent = `${(projectRiskRate * 100).toFixed(1)}%`;
                // }

                let results;
                if (speciesData.length > 0) {
                    results = calculateSequestrationMultiSpecies(inputs);
                    displayForestResults(results);
                } else {
                    const sequestrationResults = calculateSequestration(inputs);
                    results = { 
                        totalResults: sequestrationResults,
                        speciesResults: []
                    };
                    displayForestResults(results);
                }
                
                // Update carbon credits calculation and green cover metrics
                afforestationFeatures.updateCarbonCreditsCalculation(results.totalResults);
                
                const totalCost = parseNumberWithCommas(document.getElementById('forestProjectCost')?.value || '0'); // Corrected ID
                calculateForestCostAnalysis(results.totalResults, totalCost);
                
                resultsSection.classList.remove('hidden');
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (error) {
                console.error("Calculation Error:", error);
                showForestError(error.message || "An error occurred during calculation. Please check your inputs and try again.");
                resultsSection.classList.add('hidden');
            } finally {
                calculateBtn.disabled = false;
                calculateBtn.classList.remove('calculating');
            }
        }, 50);
    }

    // --- Reset Button Handlers (Forest) ---
    // Use event delegation on the form for reset buttons
    form.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('reset-btn')) {
            const inputId = target.getAttribute('data-for');
            const input = document.getElementById(inputId);
            if (!input) return; // Add check
            const defaultValue = input.getAttribute('data-default');
            input.value = defaultValue;
            input.classList.add('highlight');
            setTimeout(() => input.classList.remove('highlight'), 500);
        }
    });

    // --- Reset All Function (Forest) ---
    function resetForestInputs() {
        // ... (resetAllInputs implementation, renamed) ...
        // Clear all input fields
        const inputs = document.querySelectorAll('#calculatorForm input, #calculatorForm select');
        inputs.forEach(input => {
            const defaultValue = input.getAttribute('data-default');
            if (defaultValue) {
                input.value = defaultValue;
            } else if (input.type === 'file') {
                input.value = '';
            } else if (input.type === 'number') {
                // Use placeholder as default, or empty if none
                input.value = input.placeholder || '';
            } else {
                input.value = '';
            }
            input.classList.remove('input-error');
        });
        
        // Clear species data
        speciesData = [];
        const speciesListEl = document.getElementById('speciesList');
        if (speciesListEl) speciesListEl.innerHTML = '';
        
        // Hide results
        resultsSection.classList.add('hidden');
        errorMessageDiv.classList.add('hidden');
        
        // Reset chart
        if (sequestrationChart) {
            sequestrationChart.destroy();
            sequestrationChart = null;
        }

        // Remove any species charts
        const chartsContainer = document.querySelector('#forestProjectContent .species-charts-container');
        if (chartsContainer) {
            chartsContainer.innerHTML = '';
        }
    }

    // Add reset button event listener (Forest)
    const resetAllForestBtn = document.getElementById('resetAllBtn');
    if (resetAllForestBtn) {
        resetAllForestBtn.addEventListener('click', resetForestInputs);
    }

    // --- Input Event Handlers (Forest) ---
    forestInputs.forEach(input => {
        if (input) { // Add null check
            input.addEventListener('input', () => {
                input.classList.remove('input-error');
                errorMessageDiv.classList.add('hidden');
            });
        }
    });

    // Add input handler for project cost (Forest)
    if (projectCostInput) {
        projectCostInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d,]/g, '');
            value = value.replace(/,/g, '');
            if (value) {
                value = parseInt(value).toLocaleString('en-IN');
            }
            e.target.value = value;
        });
    }

    // --- Excel Template/Upload Functions (Forest) ---
    function downloadExcelTemplate() {
        try {
            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            
            // Define headers with new columns and combined risk
            const headers = [
                'Species Name', 'Number of Trees', 'Growth Rate (m³/ha/yr)',
                'Wood Density (tdm/m³)', 'BEF', 'Root-Shoot Ratio', 'Carbon Fraction',
                'Site Quality', 'Average Rainfall', 'Soil Type', 'Survival Rate (%)', 'Age at Peak MAI',
                'Drought Tolerance', 'Water Sensitivity', 'Soil Preference',
                'Risk Rate (%)', 'Initial Green Cover (ha)', 'Total Geographical Area (ha)', 
                'Dead Attribute (%)'
            ];
            
            // Create sample data with new columns
            const sampleData = [
                {
                    'Species Name': 'Tectona grandis (Teak)', 'Number of Trees': 500, 'Growth Rate (m³/ha/yr)': 12,
                    'Wood Density (tdm/m³)': 0.650, 'BEF': 1.5, 'Root-Shoot Ratio': 0.27, 'Carbon Fraction': 0.47,
                    'Site Quality': 'Good', 'Average Rainfall': 'Medium', 'Soil Type': 'Loam', 
                    'Survival Rate (%)': 90, 'Age at Peak MAI': 15,
                    'Drought Tolerance': 'Medium', 'Water Sensitivity': 'Low', 'Soil Preference': 'Loam',
                    'Risk Rate (%)': 10, 'Initial Green Cover (ha)': 5, 'Total Geographical Area (ha)': 100,
                    'Dead Attribute (%)': 0
                },
                {
                    'Species Name': 'Eucalyptus globulus', 'Number of Trees': 1000, 'Growth Rate (m³/ha/yr)': 25,
                    'Wood Density (tdm/m³)': 0.550, 'BEF': 1.3, 'Root-Shoot Ratio': 0.24, 'Carbon Fraction': 0.47,
                    'Site Quality': 'Medium', 'Average Rainfall': 'High', 'Soil Type': 'Sandy', 
                    'Survival Rate (%)': 85, 'Age at Peak MAI': 10,
                    'Drought Tolerance': 'Low', 'Water Sensitivity': 'High', 'Soil Preference': 'Sandy',
                    'Risk Rate (%)': 8, 'Initial Green Cover (ha)': 2, 'Total Geographical Area (ha)': 80,
                    'Dead Attribute (%)': 0
                }
            ];
            
            // Create worksheet with headers and sample data
            const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
            
            // Add column width information
            const wscols = headers.map(h => ({ wch: Math.max(h.length, 15) }));
            ws['!cols'] = wscols;
            
            // Add notes/documentation to another sheet with updated information
            const notesWs = XLSX.utils.aoa_to_sheet([
                ["Species Input Template - Instructions"], [""],
                ["Required Columns:"],
                ["Species Name - Name of the tree species (text)"],
                ["Number of Trees - Total number of trees for this species (number > 0)"],
                ["Growth Rate (m³/ha/yr) - Mean Annual Increment in cubic meters per hectare per year (number > 0)"], [""],
                ["Optional Columns (if left blank, default values from the main form will be used):"],
                ["Wood Density (tdm/m³) - Wood density in tonnes of dry matter per cubic meter (typical range: 0.3-0.8)"],
                ["BEF - Biomass Expansion Factor for converting stem biomass to above-ground biomass (typical range: 1.1-3.0)"],
                ["Root-Shoot Ratio - Ratio of below-ground to above-ground biomass (typical range: 0.2-0.3)"],
                ["Carbon Fraction - Fraction of carbon in dry biomass (default: 0.47)"], [""],
                ["Site/Climate Columns:"],
                ["Site Quality - Options: 'Good', 'Medium', 'Poor'"],
                ["Average Rainfall - Options: 'High', 'Medium', 'Low'"],
                ["Soil Type - Options: 'Loam', 'Sandy', 'Clay', 'Degraded'"],
                ["Survival Rate (%) - Percentage of trees expected to survive (50-100)"],
                ["Age at Peak MAI - Age in years when the Mean Annual Increment reaches its maximum"], [""],
                ["Species Traits:"],
                ["Drought Tolerance - Options: 'High', 'Medium', 'Low'"],
                ["Water Sensitivity - Options: 'High', 'Medium', 'Low'"],
                ["Soil Preference - Options: 'Sandy', 'Loam', 'Clay'"], [""],
                ["New Columns:"],
                ["Risk Rate (%) - Combined percentage for fire, insect, and disease risks (0-100)"],
                ["Initial Green Cover (ha) - Existing green cover before project implementation"],
                ["Total Geographical Area (ha) - Total area of the region being analyzed"],
                ["Dead Attribute (%) - Proportion of carbon sequestration that would occur without project intervention (default: 0%)"]
            ]);
            
            // Set column width for notes sheet
            notesWs['!cols'] = [{ wch: 100 }];
            
            // Add worksheets to workbook
            XLSX.utils.book_append_sheet(wb, ws, "Species Data");
            XLSX.utils.book_append_sheet(wb, notesWs, "Instructions");
            
            // Generate Excel file and trigger download
            XLSX.writeFile(wb, "species-template.xlsx");
            
        } catch (error) {
            console.error("Error generating Excel template:", error);
            alert("Error creating Excel template. Please try again.");
        }
    }

    function handleSpeciesFileUpload(event) {
        clearForestErrors();
        const file = event.target.files[0];
        const speciesList = document.getElementById('speciesList');
        
        // File validation
        if (!file) {
            if (speciesList) speciesList.innerHTML = '<p class="text-sm text-red-600">No file selected.</p>';
            return;
        }
        
        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;        
        if (file.size > maxSize) {
             showForestError('File size exceeds 5MB limit.');
             event.target.value = ''; // Clear the input
             return;
        }

        // Check file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // Allow CSV
        ];
        if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
             showForestError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
             event.target.value = ''; // Clear the input
             return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const firstSheet = workbook.Sheets[firstSheetName];
                
                // Define the expected headers based on the template
                const expectedHeaders = [
                    'Species Name', 'Number of Trees', 'Growth Rate (m³/ha/yr)',
                    'Wood Density (tdm/m³)', 'BEF', 'Root-Shoot Ratio', 'Carbon Fraction',
                    'Site Quality', 'Average Rainfall', 'Soil Type', 'Survival Rate (%)', 'Age at Peak MAI',
                    'Drought Tolerance', 'Water Sensitivity', 'Soil Preference',
                    'Risk Rate (%)', 'Initial Green Cover (ha)', 'Total Geographical Area (ha)', 
                    'Dead Attribute (%)'
                ];

                // Read data with explicit headers
                const rawData = XLSX.utils.sheet_to_json(firstSheet, {
                    raw: true, // Keep raw values (numbers as numbers)
                    defval: null, // Use null for empty cells
                    header: expectedHeaders // Use our defined headers
                });

                // Basic validation: Check if first row matches headers (or is data)
                if (rawData.length === 0) {
                    throw new Error("The uploaded file is empty or has no data rows.");
                }

                // Process and validate data
                speciesData = rawData.map((row, index) => {
                    // Basic check for essential data
                    if (!row['Species Name'] || row['Number of Trees'] === null || row['Growth Rate (m³/ha/yr)'] === null) {
                        console.warn(`Skipping row ${index + 2}: Missing essential data (Species Name, Number of Trees, or Growth Rate).`);
                        return null; // Skip invalid rows
                    }
                    
                    // Convert numeric fields, handle potential errors/nulls
                    const numFields = [
                        'Number of Trees', 'Growth Rate (m³/ha/yr)', 'Wood Density (tdm/m³)',
                        'BEF', 'Root-Shoot Ratio', 'Carbon Fraction', 'Survival Rate (%)', 'Age at Peak MAI',
                        'Risk Rate (%)', 'Initial Green Cover (ha)', 'Total Geographical Area (ha)', 'Dead Attribute (%)'
                    ];
                    numFields.forEach(field => {
                        if (row[field] !== null && row[field] !== undefined && row[field] !== '') {
                            row[field] = parseFloat(row[field]);
                            if (isNaN(row[field])) {
                                console.warn(`Invalid numeric value in row ${index + 2}, field ${field}: ${row[field]}. Setting to null.`);
                                row[field] = null;
                            }
                        } else {
                            row[field] = null;
                        }
                    });

                    // Validate specific ranges if needed (e.g., percentages)
                    if (row['Survival Rate (%)'] !== null && (row['Survival Rate (%)'] < 0 || row['Survival Rate (%)'] > 100)) {
                         console.warn(`Invalid Survival Rate in row ${index + 2}: ${row['Survival Rate (%)']}. Clamping to 0-100.`);
                         row['Survival Rate (%)'] = Math.max(0, Math.min(100, row['Survival Rate (%)']));
                    }
                     if (row['Risk Rate (%)'] !== null && (row['Risk Rate (%)'] < 0 || row['Risk Rate (%)'] > 100)) {
                         console.warn(`Invalid Risk Rate in row ${index + 2}: ${row['Risk Rate (%)']}. Clamping to 0-100.`);
                         row['Risk Rate (%)'] = Math.max(0, Math.min(100, row['Risk Rate (%)']));
                    }
                     if (row['Dead Attribute (%)'] !== null && (row['Dead Attribute (%)'] < 0 || row['Dead Attribute (%)'] > 100)) {
                         console.warn(`Invalid Dead Attribute in row ${index + 2}: ${row['Dead Attribute (%)']}. Clamping to 0-100.`);
                         row['Dead Attribute (%)'] = Math.max(0, Math.min(100, row['Dead Attribute (%)']));
                    }
                    if (row['Initial Green Cover (ha)'] !== null && row['Initial Green Cover (ha)'] < 0) {
                         console.warn(`Invalid Initial Green Cover in row ${index + 2}: ${row['Initial Green Cover (ha)']}. Setting to 0.`);
                         row['Initial Green Cover (ha)'] = 0;
                    }
                     if (row['Total Geographical Area (ha)'] !== null && row['Total Geographical Area (ha)'] <= 0) {
                         console.warn(`Invalid Total Geographical Area in row ${index + 2}: ${row['Total Geographical Area (ha)']}. Setting to null.`);
                         row['Total Geographical Area (ha)'] = null; // Needs to be > 0
                    }

                    return row;
                }).filter(row => row !== null); // Remove skipped rows

                if (speciesData.length === 0) {
                    throw new Error("No valid data rows found in the uploaded file.");
                }

                activeFileUpload = true;
                displaySpeciesList(); // Update the displayed list
                
                // Optionally, update form defaults based on the first species
                if (speciesData.length > 0) {
                    updateConversionFactors(speciesData[0]);
                    updateSiteFactors(speciesData[0]);
                    // Update Green Cover/Credits inputs based on first row if applicable
                    const firstRow = speciesData[0];
                    const initialGCInput = document.getElementById('initialGreenCover');
                    if (initialGCInput && firstRow['Initial Green Cover (ha)'] !== null) initialGCInput.value = firstRow['Initial Green Cover (ha)'];
                    
                    const totalGAInput = document.getElementById('totalGeographicalArea');
                    if (totalGAInput && firstRow['Total Geographical Area (ha)'] !== null) totalGAInput.value = firstRow['Total Geographical Area (ha)'];
                    
                    const deadAttrSlider = document.getElementById('deadAttributeSlider');
                    const deadAttrValueDisp = document.getElementById('deadAttributeValue');
                    if (deadAttrSlider && deadAttrValueDisp && firstRow['Dead Attribute (%)'] !== null) {
                        deadAttrSlider.value = firstRow['Dead Attribute (%)'];
                        deadAttrValueDisp.textContent = firstRow['Dead Attribute (%)'] + '%';
                        // Manually update the internal variable as the event listener won't fire
                        // This assumes deadAttributePercentage is accessible in this scope, which it isn't.
                        // A better approach is needed if this update is critical before calculation.
                        // For now, calculateSequestration reads directly from speciesData if present.
                    }
                    
                    // Initialize the enhanced features
                    const afforestationFeatures = setupGreenCoverAndCredits();
                    // Trigger update for green cover display after loading data
                    afforestationFeatures.updateGreenCoverMetrics();
                }

                // Optionally trigger calculation immediately after upload
                // handleForestFormSubmit(new Event('submit')); // Or provide a button for the user

            } catch (error) {
                console.error("Error processing Excel file:", error);
                showForestError(`Error processing file: ${error.message}. Please ensure the file format is correct and contains valid data.`);
                speciesData = [];
                activeFileUpload = false;
                if (speciesList) speciesList.innerHTML = '<p class="text-sm text-red-600">Error loading species data.</p>';
            } finally {
                 event.target.value = ''; // Clear the input field after processing
            }
        };

        reader.onerror = function() {
            showForestError('Error reading the file.');
            speciesData = [];
            activeFileUpload = false;
            if (speciesList) speciesList.innerHTML = '<p class="text-sm text-red-600">Error reading file.</p>';
            event.target.value = ''; // Clear the input
        };

        reader.readAsArrayBuffer(file);
    }

    function displaySpeciesList() {
        const speciesList = document.getElementById('speciesList');
        if (!speciesList || !speciesData || speciesData.length === 0) {
            if (speciesList) speciesList.innerHTML = '<p class="text-sm text-gray-500">No species data loaded or file is empty.</p>';
            return;
        }
    
        // Display as cards instead of a table for better mobile view and more info
        const factorsContainer = document.createElement('div');
        factorsContainer.className = 'species-factors-grid'; // Use a grid layout
    
        speciesData.forEach((species, index) => {
            const factorCard = document.createElement('div');
            factorCard.className = 'species-factor-card'; // New class for card styling
    
            let cardHTML = `<h3 class="species-card-title">${species['Species Name']}</h3>`;
            cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Trees:</span><span class="species-factor-value">${species['Number of Trees']?.toLocaleString() || 'N/A'}</span></div>`;
            cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Growth Rate:</span><span class="species-factor-value">${species['Growth Rate (m³/ha/yr)']?.toFixed(2) || 'N/A'} m³/ha/yr</span></div>`;
    
            // Conversion Factors Section
            cardHTML += `<hr class="species-card-divider">`;
            cardHTML += `<div class="species-factors-title">Conversion Factors</div>`;
            if (species['Wood Density (tdm/m³)'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Wood Density:</span><span class="species-factor-value">${species['Wood Density (tdm/m³)']?.toFixed(3)} tdm/m³</span></div>`;
            if (species['BEF'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">BEF:</span><span class="species-factor-value">${species['BEF']?.toFixed(3)}</span></div>`;
            if (species['Root-Shoot Ratio'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">R:S Ratio:</span><span class="species-factor-value">${species['Root-Shoot Ratio']?.toFixed(3)}</span></div>`;
            if (species['Carbon Fraction'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Carbon Fraction:</span><span class="species-factor-value">${species['Carbon Fraction']?.toFixed(3)}</span></div>`;
    
            // Site & Climate Factors Section
            if (species['Site Quality'] || species['Average Rainfall'] || species['Soil Type'] || species['Survival Rate (%)'] !== null || species['Risk Rate (%)'] !== null) {
                cardHTML += `<hr class="species-card-divider">`;
                cardHTML += `<div class="species-factors-title">Site & Climate Factors</div>`;
                if (species['Site Quality']) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Site Quality:</span><span class="species-factor-value">${species['Site Quality']}</span></div>`;
                if (species['Average Rainfall']) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Rainfall:</span><span class="species-factor-value">${species['Average Rainfall']}</span></div>`;
                if (species['Soil Type']) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Soil Type:</span><span class="species-factor-value">${species['Soil Type']}</span></div>`;
                if (species['Survival Rate (%)'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Survival Rate:</span><span class="species-factor-value">${species['Survival Rate (%)']?.toFixed(1)}%</span></div>`;
                // Display combined risk rate
                if (species['Risk Rate (%)'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Risk Rate:</span><span class="species-factor-value">${species['Risk Rate (%)']?.toFixed(1)}%</span></div>`;
            }
    
            // Species Traits Section
            if (species['Drought Tolerance'] || species['Water Sensitivity'] || species['Soil Preference']) {
                cardHTML += `<hr class="species-card-divider">`;
                cardHTML += `<div class="species-factors-title">Species Traits</div>`;
                if (species['Drought Tolerance']) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Drought Tolerance:</span><span class="species-factor-value">${species['Drought Tolerance']}</span></div>`;
                if (species['Water Sensitivity']) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Water Sensitivity:</span><span class="species-factor-value">${species['Water Sensitivity']}</span></div>`;
                if (species['Soil Preference']) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Soil Preference:</span><span class="species-factor-value">${species['Soil Preference']}</span></div>`;
            }
    
            // Green Cover & Carbon Credits Section (from Excel)
            if (species['Initial Green Cover (ha)'] !== null || species['Total Geographical Area (ha)'] !== null || species['Dead Attribute (%)'] !== null) {
                cardHTML += `<hr class="species-card-divider">`;
                cardHTML += `<div class="species-factors-title">Green Cover & Carbon</div>`;
                if (species['Initial Green Cover (ha)'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Initial Green Cover:</span><span class="species-factor-value">${species['Initial Green Cover (ha)']?.toFixed(2)} ha</span></div>`;
                if (species['Total Geographical Area (ha)'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Total Geo. Area:</span><span class="species-factor-value">${species['Total Geographical Area (ha)']?.toFixed(2)} ha</span></div>`;
                if (species['Dead Attribute (%)'] !== null) cardHTML += `<div class="species-factor-item"><span class="species-factor-label">Dead Attribute:</span><span class="species-factor-value">${species['Dead Attribute (%)']?.toFixed(1)}%</span></div>`;
            }
            
            factorCard.innerHTML = cardHTML;
            factorsContainer.appendChild(factorCard);
        });
    
        speciesList.innerHTML = ''; // Clear previous content
        speciesList.appendChild(factorsContainer);
    }

    function updateConversionFactors(speciesData) {
        // ... (updateConversionFactors implementation) ...
        if (speciesData['Wood Density (tdm/m³)'] && !isNaN(parseFloat(speciesData['Wood Density (tdm/m³)']))) {
            document.getElementById('woodDensity').value = parseFloat(speciesData['Wood Density (tdm/m³)'] || 0).toFixed(3);
        }
        if (speciesData['BEF'] && !isNaN(parseFloat(speciesData['BEF']))) {
            document.getElementById('bef').value = parseFloat(speciesData['BEF'] || 0).toFixed(3);
        }
        if (speciesData['Root-Shoot Ratio'] && !isNaN(parseFloat(speciesData['Root-Shoot Ratio']))) {
            document.getElementById('rsr').value = parseFloat(speciesData['Root-Shoot Ratio'] || 0).toFixed(3);
        }
        if (speciesData['Carbon Fraction'] && !isNaN(parseFloat(speciesData['Carbon Fraction']))) {
            document.getElementById('carbonFraction').value = parseFloat(speciesData['Carbon Fraction'] || 0).toFixed(3);
        }
    }

    function updateSiteFactors(speciesData) {
        // ... (updateSiteFactors implementation) ...
        const siteQualityEl = document.getElementById('siteQuality');
        if (speciesData['Site Quality'] && siteQualityEl) {
            if ([...siteQualityEl.options].some(opt => opt.value === speciesData['Site Quality'])) {
                siteQualityEl.value = speciesData['Site Quality'];
            }
        }
        
        const avgRainfallEl = document.getElementById('avgRainfall');
        if (speciesData['Average Rainfall'] && avgRainfallEl) {
            if ([...avgRainfallEl.options].some(opt => opt.value === speciesData['Average Rainfall'])) {
                avgRainfallEl.value = speciesData['Average Rainfall'];
            }
        }
        
        const soilTypeEl = document.getElementById('soilType');
        if (speciesData['Soil Type'] && soilTypeEl) {
            if ([...soilTypeEl.options].some(opt => opt.value === speciesData['Soil Type'])) {
                soilTypeEl.value = speciesData['Soil Type'];
            }
        }
        
        const survivalRateEl = document.getElementById('survivalRate');
        if (speciesData['Survival Rate (%)'] && survivalRateEl) {
            if (!isNaN(parseFloat(speciesData['Survival Rate (%)']))) {
                survivalRateEl.value = parseFloat(speciesData['Survival Rate (%)']);
            }
        }
    }

    // --- PDF Generation Function (Forest) ---
    async function generateForestPdf() {
        // ... (printPdfBtn event listener implementation, renamed) ...
        const resultsSection = document.getElementById('resultsSectionForest'); // Corrected ID
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            alert('No results to print. Please calculate results first.');
            return;
        }

        try {
            // Create a new jsPDF instance
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            doc.setFont('helvetica', 'bold');
            
            const locationName = document.getElementById('projectLocation').value.trim() || "Unnamed Site";

            // Add header
            doc.setFillColor(5, 150, 105); // Forest theme color
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('Afforestation CO2e Assessment', 15, 15);
            doc.setFontSize(14);
            doc.text(`Site: ${locationName}`, 15, 28);

            // Add Bosch India Foundation logo placeholder (right-aligned)
            // Note: This is a placeholder. The actual logo will need to be loaded 
            // once the image is provided by the user
            doc.setFontSize(10);
            doc.text('Bosch India Foundation', 150, 15);
            
            // Reset text color
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            // Add report date and project overview
            doc.setFontSize(12);
            doc.text('Report Generated:', 15, 45);
            doc.setFont('helvetica', 'bold');
            doc.text(new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }), 50, 45);

            // Project Overview Section
            doc.setFillColor(240, 240, 240);
            doc.rect(15, 55, 180, 50, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Project Overview', 20, 65);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            
            const projectDetails = [
                `Location: ${locationName}`,
                `Project Area: ${document.getElementById('projectArea')?.value || 'N/A'} hectares`,
                `Project Duration: ${document.getElementById('projectDuration')?.value || 'N/A'} years`,
                `Planting Density: ${document.getElementById('plantingDensity')?.value || 'N/A'} trees/hectare`
            ];
            doc.text(projectDetails, 25, 75, { lineHeightFactor: 1.5 });

            // Results Summary Section
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Sequestration Results Summary', 15, 120);
            
            const totalSeq = document.getElementById('totalSequestration')?.textContent || 'N/A';
            
            function extractNumericValue(costText) {
                if (!costText || costText === 'N/A') return 'N/A';
                return costText.replace(/[₹\s,]/g, '');
            }
            
            const totalCost = extractNumericValue(document.getElementById('totalProjectCost')?.textContent); // Uses the display element, which is correct here
            const costPerTonne = extractNumericValue(document.getElementById('costPerTonne')?.textContent);
            
            // Create metric boxes
            function addMetricBox(title, value, unit, x, y) {
                doc.setFillColor(250, 250, 250);
                doc.rect(x, y, 85, 30, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, y, 85, 30, 'S');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                
                const titleLines = doc.splitTextToSize(title, 75);
                titleLines.forEach((line, index) => doc.text(line, x + 5, y + 7 + (index * 5)));
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                const displayValue = formatCO2e(value);
                doc.text(displayValue, x + 5, y + 20);
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(unit, x + 5, y + 27);
            }

            addMetricBox('Total Carbon Sequestered', totalSeq.split(' ')[0], 'tCO2e', 15, 130);
            addMetricBox('Total Project Cost', totalCost, 'INR', 110, 130);
            addMetricBox('Cost per tCO2e', costPerTonne, 'INR/tCO2e', 15, 170);

            // Chart section
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Total Sequestration Trajectory', 15, 215);
            
            const chart = document.getElementById('sequestrationChart');
            if (chart) {
                const chartImg = chart.toDataURL('image/png');
                doc.addImage(chartImg, 'PNG', 15, 225, 180, 60);
            }

            // Add species-specific charts if available
            const speciesCharts = document.querySelectorAll('#forestProjectContent .species-chart-card canvas'); // Scope to forest
            if (speciesCharts.length > 0) {
                doc.addPage();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text(`Species-Specific Sequestration - ${locationName}`, 15, 20);

                let yPos = 30;
                speciesCharts.forEach((speciesChart, index) => {
                    const speciesName = speciesChart.closest('.species-chart-card')?.querySelector('.species-chart-title')?.textContent || `Species ${index + 1}`;
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text(speciesName, 15, yPos);
                    
                    const chartImg = speciesChart.toDataURL('image/png');
                    doc.addImage(chartImg, 'PNG', 15, yPos + 5, 180, 50);
                    
                    yPos += 65;
                    if (yPos > 240 && index < speciesCharts.length - 1) {
                        doc.addPage();
                        yPos = 20;
                    }
                });
            }

            // Add detailed results table
            doc.addPage();
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(`Detailed Annual Results - ${locationName}`, 15, 20);
            
            const tableHeaders = [
                ['Year', 20], ['Age', 20], ['Volume (m³/ha/yr)', 50],
                ['Annual CO2e (t)', 50], ['Cumulative CO2e (t)', 50]
            ];

            let y = 30;
            // Draw header background
            doc.setFillColor(5, 150, 105); // Forest theme color
            doc.rect(15, y - 5, 180, 8, 'F');
            
            // Add headers
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            let x = 15;
            tableHeaders.forEach(([header, width]) => {
                doc.text(header, x + 2, y);
                x += width;
            });

            // Add table data
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            const table = document.getElementById('resultsTableForest'); // Corrected ID
            if (table) {
                const rows = Array.from(table.querySelectorAll('tbody tr')); // Get rows from tbody
                y += 10;
                
                rows.forEach((row, index) => {
                    // Calculate max height increase needed for this row *before* drawing anything
                    let maxRowHeightIncrease = 0;
                    const cells = Array.from(row.cells);
                    cells.forEach((cell, cellIndex) => {
                        const value = cell.textContent.trim();
                        const formattedValue = !isNaN(parseFloat(value)) ? 
                            parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                            value;
                        
                        if (cellIndex >= 2) { // Check wrapping for relevant columns
                            const width = tableHeaders[cellIndex][1] - 4;
                            const lines = doc.splitTextToSize(formattedValue, width);
                            if (lines.length > 1) {
                                maxRowHeightIncrease = Math.max(maxRowHeightIncrease, (lines.length - 1) * 5);
                            }
                        }
                    });
                    
                    const rowHeight = 8 + maxRowHeightIncrease; // Calculate total row height

                    // Check for page break *before* drawing the row
                    if (y + rowHeight > 280) { // Check if the row fits on the current page
                        doc.addPage();
                        y = 30; // Reset y for new page
                        
                        // Repeat header on new page
                        doc.setFillColor(5, 150, 105);
                        doc.rect(15, y - 5, 180, 8, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'bold');
                        let xHeader = 15;
                        tableHeaders.forEach(([header, width]) => {
                            doc.text(header, xHeader + 2, y);
                            xHeader += width;
                        });
                        doc.setTextColor(0, 0, 0);
                        doc.setFont('helvetica', 'normal');
                        y += 10; // Space after header
                    }

                    // Alternate row backgrounds - Draw with calculated height
                    if (index % 2 === 0) {
                        doc.setFillColor(245, 245, 245);
                        doc.rect(15, y - 5, 180, rowHeight, 'F'); 
                    }
                    
                    // Draw cell text
                    x = 15;
                    cells.forEach((cell, cellIndex) => {
                        const value = cell.textContent.trim();
                        const formattedValue = !isNaN(parseFloat(value)) ? 
                            parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                            value;
                        
                        if (cellIndex >= 2) {
                            const width = tableHeaders[cellIndex][1] - 4;
                            const lines = doc.splitTextToSize(formattedValue, width);
                            doc.text(lines, x + 2, y);
                        } else {
                            doc.text(formattedValue, x + 2, y);
                        }
                        x += tableHeaders[cellIndex][1];
                    });
                    
                    // Increase y position by calculated row height + spacing
                    y += rowHeight + 2; // Add 2mm spacing between rows
                });
            }

            // Footer with disclaimer and page numbers
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(200, 200, 200);
                doc.line(15, 280, 195, 280);
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(`Page ${i} of ${pageCount}`, 185, 287, { align: 'right' });
                
                if (i === pageCount) {
                    doc.setFont('helvetica', 'italic');
                    doc.text('Disclaimer: These results are simplified estimations using generic growth curves and default factors. ' +
                           'They do not account for leakage, specific site conditions, or mortality.', 15, 287, { maxWidth: 160 });
                }
            }

            // Save the PDF
            const dateStr = new Date().toISOString().split('T')[0];
            const safeLocationName = locationName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            doc.save(`afforestation-report-${safeLocationName}-${dateStr}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    // --- Excel Export Function (Forest) ---
    function exportForestExcel() {
        // ... (exportExcelBtn event listener implementation, renamed) ...
        const resultsSection = document.getElementById('resultsSectionForest'); // Corrected ID
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            alert('No results to export. Please calculate results first.');
            return;
        }

        try {
            const locationName = document.getElementById('projectLocation').value.trim() || "Unnamed Site";
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Get table data
            const table = document.getElementById('resultsTableForest'); // Corrected ID
            const ws = XLSX.utils.table_to_sheet(table);
            
            // Add project information to a new sheet
            const infoData = [
                ['Afforestation Project Impact Results'], [''],
                ['Project Information'],
                ['Location', locationName],
                ['Project Area (ha)', document.getElementById('projectArea')?.value],
                ['Planting Density (trees/ha)', document.getElementById('plantingDensity')?.value],
                ['Project Duration (years)', document.getElementById('projectDuration')?.value],
                ['Baseline Rate (tCO2e/ha/yr)', document.getElementById('baselineRate')?.value],
                [''],
                ['Summary Results'],
                ['Total Sequestration', document.getElementById('totalSequestration')?.textContent],
                ['Total Project Cost', document.getElementById('totalProjectCost')?.textContent],
                ['Cost per tCO2e', document.getElementById('costPerTonne')?.textContent],
                [''],
                ['Report Generated', new Date().toLocaleDateString()]
            ];
            
            const infoWs = XLSX.utils.aoa_to_sheet(infoData);
            
            // Add worksheets to workbook
            XLSX.utils.book_append_sheet(wb, infoWs, "Project Summary");
            XLSX.utils.book_append_sheet(wb, ws, "Annual Results");
            
            // Save the file
            const dateStr = new Date().toISOString().split('T')[0];
            const safeLocationName = locationName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            XLSX.writeFile(wb, `afforestation-impact-data-${safeLocationName}-${dateStr}.xlsx`);
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Error exporting to Excel. Please try again.');
        }
    }

    // --- Event Listeners (Forest) ---
    const calculatorForm = document.getElementById('calculatorForm');
    if (calculatorForm) {
        calculatorForm.addEventListener('submit', handleForestFormSubmit);
    }

    const speciesFileEl = document.getElementById('speciesFile');
    if (speciesFileEl) {
        speciesFileEl.addEventListener('change', handleSpeciesFileUpload);
    }

    const printForestPdfBtn = document.getElementById('printForestPdfBtn');
    if (printForestPdfBtn) {
        printForestPdfBtn.addEventListener('click', generateForestPdf);
    }

    const exportForestExcelBtn = document.getElementById('exportForestExcelBtn');
    if (exportForestExcelBtn) {
        exportForestExcelBtn.addEventListener('click', exportForestExcel);
    }

    // Connect template download button if it exists
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadExcelTemplate);
        console.log('Download template button listener added'); // For debugging
    }
}

// --- Water Project Calculator Logic ---
function setupWaterCalculator() {
    // --- DOM Element References (Water) ---
    const waterCalculatorForm = document.getElementById('waterCalculatorForm');
    if (!waterCalculatorForm) return; // Don't run if water form isn't present

    const waterResultsSection = document.getElementById('waterResultsSection');
    const calculateWaterBtn = document.getElementById('calculateWaterBtn');
    const waterBtnText = document.getElementById('waterBtnText');
    const waterBtnSpinner = document.getElementById('waterBtnSpinner');
    const errorMessageDivWater = document.getElementById('errorMessageWater');
    let waterCaptureChart = null; // Chart instance for water

    // Input field references for validation feedback (Water)
    const waterProjectAreaInput = document.getElementById('waterProjectArea');
    const waterProjectTypeInput = document.getElementById('waterProjectType');
    const annualRainfallInput = document.getElementById('annualRainfall');
    const runoffCoefficientInput = document.getElementById('runoffCoefficient');
    const waterProjectDurationInput = document.getElementById('waterProjectDuration');
    const captureEfficiencyInput = document.getElementById('captureEfficiency');
    const energySavingsInput = document.getElementById('energySavings');
    const waterProjectCostInput = document.getElementById('waterProjectCost');
    const waterInputs = [
        waterProjectAreaInput, waterProjectTypeInput, annualRainfallInput,
        runoffCoefficientInput, waterProjectDurationInput, captureEfficiencyInput,
        energySavingsInput, waterProjectCostInput
    ];

    // --- Input Validation Function (Water) ---
    function validateWaterInput(inputElement, min, max, name) {
        const value = parseFloat(inputElement.value);
        let error = null;

        if (inputElement.type === 'number' && inputElement.value !== '' && !/^\-?\d*\.?\d*$/.test(inputElement.value)) {
            error = `${name} must contain only numeric values.`;
        } else if (inputElement.type !== 'select-one' && isNaN(value)) { // Ignore select validation here
             error = `${name} must be a number.`;
        } else if (min !== null && value < min) {
            error = `${name} must be at least ${min}.`;
        } else if (max !== null && value > max) {
            error = `${name} cannot exceed ${max}.`;
        }

        if (error) {
            inputElement.classList.add('input-error');
            return error;
        } else {
            inputElement.classList.remove('input-error');
            return null;
        }
    }

    // --- Get & Validate All Inputs (Water) ---
    function getAndValidateWaterInputs() {
        clearWaterErrors();
        let errors = [];
        let validationError = null;

        // Validate required fields
        validationError = validateWaterInput(waterProjectAreaInput, 0.1, null, 'Project Area');
        if (validationError) errors.push(validationError);
        
        validationError = validateWaterInput(annualRainfallInput, 0, null, 'Annual Rainfall');
        if (validationError) errors.push(validationError);
        
        validationError = validateWaterInput(runoffCoefficientInput, 0, 1, 'Runoff Coefficient');
        if (validationError) errors.push(validationError);
        
        validationError = validateWaterInput(waterProjectDurationInput, 1, 50, 'Project Duration');
        if (validationError) errors.push(validationError);
        
        validationError = validateWaterInput(captureEfficiencyInput, 1, 100, 'Capture Efficiency');
        if (validationError) errors.push(validationError);
        
        validationError = validateWaterInput(energySavingsInput, 0, null, 'Energy Required for Alternative Supply');
        if (validationError) errors.push(validationError);
        
        // Check for project type selection
        if (!waterProjectTypeInput.value) {
            waterProjectTypeInput.classList.add('input-error');
            errors.push('Please select a Project Type');
        } else {
             waterProjectTypeInput.classList.remove('input-error');
        }

        if (errors.length > 0) {
            showWaterError(errors.join('<br>'));
            return null;
        }
        
        // Format and return validated inputs
        return {
            projectLocation: document.getElementById('waterProjectLocation').value,
            projectArea: parseFloat(waterProjectAreaInput.value),
            projectType: waterProjectTypeInput.value,
            annualRainfall: parseFloat(annualRainfallInput.value),
            runoffCoefficient: parseFloat(runoffCoefficientInput.value),
            waterDemand: parseFloat(document.getElementById('waterDemand').value) || 0,
            projectDuration: parseInt(waterProjectDurationInput.value),
            captureEfficiency: parseFloat(captureEfficiencyInput.value) / 100, // Convert to decimal
            energySavings: parseFloat(energySavingsInput.value),
            projectCost: parseNumberWithCommas(waterProjectCostInput.value)
        };
    }

    // --- Error Handling Functions (Water) ---
    function showWaterError(message) {
        errorMessageDivWater.innerHTML = message;
        errorMessageDivWater.classList.remove('hidden');
    }

    function clearWaterErrors() {
        errorMessageDivWater.innerHTML = '';
        errorMessageDivWater.classList.add('hidden');
        waterInputs.forEach(input => input?.classList.remove('input-error')); // Add null check
    }

    // --- Calculation Function (Water) ---
    function calculateWaterImpact(inputs) {
        // ... (calculateWaterImpact implementation) ...
        // Annual water capture calculation (in kiloliters)
        const areaInSqMeters = inputs.projectArea * 10000; // Convert hectares to m²
        const annualRainfallInMeters = inputs.annualRainfall / 1000; // Convert mm to meters
        
        const annualWaterCaptureBase = areaInSqMeters * annualRainfallInMeters * inputs.runoffCoefficient;
        const annualWaterCapture = annualWaterCaptureBase * inputs.captureEfficiency;
        
        // Calculate annual and cumulative results
        const annualResults = [];
        let totalWaterCaptured = 0;
        let totalEnergySaved = 0;
        let totalCO2Reduced = 0;
        
        // Emission factor for electricity (kg CO2e per kWh) - India average
        const emissionFactor = 0.82; // This can be adjusted based on region/country
        
        for (let year = 1; year <= inputs.projectDuration; year++) {
            // For simplicity, we'll assume constant capture, but you could add degradation factors
            const yearlyWaterCapture = annualWaterCapture;
            totalWaterCaptured += yearlyWaterCapture;
            
            // Calculate energy savings
            const energySaved = yearlyWaterCapture * inputs.energySavings;
            totalEnergySaved += energySaved;
            
            // Calculate CO2 emissions reduction
            const co2Reduced = (energySaved * emissionFactor) / 1000; // Convert to tonnes
            totalCO2Reduced += co2Reduced;
            
            annualResults.push({
                year,
                waterCaptured: yearlyWaterCapture.toFixed(2),
                cumulativeWaterCaptured: totalWaterCaptured.toFixed(2),
                energySaved: energySaved.toFixed(2),
                co2Reduced: co2Reduced.toFixed(2)
            });
        }
        
        // Calculate demand coverage if demand is provided
        const demandCoverage = inputs.waterDemand > 0 
            ? Math.min(100, (annualWaterCapture / inputs.waterDemand) * 100) 
            : null;
        
        // Calculate cost metrics
        const costPerKiloliter = inputs.projectCost > 0 && totalWaterCaptured > 0
            ? inputs.projectCost / totalWaterCaptured
            : null;
            
        const costPerHectare = inputs.projectCost > 0 && inputs.projectArea > 0
            ? inputs.projectCost / inputs.projectArea
            : null;
            
        // Estimate payback period (assuming water cost of 20 Rs per kiloliter)
        const waterCostPerKL = 20; // Assumption for cost of water
        const annualSavings = annualWaterCapture * waterCostPerKL;
        const paybackPeriod = inputs.projectCost > 0 && annualSavings > 0
            ? inputs.projectCost / annualSavings
            : null;
        
        // Return all calculated results
        return {
            annualResults,
            summary: {
                totalWaterCaptured,
                annualWaterCapture,
                totalEnergySaved,
                totalCO2Reduced,
                demandCoverage,
                costPerKiloliter,
                costPerHectare,
                paybackPeriod
            }
        };
    }

    // --- DOM Update Functions (Water) ---
    function displayWaterResults(results) {
        // Update summary metrics
        document.getElementById('totalWaterCaptured').textContent = results.summary.totalWaterCaptured.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        document.getElementById('annualWaterCaptured').textContent = results.summary.annualWaterCapture.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        document.getElementById('emissionsReduction').textContent = results.summary.totalCO2Reduced.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        
        // Display demand coverage if available
        const demandCoverageEl = document.getElementById('demandCoverage');
        if (results.summary.demandCoverage !== null) {
            demandCoverageEl.textContent = results.summary.demandCoverage.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + '%';
        } else {
            demandCoverageEl.textContent = 'N/A';
        }
        
        // Update cost analysis
        const projectCost = document.getElementById('waterProjectCost').value;
        document.getElementById('waterTotalProjectCost').textContent = '₹ ' + parseNumberWithCommas(projectCost).toLocaleString('en-IN');
        
        const costPerKlEl = document.getElementById('costPerKiloliter');
        if (results.summary.costPerKiloliter !== null) {
            costPerKlEl.textContent = '₹ ' + results.summary.costPerKiloliter.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' per KL';
        } else {
            costPerKlEl.textContent = 'N/A';
        }

        const costPerHectareEl = document.getElementById('costPerHectare');
        if (results.summary.costPerHectare !== null) {
            costPerHectareEl.textContent = '₹ ' + results.summary.costPerHectare.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' per hectare';
        } else {
            costPerHectareEl.textContent = 'N/A';
        }
        
        const paybackPeriodEl = document.getElementById('paybackPeriod');
        if (results.summary.paybackPeriod !== null) {
            paybackPeriodEl.textContent = results.summary.paybackPeriod.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' years';
        } else {
            paybackPeriodEl.textContent = 'N/A';
        }

        // Update results table
        const resultsBody = document.getElementById('waterResultsBody');
        if (resultsBody) {
            resultsBody.innerHTML = '';
            results.annualResults.forEach(result => {
                const row = resultsBody.insertRow();
                row.innerHTML = `
                    <td>${result.year}</td>
                    <td>${parseFloat(result.waterCaptured).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td>${parseFloat(result.cumulativeWaterCaptured).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td>${parseFloat(result.energySaved).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td>${parseFloat(result.co2Reduced).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                `;
            });
        }
        
        const chartLabels = results.annualResults.map(r => `Year ${r.year}`);
        const cumWaterData = results.annualResults.map(r => parseFloat(r.cumulativeWaterCaptured));
        const annualWaterData = results.annualResults.map(r => parseFloat(r.waterCaptured));
        
        // Get the chart canvas
        const chartCanvas = document.getElementById('waterCaptureChart');
        if (!chartCanvas) {
            console.error("Water capture chart canvas not found");
            return;
        }
        
        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (waterCaptureChart) {
            waterCaptureChart.destroy();
        }
        
        // Create new chart
        waterCaptureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Cumulative Water Captured (KL)',
                        data: cumWaterData,
                        borderColor: '#0284c7', // Water theme primary
                        backgroundColor: 'rgba(2, 132, 199, 0.05)',
                        tension: 0.4, fill: true,
                        pointBackgroundColor: '#0369a1', // Water theme dark
                        pointBorderColor: '#fff', pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#0369a1', pointHoverBorderWidth: 2,
                        borderWidth: 3, pointRadius: 4, pointHoverRadius: 6,
                        cubicInterpolationMode: 'monotone', yAxisID: 'y'
                    },
                    {
                        label: 'Annual Water Captured (KL)',
                        data: annualWaterData,
                        borderColor: '#0ea5e9', // Water theme light
                        backgroundColor: 'rgba(14, 165, 233, 0.5)',
                        borderDash: [5, 5], tension: 0.1,
                        pointRadius: 3, borderWidth: 2,
                        type: 'bar', yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: true, aspectRatio: 2,
                layout: { padding: { top: 20, right: 25, bottom: 20, left: 25 } },
                scales: {
                    y: {
                        beginAtZero: true, position: 'left',
                        grid: { color: 'rgba(0, 0, 0, 0.05)', lineWidth: 1 },
                        title: { display: true, text: 'Cumulative Water (KL)' },
                        ticks: { padding: 10, color: '#4b5563', callback: function(value) { return value.toLocaleString() + ' KL'; } }
                    },
                    y1: {
                        beginAtZero: true, position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Annual Water (KL)' },
                        ticks: { padding: 10, color: '#0ea5e9', callback: function(value) { return value.toLocaleString() + ' KL'; } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { padding: 8, maxRotation: 45, minRotation: 45 }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        enabled: true, backgroundColor: 'rgba(17, 24, 39, 0.8)',
                        titleFont: { size: 13 }, bodyFont: { size: 12 },
                        padding: 12, cornerRadius: 6, displayColors: true
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }

    // --- Form Submission Handler (Water) ---
    function handleWaterFormSubmit(event) {
        // ... (waterCalculatorForm submit listener implementation) ...
        event.preventDefault();
        calculateWaterBtn.disabled = true;
        calculateWaterBtn.classList.add('calculating');
        waterResultsSection.classList.add('hidden');
        clearWaterErrors();

        setTimeout(() => {
            try {
                const inputs = getAndValidateWaterInputs();
                if (!inputs) {
                    throw new Error('Input validation failed');
                }
                
                const results = calculateWaterImpact(inputs);
                displayWaterResults(results);
                waterResultsSection.classList.remove('hidden');
                waterResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
            } catch (error) {
                console.error("Water Calculation Error:", error);
                showWaterError(error.message || "An error occurred during calculation. Please check your inputs.");
                waterResultsSection.classList.add('hidden');
            } finally {
                calculateWaterBtn.disabled = false;
                calculateWaterBtn.classList.remove('calculating');
            }
        }, 50);
    }

    // --- Reset Button Handlers (Water) ---
    // Use event delegation on the water form for reset buttons
    waterCalculatorForm.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('reset-btn')) {
            const inputId = target.getAttribute('data-for');
            const input = document.getElementById(inputId);
            if (!input) return; // Add check
            const defaultValue = input.getAttribute('data-default');
            input.value = defaultValue;
            input.classList.add('highlight');
            setTimeout(() => input.classList.remove('highlight'), 500);
        }
    });

    // --- Reset All Function (Water) ---
    function resetWaterCalculator() {
        // ... (resetWaterCalculator implementation) ...
        // Clear all input fields
        const inputs = document.querySelectorAll('#waterCalculatorForm input, #waterCalculatorForm select');
        inputs.forEach(input => {
            const defaultValue = input.getAttribute('data-default');
            if (defaultValue) {
                input.value = defaultValue;
            } else if (input.type === 'text' || input.type === 'number') {
                input.value = '';
            } else if (input.tagName === 'SELECT') {
                input.selectedIndex = 0;
            }
            input.classList.remove('input-error');
        });
        
        // Hide results and errors
        waterResultsSection.classList.add('hidden');
        errorMessageDivWater.classList.add('hidden');
        
        // Reset chart
        if (waterCaptureChart) {
            waterCaptureChart.destroy();
            waterCaptureChart = null;
        }
    }

    // Add reset button event listener (Water)
    const resetWaterBtn = document.getElementById('resetWaterBtn');
    if (resetWaterBtn) {
        resetWaterBtn.addEventListener('click', resetWaterCalculator);
    }

    // --- Input Event Handlers (Water) ---
    waterInputs.forEach(input => {
         if (input) { // Add null check
            input.addEventListener('input', () => {
                input.classList.remove('input-error');
                errorMessageDivWater.classList.add('hidden');
            });
         }
    });

    // Add input handler for project cost (Water)
    if (waterProjectCostInput) {
        waterProjectCostInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d,]/g, '');
            value = value.replace(/,/g, '');
            if (value) {
                value = parseInt(value).toLocaleString('en-IN');
            }
            e.target.value = value;
        });
    }

    // --- PDF Generation Function (Water) ---
    async function generateWaterPdf() {
        // ... (printWaterPdfBtn event listener implementation) ...
        const resultsSection = document.getElementById('waterResultsSection');
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            alert('No results to print. Please calculate results first.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            doc.setFont('helvetica', 'bold');
            
            const locationName = document.getElementById('waterProjectLocation').value.trim() || "Unnamed Site";
            
            // Get the actual project type text from the select element
            const projectTypeEl = document.getElementById('waterProjectType');
            const projectTypeText = projectTypeEl ? projectTypeEl.options[projectTypeEl.selectedIndex].text : 'N/A';

            // Add header (Water theme)
            doc.setFillColor(2, 132, 199); // Water theme color
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('Water Project Impact Assessment', 15, 15);
            doc.setFontSize(14);
            doc.text(`Site: ${locationName}`, 15, 28);
            
            // Add Bosch India Foundation logo placeholder (right-aligned)
            // Note: This is a placeholder. The actual logo will need to be loaded 
            // once the image is provided by the user
            doc.setFontSize(10);
            doc.text('Bosch India Foundation', 150, 15);
            
            // Reset text color
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            
            // Add report date and project overview
            doc.setFontSize(12);
            doc.text('Report Generated:', 15, 45);
            doc.setFont('helvetica', 'bold');
            doc.text(new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }), 50, 45);
            
            // Project Overview Section
            doc.setFillColor(240, 240, 240);
            doc.rect(15, 55, 180, 50, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Project Overview', 20, 65);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            
            // Continue with existing code...
            const projectDetails = [
                `Location: ${locationName}`,
                `Project Type: ${projectTypeText}`,
                `Project Area: ${document.getElementById('waterProjectArea')?.value || 'N/A'} hectares`,
                `Annual Rainfall: ${document.getElementById('annualRainfall')?.value || 'N/A'} mm`
            ];
            doc.text(projectDetails, 25, 75, { lineHeightFactor: 1.5 });

            // Rest of the function remains unchanged...
            // Results Summary Section
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Water Impact Summary', 15, 120);
            
            // Add summary metrics in boxes
            function addMetricBox(title, value, unit, x, y) {
                doc.setFillColor(250, 250, 250);
                doc.rect(x, y, 85, 30, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, y, 85, 30, 'S');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const titleLines = doc.splitTextToSize(title, 75);
                titleLines.forEach((line, index) => doc.text(line, x + 5, y + 7 + (index * 5)));
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                const displayValue = formatCO2e(value); // Use CO2e formatter
                doc.text(displayValue, x + 5, y + 20);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(unit, x + 5, y + 27);
            }
            
            function extractNumericValue(costText) {
                 if (!costText || costText === 'N/A') return 'N/A';
                 return costText.replace(/[₹%\s,]/g, ''); // Remove % too
            }

            addMetricBox(
                'Total Water Captured', 
                extractNumericValue(document.getElementById('totalWaterCaptured')?.textContent),
                'Kiloliters', 15, 130
            );
            addMetricBox(
                'CO₂ Emissions Reduced', 
                extractNumericValue(document.getElementById('emissionsReduction')?.textContent),
                'Tonnes CO2e', 110, 130
            );
            addMetricBox(
                'Annual Water Captured', 
                extractNumericValue(document.getElementById('annualWaterCaptured')?.textContent),
                'KL/year', 15, 170
            );
            addMetricBox(
                'Cost per Kiloliter', 
                extractNumericValue(document.getElementById('costPerKiloliter')?.textContent),
                'INR per KL', 110, 170
            );
            
            // Chart section
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Water Capture Trajectory', 15, 215);
            
            const chart = document.getElementById('waterCaptureChart');
            if (chart) {
                const chartImg = chart.toDataURL('image/png');
                doc.addImage(chartImg, 'PNG', 15, 225, 180, 60);
            }
            
            // Add detailed results table on new page
            doc.addPage();
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(`Detailed Annual Results - ${locationName}`, 15, 20);
            
            const tableHeaders = [
                ['Year', 20], ['Water (KL)', 40], ['Cumulative (KL)', 50],
                ['Energy (kWh)', 35], ['CO2e (t)', 35]
            ];
            
            let y = 30;
            // Draw header background (Water theme)
            doc.setFillColor(2, 132, 199);
            doc.rect(15, y - 5, 180, 8, 'F');
            
            // Add headers
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            let x = 15;
            tableHeaders.forEach(([header, width]) => {
                doc.text(header, x + 2, y);
                x += width;
            });
            
            // Add table data
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            const table = document.getElementById('waterResultsTable');
            if (table) {
                const rows = Array.from(table.querySelectorAll('tbody tr'));
                y += 10;
                
                rows.forEach((row, index) => {
                    // Calculate max row height
                    let maxRowHeightIncrease = 0;
                    const cells = Array.from(row.cells);
                    cells.forEach((cell, cellIndex) => {
                        const value = cell.textContent.trim();
                        const formattedValue = !isNaN(parseFloat(value)) ? 
                            parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                            value;
                        if (cellIndex >= 1) { // Check wrapping for relevant columns
                            const width = tableHeaders[cellIndex][1] - 4;
                            const lines = doc.splitTextToSize(formattedValue, width);
                            if (lines.length > 1) {
                                maxRowHeightIncrease = Math.max(maxRowHeightIncrease, (lines.length - 1) * 5);
                            }
                        }
                    });
                    const rowHeight = 8 + maxRowHeightIncrease;

                    // Check for page break
                    if (y + rowHeight > 280) {
                        doc.addPage();
                        y = 30;
                        // Repeat header
                        doc.setFillColor(2, 132, 199);
                        doc.rect(15, y - 5, 180, 8, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'bold');
                        let xHeader = 15;
                        tableHeaders.forEach(([header, width]) => {
                            doc.text(header, xHeader + 2, y);
                            xHeader += width;
                        });
                        doc.setTextColor(0, 0, 0);
                        doc.setFont('helvetica', 'normal');
                        y += 10;
                    }

                    // Alternate row backgrounds
                    if (index % 2 === 0) {
                        doc.setFillColor(245, 245, 245);
                        doc.rect(15, y - 5, 180, rowHeight, 'F');
                    }
                    
                    // Draw cell text
                    x = 15;
                    cells.forEach((cell, cellIndex) => {
                        const value = cell.textContent.trim();
                        const formattedValue = !isNaN(parseFloat(value)) ? 
                            parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                            value;
                        if (cellIndex >= 1) {
                            const width = tableHeaders[cellIndex][1] - 4;
                            const lines = doc.splitTextToSize(formattedValue, width);
                            doc.text(lines, x + 2, y);
                        } else {
                            doc.text(formattedValue, x + 2, y);
                        }
                        x += tableHeaders[cellIndex][1];
                    });
                    
                    y += rowHeight + 2; // Increase y position
                });
            }
            
            // Add footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(200, 200, 200);
                doc.line(15, 280, 195, 280);
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(`Page ${i} of ${pageCount}`, 185, 287, { align: 'right' });
                
                if (i === pageCount) {
                    doc.setFont('helvetica', 'italic');
                    doc.text('Disclaimer: These results are estimations based on provided inputs and simplified models. ' +
                           'Actual water capture may vary based on specific site conditions.', 15, 287, { maxWidth: 160 });
                }
            }
            
            // Save the PDF
            const dateStr = new Date().toISOString().split('T')[0];
            const safeLocationName = locationName.replace(/[^a-z0-0]/gi, '-').toLowerCase();
            doc.save(`water-impact-report-${safeLocationName}-${dateStr}.pdf`);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    // --- Excel Export Function (Water) ---
    function exportWaterExcel() {
        // ... (exportWaterExcelBtn event listener implementation) ...
        const resultsSection = document.getElementById('waterResultsSection');
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            alert('No results to export. Please calculate results first.');
            return;
        }

        try {
            const locationName = document.getElementById('waterProjectLocation').value.trim() || "Unnamed Site";
            const projectTypeEl = document.getElementById('waterProjectType');
            const projectTypeText = projectTypeEl ? projectTypeEl.options[projectTypeEl.selectedIndex].text : 'N/A';
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Get table data
            const table = document.getElementById('waterResultsTable');
            const ws = XLSX.utils.table_to_sheet(table);
            
            // Add project information to a new sheet
            const infoData = [
                ['Water Project Impact Results'], [''],
                ['Project Information'],
                ['Location', locationName],
                ['Project Type', projectTypeText],
                ['Project Area (ha)', document.getElementById('waterProjectArea')?.value],
                ['Annual Rainfall (mm)', document.getElementById('annualRainfall')?.value],
                ['Project Duration (years)', document.getElementById('waterProjectDuration')?.value],
                ['Runoff Coefficient', document.getElementById('runoffCoefficient')?.value],
                ['Capture Efficiency (%)', document.getElementById('captureEfficiency')?.value],
                [''],
                ['Summary Results'],
                ['Total Water Captured (KL)', document.getElementById('totalWaterCaptured')?.textContent],
                ['Annual Water Captured (KL/yr)', document.getElementById('annualWaterCaptured')?.textContent],
                ['CO₂ Emissions Reduced (t)', document.getElementById('emissionsReduction')?.textContent],
                ['Demand Coverage (%)', document.getElementById('demandCoverage')?.textContent],
                [''],
                ['Cost Analysis'],
                ['Total Project Cost', document.getElementById('waterTotalProjectCost')?.textContent],
                ['Cost per Kiloliter', document.getElementById('costPerKiloliter')?.textContent],
                ['Cost per Hectare', document.getElementById('costPerHectare')?.textContent],
                ['Payback Period', document.getElementById('paybackPeriod')?.textContent],
                [''],
                ['Report Generated', new Date().toLocaleDateString()]
            ];
            
            const infoWs = XLSX.utils.aoa_to_sheet(infoData);
            
            // Add worksheets to workbook
            XLSX.utils.book_append_sheet(wb, infoWs, "Project Summary");
            XLSX.utils.book_append_sheet(wb, ws, "Annual Results");
            
            // Save the file
            const dateStr = new Date().toISOString().split('T')[0];
            const safeLocationName = locationName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            XLSX.writeFile(wb, `water-impact-data-${safeLocationName}-${dateStr}.xlsx`);
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Error exporting to Excel. Please try again.');
        }
    }

    // --- Event Listeners (Water) ---
    waterCalculatorForm.addEventListener('submit', handleWaterFormSubmit);

    const printWaterPdfBtn = document.getElementById('printWaterPdfBtn');
    if (printWaterPdfBtn) {
        printWaterPdfBtn.addEventListener('click', generateWaterPdf);
    }

    const exportWaterExcelBtn = document.getElementById('exportWaterExcelBtn');
    if (exportWaterExcelBtn) {
        exportWaterExcelBtn.addEventListener('click', exportWaterExcel);
    }
}

// --- Utility Functions (Shared) ---
function addTemplateDownloadButton() {
    // Add template download button to the UI (Forestry section)
    const uploadSection = document.getElementById('speciesFile')?.parentElement;

    // Check if we've already added our specific template section to avoid duplicates
    if (uploadSection && !uploadSection.querySelector('.template-download-section')) {
        // Create a container for the button and help text
        const templateSection = document.createElement('div');
        templateSection.className = 'template-download-section text-center'; // Add class to check against, center content
        templateSection.style.marginTop = '1rem'; // Add space above this section
        // templateSection.style.borderTop = '1px dashed #e5e7eb'; // Remove visual separator
        // templateSection.style.paddingTop = '1rem'; // Remove extra padding

        // Create concise help text (modified wording and placement)
        const helpText = document.createElement('p');
        helpText.className = 'text-sm text-gray-600 mb-3'; // Add margin below text
        helpText.innerText = 'Need help? Download a template with the correct format.'; // Updated text

        // Create the download button (modified style)
        const downloadBtn = document.createElement('button');
        downloadBtn.type = 'button';
        downloadBtn.id = 'downloadTemplateBtn'; // Give it an ID
        // Use primary button style like the upload button, remove outline class
        downloadBtn.className = 'btn-primary download-template-btn w-full'; // Use primary style, make full width like upload
        downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download Template';
        downloadBtn.style.display = 'inline-flex'; // Ensure button behaves like others
        downloadBtn.style.alignItems = 'center';
        downloadBtn.style.justifyContent = 'center'; // Center icon and text
        downloadBtn.style.gap = '0.5rem';

        // Add elements to the container (help text first, then button)
        templateSection.appendChild(helpText);
        templateSection.appendChild(downloadBtn);

        // Append the whole section to the file upload container
        uploadSection.appendChild(templateSection);

        // Note: The event listener is attached in setupAfforestationCalculator using the button's ID
    }
}

// --- Risk Rate Calculation Function (Shared) ---
function calculateRiskRate(projectType, inputs) {
    let riskRate = 0;
    if (projectType === 'forest') {
        const baseRisk = 0.1;
        // site quality impact
        if (inputs.siteQuality === 'Poor') riskRate += 0.10;
        else if (inputs.siteQuality === 'Medium') riskRate += 0.05;
        // rainfall impact
        if (inputs.avgRainfall === 'Low') riskRate += 0.15;
        else if (inputs.avgRainfall === 'Medium') riskRate += 0.05;
        // soil type impact
        if (inputs.soilType === 'Degraded') riskRate += 0.10;
        // survival rate penalty
        if (inputs.survivalRate < 0.7) riskRate += 0.20;
        else if (inputs.survivalRate < 0.8) riskRate += 0.10;
        return Math.min(0.9, baseRisk + riskRate);
    } else if (projectType === 'water') {
        const baseRisk = 0.1;
        if (inputs.runoffCoefficient < 0.3) riskRate += 0.15;
        else if (inputs.runoffCoefficient < 0.5) riskRate += 0.05;
        if (inputs.captureEfficiency < 0.5) riskRate += 0.20;
        else if (inputs.captureEfficiency < 0.7) riskRate += 0.10;
        if (inputs.annualRainfall < 500) riskRate += 0.15;
        else if (inputs.annualRainfall < 800) riskRate += 0.05;
        return Math.min(0.9, baseRisk + riskRate);
    }
    return 0.1;
}

// Note: Removed duplicate DOMContentLoaded listeners and consolidated tooltip initialization.
// Removed redundant tooltip event listeners (mouseover/mouseout on document).

// --- Enhanced Afforestation Calculator Features ---
function setupGreenCoverAndCredits() {
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
    
    // --- Risk Factor Management ---
    // Default risk values (used if not provided in Excel)
    const riskFactors = {
        fire: 5,     // 5% default fire risk
        insect: 3,   // 3% default insect risk
        disease: 2   // 2% default disease risk
    };
    
    // Total combined risk rate (used in calculations)
    function getTotalRiskRate() {
        // Prioritize combined rate from Excel if available and valid
        if (speciesData && speciesData.length > 0 && speciesData[0]['Risk Rate (%)'] !== undefined && !isNaN(parseFloat(speciesData[0]['Risk Rate (%)']))) {
            return parseFloat(speciesData[0]['Risk Rate (%)']) / 100;
        }
        // Fallback to UI inputs (though UI shows individual, we'll sum them here if no combined rate)
        // Or use a default if UI elements aren't present
        const fireRisk = parseFloat(document.getElementById('fireRisk')?.textContent) || riskFactors.fire;
        const insectRisk = parseFloat(document.getElementById('insectRisk')?.textContent) || riskFactors.insect;
        const diseaseRisk = parseFloat(document.getElementById('diseaseRisk')?.textContent) || riskFactors.disease;
        return (fireRisk + insectRisk + diseaseRisk) / 100;
    }
    
    // Update risk factor displays (primarily for UI defaults)
    function updateRiskFactorDisplays() {
        // If data is uploaded with a combined rate, maybe disable/hide individual UI displays
        // For now, just display defaults or current values
        const fireRiskEl = document.getElementById('fireRisk');
        const insectRiskEl = document.getElementById('insectRisk');
        const diseaseRiskEl = document.getElementById('diseaseRisk');
        if (fireRiskEl) fireRiskEl.textContent = riskFactors.fire + '%';
        if (insectRiskEl) insectRiskEl.textContent = riskFactors.insect + '%';
        if (diseaseRiskEl) diseaseRiskEl.textContent = riskFactors.disease + '%';
    }
    
    // --- Green Cover Calculation ---
    function updateGreenCoverMetrics() {
        // Get initial green cover and total area
        const initialGreenCover = parseFloat(initialGreenCoverInput?.value) || 0;
        const projectAreaInput = document.getElementById('projectArea');
        const totalAreaInput = document.getElementById('totalGeographicalArea');
        
        // Use project area as total area if total area input is empty or invalid
        let totalArea = parseFloat(totalAreaInput?.value);
        if (isNaN(totalArea) || totalArea <= 0) {
            totalArea = parseFloat(projectAreaInput?.value) || 0;
            if (totalArea > 0 && totalAreaInput) {
                 totalAreaInput.value = totalArea; // Auto-populate if using project area
            }
        }

        // Get project area and survival rate
        const projectArea = parseFloat(projectAreaInput?.value) || 0;
        const survivalRateInput = document.getElementById('survivalRate');
        const survivalRate = (parseFloat(survivalRateInput?.value) / 100) || 0.9; // Default 90% if not set

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
    }
    
    // --- Dead Attribute Management ---
    // Update dead attribute based on slider
    if (deadAttributeSlider) {
        // Set initial display value
        if(deadAttributeValue) deadAttributeValue.textContent = deadAttributePercentage + '%';
        deadAttributeSlider.value = deadAttributePercentage; // Ensure slider matches default
        
        deadAttributeSlider.addEventListener('input', function() {
            deadAttributePercentage = parseInt(this.value);
            if(deadAttributeValue) deadAttributeValue.textContent = deadAttributePercentage + '%';
            
            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
    }
    
    // --- Carbon Price Management ---
    // Handle carbon price changes
    if (carbonPriceSelect) {
        // Set initial state for custom price container
        if (customCarbonPriceContainer) {
            customCarbonPriceContainer.style.display = carbonPriceSelect.value === 'custom' ? 'block' : 'none';
        }
        
        carbonPriceSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                if (customCarbonPriceContainer) customCarbonPriceContainer.style.display = 'block';
                carbonPrice = parseFloat(customCarbonPriceInput?.value) || 5;
            } else {
                if (customCarbonPriceContainer) customCarbonPriceContainer.style.display = 'none';
                carbonPrice = parseFloat(this.value);
            }
            
            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
    }
    
    if (customCarbonPriceInput) {
        customCarbonPriceInput.addEventListener('input', function() {
            carbonPrice = parseFloat(this.value) || 5;
            
            // If results already calculated, update calculations
            if (lastCalculationResults) {
                updateCarbonCreditsCalculation(lastCalculationResults);
            }
        });
    }
    
    // Add listeners for green cover inputs
    if (initialGreenCoverInput) {
        initialGreenCoverInput.addEventListener('input', updateGreenCoverMetrics);
    }
    
    if (totalGeographicalAreaInput) {
        totalGeographicalAreaInput.addEventListener('input', updateGreenCoverMetrics);
    }
    
    // Also update green cover if project area or survival rate changes
    const projectAreaInputForGC = document.getElementById('projectArea');
    if (projectAreaInputForGC) projectAreaInputForGC.addEventListener('input', updateGreenCoverMetrics);
    const survivalRateInputForGC = document.getElementById('survivalRate');
    if (survivalRateInputForGC) survivalRateInputForGC.addEventListener('input', updateGreenCoverMetrics);

    // Store last calculation results for updates
    let lastCalculationResults = null;
    
    // --- Enhanced Calculation with Risk and Dead Attribute ---
    // Modify the existing calculation function to include risk factors and dead attribute
    function updateCarbonCreditsCalculation(results) {
        // Store results for potential updates
        lastCalculationResults = results;
        
        if (!results || !results.length) {
             // Reset displays if no results
             const totalVERsEl = document.getElementById('totalVERs');
             if (totalVERsEl) totalVERsEl.textContent = '0.00';
             const revenueGeneratedEl = document.getElementById('revenueGenerated');
             if (revenueGeneratedEl) revenueGeneratedEl.textContent = '$0.00';
             const carbonRevenueEl = document.getElementById('carbonRevenue');
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
        const finalCumulativeCO2e = parseFloat(results[results.length - 1].cumulativeNetCO2e);
        
        // Get current dead attribute percentage value (could come from Excel or UI slider)
        const currentDeadAttributePercentage = (speciesData && speciesData.length > 0 && speciesData[0]['Dead Attribute (%)'] !== undefined)
            ? parseFloat(speciesData[0]['Dead Attribute (%)'])
            : deadAttributePercentage; // Use slider value if no Excel data
        
        // Calculate VERs with dead attribute adjustment
        const deadAttributeAmount = finalCumulativeCO2e * (currentDeadAttributePercentage / 100);
        const totalVERs = Math.max(0, finalCumulativeCO2e - deadAttributeAmount);
        
        // Get the current carbon price
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
        
        // Also update the main CO2e sequestration display
        const totalNetCO2eEl = document.getElementById('totalNetCO2e');
        if (totalNetCO2eEl) totalNetCO2eEl.textContent = finalCumulativeCO2e.toFixed(2) + ' tCO₂e';
        
        // Remove CERs display if it exists (or ensure it's hidden/removed in HTML)
        const totalCERsEl = document.getElementById('totalCERs');
        if (totalCERsEl) {
             const cerItem = totalCERsEl.closest('.species-factor-item');
             if (cerItem) cerItem.style.display = 'none'; // Hide the whole item
        }

        const revenueGeneratedEl = document.getElementById('revenueGenerated');
        if (revenueGeneratedEl) revenueGeneratedEl.textContent = '$' + totalRevenue.toFixed(2);
        
        const carbonRevenueEl = document.getElementById('carbonRevenue');
        if (carbonRevenueEl) carbonRevenueEl.textContent = '$' + totalRevenue.toFixed(2);
        
        // Update afforestation metrics
        const inputs = getAndValidateForestInputs(); // Assumes this function exists and works
        if (inputs) {
            const areaPlantedEl = document.getElementById('areaPlanted');
            if (areaPlantedEl) areaPlantedEl.textContent = inputs.projectArea.toFixed(2);
            
            const numberOfTreesEl = document.getElementById('numberOfTrees');
            if (numberOfTreesEl) numberOfTreesEl.textContent = Math.round(inputs.projectArea * inputs.plantingDensity).toLocaleString();
            
            const survivalRateDisplayEl = document.getElementById('survivalRateDisplay');
            if (survivalRateDisplayEl) {
                 // Update the display value based on the input field, not just the calculated value
                 const survivalRateInputVal = parseFloat(document.getElementById('survivalRate')?.value);
                 if (!isNaN(survivalRateInputVal)) {
                     survivalRateDisplayEl.textContent = survivalRateInputVal.toFixed(1);
                 } else {
                     survivalRateDisplayEl.textContent = (inputs.survivalRate * 100).toFixed(1);
                 }
            }
            
            // Update green cover metrics explicitly here after results are calculated
            updateGreenCoverMetrics();
            
            // Get final ecosystem maturity from last year result (assuming this is tracked somewhere)
            const finalEcosystemMaturity = results[results.length - 1].ecosystemMaturity || 
                                           Math.min(100, Math.round((inputs.projectDuration / 20) * 100)); // Fallback calculation
                                           
            const ecosystemMaturityEl = document.getElementById('ecosystemMaturity');
            if (ecosystemMaturityEl) ecosystemMaturityEl.textContent = finalEcosystemMaturity;
            
            const ecosystemProgressEl = document.querySelector('.ecosystem-maturity-progress');
            if (ecosystemProgressEl) ecosystemProgressEl.style.width = finalEcosystemMaturity + '%';
        }
        
        // Update risk factors display
        updateRiskFactorDisplays();
    }
    
    // Initialize risk factors display on load
    updateRiskFactorDisplays();
    
    // Initialize green cover metrics on load
    updateGreenCoverMetrics();
    
    // Return functions that need to be accessed by the main calculator
    return {
        updateCarbonCreditsCalculation,
        updateGreenCoverMetrics,
        getTotalRiskRate
    };
}