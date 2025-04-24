// Debugging script to help diagnose forest calculation issues
console.log("Forest Debug Script Loaded");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded, setting up debug handlers");
    
    // Add a debug button to force show results
    const debugBtn = document.createElement('button');
    debugBtn.textContent = "Debug: Force Calculate";
    debugBtn.className = "btn btn-warning m-3";
    debugBtn.onclick = function() {
        console.log("Debug: Attempting manual calculation");
        
        try {
            // Get form data directly
            const form = document.getElementById('calculatorForm');
            if (!form) {
                console.error("Form not found!");
                return;
            }
            
            // Simple manual inputs for testing
            const testInputs = {
                projectArea: parseFloat(document.getElementById('projectArea')?.value) || 10,
                plantingDensity: parseFloat(document.getElementById('plantingDensity')?.value) || 1600,
                species: document.getElementById('species')?.value || 'teak_moderate',
                projectDuration: parseInt(document.getElementById('projectDuration')?.value) || 10,
                woodDensity: parseFloat(document.getElementById('woodDensity')?.value) || 0.5,
                bef: parseFloat(document.getElementById('bef')?.value) || 1.5,
                rsr: parseFloat(document.getElementById('rsr')?.value) || 0.25,
                carbonFraction: parseFloat(document.getElementById('carbonFraction')?.value) || 0.47,
                siteQuality: document.getElementById('siteQuality')?.value || 'Medium',
                avgRainfall: document.getElementById('avgRainfall')?.value || 'Medium',
                soilType: document.getElementById('soilType')?.value || 'Loam',
                survivalRate: (parseFloat(document.getElementById('survivalRate')?.value) || 85) / 100
            };
            
            console.log("Debug test inputs:", testInputs);
            
            // Try to import and run calculation directly
            import('/workspaces/A-R-Project-Impact/forest/forestCalcs.js').then(forestCalcs => {
                console.log("Loaded forestCalcs module", forestCalcs);
                
                try {
                    const results = forestCalcs.calculateSequestration(testInputs);
                    console.log("Calculation successful:", results);
                    
                    // Now try to display results
                    import('/workspaces/A-R-Project-Impact/forest/forestDOM.js').then(forestDOM => {
                        console.log("Loaded forestDOM module", forestDOM);
                        
                        try {
                            const resultsSection = document.getElementById('resultsSectionForest');
                            const resultsBody = document.getElementById('resultsBodyForest');
                            const chartElement = document.getElementById('sequestrationChart');
                            const errorElement = document.getElementById('errorMessageForest');
                            
                            console.log("Result elements:", {
                                resultsSection: !!resultsSection,
                                resultsBody: !!resultsBody,
                                chartElement: !!chartElement,
                                errorElement: !!errorElement
                            });
                            
                            if (resultsSection) {
                                console.log("Before display:", {
                                    classList: resultsSection.classList,
                                    display: getComputedStyle(resultsSection).display,
                                    visibility: getComputedStyle(resultsSection).visibility
                                });
                            }
                            
                            // Force override any CSS issues that might prevent display
                            if (resultsSection) {
                                resultsSection.classList.remove('hidden');
                                resultsSection.classList.add('show-results');
                                resultsSection.style.display = 'block';
                                resultsSection.style.visibility = 'visible';
                                resultsSection.style.opacity = '1';
                                resultsSection.style.height = 'auto';
                            }
                            
                            // Display results
                            forestDOM.displayForestResults(
                                results, 
                                resultsSection, 
                                resultsBody, 
                                chartElement,
                                errorElement
                            );
                            
                            if (resultsSection) {
                                console.log("After display:", {
                                    classList: resultsSection.classList,
                                    display: getComputedStyle(resultsSection).display,
                                    visibility: getComputedStyle(resultsSection).visibility
                                });
                            }
                            
                        } catch (displayError) {
                            console.error("Error displaying results:", displayError);
                        }
                    }).catch(err => console.error("Failed to import forestDOM:", err));
                    
                } catch (calcError) {
                    console.error("Calculation failed:", calcError);
                }
            }).catch(err => console.error("Failed to import forestCalcs:", err));
            
        } catch (error) {
            console.error("Debug calculation attempt failed:", error);
        }
    };
    
    // Add the debug button to the page
    const container = document.createElement('div');
    container.className = "debug-tools p-3 bg-light border";
    container.style.margin = "15px";
    container.appendChild(document.createTextNode("Debugging Tools:"));
    container.appendChild(debugBtn);
    
    // Add button to force show results regardless of calculation
    const showResultsBtn = document.createElement('button');
    showResultsBtn.textContent = "Debug: Show Results Section";
    showResultsBtn.className = "btn btn-info m-3";
    showResultsBtn.onclick = function() {
        const resultsSection = document.getElementById('resultsSectionForest');
        if (resultsSection) {
            resultsSection.classList.remove('hidden');
            resultsSection.classList.add('show-results');
            resultsSection.style.display = 'block';
            resultsSection.style.visibility = 'visible';
            resultsSection.style.opacity = '1';
            resultsSection.style.height = 'auto';
            console.log("Results section should now be visible");
        } else {
            console.error("Results section element not found");
        }
    };
    container.appendChild(showResultsBtn);
    
    // Find a good place to insert the debug tools
    const body = document.body;
    if (body) {
        if (body.firstChild) {
            body.insertBefore(container, body.firstChild);
        } else {
            body.appendChild(container);
        }
        console.log("Debug tools added to page");
    }
});