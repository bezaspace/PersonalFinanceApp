# Live Speech-to-Text with Groq Whisper

This directory contains scripts for real-time speech-to-text transcription using Groq's Whisper Large V3 Turbo model.

## Setup

### 1. Install Dependencies
The required dependencies are already included in `package.json`:
- `groq-sdk` - Groq API client
- `dotenv` - Environment variable management

### 2. Configure API Key
Add your Groq API key to the `.env` file:
```bash
GROQ_API_KEY=your-groq-api-key-here
```

Get your API key from: https://console.groq.com/keys

### 3. Install Audio Recording Tools

#### Ubuntu/Debian:
```bash
sudo apt-get install alsa-utils
```

#### CentOS/RHEL:
```bash
sudo yum install alsa-utils
```

#### macOS:
```bash
brew install sox
```

#### Windows:
Install SoX from: https://sox.sourceforge.net/

## Available Scripts

### Simple Speech-to-Text (Recommended)
```bash
npm run speech
```
or
```bash
node simple-speech-to-text.js
```

**Features:**
- Record audio in 5 or 10-second chunks
- Automatic transcription after each recording
- Simple command interface (r/l/q)
- Shows confidence scores and audio duration
- Easy to use and reliable

**Commands:**
- `r` - Record 5 seconds and transcribe
- `l` - Record 10 seconds and transcribe  
- `q` - Quit

### Advanced Live Speech-to-Text
```bash
npm run speech-live
```
or
```bash
node live-speech-to-text.js
```

**Features:**
- Manual start/stop recording with ENTER key
- Real-time recording control
- More advanced terminal interface
- Detailed transcription metadata

## Model Information

**Model:** `whisper-large-v3-turbo`
- **Speed:** 216x real-time speed factor
- **Languages:** Multilingual support
- **Cost:** $0.04 per hour of audio
- **Word Error Rate:** ~12%
- **Best for:** Fast, multilingual transcription with good accuracy

## Audio Requirements

- **Sample Rate:** 16kHz (automatically handled)
- **Format:** WAV, mono channel
- **Max File Size:** 25MB (free tier), 100MB (dev tier)
- **Min Duration:** 0.01 seconds
- **Min Billing:** 10 seconds

## Troubleshooting

### "arecord not found" Error
Install ALSA utilities:
```bash
# Ubuntu/Debian
sudo apt-get install alsa-utils

# CentOS/RHEL  
sudo yum install alsa-utils
```

### No Audio Detected
1. Check microphone permissions
2. Test microphone with: `arecord -d 3 test.wav && aplay test.wav`
3. Adjust microphone volume in system settings
4. Try speaking louder or closer to the microphone

### API Errors
1. Verify your GROQ_API_KEY is correct
2. Check your Groq account has sufficient credits
3. Ensure internet connection is stable

### Low Confidence Scores
- Reduce background noise
- Speak clearly and at normal pace
- Ensure good microphone quality
- Try recording in a quieter environment

## Example Usage

```bash
cd backend
npm run speech

# Follow the prompts:
# Enter command (r/l/q): r
# 🎙️ Get ready to speak...
# 🔴 Recording for 5 seconds...
# .....
# ✅ Recording completed
# 🔄 Transcribing with Groq Whisper...
# 📝 Transcription:
#    "Hello, this is a test of the speech to text system."
# ⏱️ Audio duration: 4.2s
# 📊 Confidence: 94.5%
```

## Technical Details

The scripts use:
- **Audio Recording:** `arecord` (Linux ALSA) with 16kHz, 16-bit, mono WAV format
- **API Client:** Official Groq SDK for Node.js
- **Model:** whisper-large-v3-turbo for optimal speed/accuracy balance
- **Response Format:** verbose_json for detailed metadata and confidence scores

## Files

- `simple-speech-to-text.js` - Easy-to-use chunk-based recording
- `live-speech-to-text.js` - Advanced real-time recording control
- `README_SPEECH_TO_TEXT.md` - This documentation