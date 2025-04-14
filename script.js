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

    const inputs = [projectAreaInput, plantingDensityInput, projectDurationInput, baselineRateInput, speciesInput];


    // --- Constants & Configuration ---
    const C_TO_CO2 = 44 / 12;
    const MAX_AREA = 20;
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

        validationError = validateInput(projectAreaInput, 0.1, MAX_AREA, 'Project Area');
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
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: { display: true, text: 'Cumulative Net tCO₂e', font: { size: 14 } },
                        grid: { color: '#e5e7eb' },
                        ticks: { color: '#374151', precision: 0 }
                    },
                    x: {
                        title: { display: true, text: 'Project Year', font: { size: 14 } },
                        grid: { display: false },
                        ticks: { color: '#374151' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
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

    // --- Event Listener ---
    form.addEventListener('submit', handleFormSubmit);

});