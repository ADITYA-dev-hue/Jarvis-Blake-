/**
 * JARVIS / IGRIS Phase 9 - Multilingual Language Engine & Assistant Response Layer
 * 
 * Supports:
 * - English ('en')
 * - Hinglish ('hinglish')
 * - Hindi ('hi')
 * 
 * Capabilities:
 * - Automatic language detection
 * - User language switch directive detection ("Talk to me in English", "Hinglish mein bolo", etc.)
 * - Multilingual intent normalization
 * - Contextual response formatting across all supported languages
 * - Zero security compromise: language changes never bypass command validation.
 */

const HINGLISH_KEYWORDS = new Set([
  'kholo', 'khol', 'kholiye', 'kholna',
  'karo', 'kar', 'kijiye', 'karna', 'kardo', 'kar do', 'kar dena',
  'batao', 'bataiye', 'batana',
  'dikhao', 'dikhaye', 'dikhana',
  'likho', 'likh', 'likhiye', 'likhna',
  'banao', 'bana', 'banaiye', 'banana',
  'search', 'dhundho', 'khojo',
  'hai', 'hain', 'ho', 'tha', 'thi', 'the',
  'mein', 'me', 'pe', 'par', 'se', 'ko', 'ka', 'ki', 'ke',
  'kya', 'kaise', 'kyun', 'kaha', 'kahan', 'kitna', 'kitni', 'kitne',
  'mera', 'meri', 'mere', 'apna', 'apni', 'apne',
  'yeh', 'ye', 'woh', 'wo', 'isse', 'usse', 'isko', 'usko',
  'aur', 'phir', 'baad', 'pehle', 'ab', 'abhi',
  'shuru', 'chalao', 'chalana', 'ruk', 'ruko',
  'baat', 'bolo', 'boliye', 'bolna',
  'chahiye', 'suno', 'sunao', 'hoga', 'hogi', 'honge',
  'gana', 'gaana', 'geet', 'baja', 'bajao', 'baj', 'bajti',
  'window', 'khidki', 'bada', 'chhota', 'lao', 'saamne', 'hatao'
]);

// Devanagari Unicode range: \u0900 to \u097F
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

/**
 * Detect language of the input text
 * 
 * @param {string} text Raw user input
 * @param {'auto'|'en'|'hinglish'|'hi'} preference User language preference
 * @returns {'en'|'hinglish'|'hi'} Detected language code
 */
function detectLanguage(text, preference = 'auto') {
  // If user explicitly chose a language preference (en, hinglish, hi), respect it
  if (preference && preference !== 'auto' && ['en', 'hinglish', 'hi'].includes(preference)) {
    return preference;
  }

  if (!text || typeof text !== 'string') {
    return 'en';
  }

  const clean = text.trim();
  if (!clean) {
    return 'en';
  }

  // 1. Check for Devanagari characters -> Hindi ('hi')
  if (DEVANAGARI_REGEX.test(clean)) {
    return 'hi';
  }

  const lower = clean.toLowerCase();

  // 2. Tokenize words for keyword matching
  const words = lower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

  let hinglishCount = 0;
  for (const word of words) {
    if (HINGLISH_KEYWORDS.has(word)) {
      hinglishCount++;
    }
  }

  // Multi-word Hinglish phrase checks
  const hasHinglishPhrases = 
    lower.includes('kar do') ||
    lower.includes('kar dena') ||
    lower.includes('mein baat') ||
    lower.includes('kholo aur') ||
    lower.includes('pe search') ||
    lower.includes('par search') ||
    lower.includes('kya hai') ||
    lower.includes('kitna use') ||
    lower.includes('kitna chal') ||
    lower.includes('chal raha') ||
    lower.includes('ho raha');

  if (hinglishCount >= 2 || (hinglishCount >= 1 && (hasHinglishPhrases || words.length <= 4))) {
    return 'hinglish';
  }

  // 3. If preference is explicitly set and not 'auto', respect preference
  if (preference && ['en', 'hinglish', 'hi'].includes(preference)) {
    return preference;
  }

  // Default fallback is English
  return 'en';
}

/**
 * Check if the user is issuing a language switch command
 * e.g., "Talk to me in English", "English mein baat karo", "Hinglish mein bolo", "Hindi mein respond karo"
 * 
 * @param {string} text User prompt
 * @returns {{ isSwitch: boolean, targetLanguage?: 'en'|'hinglish'|'hi', message?: string }}
 */
