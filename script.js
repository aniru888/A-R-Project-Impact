// script.js

// Wait for the DOM to be fully loaded before running script
document.addEventListener('DOMContentLoaded', () => {

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
    const MIN_DURATION = 5;
    const MAX_DURATION = 50;
    const MIN_DENSITY = 100;

    // --- Growth Data Function ---
    function getApproxMAI(species, age) {
        const maxMAI = {
            'eucalyptus_fast': 25, 'teak_moderate': 12, 'native_slow': 8
        };
        const ageAtMaxMAI = {
            'eucalyptus_fast': 10, 'teak_moderate': 15, 'native_slow': 20
        };
        const currentMaxMAI = maxMAI[species];
        const currentAgeAtMax = ageAtMaxMAI[species];

        if (age <= 0) return 0;
        if (age <= currentAgeAtMax) {
            return (currentMaxMAI / currentAgeAtMax) * age;
        } else {
            const declineRate = currentMaxMAI * 0.8 / (MAX_DURATION - currentAgeAtMax);
            return Math.max(currentMaxMAI - declineRate * (age - currentAgeAtMax), currentMaxMAI * 0.2);
        }
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

        for (let year = 1; year <= inputs.projectDuration; year++) {
            const standAge = year;
            const totalVolumeAtAge = getApproxMAI(inputs.species, standAge) * standAge;
            const totalVolumeAtPrevAge = (standAge > 1) ? getApproxMAI(inputs.species, standAge - 1) * (standAge - 1) : 0;
            const annualVolumeIncrementPerHa = Math.max(0, totalVolumeAtAge - totalVolumeAtPrevAge);

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
        const finalCumulativeCO2e = parseFloat(results[results.length - 1].cumulativeNetCO2e);
        const costPerTonne = totalCost / finalCumulativeCO2e;
        const projectArea = parseFloat(projectAreaInput.value);
        const costPerHectare = totalCost / projectArea;
        const costPerHectarePerTonne = (totalCost / projectArea) / finalCumulativeCO2e;
        
        // Update total sequestration display
        document.getElementById('totalSequestration').textContent = `${finalCumulativeCO2e.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })} tCO₂e`;
        
        // Update cost analysis display with ₹ symbol
        document.getElementById('costPerTonne').textContent = `₹ ${costPerTonne.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })}`;
        document.getElementById('totalProjectCost').textContent = `₹ ${totalCost.toLocaleString('en-IN')}`;
        document.getElementById('costPerHectare').textContent = `₹ ${costPerHectare.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })}`;
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
            })} per tCO₂e<br>
            Cost per Hectare = ₹${totalCost.toLocaleString('en-IN')} ÷ ${projectArea.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })} ha = ₹${costPerHectare.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })} per ha
        `;
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
        const chartLabels = results.map(r => `Year ${r.year}`);
        const chartData = results.map(r => r.cumulativeNetCO2e);

        const ctx = sequestrationChartCanvas.getContext('2d');
        if (sequestrationChart) {
            sequestrationChart.destroy();
        }
        sequestrationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Cumulative Estimated Net CO₂e Sequestered (tCO₂e)',
                    data: chartData,
                    borderColor: 'rgb(5, 150, 105)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.2,
                    fill: true,
                    pointBackgroundColor: 'rgb(5, 150, 105)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(5, 150, 105)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                layout: {
                    padding: {
                        top: 10,
                        right: 20,
                        bottom: 10,
                        left: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { 
                            display: true, 
                            text: 'Cumulative Net tCO₂e',
                            font: { size: 12, weight: 'bold' }
                        },
                        grid: { color: '#e5e7eb' },
                        ticks: { 
                            color: '#374151',
                            precision: 0,
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        title: { 
                            display: true,
                            text: 'Project Year',
                            font: { size: 12, weight: 'bold' }
                        },
                        grid: { display: false },
                        ticks: { 
                            color: '#374151',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, padding: 15, color: '#1f2937' }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        titleFont: { weight: 'bold'},
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 4,
                        displayColors: false
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                }
            }
        });
    }

    function displayResults(results) {
        try {
            updateTable(results);
            updateChart(results);
            resultsSection.classList.remove('hidden');
            // Scroll to results
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
            const inputs = getAndValidateInputs();

            if (inputs) {
                try {
                    const results = calculateSequestration(inputs);
                    displayResults(results);
                    // Calculate and display cost analysis with comma handling
                    const totalCost = parseNumberWithCommas(projectCostInput.value);
                    calculateCostAnalysis(results, totalCost);
                } catch (error) {
                    console.error("Calculation Error:", error);
                    showError("An error occurred during calculation.");
                    resultsSection.classList.add('hidden');
                }
            }

            calculateBtn.disabled = false;
            calculateBtn.classList.remove('calculating');
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
        // Remove any non-numeric characters except commas
        let value = e.target.value.replace(/[^\d,]/g, '');
        // Remove multiple commas
        value = value.replace(/,+/g, ',');
        // Remove commas from start and end
        value = value.replace(/^,|,$/g, '');
        e.target.value = value;
    });

    // Function to parse number string with commas
    function parseNumberWithCommas(str) {
        return parseFloat(str.replace(/,/g, '')) || 0;
    }

    // --- Event Listener ---
    form.addEventListener('submit', handleFormSubmit);

});