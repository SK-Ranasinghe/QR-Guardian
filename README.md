# QR Guardian: An AI-Driven Interception Framework for Quishing Mitigation

## Project Overview

**QR Guardian** is a mobile cybersecurity application designed to reduce the risk of **quishing** attacks by intercepting QR payloads before they are executed. Instead of following the usual scan-and-open pattern used by ordinary QR readers, the application uses an **Interception-First** design philosophy. Every QR code is captured, paused, inspected, and only then released under user control.

At the centre of the system is a **4-Zone Security Engine**:

- **Zone 1** performs fast heuristic screening on the scanned payload.
- **Zone 2** applies AI-based semantic auditing to identify suspicious intent.
- **Zone 3** enriches the result with external threat intelligence.
- **Zone 4** controls release of the payload through risk-based confirmation.

This design allows QR Guardian to behave as a security checkpoint rather than a passive scanner.

---

## 2026 Tech Stack

QR Guardian is built on a modern cross-platform mobile stack designed to support rapid development, typed application logic, and integration with AI-assisted security services.

### Core Technologies

- **React Native**
  - used for the mobile user interface and cross-platform application logic

- **Expo SDK 55-aligned architecture**
  - the project configuration is maintained through `app.config.js`
  - this repository currently remains pinned to `expo ^54.0.32` in `package.json`, but the configuration path is structured around an SDK 55-style setup for the dissertation baseline

- **TypeScript**
  - used for typed interfaces, safer state management, and cleaner service integration

### AI and Global Telemetry Services

- **Gemini Flash-class semantic auditing**
  - the architecture supports **Gemini 3 Flash** as the intended 2026 semantic analysis model
  - in the current codebase, the model is configurable through `GEMINI_MODEL`, with `gemini-2.0-flash` used as the default fallback if no override is provided

- **VirusTotal**
  - used for multi-vendor URL reputation and malicious-engine verdicts

- **IP2Location / IP2WHOIS**
  - used to enrich scan results with domain age, registrar, country, and infrastructure context

- **Google Safe Browsing**
  - used for known-threat reputation checks during the earlier stage of the analysis flow

---

## Prerequisites

Before running the project, make sure the following tools are available:

- **Node.js v20 or later**
- **npm or yarn**
- **Expo Go** on a physical Android or iOS device

Optional but helpful:

- **Android Studio** for Android emulator testing
- **Xcode** for iOS simulator testing on macOS

---

## Installation and Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
```

### 2. Move into the Project Folder

```bash
cd QR-Guardian
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Expo Development Server

```bash
npx expo start
```

Once the development server starts, you can run the application using:

- **Expo Go** on a mobile device
- **Android emulator**
- **iOS simulator**
- **web preview**, where applicable

---

## Environment Configuration

QR Guardian depends on external security and intelligence services. These credentials must be supplied locally through environment files and **must not** be hard-coded into the repository.

Create a `.env` file in the project root and define the following values:

```env
GOOGLE_SAFE_BROWSING_API_KEY=
VIRUSTOTAL_API_KEY=
GEMINI_API_KEY=
EXPO_PUBLIC_GEMINI_API_KEY=
GEMINI_MODEL=
IP2LOCATION_API_KEY=
```

### Notes

- `GEMINI_MODEL` can be set to a Gemini Flash-class model appropriate to your deployment target.
- `EXPO_PUBLIC_GEMINI_API_KEY` is supported for compatibility with the current Expo runtime configuration.
- The application configuration also supports loading from `API.env`, but a local `.env` file is the simplest approach for examiners.

---

## Repository Structure

The repository is organised so that the mobile application, supporting services, and dissertation materials remain easy to navigate.

```text
QR-Guardian/
├── app/                            # Expo Router screens and navigation structure
├── assets/                         # Images, icons, and static visual assets
├── components/                     # Reusable UI components
├── constants/                      # Shared constants and configuration values
├── hooks/                          # Custom React hooks, including biometric lock logic
├── scripts/                        # Project utility scripts
├── utils/                          # Security engine and service integrations
├── CHAPTER_3_PROJECT_MANAGEMENT.md # Dissertation Chapter 3 draft
├── CHAPTER_5_DESIGN.md             # Dissertation Chapter 5 draft
├── CHAPTER_6_IMPLEMENTATION.md     # Dissertation Chapter 6 draft
├── app.config.js                   # Expo app configuration and environment binding
├── package.json                    # Project dependencies and scripts
└── README.md                       # Appendix E repository overview
```

### Main Directory Roles

- **`app/`**
  - contains the main mobile screens, route groups, and navigation flow used by Expo Router

- **`components/`**
  - stores reusable presentation elements such as premium UI cards and shared interface blocks

- **`hooks/`**
  - contains custom hooks used to manage app behaviour, including biometric access control

