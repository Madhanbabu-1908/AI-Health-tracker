// Backend API URL - Update with your Render backend URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://ai-health-tracker-yycb.onrender.com'

console.log('API URL:', API_BASE_URL)

export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`)
  }
  
  return response.json()
}

export default {
  API_BASE_URL,
  apiCall
}
