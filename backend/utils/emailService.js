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

module.exports = {
  sendEmail,
  sendAlertNotification,
  sendFollowupNotification
};