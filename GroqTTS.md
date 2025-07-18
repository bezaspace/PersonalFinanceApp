Text to Speech
Learn how to instantly generate lifelike audio from text.

Overview
The Groq API speech endpoint provides fast text-to-speech (TTS), enabling you to convert text to spoken audio in seconds with our available TTS models.

With support for 23 voices, 19 in English and 4 in Arabic, you can instantly create life-like audio content for customer support agents, characters for game development, and more.

API Endpoint
Endpoint	Usage	API Endpoint
Speech	Convert text to audio	https://api.groq.com/openai/v1/audio/speech
Supported Models
Model ID	Model Card	Supported Language(s)	Description
playai-tts	Card 	English	High-quality TTS model for English speech generation.
playai-tts-arabic	Card 	Arabic	High-quality TTS model for Arabic speech generation.
Working with Speech
Quick Start
The speech endpoint takes four key inputs:

model: playai-tts or playai-tts-arabic
input: the text to generate audio from
voice: the desired voice for output
response format: defaults to "wav"
Python
JavaScript
curl
The Groq SDK package can be installed using the following command:

shell

npm install --save groq-sdk
The following is an example of a request using playai-tts. To use the Arabic model, use the playai-tts-arabic model ID and an Arabic prompt:

JavaScript

import fs from "fs";
import path from "path";
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const speechFilePath = "speech.wav";
const model = "playai-tts";
const voice = "Fritz-PlayAI";
const text = "I love building and shipping new features for our users!";
const responseFormat = "wav";

async function main() {
  const response = await groq.audio.speech.create({
    model: model,
    voice: voice,
    input: text,
    response_format: responseFormat
  });
  
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(speechFilePath, buffer);
}

main();
Parameters
Parameter	Type	Required	Value	Description
model	string	Yes	playai-tts
playai-tts-arabic	Model ID to use for TTS.
input	string	Yes	-	User input text to be converted to speech. Maximum length is 10K characters.
voice	string	Yes	See available English and Arabic voices.	The voice to use for audio generation. There are currently 26 English options for playai-tts and 4 Arabic options for playai-tts-arabic.
response_format	string	Optional	"wav"	Format of the response audio file. Defaults to currently supported "wav".
