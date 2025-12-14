/**
 * Download Counter Module
 * Fetches download counts from GitHub Releases API
 */

class DownloadCounter {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Extract owner and repo from GitHub API URL
     * @param {string} releaseUrl - GitHub releases API URL
     * @returns {object} - {owner, repo}
     */
    parseReleaseUrl(releaseUrl) {
        const regex = /github\.com\/repos\/([^\/]+)\/([^\/]+)\/releases/;
        const match = releaseUrl.match(regex);
        
        if (match) {
            return {
                owner: match[1],
                repo: match[2]
            };
        }
        return null;
    }

    /**
     * Fetch total download count from GitHub releases
     * @param {string} releaseUrl - GitHub releases API URL
     * @returns {Promise<number>} - Total download count
     */
    async fetchDownloadCount(releaseUrl) {
        // Check cache first
        if (this.cache.has(releaseUrl)) {
            return this.cache.get(releaseUrl);
        }

        try {
            const response = await fetch(releaseUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const releases = await response.json();
            let totalDownloads = 0;

            // Sum up all asset downloads from all releases
            releases.forEach(release => {
                if (release.assets && Array.isArray(release.assets)) {
                    release.assets.forEach(asset => {
                        totalDownloads += asset.download_count || 0;
                    });
                }
            });

            // Cache the result
            this.cache.set(releaseUrl, totalDownloads);

            return totalDownloads;

        } catch (error) {
            console.error('Error fetching download count:', error);
            return 0; // Return 0 if error occurs
        }
    }

    /**
     * Format download count for display
     * @param {number} count - Download count
     * @returns {string} - Formatted count (e.g., "1.2K", "3.5M")
     */
    formatCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Create global instance
const downloadCounter = new DownloadCounter();