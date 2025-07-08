Function calling with the Gemini API

Function calling lets you connect models to external tools and APIs. Instead of generating text responses, the model determines when to call specific functions and provides the necessary parameters to execute real-world actions. This allows the model to act as a bridge between natural language and real-world actions and data. Function calling has 3 primary use cases:

Augment Knowledge: Access information from external sources like databases, APIs, and knowledge bases.
Extend Capabilities: Use external tools to perform computations and extend the limitations of the model, such as using a calculator or creating charts.
Take Actions: Interact with external systems using APIs, such as scheduling appointments, creating invoices, sending emails, or controlling smart home devices.
Get Weather Schedule Meeting Create Chart

Python
JavaScript
REST

import { GoogleGenAI, Type } from '@google/genai';

// Configure the client
const ai = new GoogleGenAI({});

// Define the function declaration for the model
const scheduleMeetingFunctionDeclaration = {
  name: 'schedule_meeting',
  description: 'Schedules a meeting with specified attendees at a given time and date.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      attendees: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of people attending the meeting.',
      },
      date: {
        type: Type.STRING,
        description: 'Date of the meeting (e.g., "2024-07-29")',
      },
      time: {
        type: Type.STRING,
        description: 'Time of the meeting (e.g., "15:00")',
      },
      topic: {
        type: Type.STRING,
        description: 'The subject or topic of the meeting.',
      },
    },
    required: ['attendees', 'date', 'time', 'topic'],
  },
};

// Send request with function declarations
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Schedule a meeting with Bob and Alice for 03/27/2025 at 10:00 AM about the Q3 planning.',
  config: {
    tools: [{
      functionDeclarations: [scheduleMeetingFunctionDeclaration]
    }],
  },
});

// Check for function calls in the response
if (response.functionCalls && response.functionCalls.length > 0) {
  const functionCall = response.functionCalls[0]; // Assuming one function call
  console.log(`Function to call: ${functionCall.name}`);
  console.log(`Arguments: ${JSON.stringify(functionCall.args)}`);
  // In a real app, you would call your actual function here:
  // const result = await scheduleMeeting(functionCall.args);
} else {
  console.log("No function call found in the response.");
  console.log(response.text);
}
How function calling works
function calling
overview

Function calling involves a structured interaction between your application, the model, and external functions. Here's a breakdown of the process:

Define Function Declaration: Define the function declaration in your application code. Function Declarations describe the function's name, parameters, and purpose to the model.
Call LLM with function declarations: Send user prompt along with the function declaration(s) to the model. It analyzes the request and determines if a function call would be helpful. If so, it responds with a structured JSON object.
Execute Function Code (Your Responsibility): The Model does not execute the function itself. It's your application's responsibility to process the response and check for Function Call, if
Yes: Extract the name and args of the function and execute the corresponding function in your application.
No: The model has provided a direct text response to the prompt (this flow is less emphasized in the example but is a possible outcome).
Create User friendly response: If a function was executed, capture the result and send it back to the model in a subsequent turn of the conversation. It will use the result to generate a final, user-friendly response that incorporates the information from the function call.
This process can be repeated over multiple turns, allowing for complex interactions and workflows. The model also supports calling multiple functions in a single turn (parallel function calling) and in sequence (compositional function calling).

Step 1: Define a function declaration
Define a function and its declaration within your application code that allows users to set light values and make an API request. This function could call external services or APIs.

Python
JavaScript

import { Type } from '@google/genai';

// Define a function that the model can call to control smart lights
const setLightValuesFunctionDeclaration = {
  name: 'set_light_values',
  description: 'Sets the brightness and color temperature of a light.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      brightness: {
        type: Type.NUMBER,
        description: 'Light level from 0 to 100. Zero is off and 100 is full brightness',
      },
      color_temp: {
        type: Type.STRING,
        enum: ['daylight', 'cool', 'warm'],
        description: 'Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.',
      },
    },
    required: ['brightness', 'color_temp'],
  },
};

/**

*   Set the brightness and color temperature of a room light. (mock API)
*   @param {number} brightness - Light level from 0 to 100. Zero is off and 100 is full brightness
*   @param {string} color_temp - Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.
*   @return {Object} A dictionary containing the set brightness and color temperature.
*/
function setLightValues(brightness, color_temp) {
  return {
    brightness: brightness,
    colorTemperature: color_temp
  };
}
Step 2: Call the model with function declarations
Once you have defined your function declarations, you can prompt the model to use them. It analyzes the prompt and function declarations and decides whether to respond directly or to call a function. If a function is called, the response object will contain a function call suggestion.

