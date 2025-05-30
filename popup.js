class PopupController {
  constructor() {
    this.loadSettings();
    this.setupEventListeners();
    this.setupHoverEffects();
  }

  async loadSettings() {
    const settings = await this.getStoredSettings();
    
    document.getElementById('hideCringe').checked = settings.hideCringe;
    document.getElementById('threshold').value = settings.hideThreshold;
    document.getElementById('thresholdValue').textContent = settings.hideThreshold;
    document.getElementById('sensitivity').value = settings.sensitivityLevel;
    document.getElementById('apiKey').value = settings.geminiApiKey;
    
    this.updateStatus();
  }

  setupEventListeners() {
    const threshold = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    
    threshold.addEventListener('input', (e) => {
      thresholdValue.textContent = e.target.value;
      this.saveSettings();
    });

    document.getElementById('hideCringe').addEventListener('change', () => {
      this.saveSettings();
    });

    document.getElementById('sensitivity').addEventListener('change', () => {
      this.saveSettings();
    });

    document.getElementById('apiKey').addEventListener('input', () => {
      this.debouncedSave();
    });
  }

  setupHoverEffects() {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transition = 'all 0.2s ease';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'none';
      });
    });
  }

  debouncedSave = debounce(() => {
    this.saveSettings();
  }, 500);

  async getStoredSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        geminiApiKey: '',
        sensitivityLevel: 'medium',
        hideThreshold: 30,
        hideCringe: false,
        blockedKeywords: ['10x', 'grind', 'hustle culture', 'thought leader']
      }, resolve);
    });
  }

  async saveSettings() {
    const settings = {
      geminiApiKey: document.getElementById('apiKey').value,
      sensitivityLevel: document.getElementById('sensitivity').value,
      hideThreshold: parseInt(document.getElementById('threshold').value),
      hideCringe: document.getElementById('hideCringe').checked
    };

    chrome.storage.sync.set(settings, () => {
      this.updateStatus();
      this.showSaveConfirmation();
    });
  }

  updateStatus() {
    const status = document.getElementById('status');
    const apiKey = document.getElementById('apiKey').value;
    
    if (!apiKey) {
      status.textContent = '⚠️ API key required for full functionality';
      status.className = 'status warning';
    } else {
      status.textContent = '✅ Settings saved - ready to analyze posts';
      status.className = 'status success';
    }
  }

  showSaveConfirmation() {
    const status = document.getElementById('status');
    status.textContent = '⚡ Settings saved!';
    status.className = 'status success';
    
    setTimeout(() => {
      this.updateStatus();
    }, 2000);
  }
}

function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
