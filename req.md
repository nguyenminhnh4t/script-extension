# Chrome Extension MVP Spec — Simple Browser Automation (Automa-lite, Config-Based)

## Product Goal

Build a lightweight Chrome Extension (Manifest V3) that allows users to:

* Create automation scenarios
* Configure steps manually (JSON/form-based)
* Run sequences on websites
* Perform:

  * Open URL
  * Fill input
  * Click element
  * Select dropdown
  * Wait
  * Conditional existence check (basic)
* Save/load scenarios locally

---

# Core Philosophy

**No drag-drop builder**
**No visual workflow canvas**
**Config-first**
**Simple, fast, maintainable**

---

# Primary Use Cases

## 1. Login automation

* Open login page
* Fill username
* Fill password
* Click login

## 2. Demo flow

* Login
* Search customer
* Click report
* Export

## 3. Internal repetitive tasks

* CRM
* HR portal
* Admin dashboards

---

# Tech Stack

## Frontend:

* Vitejs 
* Tailwind
* Chrome Extension Popup UI

## Backend:

* Chrome Extension APIs:

  * `chrome.storage.local`
  * `chrome.tabs`
  * `chrome.scripting`
  * `chrome.runtime`

---

# Architecture

## Components:

```txt
popup/
  - ScenarioList
  - ScenarioEditor
  - RunScenarioButton

background/
  - scenarioRunner
  - tabManager

content/
  - actionExecutor
```

---

# Manifest Permissions

```json
{
  "manifest_version": 3,
  "name": "Simple Automation Runner",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "tabs",
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

---

# Scenario JSON Schema

```json
{
  "id": "login-demo-001",
  "name": "Demo Login",
  "startUrl": "https://example.com/login",
  "steps": [
    {
      "type": "fill",
      "selector": "#UserName",
      "value": "demoUser"
    },
    {
      "type": "fill",
      "selector": "#Password",
      "value": "demoPass"
    },
    {
      "type": "click",
      "selector": "button[type='submit']"
    }
  ]
}
```

---

# Supported Step Types

## 1. OPEN_URL

```json
{
  "type": "open_url",
  "url": "https://example.com"
}
```

## 2. FILL

```json
{
  "type": "fill",
  "selector": "#UserName",
  "value": "demoUser"
}
```

## 3. CLICK

```json
{
  "type": "click",
  "selector": "#loginBtn"
}
```

## 4. SELECT

```json
{
  "type": "select",
  "selector": "#country",
  "value": "VN"
}
```

## 5. WAIT

```json
{
  "type": "wait",
  "duration": 2000
}
```

## 6. WAIT_FOR_ELEMENT

```json
{
  "type": "wait_for_element",
  "selector": "#dashboard",
  "timeout": 10000
}
```

---

# Execution Engine

## Flow:

```txt
Run Scenario
→ Open tab/start URL
→ Execute step 1
→ Execute step 2
→ Execute step N
→ Log success/failure
```

---

# Content Script Execution Helpers

## Fill:

```js
function setNativeValue(selector, value) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  ).set;

  setter.call(element, value);

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
```

## Click:

```js
function clickElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  element.click();
}
```

## Wait for element:

```js
async function waitForElement(selector, timeout = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;

    await new Promise(r => setTimeout(r, 300));
  }

  throw new Error(`Timeout waiting for ${selector}`);
}
```

---

# Background Runner Logic

## Responsibilities:

* Open tab
* Inject content script
* Sequentially run steps
* Handle async waits
* Store logs

## Pseudocode:

```txt
for step in scenario.steps:
   switch(step.type):
      open_url
      fill
      click
      select
      wait
      wait_for_element
```

---

# Popup UI Requirements

## Scenario List:

* List saved scenarios
* Run button
* Edit button
* Delete button

## Scenario Editor:

### Fields:

* Scenario Name
* Start URL
* Step list

### Step fields:

* Type dropdown
* Selector input
* Value input
* Timeout input

---

# Storage Model

Use:

```js
chrome.storage.local.set({
  scenarios: [...]
});
```

---

# Logging

Each run:

```json
{
  "scenarioId": "login-demo-001",
  "startedAt": "...",
  "endedAt": "...",
  "status": "success",
  "steps": [
    {
      "step": 1,
      "status": "success"
    }
  ]
}
```

---

# Error Handling

## Required:

* Selector not found
* Timeout
* Invalid config
* Tab closed

## UX:

* Show failed step number
* Show error message
* Stop execution immediately

---

# Security

## MVP:

* Store plaintext config locally only
* Warn users not to store production credentials

## Future:

* Encrypt secrets
* Variable injection
* Password masking

---

# MVP Scope (Must Have)

## Include:

* Scenario CRUD
* JSON config
* Step execution
* Sequential runner
* Logs
* Chrome popup UI

## Exclude:

* Drag-drop
* AI
* OCR
* Cloud sync
* Team sharing
* Recorder
* CAPTCHA solving

---

# Folder Structure

```txt
extension/
 ┣ manifest.json
 ┣ background.js
 ┣ content.js
 ┣ popup.html
 ┣ popup.js
 ┣ styles.css
 ┗ storage.js
```

---

# Implementation Priorities

## Week 1:

* Manifest
* Popup
* Scenario save
* Run basic steps

## Week 2:

* Wait logic
* Logs
* Validation
* Error UX

## Week 3:

* Import/export
* Templates
* Variable system

---

# Success Criteria

A user can:

## In under 2 minutes:

1. Create scenario
2. Input:

```txt
#UserName
#Password
button[type='submit']
```

3. Click Run
4. Browser auto logs in

---

# Future Positioning

## This is:

**“Config-driven browser task runner”**

Not Selenium
Not Zapier
Not full Automa

### It should feel like:

**Fast, simple, internal productivity tool**
