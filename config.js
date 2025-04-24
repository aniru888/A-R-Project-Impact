import { eventBus } from './utils.js';

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