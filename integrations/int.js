const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';

app.use(express.json());

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [{ role: 'system', content: 'You are a user' }, { role: 'user', content: message }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });

    const { choices } = response.data;
    const reply = choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('Chat GPT API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

