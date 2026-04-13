let processed = { email: false, password: false, totp: false, chooser: false, challengePicker: false };

chrome.storage.local.get(['loginData', 'autoLoginActive'], (result) => {
  if (!result.autoLoginActive || !result.loginData) return;
  const data = result.loginData;
  console.log("Auto Login Extension Started");
  
  const intervalId = setInterval(async () => {
    // Check if auto login is still active before doing anything
    const res = await new Promise(resolve => chrome.storage.local.get(['autoLoginActive'], resolve));
    if (!res.autoLoginActive) {
        clearInterval(intervalId);
        return;
    }

    try {
        // 0. Account chooser screen
        // If Google presents a list of accounts (already signed out), click the correct one.
        const accountChooser = document.querySelector(`div[data-identifier="${data.email}"]`);
        if (accountChooser && isVisible(accountChooser) && !processed.chooser) {
            accountChooser.click();
            processed.chooser = true;
            return;
        }

        // If Google says "Use another account"
        const divs = Array.from(document.querySelectorAll('div'));
        const useAnotherAccountBtn = divs.find(el => (el.innerText === "Use another account" || el.innerText === "Sử dụng một tài khoản khác") && isVisible(el));
        if (useAnotherAccountBtn && !processed.chooser) {
             useAnotherAccountBtn.click();
             processed.chooser = true;
             return;
        }
        
        // 1. Email input step
        const emailInput = document.querySelector('input[type="email"]');
        if (emailInput && isVisible(emailInput) && !processed.email) {
            if (emailInput.value === data.email) {
                clickNext('#identifierNext button', true);
                processed.email = true;
                return;
            }
            await simulateType(emailInput, data.email);
            setTimeout(() => {
                clickNext('#identifierNext button', true);
                processed.email = true;
            }, 800);
            return; // Wait for next tick
        }
        
        // 2. Password input step
        const passwordInput = document.querySelector('input[type="password"]');
        if (passwordInput && isVisible(passwordInput) && !processed.password) {
            await simulateType(passwordInput, data.password);
            setTimeout(() => {
                clickNext('#passwordNext button', true);
                processed.password = true;
            }, 800);
            return;
        }
        
        // 3. Challenge Picker step (Select Authenticator App if asked how to verify)
        // class "JDAKTe" or data-challengetype="6" usually identifies Authenticator/TOTP option
        const authAppOption = document.querySelector('div[data-challengetype="6"]') || 
                              divs.find(el => el.innerText && el.innerText.includes("Google Authenticator") && el.getAttribute("role") === "button");
        if (authAppOption && isVisible(authAppOption) && !processed.challengePicker) {
            authAppOption.click();
            processed.challengePicker = true;
            return;
        }
        
        // 4. TOTP input step
        const totpInput = document.querySelector('input[name="totpPin"]') || document.querySelector('input[id="totpPin"]') || document.querySelector('input[type="tel"]');
        if (totpInput && isVisible(totpInput) && !processed.totp) {
            if (typeof generateTOTP === 'function') {
                const code = await generateTOTP(data.twofa);
                if (code) {
                    await simulateType(totpInput, code);
                    setTimeout(() => {
                        clickNext('#totpNext button', true);
                        processed.totp = true;
                        
                        // We successfully submitted TOTP, stop the interval
                        console.log("Auto login sequence completed");
                        chrome.storage.local.set({ autoLoginActive: false });
                    }, 800);
                }
            } else {
                console.error("generateTOTP function is not defined.");
            }
            return;
        }
    } catch(e) {
        console.error("Auto Login Error:", e);
    }
  }, 1500); // Check the DOM every 1.5 seconds
});

function isVisible(el) {
  return el && el.offsetWidth > 0 && el.offsetHeight > 0;
}

function clickNext(selector, isFallback = false) {
    const nextBtn = document.querySelector(selector);
    if (nextBtn && isVisible(nextBtn)) {
        nextBtn.click();
    } else if (isFallback) {
        // Fallback: search for a button with text "Next", "Continue", etc.
        const buttons = Array.from(document.querySelectorAll('button'));
        const next = buttons.find(b => isVisible(b) && !b.disabled && 
            (b.innerText.includes('Next') || b.innerText.includes('Tiếp theo') || 
             b.innerText.includes('Continue') || b.innerText.includes('Tiếp tục')));
        if (next) {
            next.click();
        }
    }
}

async function simulateType(input, text) {
  input.focus();
  
  // React / Angular often override the native value setter. 
  // Getting the native setter ensures it triggers framework updates.
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, text);
  } else {
      input.value = text;
  }
  
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

