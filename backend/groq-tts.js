#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const axios = require('axios');
const { spawn } = require('child_process');
const os = require('os');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Available voices for English (playai-tts)
const ENGLISH_VOICES = [
  "Fritz-PlayAI", "Aria-PlayAI", "Bolt-PlayAI", "Clyde-PlayAI", 
  "Domi-PlayAI", "Echo-PlayAI", "Fable-PlayAI", "Grace-PlayAI",
  "Harmony-PlayAI", "Iris-PlayAI", "Jade-PlayAI", "Knox-PlayAI",
  "Luna-PlayAI", "Mira-PlayAI", "Nova-PlayAI", "Onyx-PlayAI",
  "Phoenix-PlayAI", "Quinn-PlayAI", "River-PlayAI"
];

// Available voices for Arabic (playai-tts-arabic)
const ARABIC_VOICES = [
  "Amina-PlayAI", "Farid-PlayAI", "Layla-PlayAI", "Omar-PlayAI"
];

// Get the appropriate audio player for the current platform
function getSystemAudioPlayer() {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin': // macOS
      return { command: 'afplay', args: ['-'] };
    case 'linux':
      // Try aplay first, fallback to play (sox)
      return { command: 'aplay', args: ['-t', 'wav', '-'] };
    case 'win32': // Windows
      return { command: 'powershell', args: ['-Command', 'Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open([System.IO.MemoryStream]::new([System.Console]::OpenStandardInput().ReadToEnd())); $player.Play(); Start-Sleep 10'] };
    default:
      return { command: 'aplay', args: ['-t', 'wav', '-'] };
  }
}

// Play audio buffer directly to system audio player
async function playAudioBuffer(audioBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const playerConfig = getSystemAudioPlayer();
      console.log(`🔊 Playing audio via ${playerConfig.command}...`);
      
      const player = spawn(playerConfig.command, playerConfig.args, {
        stdio: ['pipe', 'inherit', 'pipe']
      });

      // Handle player events
      player.on('close', (code) => {
        console.log('🎵 Audio playback finished');
        resolve();
      });

      player.on('error', (error) => {
        console.error('❌ Audio player error:', error.message);
        reject(error);
      });

      // Stream audio data to player
      player.stdin.write(audioBuffer);
      player.stdin.end();

    } catch (error) {
      console.error('❌ Audio streaming error:', error.message);
      reject(error);
    }
  });
}

async function generateSpeech(text, options = {}) {
  const {
    voice = "Fritz-PlayAI",
    model = "playai-tts",
    responseFormat = "wav",
    outputFile = null,
    saveFile = false
  } = options;

  try {
    console.log(`🎤 Generating speech with voice: ${voice}`);
    console.log(`📝 Text: "${text}"`);
    
    const requestData = {
      model: model,
      voice: voice,
      input: text,
      response_format: responseFormat
    };
    
    
    const response = await axios.post('https://api.groq.com/openai/v1/audio/speech', requestData, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const buffer = Buffer.from(response.data);
    
    console.log(`✅ Audio generated successfully!`);
    
    // Play the audio automatically
    await playAudioBuffer(buffer);
    
    // Optionally save file if requested
    if (saveFile || outputFile) {
      const timestamp = Date.now();
      const filename = outputFile || `speech_${timestamp}.${responseFormat}`;
      const filepath = path.join(__dirname, 'temp', filename);
      
      // Ensure temp directory exists
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      await fs.promises.writeFile(filepath, buffer);
      console.log(`📁 Also saved to: ${filepath}`);
      return filepath;
    }
    
    return 'Audio played successfully';
  } catch (error) {
    console.error('❌ Error generating speech:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Data:', error.response.data);
      if (error.response.data) {
        try {
          const errorText = Buffer.from(error.response.data).toString();
          console.error('Error Details:', errorText);
        } catch (e) {
          console.error('Could not parse error response');
        }
      }
    }
    throw error;
  }
}

function showHelp() {
  console.log(`
🎵 Groq Text-to-Speech Generator

Usage:
  node groq-tts.js "Your text here" [options]

Options:
  --voice <voice>     Voice to use (default: Fritz-PlayAI)
  --model <model>     Model to use: playai-tts or playai-tts-arabic (default: playai-tts)
  --output <file>     Save to specific filename (also plays audio)
  --save              Save audio file to temp directory (also plays audio)
  --list-voices       Show available voices
  --help              Show this help message

Examples:
  node groq-tts.js "Hello, world!"
  node groq-tts.js "Hello, world!" --voice Aria-PlayAI
  node groq-tts.js "مرحبا بالعالم" --model playai-tts-arabic --voice Amina-PlayAI
  node groq-tts.js "Custom output" --save
  node groq-tts.js "Custom output" --output my-speech.wav

Available English Voices:
  ${ENGLISH_VOICES.join(', ')}

Available Arabic Voices:
  ${ARABIC_VOICES.join(', ')}
`);
}

function listVoices() {
  console.log(`
🎤 Available Voices:

English (playai-tts):
${ENGLISH_VOICES.map(v => `  • ${v}`).join('\n')}

Arabic (playai-tts-arabic):
${ARABIC_VOICES.map(v => `  • ${v}`).join('\n')}
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    return;
  }
  
  if (args.includes('--list-voices')) {
    listVoices();
    return;
  }
  
  const text = args[0];
  if (!text) {
    console.error('❌ Please provide text to convert to speech');
    showHelp();
    process.exit(1);
  }
  
  // Parse options
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--voice':
        options.voice = value;
        break;
      case '--model':
        options.model = value;
        break;
      case '--output':
        options.outputFile = value;
        break;
      case '--save':
        options.saveFile = true;
        i--; // No value needed for this flag
        break;
    }
  }
  
  // Validate voice and model combination
  if (options.model === 'playai-tts-arabic' && options.voice && !ARABIC_VOICES.includes(options.voice)) {
    console.error(`❌ Voice "${options.voice}" is not available for Arabic model. Available Arabic voices: ${ARABIC_VOICES.join(', ')}`);
    process.exit(1);
  }
  
  if (options.model === 'playai-tts' && options.voice && !ENGLISH_VOICES.includes(options.voice)) {
    console.error(`❌ Voice "${options.voice}" is not available for English model. Available English voices: ${ENGLISH_VOICES.join(', ')}`);
    process.exit(1);
  }
  
  try {
    await generateSpeech(text, options);
  } catch (error) {
    console.error('❌ Failed to generate speech:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { generateSpeech };