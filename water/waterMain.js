// Water Calculator Main Module

import { Logger, eventBus } from '../utils.js';
import { analytics } from '../analytics.js';

/**
 * Sets up the water calculator functionality
 * @param {Object} config - Configuration object
 */
export function setupWaterCalculator(config = {}) {
    try {
        const waterCalculator = new WaterCalculatorManager();
        waterCalculator.init();
        return waterCalculator;
    } catch (error) {
        Logger.error('Failed to initialize water calculator', error);
        return null;
    }
}

/**
 * Water Calculator Manager Class
 * Handles all functionality related to the water project calculator
 */
export class WaterCalculatorManager {
    constructor() {
        // State variables
        this.lastCalculatedResults = null;
        
        // Form elements (initialized in init())
        this.form = null;
        this.calculateBtn = null;
        this.resetBtn = null;
        this.btnSpinner = null;
        this.errorMessageDiv = null;
        this.resultsSection = null;
        this.projectCostInput = null;
    }
    
    /**
     * Initialize the water calculator
     */
    init() {
        // Get main elements
        this.form = document.getElementById('waterCalculatorForm');
        this.calculateBtn = document.getElementById('calculateWaterBtn');
        this.resetBtn = document.getElementById('resetWaterBtn');
        this.btnSpinner = document.getElementById('btnSpinnerWater');
        this.errorMessageDiv = document.getElementById('errorMessageWater');
        this.resultsSection = document.getElementById('resultsSectionWater');
        this.projectCostInput = document.getElementById('waterProjectCost');
        
        // Set up event listeners
        if (this.form) {
            this.form.addEventListener('submit', this.handleWaterFormSubmit.bind(this));
        }
        
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', this.resetWaterCalculator.bind(this));
        }
        
