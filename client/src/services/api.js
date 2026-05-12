import axios from 'axios';

// During development, the React dev server proxies /api calls to
// http://localhost:5000 (see "proxy" in package.json).
const api = axios.create({
  baseURL: '/api'
});

export const fetchExperiments = async () => {
  const res = await api.get('/experiments');
  return res.data;
};

export const saveExperiment = async (name, bodies, constraints) => {
  const res = await api.post('/experiments', { name, bodies, constraints });
  return res.data;
};

export const askLabAssistant = async (question, scene, options = {}) => {
  const res = await api.post(
    '/assistant',
    { question, scene },
    { signal: options.signal }
  );
  return res.data;
};

export default api;