function checkLanguageSwitchCommand(text) {
  if (!text || typeof text !== 'string') return { isSwitch: false };

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Explicit English directives
  if (
    lower === 'use english' ||
    lower === 'talk in english' ||
    lower === 'talk to me in english' ||
    lower === 'speak in english' ||
    lower === 'switch to english' ||
    lower === 'change language to english' ||
    lower.includes('english mein baat karo') ||
    lower.includes('english me baat karo') ||
    lower.includes('english mein bolo') ||
    lower.includes('english me bolo') ||
    lower.includes('ab english use karo')
  ) {
    return {
      isSwitch: true,
      targetLanguage: 'en',
      message: "Language preference updated to English. I will now respond in English."
    };
  }

  // Explicit Hinglish directives
  if (
    lower === 'use hinglish' ||
    lower === 'talk in hinglish' ||
    lower === 'talk to me in hinglish' ||
    lower === 'switch to hinglish' ||
    lower === 'change language to hinglish' ||
    lower.includes('hinglish mein baat karo') ||
    lower.includes('hinglish me baat karo') ||
    lower.includes('hinglish mein bolo') ||
    lower.includes('hinglish me bolo') ||
    lower.includes('ab hinglish use karo') ||
    lower.includes('ab hinglish me')
  ) {
    return {
      isSwitch: true,
      targetLanguage: 'hinglish',
      message: "Language preference updated to Hinglish. Ab se main Hinglish mein baat karunga."
    };
  }

  // Explicit Hindi directives
  if (
    lower === 'use hindi' ||
    lower === 'talk in hindi' ||
    lower === 'talk to me in hindi' ||
    lower === 'switch to hindi' ||
    lower === 'change language to hindi' ||
    lower.includes('hindi mein baat karo') ||
    lower.includes('hindi me baat karo') ||
    lower.includes('hindi mein respond karo') ||
    lower.includes('hindi me respond karo') ||
    lower.includes('hindi mein bolo') ||
    lower.includes('हिंदी में बात करो') ||
    lower.includes('हिंदी में बोलो')
  ) {
    return {
      isSwitch: true,
      targetLanguage: 'hi',
      message: "Language preference updated to Hindi. अब से मैं हिंदी में उत्तर दूंगा।"
    };
  }

  return { isSwitch: false };
}

/**
 * Check if the user is issuing a voice personality/style switch command
 * e.g., "Speak more calmly.", "Use a deeper voice.", "Talk more like a commander.",
 *       "Make your voice slightly friendlier.", "Use the IGRIS voice."
 * 
 * @param {string} text User prompt
 * @returns {{ isVoiceSwitch: boolean, voiceSettings?: object, message?: string }}
 */
function checkVoiceStyleSwitchCommand(text) {
  if (!text || typeof text !== 'string') return { isVoiceSwitch: false };

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // "Speak more calmly" / "Speak calmly"
  if (
    lower.includes('speak more calmly') ||
    lower.includes('speak calmly') ||
    lower.includes('talk more calmly') ||
    lower.includes('thoda calm bolo') ||
    lower.includes('aur calm bolo')
  ) {
    return {
      isVoiceSwitch: true,
      voiceSettings: { tone: 'calm', style: 'commander' },
      message: "Modulating voice tone. Speaking with calm authority."
    };
  }

  // "Use a deeper voice" / "Deeper voice"
  if (
    lower.includes('use a deeper voice') ||
    lower.includes('deeper voice') ||
    lower.includes('deep voice') ||
    lower.includes('gehri aawaz') ||
    lower.includes('aawaz deep karo')
  ) {
    return {
      isVoiceSwitch: true,
      voiceSettings: { pitch: 0.78, tone: 'commanding' },
      message: "Voice pitch lowered. Resonance calibrated for deeper presence."
    };
  }

  // "Talk more like a commander" / "Commander voice"
  if (
    lower.includes('talk more like a commander') ||
    lower.includes('like a commander') ||
    lower.includes('commander voice') ||
    lower.includes('commander mode') ||
    lower.includes('commander jaisa bolo')
  ) {
    return {
      isVoiceSwitch: true,
      voiceSettings: { style: 'commander', tone: 'commanding', rate: 0.88, pitch: 0.80 },
      message: "Commander protocol engaged. Authoritative cadence active."
    };
  }

  // "Make your voice slightly friendlier" / "Friendlier voice"
  if (
    lower.includes('slightly friendlier') ||
    lower.includes('friendlier voice') ||
    lower.includes('friendly voice') ||
    lower.includes('thoda friendly bolo')
  ) {
    return {
      isVoiceSwitch: true,
      voiceSettings: { tone: 'balanced', pitch: 0.88, rate: 0.92 },
      message: "Voice modulation adjusted with subtle friendliness."
    };
  }

  // "Use the IGRIS voice" / "Default voice" / "Reset voice"
  if (
    lower.includes('use the igris voice') ||
    lower.includes('igris voice') ||
    lower.includes('reset voice') ||
    lower.includes('default voice') ||
    lower.includes('igris aawaz use karo')
  ) {
    return {
      isVoiceSwitch: true,
      voiceSettings: { style: 'commander', tone: 'calm', rate: 0.90, pitch: 0.85 },
      message: "IGRIS Commander persona restored to standard calibrated parameters."
    };
  }

  return { isVoiceSwitch: false };
}

/**
 * Format friendly assistant response across supported languages
 * 
 * @param {string} action Executed action name
 * @param {object} parameters Action parameters
 * @param {object} result Execution result or telemetry snapshot
 * @param {string} userText Original query text
 * @param {'en'|'hinglish'|'hi'} language Output language
 * @returns {string} Natural spoken assistant response
 */
