// IGRIS 2.5D Desktop Companion - Main Renderer Controller

(function() {
  const root = document.getElementById('companionRoot');
  const stage = document.getElementById('characterStage');
  const speechBubble = document.getElementById('speechBubble');
  const bubbleBadge = document.getElementById('bubbleStateBadge');
  const bubbleContent = document.getElementById('bubbleContent');
  const contextMenu = document.getElementById('contextMenu');
  const settingsModal = document.getElementById('settingsModal');
  const canvas = document.getElementById('particlesCanvas');
  const ctx = canvas.getContext('2d');

  let currentSettings = {
    companionEnabled: true,
    alwaysOnTop: true,
    size: 'medium',
    opacity: 100,
    animationEnabled: true,
    voiceEnabled: true,
    handsFreeEnabled: true
  };

  let currentState = 'idle';
  let bubbleTimeout = null;
  let particles = [];
  let voiceEngine = null;

  // Particle System
  function initParticles() {
    canvas.width = 240;
    canvas.height = 340;
    particles = [];
    for (let i = 0; i < 25; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 80,
        y: canvas.height - 30 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(0.8 + Math.random() * 1.8),
        size: 1 + Math.random() * 2.2,
        alpha: 0.8,
        decay: 0.012 + Math.random() * 0.018
      });
    }
  }

  function renderParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentSettings.animationEnabled && currentState !== 'offline') {
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          p.x = canvas.width / 2 + (Math.random() - 0.5) * 80;
          p.y = canvas.height - 30 + Math.random() * 20;
          p.alpha = 0.8;
        }
        ctx.fillStyle = `rgba(255, 26, 60, ${p.alpha})`;
        ctx.shadowColor = '#ff1a3c';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    requestAnimationFrame(renderParticles);
  }

  // State Management
  function setState(state, message, ttsText) {
    currentState = state;
    
    // Update stage CSS classes
    stage.className = 'character-stage';
    if (currentSettings.animationEnabled && state !== 'offline') {
      stage.classList.add('floating');
    }
    stage.classList.add(`state-${state}`);

    // Update Bubble
    bubbleBadge.textContent = state.toUpperCase();
    if (message) {
      bubbleContent.textContent = message;
      showBubble(5000);
    }

    // TTS if speaking
    if (state === 'speaking' && ttsText && voiceEngine && currentSettings.voiceEnabled) {
      voiceEngine.speak(ttsText, () => {
        setState('idle', 'Standing by.');
      });
    }

    // Auto-return for transient states
    if (state === 'success' || state === 'error') {
      setTimeout(() => {
        if (currentState === state) {
          setState('idle', 'Standing by.');
        }
      }, 4000);
    }
  }

  function showBubble(duration = 4000) {
    clearTimeout(bubbleTimeout);
    speechBubble.classList.add('visible');
    if (duration > 0) {
      bubbleTimeout = setTimeout(() => {
        speechBubble.classList.remove('visible');
      }, duration);
    }
  }

  // 2.5D Parallax Mouse Tracking
  document.addEventListener('mousemove', (e) => {
    if (!currentSettings.animationEnabled) return;
    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / (window.innerWidth / 2);
    const deltaY = (e.clientY - centerY) / (window.innerHeight / 2);

    const tiltX = -deltaY * 12;
    const tiltY = deltaX * 12;

    stage.style.transform = `perspective(700px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  document.addEventListener('mouseleave', () => {
    stage.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg)';
  });

  // Click & Double-click Interactions
  stage.addEventListener('click', (e) => {
    if (e.button === 0) { // Left click
      if (currentState === 'idle') {
        setState('listening', 'Listening for command...');
        if (voiceEngine) voiceEngine.isAwaitingCommand = true;
      } else {
        showBubble(3000);
      }
    }
  });

  stage.addEventListener('dblclick', () => {
    // Quick status check query via AI
    if (window.igrisCompanion) {
      window.igrisCompanion.sendAiCommand('system status');
    }
  });

  // Right-Click Context Menu
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu.style.display = 'block';
    const menuWidth = 160;
    const menuHeight = 180;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    contextMenu.style.left = `${Math.max(10, x)}px`;
    contextMenu.style.top = `${Math.max(10, y)}px`;
  });

  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.style.display = 'none';
    }
  });

  contextMenu.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      contextMenu.style.display = 'none';

      if (action === 'open-app') {
        setState('idle', 'IGRIS Active.');
      } else if (action === 'voice') {
        setState('listening', 'Listening...');
        if (voiceEngine) voiceEngine.isAwaitingCommand = true;
      } else if (action === 'settings') {
        openSettingsModal();
      } else if (action === 'always-on-top') {
        const newVal = !currentSettings.alwaysOnTop;
        currentSettings.alwaysOnTop = newVal;
        document.getElementById('txtAlwaysOnTop').textContent = `Always on Top ${newVal ? '✓' : ''}`;
        if (window.igrisCompanion) {
          await window.igrisCompanion.setAlwaysOnTop(newVal);
        }
      } else if (action === 'minimize') {
        if (window.igrisCompanion) {
          await window.igrisCompanion.minimize();
        }
      } else if (action === 'exit') {
        if (window.igrisCompanion) {
          await window.igrisCompanion.close();
        }
      }
    });
  });

  // Settings Modal Handlers
  function openSettingsModal() {
    settingsModal.classList.add('visible');
    document.getElementById('chkCompanion').checked = currentSettings.companionEnabled !== false;
    document.getElementById('chkAlwaysOnTop').checked = currentSettings.alwaysOnTop !== false;
    document.getElementById('selSize').value = currentSettings.size || 'medium';
    document.getElementById('rngOpacity').value = currentSettings.opacity || 100;
    document.getElementById('lblOpacity').textContent = `${currentSettings.opacity || 100}%`;
    document.getElementById('chkAnimation').checked = currentSettings.animationEnabled !== false;
    document.getElementById('chkVoice').checked = currentSettings.voiceEnabled !== false;
    document.getElementById('chkHandsFree').checked = currentSettings.handsFreeEnabled !== false;
  }

  document.getElementById('btnCloseSettings').addEventListener('click', () => {
    settingsModal.classList.remove('visible');
  });

  // Settings Change Listeners
  document.getElementById('selSize').addEventListener('change', async (e) => {
    const size = e.target.value;
    currentSettings.size = size;
    root.className = `companion-root size-${size}`;
    if (window.igrisCompanion) await window.igrisCompanion.setSize(size);
  });

  document.getElementById('rngOpacity').addEventListener('input', async (e) => {
    const val = parseInt(e.target.value);
    currentSettings.opacity = val;
    document.getElementById('lblOpacity').textContent = `${val}%`;
    if (window.igrisCompanion) await window.igrisCompanion.setOpacity(val);
  });

  document.getElementById('chkAlwaysOnTop').addEventListener('change', async (e) => {
    const val = e.target.checked;
    currentSettings.alwaysOnTop = val;
    document.getElementById('txtAlwaysOnTop').textContent = `Always on Top ${val ? '✓' : ''}`;
    if (window.igrisCompanion) await window.igrisCompanion.setAlwaysOnTop(val);
  });

  document.getElementById('chkAnimation').addEventListener('change', (e) => {
    currentSettings.animationEnabled = e.target.checked;
    if (!currentSettings.animationEnabled) {
      stage.classList.remove('floating');
    } else {
      stage.classList.add('floating');
    }
  });

  document.getElementById('chkHandsFree').addEventListener('change', (e) => {
    currentSettings.handsFreeEnabled = e.target.checked;
    if (voiceEngine) voiceEngine.setHandsFree(e.target.checked);
  });

  // IPC Event Subscriptions
  async function initApp() {
    initParticles();
    renderParticles();

    if (window.igrisCompanion) {
      try {
        const loaded = await window.igrisCompanion.getSettings();
        if (loaded) currentSettings = { ...currentSettings, ...loaded };
      } catch (err) {
        console.warn('Could not load settings:', err);
      }

      root.className = `companion-root size-${currentSettings.size || 'medium'}`;

      window.igrisCompanion.onStateUpdate((data) => {
        if (data && data.state) {
          setState(data.state, data.message, data.ttsText);
        }
      });

      window.igrisCompanion.onTaskProgress((data) => {
        if (data) {
          const text = data.currentStep ? `${data.currentStep} (${data.stepIndex + 1}/${data.totalSteps})` : 'Executing...';
          setState('executing', text);
        }
      });

      window.igrisCompanion.onAgentStatus((data) => {
        if (data && data.status === 'offline') {
          setState('offline', 'Laptop agent offline.');
        }
      });

      window.igrisCompanion.onVoiceTrigger((data) => {
        if (data && data.openSettings) {
          openSettingsModal();
        } else if (data && data.state) {
          setState(data.state, 'Listening for voice directive...');
        }
      });

      // Voice Engine
      voiceEngine = new CompanionVoiceEngine(
        (state, msg) => setState(state, msg),
        async (commandText) => {
          setState('thinking', 'Processing directive...');
          await window.igrisCompanion.sendAiCommand(commandText);
        }
      );
    }

    setState('idle', 'Standing by, Commander.');
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
