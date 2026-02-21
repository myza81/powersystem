import axios from 'axios';

// Helper function to get the CSRF token from Django's cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const api = axios.create({
    baseURL: '/api/v1',
    withCredentials: true // Important for Django to accept the CSRF session cookie
});

// Interceptor to inject CSRF token on mutating requests
api.interceptors.request.use(config => {
    // Only add CSRF token for requests that are not GET, HEAD, OPTIONS, TRACE
    if (config.method !== 'get' && config.method !== 'head' && config.method !== 'options' && config.method !== 'trace') {
        const csrfToken = getCookie('csrftoken');
        if (csrfToken) {
            config.headers['X-CSRFToken'] = csrfToken;
        }
    }
    return config;
}, error => {
    return Promise.reject(error);
});

export default api;