function formatMultilingualResponse(action, parameters = {}, result = {}, userText = '', language = 'en') {
  const lang = ['en', 'hinglish', 'hi'].includes(language) ? language : 'en';

  if (action === 'system_status') {
    const data = result?.data || result;
    const cpuVal = typeof data?.cpu === 'number'
      ? data.cpu
      : (typeof data?.cpu?.usagePercent === 'number'
        ? data.cpu.usagePercent
        : (typeof data?.cpu_percent === 'number'
          ? data.cpu_percent
          : null));
    const ramVal = typeof data?.ram === 'number'
      ? data.ram
      : (typeof data?.memory?.usagePercent === 'number'
        ? data.memory.usagePercent
        : null);
    const diskVal = typeof data?.disk === 'number'
      ? data.disk
      : (typeof data?.disk?.percent === 'number'
        ? data.disk.percent
        : null);
    const batt = data?.battery;

    const lowerQuery = (userText || '').toLowerCase();

    // Specific metric requests
    if (lowerQuery.includes('ram') || lowerQuery.includes('memory')) {
      if (typeof ramVal === 'number') {
        if (lang === 'hinglish') return `Aapka RAM usage abhi ${ramVal} percent hai.`;
        if (lang === 'hi') return `आपका RAM उपयोग वर्तमान में ${ramVal} प्रतिशत है।`;
        return `Your RAM usage is currently ${ramVal} percent.`;
      }
      return lang === 'hinglish' ? 'Laptop RAM telemetry abhi available nahi hai.' : 'Laptop RAM telemetry is currently unavailable.';
    }

    if (lowerQuery.includes('cpu') || lowerQuery.includes('processor')) {
      if (typeof cpuVal === 'number') {
        if (lang === 'hinglish') return `Aapka CPU abhi ${cpuVal} percent par hai.`;
        if (lang === 'hi') return `आपका CPU वर्तमान में ${cpuVal} प्रतिशत पर है।`;
        return `Your CPU is currently at ${cpuVal} percent.`;
      }
      return lang === 'hinglish' ? 'Laptop CPU telemetry abhi available nahi hai.' : 'Laptop CPU telemetry is currently unavailable.';
    }

    if (lowerQuery.includes('battery')) {
      if (batt && batt.available && typeof batt.percent === 'number') {
        if (lang === 'hinglish') {
          const chg = batt.charging ? ' aur abhi charge ho raha hai' : '';
          return `Aapki battery abhi ${batt.percent} percent hai${chg}.`;
        }
        if (lang === 'hi') {
          const chg = batt.charging ? ' और चार्ज हो रही है' : '';
          return `आपकी बैटरी वर्तमान में ${batt.percent} प्रतिशत है${chg}।`;
        }
        const chargingText = batt.charging ? ' and currently charging' : '';
        return `Your battery level is currently ${batt.percent} percent${chargingText}.`;
      }
      return lang === 'hinglish' ? 'Battery telemetry available nahi hai.' : 'Laptop battery telemetry is currently unavailable.';
    }

    if (lowerQuery.includes('storage') || lowerQuery.includes('disk')) {
      if (typeof diskVal === 'number') {
        if (lang === 'hinglish') return `Aapka storage usage abhi ${diskVal} percent hai.`;
        if (lang === 'hi') return `आपका स्टोरेज उपयोग वर्तमान में ${diskVal} प्रतिशत है।`;
        return `Your storage usage is currently ${diskVal} percent.`;
      }
      return lang === 'hinglish' ? 'Storage telemetry available nahi hai.' : 'Laptop storage telemetry is currently unavailable.';
    }

    // General status summary
    if (typeof cpuVal === 'number' && typeof ramVal === 'number') {
      if (lang === 'hinglish') return `Laptop status: CPU ${cpuVal} percent par hai aur RAM ${ramVal} percent par hai.`;
      if (lang === 'hi') return `लैपटॉप स्थिति: CPU ${cpuVal} प्रतिशत पर है और RAM ${ramVal} प्रतिशत पर है।`;
      return `Laptop status: CPU is at ${cpuVal} percent, memory is at ${ramVal} percent.`;
    }

    if (lang === 'hinglish') return 'Laptop status successfully mil gaya.';
    if (lang === 'hi') return 'लैपटॉप स्थिति सफलतापूर्वक प्राप्त हुई।';
    return 'Laptop status retrieved successfully.';
  }

  if (action === 'open_url') {
    const url = parameters?.url || '';
    if (url.toLowerCase().includes('github.com')) {
      if (lang === 'hinglish') return 'GitHub open ho gaya.';
      if (lang === 'hi') return 'GitHub खुल गया है।';
      return 'GitHub opened successfully.';
    }
    if (url.toLowerCase().includes('google.com')) {
      if (lang === 'hinglish') return 'Google open ho gaya.';
      if (lang === 'hi') return 'Google खुल गया है।';
      return 'Google opened successfully.';
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      if (lang === 'hinglish') return `${host} open ho gaya.`;
      if (lang === 'hi') return `${host} खुल गया है।`;
      return `${host} opened successfully.`;
    } catch (_) {
      if (lang === 'hinglish') return 'Website open ho gayi.';
      if (lang === 'hi') return 'वेबसाइट खुल गई है।';
      return 'Website opened successfully.';
    }
  }

  if (action === 'open_app') {
    const app = (parameters?.app || '').toLowerCase();
    if (lang === 'hinglish') return `${parameters?.app || 'App'} open ho gaya. Ab kya karna hai?`;
    if (lang === 'hi') return `${parameters?.app || 'ऐप'} खुल गया है। अब क्या करना है?`;
    if (app === 'notepad') return 'Notepad launched successfully.';
    if (app === 'calculator') return 'Calculator launched successfully.';
    if (app === 'paint') return 'Paint launched successfully.';
    if (app === 'explorer') return 'File Explorer opened successfully.';
    if (app === 'code') return 'Visual Studio Code launched successfully.';
    return `${parameters?.app || 'Application'} launched successfully.`;
  }

  if (action === 'search_web') {
    const q = parameters?.query || 'web';
    if (lang === 'hinglish') return `Google pe "${q}" search kar diya hai.`;
    if (lang === 'hi') return `Google पर "${q}" खोजा गया।`;
    return `Searched Google for "${q}".`;
  }

  if (action === 'type_text') {
    const t = parameters?.text || '';
    const preview = t.length > 30 ? t.substring(0, 30) + '...' : t;
    if (lang === 'hinglish') return `Window mein type kar diya: "${preview}".`;
    if (lang === 'hi') return `सक्रिय विंडो में टाइप किया: "${preview}"।`;
    return `Typed: "${preview}".`;
  }

  if (action === 'wait') {
    const ms = parameters?.milliseconds || 1000;
    if (lang === 'hinglish') return `${ms}ms ka wait kiya gaya.`;
    if (lang === 'hi') return `${ms} मिलीसेकंड प्रतीक्षा की गई।`;
    return `Waited ${ms}ms.`;
  }

  if (action === 'create_folder') {
    const folder = parameters?.name || 'folder';
    if (lang === 'hinglish') return `Folder "${folder}" create ho gaya.`;
    if (lang === 'hi') return `फ़ोल्डर "${folder}" सफलतापूर्वक बनाया गया।`;
    return `Folder ${folder} created successfully.`;
  }

  if (action === 'open_folder') {
    const target = parameters?.path ? `Folder "${parameters.path}"` : 'Workspace';
    if (lang === 'hinglish') return `${target} File Explorer mein open kar diya gaya hai.`;
    if (lang === 'hi') return `${target} फ़ाइल एक्सप्लोरर में खोल दिया गया है।`;
    return `${target} opened in File Explorer.`;
  }

  if (action === 'list_folder') {
    const items = result?.data?.items || [];
    const count = items.length;
    const target = parameters?.path ? `folder "${parameters.path}"` : 'workspace';
    if (count === 0) {
      if (lang === 'hinglish') return `${target} abhi empty hai.`;
      if (lang === 'hi') return `${target} वर्तमान में खाली है।`;
      return `The ${target} is currently empty.`;
    }
    const names = items.slice(0, 5).map(i => i.name).join(', ');
    const more = count > 5 ? ` and ${count - 5} more` : '';
    if (lang === 'hinglish') return `${target} mein ${count} items mile: ${names}${more}.`;
    if (lang === 'hi') return `${target} में ${count} आइटम मिले: ${names}${more}।`;
    return `Found ${count} item${count === 1 ? '' : 's'} in ${target}: ${names}${more}.`;
  }

  if (action === 'get_file_info') {
    const file = parameters?.path || result?.data?.filename || 'File';
    const size = result?.data?.size !== undefined ? result.data.size : (result?.data?.size_bytes ? `${result.data.size_bytes} bytes` : '');
    const sizeText = size ? `, size is ${size}` : '';
    if (lang === 'hinglish') return `File info for ${file}: found${sizeText}.`;
    if (lang === 'hi') return `फ़ाइल ${file} की जानकारी मिल गई${sizeText}।`;
    return `File info for ${file}: found${sizeText}.`;
  }

  if (action === 'create_text_file') {
    const file = parameters?.path || 'File';
    if (lang === 'hinglish') return `File ${file} successfully create ho gayi.`;
    if (lang === 'hi') return `फ़ाइल ${file} सफलतापूर्वक बनाई गई।`;
    return `File ${file} created successfully.`;
  }

  if (action === 'open_file') {
    const file = parameters?.path || 'File';
    if (lang === 'hinglish') return `File ${file} open ho gayi.`;
    if (lang === 'hi') return `फ़ाइल ${file} खोल दी गई है।`;
    return `File ${file} opened successfully.`;
  }

  if (action === 'task') {
    const stepsCount = result?.data?.completed_steps || parameters?.steps?.length || 0;
    if (lang === 'hinglish') return `Task successfully complete ho gaya (${stepsCount} steps execute huye).`;
    if (lang === 'hi') return `कार्य सफलतापूर्वक पूरा हुआ (${stepsCount} चरण निष्पादित)।`;
    return `Task completed successfully (${stepsCount} steps executed).`;
  }

  // Phase 10 - Window Management
  if (action === 'list_windows') {
    const windows = result?.data?.windows || [];
    const count = typeof result?.data?.count === 'number' ? result.data.count : windows.length;
    if (count === 0) {
      if (lang === 'hinglish') return 'Abhi koi supported application open nahi hai.';
      if (lang === 'hi') return 'वर्तमान में कोई समर्थित एप्लिकेशन खुला नहीं है।';
      return 'No supported applications are currently open.';
    }
    const titles = windows.slice(0, 5).map(w => w.title || w.app).join(', ');
    const more = count > 5 ? ` aur ${count - 5} aur` : '';
    const moreEn = count > 5 ? ` and ${count - 5} more` : '';
    const moreHi = count > 5 ? ` और ${count - 5} अन्य` : '';
    if (lang === 'hinglish') return `Abhi ${count} open window${count === 1 ? '' : 's'} chal rahe hain: ${titles}${more}.`;
    if (lang === 'hi') return `वर्तमान में ${count} खुली विंडो हैं: ${titles}${moreHi}।`;
    return `Found ${count} open window${count === 1 ? '' : 's'}: ${titles}${moreEn}.`;
  }

  if (action === 'focus_window') {
    const app = parameters?.app || 'application';
    if (lang === 'hinglish') return `${app} window ko focus mein la diya gaya hai.`;
    if (lang === 'hi') return `${app} विंडो को फ़ोकस में लाया गया।`;
    return `Brought ${app} window to focus.`;
  }

  if (action === 'minimize_window') {
    const app = parameters?.app || 'application';
    if (lang === 'hinglish') return `${app} window ko minimize kar diya gaya hai.`;
    if (lang === 'hi') return `${app} विंडो को मिनिमाइज़ किया गया।`;
    return `Minimized ${app} window.`;
  }

  if (action === 'maximize_window') {
    const app = parameters?.app || 'application';
    if (lang === 'hinglish') return `${app} window ko maximize kar diya gaya hai.`;
    if (lang === 'hi') return `${app} विंडो को मैक्सिमाइज़ किया गया।`;
    return `Maximized ${app} window.`;
  }

  if (action === 'restore_window') {
    const app = parameters?.app || 'application';
    if (lang === 'hinglish') return `${app} window ko restore kar diya gaya hai.`;
    if (lang === 'hi') return `${app} विंडो को रीस्टोर किया गया।`;
    return `Restored ${app} window.`;
  }

  // Phase 10 - Media Playback Status
  if (action === 'media_status') {
    const m = result?.data || {};
    const isActive = m.active === true && m.playbackState !== 'stopped';
    if (!isActive) {
      if (lang === 'hinglish') return 'Abhi laptop par koi media play nahi ho raha hai.';
      if (lang === 'hi') return 'लैपटॉप पर वर्तमान में कोई मीडिया नहीं चल रहा है।';
      return 'No media is currently playing.';
    }
    const title = m.title || 'media';
    const source = m.source || 'Desktop';
    const artist = m.artist ? ` by ${m.artist}` : '';
    const artistHi = m.artist ? ` (${m.artist})` : '';
    if (lang === 'hinglish') return `${source} par abhi "${title}" play ho raha hai${artistHi}.`;
    if (lang === 'hi') return `${source} पर वर्तमान में "${title}" चल रहा है${artistHi}।`;
    return `Currently playing "${title}" on ${source}${artist}.`;
  }

  // Phase 11 - Smart File & Workspace Assistant
  if (action === 'search_files') {
    const count = result?.data?.count !== undefined ? result.data.count : (result?.data?.files ? result.data.files.length : 0);
    const q = parameters?.query ? ` "${parameters.query}"` : '';
    if (count === 0) {
      if (lang === 'hinglish') return `Koi matching file nahi mili${q}.`;
      if (lang === 'hi') return `कोई मेल खाती फ़ाइल नहीं मिली${q}।`;
      return `No matching files found${q}.`;
    }
    if (lang === 'hinglish') return `Workspace mein ${count} matching file${count === 1 ? '' : 's'} mile.`;
    if (lang === 'hi') return `कार्यस्थान में ${count} मेल खाती फ़ाइलें मिलीं।`;
    return `Found ${count} matching file${count === 1 ? '' : 's'} in workspace.`;
  }

  if (action === 'read_file') {
    const lines = result?.data?.lines_returned || 0;
    const file = parameters?.path || result?.data?.filename || 'file';
    if (lang === 'hinglish') return `${file} se ${lines} lines read kiye gaye.`;
    if (lang === 'hi') return `${file} से ${lines} पंक्तियाँ पढ़ी गईं।`;
    return `Read ${lines} lines from ${file}.`;
  }

  if (action === 'search_file_content') {
    const matches = result?.data?.total_matches !== undefined ? result.data.total_matches : (result?.data?.excerpts ? result.data.excerpts.length : 0);
    const q = parameters?.query || '';
    if (matches === 0) {
      if (lang === 'hinglish') return `"${q}" ke liye koi matches nahi mile.`;
      if (lang === 'hi') return `"${q}" के लिए कोई परिणाम नहीं मिला।`;
      return `No matches found for "${q}".`;
    }
    if (lang === 'hinglish') return `"${q}" ke ${matches} match${matches === 1 ? '' : 'es'} mile.`;
    if (lang === 'hi') return `"${q}" के लिए ${matches} परिणाम मिले।`;
    return `Found ${matches} match${matches === 1 ? '' : 'es'} for "${q}".`;
  }

  if (action === 'analyze_file') {
    const file = parameters?.path || result?.data?.filename || 'file';
    const ftype = result?.data?.file_type || 'File';
    if (lang === 'hinglish') return `${file} (${ftype}) ka analysis complete ho gaya.`;
    if (lang === 'hi') return `${file} (${ftype}) का विश्लेषण पूरा हुआ।`;
    return `Analysis of ${file} (${ftype}) completed.`;
  }

  if (action === 'summarize_file') {
    const file = parameters?.path || result?.data?.filename || 'file';
    const summary = result?.data?.summary;
    if (summary) return summary;
    if (lang === 'hinglish') return `${file} ki summary generate ho gayi.`;
    if (lang === 'hi') return `${file} का सारांश तैयार हो गया।`;
    return `Summary for ${file} generated.`;
  }

  if (action === 'analyze_folder') {
    const folder = result?.data?.folder_path || parameters?.folder_path || 'workspace';
    const files = result?.data?.total_files || 0;
    const sz = result?.data?.total_size_formatted || '0 B';
    if (lang === 'hinglish') return `Folder "${folder}" mein ${files} files hain (${sz}).`;
    if (lang === 'hi') return `फ़ोल्डर "${folder}" में ${files} फ़ाइलें हैं (${sz})।`;
    return `Folder "${folder}" contains ${files} files (${sz}).`;
  }

  if (action === 'workspace_insights') {
    const lines = result?.data?.total_code_lines || 0;
    const files = result?.data?.total_code_files || 0;
    if (lang === 'hinglish') return `Workspace insights: ${files} code files mein total ${lines} lines of code hain.`;
    if (lang === 'hi') return `कार्यस्थान अंतर्दृष्टि: ${files} कोड फ़ाइलों में कुल ${lines} कोड पंक्तियाँ हैं।`;
    return `Workspace insights: ${lines} total code lines across ${files} code files.`;
  }

  if (action === 'list_supported_files') {
    const total = result?.data?.total_files_in_workspace || 0;
    if (lang === 'hinglish') return `Supported formats mein C, C++, Java, Python, JS/TS, PDFs aur data files shamil hain (${total} files workspace mein mile).`;
    if (lang === 'hi') return `समर्थित प्रारूपों में C, C++, Java, Python, JS/TS, PDF और डेटा फ़ाइलें शामिल हैं (कार्यस्थान में ${total} फ़ाइलें मिलीं)।`;
    return `Supported formats include C, C++, Java, Python, JS/TS, PDFs, and data files (${total} matching files in workspace).`;
  }

  // Phase 14 - Spotify Responses
  if (action === 'open_spotify') {
    if (lang === 'hinglish') return 'Spotify open ho gaya hai.';
    if (lang === 'hi') return 'Spotify खुल गया है।';
    return 'Spotify opened successfully in Google Chrome.';
  }

  if (action === 'spotify_search') {
    const q = parameters?.query || result?.data?.query || 'music';
    if (lang === 'hinglish') return `Spotify par "${q}" search kar diya gaya hai.`;
    if (lang === 'hi') return `Spotify पर "${q}" खोजा जा रहा है।`;
    return `Searching Spotify for "${q}".`;
  }

  if (action === 'spotify_play') {
    const q = parameters?.query || result?.data?.query;
    if (q) {
      if (lang === 'hinglish') return `Spotify par "${q}" play kar rahe hain.`;
      if (lang === 'hi') return `Spotify पर "${q}" चलाया जा रहा है।`;
      return `Starting playback of "${q}" on Spotify.`;
    }
    if (lang === 'hinglish') return 'Spotify music play ho raha hai.';
    if (lang === 'hi') return 'Spotify संगीत शुरू किया गया।';
    return 'Starting playback on Spotify.';
  }

  if (action === 'spotify_next_track') {
    if (lang === 'hinglish') return 'Agla gana play kar diya gaya hai.';
    if (lang === 'hi') return 'अगला गाना शुरू किया गया।';
    return 'Skipped to next track on Spotify.';
  }

  if (action === 'spotify_previous_track') {
    if (lang === 'hinglish') return 'Pichhla gana play kar diya gaya hai.';
    if (lang === 'hi') return 'पिछला गाना शुरू किया गया।';
    return 'Playing previous track on Spotify.';
  }

  if (action === 'spotify_pause') {
    if (lang === 'hinglish') return 'Spotify music pause kar diya gaya hai.';
    if (lang === 'hi') return 'Spotify संगीत रोक दिया गया।';
    return 'Spotify music paused.';
  }

  if (action === 'spotify_resume') {
    if (lang === 'hinglish') return 'Spotify music resume ho gaya hai.';
    if (lang === 'hi') return 'Spotify संगीत फिर से शुरू किया गया।';
    return 'Resumed Spotify music.';
  }

  if (action === 'spotify_stop') {
    if (lang === 'hinglish') return 'Spotify music band kar diya gaya hai.';
    if (lang === 'hi') return 'Spotify संगीत बंद कर दिया गया।';
    return 'Spotify music stopped.';
  }

  // Phase 14 - Volume Responses
  if (action === 'set_system_volume') {
    const vol = result?.data?.volume !== undefined ? result.data.volume : parameters?.level;
    const isMuted = result?.data?.muted;
    if (isMuted && vol === 0) {
      if (lang === 'hinglish') return 'System mute kar diya gaya hai.';
      if (lang === 'hi') return 'सिस्टम म्यूट कर दिया गया है।';
      return 'System muted.';
    }
    if (lang === 'hinglish') return `System volume ${vol} percent par set ho gaya hai.`;
    if (lang === 'hi') return `सिस्टम वॉल्यूम ${vol} प्रतिशत पर सेट कर दिया गया है।`;
    return `System volume set to ${vol} percent.`;
  }

  if (action === 'adjust_system_volume') {
    const vol = result?.data?.volume !== undefined ? result.data.volume : 'updated';
    const delta = parameters?.delta || result?.data?.delta || 10;
    const actionWord = delta > 0 ? (lang === 'hinglish' ? 'badha' : (lang === 'hi' ? 'बढ़ा' : 'increased')) : (lang === 'hinglish' ? 'kam' : (lang === 'hi' ? 'घटा' : 'decreased'));
    if (lang === 'hinglish') return `System volume ${actionWord} kar ${vol} percent kar diya hai.`;
    if (lang === 'hi') return `सिस्टम वॉल्यूम ${actionWord}कर ${vol} प्रतिशत कर दिया गया है।`;
    return `System volume ${delta > 0 ? 'increased' : 'decreased'} to ${vol} percent.`;
  }

  if (action === 'get_system_volume') {
    const vol = result?.data?.volume !== undefined ? result.data.volume : 'unknown';
    const muted = result?.data?.muted ? ' (muted)' : '';
    if (lang === 'hinglish') return `Abhi system volume ${vol} percent hai${muted}.`;
    if (lang === 'hi') return `वर्तमान सिस्टम वॉल्यूम ${vol} प्रतिशत है${muted}।`;
    return `Current system volume is ${vol} percent${muted}.`;
  }

  // Phase 14 - Brightness Responses
  if (action === 'set_screen_brightness') {
    const b = result?.data?.brightness !== undefined ? result.data.brightness : parameters?.level;
    if (lang === 'hinglish') return `Screen brightness ${b} percent par set kar di gayi hai.`;
    if (lang === 'hi') return `स्क्रीन चमक ${b} प्रतिशत पर सेट कर दी गई है।`;
    return `Brightness set to ${b} percent.`;
  }

  if (action === 'adjust_screen_brightness') {
    const b = result?.data?.brightness !== undefined ? result.data.brightness : 'updated';
    const delta = parameters?.delta || result?.data?.delta || 10;
    if (lang === 'hinglish') return `Screen brightness abhi ${b} percent kar di gayi hai.`;
    if (lang === 'hi') return `स्क्रीन चमक अब ${b} प्रतिशत कर दी गई है।`;
    return `Brightness set to ${b} percent.`;
  }

  if (action === 'get_screen_brightness') {
    const b = result?.data?.brightness !== undefined ? result.data.brightness : 'unknown';
    if (lang === 'hinglish') return `Screen brightness abhi ${b} percent hai.`;
    if (lang === 'hi') return `वर्तमान स्क्रीन चमक ${b} प्रतिशत है।`;
    return `Current screen brightness is ${b} percent.`;
  }

  // Phase 14 - Notepad & Text Automation Responses
  if (action === 'open_notepad') {
    if (lang === 'hinglish') return 'Notepad open ho gaya. Ab kya likhna hai?';
    if (lang === 'hi') return 'नोटपैड खुल गया है। अब क्या लिखना है?';
    return 'Notepad launched successfully.';
  }

  if (action === 'write_text_file') {
    const fname = result?.data?.filename || parameters?.path || 'file';
    if (lang === 'hinglish') return `Text "${fname}" mein likh diya gaya hai.`;
    if (lang === 'hi') return `टेक्स्ट "${fname}" में लिख दिया गया है।`;
    return `Text written successfully to ${fname}.`;
  }

  if (action === 'append_text_file') {
    const fname = result?.data?.filename || parameters?.path || 'file';
    if (lang === 'hinglish') return `Text "${fname}" mein append kar diya gaya hai.`;
    if (lang === 'hi') return `टेक्स्ट "${fname}" में जोड़ दिया गया है।`;
    return `Appended text to ${fname} successfully.`;
  }

  if (action === 'save_text_file') {
    const fname = result?.data?.filename || parameters?.path || 'file';
    if (lang === 'hinglish') return `File "${fname}" save ho gayi hai.`;
    if (lang === 'hi') return `फ़ाइल "${fname}" सहेज ली गई है।`;
    return `The text file has been saved as ${fname}.`;
  }

  if (action === 'open_text_file') {
    const fname = result?.data?.filename || parameters?.path || 'file';
    if (lang === 'hinglish') return `File "${fname}" Notepad mein open kar di gayi hai.`;
    if (lang === 'hi') return `फ़ाइल "${fname}" नोटपैड में खोल दी गई है।`;
    return `Opened ${fname} in Notepad.`;
  }

  if (action === 'verify_text_file') {
    const fname = result?.data?.filename || parameters?.path || 'file';
    if (lang === 'hinglish') return `File "${fname}" verify ho gayi hai.`;
    if (lang === 'hi') return `फ़ाइल "${fname}" सत्यापित हो गई है।`;
    return `File ${fname} verified successfully on disk.`;
  }

  if (lang === 'hinglish') return 'Command successfully execute ho gaya.';
  if (lang === 'hi') return 'कमांड सफलतापूर्वक निष्पादित किया गया।';
  return 'Command executed successfully.';
}

