import api from './api';

const unwrap = (res) => res.data.data;

export const getEntries = (params = {}) =>
    api.get('/journal', { params }).then((res) => ({
        entries: res.data.data,
        total: res.data.total
    }));
export const getStats = (params = {}) => api.get('/journal/stats', { params }).then(unwrap);
export const getOptions = () => api.get('/journal/options').then(unwrap);
export const createEntry = (data) => api.post('/journal', data).then(unwrap);
export const updateEntry = (id, data) => api.put(`/journal/${id}`, data).then(unwrap);
export const deleteEntry = (id) => api.delete(`/journal/${id}`);
export const getSettings = () => api.get('/journal/settings').then(unwrap);
export const saveSettings = (data) => api.put('/journal/settings', data).then(unwrap);
export const getRiskProfiles = () => api.get('/journal/risk-profiles').then(unwrap);
export const saveRiskProfile = (portfolioId, data) =>
    api.put(`/journal/risk-profiles/${portfolioId}`, data).then(unwrap);
