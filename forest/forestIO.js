// forest/forestIO.js
// Handles Input/Output for Afforestation: File Upload, PDF Generation, Excel Export/Template

import { showForestError, displaySpeciesList, updateConversionFactors, updateSiteFactors } from './forestDOM.js';
import { setupGreenCoverAndCredits } from './forestEnhanced.js'; // Import necessary function
import { formatCO2e } from '../utils.js'; // Import formatting utility
import { trackEvent } from '../analytics.js'; // Import analytics module for tracking

// Store species data locally within this module or pass getter/setter from forestMain.js
let localSpeciesData = [];
let activeFileUpload = false;
let setExternalSpeciesData = null; // Function to update state in forestMain.js
let getExternalSpeciesData = null; // Function to get state from forestMain.js

export function initializeForestIO(getter, setter) {
    getExternalSpeciesData = getter;
    setExternalSpeciesData = setter;
    localSpeciesData = getExternalSpeciesData(); // Initialize local copy
}

// --- Excel Template/Upload Functions (Forest) ---
export function downloadExcelTemplate() {
    try {
        // Track template download event
        trackEvent('forest_template_download', {
            timestamp: new Date().toISOString()
        });
        
        // Ensure XLSX is loaded (assuming it's loaded globally via CDN)
        if (typeof XLSX === 'undefined') {
            throw new Error("XLSX library is not loaded. Cannot generate template.");
        }

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
                'Risk Rate (%)': 15, 'Initial Green Cover (ha)': 2, 'Total Geographical Area (ha)': 80,
                'Dead Attribute (%)': 5
            }
        ];

        // Create worksheet with headers and sample data
        const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

        // Add column width information
        const wscols = headers.map(h => ({ wch: Math.max(h.length, 15) })); // Min width 15
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
            ["Dead Attribute (%) - Proportion of carbon sequestration considered 'non-additional' (baseline/natural regen, 0-100, default: 0%)"]
        ]);

        // Set column width for notes sheet
        notesWs['!cols'] = [{ wch: 100 }]; // Make the instruction column wide

        // Add worksheets to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Species Data");
        XLSX.utils.book_append_sheet(wb, notesWs, "Instructions");

        // Generate Excel file and trigger download
        XLSX.writeFile(wb, "species-template.xlsx");

    } catch (error) {
        console.error("Error generating Excel template:", error);
        alert("Error creating Excel template. Please try again. Ensure XLSX library is loaded.");
        // Use a more specific error display if available
        const errorDiv = document.getElementById('errorMessageForest');
        if (errorDiv) showForestError(`Error creating template: ${error.message}`, errorDiv);
    }
}

export function handleSpeciesFileUpload(event, speciesListElement, errorDiv, form) {
    // Clear previous errors specific to file upload
    if (errorDiv) errorDiv.classList.add('hidden');

    const file = event.target.files[0];

    // File validation
    if (!file) {
        if (speciesListElement) speciesListElement.innerHTML = '<p class="text-sm text-red-600">No file selected.</p>';
        return { activeFileUpload: false, speciesData: [] };
    }

    // Track file upload attempt
    trackEvent('forest_file_upload_attempt', {
        filename: file.name,
        filesize: file.size,
        filetype: file.type,
        timestamp: new Date().toISOString()
    });

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        // Track upload error - file too large
        trackEvent('forest_file_upload_error', {
            error_type: 'file_size_exceeded',
            filename: file.name,
            filesize: file.size,
            timestamp: new Date().toISOString()
        });
        
        showForestError('File size exceeds 5MB limit.', errorDiv);
        event.target.value = ''; // Clear the input
        return { activeFileUpload: false, speciesData: [] };
    }

    // Check file type
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // Allow CSV
    ];
    // Also check file extension for robustness
    const isValidType = validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (!isValidType) {
        // Track upload error - invalid file type
        trackEvent('forest_file_upload_error', {
            error_type: 'invalid_file_type',
            filename: file.name,
            filetype: file.type,
            timestamp: new Date().toISOString()
        });
        
        showForestError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.', errorDiv);
        event.target.value = ''; // Clear the input
        return { activeFileUpload: false, speciesData: [] };
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            // Ensure XLSX is loaded
            if (typeof XLSX === 'undefined') {
                throw new Error("XLSX library is not loaded. Cannot process file.");
            }

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

            // Read data, assuming the first row is the header
            const rawData = XLSX.utils.sheet_to_json(firstSheet, {
                raw: true, // Keep raw values (numbers as numbers)
                defval: null, // Use null for empty cells
                header: 1 // Explicitly state that the first row is the header
            });

            // Basic validation: Check if data was actually read
            if (rawData.length === 0) {
                throw new Error("The uploaded file is empty or has no data rows after the header.");
            }

            // Get headers from the file
            const actualHeaders = rawData[0];
            const processedSpeciesData = [];
            
            // Process data rows
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue; // Skip empty rows
                
                const speciesObj = {};
                actualHeaders.forEach((header, index) => {
                    if (index < row.length) {
                        speciesObj[header] = row[index];
                    } else {
                        speciesObj[header] = null;
                    }
                });
                
                // Skip rows missing essential data
                if (!speciesObj['Species Name'] || 
                    !speciesObj['Number of Trees'] || 
                    !speciesObj['Growth Rate (m³/ha/yr)']) {
                    continue;
                }
                
                processedSpeciesData.push(speciesObj);
            }

            if (processedSpeciesData.length === 0) {
                throw new Error("No valid species data found in the uploaded file.");
            }

            // Update UI and show species list
            displaySpeciesList(processedSpeciesData, speciesListElement);
            
            // Fetch the first species data to update conversion factors and site factors
            const firstSpecies = processedSpeciesData[0];
            if (firstSpecies) {
                updateConversionFactors(firstSpecies);
                updateSiteFactors(firstSpecies);
            }
            
            // Update module state 
            localSpeciesData = processedSpeciesData;
            activeFileUpload = true;
            
            // Update external state if available
            if (setExternalSpeciesData) {
                setExternalSpeciesData(processedSpeciesData);
            }
            
            // Auto-fill green cover fields if present in uploaded data
            if (firstSpecies['Initial Green Cover (ha)'] !== null) {
                const initialGreenCoverInput = document.getElementById('initialGreenCover');
                if (initialGreenCoverInput) {
                    initialGreenCoverInput.value = firstSpecies['Initial Green Cover (ha)'];
                }
            }
            
            if (firstSpecies['Total Geographical Area (ha)'] !== null) {
                const totalGeoAreaInput = document.getElementById('totalGeographicalArea');
                if (totalGeoAreaInput) {
                    totalGeoAreaInput.value = firstSpecies['Total Geographical Area (ha)'];
                }
            }
            
            return { activeFileUpload: true, speciesData: processedSpeciesData };
            
        } catch (error) {
            console.error("Error processing file:", error);
            showForestError(`Error processing file: ${error.message}`, errorDiv);
            event.target.value = ''; // Clear the input
            return { activeFileUpload: false, speciesData: [] };
        }
    };

    reader.onerror = function() {
        showForestError("Error reading file. Please try again.", errorDiv);
        event.target.value = ''; // Clear the input
        return { activeFileUpload: false, speciesData: [] };
    };

    reader.readAsArrayBuffer(file);
    
    // Return placeholder, actual processing happens asynchronously
    return { activeFileUpload: true, speciesData: [] };
}