/**
 * Format error message in the requested language
 * 
 * @param {string} err Original error or reason
 * @param {'en'|'hinglish'|'hi'} language Output language
 * @returns {string} User-friendly error message
 */
function formatMultilingualError(err, language = 'en') {
  const lang = ['en', 'hinglish', 'hi'].includes(language) ? language : 'en';
  const str = String(err?.message || err?.error || err || '');

  if (str.includes('offline') || str.includes('Offline')) {
    if (lang === 'hinglish') return 'Aapka laptop abhi offline hai.';
    if (lang === 'hi') return 'आपका लैपटॉप वर्तमान में ऑफ़लाइन है।';
    return 'Your laptop is currently offline.';
  }

  if (str.includes('timed out') || str.includes('time')) {
    if (lang === 'hinglish') return 'Laptop ne time par response nahi diya.';
    if (lang === 'hi') return 'लैपटॉप ने समय पर उत्तर नहीं दिया।';
    return 'The laptop did not respond in time.';
  }

  if (str.includes('unavailable') || str.includes('connect')) {
    if (lang === 'hinglish') return 'IGRIS server available nahi hai.';
    if (lang === 'hi') return 'IGRIS सर्वर अनुपलब्ध है।';
    return 'IGRIS server is unavailable.';
  }

  if (str.includes('disallowed') || str.includes('whitelisted') || str.includes('Security') || str.includes('forbidden') || str.includes('blocked')) {
    if (lang === 'hinglish') return 'Security reasons ki wajah se IGRIS ne yeh command block kar diya.';
    if (lang === 'hi') return 'सुरक्षा कारणों से IGRIS ने इस कमांड को ब्लॉक कर दिया।';
    return 'IGRIS blocked this command for security reasons.';
  }

  if (str.includes('Step') && str.includes('failed')) {
    if (lang === 'hinglish') return `Task ruk gaya: ${str}.`;
    if (lang === 'hi') return `कार्य रुक गया: ${str}।`;
    return str;
  }

  // Phase 10 - Window errors
  if (str.includes('not currently open') || str.includes('not open') || str.includes('No open window')) {
    if (lang === 'hinglish') return 'Yeh application window abhi open nahi hai.';
    if (lang === 'hi') return 'यह एप्लिकेशन विंडो वर्तमान में खुली नहीं है।';
    return 'The requested application window is not currently open.';
  }

  if (str.includes('Multiple matching windows') || str.includes('multiple windows')) {
    if (lang === 'hinglish') return 'Ek se zyada matching windows mile. Kripya specify karein.';
    if (lang === 'hi') return 'एक से अधिक विंडो मिलीं। कृपया स्पष्ट करें।';
    return 'Multiple matching windows found. Please specify which one to manage.';
  }

  if (str.includes('supported for approved') || str.includes('Unsupported application')) {
    if (lang === 'hinglish') return 'Window management sirf approved applications ke liye supported hai.';
    if (lang === 'hi') return 'विंडो प्रबंधन केवल स्वीकृत एप्लिकेशन के लिए समर्थित है।';
    return 'Window control is only supported for approved applications.';
  }

  // Ambiguity and conversational clarifications
  if (str.includes('What should I name the folder?')) {
    if (lang === 'hinglish') return 'Folder ka naam kya rakhna hai?';
    if (lang === 'hi') return 'फ़ोल्डर का नाम क्या रखना है?';
    return 'What should I name the folder?';
  }

  if (str.includes('What should I name the file?')) {
    if (lang === 'hinglish') return 'File ka naam kya rakhna hai?';
    if (lang === 'hi') return 'फ़ाइल का नाम क्या रखना है?';
    return 'What should I name the file?';
  }

  if (str.includes('Which project folder should I open?')) {
    if (lang === 'hinglish') return 'Aapko kaun sa project folder kholna hai?';
    if (lang === 'hi') return 'आपको कौन सा प्रोजेक्ट फ़ोल्डर खोलना है?';
    return 'Which project folder should I open?';
  }

  if (
    str.includes('opened GitHub') ||
    str.includes('open your workspace') ||
    str.includes('system telemetry') ||
    str.includes('assisted with your request') ||
    str.includes('launched the requested application') ||
    str.includes('open notes.txt') ||
    str.includes('create a file') ||
    str.includes('create a folder') ||
    str.includes('workspace')
  ) {
    return str;
  }

  if (lang === 'hinglish') return "Main yeh action perform nahi kar sakta.";
  if (lang === 'hi') return "मैं अभी यह क्रिया नहीं कर सकता।";
  return "I can't perform that action yet.";
}

/**
 * Format confirmation prompt in the requested language
 * 
 * @param {number} stepCount Number of steps in workflow
 * @param {'en'|'hinglish'|'hi'} language Output language
 * @returns {string} Confirmation prompt text
 */
function formatConfirmationPrompt(stepCount, language = 'en') {
  const lang = ['en', 'hinglish', 'hi'].includes(language) ? language : 'en';
  if (lang === 'hinglish') {
    return `Yeh task ${stepCount} actions perform karega. Kya aap continue karna chahte hain?`;
  }
  if (lang === 'hi') {
    return `यह कार्य ${stepCount} क्रियाएँ करेगा। क्या आप जारी रखना चाहते हैं?`;
  }
  return `This task will perform ${stepCount} actions. Do you want me to continue?`;
}

module.exports = {
  detectLanguage,
  checkLanguageSwitchCommand,
  checkVoiceStyleSwitchCommand,
  formatMultilingualResponse,
  formatMultilingualError,
  formatConfirmationPrompt,
  HINGLISH_KEYWORDS,
  DEVANAGARI_REGEX
};