        Logger.info('Water calculator initialized');
    }
    
    /**
     * Handle form submission
     * @param {Event} event - Form submission event
     */
    handleWaterFormSubmit(event) {
        // Prevent form submission
        event.preventDefault();
        
        // Show loading state
        this.setCalculatingState(true);
        
        // Clear any previous errors
        this.clearErrors();
        
        try {
            // Get form inputs
            const inputs = this.getFormInputs();
            
            // Validate inputs
            if (!this.validateInputs(inputs)) {
                this.setCalculatingState(false);
                return;
            }
            
            // Calculate water capture
            const results = this.calculateWaterCapture(inputs);
            
            // Track calculation event
            analytics.trackEvent('water_calculation_completed', {
                projectArea: inputs.projectArea,
                projectType: inputs.projectType,
                duration: inputs.projectDuration
            });
            
            // Display results
            this.displayResults(results);
            
            // Show results section
            if (this.resultsSection) {
                this.resultsSection.classList.remove('hidden');
                this.resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
            
        } catch (error) {
            console.error('Water calculation error:', error);
            this.showError(`Error in calculation: ${error.message || 'Unknown error'}`);
        }
        
        // Hide loading state
        this.setCalculatingState(false);
    }
    
    /**
     * Get water calculator inputs from the form
     * @returns {Object} Form input values
     */
    getFormInputs() {
        return {
            projectLocation: document.getElementById('waterProjectLocation')?.value || '',
            projectArea: parseFloat(document.getElementById('waterProjectArea')?.value) || 0,
            projectType: document.getElementById('waterProjectType')?.value || '',
            annualRainfall: parseFloat(document.getElementById('annualRainfall')?.value) || 0,
            runoffCoefficient: parseFloat(document.getElementById('runoffCoefficient')?.value) || 0.8,
            waterDemand: parseFloat(document.getElementById('waterDemand')?.value) || 0,
            projectDuration: parseFloat(document.getElementById('waterProjectDuration')?.value) || 20,
            captureEfficiency: parseFloat(document.getElementById('captureEfficiency')?.value) || 85,
            energySavings: parseFloat(document.getElementById('energySavings')?.value) || 0.5,
            projectCost: this.getCleanedProjectCost()
        };
    }
    
    /**
     * Get cleaned project cost value (removing currency symbols and commas)
     * @returns {number} Cleaned project cost value
     */
    getCleanedProjectCost() {
        if (!this.projectCostInput || !this.projectCostInput.value) {
            return 0;
        }
        
        const rawValue = this.projectCostInput.value;
        const cleanedValue = rawValue.replace(/[^\d.]/g, '');
        return parseFloat(cleanedValue) || 0;
    }
    
    /**
     * Validate form inputs
     * @param {Object} inputs - Form inputs
     * @returns {boolean} Validation result
     */
    validateInputs(inputs) {
        // Check required fields
        if (!inputs.projectArea || inputs.projectArea <= 0) {
            this.showError('Please enter a valid project area');
            return false;
        }
        
        if (!inputs.projectType) {
            this.showError('Please select a project type');
            return false;
        }
        
        if (!inputs.annualRainfall || inputs.annualRainfall <= 0) {
            this.showError('Please enter valid annual rainfall');
            return false;
        }
        
        if (!inputs.projectDuration || inputs.projectDuration < 1 || inputs.projectDuration > 50) {
            this.showError('Project duration must be between 1 and 50 years');
            return false;
        }
        
        if (inputs.runoffCoefficient <= 0 || inputs.runoffCoefficient > 1) {
            this.showError('Runoff coefficient must be between 0 and 1');
            return false;
        }
        
        if (inputs.captureEfficiency <= 0 || inputs.captureEfficiency > 100) {
            this.showError('Capture efficiency must be between 0 and 100%');
            return false;
        }
        
        return true;
    }
    
    /**
     * Calculate water capture based on inputs
     * @param {Object} inputs - Calculator inputs
     * @returns {Object} Calculation results
     */
    calculateWaterCapture(inputs) {
        // Basic water capture calculation
        // Water captured (KL) = Area (ha) * Annual Rainfall (mm) * Runoff Coefficient * Capture Efficiency * 10
        // (Factor of 10 converts ha*mm to kiloliters)
        const captureEfficiencyFraction = inputs.captureEfficiency / 100;
        const annualWaterCaptured = inputs.projectArea * inputs.annualRainfall * inputs.runoffCoefficient * captureEfficiencyFraction * 10;
        
        // Generate results for each year
        const yearlyResults = [];
        let totalCaptured = 0;
        
        for (let year = 1; year <= inputs.projectDuration; year++) {
            totalCaptured += annualWaterCaptured;
            const energySaved = annualWaterCaptured * inputs.energySavings;
            const emissions = energySaved * 0.85; // Approximate CO2e emissions per kWh
            
            yearlyResults.push({
                year,
                waterCaptured: annualWaterCaptured,
                cumulativeWater: totalCaptured, 
                energySaved,
                emissionsReduced: emissions
            });
        }
        
        // Calculate demand coverage if demand is provided
        const demandCoverage = inputs.waterDemand > 0 ? 
            (annualWaterCaptured / inputs.waterDemand * 100) : 0;
        
        // Cost analysis if project cost is provided
        let costAnalysis = null;
        if (inputs.projectCost > 0) {
            costAnalysis = {
                totalProjectCost: inputs.projectCost,
                costPerKiloliter: inputs.projectCost / totalCaptured,
                costPerHectare: inputs.projectCost / inputs.projectArea,
                paybackPeriod: this.calculatePaybackPeriod(inputs.projectCost, annualWaterCaptured)
            };
        }
        
        return {
            inputs,
            summary: {
                totalWaterCaptured: totalCaptured,
                annualWaterCaptured,
                demandCoverage,
                emissionsReduction: yearlyResults[yearlyResults.length - 1].emissionsReduced * inputs.projectDuration
            },
            yearlyResults,
            costAnalysis
        };
    }
    
    /**
     * Calculate payback period in years
     * @param {number} projectCost - Total project cost
     * @param {number} annualWaterCaptured - Annual water captured in KL
     * @returns {number} Payback period in years
     */
    calculatePaybackPeriod(projectCost, annualWaterCaptured) {
        // Simplified calculation assuming water value of ₹15 per KL
        const waterValue = 15; // ₹ per KL
        const annualValue = annualWaterCaptured * waterValue;
        
        return annualValue > 0 ? projectCost / annualValue : 0;
    }
    
    /**
     * Display calculation results in the UI
     * @param {Object} results - Calculation results
     */
    displayResults(results) {
        // Store results for later reference
        this.lastCalculatedResults = results;
        
        // Update summary stats
        document.getElementById('totalWaterCaptured').textContent = 
            this.formatNumber(results.summary.totalWaterCaptured);
        
        document.getElementById('annualWaterCaptured').textContent = 
            this.formatNumber(results.summary.annualWaterCaptured);
        
        document.getElementById('emissionsReduction').textContent = 
            this.formatNumber(results.summary.emissionsReduction);
        
        document.getElementById('demandCoverage').textContent = 
            results.summary.demandCoverage > 0 ? 
            this.formatNumber(results.summary.demandCoverage, 1) : 'N/A';
        
        // Update cost analysis if available
        if (results.costAnalysis) {
            document.getElementById('waterTotalProjectCost').textContent = 
                '₹ ' + this.formatNumber(results.costAnalysis.totalProjectCost, 0);
            
            document.getElementById('costPerKiloliter').textContent = 
                '₹ ' + this.formatNumber(results.costAnalysis.costPerKiloliter, 2);
            
            document.getElementById('costPerHectare').textContent = 
                '₹ ' + this.formatNumber(results.costAnalysis.costPerHectare, 0);
            
            document.getElementById('paybackPeriod').textContent = 
                this.formatNumber(results.costAnalysis.paybackPeriod, 1) + ' years';
        } else {
            document.getElementById('waterTotalProjectCost').textContent = '-';
            document.getElementById('costPerKiloliter').textContent = '-';
            document.getElementById('costPerHectare').textContent = '-';
            document.getElementById('paybackPeriod').textContent = '-';
        }
        
        // Update yearly results table
        this.updateResultsTable(results.yearlyResults);
        
        // Update chart
        this.updateWaterCaptureChart(results.yearlyResults);
    }
    
    /**
     * Update the water capture results table
     * @param {Array} yearlyResults - Yearly results data
     */
    updateResultsTable(yearlyResults) {
        const tableBody = document.getElementById('waterResultsBody');
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Create new rows
        yearlyResults.forEach(result => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${result.year}</td>
                <td>${this.formatNumber(result.waterCaptured)}</td>
                <td>${this.formatNumber(result.cumulativeWater)}</td>
                <td>${this.formatNumber(result.energySaved)}</td>
                <td>${this.formatNumber(result.emissionsReduced)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    /**
     * Update the water capture chart
     * @param {Array} yearlyResults - Yearly results data
     */
    updateWaterCaptureChart(yearlyResults) {
        const chartCanvas = document.getElementById('waterCaptureChart');
        if (!chartCanvas || typeof Chart === 'undefined') return;
        
        // Prepare data
        const labels = yearlyResults.map(r => `Year ${r.year}`);
        const waterData = yearlyResults.map(r => r.cumulativeWater);
        
        // Destroy existing chart if it exists
        if (window.waterCaptureChart) {
            window.waterCaptureChart.destroy();
        }
        
        // Create new chart
        window.waterCaptureChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cumulative Water Captured (KL)',
                    data: waterData,
                    backgroundColor: 'rgba(2, 132, 199, 0.2)',
                    borderColor: 'rgba(2, 132, 199, 1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toLocaleString()} KL`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Water Captured (KL)'
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Set the calculator to calculating/normal state
     * @param {boolean} isCalculating - Whether calculation is in progress
     */
    setCalculatingState(isCalculating) {
        if (this.calculateBtn) {
            this.calculateBtn.disabled = isCalculating;
        }
        
        if (this.btnSpinner) {
            this.btnSpinner.style.display = isCalculating ? 'inline-block' : 'none';
        }
        
        const btnText = document.getElementById('waterBtnText');
        if (btnText) {
            btnText.textContent = isCalculating ? 'Calculating...' : 'Calculate Impact';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        if (!this.errorMessageDiv) return;
        
        this.errorMessageDiv.textContent = message;
        this.errorMessageDiv.classList.remove('hidden');
        
        // Scroll to error message
        this.errorMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    /**
     * Clear any displayed error messages
     */
    clearErrors() {
        if (this.errorMessageDiv) {
            this.errorMessageDiv.textContent = '';
            this.errorMessageDiv.classList.add('hidden');
        }
    }
    
    /**
     * Reset the water calculator form and results
     */
    resetWaterCalculator() {
        // Reset form
        if (this.form) {
            this.form.reset();
        }
        
        // Clear error messages
        this.clearErrors();
        
        // Hide results section
        if (this.resultsSection) {
            this.resultsSection.classList.add('hidden');
        }
        
        // Reset chart
        if (window.waterCaptureChart) {
            window.waterCaptureChart.destroy();
            window.waterCaptureChart = null;
        }
        
        // Track reset event
        analytics.trackEvent('water_calculator_reset');
    }
    
    /**
     * Format number with thousands separators
     * @param {number} value - Number to format
     * @param {number} [decimals=2] - Number of decimal places
     * @returns {string} Formatted number
     */
    formatNumber(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '-';
        }
        
        return value.toLocaleString('en-IN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
}