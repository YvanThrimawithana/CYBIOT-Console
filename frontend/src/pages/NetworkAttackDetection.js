import React from 'react';
import { Container, Typography, Breadcrumbs, Link, Box } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NetworkAttackDetectionComponent from '../components/NetworkAttackDetection';

const NetworkAttackDetectionPage = () => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>Security Analysis</Typography>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
          <Link color="inherit" href="/dashboard">Dashboard</Link>
          <Typography color="text.primary">Network Attack Detection</Typography>
        </Breadcrumbs>
      </Box>
      
      <NetworkAttackDetectionComponent />
    </Container>
  );
};

export default NetworkAttackDetectionPage;