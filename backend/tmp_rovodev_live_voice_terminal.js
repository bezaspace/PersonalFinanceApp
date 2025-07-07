const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
require('dotenv').config();

class LiveVoiceTerminalClient extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.isConnected = false;
        this.isRecording = false;
        this.isPlaying = false;
        this.recordingProcess = null;
        this.playbackProcess = null;
        this.audioChunkBuffer = [];
        this.sessionId = null;
        this.voiceActivityThreshold = 1000; // Minimum audio level to detect speech
        this.silenceTimeout = null;
        this.silenceDuration = 2000; // 2 seconds of silence to auto-end turn
        this.isUserSpeaking = false;
        this.tempDir = path.join(__dirname, 'temp');
        this.audioQueue = [];
        this.isProcessingAudio = false;
        this.sessionHealthInterval = null;
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async start() {
        console.log('🎤 Live Voice Chat Terminal Client');
        console.log('==================================\n');
        
        console.log('📡 Connecting to live voice server...');
        await this.connectToServer();
        
        console.log('🎤 Starting continuous voice recording...');
        this.startContinuousRecording();
        
        console.log('\n🗣️  Live Voice Chat Active!');
        console.log('   - Speak naturally, AI will respond in real-time');
        console.log('   - 2 seconds of silence will auto-end your turn');
        console.log('   - Press Ctrl+C to exit\n');
        
        // Keep the process alive
        this.setupGracefulShutdown();
    }

    connectToServer() {
        return new Promise((resolve, reject) => {
            // Connect to the WebSocket server
            this.ws = new WebSocket('ws://localhost:3000/live-voice');
            
            this.ws.on('open', () => {
                console.log('✅ Connected to live voice server');
                this.isConnected = true;
                resolve();
            });
            
            this.ws.on('message', (data) => {
                this.handleServerMessage(data);
            });
            
            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                if (!this.isConnected) {
                    reject(error);
                }
            });
            
            this.ws.on('close', () => {
                console.log('🔒 Connection to server closed');
                this.isConnected = false;
                this.cleanup();
            });
            
            // Timeout for connection
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    handleServerMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'session_started':
                    this.sessionId = message.sessionId;
                    console.log(`🎯 Session started: ${this.sessionId}`);
                    break;
                    
                case 'transcription':
                    if (message.isUser) {
                        console.log(`👤 You said: "${message.text}"`);
                    }
                    break;
                    
                case 'transcript':
                    if (!message.isUser) {
                        console.log(`🤖 AI: "${message.text}"`);
                    }
                    break;
                    
                case 'audio':
                    console.log('🔊 Received AI audio response');
                    this.playAudioResponse(message.audio);
                    break;
                    
                case 'error':
                    console.error('❌ Server error:', message.message);
                    break;
                    
                case 'pong':
                    // Heartbeat response
                    break;
                    
                case 'session_info_response':
                    console.log(`📊 Session Info: State=${message.sessionInfo.state}, Uptime=${Math.round(message.sessionInfo.uptime/1000/60)}min`);
                    break;
                    
                default:
                    console.log('📨 Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('❌ Error parsing server message:', error);
        }
    }

    startContinuousRecording() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        console.log('🎤 Continuous recording started...');
        
        // Use ffmpeg to capture audio continuously
        const ffmpegPath = 'C:\\ffmpeg\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe';
        this.recordingProcess = spawn(ffmpegPath, [
            '-f', 'dshow',
            '-i', 'audio=Microphone (Realtek(R) Audio)',
            '-ar', '16000',        // 16kHz sample rate
            '-ac', '1',            // Mono
            '-f', 's16le',         // 16-bit PCM little-endian (raw audio)
            '-'                    // Output to stdout
        ]);

        let chunkBuffer = Buffer.alloc(0);
        const chunkSize = 3200; // Send 100ms chunks (16000 Hz * 2 bytes * 0.1s = 3200 bytes)

        this.recordingProcess.stdout.on('data', (chunk) => {
            console.log(`📊 Received audio data: ${chunk.length} bytes`);
            chunkBuffer = Buffer.concat([chunkBuffer, chunk]);
            
            // Send chunks when we have enough data
            while (chunkBuffer.length >= chunkSize) {
                const audioChunk = chunkBuffer.slice(0, chunkSize);
                chunkBuffer = chunkBuffer.slice(chunkSize);
                
                console.log(`📤 Sending audio chunk: ${audioChunk.length} bytes`);
                this.sendAudioChunk(audioChunk);
                this.detectVoiceActivity(audioChunk);
            }
        });

        this.recordingProcess.stderr.on('data', (data) => {
            // Show ffmpeg errors for debugging
            const output = data.toString();
            if (output.includes('error') || output.includes('Error') || output.includes('failed') || output.includes('Failed')) {
                console.error('🔴 FFmpeg error:', output);
            }
        });

        this.recordingProcess.on('error', (error) => {
            console.error('❌ Recording error:', error.message);
            console.log('💡 Make sure ffmpeg is installed and microphone is accessible');
        });

        this.recordingProcess.on('close', (code) => {
            console.log(`🎤 Recording process ended with code ${code}`);
            this.isRecording = false;
        });
    }

    sendAudioChunk(audioChunk) {
        if (!this.isConnected || !this.ws) {
            console.log('⚠️ Cannot send audio: not connected');
            return;
        }
        
        try {
            const message = {
                type: 'audio_chunk',
                data: audioChunk.toString('base64'),
                mimeType: 'audio/pcm;rate=16000'
            };
            
            console.log(`🔗 WebSocket state: ${this.ws.readyState}, sending message type: ${message.type}`);
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('❌ Error sending audio chunk:', error);
        }
    }

    detectVoiceActivity(audioChunk) {
        // Simple voice activity detection based on audio level
        const audioLevel = this.calculateAudioLevel(audioChunk);
        
        // Debug: Show audio levels periodically
        if (Math.random() < 0.01) { // 1% of the time
            console.log(`🔊 Audio level: ${Math.round(audioLevel)} (threshold: ${this.voiceActivityThreshold})`);
        }
        
        if (audioLevel > this.voiceActivityThreshold) {
            if (!this.isUserSpeaking) {
                this.isUserSpeaking = true;
                console.log('🗣️  Speech detected...');
            }
            
            // Reset silence timeout
            if (this.silenceTimeout) {
                clearTimeout(this.silenceTimeout);
            }
            
            // Set new silence timeout
            this.silenceTimeout = setTimeout(() => {
                this.endUserTurn();
            }, this.silenceDuration);
        }
    }

    calculateAudioLevel(audioChunk) {
        // Simple RMS calculation for audio level detection
        let sum = 0;
        for (let i = 0; i < audioChunk.length; i += 2) {
            if (i + 1 < audioChunk.length) {
                const sample = audioChunk.readInt16LE(i);
                sum += sample * sample;
            }
        }
        return Math.sqrt(sum / (audioChunk.length / 2));
    }

    endUserTurn() {
        if (!this.isUserSpeaking) return;
        
        this.isUserSpeaking = false;
        console.log('⏸️  Speech ended, processing...');
        
        // Send end turn signal to server
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'end_turn'
                }));
            } catch (error) {
                console.error('❌ Error sending end turn:', error);
            }
        }
        
        // Clear silence timeout
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
    }

    async playAudioResponse(audioBase64) {
        if (this.isPlaying) {
            // Queue audio if already playing
            this.audioQueue.push(audioBase64);
            return;
        }
        
        this.isPlaying = true;
        
        try {
            // Save audio to temporary file
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const tempAudioFile = path.join(this.tempDir, `response_${Date.now()}.wav`);
            fs.writeFileSync(tempAudioFile, audioBuffer);
            
            console.log('🔊 Playing AI response...');
            
            // Play audio using ffmpeg
            const ffmpegPath = 'C:\\ffmpeg\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe';
            this.playbackProcess = spawn(ffmpegPath, [
                '-i', tempAudioFile,
                '-f', 'wav',
                '-'
            ]);
            
            // Pipe to system audio (Windows)
            const playProcess = spawn('powershell', [
                '-Command',
                `Add-Type -AssemblyName presentationCore; 
                 $player = New-Object system.windows.media.mediaplayer; 
                 $player.open('${tempAudioFile}'); 
                 $player.Play(); 
                 Start-Sleep -Seconds 10`
            ]);
            
            playProcess.on('close', () => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempAudioFile);
                } catch (error) {
                    // Ignore cleanup errors
                }
                
                this.isPlaying = false;
                console.log('✅ Audio playback completed');
                
                // Play next audio in queue if any
                if (this.audioQueue.length > 0) {
                    const nextAudio = this.audioQueue.shift();
                    this.playAudioResponse(nextAudio);
                }
            });
            
            playProcess.on('error', (error) => {
                console.error('❌ Audio playback error:', error.message);
                console.log('💡 Trying alternative playback method...');
                
                // Fallback: just save the file for manual playback
                const fallbackFile = `ai_response_${Date.now()}.wav`;
                fs.writeFileSync(fallbackFile, audioBuffer);
                console.log(`💾 Audio saved as: ${fallbackFile}`);
                console.log('🎵 Please play this file manually to hear the response');
                
                this.isPlaying = false;
            });
            
        } catch (error) {
            console.error('❌ Error playing audio response:', error);
            this.isPlaying = false;
        }
    }

    sendHeartbeat() {
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
                console.error('❌ Error sending heartbeat:', error);
            }
        }
    }

    requestSessionInfo() {
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify({ type: 'session_info' }));
            } catch (error) {
                console.error('❌ Error requesting session info:', error);
            }
        }
    }

    setupGracefulShutdown() {
        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 30000);
        
        // Request session info every 5 minutes for monitoring
        this.sessionHealthInterval = setInterval(() => {
            this.requestSessionInfo();
        }, 5 * 60 * 1000);
        
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            console.log('\n👋 Shutting down gracefully...');
            clearInterval(heartbeatInterval);
            if (this.sessionHealthInterval) {
                clearInterval(this.sessionHealthInterval);
            }
            this.cleanup();
        });
        
        // Handle other termination signals
        process.on('SIGTERM', () => {
            clearInterval(heartbeatInterval);
            if (this.sessionHealthInterval) {
                clearInterval(this.sessionHealthInterval);
            }
            this.cleanup();
        });
        
        // Keep process alive
        process.stdin.resume();
    }

    cleanup() {
        console.log('🧹 Cleaning up...');
        
        // Stop recording
        if (this.recordingProcess) {
            this.recordingProcess.kill('SIGTERM');
            this.recordingProcess = null;
        }
        
        // Stop playback
        if (this.playbackProcess) {
            this.playbackProcess.kill('SIGTERM');
            this.playbackProcess = null;
        }
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Clear timeouts and intervals
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
        }
        
        if (this.sessionHealthInterval) {
            clearInterval(this.sessionHealthInterval);
            this.sessionHealthInterval = null;
        }
        
        // Clean up temp directory
        try {
            const files = fs.readdirSync(this.tempDir);
            for (const file of files) {
                if (file.startsWith('response_') || file.startsWith('input_') || file.startsWith('output_')) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
        
        console.log('✅ Cleanup completed');
        process.exit(0);
    }
}

// Start the live voice chat client
const client = new LiveVoiceTerminalClient();

client.start().catch((error) => {
    console.error('❌ Failed to start live voice chat:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Make sure the live voice server is running on port 3001');
    console.log('   2. Check that ffmpeg is installed and accessible');
    console.log('   3. Verify microphone permissions');
    console.log('   4. Ensure WebSocket server is properly configured');
    process.exit(1);
});