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

def check_evening_review_alert(data):
    logs = data.get("logs", [])
    now_local = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
    today_str = now_local.strftime('%Y-%m-%d')
    
    # Check if it is past 6 PM (18:00)
    if now_local.hour >= 18:
        already_sent = False
        for log in logs:
            log_date_str = log.get("Date", "")
            if log_date_str and log.get("Activity") == "Evening Check-in Alert":
                try:
                    # Parse log date. Handle different possible formats.
                    log_date_str_clean = log_date_str.split(".")[0].replace("Z", "").replace("T", " ")
                    log_date = datetime.datetime.strptime(log_date_str_clean[:19], "%Y-%m-%d %H:%M:%S")
                    # Assume log Date is UTC and convert to local time
                    log_local = log_date + datetime.timedelta(hours=5, minutes=30)
                    if log_local.strftime('%Y-%m-%d') == today_str:
                        already_sent = True
                        break
                except Exception as e:
                    print(f"Error parsing log date {log_date_str}: {e}")
                    
        if not already_sent:
            msg = "👋 Hi Ritesh! It's past 6:00 PM. Time for your evening check-in with Envy!\n\nOpen your Envy Dashboard to log your daily tasks, pending works, and plan your agenda for tomorrow. You can use voice dictation by clicking the microphone icon next to the chat input!"
            print("Sending evening check-in alert email...")
            if send_email_alert(msg):
                # Log success in Sheets
                requests.post(SHEET_URL, json={
                    "action": "addLog",
                    "activity": "Evening Check-in Alert",
                    "details": "Sent daily review reminder.",
                    "mood": "⚡ Active"
                })

def main():
    print("Envy Automation Task Starting...")
    data = get_sheets_data()
    if not data:
        print("Could not retrieve sheet database data. Exiting.")
        sys.exit(1)
        
    # Run reminders check
    run_reminders_and_alerts(data)
    
    # Run evening check-in review alert check
    check_evening_review_alert(data)
    
    print("Envy Automation completed successfully.")

if __name__ == "__main__":
    main()

