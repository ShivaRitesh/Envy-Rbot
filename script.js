// AURA Frontend Script: Handles UI, Google Sheet API, local Gemini, and Prompt Generator

// Global App State
const state = {
  config: {
    sheetUrl: localStorage.getItem('aura_sheet_url') || '',
    geminiKey: localStorage.getItem('aura_gemini_key') || '',
    email: localStorage.getItem('aura_alert_email') || ''
  },
  data: {
    tasks: [],
    reminders: [],
    logs: [],
    linkedin: []
  }
};

// DOM Elements
const elements = {
  navItems: document.querySelectorAll('.nav-item'),
  tabViews: document.querySelectorAll('.tab-view'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
  apiStatus: document.getElementById('api-status'),
  statusText: document.getElementById('status-text'),
  
  // Modals
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsClose: document.getElementById('settings-close'),
  settingsForm: document.getElementById('settings-form'),
  
  quickLogBtn: document.getElementById('quick-log-btn'),
  logModal: document.getElementById('log-modal'),
  logClose: document.getElementById('log-close'),
  logForm: document.getElementById('log-form'),
  
  newTaskBtn: document.getElementById('new-task-btn'),
  taskModal: document.getElementById('task-modal'),
  taskClose: document.getElementById('task-close'),
  taskForm: document.getElementById('task-form'),
  
  newReminderBtn: document.getElementById('new-reminder-btn'),
  reminderModal: document.getElementById('reminder-modal'),
  reminderClose: document.getElementById('reminder-close'),
  reminderForm: document.getElementById('reminder-form'),
  
  // Tab Lists & Items
  quickTasks: document.getElementById('quick-tasks'),
  quickLogs: document.getElementById('quick-logs'),
  allTasks: document.getElementById('all-tasks'),
  allReminders: document.getElementById('all-reminders'),
  linkedinDrafts: document.getElementById('linkedin-drafts'),
  refreshLiBtn: document.getElementById('refresh-li-btn'),
  
  // Chat
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  chatSend: document.getElementById('chat-send'),
  
  // Prompt Architect
  promptForm: document.getElementById('prompt-form'),
  promptType: document.getElementById('prompt-type'),
  promptSubject: document.getElementById('prompt-subject'),
  promptStyle: document.getElementById('prompt-style'),
  promptRatio: document.getElementById('prompt-ratio'),
  videoCamera: document.getElementById('video-camera'),
  videoMotion: document.getElementById('video-motion'),
  promptEngine: document.getElementById('prompt-engine'),
  generatePromptBtn: document.getElementById('generate-prompt-btn'),
  promptResultPlaceholder: document.getElementById('prompt-result-placeholder'),
  promptResultContent: document.getElementById('prompt-result-content'),
  finalPromptText: document.getElementById('final-prompt-text'),
  copyPromptBtn: document.getElementById('copy-prompt-btn'),
  toolName: document.getElementById('tool-name'),
  guideSteps: document.getElementById('guide-steps'),
  
  // Stats Counters
  pendingTasksCount: document.getElementById('pending-tasks-count'),
  activeRemindersCount: document.getElementById('active-reminders-count'),
  logsCount: document.getElementById('logs-count'),
  liDraftsCount: document.getElementById('li-drafts-count')
};

// ----------------------------------------------------
// Init Application
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initModals();
  initSettings();
  initPromptArchitect();
  initChat();
  initRemindersCheck();
  
  // Initial sync with Sheets
  syncData();
});

// Request Browser Notification Permissions
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// ----------------------------------------------------
// Navigation
// ----------------------------------------------------
function initNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Handle links inside cards redirecting to other tabs
  document.querySelectorAll('[data-tab-link]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.getAttribute('data-tab-link'));
    });
  });
}

