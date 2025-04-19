import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { generateOffenseReport } from '../services/alertService';

const ReportEmailModal = ({ show, handleClose }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await generateOffenseReport(email);
      
      if (result.success) {
        setSuccess(true);
        setEmail('');
        // Auto close after success
        setTimeout(() => {
          handleClose();
          setSuccess(false);
        }, 3000);
      } else {
        setError(result.error || 'Failed to generate report');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error generating report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Generate Offense Report</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">Report generated and sent successfully!</Alert>}
        
        <p>
          Generate a comprehensive CSV report of all offenses (including new, acknowledged, and resolved).
          The report will be sent to your email address.
        </p>

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting || success}
            />
            <Form.Text className="text-muted">
              We'll send the CSV report to this email address.
            </Form.Text>
          </Form.Group>
          
          <div className="d-flex justify-content-end mt-4">
            <Button variant="secondary" className="me-2" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={!email || isSubmitting || success}
            >
              {isSubmitting ? 'Sending...' : success ? 'Sent!' : 'Generate & Send Report'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default ReportEmailModal;