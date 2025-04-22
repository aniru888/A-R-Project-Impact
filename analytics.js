// analytics.js - Analytics system to track user interactions and application performance

import config from './config.js';
import { Logger, eventBus } from './utils.js';

/**
 * Analytics Manager Class
 * Handles tracking of user interactions and application metrics
 */
export class AnalyticsManager {
    constructor() {
        this.config = config.analytics || {
            enabled: config.features?.enableAnalytics || false,
            trackingId: null,
            anonymizeIp: true,
            sampleRate: 100, // 100%
            maxEvents: 500,
            batchSize: 20,
            flushInterval: 30000 // 30 seconds
        };
        
        this.initialized = false;
        this.queue = [];
        this.flushTimer = null;
        this.sessionId = null;
        this.clientId = null;
        this.isOnline = navigator.onLine;
    }

    /**
     * Initialize the analytics system
     * @param {Object} [options] - Override options
     * @returns {AnalyticsManager} this instance for chaining
     */
    init(options = {}) {
        if (this.initialized) {
            return this;
        }
        
        // Merge options with config
        Object.assign(this.config, options);
        
        // Don't initialize if analytics are disabled
        if (!this.config.enabled) {
            Logger.info('Analytics are disabled');
            return this;
        }
        
        try {
            // Generate/retrieve unique identifiers
            this.clientId = this._getClientId();
            this.sessionId = this._generateSessionId();
            
            // Set up event listeners
            this._setupEventListeners();
            
            // Start flush timer
            this._startFlushTimer();
            
            // Track initial page view
            this.trackPageView(window.location.pathname);
            
            // Setup online/offline detection
            this._setupOnlineDetection();
            
            // Check for stored offline events and attempt to sync them
            this._checkOfflineEvents();
            
            this.initialized = true;
            Logger.info('Analytics initialized', { clientId: this.clientId });
        } catch (error) {
            Logger.error('Failed to initialize analytics', error);
        }
        
        return this;
    }
    
    /**
     * Track a custom event
     * @param {string} eventCategory - Event category
     * @param {string} eventAction - Event action
     * @param {string} [eventLabel] - Event label
     * @param {number} [eventValue] - Event value
     */
    trackEvent(eventCategory, eventAction, eventLabel = null, eventValue = null) {
        try {
            if (!this.config.enabled) return;
            
            this._addToQueue({
                type: 'event',
                category: eventCategory,
                action: eventAction,
                label: eventLabel,
                value: eventValue,
                timestamp: Date.now()
            });
        } catch (error) {
            // Silently catch errors to prevent button functionality issues
            console.error('Analytics tracking error:', error);
        }
    }
    
    /**
     * Track a page view
     * @param {string} page - Page path
     * @param {string} [title] - Page title
     */
    trackPageView(page, title = document.title) {
        if (!this.config.enabled) return;
        
        this._addToQueue({
            type: 'pageview',
            page,
            title,
            timestamp: Date.now()
        });
    }
    