function switchTab(tabName) {
  elements.navItems.forEach(i => i.classList.remove('active'));
  elements.tabViews.forEach(v => v.classList.remove('active'));
  
  const targetNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  const targetView = document.getElementById(`tab-${tabName}`);
  
  if (targetNavItem && targetView) {
    targetNavItem.classList.add('active');
    targetView.classList.add('active');
    
    // Update headers
    const titles = {
      dashboard: { title: "Dashboard Overview", sub: "Your personal workspace & automations status" },
      chat: { title: "AI Assistant Chat", sub: "Tackle your problems and generate concepts with Gemini" },
      prompts: { title: "Prompt Architect", sub: "Generate pro-level prompts for image & video creators" },
      tasks: { title: "Tasks & Alert Manager", sub: "Track tasks and schedule automated notifications" },
      linkedin: { title: "LinkedIn Automation Board", sub: "Review daily topics and publish scheduled drafts" }
    };
    elements.pageTitle.textContent = titles[tabName].title;
    elements.pageSubtitle.textContent = titles[tabName].sub;
  }
}

// ----------------------------------------------------
// Modal Controls
// ----------------------------------------------------
function initModals() {
  const setupModal = (btn, modal, close) => {
    if (btn) btn.addEventListener('click', () => modal.classList.add('active'));
    if (close) close.addEventListener('click', () => modal.classList.remove('active'));
  };

  setupModal(elements.settingsBtn, elements.settingsModal, elements.settingsClose);
  setupModal(elements.quickLogBtn, elements.logModal, elements.logClose);
  setupModal(elements.newTaskBtn, elements.taskModal, elements.taskClose);
  setupModal(elements.newReminderBtn, elements.reminderModal, elements.reminderClose);

  // Close modals on clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
}

// ----------------------------------------------------
// Configuration & Settings
// ----------------------------------------------------
function initSettings() {
  // Populate settings form
  document.getElementById('config-sheet-url').value = state.config.sheetUrl;
  document.getElementById('config-gemini-key').value = state.config.geminiKey;
  document.getElementById('config-email').value = state.config.email;

  elements.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.config.sheetUrl = document.getElementById('config-sheet-url').value.trim();
    state.config.geminiKey = document.getElementById('config-gemini-key').value.trim();
    state.config.email = document.getElementById('config-email').value.trim();

    localStorage.setItem('aura_sheet_url', state.config.sheetUrl);
    localStorage.setItem('aura_gemini_key', state.config.geminiKey);
    localStorage.setItem('aura_alert_email', state.config.email);

    elements.settingsModal.classList.remove('active');
    showNotification("Configuration Saved!", "Envy has successfully updated its credentials.");
    syncData();
  });
}

// ----------------------------------------------------
// Google Sheets Database Synchronization
// ----------------------------------------------------
async function syncData() {
  if (!state.config.sheetUrl) {
    elements.apiStatus.className = "status-indicator";
    elements.statusText.textContent = "Offline (Setup Settings)";
    return;
  }

  elements.apiStatus.className = "status-indicator";
  elements.statusText.textContent = "Syncing...";

  try {
    const url = `${state.config.sheetUrl}?action=getData`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
      state.data = result.data;
      updateUI();
      elements.apiStatus.className = "status-indicator connected";
      elements.statusText.textContent = "Synced with Sheet";
    } else {
      throw new Error(result.message || "Failed to load data");
    }
  } catch (error) {
    console.error("Sheets sync error:", error);
    elements.apiStatus.className = "status-indicator";
    elements.statusText.textContent = "Sync Failed";
  }
}

