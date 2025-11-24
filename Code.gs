function doGet(e) {
  var ss = SpreadsheetApp.openById('1apjgSt6EGzvSajk7YkkDopNNufhjchdnZv5ENV9k4LY');
  var sheet = ss.getSheetByName('Projects') || ss.getSheets()[0];
  var action = e.parameter.action;

  // GET - Retrieve a single project
  if (action === 'get') {
    var projectName = e.parameter.project;
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === projectName) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          project: data[i][0],
          progress: data[i][1],
          stage: data[i][2],
          updated: data[i][3],
          color: data[i][4] || 'orange',
          reviewLink: data[i][5] || ''
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Project not found'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // SAVE - Create or update a project
  if (action === 'save') {
    var projectName = e.parameter.project;
    var progress = e.parameter.progress || 0;
    var stage = e.parameter.stage || 'Received';
    var color = e.parameter.color || 'orange';
    var reviewLink = e.parameter.reviewLink || '';
    var updated = new Date().toISOString();

    var data = sheet.getDataRange().getValues();
    var found = false;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === projectName) {
        sheet.getRange(i + 1, 2).setValue(progress);
        sheet.getRange(i + 1, 3).setValue(stage);
        sheet.getRange(i + 1, 4).setValue(updated);
        sheet.getRange(i + 1, 5).setValue(color);
        sheet.getRange(i + 1, 6).setValue(reviewLink);
        found = true;
        break;
      }
    }

    if (!found) {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['project', 'progress', 'stage', 'updated', 'color', 'reviewLink']);
      }
      sheet.appendRow([projectName, progress, stage, updated, color, reviewLink]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // LIST - Get all projects
  if (action === 'list') {
    var data = sheet.getDataRange().getValues();
    var projects = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        projects.push({
          project: data[i][0],
          progress: data[i][1],
          stage: data[i][2],
          updated: data[i][3],
          color: data[i][4] || 'orange',
          reviewLink: data[i][5] || ''
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      projects: projects
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // DELETE - Remove a project AND its feedback
  if (action === 'delete') {
    var projectName = e.parameter.project;
    var data = sheet.getDataRange().getValues();
    var deleted = false;

    // Delete from Projects sheet
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === projectName) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    // Also delete all feedback for this project
    var feedbackSheet = ss.getSheetByName('Feedback');
    if (feedbackSheet && feedbackSheet.getLastRow() > 1) {
      var fbData = feedbackSheet.getDataRange().getValues();
      // Delete from bottom to top to avoid row index shifting
      for (var j = fbData.length - 1; j >= 1; j--) {
        if (fbData[j][1] === projectName) {
          feedbackSheet.deleteRow(j + 1);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: deleted
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // FEEDBACK - Save customer feedback
  if (action === 'feedback') {
    var feedbackSheet = ss.getSheetByName('Feedback');

    if (!feedbackSheet) {
      feedbackSheet = ss.insertSheet('Feedback');
      feedbackSheet.appendRow(['Timestamp', 'Project', 'Feedback']);
      feedbackSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    }

    feedbackSheet.appendRow([
      e.parameter.timestamp || new Date().toISOString(),
      e.parameter.project || 'Unknown',
      e.parameter.feedback || ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // GET FEEDBACK - Retrieve all feedback (newest first) and clean orphans
  if (action === 'getFeedback') {
    var feedbackSheet = ss.getSheetByName('Feedback');
    var feedback = [];

    if (feedbackSheet && feedbackSheet.getLastRow() > 1) {
      // Get list of existing projects
      var projectData = sheet.getDataRange().getValues();
      var existingProjects = {};
      for (var p = 1; p < projectData.length; p++) {
        if (projectData[p][0]) {
          existingProjects[projectData[p][0]] = true;
        }
      }

      var fbData = feedbackSheet.getDataRange().getValues();
      var rowsToDelete = [];

      // Collect feedback and mark orphans for deletion
      for (var i = fbData.length - 1; i >= 1; i--) {
        var fbProject = fbData[i][1];
        if (existingProjects[fbProject]) {
          // Project exists, keep feedback
          feedback.push({
            timestamp: fbData[i][0],
            project: fbProject,
            feedback: fbData[i][2]
          });
        } else {
          // Project doesn't exist, mark for deletion
          rowsToDelete.push(i + 1);
        }
      }

      // Delete orphan feedback rows (already sorted high to low)
      for (var d = 0; d < rowsToDelete.length; d++) {
        feedbackSheet.deleteRow(rowsToDelete[d]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      feedback: feedback
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Default response
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Invalid action'
  })).setMimeType(ContentService.MimeType.JSON);
}