    /**
     * Track a feature usage
     * @param {string} featureId - Feature identifier
     * @param {Object} [data] - Additional data about the feature use
     */
    trackFeatureUsage(featureId, data = {}) {
        if (!this.config.enabled) return;
        
        this._addToQueue({
            type: 'feature',
            featureId,
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Track a form submission
     * @param {string} formId - Form identifier
     * @param {boolean} success - Whether submission was successful
     * @param {number} [timeSpent] - Time spent on form in ms
     */
    trackFormSubmission(formId, success, timeSpent = null) {
        if (!this.config.enabled) return;
        
        this._addToQueue({
            type: 'form',
            formId,
            success,
            timeSpent,
            timestamp: Date.now()
        });
    }
    
    /**
     * Track an error
     * @param {string} errorMessage - Error message
     * @param {string} [errorSource] - Source of the error
     * @param {Object} [errorDetails] - Additional error details
     */
    trackError(errorMessage, errorSource = null, errorDetails = {}) {
        if (!this.config.enabled) return;
        
        this._addToQueue({
            type: 'error',
            message: errorMessage,
            source: errorSource,
            details: errorDetails,
            timestamp: Date.now()
        });
        
        // Flush immediately for errors to ensure they're captured
        this.flush();
    }
    
    /**
     * Track performance data
     * @param {string} metricName - Name of the performance metric
     * @param {number} value - Performance value (usually in milliseconds)
     */
    trackPerformance(metricName, value) {
        if (!this.config.enabled) return;
        
        this._addToQueue({
            type: 'performance',
            metric: metricName,
            value,
            timestamp: Date.now()
        });
    }
    
    /**
     * Track calculation result
     * @param {string} calculationType - Type of calculation
     * @param {Object} inputs - Input values used
     * @param {Object} results - Calculated results
     * @param {number} duration - Calculation duration in ms
     */
    trackCalculation(calculationType, inputs, results, duration) {
        if (!this.config.enabled) return;
        
        this._addToQueue({
            type: 'calculation',
            calculationType,
            inputs: this._sanitizeData(inputs),
            // Only track summary of results, not full details
            resultSummary: this._extractResultSummary(calculationType, results),
            duration,
            timestamp: Date.now()
        });
    }
    
    /**
     * Immediately send all queued events
     * @returns {Promise<boolean>} Whether flush was successful
     */
    async flush() {
        if (!this.config.enabled || this.queue.length === 0) {
            return true;
        }
        
        try {
            // Process in batches
            while (this.queue.length > 0) {
                const batch = this.queue.splice(0, this.config.batchSize);
                await this._sendEvents(batch);
            }
            return true;
        } catch (error) {
            Logger.error('Failed to flush analytics events', error);
            
            // Put events back in queue for retry
            if (this.queue.length < this.config.maxEvents) {
                this.queue = [...batch, ...this.queue];
            }
            return false;
        }
    }
    
    /**
     * Disable analytics and clear queue
     */
    disable() {
        this.config.enabled = false;
        this.queue = [];
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        Logger.info('Analytics disabled');
    }
    
    /**
     * Re-enable analytics
     */
    enable() {
        if (!this.initialized) {
            return this.init();
        }
        this.config.enabled = true;
        this._startFlushTimer();
        Logger.info('Analytics enabled');
        return this;
    }
    
    /**
     * Add an event to the queue
     * @private
     * @param {Object} event - Event data
     */
    _addToQueue(event) {
        // Add common properties
        const enrichedEvent = {
            ...event,
            clientId: this.clientId,
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.queue.push(enrichedEvent);
        
        // If queue is too large, flush immediately or remove older events
        if (this.queue.length >= this.config.maxEvents) {
            this.flush();
        }
    }
    
    /**
     * Get or create a persistent client ID
     * @private
     * @returns {string} Client ID
     */
    _getClientId() {
        let clientId = localStorage.getItem('ar_project_analytics_client_id');
        
        if (!clientId) {
            clientId = 'ar-' + Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
            localStorage.setItem('ar_project_analytics_client_id', clientId);
        }
        
        return clientId;
    }
    
    /**
     * Generate a session ID
     * @private
     * @returns {string} Session ID
     */
    _generateSessionId() {
        return 'session-' + Date.now().toString(36) + '-' + 
               Math.random().toString(36).substring(2, 9);
    }
    
    /**
     * Start the flush timer
     * @private
     */
    _startFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    
    /**
     * Set up application event listeners
     * @private
     */
    _setupEventListeners() {
        // Listen for page transitions
        window.addEventListener('popstate', () => {
            this.trackPageView(window.location.pathname);
        });
        
        // Listen for form submissions
        eventBus.on('form:submit', (data) => {
            this.trackFormSubmission(data.formId, true);
        });
        
        // Track tab changes
        eventBus.on('ui:tabChanged', (data) => {
            this.trackEvent('UI', 'TabChanged', data.tabId);
        });
        
        // Track theme changes
        eventBus.on('ui:themeChanged', (data) => {
            this.trackEvent('UI', 'ThemeChanged', data.theme);
        });
        
        // Track calculation events
        eventBus.on('calculation:completed', (data) => {
            this.trackCalculation(data.type, data.inputs, data.results, data.duration);
        });
        
        // Track application errors
        window.addEventListener('error', (event) => {
            this.trackError(
                event.message,
                'global',
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            );
        });
        
        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError(
                'Unhandled Promise Rejection',
                'promise',
                { reason: String(event.reason) }
            );
        });
    }
    
    /**
     * Set up online/offline detection
     * @private
     */
    _setupOnlineDetection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            Logger.debug('Network connection restored');
            this._checkOfflineEvents();
            // Normal flush will resume
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            Logger.debug('Network connection lost');
            // Events will be stored locally until connection is restored
        });
    }
    
    /**
     * Check for events stored while offline and attempt to sync them
     * @private
     */
    async _checkOfflineEvents() {
        if (!this.isOnline) return;
        
        try {
            // Check if the service worker is available
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                // Trigger the background sync
                await navigator.serviceWorker.ready;
                await navigator.serviceWorker.sync.register('analytics-sync');
                Logger.debug('Triggered analytics background sync');
            } else {
                // Fallback for when service worker isn't available
                await this._loadOfflineEvents();
            }
        } catch (error) {
            Logger.error('Failed to sync offline events', error);
        }
    }
    
    /**
     * Load events stored in IndexedDB while offline
     * @private
     */
    async _loadOfflineEvents() {
        if (!window.indexedDB) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AnalyticsOfflineStore', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { autoIncrement: true });
                }
            };
            
            request.onerror = (event) => {
                Logger.error('IndexedDB error', event);
                reject(event);
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction('events', 'readwrite');
                const store = transaction.objectStore('events');
                
                // Get all stored events
                const getAllRequest = store.getAll();
                
                getAllRequest.onsuccess = () => {
                    const offlineEvents = getAllRequest.result || [];
                    
                    if (offlineEvents.length > 0) {
                        Logger.debug(`Found ${offlineEvents.length} offline events to sync`);
                        
                        // Add to regular queue for processing
                        this.queue.push(...offlineEvents);
                        
                        // Immediately try to flush these events
                        this.flush().then(() => {
                            // If successful, clear the offline store
                            const clearRequest = store.clear();
                            clearRequest.onsuccess = () => {
                                Logger.debug('Cleared offline event store after successful sync');
                                resolve(true);
                            };
                            clearRequest.onerror = (err) => {
                                Logger.error('Failed to clear offline event store', err);
                                reject(err);
                            };
                        }).catch(reject);
                    } else {
                        resolve(false);
                    }
                };
                
                getAllRequest.onerror = (err) => {
                    Logger.error('Failed to fetch offline events', err);
                    reject(err);
                };
            };
        });
    }
    
    /**
     * Send events to the analytics endpoint
     * @private
     * @param {Array} events - Events to send
     * @returns {Promise<Object>} Response data
     */
    async _sendEvents(events) {
        // If offline, store events locally for later sync
        if (!this.isOnline) {
            await this._storeOfflineEvents(events);
            return { success: true, stored: true };
        }
        
        // For now, we'll just log events to console in development
        // In production this would send to an actual analytics endpoint
        if (config.app.environment === 'development') {
            Logger.debug('Would send analytics events:', events);
            return { success: true };
        }
        
        // In production, send to actual analytics endpoint
        const url = this.config.endpoint || '/api/analytics';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    events,
                    clientId: this.clientId,
                    sessionId: this.sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error(`Analytics API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            // If network error, store events for later
            await this._storeOfflineEvents(events);
            throw error;
        }
    }
    
    /**
     * Store events locally when offline
     * @private
     * @param {Array} events - Events to store
     */
    async _storeOfflineEvents(events) {
        if (!window.indexedDB) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AnalyticsOfflineStore', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { autoIncrement: true });
                }
            };
            
            request.onerror = (event) => {
                Logger.error('IndexedDB error', event);
                reject(event);
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction('events', 'readwrite');
                const store = transaction.objectStore('events');
                
                // Store each event
                let completed = 0;
                let errors = 0;
                
                events.forEach(event => {
                    // Add timestamp for when this was stored offline
                    const eventWithOfflineStamp = {
                        ...event,
                        offlineStoredAt: Date.now()
                    };
                    
                    const addRequest = store.add(eventWithOfflineStamp);
                    
                    addRequest.onsuccess = () => {
                        completed++;
                        if (completed + errors === events.length) {
                            if (errors === 0) {
                                Logger.debug(`Stored ${events.length} events for offline sync`);
                                resolve();
                            } else {
                                reject(new Error(`Failed to store ${errors} offline events`));
                            }
                        }
                    };
                    
                    addRequest.onerror = (error) => {
                        errors++;
                        Logger.error('Error storing offline event', error);
                        if (completed + errors === events.length) {
                            reject(new Error(`Failed to store ${errors} offline events`));
                        }
                    };
                });
                
                transaction.oncomplete = () => {
                    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                        // Register background sync if available
                        navigator.serviceWorker.ready.then(registration => {
                            try {
                                registration.sync.register('analytics-sync').then(() => {
                                    Logger.debug('Registered analytics background sync');
                                }).catch(err => {
                                    Logger.error('Error registering background sync', err);
                                });
                            } catch (e) {
                                Logger.error('Background sync registration error', e);
                            }
                        }).catch(err => {
                            Logger.error('Service worker ready error', err);
                        });
                    }
                };
            };
        });
    }
    
    /**
     * Sanitize data to remove sensitive information
     * @private
     * @param {Object} data - Data to sanitize
     * @returns {Object} Sanitized data
     */
    _sanitizeData(data) {
        // Clone to avoid modifying original data
        const sanitized = JSON.parse(JSON.stringify(data));
        
        // Remove potential sensitive fields
        const sensitiveFields = ['password', 'email', 'phone', 'token', 'secret'];
        
        const sanitizeObj = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            
            Object.keys(obj).forEach(key => {
                // If this is a sensitive field, replace value
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    obj[key] = '[REDACTED]';
                } else if (typeof obj[key] === 'object') {
                    // Recursively sanitize objects
                    sanitizeObj(obj[key]);
                }
            });
        };
        
        sanitizeObj(sanitized);
        return sanitized;
    }
    
    /**
     * Extract a summary of calculation results for analytics
     * @private
     * @param {string} calculationType - Type of calculation
     * @param {Object} results - Full calculation results
     * @returns {Object} Results summary
     */
    _extractResultSummary(calculationType, results) {
        if (!results) return { status: 'no_results' };
        
        try {
            switch (calculationType) {
                case 'forest':
                    return {
                        totalSequestration: results.totalResults?.[results.totalResults.length - 1]?.cumulativeNetCO2e,
                        numSpecies: results.speciesResults?.length,
                        duration: results.totalResults?.length
                    };
                case 'water':
                    return {
                        totalSavings: results.totalSavings,
                        efficiency: results.efficiency
                    };
                default:
                    return {
                        hasResults: !!results
                    };
            }
        } catch (error) {
            Logger.error('Error extracting result summary', error);
            return { status: 'error_extracting_summary' };
        }
    }
}

// Create singleton instance
export const analytics = new AnalyticsManager();

// Initialize analytics when the module is imported
if (config.features?.enableAnalytics) {
    // Wait for DOM to load before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => analytics.init());
    } else {
        analytics.init();
    }
}