async function postToSheet(payload) {
  if (!state.config.sheetUrl) {
    console.warn("No Sheets Web App URL defined.");
    return false;
  }

  try {
    const response = await fetch(state.config.sheetUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Post back to Sheet failed:", error);
    return false;
  }
}

// ----------------------------------------------------
// Render UI Elements
// ----------------------------------------------------
function updateUI() {
  renderCounters();
  renderTasks();
  renderLogs();
  renderReminders();
  renderLinkedInDrafts();
}

function renderCounters() {
  const pendingTasks = state.data.tasks.filter(t => t.Status !== 'Completed').length;
  elements.pendingTasksCount.textContent = pendingTasks;
  
  const activeReminders = state.data.reminders.filter(r => r.Status === 'Active').length;
  elements.activeRemindersCount.textContent = activeReminders;
  
  elements.logsCount.textContent = state.data.logs.length;
  elements.liDraftsCount.textContent = state.data.linkedin.length;
}

function renderTasks() {
  elements.quickTasks.innerHTML = '';
  elements.allTasks.innerHTML = '';

  const activeTasks = state.data.tasks.filter(t => t.Status !== 'Completed');
  
  if (activeTasks.length === 0) {
    elements.quickTasks.innerHTML = `<li class="empty-state">No pending tasks. Great job!</li>`;
  }
  if (state.data.tasks.length === 0) {
    elements.allTasks.innerHTML = `<li class="empty-state">No tasks created yet.</li>`;
  }

  // Populate Task Boards
  state.data.tasks.forEach(task => {
    const taskItem = document.createElement('li');
    taskItem.className = `task-item ${task.Status === 'Completed' ? 'completed' : ''}`;
    
    const formattedDate = new Date(task.DueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    taskItem.innerHTML = `
      <label class="task-checkbox-label">
        <input type="checkbox" ${task.Status === 'Completed' ? 'checked' : ''} onchange="toggleTaskStatus('${task.ID}', this.checked)">
        <span>${task.Task}</span>
      </label>
      <div class="task-meta">
        <span class="priority-tag priority-${task.Priority.toLowerCase()}">${task.Priority}</span>
        <span class="task-due"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
      </div>
    `;

    // Add to all tasks board
    elements.allTasks.appendChild(taskItem);
    
    // Add to quick dashboard view if pending
    if (task.Status !== 'Completed') {
      const quickClone = taskItem.cloneNode(true);
      // Re-bind change event since cloneNode doesn't clone event listeners
      quickClone.querySelector('input').addEventListener('change', (e) => {
        toggleTaskStatus(task.ID, e.target.checked);
      });
      elements.quickTasks.appendChild(quickClone);
    }
  });
}

function renderLogs() {
  elements.quickLogs.innerHTML = '';
  if (state.data.logs.length === 0) {
    elements.quickLogs.innerHTML = `<li class="empty-state">No logs recorded yet.</li>`;
    return;
  }

  // Show latest first
  const sortedLogs = [...state.data.logs].reverse();
  sortedLogs.forEach(log => {
    const logItem = document.createElement('li');
    logItem.className = 'log-item';
    
    const formattedTime = new Date(log.Date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    logItem.innerHTML = `
      <div class="log-header">
        <span class="log-activity">${log.Activity}</span>
        <span class="log-time">${formattedTime}</span>
      </div>
      <p class="log-details">${log.Details}</p>
      <span class="priority-tag priority-low" style="margin-top:0.4rem; display:inline-block">${log.Mood}</span>
    `;
    elements.quickLogs.appendChild(logItem);
  });
}

function renderReminders() {
  elements.allReminders.innerHTML = '';
  const activeReminders = state.data.reminders.filter(r => r.Status === 'Active');
  
  if (activeReminders.length === 0) {
    elements.allReminders.innerHTML = `<li class="empty-state">No active reminders.</li>`;
    return;
  }

  activeReminders.forEach(rem => {
    const remItem = document.createElement('li');
    remItem.className = 'reminder-item';
    const formattedTime = new Date(rem.Time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    remItem.innerHTML = `
      <div class="reminder-info">
        <span class="reminder-text">${rem.Message}</span>
        <span class="reminder-date"><i class="fa-regular fa-bell"></i> ${formattedTime}</span>
      </div>
      <span class="priority-tag priority-medium">${rem.Status}</span>
    `;
    elements.allReminders.appendChild(remItem);
  });
}

function renderLinkedInDrafts() {
  elements.linkedinDrafts.innerHTML = '';
  if (state.data.linkedin.length === 0) {
    elements.linkedinDrafts.innerHTML = `<div class="empty-state">No LinkedIn posts generated yet.</div>`;
    return;
  }

  // Show latest first
  const sortedPosts = [...state.data.linkedin].reverse();
  sortedPosts.forEach(post => {
    const postCard = document.createElement('div');
    postCard.className = 'linkedin-post-card';
    
    const formattedDate = new Date(post.Date).toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    postCard.innerHTML = `
      <div class="li-post-header">
        <span class="li-post-topic">📌 Subject: ${post.Topic}</span>
        <span class="li-post-date">${formattedDate} - ${post.Status}</span>
      </div>
      <div class="li-post-content">${post.DraftPost}</div>
      <div class="li-post-actions">
        <button class="btn btn-secondary btn-sm" onclick="copyLinkedInDraft(this, \`${encodeURIComponent(post.DraftPost)}\`)">
          <i class="fa-solid fa-copy"></i> Copy Post
        </button>
        <a href="https://www.linkedin.com/feed/" target="_blank" class="btn btn-primary btn-sm">
          <i class="fa-brands fa-linkedin"></i> Post to LinkedIn
        </a>
      </div>
    `;
    elements.linkedinDrafts.appendChild(postCard);
  });
}

// ----------------------------------------------------
// UI Form Actions
// ----------------------------------------------------

// Add Task
elements.taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const task = document.getElementById('task-name').value;
  const dueDate = document.getElementById('task-date').value;
  const priority = document.getElementById('task-priority').value;

  elements.taskModal.classList.remove('active');
  showNotification("Adding Task...", "Sending task to Google Sheet.");

  const success = await postToSheet({
    action: "addTask",
    task,
    dueDate,
    priority
  });

  if (success) {
    showNotification("Task Added!", "Successfully synchronized with Sheet.");
    syncData();
    elements.taskForm.reset();
  } else {
    showNotification("Sync Failed", "Could not write task. Check configuration.", "danger");
  }
});

// Toggle Task Complete
async function toggleTaskStatus(id, isCompleted) {
  const newStatus = isCompleted ? 'Completed' : 'Pending';
  
  // Optimistic UI Update
  const taskIdx = state.data.tasks.findIndex(t => t.ID === id);
  if (taskIdx !== -1) {
    state.data.tasks[taskIdx].Status = newStatus;
    updateUI();
  }

  const success = await postToSheet({
    action: "updateTaskStatus",
    id,
    status: newStatus
  });

  if (success) {
    syncData();
  } else {
    showNotification("Sync Failed", "Could not update task status.", "danger");
  }
}

// Add Reminder
elements.reminderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('reminder-msg').value;
  const time = document.getElementById('reminder-time').value;

  elements.reminderModal.classList.remove('active');
  showNotification("Saving Alert...", "Scheduling your reminder.");

  const success = await postToSheet({
    action: "addReminder",
    message,
    time
  });

  if (success) {
    showNotification("Reminder Created!", "Alert registered successfully.");
    syncData();
    elements.reminderForm.reset();
  } else {
    showNotification("Sync Failed", "Could not register reminder.", "danger");
  }
});

