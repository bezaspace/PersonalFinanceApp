# @google/genailiveLive

## Class: `Live` (Experimental)

Live class encapsulates the configuration for live interaction with the Generative Language API. It embeds `ApiClient` for general API settings.

**Defined in:** `src/live.ts:76`

---

### Constructors

#### constructor

```ts
new Live(
  apiClient: ApiClient,
  auth: Auth,
  webSocketFactory: WebSocketFactory,
): Live
```
**Experimental**

- **Parameters:**
  - `apiClient: ApiClient`
  - `auth: Auth`
  - `webSocketFactory: WebSocketFactory`
- **Returns:** `Live`
- **Defined in:** `src/live.ts:79`

---

### Properties

#### music

```ts
music: LiveMusic
```
**Readonly**  
**Experimental**  
**Defined in:** `src/live.ts:77`

---

### Methods

#### connect

```ts
connect(params: LiveConnectParameters): Promise<Session>
```
**Experimental**  
Establishes a connection to the specified model with the given configuration and returns a `Session` object representing that connection.

- **Parameters:**  
  - `params: LiveConnectParameters`  
    The parameters for establishing a connection to the model.
- **Returns:**  
  - `Promise<Session>` — A live session.

**Remarks:**  
Built-in MCP support is an experimental feature, may change in future versions.

**Example:**
```ts
let model: string;
if (GOOGLE_GENAI_USE_VERTEXAI) {
  model = 'gemini-2.0-flash-live-preview-04-09';
} else {
  model = 'gemini-2.0-flash-live-001';
}
const session = await ai.live.connect({
  model: model,
  config: {
    responseModalities: [Modality.AUDIO],
  },
  callbacks: {
    onopen: () => {
      console.log('Connected to the socket.');
    },
    onmessage: (e: MessageEvent) => {
      console.log('Received message from the server: %s\n', debug(e.data));
    },
    onerror: (e: ErrorEvent) => {
      console.log('Error occurred: %s\n', debug(e.error));
    },
    onclose: (e: CloseEvent) => {
      console.log('Connection closed.');
    },
  },
});
```
**Defined in:** `src/live.ts:133`

---

# @google/genailiveSession

## Class: `Session` (Experimental)

Represents a connection to the API.

**Defined in:** `src/live.ts:289`

---

### Constructors

#### constructor

```ts
new Session(conn: WebSocket, apiClient: ApiClient): Session
```
**Experimental**

- **Parameters:**
  - `conn: WebSocket`
  - `apiClient: ApiClient`
- **Returns:** `Session`
- **Defined in:** `src/live.ts:290`

---

### Properties

#### conn

```ts
conn: WebSocket
```
**Readonly**  
**Experimental**  
**Defined in:** `src/live.ts:291`

---

### Methods

#### close

```ts
close(): void
```
**Experimental**  
Terminates the WebSocket connection.

- **Returns:** `void`

**Example:**
```ts
let model: string;
if (GOOGLE_GENAI_USE_VERTEXAI) {
  model = 'gemini-2.0-flash-live-preview-04-09';
} else {
  model = 'gemini-2.0-flash-live-001';
}
const session = await ai.live.connect({
  model: model,
  config: {
    responseModalities: [Modality.AUDIO],
  }
});

session.close();
```
**Defined in:** `src/live.ts:513`

---

#### sendClientContent

```ts
sendClientContent(params: LiveSendClientContentParameters): void
```
**Experimental**  
Send a message over the established connection.

- **Parameters:**  
  - `params: LiveSendClientContentParameters`  
    Contains two optional properties, `turns` and `turnComplete`.
    - `turns` will be converted to a `Content[]`
    - `turnComplete: true` [default] indicates that you are done sending content and expect a response. If `turnComplete: false`, the server will wait for additional messages before starting generation.
- **Returns:** `void`

**Remarks:**  
There are two ways to send messages to the live API: `sendClientContent` and `sendRealtimeInput`.

- `sendClientContent` messages are added to the model context in order. Having a conversation using `sendClientContent` messages is roughly equivalent to using the `Chat.sendMessageStream`, except that the state of the chat history is stored on the API server instead of locally.
- Because of `sendClientContent`'s order guarantee, the model cannot respond as quickly to `sendClientContent` messages as to `sendRealtimeInput` messages. This makes the biggest difference when sending objects that have significant preprocessing time (typically images).
- The `sendClientContent` message sends a `Content[]` which has more options than the `Blob` sent by `sendRealtimeInput`.

**Main use-cases for `sendClientContent` over `sendRealtimeInput`:**
- Sending anything that can't be represented as a Blob (text, `sendClientContent({turns="Hello?"})`).
- Managing turns when not using audio input and voice activity detection. (`sendClientContent({turnComplete:true})` or the short form `sendClientContent()`)
- Prefilling a conversation context

**Example:**
```ts
sendClientContent({
  turns: [
    Content({role:user, parts:...}),
    Content({role:user, parts:...}),
    ...
  ]
})
```
**Defined in:** `src/live.ts:414`

---

#### sendRealtimeInput

```ts
sendRealtimeInput(params: LiveSendRealtimeInputParameters): void
```
**Experimental**  
Send a realtime message over the established connection.

- **Parameters:**  
  - `params: LiveSendRealtimeInputParameters`  
    Contains one property, `media`.
    - `media` will be converted to a `Blob`
- **Returns:** `void`

**Remarks:**  
Use `sendRealtimeInput` for realtime audio chunks and video frames (images).

- With `sendRealtimeInput` the API will respond to audio automatically based on voice activity detection (VAD).
- `sendRealtimeInput` is optimized for responsiveness at the expense of deterministic ordering guarantees. Audio and video tokens are added to the context when they become available.

**Note:** The call signature expects a `Blob` object, but only a subset of audio and image mimetypes are allowed.

**Defined in:** `src/live.ts:449`

---

#### sendToolResponse

```ts
sendToolResponse(params: LiveSendToolResponseParameters): void
```
**Experimental**  
Send a function response message over the established connection.

- **Parameters:**  
  - `params: LiveSendToolResponseParameters`  
    Contains property `functionResponses`.
    - `functionResponses` will be converted to a `functionResponses[]`
- **Returns:** `void`

**Remarks:**  
- Use `sendFunctionResponse` to reply to `LiveServerToolCall` from the server.
- Use `types.LiveConnectConfig#tools` to configure the callable functions.

**Defined in:** `src/live.ts:480`
