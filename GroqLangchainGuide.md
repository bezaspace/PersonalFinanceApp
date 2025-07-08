npm i @langchain/groq 

Add environment variables
GROQ_API_KEY=your-api-key

Instantiate the model
import { ChatGroq } from "@langchain/groq";

const model = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0
});

await model.invoke("Hello, world!")


How to create Tools
Prerequisites
This guide assumes familiarity with the following concepts:

LangChain tools
Agents
When constructing your own agent, you will need to provide it with a list of Tools that it can use. While LangChain includes some prebuilt tools, it can often be more useful to use tools that use custom logic. This guide will walk you through some ways you can create custom tools.

The biggest difference here is that the first function requires an object with multiple input fields, while the second one only accepts an object with a single field. Some older agents only work with functions that require single inputs, so it’s important to understand the distinction.

LangChain has a handful of ways to construct tools for different applications. Below I’ll show the two most common ways to create tools, and where you might use each.

Tool schema
Compatibility
Only available in @langchain/core version 0.2.19 and above.

The simplest way to create a tool is through the StructuredToolParams schema. Every chat model which supports tool calling in LangChain accepts binding tools to the model through this schema. This schema has only three fields

name - The name of the tool.
schema - The schema of the tool, defined with a Zod object.
description (optional) - A description of the tool.
This schema does not include a function to pair with the tool, and for this reason it should only be used in situations where the generated output does not need to be passed as the input argument to a function.

import { z } from "zod";
import { StructuredToolParams } from "@langchain/core/tools";

const simpleToolSchema: StructuredToolParams = {
  name: "get_current_weather",
  description: "Get the current weather for a location",
  schema: z.object({
    city: z.string().describe("The city to get the weather for"),
    state: z.string().optional().describe("The state to get the weather for"),
  }),
};

tool function
Compatibility
Only available in @langchain/core version 0.2.7 and above.

The tool wrapper function is a convenience method for turning a JavaScript function into a tool. It requires the function itself along with some additional arguments that define your tool. You should use this over StructuredToolParams tools when the resulting tool call executes a function. The most important are:

The tool’s name, which the LLM will use as context as well as to reference the tool
An optional, but recommended description, which the LLM will use as context to know when to use the tool
A schema, which defines the shape of the tool’s input
The tool function will return an instance of the StructuredTool class, so it is compatible with all the existing tool calling infrastructure in the LangChain library.

import { z } from "zod";
import { tool } from "@langchain/core/tools";

const adderSchema = z.object({
  a: z.number(),
  b: z.number(),
});
const adderTool = tool(
  async (input): Promise<string> => {
    const sum = input.a + input.b;
    return `The sum of ${input.a} and ${input.b} is ${sum}`;
  },
  {
    name: "adder",
    description: "Adds two numbers together",
    schema: adderSchema,
  }
);

await adderTool.invoke({ a: 1, b: 2 });

"The sum of 1 and 2 is 3"

DynamicStructuredTool
You can also use the DynamicStructuredTool class to declare tools. Here’s an example - note that tools must always return strings!

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const multiplyTool = new DynamicStructuredTool({
  name: "multiply",
  description: "multiply two numbers together",
  schema: z.object({
    a: z.number().describe("the first number to multiply"),
    b: z.number().describe("the second number to multiply"),
  }),
  func: async ({ a, b }: { a: number; b: number }) => {
    return (a * b).toString();
  },
});

await multiplyTool.invoke({ a: 8, b: 9 });

"72"

DynamicTool
For older agents that require tools which accept only a single input, you can pass the relevant parameters to the DynamicTool class. This is useful when working with older agents that only support tools that accept a single input. In this case, no schema is required:

import { DynamicTool } from "@langchain/core/tools";

const searchTool = new DynamicTool({
  name: "search",
  description: "look things up online",
  func: async (_input: string) => {
    return "LangChain";
  },
});

await searchTool.invoke("foo");

"LangChain"

Returning artifacts of Tool execution
Sometimes there are artifacts of a tool’s execution that we want to make accessible to downstream components in our chain or agent, but that we don’t want to expose to the model itself. For example if a tool returns custom objects like Documents, we may want to pass some view or metadata about this output to the model without passing the raw output to the model. At the same time, we may want to be able to access this full output elsewhere, for example in downstream tools.

The Tool and ToolMessage interfaces make it possible to distinguish between the parts of the tool output meant for the model (ToolMessage.content) and those parts which are meant for use outside the model (ToolMessage.artifact).

Compatibility
This functionality was added in @langchain/core>=0.2.16. Please make sure your package is up to date.

If you want your tool to distinguish between message content and other artifacts, we need to do three things:

Set the response_format parameter to "content_and_artifact" when defining the tool.
Make sure that we return a tuple of [content, artifact].
Call the tool with a a ToolCall (like the ones generated by tool-calling models) rather than with the required schema directly.
Here’s an example of what this looks like. First, create a new tool:

