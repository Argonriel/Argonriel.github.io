async function sendMessage(message) {
  try {
    const response = await axios.post('argonriel.github.io', {
      message,
    });
    const reply = response.data.reply;
    // Handle the reply from Chat GPT
    console.log(reply);
  } catch (error) {
    console.error('Server error:', error.message);
  }
}

// Example usage
sendMessage('Hello, Chat GPT!');
