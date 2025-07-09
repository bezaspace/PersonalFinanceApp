// Simple test script for Groq TTS
const { generateSpeech } = require('./groq-tts.js');

async function testTTS() {
  try {
    console.log('Testing Groq TTS...');
    console.log('Converting: "Hello, this is a test of the Groq text-to-speech system!"');
    const audioFile = await generateSpeech("Hello, this is a test of the Groq text-to-speech system!");
    console.log('Test completed successfully!');
    console.log('Audio file created:', audioFile);
    console.log('\nTry running the main script:');
    console.log('   node groq-tts.js "Your text here"');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
    }
  }
}

testTTS();