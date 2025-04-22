import { showForestError, displaySpeciesList, updateConversionFactors, updateSiteFactors } from './forestDOM.js';
import { setupGreenCoverAndCredits } from './forestEnhanced.js'; // Import necessary function
import { formatCO2e } from '../utils.js'; // Import formatting utility
import { analytics } from '../analytics.js'; // Import analytics module for tracking

// Ensure consistent event tracking that won't break functionality
function trackEvent(eventName, eventData = {}) {
    try {
        if (analytics && typeof analytics.trackEvent === 'function') {
            analytics.trackEvent(eventName, eventData);
        }
    } catch (error) {
        console.error('Error tracking event:', error);
    }
}

// Store species data locally within this module or pass getter/setter from forestMain.js
let localSpeciesData = [];
let activeFileUpload = false;

// --- Excel Template/Upload Functions (Forest) ---
export function downloadExcelTemplate() {
    try {
        console.log("Attempting to download template..."); // Added log

        // Track template download event
        trackEvent('forest_template_download', {
            timestamp: new Date().toISOString()
        });

        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            console.error("XLSX library not found. Attempting to use fallback method.");
            
            // Fallback: Create a simple CSV if XLSX library isn't available
            let csvContent = 'Species Name,Number of Trees,Growth Rate (m³/ha/yr),Wood Density (tdm/m³),BEF,Root-Shoot Ratio,Carbon Fraction,Site Quality,Average Rainfall,Soil Type,Survival Rate (%)\n';
            csvContent += 'Tectona grandis (Teak),500,12,0.65,1.5,0.27,0.47,Good,Medium,Loam,90\n';
            csvContent += 'Eucalyptus globulus,1000,25,0.55,1.3,0.24,0.47,Medium,High,Sandy,85\n';
            
            // Create a download link and trigger it
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', 'species-template.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log("CSV template downloaded using fallback method");
            return;
        }

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();

        // Define headers (ensure consistency with handleSpeciesFileUpload)
        const headers = [
            'Species Name', 'Number of Trees', 'Growth Rate (m³/ha/yr)',
            'Wood Density (tdm/m³)', 'BEF', 'Root-Shoot Ratio', 'Carbon Fraction',
            'Site Quality', 'Average Rainfall', 'Soil Type', 'Survival Rate (%)', 'Age at Peak MAI',
            'Drought Tolerance', 'Water Sensitivity', 'Soil Preference',
            'Risk Rate (%)', 'Initial Green Cover (ha)', 'Total Geographical Area (ha)',
            'Dead Attribute (%)'
        ];

        // Create sample data (ensure consistency with headers)
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

        // Add notes/documentation to another sheet
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

        console.log("Template downloaded successfully using XLSX"); // Added success log

    } catch (error) {
        console.error("Error generating Excel template:", error);
        // Use a more specific error display if available
        const errorDiv = document.getElementById('errorMessageForest');
        if (errorDiv) showForestError(`Error creating template: ${error.message}. Check console for details.`, errorDiv);
        else alert(`Error creating template: ${error.message}. Check console for details.`);

        // Track template download error
        trackEvent('forest_template_download_error', {
            error_message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

export function handleSpeciesFileUpload(event, speciesListElement, errorDiv, form) {
    // Clear previous errors specific to file upload
    if (errorDiv) {
         errorDiv.textContent = ''; // Clear text content
         errorDiv.classList.add('hidden'); // Hide the div
    }
    // Clear previous species list display
    if (speciesListElement) {
        speciesListElement.innerHTML = '';
    }

    const file = event.target.files[0];

    // File validation
    if (!file) {
        if (speciesListElement) speciesListElement.innerHTML = '<p class="text-sm text-gray-500">No file selected.</p>'; // Use gray text
        activeFileUpload = false; // Reset state
        localSpeciesData = []; // Reset state
        return; // Exit early
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
        activeFileUpload = false; // Reset state
        localSpeciesData = []; // Reset state
        return;
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
        activeFileUpload = false; // Reset state
        localSpeciesData = []; // Reset state
        return;
    }

    // Show loading indicator in the species list element
    if (speciesListElement) {
        speciesListElement.innerHTML = '<div class="flex justify-center py-4"><div class="loader"></div><p class="ml-2">Processing file...</p></div>';
        speciesListElement.classList.remove('hidden');
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            console.log("FileReader onload triggered."); // Log start of processing
            
            // Ensure XLSX is loaded
            if (typeof XLSX === 'undefined') {
                throw new Error("XLSX library is not loaded. Cannot process file.");
            }

            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            
            if (!firstSheetName) {
                 throw new Error("The uploaded file does not contain any sheets.");
            }
            
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
            if (!rawData || rawData.length < 2) { // Check for header + at least one data row
                throw new Error("The uploaded file is empty or has no data rows after the header.");
            }
            
            // Get headers from the file
            const actualHeaders = rawData[0].map(h => h ? String(h).trim() : ''); // Trim headers
            const processedSpeciesData = [];

            // Create a map of header names to their index for easier lookup
            const headerIndexMap = {};
            actualHeaders.forEach((header, index) => {
                if (header) { // Only map non-empty headers
                    headerIndexMap[header] = index;
                }
            });
            
            // Check for essential headers
            const essentialHeaders = ['Species Name', 'Number of Trees', 'Growth Rate (m³/ha/yr)'];
            for (const essentialHeader of essentialHeaders) {
                if (!(essentialHeader in headerIndexMap)) {
                    throw new Error(`Missing essential header column: "${essentialHeader}"`);
                }
            }

            // Process data rows
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.every(cell => cell === null || cell === '')) continue; // Skip empty/fully null rows

                const speciesObj = {};
                // Map data using the header index map
                for (const header in headerIndexMap) {
                    const index = headerIndexMap[header];
                    speciesObj[header] = (row[index] !== undefined && row[index] !== null) ? row[index] : null; // Use null for missing/undefined values
                }

                // Basic validation for essential data in the row
                if (!speciesObj['Species Name'] ||
                    speciesObj['Number of Trees'] === null || isNaN(parseFloat(speciesObj['Number of Trees'])) || parseFloat(speciesObj['Number of Trees']) <= 0 ||
                    speciesObj['Growth Rate (m³/ha/yr)'] === null || isNaN(parseFloat(speciesObj['Growth Rate (m³/ha/yr)'])) || parseFloat(speciesObj['Growth Rate (m³/ha/yr)']) <= 0) {
                    console.warn(`Skipping row ${i + 1}: Missing or invalid essential data (Species Name, Number of Trees, Growth Rate).`, speciesObj);
                    continue; // Skip rows with missing/invalid essential data
                }

                processedSpeciesData.push(speciesObj);
            }

            if (processedSpeciesData.length === 0) {
                throw new Error("No valid species data found in the uploaded file after processing.");
            }

            console.log(`Successfully processed ${processedSpeciesData.length} species.`); // Log success

            // Update UI and show species list
            displaySpeciesList(processedSpeciesData, speciesListElement);
            
            // Add visual indicator that species data is active
            const speciesLabel = document.querySelector('label[for="speciesFile"]');
            if (speciesLabel) {
                speciesLabel.innerHTML = `<span class="file-success">✓</span> ${processedSpeciesData.length} species ready for calculation`;
            }

            // Add badge to the form section header to show active status
            const formSectionHeader = document.querySelector('.form-section:first-child h3');
            if (formSectionHeader) {
                // Remove any existing status badge
                const existingBadge = formSectionHeader.querySelector('.status-badge');
                if (existingBadge) existingBadge.remove();
                
                // Add new status badge
                const statusBadge = document.createElement('span');
                statusBadge.className = 'status-badge bg-green-100 text-green-800 text-xs px-2 py-1 ml-2 rounded-full';
                statusBadge.textContent = `${processedSpeciesData.length} Species Active`;
                formSectionHeader.appendChild(statusBadge);
            }

            // Fetch the first species data to update conversion factors and site factors
            const firstSpecies = processedSpeciesData[0];
            if (firstSpecies) {
                updateConversionFactors(firstSpecies);
                updateSiteFactors(firstSpecies);
                
                // Auto-fill green cover fields if present in uploaded data
                if (firstSpecies['Initial Green Cover (ha)'] !== null && !isNaN(parseFloat(firstSpecies['Initial Green Cover (ha)']))) {
                    const initialGreenCoverInput = document.getElementById('initialGreenCover');
                    if (initialGreenCoverInput) {
                        initialGreenCoverInput.value = parseFloat(firstSpecies['Initial Green Cover (ha)']);
                        initialGreenCoverInput.dispatchEvent(new Event('input')); // Trigger any attached event listeners
                    }
                }
                
                if (firstSpecies['Total Geographical Area (ha)'] !== null && !isNaN(parseFloat(firstSpecies['Total Geographical Area (ha)']))) {
                    const totalGeoAreaInput = document.getElementById('totalGeographicalArea');
                    if (totalGeoAreaInput) {
                        totalGeoAreaInput.value = parseFloat(firstSpecies['Total Geographical Area (ha)']);
                        totalGeoAreaInput.dispatchEvent(new Event('input')); // Trigger any attached event listeners
                    }
                }
                
                // Set dead attribute if present
                if (firstSpecies['Dead Attribute (%)'] !== null && !isNaN(parseFloat(firstSpecies['Dead Attribute (%)']))) {
                    const deadAttributeInput = document.getElementById('deadAttribute');
                    if (deadAttributeInput) {
                        deadAttributeInput.value = parseFloat(firstSpecies['Dead Attribute (%)']);
                        deadAttributeInput.dispatchEvent(new Event('input')); // Trigger any attached event listeners
                    }
                }
            }

            // Update module state to indicate active file upload
            localSpeciesData = processedSpeciesData;
            activeFileUpload = true;

            // Track successful upload
            trackEvent('forest_file_upload_success', {
                filename: file.name,
                species_count: processedSpeciesData.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error processing file:", error);
            showForestError(`Error processing file: ${error.message}. Please check the file format and content.`, errorDiv);
            event.target.value = ''; // Clear the input
            // Reset state on error
            localSpeciesData = [];
            activeFileUpload = false;
            if (speciesListElement) speciesListElement.innerHTML = ''; // Clear list display

            // Track upload error
            trackEvent('forest_file_upload_error', {
                error_type: 'processing_error',
                error_message: error.message,
                filename: file.name,
                timestamp: new Date().toISOString()
            });
        }
    };

    reader.onerror = function() {
        console.error("FileReader error occurred."); // Log reader error
        showForestError("Error reading file. Please ensure the file is not corrupted and try again.", errorDiv);
        event.target.value = ''; // Clear the input
        // Reset state on error
        localSpeciesData = [];
        activeFileUpload = false;
        if (speciesListElement) speciesListElement.innerHTML = ''; // Clear list display

        // Track reader error
        trackEvent('forest_file_upload_error', {
            error_type: 'reader_error',
            filename: file.name,
            timestamp: new Date().toISOString()
        });
    };

    reader.readAsArrayBuffer(file);
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
        
        // Ensure XLSX is loaded
        if (typeof XLSX === 'undefined') {
            throw new Error("XLSX library is not loaded. Cannot export data.");
        }
        
        // Check if results are available
        const resultsTable = document.getElementById('resultsTableForest');
        const resultsSection = document.getElementById('resultsSectionForest');
        
        // Check if results are available by examining results section
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            throw new Error("No calculation results available. Please calculate results first.");
        }
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // --- Project Information Sheet ---
        const projectInfo = [
            ["Afforestation CO₂e Sequestration Results"],
            ["Generated:", new Date().toLocaleString()],
            [""],
            ["Project Information"],
            ["Project Location", document.getElementById('projectLocation')?.value || "Not specified"],
            ["Project Area (ha)", document.getElementById('projectArea')?.value || "0"],
            ["Planting Density (trees/ha)", document.getElementById('plantingDensity')?.value || "0"],
            ["Species", document.getElementById('speciesSelect')?.options[document.getElementById('speciesSelect')?.selectedIndex]?.text || "Multiple species"],
            ["Project Duration (years)", document.getElementById('projectDuration')?.value || "0"],
            ["Organization", document.getElementById('organizationName')?.value || "Not specified"],
            [""]
        ];
        
        const infoSheet = XLSX.utils.aoa_to_sheet(projectInfo);
        
        // Set column widths for project info sheet
        infoSheet['!cols'] = [
            { wch: 25 }, // First column width
            { wch: 40 }  // Second column width
        ];
        
        // Add styles to header
        infoSheet['A1'] = { v: "Afforestation CO₂e Sequestration Results", t: 's', s: { font: { bold: true, sz: 14 } } };
        
        // Add the sheet to workbook
        XLSX.utils.book_append_sheet(wb, infoSheet, "Project Info");
        
        // --- Sequestration Results Sheet ---
        const resultsHeaders = [
            "Year", "Stand Age", "Est. Gross Stem Vol. Incr. (m³/ha/yr)", 
            "Net Annual CO₂e Seq. (tCO₂e/yr)", "Cumulative Net CO₂e Seq. (tCO₂e)"
        ];
        
        // Create an array to hold the data
        const resultsData = [];
        
        // Add headers
        resultsData.push(resultsHeaders);
        
        // Try different ways to get the results table content
        let rows = [];
        if (resultsTable) {
            rows = resultsTable.querySelectorAll('tbody tr');
        } else {
            // Alternate attempt to find the table
            const alternateTable = document.querySelector('table:not(.hidden) tbody');
            if (alternateTable) {
                rows = alternateTable.querySelectorAll('tr');
            }
        }
        
        // Check if we found rows
        if (rows.length > 0) {
            // Extract data from the table
            rows.forEach(row => {
                const rowData = [];
                row.querySelectorAll('td').forEach(cell => {
                    // Try to convert number strings to actual numbers
                    const text = cell.textContent.trim();
                    const number = parseFloat(text.replace(/,/g, ''));
                    rowData.push(isNaN(number) ? text : number);
                });
                if (rowData.length > 0) {
                    resultsData.push(rowData);
                }
            });
        } else {
            // Log that we couldn't find the results table but proceed anyway
            console.warn('Could not find the results table. Creating empty results sheet.');
            resultsData.push(["No data available", "", "", "", ""]);
        }
        
        const resultsSheet = XLSX.utils.aoa_to_sheet(resultsData);
        
        // Set column widths for results sheet
        resultsSheet['!cols'] = [
            { wch: 10 },  // Year
            { wch: 10 },  // Stand Age
            { wch: 25 },  // Est. Gross Stem Vol. Incr.
            { wch: 25 },  // Net Annual CO₂e Seq.
            { wch: 25 }   // Cumulative Net CO₂e Seq.
        ];
        
        // Add styles to header row
        for (let i = 0; i < resultsHeaders.length; i++) {
            const cellRef = XLSX.utils.encode_cell({r: 0, c: i});
            resultsSheet[cellRef] = { 
                v: resultsHeaders[i], 
                t: 's', 
                s: { 
                    font: { bold: true }, 
                    fill: { fgColor: { rgb: "D9E1F2" } },
                    alignment: { horizontal: "center" }
                } 
            };
        }
        
        XLSX.utils.book_append_sheet(wb, resultsSheet, "Sequestration Results");
        
        // --- Summary Sheet ---
        // Extract summary metrics from the DOM
        const totalNetCO2e = document.getElementById('totalNetCO2e')?.innerText || "0 tCO₂e";
        const totalVERs = document.getElementById('totalVERs')?.innerText || "0";
        const estimatedRevenue = document.getElementById('estimatedRevenue')?.innerText || 
                               document.getElementById('carbonRevenue')?.innerText || "$0";
        const costPerTonne = document.getElementById('costPerTonneDisplay')?.innerText || "N/A";
        
        // Green cover metrics
        const initialGreenCover = document.getElementById('initialGreenCoverPercentage')?.innerText || "0%";
        const finalGreenCover = document.getElementById('finalGreenCoverPercentage')?.innerText || "0%";
        const absoluteIncrease = document.getElementById('absoluteGreenCoverIncrease')?.innerText || "0 ha";
        
        const summaryData = [
            ["Summary Results"],
            [""],
            ["Carbon Sequestration Metrics"],
            ["Total Net CO₂e Sequestered", totalNetCO2e],
            ["Total VERs (After Risk Buffer)", totalVERs],
            ["Estimated Revenue", estimatedRevenue],
            ["Cost per Tonne CO₂e", costPerTonne],
            [""],
            ["Green Cover Metrics"],
            ["Initial Green Cover", initialGreenCover],
            ["Final Green Cover", finalGreenCover],
            ["Absolute Increase", absoluteIncrease],
            [""],
            ["Report Generated", new Date().toLocaleString()],
            [""],
            ["Note: This is a model-based estimation. Actual results may vary based on site conditions, management practices, and climate factors."]
        ];
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths for summary sheet
        summarySheet['!cols'] = [
            { wch: 30 }, // First column width
            { wch: 30 }  // Second column width
        ];
        
        // Add styles to section headers
        summarySheet['A1'] = { v: "Summary Results", t: 's', s: { font: { bold: true, sz: 14 } } };
        summarySheet['A3'] = { v: "Carbon Sequestration Metrics", t: 's', s: { font: { bold: true } } };
        summarySheet['A9'] = { v: "Green Cover Metrics", t: 's', s: { font: { bold: true } } };
        
        XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
        
        // --- Chart Data Sheet (for recreating charts) ---
        // Create a data sheet that can be used to recreate charts
        const chartData = [
            ["Chart Data for Visualization"],
            ["This sheet contains the data needed to recreate charts in Excel."],
            [""],
            ["Sequestration over Time"],
            ["Year", "Annual Net CO₂e (tCO₂e/yr)", "Cumulative Net CO₂e (tCO₂e)"]
        ];
        
        // Copy data from the results sheet to create the chart data
        for (let i = 1; i < resultsData.length; i++) {
            if (resultsData[i].length >= 5) { // Ensure row has enough columns
                chartData.push([
                    resultsData[i][0],  // Year
                    resultsData[i][3],  // Annual Net CO₂e
                    resultsData[i][4]   // Cumulative Net CO₂e
                ]);
            }
        }
        
        const chartSheet = XLSX.utils.aoa_to_sheet(chartData);
        
        // Set column widths for chart data sheet
        chartSheet['!cols'] = [
            { wch: 10 }, // Year
            { wch: 25 }, // Annual Net CO₂e
            { wch: 25 }  // Cumulative Net CO₂e
        ];
        
        // Add styles to header row
        chartSheet['A1'] = { v: "Chart Data for Visualization", t: 's', s: { font: { bold: true, sz: 14 } } };
        
        XLSX.utils.book_append_sheet(wb, chartSheet, "Chart Data");
        
        // Generate file name with date and project identifier
        const projectIdentifier = document.getElementById('projectLocation')?.value?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || "forest";
        const fileName = `afforestation-results-${projectIdentifier}-${new Date().toISOString().slice(0,10)}.xlsx`;
        
        // Write file and trigger download
        XLSX.writeFile(wb, fileName);
        
        console.log("Excel export completed successfully");
        
    } catch (error) {
        console.error("Error exporting data to Excel:", error);
        
        // Track Excel export error
        trackEvent('forest_excel_export_error', {
            error_message: error.message,
            timestamp: new Date().toISOString()
        });
        
        alert(`Error exporting data: ${error.message}. Please ensure you have calculated results before exporting.`);
    }
}