export function generateForestPdf() {
    try {
        // Track PDF generation event
        trackEvent('forest_pdf_generation', {
            timestamp: new Date().toISOString()
        });

        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            throw new Error("jsPDF library is not loaded. Cannot generate PDF.");
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Get project information
        const projectLocation = document.getElementById('projectLocation')?.value || "Not specified";
        const projectArea = document.getElementById('projectArea')?.value || "0";
        const plantingDensity = document.getElementById('plantingDensity')?.value || "0";
        const species = document.getElementById('species')?.options[document.getElementById('species')?.selectedIndex]?.text || "Multiple species";
        const projectDuration = document.getElementById('projectDuration')?.value || "0";
        const organizationName = document.getElementById('organizationName')?.value || "Not specified";
        
        // Get results
        const totalNetCO2e = document.getElementById('totalNetCO2e')?.innerText || "0 tCO₂e";
        const totalVERs = document.getElementById('totalVERs')?.innerText || "0";
        const estimatedRevenue = document.getElementById('estimatedRevenue')?.innerText || "$0";
        const costPerTonne = document.getElementById('costPerTonne')?.innerText || "N/A";
        
        // Set up document
        doc.setFontSize(20);
        doc.setTextColor(33, 97, 140);
        doc.text("Afforestation CO₂e Sequestration Report", 15, 20);
        
        // Organization info
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Organization: ${organizationName}`, 15, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, 35);
        
        // Project info
        doc.setFontSize(14);
        doc.setTextColor(33, 97, 140);
        doc.text("Project Information", 15, 45);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Project Location: ${projectLocation}`, 15, 52);
        doc.text(`Project Area: ${projectArea} hectares`, 15, 57);
        doc.text(`Planting Density: ${plantingDensity} trees/hectare`, 15, 62);
        doc.text(`Species: ${species}`, 15, 67);
        doc.text(`Project Duration: ${projectDuration} years`, 15, 72);
        
        // Results
        doc.setFontSize(14);
        doc.setTextColor(33, 97, 140);
        doc.text("Sequestration Results", 15, 85);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Net CO₂e Sequestered: ${totalNetCO2e}`, 15, 92);
        doc.text(`Total Verified Emission Reductions (VERs): ${totalVERs}`, 15, 97);
        doc.text(`Estimated Revenue: ${estimatedRevenue}`, 15, 102);
        doc.text(`Cost per Tonne CO₂e: ${costPerTonne}`, 15, 107);
        
        // Green Cover Results
        const initialGreenCoverPercentage = document.getElementById('initialGreenCoverPercentage')?.innerText || "0%";
        const finalGreenCoverPercentage = document.getElementById('finalGreenCoverPercentage')?.innerText || "0%";
        const absoluteGreenCoverIncrease = document.getElementById('absoluteGreenCoverIncrease')?.innerText || "0 ha";
        
        doc.setFontSize(14);
        doc.setTextColor(33, 97, 140);
        doc.text("Green Cover Impact", 15, 120);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Initial Green Cover: ${initialGreenCoverPercentage}`, 15, 127);
        doc.text(`Final Green Cover: ${finalGreenCoverPercentage}`, 15, 132);
        doc.text(`Absolute Increase: ${absoluteGreenCoverIncrease}`, 15, 137);
        
        // Add disclaimer
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Disclaimer: This is an estimation based on growth models and customizable parameters. Results should be validated with field measurements for precise carbon accounting.", 15, 280);
        
        // Save PDF
        doc.save(`afforestation-report-${new Date().toISOString().slice(0,10)}.pdf`);
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        // Track PDF generation error
        trackEvent('forest_pdf_generation_error', {
            error_message: error.message,
            timestamp: new Date().toISOString()
        });
        alert(`Error generating PDF: ${error.message}. Please ensure the jsPDF library is loaded.`);
        return;
    }
}

