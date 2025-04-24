// Configuration class for better management
class ConfigManager {
    constructor() {
        this._config = this._buildConfig();
    }
    
    // Build final configuration
    _buildConfig() {
        const environment = detectEnvironment();
        const envConfig = environmentConfigs[environment] || {};
        
        // Set the detected environment
        const baseConfig = {
            ...defaultConfig,
            app: {
                ...defaultConfig.app,
                environment
            }
        };
        
        // Merge with environment-specific config
        const mergedConfig = mergeDeep(baseConfig, envConfig);
        
        // Apply any runtime overrides from localStorage
        try {
            const storedOverrides = localStorage.getItem('ar_project_config_overrides');
            if (storedOverrides) {
                const overrides = JSON.parse(storedOverrides);
                return mergeDeep(mergedConfig, overrides);
            }
        } catch (err) {
            console.warn('Failed to load config overrides from localStorage', err);
        }
        
        return mergedConfig;
    }
    
    // Get a configuration value with optional default
    get(path, defaultValue) {
        const keys = path.split('.');
        let result = this._config;
        
        for (const key of keys) {
            if (result === undefined || result === null) {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    }
    
    // Initialize or reload configuration
    initialize() {
        this._config = this._buildConfig();
    }
    
    // Load module specific config
    loadModuleConfig(moduleName) {
        return this._config[moduleName] || {};
    }
    
    // Get the default configuration
    getDefaultConfig() {
        return { ...defaultConfig };
    }
}

// Default application configuration
const defaultConfig = {
    app: {
        name: "A/R Project Impact Calculator",
        version: "1.0.0",
        environment: "production",
        debug: false
    },
    forest: {
        defaultSpecies: "mixed",
        defaultConversionFactors: {
            growthRate: 10,
            woodDensity: 0.5,
            bef: 1.5,
            rsr: 0.25,
            carbonFraction: 0.47
        }
    },
    water: {
        defaultRunoffCoefficient: 0.6,
        defaultCaptureEfficiency: 75,
        defaultEnergySavings: 0.5
    },
    logger: {
        level: "info",
        enableConsole: true,
        enableRemote: false,
        remoteEndpoint: ""
    },
    storage: {
        prefix: "ar_project_",
        storageType: "localStorage",
        enableCompression: false
    },
    api: {
        baseUrl: "",
        timeout: 30000
    }
};

// Environment-specific configurations
const environmentConfigs = {
    development: {
        app: {
            debug: true
        },
        logger: {
            level: "debug"
        }
    },
    production: {
        logger: {
            level: "warn"
        }
    },
    test: {
        logger: {
            level: "error",
            enableConsole: false
        }
    }
};

// Detect the current environment
function detectEnvironment() {
    // Check for explicit environment setting
    const explicitEnv = localStorage.getItem('ar_project_environment');
    if (explicitEnv) return explicitEnv;
    
    // Check for development indicators
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.port === '5500' || 
        window.location.port === '5501') {
        return 'development';
    }
    
    // Check for test environment
    if (window.location.hostname.includes('test.') || 
        window.location.hostname.includes('-test')) {
        return 'test';
    }
    
    // Default to production
    return 'production';
}

// Deep merge utility for configs
function mergeDeep(target, source) {
    const output = Object.assign({}, target);
    
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// Create and export a singleton instance
const config = new ConfigManager();

// Export the singleton as default
export default config;