Python
JavaScript

import { GoogleGenAI } from '@google/genai';

// Generation config with function declaration
const config = {
  tools: [{
    functionDeclarations: [setLightValuesFunctionDeclaration]
  }]
};

// Configure the client
const ai = new GoogleGenAI({});

// Define user prompt
const contents = [
  {
    role: 'user',
    parts: [{ text: 'Turn the lights down to a romantic level' }]
  }
];

// Send request with function declarations
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: contents,
  config: config
});

console.log(response.functionCalls[0]);
The model then returns a functionCall object in an OpenAPI compatible schema specifying how to call one or more of the declared functions in order to respond to the user's question.

Python
JavaScript

{
  name: 'set_light_values',
  args: { brightness: 25, color_temp: 'warm' }
}
Step 3: Execute set_light_values function code
Extract the function call details from the model's response, parse the arguments , and execute the set_light_values function.

Python
JavaScript

// Extract tool call details
const tool_call = response.functionCalls[0]

let result;
if (tool_call.name === 'set_light_values') {
  result = setLightValues(tool_call.args.brightness, tool_call.args.color_temp);
  console.log(`Function execution result: ${JSON.stringify(result)}`);
}
Step 4: Create user friendly response with function result and call the model again
Finally, send the result of the function execution back to the model so it can incorporate this information into its final response to the user.

Python
JavaScript

// Create a function response part
const function_response_part = {
  name: tool_call.name,
  response: { result }
}

// Append function call and result of the function execution to contents
contents.push(response.candidates[0].content);
contents.push({ role: 'user', parts: [{ functionResponse: function_response_part }] });

// Get the final response from the model
const final_response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: contents,
  config: config
});

console.log(final_response.text);
This completes the function calling flow. The model successfully used the set_light_values function to perform the request action of the user.

Function declarations
When you implement function calling in a prompt, you create a tools object, which contains one or more function declarations. You define functions using JSON, specifically with a select subset of the OpenAPI schema format. A single function declaration can include the following parameters:

name (string): A unique name for the function (get_weather_forecast, send_email). Use descriptive names without spaces or special characters (use underscores or camelCase).
description (string): A clear and detailed explanation of the function's purpose and capabilities. This is crucial for the model to understand when to use the function. Be specific and provide examples if helpful ("Finds theaters based on location and optionally movie title which is currently playing in theaters.").
parameters (object): Defines the input parameters the function expects.
type (string): Specifies the overall data type, such as object.
properties (object): Lists individual parameters, each with:
type (string): The data type of the parameter, such as string, integer, boolean, array.
description (string): A description of the parameter's purpose and format. Provide examples and constraints ("The city and state, e.g., 'San Francisco, CA' or a zip code e.g., '95616'.").
enum (array, optional): If the parameter values are from a fixed set, use "enum" to list the allowed values instead of just describing them in the description. This improves accuracy ("enum": ["daylight", "cool", "warm"]).
required (array): An array of strings listing the parameter names that are mandatory for the function to operate.
Function calling with thinking
Enabling "thinking" can improve function call performance by allowing the model to reason through a request before suggesting function calls.

However, because the Gemini API is stateless, this reasoning context is lost between turns, which can reduce the quality of function calls as they require multiple turn requests.

To preserve this context you can use thought signatures. A thought signature is an encrypted representation of the model's internal thought process that you pass back to the model on subsequent turns.

To use thought signatures:

Receive the signature: When thinking is enabled, the API response will include a thought_signature field containing an encrypted representation of the model's reasoning.
Return the signature: When you send the function's execution result back to the server, include the thought_signature you received.
This allows the model to restore its previous thinking context and will likely result in better function calling performance.

Receiving signatures from the server

Signatures are returned in the part after the model's thinking phase, which typically is a text or function call.

Here are some examples of what thought signatures look like returned in each type of part, in response to the request "What's the weather in Lake Tahoe?" using the Get Weather example:

Text part
Function call part

