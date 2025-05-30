class LinkedInCringeDetector {
  constructor() {
    this.processedPosts = new Set();
    this.settings = null;
    this.observer = null;
    this.init();
  }

  async init() {
    this.settings = await this.getSettings();
    this.setupObserver();
    this.processFeed();
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, resolve);
    });
  }

  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
        }
      });
      
      if (shouldProcess) {
        setTimeout(() => this.processFeed(), 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async processFeed() {
    const posts = this.findLinkedInPosts();
    
    for (const post of posts) {
      const postId = this.getPostId(post);
      if (this.processedPosts.has(postId)) continue;

      const postText = this.extractPostText(post);
      if (!postText || postText.length < 10) continue;

      this.processedPosts.add(postId);
      this.analyzeAndLabelPost(post, postText, postId);
    }
  }

  findLinkedInPosts() {
    const selectors = [
      '[data-urn*="urn:li:activity"]',
      '.feed-shared-update-v2',
      '[data-urn*="urn:li:ugcPost"]',
      '.ember-view.feed-shared-update-v2'
    ];
    
    const posts = [];
    selectors.forEach(selector => {
      posts.push(...document.querySelectorAll(selector));
    });
    
    return [...new Set(posts)];
  }

  getPostId(postElement) {
    const urnAttr = postElement.getAttribute('data-urn');
    if (urnAttr) return urnAttr;
    
    const text = this.extractPostText(postElement);
    return text ? text.substring(0, 50) : Math.random().toString();
  }

  extractPostText(postElement) {
    const contentSelectors = [
      '.feed-shared-text .break-words',
      '.feed-shared-update-v2__description',
      '[data-test-id="main-feed-activity-card"] .break-words',
      '.feed-shared-text__text-view'
    ];

    for (const selector of contentSelectors) {
      const element = postElement.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  async analyzeAndLabelPost(postElement, postText, postId) {
    try {
      this.addLoadingBadge(postElement);

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'analyzePost',
          postText: postText,
          postId: postId
        }, resolve);
      });

      if (response.success) {
        this.addAnalysisBadge(postElement, response.data);
        this.handlePostVisibility(postElement, response.data);
      } else {
        this.addErrorBadge(postElement, response.error);
      }
    } catch (error) {
      console.error('Failed to analyze post:', error);
      this.addErrorBadge(postElement, 'Analysis failed');
    }
  }

  addLoadingBadge(postElement) {
    const badge = this.createBadge('⏳ Analyzing...', 'loading');
    this.insertBadge(postElement, badge);
  }

  addAnalysisBadge(postElement, analysis) {
    const existingBadge = postElement.querySelector('.cringe-badge');
    if (existingBadge) existingBadge.remove();

    const badge = this.createBadge(analysis.category, this.getCategoryClass(analysis.category));
    badge.title = `Authenticity: ${analysis.authenticity_score}/100\nBuzzwords: ${analysis.buzzword_density}\nReasoning: ${analysis.reasoning}`;
    
    this.insertBadge(postElement, badge);
  }

  addErrorBadge(postElement, error) {
    const existingBadge = postElement.querySelector('.cringe-badge');
    if (existingBadge) existingBadge.remove();

    const badge = this.createBadge('❌ Error', 'error');
    badge.title = error;
    this.insertBadge(postElement, badge);
  }

  createBadge(text, className) {
    const badge = document.createElement('div');
    badge.className = `cringe-badge ${className}`;
    badge.textContent = text;
    return badge;
  }

  getCategoryClass(category) {
    const classMap = {
      '🔥 Hustle Bro Energy': 'cringe-high',
      '🤡 Main Character Syndrome': 'cringe-high',
      '🎭 Fake Humility Detected': 'cringe-medium',
      '💤 Corporate Copium': 'cringe-medium',
      '📈 Motivational Fluff': 'cringe-low',
      '🧠 Actually Insightful': 'helpful',
      '✅ Genuinely Helpful': 'helpful',
      '❌ Straight-Up Nonsense': 'cringe-high'
    };
    return classMap[category] || 'neutral';
  }

  insertBadge(postElement, badge) {
    const headerSelectors = [
      '.feed-shared-actor',
      '.feed-shared-update-v2__header',
      '.update-v2-social-activity'
    ];

    let inserted = false;
    for (const selector of headerSelectors) {
      const header = postElement.querySelector(selector);
      if (header) {
        header.style.position = 'relative';
        badge.style.position = 'absolute';
        badge.style.top = '5px';
        badge.style.right = '5px';
        header.appendChild(badge);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      postElement.style.position = 'relative';
      postElement.insertBefore(badge, postElement.firstChild);
    }
  }

  handlePostVisibility(postElement, analysis) {
    if (!this.settings.hideCringe) return;

    const shouldHide = analysis.should_hide_from_feed || 
                     analysis.authenticity_score < this.settings.hideThreshold;

    if (shouldHide) {
      const badge = postElement.querySelector('.cringe-badge');
      let originalBadgeParent = badge ? badge.parentNode : null;

      const postContentWrapper = document.createElement('div');
      postContentWrapper.className = 'cringe-content-wrapper';

      while (postElement.firstChild) {
        if (postElement.firstChild === badge) {
          originalBadgeParent = badge.parentNode;
          originalBadgeParent.removeChild(badge);
        } else {
          postContentWrapper.appendChild(postElement.firstChild);
        }
      }
      postElement.appendChild(postContentWrapper);

      postContentWrapper.style.opacity = '0.3';
      postContentWrapper.style.filter = 'blur(2px)';
      
      let badgeContainer;
      if (badge) {
        badgeContainer = document.createElement('div');
        badgeContainer.className = 'cringe-badge-container';
        badgeContainer.appendChild(badge);
        postElement.insertBefore(badgeContainer, postContentWrapper);

        badge.style.position = 'static'; 
        badge.style.top = '';
        badge.style.right = '';
      }

      const revealButton = document.createElement('div');
      revealButton.className = 'cringe-reveal-button';
      revealButton.textContent = '👁️ Click to reveal cringe';
      revealButton.onclick = () => {
        postContentWrapper.style.opacity = '1';
        postContentWrapper.style.filter = 'none';
        if (badgeContainer) {
          badgeContainer.remove();
        }
        revealButton.remove();

        if (badge && originalBadgeParent) {
            originalBadgeParent.appendChild(badge);
            badge.style.position = 'absolute';
            badge.style.top = '5px';
            badge.style.right = '5px';
        }
      };
      postElement.appendChild(revealButton);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LinkedInCringeDetector());
} else {
  new LinkedInCringeDetector();
}