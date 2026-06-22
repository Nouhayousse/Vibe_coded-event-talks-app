# BigQuery Release Pulse 🚀

A modern web application built using Python Flask, plain vanilla HTML5, CSS3, and ES6 JavaScript. It fetches the official Google Cloud BigQuery Release Notes RSS feed, categorizes the updates dynamically, and enables sharing them directly on X (Twitter).

---

## 🌟 Main Features

*   **Dynamic Feed Ingestion**: Connects to the public Google Cloud feeds endpoint to parse Atom XML.
*   **Server-Side In-Memory Cache**: Restricts redundant requests with a 5-minute cache timeout.
*   **Granular Element Splitting**: Splits daily release bundles into discrete, selectable cards based on update headings (e.g., Features, Announcements, Fixes, Deprecations).
*   **Dashboard Filters & Full-Text Search**: Filter categories instantly via tag chips with dynamic counts, and search updates in real-time.
*   **Sleek Glassmorphic Dark-Mode UI**: Built with responsive layouts, skeleton shimmer loaders, custom scrollbars, and fluid CSS hover animations.
*   **X (Twitter) Share Center**:
    *   **Single-card share**: Composes a structured tweet draft containing deep-links, categories, and tags.
    *   **Multi-card thread digest**: Aggregates multiple updates into a concise bulleted list.
    *   **Smart limits**: Accounts for Twitter's 280-character maximum and calculates the standard 23-character t.co link cost. Features an interactive circular count visualizer.

---

## 🛠️ Technology Stack

*   **Backend**: Python 3, Flask, standard library XML parser (`xml.etree.ElementTree`), `requests`
*   **Frontend**: Plain HTML5, Vanilla CSS3 (Custom Variables, Grid/Flexbox), ES6 JavaScript (DOM Parser, Promises, Fetch API)

---

## 📂 Project Structure

```text
├── app.py                  # Flask web server, API routes, feed fetching & caching
├── templates/
│   └── index.html          # Semantic HTML5 dashboard layout
├── static/
│   ├── css/
│   │   └── styles.css      # Custom dark-theme stylesheet & animations
│   └── js/
│       └── app.js          # DOM parsing logic, feed bindings, selection, and tweet compiler
├── requirements.txt        # Frozen Python project dependencies
├── .gitignore              # Ignores byte caches, env folders, and IDE configurations
└── README.md               # Project documentation & guidelines
```

---

## 🚀 Installation & Local Execution

### 1. Prerequisite Checklist
*   Python 3.x installed on your local operating system.
*   Git command-line client.

### 2. Setup steps
Open a terminal in the project directory and follow these commands:

```bash
# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On macOS / Linux:
source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

### 3. Launch the server
```bash
python app.py
```
*   The Flask application will start in developer mode.
*   Access the live dashboard at: **`http://127.0.0.1:5000`**

---

## 📤 Push to GitHub

To push the project to a new repository in your GitHub account, run the following commands in your authenticated terminal:

```bash
# Initialize and commit locally (if not already done)
git init
git branch -M main
git add .
git commit -m "Initial commit: BigQuery Release Pulse application"

# Create remote repository on GitHub and push local files
gh repo create Vibe_coded-event-talks-app --public --source=. --push
```