import { z } from "zod";
import { tool } from "@langchain/core/tools";

const randomIntToolSchema = z.object({
  min: z.number(),
  max: z.number(),
  size: z.number(),
});

const generateRandomInts = tool(
  async ({ min, max, size }) => {
    const array: number[] = [];
    for (let i = 0; i < size; i++) {
      array.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return [
      `Successfully generated array of ${size} random ints in [${min}, ${max}].`,
      array,
    ];
  },
  {
    name: "generateRandomInts",
    description: "Generate size random ints in the range [min, max].",
    schema: randomIntToolSchema,
    responseFormat: "content_and_artifact",
  }
);


If you invoke our tool directly with the tool arguments, you’ll get back just the content part of the output:

await generateRandomInts.invoke({ min: 0, max: 9, size: 10 });

"Successfully generated array of 10 random ints in [0, 9]."

But if you invoke our tool with a ToolCall, you’ll get back a ToolMessage that contains both the content and artifact generated by the Tool:

await generateRandomInts.invoke({
  name: "generateRandomInts",
  args: { min: 0, max: 9, size: 10 },
  id: "123", // required
  type: "tool_call",
});

ToolMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: "Successfully generated array of 10 random ints in [0, 9].",
    artifact: [
      7, 7, 1, 4, 8,
      4, 8, 3, 0, 9
    ],
    tool_call_id: "123",
    name: "generateRandomInts",
    additional_kwargs: {},
    response_metadata: {}
  },
  lc_namespace: [ "langchain_core", "messages" ],
  content: "Successfully generated array of 10 random ints in [0, 9].",
  name: "generateRandomInts",
  additional_kwargs: {},
  response_metadata: {},
  id: undefined,
  tool_call_id: "123",
  artifact: [
    7, 7, 1, 4, 8,
    4, 8, 3, 0, 9
  ]
}

How to use chat models to call tools
Prerequisites
This guide assumes familiarity with the following concepts:

Chat models
LangChain Tools
Tool calling
Tool calling allows a chat model to respond to a given prompt by “calling a tool”.

Remember, while the name “tool calling” implies that the model is directly performing some action, this is actually not the case! The model only generates the arguments to a tool, and actually running the tool (or not) is up to the user.

Tool calling is a general technique that generates structured output from a model, and you can use it even when you don’t intend to invoke any tools. An example use-case of that is extraction from unstructured text.



If you want to see how to use the model-generated tool call to actually run a tool function check out this guide.

Supported models
Tool calling is not universal, but is supported by many popular LLM providers, including Anthropic, Cohere, Google, Mistral, OpenAI, and even for locally-running models via Ollama.

You can find a list of all models that support tool calling here.

LangChain implements standard interfaces for defining tools, passing them to LLMs, and representing tool calls. This guide will cover how to bind tools to an LLM, then invoke the LLM to generate these arguments.

LangChain implements standard interfaces for defining tools, passing them to LLMs, and representing tool calls. This guide will show you how to use them.

Passing tools to chat models
Chat models that support tool calling features implement a .bindTools() method, which receives a list of LangChain tool objects and binds them to the chat model in its expected format. Subsequent invocations of the chat model will include tool schemas in its calls to the LLM.

note
As of @langchain/core version 0.2.9, all chat models with tool calling capabilities now support OpenAI-formatted tools.

Let’s walk through an example:

Pick your chat model:
Anthropic
OpenAI
MistralAI
FireworksAI
Install dependencies
tip
See this section for general instructions on installing integration packages.

npm
yarn
pnpm
npm i @langchain/anthropic @langchain/core

Add environment variables
ANTHROPIC_API_KEY=your-api-key

Instantiate the model
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0
});

We can use the .bindTools() method to handle the conversion from LangChain tool to our model provider’s specific format and bind it to the model (i.e., passing it in each time the model is invoked). A number of models implement helper methods that will take care of formatting and binding different function-like objects to the model. Let’s create a new tool implementing a Zod schema, then bind it to the model:

note
The tool function is available in @langchain/core version 0.2.7 and above.

If you are on an older version of core, you should use instantiate and use DynamicStructuredTool instead.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Note that the descriptions here are crucial, as they will be passed along
 * to the model along with the class name.
 */
const calculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The type of operation to execute."),
  number1: z.number().describe("The first number to operate on."),
  number2: z.number().describe("The second number to operate on."),
});

const calculatorTool = tool(
  async ({ operation, number1, number2 }) => {
    // Functions must return strings
    if (operation === "add") {
      return `${number1 + number2}`;
    } else if (operation === "subtract") {
      return `${number1 - number2}`;
    } else if (operation === "multiply") {
      return `${number1 * number2}`;
    } else if (operation === "divide") {
      return `${number1 / number2}`;
    } else {
      throw new Error("Invalid operation.");
    }
  },
  {
    name: "calculator",
    description: "Can perform mathematical operations.",
    schema: calculatorSchema,
  }
);