- **`utils/`**
  - contains the core security logic, including heuristic analysis, AI integration, threat intelligence services, local history management, and supporting utilities

- **`assets/`**
  - stores icons, splash assets, and other static resources required by the app

- **`CHAPTER_*.md` files**
  - hold dissertation chapter drafts written alongside the implementation work for documentation and submission support

---

## Architecture Mapping

- **Scanner and interception entry point**
  - `app/(tabs)/index.tsx`
  - handles QR capture, pauses the scan flow, triggers the first-stage analysis, stores history, and routes the user to the result screen

- **Zone 1 - Heuristics and reputation checks**
  - `utils/safetycheck.ts`
  - contains the local security engine, including entropy analysis, punycode detection, typosquatting checks, suspicious scheme handling, and Google Safe Browsing integration

- **Zone 2 - AI semantic analysis**
  - `utils/geminiAiService.ts`
  - sends scanned content to the Gemini model, extracts structured JSON from the response, and returns a typed semantic risk assessment

- **Zone 3 - External intelligence enrichment**
  - `utils/virusTotalService.ts`
  - `utils/ip2LocationService.ts`
  - provide multi-vendor reputation scanning and domain-age or registrar context to strengthen the final verdict

- **Zone 4 - Controlled release and decision logic**
  - `app/result.tsx`
  - combines the base scan result with AI and intelligence outputs, calculates adjusted confidence, and applies risk-based confirmation before opening a payload

- **Biometric access control**
  - `hooks/use-biometric-lock.ts`
  - `app/_layout.tsx`
  - enforce biometric protection before the user can access the main application screens

- **Local persistence and audit trail**
  - `utils/historyService.ts`
  - manages recent scan history so previous results can be reviewed inside the app

- **Presentation layer and premium UI**
  - `components/`
  - `components/ui/premium-ui.tsx`
  - support the Glassmorphism-inspired visual design used to present results, warnings, and dashboard summaries clearly

---

## Core Features: The 4-Zone Pipeline

QR Guardian follows a layered execution model designed to stop unsafe QR interactions before they are acted upon.

### Zone 1 - Heuristics

The first stage performs a fast local inspection of the scanned payload. This includes:

- **Shannon entropy analysis** to identify highly random or machine-generated domains
- **Punycode and homograph detection** to catch visually deceptive domain names
- typosquatting and suspicious TLD checks
- non-secure transport and open-redirect indicators
- scheme-level checks for potentially risky actions such as SMS, call, and Wi-Fi payloads

### Zone 2 - AI Semantic Analysis

The second stage applies semantic intent analysis to understand what the content appears to be trying to do. This layer is used to detect:

- phishing intent
- social-engineering cues
- deceptive wording
- suspicious calls to action

### Zone 3 - Intelligence Enrichment

The third stage adds external context through live services. This includes:

- **VirusTotal** for multi-vendor reputation checks
- **IP2Location / IP2WHOIS** for domain age and registrar context
- **Google Safe Browsing** for known malicious URL reputation

### Zone 4 - Controlled Release

The final stage prevents risky content from opening automatically. Instead, QR Guardian computes an adjusted risk picture and uses **risk-based open confirmation** before releasing the payload.

This means the system treats scanning and opening as two separate security decisions.

---

## Security Best Practices

QR Guardian was designed with practical security controls appropriate to a mobile dissertation prototype.

### API Key Handling

- API keys are loaded through `app.config.js`
- local secrets are expected to live in `.env` or `API.env`
- environment files are protected by `.gitignore` to reduce the risk of accidental leakage into version control

### Biometric Authentication

- the application uses **biometric authentication** through `expo-local-authentication`
- app access is gated before the main navigation stack is shown
- this helps protect locally stored scan history and reduces casual access to sensitive scan results

### Local Privacy Considerations

- scan history is stored locally using AsyncStorage
- no API keys are embedded directly into committed source files
- the scanner is designed to inspect content before execution rather than trusting payloads by default

---

## Academic Context

- **Developer:** Siyath Ranasinghe
- **Institution:** CICRA Campus
- **Module:** COM643 Future Technologies

This repository is maintained as part of the dissertation work for QR Guardian and is intended to demonstrate the design and implementation of a mobile AI-assisted framework for detecting and mitigating quishing threats.

---

## Appendix E Notes for Examiners

If you are reviewing this project as part of the dissertation appendix, the most important points to evaluate are:

- the **Interception-First** scanning model
- the structure of the **4-Zone Security Engine**
- the balance between local heuristics, AI semantics, and external telemetry
- the way risk is communicated to the user before a payload is opened

In practical terms, QR Guardian should be understood not as a basic QR reader, but as a mobile defensive layer designed to reduce the trust gap that makes quishing effective.
