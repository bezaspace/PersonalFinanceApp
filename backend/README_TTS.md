# Groq Text-to-Speech Script

This script allows you to generate speech from text using the Groq API.

## Setup

1. Make sure your `.env` file in the backend directory contains your GROQ_API_KEY
2. The required dependencies are already installed in the backend

## Usage

### Basic Usage
```bash
node groq-tts.js "Your text here"
```

### Advanced Usage
```bash
# Use a different voice
node groq-tts.js "Hello world" --voice Aria-PlayAI

# Use Arabic model and voice
node groq-tts.js "مرحبا بالعالم" --model playai-tts-arabic --voice Amina-PlayAI

# Specify custom output filename
node groq-tts.js "Custom output" --output my-speech.wav

# List all available voices
node groq-tts.js --list-voices

# Show help
node groq-tts.js --help
```

## Available Options

- `--voice <voice>`: Choose from available voices (default: Fritz-PlayAI)
- `--model <model>`: Use `playai-tts` (English) or `playai-tts-arabic` (Arabic)
- `--output <file>`: Specify output filename
- `--list-voices`: Show all available voices
- `--help`: Show help message

## Available Voices

### English (playai-tts)
Fritz-PlayAI, Aria-PlayAI, Bolt-PlayAI, Clyde-PlayAI, Domi-PlayAI, Echo-PlayAI, Fable-PlayAI, Grace-PlayAI, Harmony-PlayAI, Iris-PlayAI, Jade-PlayAI, Knox-PlayAI, Luna-PlayAI, Mira-PlayAI, Nova-PlayAI, Onyx-PlayAI, Phoenix-PlayAI, Quinn-PlayAI, River-PlayAI

### Arabic (playai-tts-arabic)
Amina-PlayAI, Farid-PlayAI, Layla-PlayAI, Omar-PlayAI

## Output

Audio files are saved in the `backend/temp/` directory as WAV files. If no output filename is specified, files are automatically named with a timestamp.

## Examples

```bash
# Simple text-to-speech
node groq-tts.js "Welcome to our financial app!"

# Female voice
node groq-tts.js "Your budget analysis is ready" --voice Aria-PlayAI

# Male voice with custom output
node groq-tts.js "Transaction completed successfully" --voice Knox-PlayAI --output transaction-success.wav

# Arabic example
node groq-tts.js "مرحبا بك في تطبيق الميزانية" --model playai-tts-arabic --voice Amina-PlayAI
```

## Troubleshooting

1. Make sure your GROQ_API_KEY is set in the .env file
2. Ensure you have internet connection for API calls
3. Check that the temp directory exists (it will be created automatically)
4. Verify the voice name matches exactly (case-sensitive)