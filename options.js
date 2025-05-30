class OptionsController {
  constructor() {
    this.loadSettings();
    this.setupEventListeners();
    this.loadStats();
  }

  async loadSettings() {
    const settings = await this.getStoredSettings();
    
    this.renderKeywords(settings.blockedKeywords);
    
    document.getElementById('analysisDelay').value = settings.analysisDelay || 1000;
    document.getElementById('enableDebugMode').checked = settings.debugMode || false;
    document.getElementById('enableCaching').checked = settings.enableCaching !== false;
  }

  setupEventListeners() {
    document.getElementById('addKeyword').addEventListener('click', () => {
      this.addKeyword();
    });
    
    document.getElementById('newKeyword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addKeyword();
      }
    });

    document.getElementById('analysisDelay').addEventListener('change', () => {
      this.saveSettings();
    });
    
    document.getElementById('enableDebugMode').addEventListener('change', () => {
      this.saveSettings();
    });
    
    document.getElementById('enableCaching').addEventListener('change', () => {
      this.saveSettings();
    });

    document.getElementById('clearCache').addEventListener('click', () => {
      this.clearCache();
    });
  }

  async getStoredSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        blockedKeywords: ['10x', 'grind', 'hustle culture', 'thought leader', 'disrupt', 'synergy', 'leverage', 'game changer', 'circle back', 'touch base'],
        analysisDelay: 1000,
        debugMode: false,
        enableCaching: true
      }, resolve);
    });
  }

  renderKeywords(keywords) {
    const container = document.getElementById('keywordList');
    container.innerHTML = '';
    
    keywords.forEach(keyword => {
      const tag = document.createElement('div');
      tag.className = 'keyword-tag';
      tag.innerHTML = `
        <span>${keyword}</span>
        <button class="keyword-remove" onclick="optionsController.removeKeyword('${keyword}')">×</button>
      `;
      container.appendChild(tag);
    });
  }

  async addKeyword() {
    const input = document.getElementById('newKeyword');
    const keyword = input.value.trim().toLowerCase();
    
    if (!keyword) return;
    
    const settings = await this.getStoredSettings();
    if (!settings.blockedKeywords.includes(keyword)) {
      settings.blockedKeywords.push(keyword);
      await this.saveKeywords(settings.blockedKeywords);
      this.renderKeywords(settings.blockedKeywords);
    }
    
    input.value = '';
    this.showSaveStatus();
  }

  async removeKeyword(keyword) {
    const settings = await this.getStoredSettings();
    settings.blockedKeywords = settings.blockedKeywords.filter(k => k !== keyword);
    await this.saveKeywords(settings.blockedKeywords);
    this.renderKeywords(settings.blockedKeywords);
    this.showSaveStatus();
  }

  async saveKeywords(keywords) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ blockedKeywords: keywords }, resolve);
    });
  }

  async saveSettings() {
    const settings = {
      analysisDelay: parseInt(document.getElementById('analysisDelay').value),
      debugMode: document.getElementById('enableDebugMode').checked,
      enableCaching: document.getElementById('enableCaching').checked
    };

    chrome.storage.sync.set(settings, () => {
      this.showSaveStatus();
    });
  }

  showSaveStatus() {
    const status = document.getElementById('saveStatus');
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 2000);
  }

  async loadStats() {
    chrome.storage.local.get(null, (data) => {
      let postsAnalyzed = 0;
      let cringeDetected = 0;
      let helpfulPosts = 0;
      
      Object.keys(data).forEach(key => {
        if (key.startsWith('analysis_')) {
          postsAnalyzed++;
          const analysis = data[key].data;
          if (analysis) {
            if (analysis.authenticity_score < 40) {
              cringeDetected++;
            } else if (analysis.authenticity_score > 70) {
              helpfulPosts++;
            }
          }
        }
      });

      document.getElementById('postsAnalyzed').textContent = postsAnalyzed;
      document.getElementById('cringeDetected').textContent = cringeDetected;
      document.getElementById('helpfulPosts').textContent = helpfulPosts;
      document.getElementById('cacheSize').textContent = postsAnalyzed;
    });
  }

  clearCache() {
    if (confirm('This will clear all cached analysis results. Are you sure?')) {
      chrome.storage.local.get(null, (data) => {
        const keysToRemove = Object.keys(data).filter(key => key.startsWith('analysis_'));
        chrome.storage.local.remove(keysToRemove, () => {
          this.loadStats();
          this.showSaveStatus();
        });
      });
    }
  }
}

const optionsController = new OptionsController();
