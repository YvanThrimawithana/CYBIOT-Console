import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Button, Badge, Card } from 'react-bootstrap';
import { getAlerts, updateAlertStatus } from '../services/alertService';
import { FaFileDownload, FaCheckCircle, FaExclamationTriangle, FaBell } from 'react-icons/fa';
import ReportEmailModal from '../components/ReportEmailModal';

const Offenses = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, new: 0, acknowledged: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showReportModal, setShowReportModal] = useState(false);

  // Load alerts on component mount
  useEffect(() => {
    fetchAlerts();
  }, []);

  // Fetch alerts from the API
  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const result = await getAlerts();
      if (result.success) {
        setAlerts(result.alerts || []);
        
        // Update stats
        if (result.summary) {
          setStats({
            total: result.summary.total || 0,
            new: result.summary.byStatus.NEW || 0,
            acknowledged: result.summary.byStatus.ACKNOWLEDGED || 0,
            resolved: result.summary.byStatus.RESOLVED || 0
          });
        }
      } else {
        setError(result.error || 'Failed to load alerts');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle acknowledging an alert
  const handleAcknowledge = async (alertId) => {
    try {
      const result = await updateAlertStatus(alertId, 'ACKNOWLEDGED');
      if (result.success) {
        // Update the local state
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, status: 'ACKNOWLEDGED' } 
            : alert
        ));
        // Update stats
        setStats({
          ...stats,
          new: Math.max(0, stats.new - 1),
          acknowledged: stats.acknowledged + 1
        });
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  // Handle resolving an alert
  const handleResolve = async (alertId) => {
    try {
      const result = await updateAlertStatus(alertId, 'RESOLVED');
      if (result.success) {
        // Update the local state
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, status: 'RESOLVED' } 
            : alert
        ));
        // Update stats
        setStats(prev => {
          const alertToUpdate = alerts.find(a => a.id === alertId);
          return {
            ...prev,
            acknowledged: alertToUpdate.status === 'ACKNOWLEDGED' 
              ? Math.max(0, prev.acknowledged - 1) 
              : prev.acknowledged,
            new: alertToUpdate.status === 'NEW' 
              ? Math.max(0, prev.new - 1) 
              : prev.new,
            resolved: prev.resolved + 1
          };
        });
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  // Format the timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Get the severity color class
  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      default: return 'secondary';
    }
  };

  // Get filtered alerts based on status filter
  const getFilteredAlerts = () => {
    if (statusFilter === 'ALL') return alerts;
    return alerts.filter(alert => alert.status === statusFilter);
  };

  // Get status color class
  const getStatusClass = (status) => {
    switch (status) {
      case 'NEW': return 'danger';
      case 'ACKNOWLEDGED': return 'warning';
      case 'RESOLVED': return 'success';
      default: return 'secondary';
    }
  };

  return (
    <Container fluid>
      <Row className="mb-4 mt-4">
        <Col>
          <h1>Security Offenses</h1>
          <p>Monitor and manage security incidents</p>
        </Col>
        <Col xs="auto" className="d-flex align-items-center">
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={() => setShowReportModal(true)}
          >
            <FaFileDownload className="me-2" />
            CSV Report
          </Button>
          <Button variant="primary" onClick={fetchAlerts}>Refresh</Button>
        </Col>
      </Row>

      {/* Stats cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Total Offenses</Card.Title>
              <Card.Text className="h2">{stats.total}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="mb-3 text-white bg-danger">
            <Card.Body>
              <Card.Title>New</Card.Title>
              <Card.Text className="h2">{stats.new}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="mb-3 text-white bg-warning">
            <Card.Body>
              <Card.Title>Acknowledged</Card.Title>
              <Card.Text className="h2">{stats.acknowledged}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="mb-3 text-white bg-success">
            <Card.Body>
              <Card.Title>Resolved</Card.Title>
              <Card.Text className="h2">{stats.resolved}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter buttons */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex">
            <Button 
              variant={statusFilter === 'ALL' ? 'primary' : 'outline-primary'} 
              className="me-2"
              onClick={() => setStatusFilter('ALL')}
            >
              All
            </Button>
            <Button 
              variant={statusFilter === 'NEW' ? 'danger' : 'outline-danger'} 
              className="me-2"
              onClick={() => setStatusFilter('NEW')}
            >
              <FaBell className="me-1" />
              New
            </Button>
            <Button 
              variant={statusFilter === 'ACKNOWLEDGED' ? 'warning' : 'outline-warning'} 
              className="me-2"
              onClick={() => setStatusFilter('ACKNOWLEDGED')}
            >
              <FaExclamationTriangle className="me-1" />
              Acknowledged
            </Button>
            <Button 
              variant={statusFilter === 'RESOLVED' ? 'success' : 'outline-success'} 
              onClick={() => setStatusFilter('RESOLVED')}
            >
              <FaCheckCircle className="me-1" />
              Resolved
            </Button>
          </div>
        </Col>
      </Row>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : getFilteredAlerts().length === 0 ? (
        <div className="text-center my-5">
          <p>No offenses found</p>
        </div>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Rule Name</th>
              <th>Device IP</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredAlerts().map(alert => (
              <tr key={alert.id}>
                <td>{alert.id.substring(0, 8)}</td>
                <td>{alert.ruleName}</td>
                <td>{alert.deviceIp}</td>
                <td>
                  <Badge bg={getSeverityClass(alert.severity)}>
                    {alert.severity}
                  </Badge>
                </td>
                <td>
                  <Badge bg={getStatusClass(alert.status)}>
                    {alert.status}
                  </Badge>
                </td>
                <td>{formatDate(alert.timestamp)}</td>
                <td>{formatDate(alert.lastUpdated)}</td>
                <td>
                  {alert.status === 'NEW' && (
                    <Button 
                      variant="warning" 
                      size="sm" 
                      className="me-2"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {alert.status !== 'RESOLVED' && (
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => handleResolve(alert.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ReportEmailModal 
        show={showReportModal}
        handleClose={() => setShowReportModal(false)}
      />
    </Container>
  );
};

export default Offenses;