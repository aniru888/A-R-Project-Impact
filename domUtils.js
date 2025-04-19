import { eventBus, Logger, debounce, throttle } from './utils.js';
import { config } from './config.js';

/**
 * UIManager - Manages UI components initialization and lifecycle
 */
export class UIManager {
    constructor() {
        this.components = new Map();
        this.tooltips = new Map();
        this.initialized = false;
        this.config = config.ui || {};
    }

    /**
     * Initialize all UI components
     */
    initialize() {
        if (this.initialized) {
            Logger.warn('UIManager already initialized');
            return;
        }
        
        // Initialize tooltips
        this.initTooltips();
        
        // Initialize responsive behaviors
        this.initResponsiveUI();
        
        // Initialize tab navigation
        this.initTabNavigation();
        
        // Register global event listeners
        this.registerGlobalEvents();
        
        this.initialized = true;
        eventBus.emit('ui:initialized', { success: true });
        Logger.info('UIManager initialized');
    }
    
    /**
     * Initialize tooltip functionality
     */
    initTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            const tooltip = this.createTooltip(element);
            this.tooltips.set(element.id || this.generateId(), tooltip);
        });
        
        Logger.debug(`Initialized ${this.tooltips.size} tooltips`);
    }
    
    /**
     * Creates a tooltip for an element
     * @param {HTMLElement} element - Element to attach tooltip to
     * @returns {Object} Tooltip object
     */
    createTooltip(element) {
        const tooltipText = element.getAttribute('data-tooltip');
        const tooltipPosition = element.getAttribute('data-tooltip-position') || 'top';
        
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${tooltipPosition}`;
        tooltip.textContent = tooltipText;
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
        
        // Position tooltip near the element
        const positionTooltip = () => {
            const rect = element.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            
            switch (tooltipPosition) {
                case 'top':
                    tooltip.style.top = `${rect.top + scrollY - tooltip.offsetHeight - 5}px`;
                    tooltip.style.left = `${rect.left + scrollX + rect.width/2 - tooltip.offsetWidth/2}px`;
                    break;
                case 'bottom':
                    tooltip.style.top = `${rect.bottom + scrollY + 5}px`;
                    tooltip.style.left = `${rect.left + scrollX + rect.width/2 - tooltip.offsetWidth/2}px`;
                    break;
                case 'left':
                    tooltip.style.top = `${rect.top + scrollY + rect.height/2 - tooltip.offsetHeight/2}px`;
                    tooltip.style.left = `${rect.left + scrollX - tooltip.offsetWidth - 5}px`;
                    break;
                case 'right':
                    tooltip.style.top = `${rect.top + scrollY + rect.height/2 - tooltip.offsetHeight/2}px`;
                    tooltip.style.left = `${rect.right + scrollX + 5}px`;
                    break;
            }
        };
        
        // Setup event listeners
        const showTooltip = () => {
            positionTooltip();
            tooltip.style.display = 'block';
            setTimeout(() => tooltip.classList.add('show'), 10);
        };
        
        const hideTooltip = () => {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.style.display = 'none', 200);
        };
        
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('focus', showTooltip);
        element.addEventListener('blur', hideTooltip);
        
        return {
            element: tooltip,
            update(text) {
                tooltip.textContent = text;
            },
            destroy() {
                element.removeEventListener('mouseenter', showTooltip);
                element.removeEventListener('mouseleave', hideTooltip);
                element.removeEventListener('focus', showTooltip);
                element.removeEventListener('blur', hideTooltip);
                document.body.removeChild(tooltip);
            }
        };
    }
    
    /**
     * Initialize responsive UI behaviors
     */
    initResponsiveUI() {
        const breakpoints = this.config.breakpoints || {
            mobile: 768,
            tablet: 1024
        };
        
        const handleResize = throttle(() => {
            const width = window.innerWidth;
            const isMobile = width < breakpoints.mobile;
            const isTablet = width >= breakpoints.mobile && width < breakpoints.tablet;
            
            document.body.classList.toggle('mobile-view', isMobile);
            document.body.classList.toggle('tablet-view', isTablet);
            document.body.classList.toggle('desktop-view', width >= breakpoints.tablet);
            
            eventBus.emit('ui:resized', { 
                isMobile, 
                isTablet, 
                width: window.innerWidth,
                height: window.innerHeight
            });
        }, this.config.throttleTime || 250);
        
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check
    }
    
    /**
     * Initialize tab navigation
     */
    initTabNavigation() {
        const tabContainers = document.querySelectorAll('.tab-container');
        
        tabContainers.forEach(container => {
            const tabs = container.querySelectorAll('.tab-button');
            const tabContents = container.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.getAttribute('data-tab');
                    
                    // Update tab buttons
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    // Update tab contents
                    tabContents.forEach(content => {
                        content.classList.remove('active');
                        if (content.id === targetId) {
                            content.classList.add('active');
                        }
                    });
                    
                    eventBus.emit('ui:tabChanged', { tabId: targetId });
                });
            });
            
            // Activate first tab by default if none active
            if (!Array.from(tabs).some(tab => tab.classList.contains('active'))) {
                tabs[0]?.click();
            }
        });
        
        // Handle project tabs (forest/water)
        this.initProjectTabs();
    }
    
    /**
     * Initialize project tab switching functionality
     */
    initProjectTabs() {
        const projectTabs = document.querySelectorAll('.project-tab');
        const projectContents = document.querySelectorAll('.project-content');
        
        projectTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const projectType = tab.getAttribute('data-project');
                
                // Update tab buttons
                projectTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update content sections
                projectContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.getAttribute('data-project') === projectType) {
                        content.classList.add('active');
                    }
                });
                
                // Hide any results sections when switching tabs
                const forestResultsSection = document.getElementById('resultsSectionForest');
                const waterResultsSection = document.getElementById('resultsSectionWater');
                
                if (forestResultsSection) forestResultsSection.classList.add('hidden');
                if (waterResultsSection) waterResultsSection.classList.add('hidden');
                
                eventBus.emit('project:changed', { project: projectType });
            });
        });
    }
    
    /**
     * Register global event listeners
     */
    registerGlobalEvents() {
        // Handle form submissions
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form.getAttribute('data-prevent-default') === 'true') {
                event.preventDefault();
                eventBus.emit('form:submit', { 
                    formId: form.id,
                    formData: new FormData(form)
                });
            }
        });
        
        // Handle theme switching if present
        const themeToggle = document.querySelector('#theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                document.body.classList.toggle('dark-theme');
                localStorage.setItem(config.storageKeys.theme || 'theme', newTheme);
                eventBus.emit('ui:themeChanged', { theme: newTheme });
            });
            
            // Set initial theme from storage
            const storageKey = config.storageKeys.theme || 'theme';
            const savedTheme = localStorage.getItem(storageKey);
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const defaultTheme = this.config.defaultTheme || (prefersDark ? 'dark' : 'light');
            
            if (savedTheme === 'dark' || (savedTheme === null && defaultTheme === 'dark')) {
                document.body.classList.add('dark-theme');
            }
        }
    }
    
    /**
     * Register a component with the UI manager
     * @param {string} id - Component identifier
     * @param {Object} component - Component object with init and destroy methods
     */
    registerComponent(id, component) {
        if (!component || typeof component.init !== 'function') {
            Logger.error('Invalid component registered', { id });
            return false;
        }
        
        this.components.set(id, component);
        Logger.debug(`Registered component: ${id}`);
        return true;
    }
    
    /**
     * Initialize a registered component
     * @param {string} id - Component identifier
     * @param {Object} [options] - Initialization options
     * @returns {boolean} Success status
     */
    initComponent(id, options = {}) {
        const component = this.components.get(id);
        if (!component) {
            Logger.warn(`Component not found: ${id}`);
            return false;
        }
        
        try {
            component.init(options);
            Logger.debug(`Initialized component: ${id}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to initialize component: ${id}`, error);
            return false;
        }
    }
    
    /**
     * Destroy a component, removing it from the DOM and unregistering it
     * @param {string} id - Component identifier
     */
    destroyComponent(id) {
        const component = this.components.get(id);
        if (!component) {
            return false;
        }
        
        try {
            if (typeof component.destroy === 'function') {
                component.destroy();
            }
            this.components.delete(id);
            Logger.debug(`Destroyed component: ${id}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to destroy component: ${id}`, error);
            return false;
        }
    }
    
    /**
     * Generate a unique ID for elements
     * @returns {string} Unique ID
     */
    generateId() {
        return `ui-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    
    /**
     * Create a modal dialog
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.content - Modal HTML content
     * @param {boolean} [options.closable=true] - Whether modal can be closed
     * @param {Function} [options.onClose] - Callback when modal closes
     * @returns {Object} Modal control object
     */
    createModal(options) {
        const modalId = this.generateId();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = modalId;
        
        const modalContent = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>${options.title || 'Information'}</h3>
                    ${options.closable !== false ? '<button class="modal-close">&times;</button>' : ''}
                </div>
                <div class="modal-body">
                    ${options.content}
                </div>
                <div class="modal-footer">
                    ${options.footer || '<button class="btn btn-primary modal-ok">OK</button>'}
                </div>
            </div>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        
        // Show the modal
        setTimeout(() => modal.classList.add('show'), 10);
        
        // Handle closing
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
                if (typeof options.onClose === 'function') {
                    options.onClose();
                }
            }, 300);
        };
        
        if (options.closable !== false) {
            modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
            modal.querySelector('.modal-ok')?.addEventListener('click', closeModal);
            
            // Close when clicking outside
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    closeModal();
                }
            });
            
            // Close with ESC key
            const escHandler = (event) => {
                if (event.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }
        
        return {
            id: modalId,
            close: closeModal,
            update(content) {
                modal.querySelector('.modal-body').innerHTML = content;
            }
        };
    }
    
    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     * @param {string} options.message - Toast message
     * @param {string} [options.type='info'] - Toast type (info, success, warning, error)
     * @param {number} [options.duration=3000] - Display duration in ms
     * @returns {Object} Toast control object
     */
    showToast(options) {
        const toastId = this.generateId();
        const toast = document.createElement('div');
        toast.className = `toast toast-${options.type || 'info'}`;
        toast.id = toastId;
        toast.innerHTML = `
            <div class="toast-message">${options.message}</div>
            <button class="toast-close">&times;</button>
        `;
        
        const toastContainer = document.querySelector('.toast-container') || (() => {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
            return container;
        })();
        
        toastContainer.appendChild(toast);
        
        // Show with animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Set auto hide timer
        const duration = options.duration || 3000;
        const hideTimeout = setTimeout(hideToast, duration);
        
        // Handle close button
        toast.querySelector('.toast-close').addEventListener('click', hideToast);
        
        function hideToast() {
            clearTimeout(hideTimeout);
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
                
                // Remove container if empty
                if (toastContainer.children.length === 0) {
                    document.body.removeChild(toastContainer);
                }
            }, 300);
        }
        
        return {
            id: toastId,
            hide: hideToast
        };
    }
    
    /**
     * Create or update a loading indicator
     * @param {string} [containerId] - Container element ID
     * @param {Object} [options] - Loading options
     * @param {string} [options.text] - Loading text
     * @param {boolean} [options.overlay=true] - Show full page overlay
     * @returns {Object} Loading control object
     */
    showLoading(containerId, options = {}) {
        const container = containerId ? document.getElementById(containerId) : document.body;
        const loadingId = `loading-${this.generateId()}`;
        
        // Create loader element
        const loader = document.createElement('div');
        loader.id = loadingId;
        loader.className = options.overlay !== false ? 'loading-overlay' : 'loading-inline';
        
        loader.innerHTML = `
            <div class="loading-spinner"></div>
            ${options.text ? `<div class="loading-text">${options.text}</div>` : ''}
        `;
        
        container.appendChild(loader);
        
        if (options.overlay !== false) {
            document.body.classList.add('loading-active');
        }
        
        return {
            id: loadingId,
            update(text) {
                const textElement = loader.querySelector('.loading-text');
                if (textElement) {
                    textElement.textContent = text;
                } else if (text) {
                    const newTextElement = document.createElement('div');
                    newTextElement.className = 'loading-text';
                    newTextElement.textContent = text;
                    loader.appendChild(newTextElement);
                }
            },
            hide() {
                if (options.overlay !== false) {
                    document.body.classList.remove('loading-active');
                }
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }
        };
    }

    /**
     * Show a system notification using the Notifications API
     * @param {Object} options - Notification options
     * @param {string} options.title - Notification title
     * @param {string} [options.body] - Notification body text
     * @param {string} [options.icon] - URL to notification icon
     * @param {Function} [options.onClick] - Callback when notification is clicked
     * @returns {Promise<Notification|null>} Created notification or null if permission denied
     */
    showNotification(options) {
        return new Promise((resolve) => {
            if (!('Notification' in window)) {
                this.showToast({
                    message: 'Notifications not supported in this browser',
                    type: 'warning'
                });
                resolve(null);
                return;
            }
            
            if (Notification.permission === 'granted') {
                this._createNotification(options, resolve);
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        this._createNotification(options, resolve);
                    } else {
                        this.showToast({
                            message: 'Notification permission denied',
                            type: 'info'
                        });
                        resolve(null);
                    }
                });
            } else {
                this.showToast({
                    message: 'Notification permission denied',
                    type: 'info'
                });
                resolve(null);
            }
        });
    }
    
    /**
     * Create a notification with given options
     * @private
     */
    _createNotification(options, resolve) {
        try {
            const notification = new Notification(options.title, {
                body: options.body || '',
                icon: options.icon || '/favicon.ico',
                badge: options.badge || '/favicon.ico'
            });
            
            if (typeof options.onClick === 'function') {
                notification.onclick = options.onClick;
            }
            
            notification.onclose = () => {
                eventBus.emit('notification:closed', { title: options.title });
            };
            
            eventBus.emit('notification:shown', { title: options.title });
            resolve(notification);
        } catch (error) {
            Logger.error('Failed to create notification', error);
            this.showToast({
                message: 'Failed to create notification',
                type: 'error'
            });
            resolve(null);
        }
    }
}