// Handle Gmail Smart Features Popups unconditionally when they appear
setInterval(() => {
    try {
        const dialog = document.querySelector('div[jscontroller="G90DNc"]');
        if (!dialog) {
            // Also check for the "Turn on smart features" text just in case jscontroller changes
            const textCheck = Array.from(document.querySelectorAll('div[role="heading"]')).find(el => 
                (el.innerText && el.innerText.includes("Turn on smart features")) || 
                (el.innerText && el.innerText.includes("Các tính năng thông minh")) ||
                (el.innerText && el.innerText.includes("Smart features"))
            );
            
            if (textCheck) {
                let container = textCheck.closest('div[jscontroller]') || textCheck.parentElement.parentElement;
                processSmartFeaturesPopup(container);
            }
            return;
        }
        
        processSmartFeaturesPopup(dialog);
    } catch (e) {
        console.error("Popup handler error:", e);
    }
}, 2000);

function processSmartFeaturesPopup(dialog) {
    if (!isVisible(dialog)) return;
    
    // We have three steps. We need to find the visible listbox inside.
    const listboxes = Array.from(dialog.querySelectorAll('ul[role="listbox"]'));
    const visibleListbox = listboxes.find(lb => isVisible(lb));
    
    if (visibleListbox) {
        const firstOption = visibleListbox.querySelector('li[role="option"]');
        if (firstOption) {
            // Click the first option if it's not already selected
            if (firstOption.getAttribute('aria-selected') !== 'true') {
                firstOption.click();
            }
            
            // After selecting, find the Next or Save button
            setTimeout(() => {
                const buttons = Array.from(dialog.querySelectorAll('button:not([disabled])'));
                const actionBtn = buttons.find(b => isVisible(b) && 
                    (b.innerText.includes('Next') || b.innerText.includes('Tiếp theo') || 
                     b.innerText.includes('Save') || b.innerText.includes('Lưu') ||
                     b.innerText.includes('Xong') || b.innerText.includes('Tiếp tục')));
                
                if (actionBtn) {
                    actionBtn.click();
                } else {
                    // Fallback to jsname if text matching fails
                    const jsnameBtn = dialog.querySelector('button[jsname="O5kDGc"]:not([disabled]), button[jsname="Efeutd"]:not([disabled]), button[jsname="plIjzf"]:not([disabled])');
                    if (jsnameBtn && isVisible(jsnameBtn)) {
                        jsnameBtn.click();
                    }
                }
            }, 300);
        }
    }
}

// Handle Auto Send Email logic
chrome.storage.local.get(['autoSendEmailActive'], (result) => {
    if (result.autoSendEmailActive) {
        console.log("Checking for Auto Send Email condition... URL:", window.location.href);
        if (window.location.search.includes('cm') || window.location.hash.includes('compose=')) {
            console.log("Auto Send Email trigger active!");
            
            let attempts = 0;
            const sendInterval = setInterval(() => {
                attempts++;
                
                let sendBtn = document.querySelector('.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
                if (!sendBtn || !isVisible(sendBtn)) {
                    const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                    sendBtn = buttons.find(b => {
                        if (!isVisible(b)) return false;
                        const tooltip = (b.getAttribute('data-tooltip') || '').toLowerCase();
                        const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
                        const text = (b.innerText || '').trim();
                        return (tooltip.includes('enter') || tooltip.includes('⌘') || ariaLabel.includes('enter')) && 
                               (text.includes('Send') || text.includes('Gửi') || b.classList.contains('aoO'));
                    });
                }

                if (sendBtn && isVisible(sendBtn)) {
                    console.log("Found Send button, clicking...");
                    
                    // Focus element first
                    sendBtn.focus();
                    
                    // Native click using mousedown, mouseup, click to ensure it triggers correctly
                    sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    sendBtn.click();
                    
                    // As a backup, trigger shortcut Ctrl+Enter on the body to send
                    const ctrlEnterEvent = new KeyboardEvent("keydown", {
                        bubbles: true, cancelable: true, key: "Enter", ctrlKey: true
                    });
                    document.body.dispatchEvent(ctrlEnterEvent);
                    
                    clearInterval(sendInterval);
                    chrome.storage.local.set({ autoSendEmailActive: false });
                } else if (attempts > 60) {
                    // Stop trying after 30 seconds
                    clearInterval(sendInterval);
                    chrome.storage.local.set({ autoSendEmailActive: false });
                    console.error("Could not find Send button.");
                }
            }, 500);
        } else {
             console.log("URL did not match compose parameters", window.location.search);
        }
    }
});
