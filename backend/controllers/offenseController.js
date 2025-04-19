const Offense = require('../models/Offense');
const nodemailer = require('nodemailer');
const json2csv = require('json2csv').Parser;
const fs = require('fs');
const path = require('path');

// ...existing code...

// Generate CSV report and send via email
exports.generateCSVReport = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Get all offenses
    const offenses = await Offense.find()
      .populate('employee', 'name department')
      .populate('reporter', 'name department')
      .lean();
    
    // Convert to CSV
    const fields = ['_id', 'title', 'description', 'date', 'status', 'severity', 'employee.name', 'employee.department', 'reporter.name', 'reporter.department', 'acknowledgementDate', 'resolutionDate'];
    const json2csvParser = new json2csv({ fields });
    const csv = json2csvParser.parse(offenses);
    
    // Create a temporary file
    const tempFilePath = path.join(__dirname, '../temp', `offenses-report-${Date.now()}.csv`);
    const tempDirPath = path.join(__dirname, '../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDirPath)) {
      fs.mkdirSync(tempDirPath, { recursive: true });
    }
    
    fs.writeFileSync(tempFilePath, csv);
    
    // Send email with attachment using existing SMTP configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Offenses Report',
      text: 'Please find attached the offenses report.',
      attachments: [
        {
          filename: 'offenses-report.csv',
          path: tempFilePath
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    
    // Delete the temporary file
    fs.unlinkSync(tempFilePath);
    
    res.status(200).json({ message: 'Report generated and sent successfully' });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
};