[{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Here's what the weather in Lake Tahoe is today",
            "thoughtSignature": "ClcBVKhc7ru7KzUI7SrdUoIdAYLm/+i93aHjfIt4xHyAoO/G70tApxnK2ujBhOhC1PrRy1pkQa88fqFvpHNVd1HDjNLO7mkp6/hFwE+SPPEB3fh0hs4oM8MKhgIBVKhc7uIGvrS7i/T4HpfbnYrluFfWNjZ62gewqe4cVdR/Dlh+zbjtYmDD0gPZ+SuBO7vvHQdzsjePRP+2Y5XddX6LEf/cGGgakq8EhVvw/a6IVzUO6XmpHg2Ag1sl8E9+VFH/lC0R0ZuYdFWligtDuYwp5p5q3o59G0TtWeU2MC1y2MJfE9u/KWd313ldka80/X2W/xF2O/4djMp5G2WKcULfve75zeRCy0mc5iS3SB9mTH0cT6x0vtKjeBx50gcg+CQWtJcRuwTVzz54dmvmK9xvnqA8gKGw3DuaM9wfy5hyY7Qg0z3iyyWdP8T/lbjKim8IEQOk7O1vVwP1Ko7oMYH8JgA1CsoBAVSoXO6v4c5RSyd1cn6EIU0pEFQsjW7rYWPuZdOFq/tsGJT9BCfW7KGkPGwlNSq8jTJFvbcJ/DjtndISQYXwiXd2kGa5JfdS2Kh4zOxCxiWtOk+2nCc3+XQk2nonhO+esGJpkDdbbHZSqRgcUtYKq7q28iPFOQvOFyCiZNB7K86Z/6Hnagu2snSlN/BcTMaFGaWpcCClSUo4foRZn3WbNCoM8rcpD7qEJMp4a5baaSxyyeL1ZTGd2HLpFys/oiW6e3oAnhxuIysCwg=="
          }
        ],
        "role": "model"
      },
      "index": 0
    }
  ],
  # Remainder of response...
You can confirm that you received a signature and see what a signature looks like using the following code:


# Step 2: Call the model with function declarations
# ...Generation config, Configure the client, and Define user prompt (No changes)

# Send request with declarations (using a thinking model)
response = client.models.generate_content(
  model="gemini-2.5-flash", config=config, contents=contents)

# See thought signatures
for part in response.candidates[0].content.parts:
  if part.thought_signature:
    print("Thought signature:")
    print(part.thought_signature)
Returning signatures back to the server

In order to return signatures back:

You should return signatures along with their containing parts back to the server
You shouldn't merge a part with a signature with another part which also contains a signature. The signature string is not concatenable
You shouldn't merge one part with a signature with another part without a signature. This breaks the correct positioning of the thought represented by the signature.
The code will remain the same as in Step 4 of the previous section. But in this case (as indicated in the comment below) you will return signatures to the model along with the result of the function execution so the model can incorporate the thoughts into its final response:

Python
JavaScript

// Step 4: Create user friendly response with function result and call the model again
// ...Create a function response part (No change)

// Append thought signatures, function call and result of the function execution to contents
const function_response_content = response.candidates[0].content;
contents.push(function_response_content);
contents.push({ role: 'user', parts: [{ functionResponse: function_response_part }] });

const final_response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: contents,
  config: config
});

console.log(final_response.text);
The following shows what a request returning a thought signature may look like:


[{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "what is the weather in Lake Tahoe?"
        }
      ]
    },
    {
      "parts": [
        {
          "functionCall": {
            "name": "getWeather",
            "args": {
              "city": "Lake Tahoe"
            }
          },
          "thoughtSignature": "CiIBVKhc7oDPpCaXyJKKssjqr4g3JNOSgJ/M2V+1THC1icsWCmwBVKhc7pBABbZ+zR3e9234WnWWS6GFXmf8IVwpnzjd5KYd7vyJbn/4vTorWBGayj/vbd9JPaZQjxdAIXhoE5mX/MDsQ7M9N/b0qJjHm39tYIBvS4sIWkMDHqTJqXGLzhhKtrTkfbV3RbaJEkQKmwEBVKhc7qVUgC3hfTXZLo9R3AJzUUIx50NKvJTb9B+UU+LBqgg7Nck1x5OpjWVS2R+SsveprIuYOruk2Y0H53J2OJF8qsxTdIq2si8DGW2V7WK8xyoJH5kbqd7drIw1jLb44b6lx4SMyB0VaULuTBki4d+Ljjg1tJTwR0IYMKqDLDZt9mheINsi0ZxcNjfpnDydRXdWbcSwzmK/wgqJAQFUqFzuKgNVElxs3cbO+xebr2IwcOro84nKTisi0tTp9bICPC9fTUhn3L+rvQWA+d3J1Za8at2bakrqiRj7BTh+CVO9fWQMAEQAs3ni0Z2hfaYG92tOD26E4IoZwyYEoWbfNudpH1fr5tEkyqnEGtWIh7H+XoZQ2DXeiOa+br7Zk88SrNE+trJMCogBAVSoXO5e9fBLg7hnbkmKsrzNLnQtLsQm1gNzjcjEC7nJYklYPp0KI2uGBE1PkM8XNsfllAfHVn7LzHcHNlbQ9pJ7QZTSIeG42goS971r5wNZwxaXwCTphClQh826eqJWo6A/28TtAVQWLhTx5ekbP7qb4nh1UblESZ1saxDQAEo4OKPbDzx5BgqKAQFUqFzuVyjNm5i0wN8hTDnKjfpDroEpPPTs531iFy9BOX+xDCdGHy8D+osFpaoBq6TFekQQbz4hIoUR1YEcP4zI80/cNimEeb9IcFxZTTxiNrbhbbcv0969DSMWhB+ZEqIz4vuw4GLe/xcUvqhlChQwFdgIbdOQHSHpatn5uDlktnP/bi26nKuXIwo0AVSoXO7US22OUH7d1f4abNPI0IyAvhqkPp12rbtWLx9vkOtojE8IP+xCfYtIFuZIzRNZqA=="
        }
      ],
      "role": "model"
    },
    {
      "role": "user",
      "parts": [
        {
          "functionResponse": {
            "name": "getWeather",
            "response": {
              "response": {
                "stringValue": "Sunny and hot. 90 degrees Fahrenheit"
              }
            }
          }
        }
      ]
    }
  ],
  # Remainder of request...
