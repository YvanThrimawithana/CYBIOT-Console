import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { fetchOffenses, deleteOffense } from '../../services/offenseService';
import EmailReportModal from '../../components/EmailReportModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

const OffenseList = () => {
  const [offenses, setOffenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [offenseToDelete, setOffenseToDelete] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchOffenses();
        setOffenses(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = (offense) => {
    setOffenseToDelete(offense);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteOffense(offenseToDelete.id);
      setOffenses(offenses.filter((o) => o.id !== offenseToDelete.id));
      setShowDeleteModal(false);
      setOffenseToDelete(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Container>
      <Row className="my-4">
        <Col>
          <h2>Offense List</h2>
        </Col>
        <Col className="text-end">
          <Button onClick={() => setShowReportModal(true)} variant="success" className="me-2">
            <i className="bi bi-file-earmark-excel me-1"></i>
            CSV Report
          </Button>
          <Link to="/offenses/add" className="btn btn-primary">
            Add Offense
          </Link>
        </Col>
      </Row>
      
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offenses.map((offense) => (
              <tr key={offense.id}>
                <td>{offense.id}</td>
                <td>{offense.title}</td>
                <td>{offense.description}</td>
                <td>
                  <Button variant="danger" onClick={() => handleDelete(offense)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      
      <EmailReportModal 
        show={showReportModal}
        handleClose={() => setShowReportModal(false)}
      />

      {offenseToDelete && (
        <DeleteConfirmationModal
          show={showDeleteModal}
          handleClose={() => setShowDeleteModal(false)}
          handleConfirm={handleConfirmDelete}
          itemName={offenseToDelete.title || 'this offense'}
        />
      )}
    </Container>
  );
};

export default OffenseList;