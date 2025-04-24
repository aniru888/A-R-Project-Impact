// This file implements handlers for the forest species list events
import { forestEventSystem } from './forestCalcs.js';

/**
 * Initialize handlers for species list and factor updates
 */
export function initForestListHandlers() {
    console.log('Initializing forest list handlers');
    
    // Register the event handlers with the event system
    forestEventSystem.registerEvents({
        // Handle displaying the species list in the UI
        displaySpeciesList: handleDisplaySpeciesList,
        
        // Handle updating conversion factors based on species data
        updateConversionFactors: handleUpdateConversionFactors,
        
        // Handle updating site factors based on species data
        updateSiteFactors: handleUpdateSiteFactors
    });
    
    console.log('Forest list handlers registered successfully');
}

/**
 * Handle displaying the species list in the UI
 * @param {Array<Object>} speciesData - The species data to display
 */
function handleDisplaySpeciesList(speciesData) {
    console.log('Handling displaySpeciesList event:', speciesData.length, 'species');
    
    try {
        // Get the species list container
        const speciesList = document.getElementById('speciesList');
        if (!speciesList) {
            console.warn('Species list container not found in DOM');
            return;
        }
        
        // Create a table to display the species data
        let tableHtml = '<div class="species-list-table-container"><table class="species-list-table">';
        
        // Add the table header
        tableHtml += '<thead><tr>';
        tableHtml += '<th>Species Name</th>';
        tableHtml += '<th>Number of Trees</th>';
        tableHtml += '<th>Growth Rate</th>';
        tableHtml += '<th>Wood Density</th>';
        tableHtml += '</tr></thead>';
        
        // Add the table body
        tableHtml += '<tbody>';
        for (const species of speciesData) {
            tableHtml += '<tr>';
            tableHtml += `<td>${species['Species Name'] || 'Unknown'}</td>`;
            tableHtml += `<td>${species['Number of Trees'] || '0'}</td>`;
            tableHtml += `<td>${species['Growth Rate (m³/ha/yr)'] || '-'}</td>`;
            tableHtml += `<td>${species['Wood Density (tdm/m³)'] || '-'}</td>`;
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table></div>';
        
        // Add some summary information
        tableHtml += `<div class="mt-2 text-sm text-primary-600">
            <span id="multiSpeciesModeMessage" class="font-medium">
                Multi-species mode active with ${speciesData.length} species loaded
            </span>
        </div>`;
        
        // Update the species list container
        speciesList.innerHTML = tableHtml;
        speciesList.classList.remove('hidden');
        
        // Show the species list container
        const speciesListContainer = document.getElementById('speciesListContainer');
        if (speciesListContainer) {
            speciesListContainer.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error displaying species list:', error);
    }
}

/**
 * Handle updating conversion factors based on species data
 * @param {Object} speciesData - First species data to use for defaults
 */
function handleUpdateConversionFactors(speciesData) {
    console.log('Handling updateConversionFactors event with data:', speciesData);
    
    try {
        // Only update if we have valid data
        if (!speciesData) return;
        
        // Update growth rate if available
        const growthRateField = document.getElementById('growthRate');
        if (growthRateField && speciesData['Growth Rate (m³/ha/yr)']) {
            growthRateField.value = speciesData['Growth Rate (m³/ha/yr)'];
        }
        
        // Update wood density if available
        const woodDensityField = document.getElementById('woodDensity');
        if (woodDensityField && speciesData['Wood Density (tdm/m³)']) {
            woodDensityField.value = speciesData['Wood Density (tdm/m³)'];
        }
        
        // Update BEF if available
        const befField = document.getElementById('bef');
        if (befField && speciesData['BEF']) {
            befField.value = speciesData['BEF'];
        }
        
        // Update root-shoot ratio if available
        const rsrField = document.getElementById('rsr');
        if (rsrField && speciesData['Root-Shoot Ratio']) {
            rsrField.value = speciesData['Root-Shoot Ratio'];
        }
        
        // Update carbon fraction if available
        const carbonFractionField = document.getElementById('carbonFraction');
        if (carbonFractionField && speciesData['Carbon Fraction']) {
            carbonFractionField.value = speciesData['Carbon Fraction'];
        }
        
    } catch (error) {
        console.error('Error updating conversion factors:', error);
    }
}

/**
 * Handle updating site factors based on species data
 * @param {Object} speciesData - First species data to use for defaults
 */
function handleUpdateSiteFactors(speciesData) {
    console.log('Handling updateSiteFactors event with data:', speciesData);
    
    try {
        // Only update if we have valid data
        if (!speciesData) return;
        
        // Update survival rate if available
        const survivalRateField = document.getElementById('survivalRate');
        if (survivalRateField && speciesData['Survival Rate (%)']) {
            survivalRateField.value = speciesData['Survival Rate (%)'];
        }
        
    } catch (error) {
        console.error('Error updating site factors:', error);
    }
}