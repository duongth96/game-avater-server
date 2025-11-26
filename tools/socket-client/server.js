const net = require('net');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

// Define commands based on Cmd.java
const COMMANDS = {
    CHAT_TO: -6,
    LOGIN: -2,
    // Anh có thể thêm các command khác từ Cmd.java vào đây khi cần
};

// Function to encode message for Java server
function encodeMessage(command, payload) {
    const commandByte = Buffer.alloc(1);
    commandByte.writeInt8(command, 0);

    const payloadBuffer = Buffer.from(payload, 'utf8');
    const payloadLengthBuffer = Buffer.alloc(2);
    payloadLengthBuffer.writeUInt16BE(payloadBuffer.length, 0); // writeUTF uses 2-byte length prefix

    return Buffer.concat([commandByte, payloadLengthBuffer, payloadBuffer]);
}

// Function to decode message from Java server
function decodeMessage(buffer) {
    if (buffer.length < 3) { // Minimum 1 byte command + 2 bytes length
        console.warn('Received incomplete message buffer:', buffer);
        return null;
    }

    const command = buffer.readInt8(0);
    const payloadLength = buffer.readUInt16BE(1);

    if (buffer.length < 3 + payloadLength) {
        console.warn('Received incomplete payload buffer:', buffer);
        return null;
    }

    const payload = buffer.toString('utf8', 3, 3 + payloadLength);

    return { command, payload };
}


const GAME_SERVER_HOST = process.env.GAME_SERVER_HOST || 'localhost';
const GAME_SERVER_PORT = parseInt(process.env.GAME_SERVER_PORT, 10) || 12345;
const WEB_SERVER_PORT = parseInt(process.env.WEB_SERVER_PORT, 10) || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Phục vụ các file tĩnh từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Mapping giữa WebSocket client và TCP socket client
const wsToTcpMap = new Map(); // wsClient -> tcpClient

wss.on('connection', (ws) => {
    console.log('Frontend WebSocket connected');

    let tcpClient = new net.Socket();
    wsToTcpMap.set(ws, tcpClient);

    tcpClient.connect(GAME_SERVER_PORT, GAME_SERVER_HOST, () => {
        console.log(`TCP Client connected to game server at ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}`);
        ws.send(JSON.stringify({ type: 'status', message: `Connected to game server: ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}` }));
    });

    tcpClient.on('data', (data) => {
        // Giải mã dữ liệu từ game server
        const decodedMessage = decodeMessage(data);
        if (decodedMessage) {
            ws.send(JSON.stringify({ type: 'game_data', command: decodedMessage.command, message: decodedMessage.payload }));
        } else {
            console.warn('Failed to decode message from game server:', data);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to decode message from game server.' }));
        }
    });

    tcpClient.on('close', () => {
        console.log('TCP Client connection to game server closed');
        ws.send(JSON.stringify({ type: 'status', message: 'Connection to game server closed.' }));
        // Có thể thử kết nối lại hoặc thông báo cho người dùng
    });

    tcpClient.on('error', (err) => {
        console.error('TCP Client error:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: `Game server error: ${err.message}` }));
        tcpClient.destroy(); // Đảm bảo socket được đóng
    });

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'send_to_game' && tcpClient.writable) {
                // Sử dụng encodeMessage để mã hóa command và payload
                const encodedBuffer = encodeMessage(parsedMessage.command, parsedMessage.payload);
                tcpClient.write(encodedBuffer);
            } else if (!tcpClient.writable) {
                ws.send(JSON.stringify({ type: 'status', message: 'Not connected to game server.' }));
            }
        } catch (e) {
            console.error('Failed to parse message from frontend or encode:', e);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or encoding error.' }));
        }
    });

    ws.on('close', () => {
        console.log('Frontend WebSocket disconnected');
        const associatedTcpClient = wsToTcpMap.get(ws);
        if (associatedTcpClient) {
            associatedTcpClient.destroy(); // Đóng TCP socket khi WebSocket đóng
            wsToTcpMap.delete(ws);
        }
    });

    ws.on('error', (err) => {
        console.error('Frontend WebSocket error:', err.message);
    });
});

server.listen(WEB_SERVER_PORT, () => {
    console.log(`Web client server listening on http://localhost:${WEB_SERVER_PORT}`);
    console.log(`Game server target: ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}`);
});