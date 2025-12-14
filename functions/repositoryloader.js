/**
 * Repository Loader Module
 * Handles loading repositories, creating cards, search, and filtering
 */

class RepositoryLoader {
    constructor() {
        this.packages = [];
        this.filteredPackages = [];
        this.allTags = new Set();
        this.selectedTags = new Set();
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.setupEventListeners();
        await this.loadRepositories();
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        searchBtn.addEventListener('click', () => this.handleSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
        searchInput.addEventListener('input', () => {
            if (searchInput.value === '') {
                this.handleSearch();
            }
        });

        // Filter panel toggle
        const filterBtn = document.getElementById('filterBtn');
        const closeFilter = document.getElementById('closeFilter');
        
        filterBtn.addEventListener('click', () => this.toggleFilterPanel());
        closeFilter.addEventListener('click', () => this.toggleFilterPanel());

        // Clear filters
        const clearFilters = document.getElementById('clearFilters');
        clearFilters.addEventListener('click', () => this.clearFilters());
    }

    /**
     * Load repositories from data/repository.json
     */
    async loadRepositories() {
        this.showLoading(true);
        
        try {
            console.log('Loading repository.json...');
            const response = await fetch('data/repository.json');
            
            if (!response.ok) {
                throw new Error('Failed to load repository data');
            }

            const data = await response.json();
            console.log('Repository data loaded:', data);
            
            // Load manifests for each repository
            await this.loadManifests(data.repositories);
            
            console.log(`Loaded ${this.packages.length} packages successfully`);
            
            this.filteredPackages = [...this.packages];
            this.buildTagsList();
            this.renderPackages();
            
        } catch (error) {
            this.showError(`Failed to load repositories: ${error.message}`);
            console.error('Error loading repositories:', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Load manifest.json from each repository
     * @param {Array} repositories - Array of repository URLs
     */
    async loadManifests(repositories) {
        const promises = repositories.map(repoUrl => this.loadManifest(repoUrl));
        const results = await Promise.allSettled(promises);
        
        this.packages = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);
    }

    /**
     * Convert GitHub URL to raw content URL
     * @param {string} url - GitHub repository URL
     * @returns {string} - Raw GitHub URL
     */
    convertToRawUrl(url) {
        // If already a raw URL, return as-is
        if (url.includes('raw.githubusercontent.com')) {
            return url;
        }

        // Convert github.com URL to raw.githubusercontent.com
        // Format: https://github.com/owner/repo -> https://raw.githubusercontent.com/owner/repo/main
        const githubPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
        const match = url.match(githubPattern);

        if (match) {
            const owner = match[1];
            const repo = match[2].replace(/\.git$/, ''); // Remove .git if present
            return `https://raw.githubusercontent.com/${owner}/${repo}/main`;
        }

        return url;
    }

    /**
     * Load single manifest from repository
     * @param {string} repoUrl - Repository URL
     * @returns {Promise<object>} - Package data
     */
    async loadManifest(repoUrl) {
        try {
            // Convert to raw URL if needed
            const rawUrl = this.convertToRawUrl(repoUrl);
            
            // Construct manifest URL
            const manifestUrl = `${rawUrl}/manifest.json`;
            
            console.log('Fetching manifest from:', manifestUrl);
            
            const response = await fetch(manifestUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const manifest = await response.json();
            console.log('Manifest loaded:', manifest.name);
            
            // Collect tags from keywords field (new format) or tags field (old format)
            const tags = manifest.keywords || manifest.tags;
            if (tags && Array.isArray(tags)) {
                tags.forEach(tag => this.allTags.add(tag));
            }

            return manifest;
            
        } catch (error) {
            console.error(`Error loading manifest from ${repoUrl}:`, error.message);
            this.showError(`Failed to load package from ${repoUrl}: ${error.message}`);
            return null;
        }
    }

    /**
     * Render all packages as cards
     */
    async renderPackages() {
        const container = document.getElementById('packagesContainer');
        container.innerHTML = '';

        if (this.filteredPackages.length === 0) {
            container.innerHTML = '<div class="no-results">No packages found matching your criteria.</div>';
            return;
        }

        for (const pkg of this.filteredPackages) {
            const card = await this.createPackageCard(pkg);
            container.appendChild(card);
        }
    }

    /**
     * Create a package card element
     * @param {object} pkg - Package data
     * @returns {Promise<HTMLElement>} - Card element
     */
    async createPackageCard(pkg) {
        const card = document.createElement('div');
        card.className = 'package-card';

        // Fetch download count
        let downloadCount = 0;
        if (pkg.links && pkg.links.release) {
            downloadCount = await downloadCounter.fetchDownloadCount(pkg.links.release);
        }

        // Support both old and new formats
        const displayName = pkg.displayName || pkg.name;
        const packageName = pkg.name;
        const authorName = pkg.author?.name || pkg.author || 'Unknown';
        const tags = pkg.keywords || pkg.tags || [];

        // Create card HTML
        card.innerHTML = `
            <div class="card-image">
                <img src="${pkg.icon || 'https://via.placeholder.com/400x200?text=No+Image'}" 
                     alt="${displayName}" 
                     onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">
            </div>
            <div class="card-content">
                <div class="card-header">
                    <h2 class="package-name">${displayName}</h2>
                    <p class="package-author">by ${authorName}</p>
                    <p class="package-description">${pkg.description}</p>
                </div>
                
                <div class="package-meta">
                    <span class="status-badge">${pkg.status || 'unknown'}</span>
                    <span class="version-tag">v${pkg.version}</span>
                    ${pkg.unity ? `<span class="unity-version">Unity ${pkg.unity}+</span>` : ''}
                    <span class="download-count">
                        <i class="fas fa-download"></i> ${downloadCounter.formatCount(downloadCount)}
                    </span>
                </div>

                <div class="package-tags">
                    ${this.renderTags(tags)}
                </div>

                <div class="card-actions">
                    ${this.renderActionButtons(pkg.links)}
                </div>
            </div>
        `;

        return card;
    }

    /**
     * Render tags for a package
     * @param {Array} tags - Array of tag strings
     * @returns {string} - HTML string
     */
    renderTags(tags) {
        if (!tags || !Array.isArray(tags)) return '';
        
        return tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    }

    /**
     * Render action buttons
     * @param {object} links - Links object from manifest
     * @returns {string} - HTML string
     */
    renderActionButtons(links) {
        if (!links) return '';

        let buttons = '';

        if (links.download) {
            buttons += `
                <a href="${links.download}" class="action-btn" download>
                    <i class="fas fa-download"></i>
                </a>
            `;
        }

        if (links.github) {
            buttons += `
                <a href="${links.github}" class="action-btn" target="_blank" rel="noopener">
                    <i class="fab fa-github"></i>
                </a>
            `;
        }

        if (links.documentation) {
            buttons += `
                <a href="${links.documentation}" class="action-btn" target="_blank" rel="noopener">
                    <i class="fas fa-book"></i>
                </a>
            `;
        }

        return buttons;
    }

    /**
     * Build tags list for filter panel
     */
    buildTagsList() {
        const tagsList = document.getElementById('tagsList');
        tagsList.innerHTML = '';

        Array.from(this.allTags).sort().forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.className = 'tag-filter';
            tagBtn.textContent = tag;
            tagBtn.addEventListener('click', () => this.toggleTag(tag, tagBtn));
            tagsList.appendChild(tagBtn);
        });
    }

    /**
     * Toggle tag selection
     * @param {string} tag - Tag name
     * @param {HTMLElement} button - Button element
     */
    toggleTag(tag, button) {
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
            button.classList.remove('active');
        } else {
            this.selectedTags.add(tag);
            button.classList.add('active');
        }

        this.applyFilters();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.selectedTags.clear();
        
        const tagButtons = document.querySelectorAll('.tag-filter');
        tagButtons.forEach(btn => btn.classList.remove('active'));

        this.applyFilters();
    }

    /**
     * Apply current filters
     */
    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();

        this.filteredPackages = this.packages.filter(pkg => {
            // Support both old and new formats for search
            const displayName = pkg.displayName || pkg.name;
            const authorName = pkg.author?.name || pkg.author || '';
            const tags = pkg.keywords || pkg.tags || [];

            // Search filter
            const matchesSearch = !searchTerm || 
                pkg.name.toLowerCase().includes(searchTerm) ||
                displayName.toLowerCase().includes(searchTerm) ||
                pkg.description.toLowerCase().includes(searchTerm) ||
                authorName.toLowerCase().includes(searchTerm);

            // Tag filter
            const matchesTags = this.selectedTags.size === 0 || 
                (tags && tags.some(tag => this.selectedTags.has(tag)));

            return matchesSearch && matchesTags;
        });

        this.renderPackages();
    }

    /**
     * Handle search input
     */
    handleSearch() {
        this.applyFilters();
    }

    /**
     * Toggle filter panel visibility
     */
    toggleFilterPanel() {
        const panel = document.getElementById('filterPanel');
        panel.classList.toggle('hidden');
    }

    /**
     * Show/hide loading spinner
     * @param {boolean} show - Show or hide
     */
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const existingErrors = errorDiv.textContent;
        
        if (existingErrors) {
            errorDiv.textContent = existingErrors + '\n' + message;
        } else {
            errorDiv.textContent = message;
        }
        
        errorDiv.classList.remove('hidden');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RepositoryLoader();
});