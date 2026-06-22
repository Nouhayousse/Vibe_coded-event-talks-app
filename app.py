import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed data
feed_cache = {
    "data": None,
    "expiry": 0,
    "last_fetched": None
}
CACHE_DURATION_SECONDS = 300  # 5 minutes

def fetch_and_parse_feed(force_refresh=False):
    current_time = time.time()
    
    # Use cache if valid and not forcing a refresh
    if not force_refresh and feed_cache["data"] is not None and current_time < feed_cache["expiry"]:
        logger.info("Serving BigQuery release notes from cache.")
        return feed_cache["data"], feed_cache["last_fetched"], False

    logger.info(f"Fetching fresh BigQuery release notes from {FEED_URL}...")
    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    ns = "{http://www.w3.org/2005/Atom}"
    
    entries = []
    for entry in root.findall(f"{ns}entry"):
        title_el = entry.find(f"{ns}title")
        updated_el = entry.find(f"{ns}updated")
        id_el = entry.find(f"{ns}id")
        content_el = entry.find(f"{ns}content")
        
        # Link tag parsing
        link_el = entry.find(f"{ns}link")
        link = ""
        if link_el is not None:
            link = link_el.attrib.get("href", "")
            
        title = title_el.text if title_el is not None else ""
        updated = updated_el.text if updated_el is not None else ""
        entry_id = id_el.text if id_el is not None else ""
        content = content_el.text if content_el is not None else ""
        
        entries.append({
            "title": title,
            "updated": updated,
            "id": entry_id,
            "link": link,
            "content": content
        })
        
    last_fetched_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(current_time))
    feed_cache["data"] = entries
    feed_cache["expiry"] = current_time + CACHE_DURATION_SECONDS
    feed_cache["last_fetched"] = last_fetched_str
    
    logger.info(f"Successfully fetched {len(entries)} entries and updated cache.")
    return entries, last_fetched_str, True

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        entries, last_fetched, was_refreshed = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            "status": "success",
            "count": len(entries),
            "last_fetched": last_fetched,
            "cached": not was_refreshed,
            "data": entries
        })
    except Exception as e:
        logger.error(f"Error fetching release notes: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to retrieve release notes: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
