// Debugging script to help diagnose forest calculation issues
console.log("Forest Debug Script Loaded");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded, debug handlers available but not displayed");
    
    // Define debug functions but don't add them to page automatically
    // These can be manually triggered from console if needed
    window.forestDebug = {
        forceCalculate: function() {
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
                import('./forestCalcs.js').then(forestCalcs => {
                    console.log("Loaded forestCalcs module", forestCalcs);
                    
                    try {
                        const results = forestCalcs.calculateSequestration(testInputs);
                        console.log("Calculation successful, raw results:", results); // Log the raw result
                        
                        // Check if the calculation actually returned valid results
                        if (!results || !results.length) {
                            console.error("Debug: Calculation returned empty or invalid results! Cannot display.");
                            // Optionally show an error in the UI if needed
                            // import('./forestDOM.js').then(forestDOM => forestDOM.showForestError('Debug: Calculation failed to produce results.'));
                            return; // Stop execution here
                        }
                        
                        // Now try to display results
                        import('./forestDOM.js').then(forestDOM => {
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
        },
        
        showResultsSection: function() {
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
        },
        
        checkEnhancedFeatures: function() {
            console.log('Debug: Checking enhanced features sections');
            
            // Check results section first (parent container)
            const resultsSection = document.getElementById('resultsSectionForest');
            console.log('Results section exists:', !!resultsSection);
            
            if (resultsSection) {
                console.log('Results section styles:', {
                    display: getComputedStyle(resultsSection).display,
                    visibility: getComputedStyle(resultsSection).visibility,
                    height: getComputedStyle(resultsSection).height,
                    overflow: getComputedStyle(resultsSection).overflow,
                    opacity: getComputedStyle(resultsSection).opacity,
                    classes: resultsSection.className
                });
            }
            
            // Check green cover section
            const greenCoverSection = document.getElementById('greenCoverSection');
            console.log('Green cover section exists:', !!greenCoverSection);
            
            if (greenCoverSection) {
                console.log('Green cover section styles:', {
                    display: getComputedStyle(greenCoverSection).display,
                    visibility: getComputedStyle(greenCoverSection).visibility,
                    height: getComputedStyle(greenCoverSection).height,
                    overflow: getComputedStyle(greenCoverSection).overflow,
                    opacity: getComputedStyle(greenCoverSection).opacity,
                    classes: greenCoverSection.className
                });
                
                // Check if green cover fields exist
                console.log('Green cover fields:', {
                    initialGreenCoverPercentage: !!document.getElementById('initialGreenCoverPercentage'),
                    finalGreenCoverPercentage: !!document.getElementById('finalGreenCoverPercentage'),
                    absoluteGreenCoverIncrease: !!document.getElementById('absoluteGreenCoverIncrease')
                });
                
                // Force display green cover section
                greenCoverSection.classList.remove('hidden');
                greenCoverSection.style.display = 'block';
                greenCoverSection.style.visibility = 'visible';
                greenCoverSection.style.opacity = '1';
                console.log('Forced green cover section to be visible');
            }
            
            // Check carbon credits section
            const carbonCreditsSection = document.getElementById('carbonCreditsSection');
            console.log('Carbon credits section exists:', !!carbonCreditsSection);
            
            if (carbonCreditsSection) {
                console.log('Carbon credits section styles:', {
                    display: getComputedStyle(carbonCreditsSection).display,
                    visibility: getComputedStyle(carbonCreditsSection).visibility,
                    height: getComputedStyle(carbonCreditsSection).height,
                    overflow: getComputedStyle(carbonCreditsSection).overflow,
                    opacity: getComputedStyle(carbonCreditsSection).opacity,
                    classes: carbonCreditsSection.className
                });
                
                // Check if carbon credit fields exist
                console.log('Carbon credits fields:', {
                    totalVERs: !!document.getElementById('totalVERs'),
                    estimatedRevenue: !!document.getElementById('estimatedRevenue'),
                    riskBuffer: !!document.getElementById('riskBuffer'),
                    nonAdditionality: !!document.getElementById('nonAdditionality')
                });
                
                // Force display carbon credits section
                carbonCreditsSection.classList.remove('hidden');
                carbonCreditsSection.style.display = 'block';
                carbonCreditsSection.style.visibility = 'visible';
                carbonCreditsSection.style.opacity = '1';
                console.log('Forced carbon credits section to be visible');
            }
            
            // Check if the CSS may be hiding elements
            console.log('Checking for CSS that might hide elements');
            const hiddenElements = document.querySelectorAll('.hidden');
            console.log(`Found ${hiddenElements.length} elements with 'hidden' class`);
            
            return "Debug check complete - see console for detailed outputs";
        }
    };
    
    // Debug tools are no longer automatically added to the page
    // They can be accessed via the browser console using forestDebug.methodName()
    console.log("Debug tools available via 'forestDebug' object in console");
});