Learn more about limitations and usage of thought signatures, and about thinking models in general, on the Thinking page.

Parallel function calling
In addition to single turn function calling, you can also call multiple functions at once. Parallel function calling lets you execute multiple functions at once and is used when the functions are not dependent on each other. This is useful in scenarios like gathering data from multiple independent sources, such as retrieving customer details from different databases or checking inventory levels across various warehouses or performing multiple actions such as converting your apartment into a disco.

Python
JavaScript

import { Type } from '@google/genai';

const powerDiscoBall = {
  name: 'power_disco_ball',
  description: 'Powers the spinning disco ball.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      power: {
        type: Type.BOOLEAN,
        description: 'Whether to turn the disco ball on or off.'
      }
    },
    required: ['power']
  }
};

const startMusic = {
  name: 'start_music',
  description: 'Play some music matching the specified parameters.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      energetic: {
        type: Type.BOOLEAN,
        description: 'Whether the music is energetic or not.'
      },
      loud: {
        type: Type.BOOLEAN,
        description: 'Whether the music is loud or not.'
      }
    },
    required: ['energetic', 'loud']
  }
};

const dimLights = {
  name: 'dim_lights',
  description: 'Dim the lights.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      brightness: {
        type: Type.NUMBER,
        description: 'The brightness of the lights, 0.0 is off, 1.0 is full.'
      }
    },
    required: ['brightness']
  }
};
Configure the function calling mode to allow using all of the specified tools. To learn more, you can read about configuring function calling.

Python
JavaScript

import { GoogleGenAI } from '@google/genai';

// Set up function declarations
const houseFns = [powerDiscoBall, startMusic, dimLights];

const config = {
    tools: [{
        functionDeclarations: houseFns
    }],
    // Force the model to call 'any' function, instead of chatting.
    toolConfig: {
        functionCallingConfig: {
            mode: 'any'
        }
    }
};

// Configure the client
const ai = new GoogleGenAI({});

// Create a chat session
const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: config
});
const response = await chat.sendMessage({message: 'Turn this place into a party!'});

// Print out each of the function calls requested from this single call
console.log("Example 1: Forced function calling");
for (const fn of response.functionCalls) {
    const args = Object.entries(fn.args)
        .map(([key, val]) => `${key}=${val}`)
        .join(', ');
    console.log(`${fn.name}(${args})`);
}
Each of the printed results reflects a single function call that the model has requested. To send the results back, include the responses in the same order as they were requested.

The Python SDK supports automatic function calling, which automatically converts Python functions to declarations, handles the function call execution and response cycle for you. Following is an example for the disco use case.

Note: Automatic Function Calling is a Python SDK only feature at the moment.
Python

from google import genai
from google.genai import types

# Actual function implementations
def power_disco_ball_impl(power: bool) -> dict:
    """Powers the spinning disco ball.

    Args:
        power: Whether to turn the disco ball on or off.

    Returns:
        A status dictionary indicating the current state.
    """
    return {"status": f"Disco ball powered {'on' if power else 'off'}"}

