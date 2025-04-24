import config from './config.js';

/**
 * Event Bus System - Centralized event management
 */
export const eventBus = {
    events: {},
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        this.events[event].push(callback);
        
        // Return unsubscribe function
        return () => {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        };
    },
    
    /**
     * Emit an event with data
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                Logger.error(`Error in event handler for ${event}:`, error);
            }
        });
    },
    
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    },
    
    /**
     * Remove all subscribers for an event
     * @param {string} event - Event name
     */
    clear(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }
};

/**
 * Logger System - Centralized logging with levels and remote capabilities
 */
export const Logger = {
    LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    
    _getLevelValue(level) {
        return this.LEVELS[level.toUpperCase()] || this.LEVELS.INFO;
    },
    
    _shouldLog(level) {
        const configLevel = (config.logger?.level || 'info').toUpperCase();
        return this._getLevelValue(level) >= this._getLevelValue(configLevel);
    },
    
    /**
     * Log a debug message
     */
    debug(...args) {
        if (this._shouldLog('debug')) {
            if (config.logger?.enableConsole !== false) {
                console.debug('[DEBUG]', ...args);
            }
            this._sendRemoteLog('debug', args);
        }
    },
    
    /**
     * Log an info message
     */
    info(...args) {
        if (this._shouldLog('info')) {
            if (config.logger?.enableConsole !== false) {
                console.info('[INFO]', ...args);
            }
            this._sendRemoteLog('info', args);
        }
    },
    
    /**
     * Log a warning message
     */
    warn(...args) {
        if (this._shouldLog('warn')) {
            if (config.logger?.enableConsole !== false) {
                console.warn('[WARN]', ...args);
            }
            this._sendRemoteLog('warn', args);
        }
    },
    
    /**
     * Log an error message
     */
    error(...args) {
        if (this._shouldLog('error')) {
            if (config.logger?.enableConsole !== false) {
                console.error('[ERROR]', ...args);
            }
            this._sendRemoteLog('error', args);
        }
    },
    
    /**
     * Send logs to remote endpoint if configured
     */
    _sendRemoteLog(level, args) {
        if (!config.logger?.enableRemote || !config.logger?.remoteEndpoint) {
            return;
        }
        
        try {
            const serializedArgs = args.map(arg => {
                if (arg instanceof Error) {
                    return {
                        message: arg.message,
                        stack: arg.stack,
                        name: arg.name
                    };
                }
                
                return arg;
            });
            
            fetch(config.logger.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    level,
                    timestamp: new Date().toISOString(),
                    message: serializedArgs,
                    app: config.app.name,
                    version: config.app.version,
                    environment: config.app.environment
                })
            }).catch(e => console.error('Failed to send remote log:', e));
        } catch (err) {
            console.error('Failed to send remote log:', err);
        }
    }
};

/**
 * Storage Manager - Handle data persistence with localStorage/sessionStorage
 */
export class StorageManager {
    constructor(options = {}) {
        this.prefix = options.prefix || config.storage?.prefix || 'app_';
        this.storage = options.storage || (config.storage?.storageType === 'sessionStorage' ? 
            sessionStorage : localStorage);
        this.enableCompression = options.enableCompression || config.storage?.enableCompression || false;
    }
    
    /**
     * Build prefixed key
     */
    _key(key) {
        return `${this.prefix}${key}`;
    }
    
    /**
     * Set an item in storage
     */
    setItem(key, value) {
        let serializedValue;
        
        try {
            serializedValue = JSON.stringify(value);
            
            if (this.enableCompression && serializedValue.length > 1024) {
                // Basic compression for large objects could be implemented here
                // For now, just storing as is
            }
            
            this.storage.setItem(this._key(key), serializedValue);
            return true;
        } catch (error) {
            Logger.error('Failed to store value:', error);
            return false;
        }
    }
    
    /**
     * Get an item from storage
     */
    getItem(key, defaultValue = null) {
        try {
            const value = this.storage.getItem(this._key(key));
            if (value === null) return defaultValue;
            
            return JSON.parse(value);
        } catch (error) {
            Logger.error(`Failed to retrieve value for key ${key}:`, error);
            return defaultValue;
        }
    }
    