export function exportForestExcel() {
    try {
        // Track Excel export event
        trackEvent('forest_excel_export', {
            timestamp: new Date().toISOString()
        });
        
        // Ensure XLSX is loaded (assuming it's loaded globally via CDN)
        if (typeof XLSX === 'undefined') {
            throw new Error("XLSX library is not loaded. Cannot export data.");
        }
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Add project information
        const projectInfo = [
            ["Afforestation CO₂e Sequestration Results"],
            [""],
            ["Project Information"],
            ["Project Location", document.getElementById('projectLocation')?.value || "Not specified"],
            ["Project Area (ha)", document.getElementById('projectArea')?.value || "0"],
            ["Planting Density (trees/ha)", document.getElementById('plantingDensity')?.value || "0"],
            ["Species", document.getElementById('species')?.options[document.getElementById('species')?.selectedIndex]?.text || "Multiple species"],
            ["Project Duration (years)", document.getElementById('projectDuration')?.value || "0"],
            ["Organization", document.getElementById('organizationName')?.value || "Not specified"],
            [""]
        ];
        
        const infoSheet = XLSX.utils.aoa_to_sheet(projectInfo);
        XLSX.utils.book_append_sheet(wb, infoSheet, "Project Info");
        
        // Create sheet for sequestration results
        const resultsHeaders = [
            "Year", "Stand Age", "Est. Gross Stem Vol. Incr. (m³/ha/yr)", 
            "Net Annual CO₂e Seq. (tCO₂e/yr)", "Cumulative Net CO₂e Seq. (tCO₂e)"
        ];
        
        // Extract data from results table
        const resultsTable = document.getElementById('resultsTableForest');
        const resultsData = [];
        
        if (resultsTable) {
            // Add headers
            resultsData.push(resultsHeaders);
            
            // Add rows from table
            const rows = resultsTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const rowData = [];
                row.querySelectorAll('td').forEach(cell => {
                    rowData.push(cell.textContent);
                });
                resultsData.push(rowData);
            });
        } else {
            // Add sample row if table not found
            resultsData.push(resultsHeaders);
            resultsData.push(["No data available", "", "", "", ""]);
        }
        
        const resultsSheet = XLSX.utils.aoa_to_sheet(resultsData);
        XLSX.utils.book_append_sheet(wb, resultsSheet, "Sequestration Results");
        
        // Add summary data
        const summaryData = [
            ["Summary Metrics"],
            [""],
            ["Total Net CO₂e Sequestered", document.getElementById('totalNetCO2e')?.innerText || "0 tCO₂e"],
            ["Total VERs", document.getElementById('totalVERs')?.innerText || "0"],
            ["Estimated Revenue", document.getElementById('carbonRevenue')?.innerText || "$0"],
            ["Cost per Tonne", document.getElementById('costPerTonne')?.innerText || "N/A"],
            [""],
            ["Green Cover Metrics"],
            ["Initial Green Cover", document.getElementById('initialGreenCoverPercentage')?.innerText || "0%"],
            ["Final Green Cover", document.getElementById('finalGreenCoverPercentage')?.innerText || "0%"],
            ["Absolute Increase", document.getElementById('absoluteGreenCoverIncrease')?.innerText || "0 ha"],
            [""],
            ["Report Generated", new Date().toLocaleString()]
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
        
        // Generate file name with date
        const fileName = `afforestation-results-${new Date().toISOString().slice(0,10)}.xlsx`;
        
        // Write file and trigger download
        XLSX.writeFile(wb, fileName);
        
    } catch (error) {
        console.error("Error exporting data to Excel:", error);
        
        // Track Excel export error
        trackEvent('forest_excel_export_error', {
            error_message: error.message,
            timestamp: new Date().toISOString()
        });
        
        alert(`Error exporting data: ${error.message}. Please ensure the XLSX library is loaded.`);
    }
}

// Export functions that need to be accessible
export function setupForestFileUploads() {
    // Initialize download template button
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadExcelTemplate);
    }
    
    return {
        handleSpeciesFileUpload,
        getSpeciesData: () => localSpeciesData,
        isActiveFileUpload: () => activeFileUpload
    };
}