def start_music_impl(energetic: bool, loud: bool) -> dict:
    """Play some music matching the specified parameters.

    Args:
        energetic: Whether the music is energetic or not.
        loud: Whether the music is loud or not.

    Returns:
        A dictionary containing the music settings.
    """
    music_type = "energetic" if energetic else "chill"
    volume = "loud" if loud else "quiet"
    return {"music_type": music_type, "volume": volume}

def dim_lights_impl(brightness: float) -> dict:
    """Dim the lights.

    Args:
        brightness: The brightness of the lights, 0.0 is off, 1.0 is full.

    Returns:
        A dictionary containing the new brightness setting.
    """
    return {"brightness": brightness}

# Configure the client
client = genai.Client()
config = types.GenerateContentConfig(
    tools=[power_disco_ball_impl, start_music_impl, dim_lights_impl]
)

# Make the request
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Do everything you need to this place into party!",
    config=config,
)

print("\nExample 2: Automatic function calling")
print(response.text)
# I've turned on the disco ball, started playing loud and energetic music, and dimmed the lights to 50% brightness. Let's get this party started!
Compositional function calling
Compositional or sequential function calling allows Gemini to chain multiple function calls together to fulfill a complex request. For example, to answer "Get the temperature in my current location", the Gemini API might first invoke a get_current_location() function followed by a get_weather() function that takes the location as a parameter.

The following example demonstrates how to implement compositional function calling using the Python SDK and automatic function calling.

Python
JavaScript
This example shows how to use JavaScript/TypeScript SDK to do comopositional function calling using a manual execution loop.


import { GoogleGenAI, Type } from "@google/genai";

// Configure the client
const ai = new GoogleGenAI({});

// Example Functions
function get_weather_forecast({ location }) {
  console.log(`Tool Call: get_weather_forecast(location=${location})`);
  // TODO: Make API call
  console.log("Tool Response: {'temperature': 25, 'unit': 'celsius'}");
  return { temperature: 25, unit: "celsius" };
}

function set_thermostat_temperature({ temperature }) {
  console.log(
    `Tool Call: set_thermostat_temperature(temperature=${temperature})`,
  );
  // TODO: Make API call
  console.log("Tool Response: {'status': 'success'}");
  return { status: "success" };
}

const toolFunctions = {
  get_weather_forecast,
  set_thermostat_temperature,
};

const tools = [
  {
    functionDeclarations: [
      {
        name: "get_weather_forecast",
        description:
          "Gets the current weather temperature for a given location.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            location: {
              type: Type.STRING,
            },
          },
          required: ["location"],
        },
      },
      {
        name: "set_thermostat_temperature",
        description: "Sets the thermostat to a desired temperature.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            temperature: {
              type: Type.NUMBER,
            },
          },
          required: ["temperature"],
        },
      },
    ],
  },
];

// Prompt for the model
let contents = [
  {
    role: "user",
    parts: [
      {
        text: "If it's warmer than 20°C in London, set the thermostat to 20°C, otherwise set it to 18°C.",
      },
    ],
  },
];

// Loop until the model has no more function calls to make
while (true) {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: { tools },
  });

  if (result.functionCalls && result.functionCalls.length > 0) {
    const functionCall = result.functionCalls[0];

    const { name, args } = functionCall;

    if (!toolFunctions[name]) {
      throw new Error(`Unknown function call: ${name}`);
    }

    // Call the function and get the response.
    const toolResponse = toolFunctions[name](args);

    const functionResponsePart = {
      name: functionCall.name,
      response: {
        result: toolResponse,
      },
    };

    // Send the function response back to the model.
    contents.push({
      role: "model",
      parts: [
        {
          functionCall: functionCall,
        },
      ],
    });
    contents.push({
      role: "user",
      parts: [
        {
          functionResponse: functionResponsePart,
        },
      ],
    });
  } else {
    // No more function calls, break the loop.
    console.log(result.text);
    break;
  }
}
Expected Output

When you run the code, you will see the SDK orchestrating the function calls. The model first calls get_weather_forecast, receives the temperature, and then calls set_thermostat_temperature with the correct value based on the logic in the prompt.


Tool Call: get_weather_forecast(location=London)
Tool Response: {'temperature': 25, 'unit': 'celsius'}
Tool Call: set_thermostat_temperature(temperature=20)
Tool Response: {'status': 'success'}
OK. It's 25°C in London, so I've set the thermostat to 20°C.
Compositional function calling is a native Live API feature. This means Live API can handle the function calling similar to the Python SDK.

