#!/usr/bin/env node

/**
 * Simple Live Speech-to-Text using Groq Whisper
 * 
 * This script records audio in chunks and transcribes them using Groq's whisper-large-v3-turbo
 * 
 * Usage: node simple-speech-to-text.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Groq = require('groq-sdk');
const readline = require('readline');
require('dotenv').config();

class SimpleSpeechToText {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        
        this.tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        // Create readline interface for user input
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('🎤 Simple Speech-to-Text Service');
        console.log('📋 Using Groq Whisper Large V3 Turbo');
        console.log('');
    }

    /**
     * Record audio for a specified duration
     */
    async recordAudio(duration = 5) {
        // Create unique filename with timestamp and random number to avoid conflicts
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const audioFile = path.join(this.tempDir, `recording_${timestamp}_${random}.wav`);
        
        // Clean up any old recording files first
        this.cleanupOldRecordings();
        
        return new Promise((resolve, reject) => {
            console.log(`🔴 Recording for ${duration} seconds...`);
            console.log(`📁 Output file: ${audioFile}`);
            
            // Use the working internal microphone (DMIC) with optimal settings
            console.log(`🎯 Using internal microphone (plughw:0,99) with 16kHz mono`);
            
            const recordProcess = spawn('arecord', [
                '-D', 'plughw:0,99', // Use internal DMIC device
                '-f', 'S16_LE',      // 16-bit little-endian
                '-r', '16000',       // 16kHz - optimal for speech recognition
                '-c', '1',           // Mono - better for speech recognition
                '-t', 'wav',         // WAV format
                '-d', duration.toString(), // Duration in seconds
                audioFile
            ]);

            // Capture stderr for debugging
            let debugOutput = '';
            recordProcess.stderr.on('data', (data) => {
                debugOutput += data.toString();
            });

            recordProcess.on('error', (error) => {
                if (error.code === 'ENOENT') {
                    console.error('❌ arecord not found. Please install ALSA utilities:');
                    console.log('   Ubuntu/Debian: sudo apt-get install alsa-utils');
                    console.log('   CentOS/RHEL: sudo yum install alsa-utils');
                } else {
                    console.error('❌ Recording error:', error.message);
                }
                reject(error);
            });

            recordProcess.on('close', (code) => {
                clearInterval(progressInterval);
                if (code === 0) {
                    console.log('✅ Recording completed');
                    
                    // Show debug output if available
                    if (debugOutput.trim()) {
                        console.log('🔍 Recording details:', debugOutput.trim());
                    }
                    
                    // Verify the file was actually created and has content
                    if (fs.existsSync(audioFile)) {
                        const stats = fs.statSync(audioFile);
                        console.log(`📁 File size: ${stats.size} bytes`);
                        if (stats.size === 0) {
                            reject(new Error('Audio file is empty - no audio was recorded'));
                            return;
                        } else if (stats.size < 1000) {
                            console.log('⚠️  Warning: File is very small, audio might be silent');
                        }
                    } else {
                        reject(new Error('Audio file was not created'));
                        return;
                    }
                    
                    resolve(audioFile);
                } else {
                    reject(new Error(`Recording process exited with code ${code}`));
                }
            });

            // Show a simple progress indicator
            let dots = 0;
            const progressInterval = setInterval(() => {
                process.stdout.write('.');
                dots++;
                if (dots >= duration) {
                    clearInterval(progressInterval);
                    console.log('');
                }
            }, 1000);
        });
    }

    /**
     * Transcribe audio file using Groq
     */
    async transcribeAudio(audioFilePath) {
        try {
            if (!fs.existsSync(audioFilePath)) {
                throw new Error('Audio file not found');
            }

            const fileStats = fs.statSync(audioFilePath);
            if (fileStats.size === 0) {
                throw new Error('Audio file is empty - no audio was recorded');
            }

            console.log('🔄 Transcribing with Groq Whisper...');
            
            const transcription = await this.groq.audio.transcriptions.create({
                file: fs.createReadStream(audioFilePath),
                model: "whisper-large-v3-turbo",
                response_format: "verbose_json",
                language: "en", // Remove this line for auto-detection
                temperature: 0.0
            });

            // Clean up the audio file
            fs.unlinkSync(audioFilePath);

            return transcription;
        } catch (error) {
            console.error('❌ Transcription error:', error.message);
            if (error.response) {
                console.error('API Error:', error.response.status, error.response.data);
            }
            return null;
        }
    }

    /**
     * Main interactive session
     */
    async startSession() {
        console.log('🎯 Ready to transcribe speech!');
        console.log('');
        console.log('Commands:');
        console.log('  r - Record and transcribe (5 seconds)');
        console.log('  l - Record longer audio (10 seconds)');
        console.log('  q - Quit');
        console.log('');

        const askForCommand = () => {
            this.rl.question('Enter command (r/l/q): ', async (answer) => {
                const command = answer.trim().toLowerCase();

                switch (command) {
                    case 'r':
                        await this.recordAndTranscribe(5);
                        askForCommand();
                        break;
                    
                    case 'l':
                        await this.recordAndTranscribe(10);
                        askForCommand();
                        break;
                    
                    case 'q':
                        console.log('👋 Goodbye!');
                        this.rl.close();
                        process.exit(0);
                        break;
                    
                    default:
                        console.log('❓ Unknown command. Use r, l, or q');
                        askForCommand();
                        break;
                }
            });
        };

        askForCommand();
    }

    /**
     * Record and transcribe audio
     */
    async recordAndTranscribe(duration) {
        try {
            console.log('');
            console.log('🎙️  Get ready to speak...');
            
            // Small delay to let user prepare
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const audioFile = await this.recordAudio(duration);
            const transcription = await this.transcribeAudio(audioFile);
            
            if (transcription && transcription.text) {
                console.log('');
                console.log('📝 Transcription:');
                console.log('   "' + transcription.text.trim() + '"');
                console.log('');
                
                // Show additional info
                if (transcription.segments && transcription.segments.length > 0) {
                    const totalDuration = transcription.segments[transcription.segments.length - 1].end;
                    console.log(`⏱️  Audio duration: ${totalDuration.toFixed(1)}s`);
                    
                    // Calculate average confidence
                    const avgLogProb = transcription.segments.reduce((sum, seg) => 
                        sum + seg.avg_logprob, 0) / transcription.segments.length;
                    const confidence = Math.exp(avgLogProb) * 100;
                    console.log(`📊 Confidence: ${confidence.toFixed(1)}%`);
                }
            } else {
                console.log('❌ No speech detected or transcription failed');
                console.log('💡 Try speaking louder or closer to the microphone');
            }
            
        } catch (error) {
            console.error('❌ Error during recording/transcription:', error.message);
        }
        
        console.log('');
    }

    /**
     * Clean up old recording files to prevent conflicts
     */
    cleanupOldRecordings() {
        try {
            const files = fs.readdirSync(this.tempDir);
            const recordingFiles = files.filter(file => file.startsWith('recording_') && file.endsWith('.wav'));
            
            recordingFiles.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    // Ignore cleanup errors
                }
            });
        } catch (error) {
            // Ignore if temp directory doesn't exist
        }
    }
}

// Main execution
async function main() {
    // Check for Groq API key
    if (!process.env.GROQ_API_KEY) {
        console.error('❌ Error: GROQ_API_KEY environment variable is required');
        console.log('');
        console.log('Please add your Groq API key to the .env file:');
        console.log('  GROQ_API_KEY=your-api-key-here');
        console.log('');
        console.log('Get your API key from: https://console.groq.com/keys');
        process.exit(1);
    }

    const speechService = new SimpleSpeechToText();
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log('\n👋 Goodbye!');
        process.exit(0);
    });
    
    try {
        await speechService.startSession();
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = SimpleSpeechToText;