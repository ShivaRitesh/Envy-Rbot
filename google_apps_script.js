// Google Apps Script to run on Google Sheets (Phase 2)
// This serves as the free database API for the Envy Assistant Dashboard

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
    
    // Read LinkedIn/Social Posts
    var liSheet = getOrCreateSheet(sheet, "LinkedInPosts", ["Date", "Topic", "LinkedInDraft", "TwitterDraft", "InstagramDraft", "InstagramPrompt", "Status"]);
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
    var liSheet = getOrCreateSheet(sheet, "LinkedInPosts", ["Date", "Topic", "LinkedInDraft", "TwitterDraft", "InstagramDraft", "InstagramPrompt", "Status"]);
    var data = liSheet.getDataRange().getValues();
    var dateStr = postData.date; // format YYYY-MM-DD
    for (var i = 1; i < data.length; i++) {
      var rowDate = new Date(data[i][0]);
      var rowDateStr = rowDate.toISOString().split('T')[0];
      if (rowDateStr === dateStr && data[i][1] === postData.topic) {
        liSheet.getRange(i + 1, 3).setValue(postData.linkedin || data[i][2]);
        liSheet.getRange(i + 1, 4).setValue(postData.twitter || data[i][3]);
        liSheet.getRange(i + 1, 5).setValue(postData.instagram || data[i][4]);
        liSheet.getRange(i + 1, 6).setValue(postData.instagramPrompt || data[i][5]);
        liSheet.getRange(i + 1, 7).setValue(postData.status || data[i][6]);
        return jsonResponse({ success: true });
      }
    }
    // If not found, add it
    liSheet.appendRow([
      postData.date, 
      postData.topic, 
      postData.linkedin || "", 
      postData.twitter || "", 
      postData.instagram || "", 
      postData.instagramPrompt || "", 
      postData.status || "Draft"
    ]);
    return jsonResponse({ success: true });
  }
  
  if (action === "sendEmail") {
    var email = postData.email || ALERT_EMAIL;
    if (!email) {
      return jsonResponse({ success: false, message: "Missing Email address" });
    }
    var success = sendEmail(email, postData.subject || "Envy Reminder Alert", postData.message);
    return jsonResponse({ success: success });
  }
  
  if (action === "sendWeeklyDigest") {
    var email = postData.email || ALERT_EMAIL;
    if (!email) {
      return jsonResponse({ success: false, message: "Missing Email address" });
    }
    var success = sendWeeklyDigestEmail(email);
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

// Scheduled Trigger function for Weekly digest
function triggerWeeklyDigest() {
  if (ALERT_EMAIL) {
    sendWeeklyDigestEmail(ALERT_EMAIL);
  }
}

function sendWeeklyDigestEmail(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var logsSheet = sheet.getSheetByName("WorkLogs");
  var tasksSheet = sheet.getSheetByName("Tasks");
  
  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  var logsHtml = "";
  var tasksHtml = "";
  
  // 1. Compile Logs
  if (logsSheet) {
    var logsData = getSheetData(logsSheet);
    var filteredLogs = logsData.filter(function(log) {
      var logDate = new Date(log.Date);
      return logDate >= sevenDaysAgo;
    });
    
    if (filteredLogs.length > 0) {
      filteredLogs.forEach(function(log) {
        var dateStr = new Date(log.Date).toLocaleDateString();
        logsHtml += "<div style='margin-bottom:12px; padding:10px; background:#f4f5f7; border-left:4px solid #1f6feb; border-radius:4px;'>" +
                    "<strong>" + log.Activity + "</strong> <span style='font-size:11px; color:#555;'>(" + dateStr + ")</span><br>" +
                    "<p style='margin:4px 0 0 0; font-size:13px; color:#333;'>" + log.Details + "</p>" +
                    "<span style='font-size:11px; background:#e1e4e8; padding:2px 6px; border-radius:3px; display:inline-block; margin-top:4px;'>" + log.Mood + "</span>" +
                    "</div>";
      });
    } else {
      logsHtml = "<p style='color:#666;'>No work logs recorded in the last 7 days.</p>";
    }
  }
  
  // 2. Compile Tasks
  if (tasksSheet) {
    var tasksData = getSheetData(tasksSheet);
    var completedCount = 0;
    var pendingCount = 0;
    
    tasksData.forEach(function(task) {
      if (task.Status === "Completed") {
        completedCount++;
      } else {
        pendingCount++;
        var dateStr = new Date(task.DueDate).toLocaleDateString();
        tasksHtml += "<li style='margin-bottom:6px; font-size:14px;'>" +
                     "<strong>" + task.Task + "</strong> " +
                     "<span style='color:#f85149; font-size:12px;'>[Pending - Due: " + dateStr + "]</span>" +
                     "</li>";
      }
    });
    
    if (pendingCount === 0) {
      tasksHtml = "<p style='color:#2ea44f;'>🎉 All tasks completed! No pending items.</p>";
    } else {
      tasksHtml = "<ul>" + tasksHtml + "</ul>";
    }
  }
  
  // Build Beautiful Email Layout
  var htmlBody = "<div style='font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e1e4e8; border-radius:8px;'>" +
                 "<h1 style='color:#1f6feb; margin-top:0; border-bottom:1px solid #e1e4e8; padding-bottom:10px;'>Envy Weekly Digest</h1>" +
                 "<p style='font-size:14px; color:#555;'>Here is your weekly productivity summary for the last 7 days.</p>" +
                 
                 "<h2 style='color:#24292e; font-size:18px; margin-top:20px;'>⚡ Work Achievements</h2>" +
                 logsHtml +
                 
                 "<h2 style='color:#24292e; font-size:18px; margin-top:20px;'>📋 Task Status Summary</h2>" +
                 "<p style='font-size:14px;'>Completed Tasks: <strong style='color:#2ea44f;'>" + completedCount + "</strong> | Pending Tasks: <strong style='color:#f85149;'>" + pendingCount + "</strong></p>" +
                 tasksHtml +
                 
                 "<div style='margin-top:30px; border-top:1px solid #e1e4e8; padding-top:15px; font-size:11px; color:#888; text-align:center;'>" +
                 "Weekly digest generated automatically by your Envy Assistant." +
                 "</div>" +
                 "</div>";
                 
  try {
    MailApp.sendEmail(email, "Envy Weekly Productivity Digest", "", { htmlBody: htmlBody });
    return true;
  } catch (e) {
    Logger.log("Failed to send weekly digest: " + e.message);
    return false;
  }
}