Python
JavaScript

// Light control schemas
const turnOnTheLightsSchema = { name: 'turn_on_the_lights' };
const turnOffTheLightsSchema = { name: 'turn_off_the_lights' };

const prompt = `
  Hey, can you write run some python code to turn on the lights, wait 10s and then turn off the lights?
`;

const tools = [
  { codeExecution: {} },
  { functionDeclarations: [turnOnTheLightsSchema, turnOffTheLightsSchema] }
];

await run(prompt, tools=tools, modality="AUDIO")
Function calling modes
The Gemini API lets you control how the model uses the provided tools (function declarations). Specifically, you can set the mode within the.function_calling_config.

AUTO (Default): The model decides whether to generate a natural language response or suggest a function call based on the prompt and context. This is the most flexible mode and recommended for most scenarios.
ANY: The model is constrained to always predict a function call and guarantees function schema adherence. If allowed_function_names is not specified, the model can choose from any of the provided function declarations. If allowed_function_names is provided as a list, the model can only choose from the functions in that list. Use this mode when you require a function call response to every prompt (if applicable).
NONE: The model is prohibited from making function calls. This is equivalent to sending a request without any function declarations. Use this to temporarily disable function calling without removing your tool definitions.

Python
JavaScript

import { FunctionCallingConfigMode } from '@google/genai';

// Configure function calling mode
const toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingConfigMode.ANY,
    allowedFunctionNames: ['get_current_temperature']
  }
};

// Create the generation config
const config = {
  tools: tools, // not defined here.
  toolConfig: toolConfig,
};
Automatic function calling (Python only)
When using the Python SDK, you can provide Python functions directly as tools. The SDK automatically converts the Python function to declarations, handles the function call execution and the response cycle for you. The Python SDK then automatically:

Detects function call responses from the model.
Call the corresponding Python function in your code.
Sends the function response back to the model.
Returns the model's final text response.
To use this, define your function with type hints and a docstring, and then pass the function itself (not a JSON declaration) as a tool:

Python

from google import genai
from google.genai import types

# Define the function with type hints and docstring
def get_current_temperature(location: str) -> dict:
    """Gets the current temperature for a given location.

    Args:
        location: The city and state, e.g. San Francisco, CA

    Returns:
        A dictionary containing the temperature and unit.
    """
    # ... (implementation) ...
    return {"temperature": 25, "unit": "Celsius"}

# Configure the client
client = genai.Client()
config = types.GenerateContentConfig(
    tools=[get_current_temperature]
)  # Pass the function itself

# Make the request
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="What's the temperature in Boston?",
    config=config,
)

print(response.text)  # The SDK handles the function call and returns the final text
You can disable automatic function calling with:

Python

config = types.GenerateContentConfig(
    tools=[get_current_temperature],
    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
)
Automatic function schema declaration
Automatic schema extraction from Python functions doesn't work in all cases. For example, it doesn't handle cases where you describe the fields of a nested dictionary-object. The API is able to describe any of the following types:

Python

AllowedType = (int | float | bool | str | list['AllowedType'] | dict[str, AllowedType])
To see what the inferred schema looks like, you can convert it using from_callable:

Python

def multiply(a: float, b: float):
    """Returns a * b."""
    return a * b

fn_decl = types.FunctionDeclaration.from_callable(callable=multiply, client=client)

# to_json_dict() provides a clean JSON representation.
print(fn_decl.to_json_dict())
Multi-tool use: Combine native tools with function calling
You can enable multiple tools combining native tools with function calling at the same time. Here's an example that enables two tools, Grounding with Google Search and code execution, in a request using the Live API.

Note: Multi-tool use is a-Live API only feature at the moment. The run() function declaration, which handles the asynchronous websocket setup, is omitted for brevity.
Python
JavaScript

// Multiple tasks example - combining lights, code execution, and search
const prompt = `
  Hey, I need you to do three things for me.

    1.  Turn on the lights.
    2.  Then compute the largest prime palindrome under 100000.
    3.  Then use Google Search to look up information about the largest earthquake in California the week of Dec 5 2024.

  Thanks!
`;

const tools = [
  { googleSearch: {} },
  { codeExecution: {} },
  { functionDeclarations: [turnOnTheLightsSchema, turnOffTheLightsSchema] } // not defined here.
];

// Execute the prompt with specified tools in audio modality
await run(prompt, {tools: tools, modality: "AUDIO"});
Python developers can try this out in the Live API Tool Use notebook.