// script.js

// Wait for the DOM to be fully loaded before running script
document.addEventListener('DOMContentLoaded', () => {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.innerHTML = 'Required Chart.js library failed to load. Please refresh the page or check your internet connection.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    // Ensure jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF is not loaded');
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.innerHTML = 'Required jsPDF library failed to load. Please refresh the page or check your internet connection.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    // --- DOM Element References ---
    const form = document.getElementById('calculatorForm');
    const resultsSection = document.getElementById('resultsSection');
    const resultsBody = document.getElementById('resultsBody');
    const calculateBtn = document.getElementById('calculateBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const errorMessageDiv = document.getElementById('errorMessage');
    const sequestrationChartCanvas = document.getElementById('sequestrationChart');
    let sequestrationChart = null; // To hold the chart instance

    // Input field references for validation feedback
    const projectAreaInput = document.getElementById('projectArea');
    const plantingDensityInput = document.getElementById('plantingDensity');
    const projectDurationInput = document.getElementById('projectDuration');
    const baselineRateInput = document.getElementById('baselineRate');
    const speciesInput = document.getElementById('species');
    const conversionInputs = document.querySelectorAll('.factor-container input');
    const resetButtons = document.querySelectorAll('.reset-btn');
    const projectCostInput = document.getElementById('projectCost');
    const costPerTonneElement = document.getElementById('costPerTonne');
    const totalProjectCostElement = document.getElementById('totalProjectCost');

    const inputs = [projectAreaInput, plantingDensityInput, projectDurationInput, baselineRateInput, speciesInput, ...conversionInputs];


    // --- Constants & Configuration ---
    const C_TO_CO2 = 44 / 12;
    const MIN_DURATION = 4; // Changed from 5 to 4
    const MAX_DURATION = 50;
    const MIN_DENSITY = 100;

    // --- Growth Data Function ---
    function getApproxMAI(species, age) {
        // Deprecated: replaced by calculateAnnualIncrement for realism
        return 0;
    }

    // --- NEW: More Realistic Growth Function (Sigmoid-like) ---
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

    // --- Input Validation Function ---
    function validateInput(inputElement, min, max, name) {
        const value = parseFloat(inputElement.value);
        let error = null;

        if (isNaN(value)) {
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

    // --- Get & Validate All Inputs ---
    function getAndValidateInputs() {
        clearAllErrors();
        let errors = [];
        let validationError = null;

        validationError = validateInput(projectAreaInput, 0.1, null, 'Project Area');
        if (validationError) errors.push(validationError);

        validationError = validateInput(plantingDensityInput, MIN_DENSITY, null, 'Planting Density');
        if (validationError) errors.push(validationError);

        validationError = validateInput(projectDurationInput, MIN_DURATION, MAX_DURATION, 'Project Duration');
        if (validationError) errors.push(validationError);

        if (isNaN(parseFloat(baselineRateInput.value))) {
            errors.push('Baseline Rate must be a number.');
            baselineRateInput.classList.add('input-error');
        } else {
            baselineRateInput.classList.remove('input-error');
        }

        // Validate conversion factors
        conversionInputs.forEach(input => {
            validationError = validateInput(input, 0, null, input.previousElementSibling.textContent);
            if (validationError) errors.push(validationError);
        });

        if (errors.length > 0) {
            showError(errors.join('<br>'));
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
            carbonFraction: parseFloat(document.getElementById('carbonFraction').value)
        };
    }

    // --- Error Handling Functions ---
    function showError(message) {
        errorMessageDiv.innerHTML = message;
        errorMessageDiv.classList.remove('hidden');
    }

    function clearAllErrors() {
        errorMessageDiv.innerHTML = '';
        errorMessageDiv.classList.add('hidden');
        inputs.forEach(input => input.classList.remove('input-error'));
    }

    // --- Calculation Function ---
    function calculateSequestration(inputs) {
        let cumulativeNetCO2e = 0;
        const annualResults = [];
        const totalAnnualBaselineEmissions = inputs.baselineRatePerHa * inputs.projectArea;
        const growthParams = {
            peakMAI: getPeakMAIFromDropdown(inputs.species),
            ageAtPeakMAI: getAgeAtPeakMAI(null, inputs.species)
        };
        for (let year = 1; year <= inputs.projectDuration; year++) {
            const standAge = year;
            const annualVolumeIncrementPerHa = calculateAnnualIncrement(growthParams, standAge, inputs.projectDuration);
            const stemBiomassIncrement = annualVolumeIncrementPerHa * inputs.woodDensity;
            const abovegroundBiomassIncrement = stemBiomassIncrement * inputs.bef;
            const belowgroundBiomassIncrement = abovegroundBiomassIncrement * inputs.rsr;
            const totalBiomassIncrement = abovegroundBiomassIncrement + belowgroundBiomassIncrement;
            const carbonIncrement = totalBiomassIncrement * inputs.carbonFraction;
            const grossAnnualCO2ePerHa = carbonIncrement * C_TO_CO2;
            const grossAnnualCO2eTotal = grossAnnualCO2ePerHa * inputs.projectArea;
            const netAnnualCO2eTotal = grossAnnualCO2eTotal - totalAnnualBaselineEmissions;
            cumulativeNetCO2e += netAnnualCO2eTotal;
            annualResults.push({
                year: year,
                age: standAge,
                volumeIncrement: annualVolumeIncrementPerHa.toFixed(2),
                netAnnualCO2e: netAnnualCO2eTotal.toFixed(2),
                cumulativeNetCO2e: cumulativeNetCO2e.toFixed(2)
            });
        }
        return annualResults;
    }

    // --- Cost Analysis Function ---
    function calculateCostAnalysis(results, totalCost) {
        try {
            if (!results || !results.length) {
                throw new Error('No results available for cost analysis');
            }

            const finalCumulativeCO2e = parseFloat(results[results.length - 1].cumulativeNetCO2e);
            if (isNaN(finalCumulativeCO2e) || finalCumulativeCO2e <= 0) {
                throw new Error('Invalid cumulative CO2e value');
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
            showError("An error occurred during cost analysis calculations. Please check your inputs.");
            throw error; // Re-throw to be caught by the main error handler
        }
    }

    // --- DOM Update Functions ---
    function updateTable(results) {
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

    function updateChart(results) {
        try {
            if (!window.Chart) {
                throw new Error('Chart.js library is not loaded');
            }

            const chartLabels = results.map(r => `Year ${r.year}`);
            const chartData = results.map(r => parseFloat(r.cumulativeNetCO2e));

            const ctx = sequestrationChartCanvas.getContext('2d');
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

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
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#059669',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#059669',
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
                        padding: {
                            top: 20,
                            right: 25,
                            bottom: 20,
                            left: 25
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                lineWidth: 1
                            },
                            border: {
                                dash: [4, 4]
                            },
                            ticks: { 
                                padding: 10,
                                color: '#4b5563',
                                font: {
                                    size: 11,
                                    family: "'Inter', sans-serif"
                                },
                                callback: function(value) {
                                    return value.toLocaleString() + ' tCO₂e';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: { 
                                padding: 8,
                                color: '#4b5563',
                                font: {
                                    size: 11,
                                    family: "'Inter', sans-serif"
                                },
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'center',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                color: '#1f2937',
                                font: {
                                    size: 12,
                                    family: "'Inter', sans-serif",
                                    weight: '500'
                                }
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(17, 24, 39, 0.8)',
                            titleFont: {
                                size: 13,
                                family: "'Inter', sans-serif",
                                weight: '600'
                            },
                            bodyFont: {
                                size: 12,
                                family: "'Inter', sans-serif"
                            },
                            padding: 12,
                            cornerRadius: 6,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return `${context.parsed.y.toLocaleString()} tCO₂e sequestered`;
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        } catch (error) {
            console.error("Chart creation error:", error);
            return;
        }
    }

    function displayResults(results) {
        try {
            updateTable(results.totalResults);
            
            // Clear any existing charts first
            const existingCharts = document.querySelectorAll('.species-chart-card');
            existingCharts.forEach(chart => chart.remove());
            
            // Update main cumulative chart
            updateChart(results.totalResults);
            
            // Create container for species charts if it doesn't exist
            let chartsContainer = document.querySelector('.species-charts-container');
            if (!chartsContainer) {
                chartsContainer = document.createElement('div');
                chartsContainer.className = 'species-charts-container';
                document.getElementById('sequestrationChart').parentElement.insertAdjacentElement('afterend', chartsContainer);
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
                                title: {
                                    display: true,
                                    text: 'tCO₂e'
                                }
                            }
                        }
                    }
                });
            });
            
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error("Error displaying results:", error);
            showError("An error occurred while displaying the results.");
        }
    }

    // --- Form Submission Handler ---
    function handleFormSubmit(event) {
        event.preventDefault();
        calculateBtn.disabled = true;
        calculateBtn.classList.add('calculating');
        resultsSection.classList.add('hidden');
        clearAllErrors();

        setTimeout(() => {
            try {
                const inputs = getAndValidateInputs();
                
                if (!inputs) {
                    throw new Error('Input validation failed');
                }

                if (!inputs.species && !speciesData.length) {
                    throw new Error('No species selected and no species data uploaded');
                }

                const results = speciesData.length > 0 ? 
                    calculateSequestrationMultiSpecies(inputs) : 
                    { totalResults: calculateSequestration(inputs), speciesResults: [] };

                if (!results || !results.totalResults || !results.totalResults.length) {
                    throw new Error('Calculation produced no results');
                }

                displayResults(results);
                
                const totalCost = parseNumberWithCommas(projectCostInput.value);
                calculateCostAnalysis(results.totalResults, totalCost);
            } catch (error) {
                console.error("Calculation Error:", error);
                showError(error.message || "An error occurred during calculation. Please check your inputs and try again.");
                resultsSection.classList.add('hidden');
            } finally {
                calculateBtn.disabled = false;
                calculateBtn.classList.remove('calculating');
            }
        }, 50);
    }

    // --- Reset Button Handlers ---
    resetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const inputId = btn.getAttribute('data-for');
            const input = document.getElementById(inputId);
            const defaultValue = input.getAttribute('data-default');
            input.value = defaultValue;
            input.classList.add('highlight');
            setTimeout(() => input.classList.remove('highlight'), 500);
        });
    });

    // --- Input Event Handlers ---
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            errorMessageDiv.classList.add('hidden');
        });
    });

    // Add input handler for project cost
    projectCostInput.addEventListener('input', (e) => {
        // First, get the value and remove any non-numeric characters except commas
        let value = e.target.value.replace(/[^\d,]/g, '');
        
        // Remove any commas
        value = value.replace(/,/g, '');
        
        // Format with commas for thousands if there's a value
        if (value) {
            value = parseInt(value).toLocaleString('en-IN');
        }
        
        e.target.value = value;
    });

    // Function to parse number string with commas
    function parseNumberWithCommas(str) {
        return parseFloat(str.replace(/,/g, '')) || 0;
    }

    // --- Tooltip Positioning ---
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.hasAttribute('title')) {
            // Create and position the tooltip on hover
            const tooltipContent = target.getAttribute('title');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipContent;
            tooltip.style.maxWidth = '300px'; // Limit tooltip width
            tooltip.style.wordWrap = 'break-word'; // Enable word wrapping
            document.body.appendChild(tooltip);

            // Position the tooltip
            const rect = target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate initial position (centered above element)
            let top = rect.top - tooltipRect.height - 10;
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

            // Adjust horizontal position if tooltip would go outside viewport
            if (left + tooltipRect.width > viewportWidth) {
                left = viewportWidth - tooltipRect.width - 10;
            }
            if (left < 10) {
                left = 10;
            }

            // If tooltip would go above viewport, position it below the element
            if (top < 10) {
                top = rect.bottom + 10;
                // If it would also go below viewport, position it where there's more space
                if (top + tooltipRect.height > viewportHeight - 10) {
                    if (rect.top > (viewportHeight - rect.bottom)) {
                        top = rect.top - tooltipRect.height - 10;
                    }
                }
            }

            tooltip.style.top = `${Math.max(10, top)}px`;
            tooltip.style.left = `${left}px`;
            
            // Store the tooltip element
            target.tooltip = tooltip;
            
            // Temporarily remove title to prevent default browser tooltip
            target._title = target.getAttribute('title');
            target.removeAttribute('title');
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (target._title) {
            // Remove the tooltip and restore the title
            if (target.tooltip) {
                target.tooltip.remove();
                target.tooltip = null;
            }
            target.setAttribute('title', target._title);
            target._title = null;
        }
    });

    // Tooltip functionality
    function createTooltip(element) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = element.getAttribute('title');
        document.body.appendChild(tooltip);
        element.removeAttribute('title');
        return tooltip;
    }

    function positionTooltip(tooltip, element, position = 'top') {
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

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.dataset.position = position;
    }

    // Initialize tooltips
    document.addEventListener('DOMContentLoaded', () => {
        const elements = document.querySelectorAll('[title]');
        
        elements.forEach(element => {
            let tooltip = null;
            let timeoutId = null;

            element.addEventListener('mouseenter', () => {
                tooltip = createTooltip(element);
                tooltip.classList.add('active');
                positionTooltip(tooltip, element);
            });

            element.addEventListener('mouseleave', () => {
                if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                }
            });

            element.addEventListener('mousemove', (e) => {
                if (tooltip && timeoutId === null) {
                    timeoutId = setTimeout(() => {
                        positionTooltip(tooltip, element);
                        timeoutId = null;
                    }, 100); // Throttle positioning updates
                }
            });
        });
    });

    // --- Event Listener ---
    form.addEventListener('submit', handleFormSubmit);

    let speciesData = []; // Will store parsed Excel data

    document.getElementById('speciesFile').addEventListener('change', function(event) {
        const file = event.target.files[0];
        
        // Clear any previous error messages
        clearAllErrors();
        
        // File validation
        if (!file) return;
        
        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showError('File size exceeds 5MB limit');
            event.target.value = ''; // Clear the file input
            return;
        }

        // Check file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!validTypes.includes(file.type)) {
            showError('Please upload a valid Excel file (.xlsx or .xls)');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                // Clear previous species data
                speciesData = [];
                
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Extract and validate data
                const rawData = XLSX.utils.sheet_to_json(firstSheet, {
                    raw: true,
                    defval: null,
                    header: [
                        'Species Name',
                        'Number of Trees',
                        'Growth Rate (m³/ha/yr)',
                        'Wood Density (tdm/m³)',
                        'BEF',
                        'Root-Shoot Ratio',
                        'Carbon Fraction'
                    ]
                });

                // Validate required columns
                if (rawData.length === 0) {
                    throw new Error('No data found in the Excel file');
                }

                const requiredColumns = ['Species Name', 'Number of Trees', 'Growth Rate (m³/ha/yr)'];
                const firstRow = rawData[0];
                const missingColumns = requiredColumns.filter(col => firstRow[col] === null);
                
                if (missingColumns.length > 0) {
                    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
                }

                // Validate and process each row
                speciesData = rawData.filter(row => {
                    // Basic data validation
                    if (!row['Species Name'] || row['Species Name'].trim() === '') return false;
                    if (isNaN(parseFloat(row['Number of Trees'])) || parseFloat(row['Number of Trees']) <= 0) return false;
                    if (isNaN(parseFloat(row['Growth Rate (m³/ha/yr)'])) || parseFloat(row['Growth Rate (m³/ha/yr)']) <= 0) return false;

                    // Convert string values to numbers where needed
                    row['Number of Trees'] = parseFloat(row['Number of Trees']);
                    row['Growth Rate (m³/ha/yr)'] = parseFloat(row['Growth Rate (m³/ha/yr)']);
                    
                    // Set default value for Carbon Fraction if not provided or invalid
                    row['Carbon Fraction'] = row['Carbon Fraction'] && !isNaN(parseFloat(row['Carbon Fraction'])) ? 
                        parseFloat(row['Carbon Fraction']) : 0.47; // Default value of 0.47 as per IPCC guidelines

                    // Parse other conversion factors
                    if (row['Wood Density (tdm/m³)']) row['Wood Density (tdm/m³)'] = parseFloat(row['Wood Density (tdm/m³)']);
                    if (row['BEF']) row['BEF'] = parseFloat(row['BEF']);
                    if (row['Root-Shoot Ratio']) row['Root-Shoot Ratio'] = parseFloat(row['Root-Shoot Ratio']);

                    return true;
                });

                if (speciesData.length === 0) {
                    throw new Error('No valid data rows found in the Excel file');
                }

                // Update conversion factors from the first valid row that has them
                updateConversionFactors(speciesData[0]);
                
                // Display the processed data
                displaySpeciesList();
                
            } catch (error) {
                console.error('Error processing Excel file:', error);
                showError(`Error processing Excel file: ${error.message}`);
                event.target.value = ''; // Clear the file input
            }
        };

        reader.onerror = function() {
            showError('Error reading the file');
            event.target.value = '';
        };

        reader.readAsArrayBuffer(file);
    });

    // Update displaySpeciesList function to handle decimal points
    function displaySpeciesList() {
        const speciesList = document.getElementById('speciesList');
        if (!speciesData.length) {
            speciesList.innerHTML = '';
            return;
        }

        const table = document.createElement('table');
        table.className = 'species-list-table';
        
        // Create table header with updated columns
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const columns = [
            'Species Name',
            'Number of Trees',
            'Growth Rate (m³/ha/yr)',
            'Wood Density (tdm/m³)',
            'BEF',
            'Root-Shoot Ratio'
        ];
        
        columns.forEach(column => {
            const th = document.createElement('th');
            th.innerHTML = `<div class="column-header">
                <span class="data-point"></span>
                ${column}
            </div>`;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body with formatted numbers
        const tbody = document.createElement('tbody');
        speciesData.forEach(species => {
            const row = document.createElement('tr');
            columns.forEach(column => {
                const td = document.createElement('td');
                const value = species[column];
                if (column === 'Species Name') {
                    td.textContent = value || '';
                } else {
                    td.className = 'number-cell';
                    td.textContent = value !== null && !isNaN(value) 
                        ? parseFloat(value).toLocaleString('en-IN', {
                            maximumFractionDigits: 3,
                            minimumFractionDigits: 3
                        })
                        : '';
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        // Create and display conversion factors for each species
        const factorsContainer = document.createElement('div');
        factorsContainer.className = 'conversion-factors-grid';

        speciesData.forEach(species => {
            const factorCard = document.createElement('div');
            factorCard.className = 'species-factors';
            factorCard.innerHTML = `
                <div class="species-factors-title">${species['Species Name']} - Conversion Factors</div>
                <div class="species-factor-item">
                    <span class="species-factor-label">Wood Density:</span>
                    <span class="species-factor-value">${species['Wood Density (tdm/m³)'] ? species['Wood Density (tdm/m³)'].toFixed(3) : 'N/A'}</span>
                </div>
                <div class="species-factor-item">
                    <span class="species-factor-label">BEF:</span>
                    <span class="species-factor-value">${species['BEF'] ? species['BEF'].toFixed(3) : 'N/A'}</span>
                </div>
                <div class="species-factor-item">
                    <span class="species-factor-label">Root-Shoot Ratio:</span>
                    <span class="species-factor-value">${species['Root-Shoot Ratio'] ? species['Root-Shoot Ratio'].toFixed(3) : 'N/A'}</span>
                </div>
            `;
            factorsContainer.appendChild(factorCard);
        });

        speciesList.innerHTML = '';
        speciesList.appendChild(table);
        speciesList.appendChild(factorsContainer);
    }

    // Modify the calculateSequestration function to handle multiple species
    function calculateSequestrationMultiSpecies(inputs) {
        const results = {
            speciesResults: [],
            totalResults: Array(inputs.projectDuration).fill(null).map((_, i) => ({
                year: i + 1,
                age: i + 1,
                volumeIncrement: 0,
                grossAnnualCO2e: 0,
                netAnnualCO2e: 0,
                cumulativeNetCO2e: 0
            }))
        };
        const totalAnnualBaselineEmissions = inputs.baselineRatePerHa * inputs.projectArea;
        speciesData.forEach(species => {
            const speciesInputs = {
                ...inputs,
                speciesName: species['Species Name'],
                numTrees: species['Number of Trees'],
                growthRate: species['Growth Rate (m³/ha/yr)'],
                woodDensity: species['Wood Density (tdm/m³)'] || inputs.woodDensity,
                bef: species['BEF'] || inputs.bef,
                rsr: species['Root-Shoot Ratio'] || inputs.rsr,
                carbonFraction: species['Carbon Fraction'] || inputs.carbonFraction
            };
            const speciesAnnualResults = calculateSpeciesSequestration(speciesInputs);
            results.speciesResults.push({
                speciesName: species['Species Name'],
                results: speciesAnnualResults,
                conversionFactors: {}
            });
            speciesAnnualResults.forEach((yearResult, index) => {
                results.totalResults[index].volumeIncrement += parseFloat(yearResult.volumeIncrement);
                results.totalResults[index].grossAnnualCO2e += parseFloat(yearResult.grossAnnualCO2e);
            });
        });
        let cumulativeNet = 0;
        results.totalResults.forEach((totalYearResult, index) => {
            totalYearResult.netAnnualCO2e = totalYearResult.grossAnnualCO2e - totalAnnualBaselineEmissions;
            cumulativeNet += totalYearResult.netAnnualCO2e;
            totalYearResult.cumulativeNetCO2e = cumulativeNet;
            totalYearResult.volumeIncrement = totalYearResult.volumeIncrement.toFixed(2);
            totalYearResult.grossAnnualCO2e = totalYearResult.grossAnnualCO2e.toFixed(2);
            totalYearResult.netAnnualCO2e = totalYearResult.netAnnualCO2e.toFixed(2);
            totalYearResult.cumulativeNetCO2e = totalYearResult.cumulativeNetCO2e.toFixed(2);
            totalYearResult.age = totalYearResult.year;
        });
        results.speciesResults.forEach(sr => {
            let cumulativeSpeciesNet = 0;
            sr.results.forEach((yearResult, index) => {
                yearResult.cumulativeNetCO2e = (index === 0 ? 0 : parseFloat(sr.results[index - 1].cumulativeNetCO2e)) + parseFloat(yearResult.grossAnnualCO2e);
                yearResult.cumulativeNetCO2e = yearResult.cumulativeNetCO2e.toFixed(2);
                yearResult.netAnnualCO2e = parseFloat(yearResult.grossAnnualCO2e).toFixed(2);
            });
        });
        return results;
    }

    // Function to calculate sequestration for a single species
    function calculateSpeciesSequestration(inputs) {
        let cumulativeNetCO2e = 0;
        const annualResults = [];
        const totalAnnualBaselineEmissions = inputs.baselineRatePerHa * inputs.projectArea;
        const speciesBaselineShare = totalAnnualBaselineEmissions / speciesData.length;
        const treesPerHectare = inputs.numTrees / inputs.projectArea;
        const densityRatio = treesPerHectare / inputs.plantingDensity;
        const woodDensity = inputs.woodDensity || parseFloat(document.getElementById('woodDensity').value);
        const bef = inputs.bef || parseFloat(document.getElementById('bef').value);
        const rsr = inputs.rsr || parseFloat(document.getElementById('rsr').value);
        const carbonFraction = inputs.carbonFraction || parseFloat(document.getElementById('carbonFraction').value);
        const growthParams = {
            peakMAI: inputs.growthRate,
            ageAtPeakMAI: getAgeAtPeakMAI(inputs.speciesName)
        };
        for (let year = 1; year <= inputs.projectDuration; year++) {
            const standAge = year;
            const annualVolumeIncrementPerHa = calculateAnnualIncrement(growthParams, standAge, inputs.projectDuration);
            const stemBiomassIncrement = annualVolumeIncrementPerHa * woodDensity;
            const abovegroundBiomassIncrement = stemBiomassIncrement * bef;
            const belowgroundBiomassIncrement = abovegroundBiomassIncrement * rsr;
            const totalBiomassIncrement = abovegroundBiomassIncrement + belowgroundBiomassIncrement;
            const carbonIncrement = totalBiomassIncrement * carbonFraction;
            const grossAnnualCO2ePerHa = carbonIncrement * C_TO_CO2;
            const speciesAreaFraction = inputs.numTrees / (inputs.plantingDensity * inputs.projectArea);
            const grossAnnualCO2eTotalForSpecies = grossAnnualCO2ePerHa * inputs.projectArea * speciesAreaFraction;
            const grossAnnualCO2eTotal_Unscaled = grossAnnualCO2ePerHa * inputs.projectArea;
            cumulativeNetCO2e += grossAnnualCO2eTotal_Unscaled;
            annualResults.push({
                year: year,
                age: standAge,
                volumeIncrement: annualVolumeIncrementPerHa.toFixed(2),
                grossAnnualCO2e: grossAnnualCO2eTotal_Unscaled,
                netAnnualCO2e: 'N/A',
                cumulativeNetCO2e: 'N/A'
            });
        }

        return annualResults;
    }

    // Helper function to generate random colors for charts
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Add the updateConversionFactors function
    function updateConversionFactors(speciesData) {
        if (speciesData['Wood Density (tdm/m³)'] && !isNaN(parseFloat(speciesData['Wood Density (tdm/m³)']))) {
            document.getElementById('woodDensity').value = parseFloat(speciesData['Wood Density (tdm/m³)']).toFixed(3);
        }
        if (speciesData['BEF'] && !isNaN(parseFloat(speciesData['BEF']))) {
            document.getElementById('bef').value = parseFloat(speciesData['BEF']).toFixed(3);
        }
        if (speciesData['Root-Shoot Ratio'] && !isNaN(parseFloat(speciesData['Root-Shoot Ratio']))) {
            document.getElementById('rsr').value = parseFloat(speciesData['Root-Shoot Ratio']).toFixed(3);
        }
        if (speciesData['Carbon Fraction'] && !isNaN(parseFloat(speciesData['Carbon Fraction']))) {
            document.getElementById('carbonFraction').value = parseFloat(speciesData['Carbon Fraction']).toFixed(3);
        }
    }

    // Update the PDF generation functionality
    const printPdfBtn = document.getElementById('printPdfBtn');
    if (printPdfBtn) {
        printPdfBtn.addEventListener('click', async () => {
            const resultsSection = document.getElementById('resultsSection');
            if (!resultsSection || resultsSection.classList.contains('hidden')) {
                alert('No results to print. Please calculate results first.');
                return;
            }

            try {
                // Create a new jsPDF instance with professional formatting
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                // Add header with title - Split into two lines for better readability
                doc.setFillColor(5, 150, 105);
                doc.rect(0, 0, 210, 30, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(20);
                doc.text('Afforestation', 15, 15);
                doc.text('CO₂e Assessment Report', 15, 28);

                // Reset text color for body
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                
                // Add report date and project overview section with improved spacing
                doc.setFontSize(12);
                doc.text('Report Generated:', 15, 45);
                doc.setFont('helvetica', 'bold');
                doc.text(new Date().toLocaleDateString('en-IN', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }), 50, 45);

                // Project Overview Section with adjusted spacing
                doc.setFillColor(240, 240, 240);
                doc.rect(15, 55, 180, 45, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Project Overview', 20, 65);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                // Split project details into separate lines with proper spacing
                doc.text([
                    `Project Area: ${document.getElementById('projectArea').value} hectares`,
                    `Project Duration: ${document.getElementById('projectDuration').value} years`,
                    `Planting Density: ${document.getElementById('plantingDensity').value} trees/hectare`
                ], 25, 75, { lineHeightFactor: 1.5 });

                // Results Summary Section with improved spacing
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text([
                    'Sequestration',
                    'Results Summary'
                ], 15, 115, { lineHeightFactor: 1.5 });
                
                // Add summary metrics in a grid with adjusted positioning
                const totalSeq = document.getElementById('totalSequestration').textContent;
                const totalCost = document.getElementById('totalProjectCost').textContent;
                const costPerTonne = document.getElementById('costPerTonne').textContent;
                
                // Create metric boxes with improved formatting and multi-line text
                function addMetricBox(title, value, unit, x, y) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(x, y, 85, 30, 'F');
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(x, y, 85, 30, 'S');
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    // Split title into multiple lines if needed
                    const titleLines = doc.splitTextToSize(title, 75);
                    titleLines.forEach((line, index) => {
                        doc.text(line, x + 5, y + 7 + (index * 5));
                    });
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text(value, x + 5, y + 20);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.text(unit, x + 5, y + 27);
                }

                // Adjust vertical positioning for metric boxes
                addMetricBox('Total Carbon\nSequestered', totalSeq.split(' ')[0], 'tCO₂e', 15, 125);
                addMetricBox('Total Project\nCost', totalCost, 'INR', 110, 125);
                addMetricBox('Cost per\ntCO₂e', costPerTonne, 'INR/tCO₂e', 15, 165);

                // Chart section with improved header spacing
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text([
                    'Total Sequestration',
                    'Trajectory'
                ], 15, 210, { lineHeightFactor: 1.5 });
                
                const chart = document.getElementById('sequestrationChart');
                if (chart) {
                    const chartImg = chart.toDataURL('image/png');
                    doc.addImage(chartImg, 'PNG', 15, 220, 180, 90);
                }

                // Add species-specific charts if available
                const speciesCharts = document.querySelectorAll('.species-chart-card canvas');
                if (speciesCharts.length > 0) {
                    doc.addPage();
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(14);
                    doc.text('Species-Specific Sequestration Trajectories', 15, 20);

                    let yPos = 30;
                    speciesCharts.forEach((speciesChart, index) => {
                        const speciesName = speciesChart.closest('.species-chart-card').querySelector('.species-chart-title').textContent;
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(12);
                        doc.text(speciesName, 15, yPos);
                        
                        const chartImg = speciesChart.toDataURL('image/png');
                        doc.addImage(chartImg, 'PNG', 15, yPos + 5, 180, 60);
                        
                        yPos += 75;
                        if (yPos > 250 && index < speciesCharts.length - 1) {
                            doc.addPage();
                            yPos = 20;
                        }
                    });
                }

                // Add detailed results table with improved headers
                doc.addPage();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Detailed Annual Results', 15, 20);
                
                // Improved table headers
                const tableHeaders = [
                    ['Project Year', 30],
                    ['Stand Age', 30],
                    ['Volume Increment (m³/ha/yr)', 40],
                    ['Net Annual CO₂e (tCO₂e)', 40],
                    ['Cumulative CO₂e (tCO₂e)', 40]
                ];

                let y = 30;
                // Draw header background
                doc.setFillColor(5, 150, 105);
                doc.rect(15, y - 5, 180, 8, 'F');
                
                // Add headers with proper spacing
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                let x = 15;
                tableHeaders.forEach(([header, width]) => {
                    doc.text(header, x, y);
                    x += width;
                });

                // Add table data
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                
                const table = document.getElementById('resultsTable');
                if (table) {
                    const rows = Array.from(table.querySelectorAll('tr')).slice(1);
                    y += 8;
                    rows.forEach((row, index) => {
                        if (y > 270) {
                            doc.addPage();
                            y = 20;
                        }
                        
                        // Alternate row backgrounds
                        if (index % 2 === 0) {
                            doc.setFillColor(245, 245, 245);
                            doc.rect(15, y - 5, 180, 7, 'F');
                        }
                        
                        const cells = Array.from(row.cells);
                        x = 15;
                        cells.forEach((cell, cellIndex) => {
                            const value = cell.textContent.trim();
                            // Format numbers with proper decimal places
                            const formattedValue = !isNaN(parseFloat(value)) ? 
                                parseFloat(value).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }) : 
                                value;
                            doc.text(formattedValue, x, y);
                            x += tableHeaders[cellIndex][1];
                        });
                        y += 8;
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
                               'They do not account for leakage, specific site conditions, or mortality.', 15, 287, {
                            maxWidth: 160
                        });
                    }
                }

                // Save the PDF with formatted name
                const dateStr = new Date().toISOString().split('T')[0];
                doc.save(`afforestation-assessment-report-${dateStr}.pdf`);

            } catch (error) {
                console.error('Error generating PDF:', error);
                alert('Error generating PDF. Please try again.');
            }
        });
    }

});