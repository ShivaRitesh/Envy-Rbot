import os
import sys
import datetime
import requests

# Load environment variables
SHEET_URL = os.environ.get("GOOGLE_SHEET_URL")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL")

if not SHEET_URL:
    print("Error: GOOGLE_SHEET_URL environment variable is not set.")
    sys.exit(1)

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
        "subject": "Envy Reminder Alert",
        "message": message
    }
    try:
        r = requests.post(SHEET_URL, json=payload)
        return r.status_code == 200
    except Exception as e:
        print(f"Error sending Email message: {e}")
        return False

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
                        # Log success and update status in Sheets via addLog
                        requests.post(SHEET_URL, json={
                            "action": "addLog",
                            "activity": f"Alert Triggered",
                            "details": f"Message: {rem.get('Message')}",
                            "mood": "⚡ Alerted"
                        })
            except Exception as ex:
                print(f"Error parsing reminder time {rem.get('Time')}: {ex}")

def main():
    print("Envy Automation Task Starting...")
    data = get_sheets_data()
    if not data:
        print("Could not retrieve sheet database data. Exiting.")
        sys.exit(1)
        
    # Run reminders check
    run_reminders_and_alerts(data)
    
    print("Envy Automation completed successfully.")

if __name__ == "__main__":
    main()