    /**
     * Remove an item from storage
     */
    removeItem(key) {
        try {
            this.storage.removeItem(this._key(key));
            return true;
        } catch (error) {
            Logger.error(`Failed to remove item with key ${key}:`, error);
            return false;
        }
    }
    
    /**
     * Clear all items associated with this application
     */
    clear() {
        try {
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key.startsWith(this.prefix)) {
                    this.storage.removeItem(key);
                }
            }
            return true;
        } catch (error) {
            Logger.error('Failed to clear storage:', error);
            return false;
        }
    }
    
    /**
     * Get all storage keys for this application
     */
    keys() {
        const keys = [];
        const prefixLength = this.prefix.length;
        
        for (let i = 0; i < this.storage.length; i++) {
            const key = this.storage.key(i);
            if (key.startsWith(this.prefix)) {
                keys.push(key.substring(prefixLength));
            }
        }
        
        return keys;
    }
}

/**
 * Common utility functions
 */

/**
 * Debounce function for limiting function calls
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle function to limit number of calls
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format a date according to locale
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    return new Date(date).toLocaleDateString(
        options.locale || undefined,
        { ...defaultOptions, ...options }
    );
}

/**
 * Generate a UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    
    return Object.fromEntries(
        Object.entries(obj).map(([key, val]) => [key, deepClone(val)])
    );
}

/**
 * Safely access nested object properties
 */
export function getNestedValue(obj, path, defaultValue = undefined) {
    const keys = Array.isArray(path) ? path : path.split('.');
    let result = obj;
    
    for (const key of keys) {
        if (result === undefined || result === null) {
            return defaultValue;
        }
        result = result[key];
    }
    
    return result === undefined ? defaultValue : result;
}

/**
 * Simple memoization for expensive functions
 */
export function memoize(fn) {
    const cache = new Map();
    return function(...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Parse a number string that might contain commas
 * @param {string|number} value - The value to parse
 * @returns {number} Parsed number
 */
export function parseNumberWithCommas(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Remove any commas and convert to float
    return parseFloat(value.toString().replace(/,/g, ''));
}

/**
 * Format a number with specified decimal places
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {boolean} addCommas - Whether to add commas for thousands (default: true)
 * @returns {string} Formatted number
 */
export function formatNumber(value, decimals = 2, addCommas = true) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0.00';
    }
    
    const options = {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    };
    
    if (addCommas) {
        return Number(value).toLocaleString(undefined, options);
    } else {
        // Format without commas
        return Number(value).toFixed(decimals);
    }
}

/**
 * Format a CO2 equivalent value with tCO₂e unit
 * @param {number} value - The CO2e value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted CO2e value with unit
 */
export function formatCO2e(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0.00 tCO₂e';
    }
    
    return `${formatNumber(value, decimals)} tCO₂e`;
}

/**
 * Export a table to CSV file
 * @param {HTMLElement} table - The HTML table element to export
 * @param {string} filename - Name of the file to download
 */
export function exportToCsv(table, filename = 'export.csv') {
    if (!table || !table.rows) {
        console.error('Invalid table element');
        return;
    }
    
    // Initialize CSV content with BOM for Excel compatibility
    let csvContent = '\ufeff';
    
    // Get all rows from the table
    const rows = table.rows;
    
    // Loop through rows
    for (let i = 0; i < rows.length; i++) {
        const rowData = [];
        const cells = rows[i].cells;
        
        // Loop through cells
        for (let j = 0; j < cells.length; j++) {
            // Get cell text, escape quotes and surround with quotes
            let cellText = cells[j].textContent.trim() || '';
            cellText = cellText.replace(/"/g, '""');
            rowData.push(`"${cellText}"`);
        }
        
        // Add row to CSV content
        csvContent += rowData.join(',') + '\r\n';
    }
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const downloadLink = document.createElement('a');
    
    // Set file name
    downloadLink.download = filename;
    
    // Create a URL for the Blob
    if (window.navigator.msSaveOrOpenBlob) {
        // For IE/Edge
        navigator.msSaveBlob(blob, filename);
    } else {
        // For other browsers
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
}
