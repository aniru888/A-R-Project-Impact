// filepath: /workspaces/A-R-Project-Impact/config.js
/**
 * Application Configuration System
 * Centralizes all configuration settings and provides environment-specific overrides
 */

// Default configuration
const defaultConfig = {
    // Application metadata
    app: {
        name: 'A-R-Project-Impact',
        version: '1.0.0',
        environment: 'development'
    },
    
    // Feature flags
    features: {
        experimentalFeatures: false,
        useLegacyMode: false,
        enableAnalytics: true
    },
    
    // Logger configuration
    logger: {
        level: 'info', // 'debug', 'info', 'warn', 'error'
        enableConsole: true,
        enableRemote: false,
        remoteEndpoint: '/api/logs'
    },
    
    // Storage configuration
    storage: {
        prefix: 'ar_project_',
        enableCompression: false,
        storageType: 'localStorage' // 'localStorage', 'sessionStorage', 'indexedDB'
    },
    
    // UI configuration
    ui: {
        defaultTheme: 'light',
        throttleTime: 250, // ms for throttling resize events
        breakpoints: {
            mobile: 768,
            tablet: 1024
        },
        animations: {
            enabled: true,
            duration: 300
        }
    },
    
    // API configuration
    api: {
        baseUrl: '/api',
        timeout: 30000,
        retries: 2,
        headers: {
            'Content-Type': 'application/json'
        }
    },
    
    // Forest module configuration
    forest: {
        defaultTreeType: 'pine',
        simulationSpeed: 1.0,
        maxTrees: 500,
        initialTrees: 100
    },
    
    // Storage keys
    storageKeys: {
        theme: 'ar_project_theme',
        userData: 'ar_project_user_data',
        simulationState: 'ar_project_sim_state'
    }
};

// Environment-specific configurations
const environmentConfigs = {
    development: {
        logger: {
            level: 'debug'
        },
        features: {
            experimentalFeatures: true
        }
    },
    test: {
        logger: {
            level: 'info'
        }
    },
    production: {
        logger: {
            level: 'warn',
            enableRemote: true
        },
        features: {
            experimentalFeatures: false
        }
    }
};

// Detect environment
const detectEnvironment = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'development';
    } else if (window.location.hostname.includes('test') || window.location.hostname.includes('staging')) {
        return 'test';
    } else {
        return 'production';
    }
};

// Deep merge utility for configs
const mergeDeep = (target, source) => {
    if (!source) return target;
    const output = { ...target };
    
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
};

const isObject = (item) => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};

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

// Create and export a singleton instance
const config = new ConfigManager();
export default config;