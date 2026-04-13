// --- AUTO LOGIN LOGIC ---
document.getElementById('loginBtn').addEventListener('click', () => {
  const creds = document.getElementById('creds').value.trim();
  const statusEl = document.getElementById('status');
  
  if (!creds) {
    statusEl.innerText = "Please enter credentials.";
    statusEl.style.color = "red";
    return;
  }
  
  const parts = creds.split('|');
  if (parts.length < 3) {
    statusEl.innerText = "Invalid format. Use Email|Pass|2FA";
    statusEl.style.color = "red";
    return;
  }
  
  const data = {
    email: parts[0].trim(),
    password: parts[1].trim(),
    twofa: parts[2].trim().replace(/\s/g, '') // Remove all possible spaces from the 2FA secret
  };
  
  chrome.storage.local.set({ loginData: data, autoLoginActive: true }, () => {
    statusEl.innerText = "Auto login started...";
    statusEl.style.color = "#1a73e8";
    
    // Check if current tab is accounts.google.com, if not create a new one
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url && activeTab.url.includes("accounts.google.com")) {
        chrome.tabs.reload(activeTab.id);
      } else {
        chrome.tabs.create({ url: "https://accounts.google.com/ServiceLogin" });
      }
    });
  });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.local.set({ autoLoginActive: false, autoSendEmailActive: false }, () => {
        const statusEl = document.getElementById('status');
        statusEl.innerText = "Auto operations stopped.";
        statusEl.style.color = "#3c4043";
    });
});

// Load saved creds when opening popup
chrome.storage.local.get(['loginData', 'autoLoginActive', 'emailDraft'], (result) => {
  if (result.loginData) {
    const d = result.loginData;
    document.getElementById('creds').value = `${d.email}|${d.password}|${d.twofa}`;
  }
  if (result.autoLoginActive) {
    document.getElementById('status').innerText = "Auto login is active";
    document.getElementById('status').style.color = "#1a73e8";
  }
  
  if (result.emailDraft) {
      if(result.emailDraft.to) document.getElementById('emailTo').value = result.emailDraft.to;
      if(result.emailDraft.subject) document.getElementById('emailSubject').value = result.emailDraft.subject;
      if(result.emailDraft.content) document.getElementById('emailContent').value = result.emailDraft.content;
  }
});


// --- AUTO SEND EMAIL LOGIC ---
const saveDraft = () => {
    chrome.storage.local.set({
        emailDraft: {
            to: document.getElementById('emailTo').value,
            subject: document.getElementById('emailSubject').value,
            content: document.getElementById('emailContent').value
        }
    });
};
document.getElementById('emailTo').addEventListener('input', saveDraft);
document.getElementById('emailSubject').addEventListener('input', saveDraft);
document.getElementById('emailContent').addEventListener('input', saveDraft);

document.getElementById('sendMailBtn').addEventListener('click', () => {
    const to = document.getElementById('emailTo').value.trim();
    const subject = document.getElementById('emailSubject').value.trim();
    const content = document.getElementById('emailContent').value;
    const statusEl = document.getElementById('status');

    if (!to || !content) {
        statusEl.innerText = "Vui lòng nhập người nhận và nội dung.";
        statusEl.style.color = "red";
        return;
    }

    statusEl.innerText = "Đang mở cửa sổ gửi mail...";
    statusEl.style.color = "#ea4335";

    // Build the compose URL
    const url = `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;

    // Set flag and open URL
    chrome.storage.local.set({ 
        autoSendEmailActive: true 
    }, () => {
        chrome.tabs.create({ url: url });
        saveDraft(); // ensure draft is saved
    });
});
