import os
import sys
import datetime
import requests
from google import genai

# Load environment variables
SHEET_URL = os.environ.get("GOOGLE_SHEET_URL")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not SHEET_URL:
    print("Error: GOOGLE_SHEET_URL environment variable is not set.")
    sys.exit(1)

# Initialize Gemini Client if key is set
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY not set. Cannot generate LinkedIn posts.")

def get_sheets_data():
    try:
        r = requests.get(f"{SHEET_URL}?action=getData")
        if r.status_code == 200:
            return r.json().get("data", {})
    except Exception as e:
        print(f"Error fetching sheets data: {e}")
    return {}

def send_email_alert(message):
    if not ALERT_EMAIL:
        print("Alert email is not set. Skipping message.")
        return False
    payload = {
        "action": "sendEmail",
        "email": ALERT_EMAIL,
        "subject": "AURA Reminder Alert",
        "message": message
    }
    try:
        r = requests.post(SHEET_URL, json=payload)
        return r.status_code == 200
    except Exception as e:
        print(f"Error sending Email message: {e}")
        return False

def update_linkedin_post(date_str, topic, draft, status):
    payload = {
        "action": "updateLinkedInPost",
        "date": date_str,
        "topic": topic,
        "draft": draft,
        "status": status
    }
    try:
        r = requests.post(SHEET_URL, json=payload)
        return r.status_code == 200
    except Exception as e:
        print(f"Error updating LinkedIn post: {e}")
        return False

def generate_linkedin_post(topic_idx, subject):
    if not client:
        return "Gemini API key is not configured."
    
    prompt = f"""
    Write an engaging, high-quality LinkedIn post about the following subject:
    "{subject}"
    
    Guidelines:
    1. Hook the reader in the first 2 lines.
    2. Use short, readable paragraphs (1-2 sentences max).
    3. Include bullet points or clear spacing.
    4. Keep a professional yet personal tone (share a key lesson, problem solved, or valuable tip).
    5. Add 3-5 relevant hashtags at the very end.
    6. Include emojis naturally to make it visually engaging but keep it professional.
    7. Avoid boring corporate jargon.
    
    Return only the final LinkedIn post content (do not include introductory or concluding conversational text).
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return f"Failed to generate draft. Error: {e}"

def parse_time(time_str):
    """Safely parse naive datetimes from different browser formatting"""
    # e.g., '2026-06-19T18:30:00.000Z' or '2026-06-19 18:30'
    time_str = time_str.replace("Z", "").replace("T", " ")
    time_str = time_str[:16] # Take 'YYYY-MM-DD HH:MM'
    return datetime.datetime.strptime(time_str, "%Y-%m-%d %H:%M")

def run_reminders_and_alerts(data):
    reminders = data.get("reminders", [])
    # Align to user's localized timezone (+05:30 IST)
    now_local = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
    
    print(f"Checking reminders (Local Time: {now_local.strftime('%Y-%m-%d %H:%M')})...")
    
    for rem in reminders:
        if rem.get("Status") == "Active":
            try:
                due_time = parse_time(rem.get("Time"))
                if now_local >= due_time:
                    msg = f"🔔 Envy ALERT:\n\n{rem.get('Message')}"
                    print(f"Triggering Email alert for: {rem.get('Message')}")
                    if send_email_alert(msg):
                        # Log success and update state
                        requests.post(SHEET_URL, json={
                            "action": "addLog",
                            "activity": f"Alert Triggered",
                            "details": f"Message: {rem.get('Message')}",
                            "mood": "⚡ Alerted"
                        })
            except Exception as ex:
                print(f"Error parsing reminder time {rem.get('Time')}: {ex}")

def run_daily_linkedin_generation(data):
    # Today's date in local timezone (+05:30 IST)
    today_str = (datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")
    
    # Check if we already have drafts for today
    existing_today = [p for p in data.get("linkedin", []) if p.get("Date").startswith(today_str)]
    
    if len(existing_today) >= 3:
        print("LinkedIn drafts for today already exist. Skipping generation.")
        return

    subjects = [
        "A coding problem/bug that was solved and the core architectural lesson learned.",
        "The future of AI agents, building serverless automation apps, and productivity gains.",
        "Daily productivity tips: how to stay focused, tackle task lists, and work efficiently."
    ]
    
    print(f"Generating daily LinkedIn posts for: {today_str}...")
    
    for i, subj in enumerate(subjects):
        topic_name = f"Daily Topic #{i+1}"
        already_generated = False
        for p in existing_today:
            if p.get("Topic") == topic_name:
                already_generated = True
                break
                
        if already_generated:
            continue
            
        print(f"Drafting {topic_name} using Gemini API...")
        draft = generate_linkedin_post(i, subj)
        
        success = update_linkedin_post(today_str, topic_name, draft, "Draft")
        if success:
            print(f"Successfully saved {topic_name} draft to Google Sheet.")
        else:
            print(f"Failed to save {topic_name} to Google Sheet.")

def main():
    print("Envy Automation Task Starting...")
    data = get_sheets_data()
    if not data:
        print("Could not retrieve sheet database data. Exiting.")
        sys.exit(1)
        
    # 1. Run reminders check
    run_reminders_and_alerts(data)
    
    # 2. Run LinkedIn content generation
    run_daily_linkedin_generation(data)
    
    print("Envy Automation completed successfully.")

if __name__ == "__main__":
    main()