// Add Work Activity Log
elements.logForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const activity = document.getElementById('log-activity').value;
  const details = document.getElementById('log-details').value;
  const mood = document.getElementById('log-mood').value;

  elements.logModal.classList.remove('active');
  showNotification("Saving Log...", "Writing activity to sheet.");

  const success = await postToSheet({
    action: "addLog",
    activity,
    details,
    mood
  });

  if (success) {
    showNotification("Activity Logged!", "Successfully registered progress.");
    syncData();
    elements.logForm.reset();
  } else {
    showNotification("Sync Failed", "Could not log activity.", "danger");
  }
});

// Copy LinkedIn content
function copyLinkedInDraft(button, encodedText) {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.innerHTML;
    button.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
    button.classList.remove('btn-secondary');
    button.classList.add('btn-primary');
    setTimeout(() => {
      button.innerHTML = originalText;
      button.classList.remove('btn-primary');
      button.classList.add('btn-secondary');
    }, 2000);
  });
}

// Trigger LinkedIn posts sync
elements.refreshLiBtn.addEventListener('click', () => {
  syncData();
});

// ----------------------------------------------------
// Prompt Architect Logic (Zero Cost Prompt Engineering)
// ----------------------------------------------------
function initPromptArchitect() {
  elements.promptType.addEventListener('change', () => {
    if (elements.promptType.value === 'image') {
      document.querySelector('.image-options').classList.remove('hidden');
      document.querySelector('.video-options').classList.add('hidden');
      // Swap defaults
      elements.promptEngine.innerHTML = `
        <option value="midjourney">Midjourney v6</option>
        <option value="dalle3">DALL-E 3</option>
        <option value="sdxl">Stable Diffusion XL</option>
      `;
    } else {
      document.querySelector('.image-options').classList.add('hidden');
      document.querySelector('.video-options').classList.remove('hidden');
      // Swap defaults
      elements.promptEngine.innerHTML = `
        <option value="runway">Runway Gen-3</option>
        <option value="sora">OpenAI Sora</option>
      `;
    }
  });

  elements.generatePromptBtn.addEventListener('click', () => {
    const type = elements.promptType.value;
    const subject = elements.promptSubject.value.trim();
    const engine = elements.promptEngine.value;
    
    if (!subject) {
      showNotification("Details Required", "Please enter a core description of the image/video.", "warning");
      return;
    }

    let finalPrompt = '';
    let guide = [];

    if (type === 'image') {
      const style = elements.promptStyle.value;
      const ratio = elements.promptRatio.value;
      
      const styleModifiers = {
        photorealistic: "raw photo, photorealistic, cinematic shot, 8k resolution, shot on 35mm lens, depth of field, hyper-detailed textures",
        cinematic: "cinematic film style, dramatic lighting, volumetric mist, orange and teal grading, high contrast composition",
        "3d-render": "octane 3D render style, raytracing, vibrant global illumination, clay modeling, claymation aesthetic, unreal engine 5",
        cyberpunk: "cyberpunk aesthetic, futuristic metropolis, neon sign glow, rainy night reflections, retro-futurism style",
        anime: "anime concept key visual, studio ghibli hand-drawn art, pastel color scheme, detailed cell shading",
        minimalist: "vector logo illustration, clean minimalist flat design, flat colors, white background, high contrast shape"
      };

      const selectedStyle = styleModifiers[style] || "";

      if (engine === 'midjourney') {
        finalPrompt = `${subject}${selectedStyle ? ', ' + selectedStyle : ''} --ar ${ratio} --v 6.0 --style raw`;
        guide = [
          { num: "1", text: "Open Discord and locate the Midjourney Bot or your private server." },
          { num: "2", text: "Type `/imagine` in the chat bar." },
          { num: "3", text: "Paste the pro prompt code and hit enter." },
          { num: "4", text: "For upscale variants, choose U1-U4 buttons." }
        ];
      } else if (engine === 'dalle3') {
        finalPrompt = `An ultra-high-definition, premium illustration representing: ${subject}. Stylistic choice: ${selectedStyle || 'modern photorealism'}. The composition should be perfect for an aspect ratio of ${ratio}.`;
        guide = [
          { num: "1", text: "Open ChatGPT Plus (DALL-E 3) or Microsoft Copilot Creator." },
          { num: "2", text: "Paste the constructed prompt template directly into the input bar." },
          { num: "3", text: "Submit. The engine handles structural framing automatically." }
        ];
      } else { // Stable Diffusion
        finalPrompt = `${subject}, ${selectedStyle || 'high quality, masterwork'}, award-winning art, highly detailed`;
        guide = [
          { num: "1", text: "Open your Stable Diffusion interface (Automatic1111 or ComfyUI)." },
          { num: "2", text: "Paste prompt in Positive box." },
          { num: "3", text: "Set Negative prompt to: 'blurry, low quality, bad anatomy, deformed, distorted'." },
          { num: "4", text: "Set sampling steps to 25-30 and aspect ratio matching your choice." }
        ];
      }
    } else { // Video Prompts
      const camera = elements.videoCamera.value;
      const motion = elements.videoMotion.value;

      const cameraTerms = {
        "slow-zoom": "a slow camera push-in zoom shot, narrowing focus on the subject",
        panning: "a sweeping cinematic panning shot tracking the movement",
        "crane-up": "a dramatic crane vertical crane shot moving upwards",
        "drone-orbit": "an aerial FPV drone shot orbiting the central scene in 360 degrees",
        static: "a fixed static tripod shot with natural motion inside the frame"
      };

      const motionTerms = {
        slow: "slow-motion dreamy atmosphere, cinematic flow",
        normal: "natural realistic movement physics, 24fps film style",
        fast: "high-energy rapid sequence, dynamic movement speed"
      };

      if (engine === 'runway') {
        finalPrompt = `Cinematic video render of: ${subject}. Camera movement: ${cameraTerms[camera]}. Action speed: ${motionTerms[motion]}. High production value, photo-real textures, volumetric lighting, HDR details.`;
        guide = [
          { num: "1", text: "Log into RunwayML.com and open Gen-3 Alpha." },
          { num: "2", text: "Paste the camera-directional prompt into the prompt box." },
          { num: "3", text: "Set motion slider control to a value of 4-6 for realistic movement." },
          { num: "4", text: "Click Generate to output 4s-10s clip." }
        ];
      } else { // Sora
        finalPrompt = `A beautifully cinematic shot of ${subject}. The camera is executing ${cameraTerms[camera]}. Ambient speed is ${motionTerms[motion]}. Highly detailed photorealistic environment, ray-traced shadows, film grain, photorealistic output.`;
        guide = [
          { num: "1", text: "Open Sora dashboard UI or developer playground API." },
          { num: "2", text: "Paste this prompt into the generation input field." },
          { num: "3", text: "Specify video duration constraints (typically 10-20s)." },
          { num: "4", text: "Launch rendering." }
        ];
      }
    }

    // Display result
    elements.promptResultPlaceholder.classList.add('hidden');
    elements.promptResultContent.classList.remove('hidden');
    elements.finalPromptText.textContent = finalPrompt;
    elements.toolName.textContent = engine.toUpperCase();

    // Render guide steps
    elements.guideSteps.innerHTML = '';
    guide.forEach(step => {
      const stepEl = document.createElement('div');
      stepEl.className = 'guide-step';
      stepEl.innerHTML = `
        <span class="guide-num">${step.num}.</span>
        <span>${step.text}</span>
      `;
      elements.guideSteps.appendChild(stepEl);
    });
  });

  // Copy Prompt handler
  elements.copyPromptBtn.addEventListener('click', () => {
    const text = elements.finalPromptText.textContent;
    navigator.clipboard.writeText(text).then(() => {
      elements.copyPromptBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
      setTimeout(() => {
        elements.copyPromptBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copy`;
      }, 2000);
    });
  });
}

// ----------------------------------------------------
// AI Assistant (Gemini API Integration)
// ----------------------------------------------------
function initChat() {
  const sendMessage = async () => {
    const query = elements.chatInput.value.trim();
    if (!query) return;

    if (!state.config.geminiKey) {
      appendChatMessage("Envy Assistant", "Please configure your Gemini API Key in Settings (gear icon bottom left) to enable AI chat capabilities. It is 100% free!", "assistant");
      elements.chatInput.value = '';
      return;
    }

    // Add user message to UI
    appendChatMessage("You", query, "user");
    elements.chatInput.value = '';
    
    // Add loading block
    const loadingMessageId = appendChatMessage("Envy", "Thinking...", "assistant loading");

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.config.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: query }] }]
        })
      });
      
      const data = await response.json();
      
      // Remove loading message
      document.getElementById(loadingMessageId).remove();

      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const reply = data.candidates[0].content.parts[0].text;
        appendChatMessage("Envy", reply, "assistant");
        speakText(reply);
      } else {
        appendChatMessage("Envy", "I had trouble generating a reply. Please verify your Gemini API key.", "assistant");
      }
    } catch (error) {
      console.error("Gemini API error:", error);
      document.getElementById(loadingMessageId).remove();
      appendChatMessage("Envy", "Communication error. Check your connection or API key.", "assistant");
    }
  };

  elements.chatSend.addEventListener('click', sendMessage);
  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function appendChatMessage(sender, text, type) {
  const msgId = 'msg-' + Date.now();
  const msgEl = document.createElement('div');
  msgEl.className = `message ${type}`;
  msgEl.id = msgId;

  const icon = type.includes('user') ? 'fa-user' : 'fa-wand-magic-sparkles';
  
  // Basic markdown formatting
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  msgEl.innerHTML = `
    <div class="message-avatar"><i class="fa-solid ${icon}"></i></div>
    <div class="message-content">
      <p>${formattedText}</p>
    </div>
  `;
  
  elements.chatMessages.appendChild(msgEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  
  return msgId;
}

// ----------------------------------------------------
// Active Browser & Telegram Reminders Checking
// ----------------------------------------------------
function initRemindersCheck() {
  // Check every 30 seconds
  setInterval(() => {
    const now = new Date();
    state.data.reminders.forEach(async (rem) => {
      if (rem.Status === 'Active') {
        const remTime = new Date(rem.Time);
        if (now >= remTime) {
          // Trigger Notification
          triggerBrowserReminder(rem.Message);
          
          // Trigger Email Notification (via Apps Script)
          if (state.config.email) {
            triggerEmailAlert(rem.Message);
          }

          // Mark reminder as Completed/Sent in memory & Sheets
          rem.Status = 'Sent';
          updateUI();
        }
      }
    });
  }, 30000);
}

function triggerBrowserReminder(msg) {
  if (Notification.permission === 'granted') {
    new Notification("Envy Alert!", {
      body: msg,
      icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/bell.svg"
    });
  } else {
    alert(`🔔 ALERT REMINDER:\n${msg}`);
  }
}

async function triggerEmailAlert(msg) {
  await postToSheet({
    action: "sendEmail",
    email: state.config.email,
    subject: "Envy Reminder Alert",
    message: `🔔 Envy Reminder Alert:\n\n${msg}`
  });
}

// Browser Text-to-Speech (Speaking Voice)
function speakText(text) {
  if ('speechSynthesis' in window) {
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // Clean text from markdown format
    const cleanedText = text.replace(/[*_`#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    
    // Find an English/Asian accented voice if available
    const voices = window.speechSynthesis.getVoices();
    // Prefer standard English/regional female voices that sound pleasant
    const femaleVoice = voices.find(v => 
      v.name.includes("Google US English") || 
      v.name.includes("Female") || 
      v.name.includes("Microsoft Zira") ||
      (v.lang.startsWith("en") && v.name.includes("Google"))
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    // Custom voice settings: slightly higher pitch, friendly speed
    utterance.pitch = 1.25; 
    utterance.rate = 1.05;
    
    window.speechSynthesis.speak(utterance);
  }
}

// Trigger initial voice load in browser
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}

// Helper: Show UI Notifications
function showNotification(title, text, type = 'success') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body: text });
  }
  
  // Custom console/toast logging for visual clarity
  console.log(`[${type.toUpperCase()}] ${title}: ${text}`);
}