// Export singleton instance
export const uiManager = new UIManager();

// DOM utility functions

/**
 * Creates and returns a DOM element
 * @param {string} tag - Element tag name
 * @param {Object} attributes - Element attributes
 * @param {string|Element|Array} children - Child elements or text
 * @returns {HTMLElement} Created DOM element
 */
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(element.dataset, value);
        } else if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Append children
    if (children) {
        if (!Array.isArray(children)) {
            children = [children];
        }
        
        children.forEach(child => {
            if (child instanceof Element) {
                element.appendChild(child);
            } else if (child !== null && child !== undefined) {
                element.appendChild(document.createTextNode(String(child)));
            }
        });
    }
    
    return element;
}

/**
 * Creates an HTML element from an HTML string
 * @param {string} html - HTML string
 * @returns {HTMLElement} Created HTML element
 */
export function createElementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

/**
 * Safely queries an element by selector
 * @param {string} selector - CSS selector
 * @param {Element} [parent=document] - Parent element to search within
 * @returns {Element|null} Found element or null
 */
export function querySelector(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        Logger.error(`Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Safely queries all elements by selector
 * @param {string} selector - CSS selector
 * @param {Element} [parent=document] - Parent element to search within
 * @returns {NodeList} Found elements
 */
export function querySelectorAll(selector, parent = document) {
    try {
        return parent.querySelectorAll(selector);
    } catch (error) {
        Logger.error(`Invalid selector: ${selector}`, error);
        return [];
    }
}

/**
 * Checks if an element matches a selector
 * @param {Element} element - Element to check
 * @param {string} selector - CSS selector
 * @returns {boolean} True if element matches selector
 */
export function matches(element, selector) {
    if (!element || !selector) return false;
    try {
        return element.matches(selector);
    } catch (error) {
        Logger.error(`Invalid selector: ${selector}`, error);
        return false;
    }
}

/**
 * Finds the closest ancestor matching a selector
 * @param {Element} element - Element to start from
 * @param {string} selector - CSS selector
 * @returns {Element|null} Found ancestor or null
 */
export function closest(element, selector) {
    if (!element || !selector) return null;
    try {
        return element.closest(selector);
    } catch (error) {
        Logger.error(`Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Adds a delegated event listener to a parent element
 * @param {Element} parent - Parent element
 * @param {string} eventType - Event type (e.g., 'click')
 * @param {string} selector - CSS selector for target elements
 * @param {Function} callback - Event handler
 * @returns {Function} Function to remove the event listener
 */
export function delegateEvent(parent, eventType, selector, callback) {
    const handler = (event) => {
        const target = event.target;
        let current = target;
        
        while (current && current !== parent) {
            if (matches(current, selector)) {
                // Call with matched element as context and event target
                callback.call(current, event, current);
                return;
            }
            current = current.parentElement;
        }
    };
    
    parent.addEventListener(eventType, handler);
    
    // Return function to remove event listener
    return () => {
        parent.removeEventListener(eventType, handler);
    };
}

/**
 * Adds or removes a class based on a condition
 * @param {Element} element - Element to modify
 * @param {string} className - Class to toggle
 * @param {boolean} condition - Whether to add (true) or remove (false) the class
 */
export function toggleClass(element, className, condition) {
    if (!element) return;
    
    if (condition || condition === undefined) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}

/**
 * Sets multiple CSS properties on an element
 * @param {Element} element - Element to style
 * @param {Object} styles - CSS styles to apply
 */
export function setStyles(element, styles = {}) {
    if (!element) return;
    Object.assign(element.style, styles);
}

/**
 * Gets form data as a plain object
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} Form data as key-value pairs
 */
export function getFormData(form) {
    if (!form || !(form instanceof HTMLFormElement)) {
        return {};
    }
    
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        // Handle checkboxes and multi-select
        if (data[key] !== undefined) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }
    
    return data;
}

/**
 * Sets form field values from a data object
 * @param {HTMLFormElement} form - Form element
 * @param {Object} data - Data to populate form with
 */
export function setFormData(form, data = {}) {
    if (!form || !(form instanceof HTMLFormElement)) {
        return;
    }
    
    Object.entries(data).forEach(([name, value]) => {
        const field = form.elements[name];
        if (!field) return;
        
        if (field.type === 'checkbox') {
            field.checked = Boolean(value);
        } else if (field.type === 'radio') {
            const radio = Array.from(form.elements[name]).find(r => r.value === String(value));
            if (radio) radio.checked = true;
        } else if (field.tagName === 'SELECT' && field.multiple) {
            Array.from(field.options).forEach(option => {
                const values = Array.isArray(value) ? value : [value];
                option.selected = values.includes(option.value);
            });
        } else {
            field.value = value;
        }
    });
}

/**
 * Creates a chart in a canvas element
 * @param {string} canvasId - Canvas element ID
 * @param {string} type - Chart type ('bar', 'line', 'pie', etc.)
 * @param {Object} data - Chart data
 * @param {Object} [options] - Chart options
 * @returns {Object|null} Chart instance or null if failed
 */
export function createChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext || typeof Chart === 'undefined') {
        Logger.error('Cannot create chart: Canvas not found or Chart.js not loaded');
        return null;
    }
    
    try {
        return new Chart(canvas.getContext('2d'), {
            type,
            data,
            options
        });
    } catch (error) {
        Logger.error('Failed to create chart', error);
        return null;
    }
}

/**
 * Show a confirmation dialog
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} [options.confirmText='OK'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @returns {Promise<boolean>} Promise resolving to user's decision
 */
export function showConfirmDialog(options) {
    return new Promise(resolve => {
        const content = `
            <p class="confirm-message">${options.message}</p>
        `;
        
        const footer = `
            <button class="btn btn-secondary cancel-btn">${options.cancelText || 'Cancel'}</button>
            <button class="btn btn-primary confirm-btn">${options.confirmText || 'OK'}</button>
        `;
        
        const modal = uiManager.createModal({
            title: options.title || 'Confirm',
            content,
            footer,
            closable: true,
            onClose: () => resolve(false)
        });
        
        const confirmBtn = document.querySelector(`#${modal.id} .confirm-btn`);
        const cancelBtn = document.querySelector(`#${modal.id} .cancel-btn`);
        
        confirmBtn.addEventListener('click', () => {
            modal.close();
            resolve(true);
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.close();
            resolve(false);
        });
    });
}
