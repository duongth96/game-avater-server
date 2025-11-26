const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesDiv = document.getElementById('messages');
const statusDiv = document.getElementById('status');

const WEB_SERVER_PORT = 3000; // Cổng của web client server (Node.js backend)
const ws = new WebSocket(`ws://localhost:${WEB_SERVER_PORT}`);

function appendMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add(`${type}-message`);
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Cuộn xuống cuối
}

ws.onopen = () => {
    appendMessage('Connected to WebSocket backend.', 'system');
    statusDiv.textContent = '';
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'status') {
        appendMessage(`System: ${data.message}`, 'system');
        statusDiv.textContent = '';
    } else if (data.type === 'game_data') {
        appendMessage(`Server (Cmd: ${data.command}): ${data.message}`, 'received');
    } else if (data.type === 'error') {
        appendMessage(`Error: ${data.message}`, 'system');
        statusDiv.textContent = `Error: ${data.message}`;
    }
};

ws.onclose = () => {
    appendMessage('Disconnected from WebSocket backend.', 'system');
    statusDiv.textContent = 'Disconnected. Please refresh to reconnect.';
};

ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    statusDiv.textContent = 'WebSocket error. Check console for details.';
};

sendButton.addEventListener('click', () => {
    sendMessage();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const command = parseInt(commandInput.value.trim(), 10);
    const payload = messageInput.value.trim();
    if (!isNaN(command) && payload && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'send_to_game', command: command, payload: payload }));
        appendMessage(`Client (Cmd: ${command}): ${payload}`, 'sent');
        commandInput.value = '';
        messageInput.value = '';
    } else if (ws.readyState !== WebSocket.OPEN) {
        statusDiv.textContent = 'Not connected to backend. Please wait or refresh.';
    } else {
        statusDiv.textContent = 'Invalid command (must be a number) or empty payload.';
    }
}