// Export functions that need to be accessible
export function setupForestFileUploads() {
    // Initialize download template button
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        console.log('Setting up download template button listener');
        // Remove previous listeners by replacing the node (safer than removeEventListener if references are lost)
        const newBtn = downloadTemplateBtn.cloneNode(true);
        downloadTemplateBtn.parentNode.replaceChild(newBtn, downloadTemplateBtn);

        // Add event listener directly to the new button
        newBtn.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior if it were an anchor
            console.log('Download template button clicked via listener');
            
            // Visual feedback
            const originalText = newBtn.querySelector('span') ? newBtn.querySelector('span').textContent : newBtn.textContent; // Handle potential inner spans
            const svgIcon = newBtn.querySelector('svg');
            if (svgIcon) svgIcon.style.display = 'none'; // Hide icon during download
            newBtn.disabled = true;
            newBtn.innerHTML = 'Downloading...'; // Use innerHTML to replace content

            try {
                downloadExcelTemplate(); // Call the download function
            } catch (e) {
                 console.error("Error directly calling downloadExcelTemplate:", e);
                 // Show error feedback on button if possible
                 newBtn.innerHTML = 'Download Failed';
                 setTimeout(() => { // Reset after a delay
                     newBtn.innerHTML = ''; // Clear content
                     if (svgIcon) {
                         newBtn.appendChild(svgIcon); // Re-add icon
                         svgIcon.style.display = ''; // Make icon visible again
                     }
                     newBtn.appendChild(document.createTextNode(originalText)); // Re-add original text
                     newBtn.disabled = false;
                 }, 3000);
                 return; // Stop further execution in case of error
            }

            // Reset button text after a short delay (assuming download starts quickly)
            setTimeout(() => {
                newBtn.innerHTML = ''; // Clear content
                if (svgIcon) {
                     newBtn.appendChild(svgIcon); // Re-add icon
                     svgIcon.style.display = ''; // Make icon visible again
                }
                newBtn.appendChild(document.createTextNode(originalText)); // Re-add original text
                newBtn.disabled = false;
            }, 2000);
        });
    } else {
        console.warn('Download template button not found with ID: downloadTemplateBtn');
    }

    // Initialize file input listener
    const speciesFileInput = document.getElementById('speciesFile');
    const speciesListElement = document.getElementById('speciesList');
    const errorDiv = document.getElementById('errorMessageForest');
    const form = document.getElementById('calculatorForm'); // Assuming form ID

    if (speciesFileInput && speciesListElement && errorDiv && form) {
        console.log('Setting up species file input listener');
        // Use change event listener
        speciesFileInput.addEventListener('change', (event) => {
            console.log('Species file input changed');
            // Call handleSpeciesFileUpload, state updates happen inside it asynchronously
            handleSpeciesFileUpload(event, speciesListElement, errorDiv, form);
        });
    } else {
        console.warn('Could not initialize species file upload listeners. Elements missing:',
            {speciesFileInput: !!speciesFileInput, speciesListElement: !!speciesListElement,
             errorDiv: !!errorDiv, form: !!form});
    }

    // Return necessary functions/state if needed by other modules
    return {
        // handleSpeciesFileUpload is called by the listener, no need to return it
        getSpeciesData: () => localSpeciesData, // Provides access to the latest parsed data
        isActiveFileUpload: () => activeFileUpload // Provides access to the latest upload status
    };
}

// Expose key functions to the global window scope for backup handlers to use
if (typeof window !== 'undefined') {
    // Create a container object for forestIO functions
    window.forestIO = {
        downloadExcelTemplate,
        generateForestPdf,
        exportForestExcel,
        setupForestFileUploads
    };
}
