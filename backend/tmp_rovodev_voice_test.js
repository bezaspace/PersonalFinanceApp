const { GoogleGenAI, Modality } = require('@google/genai');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

class VoiceTest {
    constructor() {
        this.session = null;
        this.isRecording = false;
        this.audioBuffer = [];
    }

    async startTest() {
        console.log('🎤 Gemini Live Voice Test');
        console.log('========================\n');
        
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY not found');
            return;
        }

        try {
            const genAI = new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY,
            });

            console.log('📡 Connecting to Gemini Live...');
            
            this.session = await genAI.live.connect({
                model: "gemini-live-2.5-flash-preview",
                callbacks: {
                    onopen: () => {
                        console.log('✅ Connected to Gemini Live!');
                        console.log('\n🎤 Instructions:');
                        console.log('   - Press ENTER to start recording');
                        console.log('   - Speak into your microphone');
                        console.log('   - Press ENTER again to stop and send');
                        console.log('   - Type "quit" to exit\n');
                        this.startInteractiveMode();
                    },
                    onmessage: (message) => {
                        this.handleGeminiResponse(message);
                    },
                    onerror: (error) => {
                        console.error('❌ Gemini error:', error);
                    },
                    onclose: (event) => {
                        console.log('🔒 Connection closed');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: "You are a helpful AI assistant. Respond naturally and conversationally to voice input. Keep responses concise but friendly."
                },
            });

        } catch (error) {
            console.error('❌ Failed to connect:', error.message);
            this.cleanup();
        }
    }

    startInteractiveMode() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const promptUser = () => {
            rl.question('Press ENTER to record (or "quit" to exit): ', (input) => {
                if (input.toLowerCase() === 'quit') {
                    console.log('👋 Goodbye!');
                    this.cleanup();
                    rl.close();
                    return;
                }

                if (!this.isRecording) {
                    this.startRecording();
                    rl.question('🔴 Recording... Press ENTER to stop: ', () => {
                        this.stopRecording();
                        setTimeout(promptUser, 1000); // Wait a bit before next prompt
                    });
                } else {
                    promptUser();
                }
            });
        };

        promptUser();
    }

    startRecording() {
        console.log('🎤 Recording started...');
        this.isRecording = true;
        this.audioBuffer = [];

        // Use ffmpeg to capture audio from microphone
        // Format: 16-bit PCM, 16kHz, mono (required by Gemini)
        const ffmpegPath = 'C:\\ffmpeg\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe';
        this.recordingProcess = spawn(ffmpegPath, [
            '-f', 'dshow',           // Windows DirectShow input
            '-i', 'audio=Microphone (Realtek(R) Audio)',  // Your specific microphone
            '-ar', '16000',          // Sample rate 16kHz
            '-ac', '1',              // Mono channel
            '-f', 's16le',           // 16-bit little-endian PCM
            '-'                      // Output to stdout
        ]);

        this.recordingProcess.stdout.on('data', (chunk) => {
            this.audioBuffer.push(chunk);
        });

        this.recordingProcess.stderr.on('data', (data) => {
            // Suppress ffmpeg verbose output
        });

        this.recordingProcess.on('error', (error) => {
            console.error('❌ Recording error:', error.message);
            console.log('💡 Make sure ffmpeg is installed and in your PATH');
            console.log('💡 Alternative: Install ffmpeg from https://ffmpeg.org/');
        });
    }

    stopRecording() {
        if (!this.isRecording) return;

        console.log('⏹️  Recording stopped, processing...');
        this.isRecording = false;

        if (this.recordingProcess) {
            this.recordingProcess.kill('SIGTERM');
        }

        // Combine audio chunks
        const audioData = Buffer.concat(this.audioBuffer);
        
        if (audioData.length === 0) {
            console.log('⚠️  No audio captured');
            return;
        }

        console.log(`📊 Captured ${audioData.length} bytes of audio`);
        
        // Convert to base64 and send to Gemini
        const base64Audio = audioData.toString('base64');
        this.sendAudioToGemini(base64Audio);
    }

    sendAudioToGemini(audioBase64) {
        try {
            console.log('📤 Sending audio to Gemini...');
            
            this.session.sendRealtimeInput({
                audio: {
                    data: audioBase64,
                    mimeType: "audio/pcm;rate=16000"
                }
            });

            // Signal end of turn
            setTimeout(() => {
                this.session.sendRealtimeInput({
                    turnComplete: true
                });
            }, 100);

        } catch (error) {
            console.error('❌ Error sending audio:', error);
        }
    }

    handleGeminiResponse(message) {
        console.log('📨 Full message structure:', JSON.stringify(message, null, 2));
        
        if (message.data) {
            console.log('🔊 Received audio response from Gemini');
            console.log('📊 Audio data length:', message.data.length);
            
            // Save audio response to file
            const audioData = Buffer.from(message.data, 'base64');
            console.log('📊 Decoded audio buffer size:', audioData.length, 'bytes');
            
            if (audioData.length > 0) {
                const filename = `response_${Date.now()}.wav`;
                
                // Create a simple WAV header for 24kHz audio (Gemini's output rate)
                const wavHeader = this.createWavHeader(audioData.length, 24000);
                const wavFile = Buffer.concat([wavHeader, audioData]);
                
                fs.writeFileSync(filename, wavFile);
                console.log(`💾 Audio response saved as: ${filename} (${wavFile.length} bytes total)`);
                console.log('🎵 You can play this file to hear Gemini\'s response');
            } else {
                console.log('⚠️  Audio data is empty');
            }
        }

        if (message.serverContent) {
            if (message.serverContent.modelTurn) {
                const parts = message.serverContent.modelTurn.parts;
                for (const part of parts) {
                    if (part.text) {
                        console.log('📝 Gemini transcript:', part.text);
                    }
                }
            }
        }

        if (message.clientContent) {
            if (message.clientContent.turns) {
                for (const turn of message.clientContent.turns) {
                    if (turn.parts) {
                        for (const part of turn.parts) {
                            if (part.text) {
                                console.log('👤 Your speech:', part.text);
                            }
                        }
                    }
                }
            }
        }
    }

    createWavHeader(dataLength, sampleRate) {
        const header = Buffer.alloc(44);
        
        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataLength, 4);
        header.write('WAVE', 8);
        
        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // chunk size
        header.writeUInt16LE(1, 20);  // PCM format
        header.writeUInt16LE(1, 22);  // mono
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * 2, 28); // byte rate
        header.writeUInt16LE(2, 32);  // block align
        header.writeUInt16LE(16, 34); // bits per sample
        
        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(dataLength, 40);
        
        return header;
    }

    cleanup() {
        if (this.recordingProcess) {
            this.recordingProcess.kill('SIGTERM');
        }
        
        if (this.session) {
            this.session.close();
        }
        
        process.exit(0);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n👋 Exiting...');
    process.exit(0);
});

// Start the test
const test = new VoiceTest();
test.startTest();