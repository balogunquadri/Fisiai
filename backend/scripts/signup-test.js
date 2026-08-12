require('dotenv').config({ path: '.env' });
const axios = require('axios');

const API = process.env.API_INTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`;
const email = process.argv[2] || 'leo@ximora.live';

(async () => {
  try {
    console.log('Posting signup for:', email);
    const res = await axios.post(`${API.replace(/\/$/, '')}/api/signup`, {
      name: 'Test Leo',
      email,
      password: 'TestPass123!'
    }, { timeout: 20000 });

    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Error response:', err.response.status, err.response.data);
    } else {
      console.error('Request failed:', err.message);
    }
    process.exit(1);
  }
})();