const llmWithTools = llm.bindTools([calculatorTool]);

Now, let’s invoke it! We expect the model to use the calculator to answer the question:

const res = await llmWithTools.invoke("What is 3 * 12");

console.log(res);

AIMessage {
  "id": "chatcmpl-9p1Ib4xfxV4yahv2ZWm1IRb1fRVD7",
  "content": "",
  "additional_kwargs": {
    "tool_calls": [
      {
        "id": "call_CrZkMP0AvUrz7w9kim0splbl",
        "type": "function",
        "function": "[Object]"
      }
    ]
  },
  "response_metadata": {
    "tokenUsage": {
      "completionTokens": 24,
      "promptTokens": 93,
      "totalTokens": 117
    },
    "finish_reason": "tool_calls",
    "system_fingerprint": "fp_400f27fa1f"
  },
  "tool_calls": [
    {
      "name": "calculator",
      "args": {
        "operation": "multiply",
        "number1": 3,
        "number2": 12
      },
      "type": "tool_call",
      "id": "call_CrZkMP0AvUrz7w9kim0splbl"
    }
  ],
  "invalid_tool_calls": [],
  "usage_metadata": {
    "input_tokens": 93,
    "output_tokens": 24,
    "total_tokens": 117
  }
}

As we can see our LLM generated arguments to a tool!

Note: If you are finding that the model does not call a desired tool for a given prompt, you can see this guide on how to force the LLM to call a tool rather than letting it decide.

tip
See a LangSmith trace for the above here.

Tool calls
If tool calls are included in a LLM response, they are attached to the corresponding message or message chunk as a list of tool call objects in the .tool_calls attribute.

A ToolCall is a typed dict that includes a tool name, dict of argument values, and (optionally) an identifier. Messages with no tool calls default to an empty list for this attribute.

Chat models can call multiple tools at once. Here’s an example:

const res = await llmWithTools.invoke("What is 3 * 12? Also, what is 11 + 49?");

res.tool_calls;

[
  {
    name: 'calculator',
    args: { operation: 'multiply', number1: 3, number2: 12 },
    type: 'tool_call',
    id: 'call_01lvdk2COLV2hTjRUNAX8XWH'
  },
  {
    name: 'calculator',
    args: { operation: 'add', number1: 11, number2: 49 },
    type: 'tool_call',
    id: 'call_fB0vo8VC2HRojZcj120xIBxM'
  }
]

The .tool_calls attribute should contain valid tool calls. Note that on occasion, model providers may output malformed tool calls (e.g., arguments that are not valid JSON). When parsing fails in these cases, instances of InvalidToolCall are populated in the .invalid_tool_calls attribute. An InvalidToolCall can have a name, string arguments, identifier, and error message.

Binding model-specific formats (advanced)
Providers adopt different conventions for formatting tool schemas. For instance, OpenAI uses a format like this:

type: The type of the tool. At the time of writing, this is always “function”.
function: An object containing tool parameters.
function.name: The name of the schema to output.
function.description: A high level description of the schema to output.
function.parameters: The nested details of the schema you want to extract, formatted as a JSON schema object.
We can bind this model-specific format directly to the model if needed. Here’s an example:

import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4o" });

const modelWithTools = model.bind({
  tools: [
    {
      type: "function",
      function: {
        name: "calculator",
        description: "Can perform mathematical operations.",
        parameters: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              description: "The type of operation to execute.",
              enum: ["add", "subtract", "multiply", "divide"],
            },
            number1: { type: "number", description: "First integer" },
            number2: { type: "number", description: "Second integer" },
          },
          required: ["number1", "number2"],
        },
      },
    },
  ],
});

await modelWithTools.invoke(`Whats 119 times 8?`);

AIMessage {
  "id": "chatcmpl-9p1IeP7mIp3jPn1wgsP92zxEfNo7k",
  "content": "",
  "additional_kwargs": {
    "tool_calls": [
      {
        "id": "call_P5Xgyi0Y7IfisaUmyapZYT7d",
        "type": "function",
        "function": "[Object]"
      }
    ]
  },
  "response_metadata": {
    "tokenUsage": {
      "completionTokens": 24,
      "promptTokens": 85,
      "totalTokens": 109
    },
    "finish_reason": "tool_calls",
    "system_fingerprint": "fp_400f27fa1f"
  },
  "tool_calls": [
    {
      "name": "calculator",
      "args": {
        "operation": "multiply",
        "number1": 119,
        "number2": 8
      },
      "type": "tool_call",
      "id": "call_P5Xgyi0Y7IfisaUmyapZYT7d"
    }
  ],
  "invalid_tool_calls": [],
  "usage_metadata": {
    "input_tokens": 85,
    "output_tokens": 24,
    "total_tokens": 109
  }
}

This is functionally equivalent to the bind_tools() calls above.

