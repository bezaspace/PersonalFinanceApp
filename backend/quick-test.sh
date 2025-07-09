#!/bin/bash

echo "🎤 Quick Audio Test with Fixed Settings"
echo "======================================="
echo ""

mkdir -p temp

echo "🔴 Recording 3 seconds with the working configuration..."
echo "📢 Please say something clearly!"

# Use the same settings as the fixed script
arecord -D hw:0,1 -f S16_LE -r 48000 -c 2 -t wav -d 3 temp/quick_test.wav

if [ $? -eq 0 ] && [ -f temp/quick_test.wav ]; then
    FILE_SIZE=$(stat -c%s temp/quick_test.wav)
    echo ""
    echo "✅ Recording successful!"
    echo "📁 File size: $FILE_SIZE bytes"
    
    if [ "$FILE_SIZE" -gt 10000 ]; then
        echo "✅ File size looks good - audio was captured!"
        echo ""
        echo "🔊 Playing back your recording..."
        aplay temp/quick_test.wav 2>/dev/null
        echo "✅ Playback completed"
        echo ""
        echo "🎯 Your speech-to-text script should now work!"
        echo "   Run: npm run speech"
    else
        echo "⚠️  File is small - might be silent"
    fi
else
    echo "❌ Recording failed"
fi

echo ""
echo "📋 To test the full script:"
echo "   cd backend"
echo "   npm run speech"
echo "   Then press 'r' and speak clearly"