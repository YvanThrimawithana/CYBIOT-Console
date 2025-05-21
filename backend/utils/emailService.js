const nodemailer = require('nodemailer');

// Create a transporter object using the default SMTP transport
let transporter;

// Initialize transporter based on environment
const initTransporter = () => {
  if (transporter) return;
  
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'youremail@gmail.com',
      pass: process.env.SMTP_PASS || 'yourpassword'
    }
  });
};

/**
 * Default email options
 */
const defaultOptions = {
  from: process.env.EMAIL_FROM || 'cybiot.alert@mailfence.com',
  to: process.env.ADMIN_EMAIL || 'cybiot.analyst@mailfence.com',
};

/**
 * Send an email using Nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email (defaults to ADMIN_EMAIL)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email content
 * @param {string} options.html - HTML email content
 * @returns {Promise} - Nodemailer response or error
 */
const sendEmail = async (options) => {
  try {
    // Initialize transporter if not already done
    initTransporter();
    
    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP credentials not set in .env file. Email notifications disabled.');
      return { success: false, error: 'SMTP credentials not configured' };
    }
    
    const emailOptions = {
      ...defaultOptions,
      ...options,
    };

    const info = await transporter.sendMail(emailOptions);
    console.log(`✅ Email sent to ${emailOptions.to}, message ID: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`❌ Failed to send email: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send an alert notification email
 * @param {Object} alert - The alert data
 * @returns {Promise} - Nodemailer response
 */
const sendAlertNotification = async (alert) => {
  const subject = `⚠️ [${alert.severity}] Security Alert: ${alert.ruleName}`;
  
  // Format the timestamp
  const timestamp = new Date(alert.timestamp).toLocaleString();
  
  // Create HTML content with better formatting
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="background-color: #f8d7da; color: #721c24; padding: 10px 15px; border-radius: 3px; margin-bottom: 20px;">
        <h2 style="margin: 0;">${subject}</h2>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>Alert Description:</strong> ${alert.description}</p>
        <p><strong>Device IP:</strong> ${alert.deviceIp}</p>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <p><strong>Severity:</strong> ${alert.severity}</p>
        <p><strong>Status:</strong> ${alert.status}</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 3px;">
        <h3 style="margin-top: 0;">Matched Event Information</h3>
        <pre style="background-color: #f1f1f1; padding: 10px; border-radius: 3px; overflow: auto;">
${JSON.stringify(alert.matchedLogs?.[0] || {}, null, 2)}
        </pre>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="color: #6c757d; font-size: 12px;">
          This is an automated message from the CYBIOT SecureIOT platform. Do not reply to this message.
        </p>
      </div>
    </div>
  `;

  // Plain text fallback
  const text = `
SECURITY ALERT: ${alert.ruleName}
Severity: ${alert.severity}
Description: ${alert.description}
Device IP: ${alert.deviceIp}
Timestamp: ${timestamp}
Status: ${alert.status}

Alert Details:
${JSON.stringify(alert.matchedLogs?.[0] || {}, null, 2)}

This is an automated message from the CYBIOT SecureIOT platform.
  `;

  return sendEmail({
    subject,
    html,
    text,
  });
};

/**
 * Send a follow-up notification when an alert is triggered multiple times
 * @param {Object} alert - The alert data
 * @param {number} threshold - The threshold that was reached
 * @returns {Promise} - Nodemailer response
 */
const sendFollowupNotification = async (alert, threshold) => {
  const subject = `🔄 [FOLLOW-UP] Alert ${alert.ruleName} triggered ${threshold} times`;
  
  // Format timestamps
  const firstTimestamp = new Date(alert.timestamp).toLocaleString();
  const lastTimestamp = new Date(alert.lastUpdated).toLocaleString();
  const duration = Math.round((new Date(alert.lastUpdated) - new Date(alert.timestamp)) / (60 * 1000)); // in minutes
  
  // Create HTML content with better formatting
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="background-color: #f8d7da; color: #721c24; padding: 10px 15px; border-radius: 3px; margin-bottom: 20px;">
        <h2 style="margin: 0;">🔄 Alert Escalation: ${alert.ruleName}</h2>
      </div>
      
      <div style="margin-bottom: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px;">
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">
          This alert has been triggered <span style="color: #dc3545; font-size: 18px;">${threshold} times</span>
        </p>
        <p>This may indicate an ongoing security issue that requires immediate attention.</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>Alert Description:</strong> ${alert.description}</p>
        <p><strong>Device IP:</strong> ${alert.deviceIp}</p>
        <p><strong>First Occurrence:</strong> ${firstTimestamp}</p>
        <p><strong>Latest Occurrence:</strong> ${lastTimestamp}</p>
        <p><strong>Duration:</strong> Ongoing for ${duration} minutes</p>
        <p><strong>Severity:</strong> ${alert.severity}</p>
        <p><strong>Status:</strong> ${alert.status}</p>
        <p><strong>Total Occurrences:</strong> ${alert.matchCount}</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 3px;">
        <h3 style="margin-top: 0;">Recent Matched Events</h3>
        <p>Showing ${Math.min(3, alert.matchedLogs?.length || 0)} of ${alert.matchedLogs?.length || 0} events:</p>
        <pre style="background-color: #f1f1f1; padding: 10px; border-radius: 3px; overflow: auto; max-height: 300px;">
${JSON.stringify(alert.matchedLogs?.slice(0, 3) || [], null, 2)}
        </pre>
      </div>
      
      <div style="margin-top: 20px; text-align: center;">
        <a href="http://localhost:3000/offenses" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Alert Details
        </a>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="color: #6c757d; font-size: 12px;">
          This is an automated message from the CYBIOT SecureIOT platform. Do not reply to this message.
        </p>
      </div>
    </div>
  `;

  // Plain text fallback
  const text = `
ALERT ESCALATION: ${alert.ruleName}

THIS ALERT HAS BEEN TRIGGERED ${threshold} TIMES
This may indicate an ongoing security issue that requires immediate attention.

Alert Description: ${alert.description}
Device IP: ${alert.deviceIp}
First Occurrence: ${firstTimestamp}
Latest Occurrence: ${lastTimestamp}
Duration: Ongoing for ${duration} minutes
Severity: ${alert.severity}
Status: ${alert.status}
Total Occurrences: ${alert.matchCount}

View alert details at: http://localhost:3000/offenses

This is an automated message from the CYBIOT SecureIOT platform.
  `;

  return sendEmail({
    subject,
    html,
    text,
  });
};

/**
 * Send a firmware analysis report via email
 * @param {Object} firmware - The firmware data with analysis results
 * @param {string} email - Recipient email address
 * @param {string} reportFormat - Format of the report (pdf, csv, or html)
 * @returns {Promise} - Nodemailer response
 */
const sendFirmwareAnalysisReport = async (firmware, email, reportFormat = 'pdf') => {
  try {
    // Initialize transporter if not already done
    initTransporter();
    
    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP credentials not set in .env file. Email notifications disabled.');
      return { success: false, error: 'SMTP credentials not configured' };
    }

    const subject = `Firmware Analysis Report: ${firmware.name} (v${firmware.version})`;
    
    // Generate attachment based on report format
    const attachment = await generateReportAttachment(firmware, reportFormat);
    
    // Format the date
    const analysisDate = firmware.analysisDate ? new Date(firmware.analysisDate).toLocaleDateString() : 'N/A';
    
    // Create HTML content
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="background-color: #f0f4f8; padding: 15px; border-radius: 3px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #2c3e50;">Firmware Security Analysis Report</h2>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p><strong>Firmware Name:</strong> ${firmware.name}</p>
          <p><strong>Version:</strong> ${firmware.version}</p>
          <p><strong>Device Type:</strong> ${firmware.deviceType}</p>
          <p><strong>Analysis Date:</strong> ${analysisDate}</p>
          <p><strong>Security Score:</strong> <span style="color: ${getScoreColor(firmware.securityScore)}; font-weight: bold;">${firmware.securityScore}/10</span></p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p>
            The detailed analysis report is attached to this email in ${reportFormat.toUpperCase()} format. 
            The report includes comprehensive security findings for this firmware.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 3px;">
          <h3 style="margin-top: 0;">Summary of Findings</h3>
          <p>The security scan identified the following:</p>
          <ul>
            ${generateFindingsSummary(firmware.analysis)}
          </ul>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #6c757d; font-size: 12px;">
            This is an automated message from the CYBIOT SecureIOT platform. Do not reply to this message.
          </p>
        </div>
      </div>
    `;

    // Plain text fallback
    const text = `
FIRMWARE SECURITY ANALYSIS REPORT

Firmware Name: ${firmware.name}
Version: ${firmware.version}
Device Type: ${firmware.deviceType}
Analysis Date: ${analysisDate}
Security Score: ${firmware.securityScore}/10

The detailed analysis report is attached to this email in ${reportFormat.toUpperCase()} format.
The report includes comprehensive security findings for this firmware.

SUMMARY OF FINDINGS:
${generateTextFindingsSummary(firmware.analysis)}

This is an automated message from the CYBIOT SecureIOT platform.
    `;

    const emailOptions = {
      ...defaultOptions,
      to: email,
      subject,
      html,
      text,
      attachments: [attachment]
    };

    const info = await transporter.sendMail(emailOptions);
    console.log(`✅ Firmware analysis report sent to ${email}, message ID: ${info.messageId}`);

    // Delete temp file if it was created
    if (attachment.path && attachment.path.includes('temp')) {
      const fs = require('fs');
      fs.unlinkSync(attachment.path);
    }

    return { success: true, info };
  } catch (error) {
    console.error(`❌ Failed to send firmware analysis report: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Get color based on score
 * @param {number} score - Security score
 * @returns {string} - Color code
 */
const getScoreColor = (score) => {
  if (score >= 7.5) return '#4caf50'; // green
  if (score >= 5) return '#ff9800';   // orange
  return '#f44336';                   // red
};

/**
 * Generate bullet points for findings summary in HTML
 * @param {Object} analysis - Analysis data
 * @returns {string} - HTML bullet points
 */
const generateFindingsSummary = (analysis) => {
  if (!analysis || !analysis.static) {
    return '<li>No detailed analysis data available</li>';
  }
  
  let issues = 0;
  let highSeverityCount = 0;
  let mediumSeverityCount = 0;
  let lowSeverityCount = 0;
  
  // Count issues by severity
  Object.values(analysis.static).forEach(category => {
    if (Array.isArray(category)) {
      category.forEach(item => {
        issues++;
        if (item.severity === 'HIGH') {
          highSeverityCount++;
        } else if (item.severity === 'MEDIUM') {
          mediumSeverityCount++;
        } else {
          lowSeverityCount++;
        }
      });
    }
  });
  
  // Generate summary
  let html = '';
  
  if (issues === 0) {
    return '<li>No security issues were found in this firmware</li>';
  }
  
  // Highlight critical issues with a warning box if any exist
  if (highSeverityCount > 0) {
    html += `
      <li style="margin-bottom: 10px; padding: 8px; background-color: #ffebee; border-left: 4px solid #f44336; border-radius: 3px;">
        <strong style="color: #d32f2f;">⚠️ CRITICAL:</strong> 
        <span style="color: #f44336; font-weight: bold;">${highSeverityCount}</span> 
        critical ${highSeverityCount === 1 ? 'vulnerability' : 'vulnerabilities'} requiring immediate attention!
      </li>
    `;
  }
  
  html += `<li><strong>Total Issues Found:</strong> ${issues}</li>`;
  
  if (mediumSeverityCount > 0) {
    html += `<li><strong>Medium Severity Issues:</strong> <span style="color: #ff9800;">${mediumSeverityCount}</span></li>`;
  }
  
  if (lowSeverityCount > 0) {
    html += `<li><strong>Low Severity Issues:</strong> <span style="color: #4caf50;">${lowSeverityCount}</span></li>`;
  }
  
  // Add specific categories
  Object.entries(analysis.static).forEach(([category, items]) => {
    if (Array.isArray(items) && items.length > 0) {
      const categoryName = category.replace(/_/g, ' ');
      const highSeverityCount = items.filter(item => item.severity === 'HIGH').length;
      
      if (highSeverityCount > 0) {
        html += `<li>
          <strong>${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}:</strong> 
          ${items.length} issues found 
          <span style="color: #f44336; font-weight: bold;">(${highSeverityCount} critical)</span>
        </li>`;
      } else {
        html += `<li><strong>${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}:</strong> ${items.length} issues found</li>`;
      }
    }
  });
  
  return html;
};

/**
 * Generate plain text findings summary
 * @param {Object} analysis - Analysis data
 * @returns {string} - Plain text summary
 */
const generateTextFindingsSummary = (analysis) => {
  if (!analysis || !analysis.static) {
    return '- No detailed analysis data available';
  }
  
  let issues = 0;
  let highSeverityCount = 0;
  let mediumSeverityCount = 0;
  let lowSeverityCount = 0;
  
  // Count issues by severity
  Object.values(analysis.static).forEach(category => {
    if (Array.isArray(category)) {
      category.forEach(item => {
        issues++;
        if (item.severity === 'HIGH') {
          highSeverityCount++;
        } else if (item.severity === 'MEDIUM') {
          mediumSeverityCount++;
        } else {
          lowSeverityCount++;
        }
      });
    }
  });
  
  // Generate summary
  let text = '';
  
  if (issues === 0) {
    return '- No security issues were found in this firmware';
  }
  
  if (highSeverityCount > 0) {
    text += `- ⚠️ CRITICAL ALERT: ${highSeverityCount} critical ${highSeverityCount === 1 ? 'vulnerability' : 'vulnerabilities'} detected!\n`;
  }
  
  text += `- Total Issues Found: ${issues}\n`;
  
  if (highSeverityCount > 0) {
    text += `- High Severity Issues: ${highSeverityCount}\n`;
  }
  
  if (mediumSeverityCount > 0) {
    text += `- Medium Severity Issues: ${mediumSeverityCount}\n`;
  }
  
  if (lowSeverityCount > 0) {
    text += `- Low Severity Issues: ${lowSeverityCount}\n`;
  }
  
  // Add specific categories
  Object.entries(analysis.static).forEach(([category, items]) => {
    if (Array.isArray(items) && items.length > 0) {
      const categoryName = category.replace(/_/g, ' ');
      const highSeverityCount = items.filter(item => item.severity === 'HIGH').length;
      
      if (highSeverityCount > 0) {
        text += `- ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}: ${items.length} issues (${highSeverityCount} critical)\n`;
      } else {
        text += `- ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}: ${items.length} issues\n`;
      }
    }
  });
  
  return text;
};

/**
 * Generate report attachment in the specified format
 * @param {Object} firmware - Firmware data
 * @param {string} format - Report format (pdf, csv, html)
 * @returns {Object} - Attachment object for nodemailer
 */
const generateReportAttachment = async (firmware, format) => {
  const path = require('path');
  const fs = require('fs');
  const tempDir = path.join(__dirname, '../temp');
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filename = `firmware-analysis-${firmware.name}-${firmware.version}-${Date.now()}`;
  
  switch (format.toLowerCase()) {
    case 'pdf':
      return await generatePDFReport(firmware, tempDir, filename);
    case 'csv':
      return generateCSVReport(firmware, tempDir, filename);
    case 'html':
      return generateHTMLReport(firmware, tempDir, filename);
    default:
      return generateCSVReport(firmware, tempDir, filename); // Default to CSV
  }
};

/**
 * Generate PDF format report
 * @param {Object} firmware - Firmware data
 * @param {string} dir - Directory path
 * @param {string} filename - File name without extension
 * @returns {Object} - Attachment object
 */
const generatePDFReport = async (firmware, dir, filename) => {
  try {
    const puppeteer = require('puppeteer');
    const filePath = `${dir}/${filename}.pdf`;
    const htmlContent = generateDetailedHTMLReport(firmware);
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    await page.pdf({ path: filePath, format: 'A4' });
    await browser.close();
    
    return {
      filename: `${firmware.name}-security-analysis.pdf`,
      path: filePath,
      contentType: 'application/pdf'
    };
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    
    // Fallback to HTML if PDF generation fails
    return generateHTMLReport(firmware, dir, filename);
  }
};

/**
 * Generate CSV format report
 * @param {Object} firmware - Firmware data
 * @param {string} dir - Directory path
 * @param {string} filename - File name without extension
 * @returns {Object} - Attachment object
 */
const generateCSVReport = (firmware, dir, filename) => {
  const json2csv = require('json2csv').Parser;
  const fs = require('fs');
  const filePath = `${dir}/${filename}.csv`;
  
  // Flatten analysis results for CSV, with critical issues first
  const criticalIssueRecords = [];
  const normalIssueRecords = [];
  
  if (firmware.analysis && firmware.analysis.static) {
    Object.entries(firmware.analysis.static).forEach(([category, issues]) => {
      if (Array.isArray(issues)) {
        issues.forEach(issue => {
          const record = {
            category: category.replace(/_/g, ' '),
            match: issue.match,
            file: issue.file,
            line: issue.line,
            severity: issue.severity
          };
          
          // Separate critical from normal issues
          if (issue.severity === 'HIGH') {
            criticalIssueRecords.push(record);
          } else {
            normalIssueRecords.push(record);
          }
        });
      }
    });
  }
  
  // Add a critical vulnerabilities metadata row if any exist
  const metadataRecords = [];
  if (criticalIssueRecords.length > 0) {
    metadataRecords.push({
      category: 'CRITICAL_ALERT',
      match: `⚠️ WARNING: ${criticalIssueRecords.length} Critical ${criticalIssueRecords.length === 1 ? 'Vulnerability' : 'Vulnerabilities'} Found`,
      file: 'These issues require immediate attention',
      line: '',
      severity: 'HIGH'
    });
  }
  
  // Add firmware metadata as first row
  const metadataRecord = {
    category: 'METADATA',
    match: `Firmware: ${firmware.name}`,
    file: `Version: ${firmware.version}`,
    line: `Device Type: ${firmware.deviceType}`,
    severity: `Score: ${firmware.securityScore}/10`
  };
    const records = [metadataRecord, ...metadataRecords, ...criticalIssueRecords, ...normalIssueRecords];
  
  try {
    const parser = new json2csv({
      fields: ['category', 'match', 'file', 'line', 'severity']
    });
    
    const csv = parser.parse(records);
    fs.writeFileSync(filePath, csv);
    
    return {
      filename: `${firmware.name}-security-analysis.csv`,
      path: filePath,
      contentType: 'text/csv'
    };
  } catch (error) {
    console.error('Failed to generate CSV:', error);
    
    // Create a simple text file as fallback
    const content = `Firmware Analysis Results for ${firmware.name} (${firmware.version})
Security Score: ${firmware.securityScore}/10
Date: ${new Date().toISOString()}

Issues:
${records.map(r => `- ${r.category}: ${r.match} (${r.file}:${r.line}) [${r.severity}]`).join('\n')}
`;
    
    fs.writeFileSync(filePath, content);
    
    return {
      filename: `${firmware.name}-security-analysis.txt`,
      path: filePath,
      contentType: 'text/plain'
    };
  }
};

/**
 * Generate HTML format report
 * @param {Object} firmware - Firmware data
 * @param {string} dir - Directory path
 * @param {string} filename - File name without extension
 * @returns {Object} - Attachment object
 */
const generateHTMLReport = (firmware, dir, filename) => {
  const fs = require('fs');
  const filePath = `${dir}/${filename}.html`;
  
  const htmlContent = generateDetailedHTMLReport(firmware);
  fs.writeFileSync(filePath, htmlContent);
  
  return {
    filename: `${firmware.name}-security-analysis.html`,
    path: filePath,
    contentType: 'text/html'
  };
};

/**
 * Generate detailed HTML report
 * @param {Object} firmware - Firmware data
 * @returns {string} - HTML content
 */
const generateDetailedHTMLReport = (firmware) => {
  // Convert analysis data to HTML
  let issuesHtml = '';
  let totalIssues = 0;
  let criticalIssues = 0;
  let criticalIssuesHtml = '';
  
  // First collect all critical (HIGH severity) vulnerabilities across categories
  if (firmware.analysis && firmware.analysis.static) {
    Object.entries(firmware.analysis.static).forEach(([category, issues]) => {
      if (Array.isArray(issues)) {
        const highSeverityIssues = issues.filter(issue => issue.severity === 'HIGH');
        criticalIssues += highSeverityIssues.length;
        
        if (highSeverityIssues.length > 0) {
          const formattedCategory = category.replace(/_/g, ' ');
          
          highSeverityIssues.forEach(issue => {
            totalIssues++;
            criticalIssuesHtml += `
              <div style="margin: 10px 0; padding: 10px; border-left: 4px solid #f44336; background-color: #fff0f0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="font-weight: bold; color: #f44336;">${issue.match}</span>
                  <span style="color: #f44336; font-weight: bold; background-color: #ffebee; padding: 2px 6px; border-radius: 4px;">CRITICAL</span>
                </div>
                <div style="font-size: 0.9em; color: #666;">
                  Category: ${formattedCategory.charAt(0).toUpperCase() + formattedCategory.slice(1)}
                </div>
                <div style="font-size: 0.9em; color: #666;">
                  File: ${issue.file}, Line: ${issue.line}
                </div>
                <div style="margin-top: 8px; padding: 8px; background-color: #ffebee; color: #b71c1c; font-size: 0.9em; border-radius: 4px;">
                  <strong>Recommendation:</strong> This vulnerability requires immediate attention and remediation.
                </div>
              </div>
            `;
          });
        }
      }
    });
  }
  
  // Then generate the regular issue sections by category
  if (firmware.analysis && firmware.analysis.static) {
    Object.entries(firmware.analysis.static).forEach(([category, issues]) => {
      if (Array.isArray(issues) && issues.length > 0) {
        const formattedCategory = category.replace(/_/g, ' ');
        issuesHtml += `
          <h3 style="margin-top: 20px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
            ${formattedCategory.charAt(0).toUpperCase() + formattedCategory.slice(1)} (${issues.length})
          </h3>
          <div class="issues-container">
        `;
        
        // Non-critical issues are displayed normally
        issues.filter(issue => issue.severity !== 'HIGH').forEach(issue => {
          totalIssues++;
          const severityColor = 
            issue.severity === 'MEDIUM' ? '#ff9800' : '#4caf50';
            
          issuesHtml += `
            <div style="margin: 10px 0; padding: 10px; border-left: 4px solid ${severityColor}; background-color: #f9f9f9;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-weight: bold;">${issue.match}</span>
                <span style="color: ${severityColor}; font-weight: bold;">${issue.severity}</span>
              </div>
              <div style="font-size: 0.9em; color: #666;">
                File: ${issue.file}, Line: ${issue.line}
              </div>
            </div>
          `;
        });
        
        issuesHtml += '</div>';
      }
    });
  }
    // Set score color
  let scoreColor = '#4caf50'; // green (good)
  if (firmware.securityScore < 5) {
    scoreColor = '#f44336'; // red (poor)
  } else if (firmware.securityScore < 7.5) {
    scoreColor = '#ff9800';  // orange (average)
  }
  
  // Format date
  const analysisDate = firmware.analysisDate ? new Date(firmware.analysisDate).toLocaleString() : 'N/A';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Firmware Analysis Report: ${firmware.name}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #eee;
        }
        .header h1 {
          color: #2c3e50;
          margin-bottom: 10px;
        }
        .summary-box {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 30px;
        }
        .summary-item {
          flex: 1;
          min-width: 200px;
          padding: 15px;
          border-radius: 5px;
          background-color: #f8f9fa;
          border: 1px solid #eee;
        }
        .score-display {
          font-size: 24px;
          font-weight: bold;
          color: ${scoreColor};
        }
        .issues-container {
          margin-left: 10px;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 0.8em;
          color: #666;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        table, th, td {
          border: 1px solid #ddd;
        }
        th, td {
          padding: 12px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
        }
        @media print {
          body {
            font-size: 12pt;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Firmware Security Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="summary-box">
        <div class="summary-item">
          <h2>Firmware Details</h2>
          <p><strong>Name:</strong> ${firmware.name}</p>
          <p><strong>Version:</strong> ${firmware.version}</p>
          <p><strong>Device Type:</strong> ${firmware.deviceType}</p>
          <p><strong>Analysis Date:</strong> ${analysisDate}</p>
        </div>
        <div class="summary-item">
          <h2>Security Score</h2>
          <p class="score-display">${firmware.securityScore}/10</p>
          <p><strong>Total Issues Found:</strong> ${totalIssues}</p>
          <p><strong>Status:</strong> ${
            firmware.securityScore >= 7.5 ? 'Good' :
            firmware.securityScore >= 5 ? 'Average' : 'Poor'
          }</p>
        </div>
      </div>
        ${criticalIssues > 0 ? `
        <div style="margin: 30px 0; padding: 16px; background-color: #fff5f5; border: 1px solid #f44336; border-radius: 5px;">
          <h2 style="color: #f44336; margin-top: 0;">
            ⚠️ Critical Vulnerabilities (${criticalIssues})
          </h2>
          <p>The following high-severity security issues require <strong>immediate attention</strong>:</p>
          ${criticalIssuesHtml}
        </div>
      ` : ''}

      <h2>Detailed Findings</h2>
      
      ${issuesHtml || '<p>No security issues were found in this firmware.</p>'}
      
      <div class="footer">
        <p>Report generated by CYBIOT SecureIOT Platform</p>
        <p>&copy; ${new Date().getFullYear()} CYBIOT</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  sendAlertNotification,
  sendFollowupNotification,
  sendFirmwareAnalysisReport
};