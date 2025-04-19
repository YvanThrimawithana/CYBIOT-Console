import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { generateCSVReport } from '../services/offenseService';

const EmailReportModal = ({ show, handleClose }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await generateCSVReport(email);
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        handleClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Generate Offense Report</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">Report sent successfully! Check your email.</Alert>}
        
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter email to receive the report"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              We'll send a CSV report of all offenses to this email address.
            </Form.Text>
          </Form.Group>
          
          <div className="d-flex justify-content-end">
            <Button variant="secondary" onClick={handleClose} className="me-2">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={isLoading || !email}
            >
              {isLoading ? 'Sending...' : 'Send Report'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default EmailReportModal;