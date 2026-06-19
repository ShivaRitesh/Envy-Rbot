// Google Apps Script to run on Google Sheets
// This serves as the free database API for the Personal Assistant Dashboard

// Replace with your default email address for alerts
var ALERT_EMAIL = "";

function doGet(e) {
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "getData") {
    var data = {};
    
    // Read Tasks
    var tasksSheet = getOrCreateSheet(sheet, "Tasks", ["ID", "Task", "DueDate", "Priority", "Status"]);
    data.tasks = getSheetData(tasksSheet);
    
    // Read Reminders
    var remindersSheet = getOrCreateSheet(sheet, "Reminders", ["ID", "Message", "Time", "Status"]);
    data.reminders = getSheetData(remindersSheet);
    
    // Read WorkLogs
    var logsSheet = getOrCreateSheet(sheet, "WorkLogs", ["Date", "Activity", "Details", "Mood"]);
    data.logs = getSheetData(logsSheet);
    
    // Read LinkedIn Posts
    var liSheet = getOrCreateSheet(sheet, "LinkedInPosts", ["Date", "Topic", "DraftPost", "Status"]);
    data.linkedin = getSheetData(liSheet);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var postData = JSON.parse(e.postData.contents);
  var action = postData.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "addTask") {
    var tasksSheet = getOrCreateSheet(sheet, "Tasks", ["ID", "Task", "DueDate", "Priority", "Status"]);
    var id = Utilities.getUuid();
    tasksSheet.appendRow([id, postData.task, postData.dueDate, postData.priority, "Pending"]);
    return jsonResponse({ success: true, id: id });
  }
  
  if (action === "updateTaskStatus") {
    var tasksSheet = getOrCreateSheet(sheet, "Tasks", ["ID", "Task", "DueDate", "Priority", "Status"]);
    var data = tasksSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === postData.id) {
        tasksSheet.getRange(i + 1, 5).setValue(postData.status);
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, message: "Task not found" });
  }

  if (action === "addReminder") {
    var remindersSheet = getOrCreateSheet(sheet, "Reminders", ["ID", "Message", "Time", "Status"]);
    var id = Utilities.getUuid();
    remindersSheet.appendRow([id, postData.message, postData.time, "Active"]);
    return jsonResponse({ success: true, id: id });
  }
  
  if (action === "addLog") {
    var logsSheet = getOrCreateSheet(sheet, "WorkLogs", ["Date", "Activity", "Details", "Mood"]);
    logsSheet.appendRow([new Date().toISOString(), postData.activity, postData.details, postData.mood || "Neutral"]);
    return jsonResponse({ success: true });
  }
  
  if (action === "updateLinkedInPost") {
    var liSheet = getOrCreateSheet(sheet, "LinkedInPosts", ["Date", "Topic", "DraftPost", "Status"]);
    var data = liSheet.getDataRange().getValues();
    var dateStr = postData.date; // format YYYY-MM-DD
    for (var i = 1; i < data.length; i++) {
      var rowDate = new Date(data[i][0]);
      var rowDateStr = rowDate.toISOString().split('T')[0];
      if (rowDateStr === dateStr && data[i][1] === postData.topic) {
        liSheet.getRange(i + 1, 3).setValue(postData.draft);
        liSheet.getRange(i + 1, 4).setValue(postData.status);
        return jsonResponse({ success: true });
      }
    }
    // If not found, add it
    liSheet.appendRow([postData.date, postData.topic, postData.draft, postData.status]);
    return jsonResponse({ success: true });
  }
  
  if (action === "sendEmail") {
    var email = postData.email || ALERT_EMAIL;
    if (!email) {
      return jsonResponse({ success: false, message: "Missing Email address" });
    }
    var success = sendEmail(email, postData.subject || "AURA Reminder Alert", postData.message);
    return jsonResponse({ success: success });
  }
  
  return jsonResponse({ success: false, message: "Unknown action" });
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function getSheetData(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    result.push(obj);
  }
  return result;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendEmail(email, subject, text) {
  try {
    MailApp.sendEmail(email, subject, text);
    return true;
  } catch (e) {
    return false;
  }
}
