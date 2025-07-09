#!/bin/bash

echo "🎤 Microphone Test Script"
echo "========================"
echo ""

# Check if arecord is available
if ! command -v arecord &> /dev/null; then
    echo "❌ arecord not found. Please install:"
    echo "   sudo apt-get install alsa-utils"
    exit 1
fi

# List audio devices
echo "📱 Available audio devices:"
arecord -l
echo ""

# Test microphone with a simple 3-second recording
echo "🔴 Recording 3 seconds of audio..."
echo "📢 Please say: 'This is a microphone test'"
echo ""

TEMP_FILE="temp/mic_test_$(date +%s).wav"
mkdir -p temp

# Record with verbose output
arecord -f S16_LE -r 16000 -c 1 -t wav -d 3 -v "$TEMP_FILE"

echo ""
echo "✅ Recording completed"

# Check file size
if [ -f "$TEMP_FILE" ]; then
    FILE_SIZE=$(stat -c%s "$TEMP_FILE")
    echo "📁 File size: $FILE_SIZE bytes"
    
    if [ "$FILE_SIZE" -eq 0 ]; then
        echo "⚠️  WARNING: File is empty - microphone not working"
    elif [ "$FILE_SIZE" -lt 1000 ]; then
        echo "⚠️  WARNING: File is very small - might be silent"
    else
        echo "✅ File size looks good"
        
        # Try to play it back
        if command -v aplay &> /dev/null; then
            echo ""
            echo "🔊 Playing back recording..."
            aplay "$TEMP_FILE"
            echo "✅ Playback completed"
        fi
    fi
else
    echo "❌ Recording file not created"
fi

echo ""
echo "💡 Troubleshooting tips:"
echo "   - Check microphone permissions"
echo "   - Run: alsamixer (press F4 for capture devices)"
echo "   - Try: pulseaudio --check -v"
echo "   - Check system sound settings"