import { 
    calculateSequestration, 
    calculateSequestrationMultiSpecies,
    getAndValidateForestInputs
} from './forestCalcs.js';

import { 
    displayForestResults,
    showForestError,
    clearForestErrors,
    validateForestInput,
    resetForestCharts
} from './forestDOM.js';

import {
    downloadExcelTemplate,
    generateForestPdf,
    exportForestExcel,
    setupForestFileUploads
} from './forestIO.js';

import { setupGreenCoverAndCredits } from './forestEnhanced.js';

import { analytics } from '../analytics.js';

export const C_TO_CO2 = 44 / 12;
export const MIN_DURATION = 4;
export const MAX_DURATION = 50;
export const MIN_DENSITY = 100;

export class ForestCalculatorManager {
    constructor() {
        this.speciesData = [];
        this.activeFileUpload = false;
        this.greenCoverAndCreditsSetup = null;
        this.form = null;
        this.calculateBtn = null;
        this.resetBtn = null;
        this.errorMessageDiv = null;
        this.resultsSection = null;
        this.projectCostInput = null;
        this.getSpeciesData = () => this.speciesData;
        this.isActiveFileUpload = () => this.activeFileUpload;
    }
    
    init() {
        this.form = document.getElementById('calculator
