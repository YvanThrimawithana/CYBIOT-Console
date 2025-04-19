import api from './api';

export const generateCSVReport = async (email) => {
  return api.post('/offenses/generate-csv-report', { email });
};