class CringeDetectorAPI {
  constructor() {
    this.cache = new Map();
    this.rateLimiter = new Map();
  }

  async getSettings() {
    const result = await chrome.storage.sync.get({
      geminiApiKey: '',
      sensitivityLevel: 'medium',
      hideThreshold: 30,
      hideCringe: false,
      blockedKeywords: ['10x', 'grind', 'hustle culture', 'thought leader']
    });
    return result;
  }

  generatePostHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  async analyzePost(postText, postId) {
    try {
      const hash = this.generatePostHash(postText);
      
      const cached = await this.getCachedResult(hash);
      if (cached) {
        return cached;
      }

      if (this.isRateLimited()) {
        return this.getFallbackAnalysis(postText);
      }

      const settings = await this.getSettings();
      if (!settings.geminiApiKey) {
        throw new Error('No API key configured');
      }

      const analysis = await this.callGeminiAPI(postText, settings);
      
      await this.cacheResult(hash, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Analysis failed:', error);
      return this.getFallbackAnalysis(postText);
    }
  }

  async callGeminiAPI(postText, settings) {
    const prompt = this.buildPrompt(postText, settings.sensitivityLevel);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Invalid API response format');
  }

  buildPrompt(postText, sensitivity) {
    const sensitivityMap = {
      light: "Be gentle and focus on genuinely helpful vs. not helpful content.",
      medium: "Provide balanced analysis with some humor for obviously cringeworthy posts.",
      nuclear: "Full roast mode - call out corporate speak, humble-bragging, and fake motivation with brutal honesty."
    };

    return `You are a LinkedIn post analyzer with a sense of humor. Analyze this LinkedIn post and classify it based on tone, authenticity, and overall vibe.

Post to analyze:
"${postText}"

Analysis mode: ${sensitivityMap[sensitivity] || sensitivityMap.medium}

Respond with a JSON object containing these exact fields:
{
  "category": "[one of: 🔥 Hustle Bro Energy, 🤡 Main Character Syndrome, 🎭 Fake Humility Detected, 💤 Corporate Copium, 📈 Motivational Fluff, 🧠 Actually Insightful, ✅ Genuinely Helpful, ❌ Straight-Up Nonsense]",
  "too_many_hashtags": boolean,
  "buzzword_density": "[high/medium/low]",
  "authenticity_score": number (0-100),
  "should_hide_from_feed": boolean,
  "reasoning": "Brief explanation of why you classified it this way (max 100 chars)"
}

Focus on detecting:
- Humble-bragging disguised as inspiration
- Generic motivational content without substance  
- Excessive corporate buzzwords
- Authentic professional insights vs. virtue signaling
- Posts that provide genuine value vs. self-promotion`;
  }

  getFallbackAnalysis(postText) {
    const buzzwords = ['10x', 'hustle', 'grind', 'thought leader', 'disrupt', 'synergy', 'leverage'];
    const humbleBragPatterns = ['honored to announce', 'blessed to share', 'humbled to receive'];
    
    let score = 50;
    let category = '✅ Genuinely Helpful';
    
    const lowerText = postText.toLowerCase();
    const buzzwordCount = buzzwords.filter(word => lowerText.includes(word)).length;
    const hasHumbleBrag = humbleBragPatterns.some(pattern => lowerText.includes(pattern));
    
    if (buzzwordCount > 3) {
      category = '💤 Corporate Copium';
      score = 20;
    } else if (hasHumbleBrag) {
      category = '🎭 Fake Humility Detected';
      score = 25;
    } else if (postText.split('#').length > 5) {
      category = '📈 Motivational Fluff';
      score = 35;
    }

    return {
      category,
      too_many_hashtags: postText.split('#').length > 5,
      buzzword_density: buzzwordCount > 2 ? 'high' : buzzwordCount > 0 ? 'medium' : 'low',
      authenticity_score: score,
      should_hide_from_feed: score < 30,
      reasoning: 'Fallback analysis (API unavailable)'
    };
  }

  async getCachedResult(hash) {
    const result = await chrome.storage.local.get(`analysis_${hash}`);
    const cached = result[`analysis_${hash}`];
    
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { 
      return cached.data;
    }
    return null;
  }

  async cacheResult(hash, analysis) {
    await chrome.storage.local.set({
      [`analysis_${hash}`]: {
        data: analysis,
        timestamp: Date.now()
      }
    });
  }

  isRateLimited() {
    const now = Date.now();
    const windowStart = now - 60000;
    const recentRequests = Array.from(this.rateLimiter.values()).filter(time => time > windowStart);
    return recentRequests.length >= 10;
  }
}

const api = new CringeDetectorAPI();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzePost') {
    api.analyzePost(request.postText, request.postId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getSettings') {
    api.getSettings()
      .then(settings => sendResponse(settings))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});
