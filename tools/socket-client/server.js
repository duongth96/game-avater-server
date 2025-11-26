const net = require('net');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

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

// Hàm tạo một SessionHandler mới cho mỗi kết nối
function createSessionHandler() {
    let gameSessionKey = null; // To store the Session.key received from the game server
    let curR = 0; // Current read index for the key
    let curW = 0; // Current write index for the key
    let isConnectedToGameServer = false; // Flag to indicate if handshake is complete

    // Function to apply XOR encryption/decryption using the gameSessionKey
    function applyKey(byteValue, isRead) {
        if (!gameSessionKey) {
            return byteValue; // Should not happen if connectedToGameServer is true
        }
        const keyIndex = isRead ? curR : curW;
        const keyByte = gameSessionKey[keyIndex];
        const result = (keyByte ^ byteValue) & 0xFF; // Ensure result is a byte

        if (isRead) {
            curR = (curR + 1) % gameSessionKey.length;
        } else {
            curW = (curW + 1) % gameSessionKey.length;
        }
        return result;
    }

    // Function to encode message for Java server
    function encodeMessage(command, payload) {
        let commandByte = Buffer.alloc(1);
        commandByte.writeInt8(command, 0);

        if (isConnectedToGameServer) {
            commandByte.writeUInt8(applyKey(commandByte.readUInt8(0), false), 0);
        }

        let finalPayloadBuffer;

        finalPayloadBuffer = Buffer.alloc(0); // Initialize empty buffer
        if (payload) { // Only process if payload is not null or empty
            const dataSplit = payload.split('|'); // Use '|' as delimiter
            for (let i = 0; i < dataSplit.length; i++) {
                const dataBuffer = Buffer.from(dataSplit[i].trim(), 'utf8');
                const dataLengthBuffer = Buffer.alloc(2);
                dataLengthBuffer.writeUInt16BE(dataBuffer.length, 0);
                finalPayloadBuffer = Buffer.concat([finalPayloadBuffer, dataLengthBuffer, dataBuffer]);
            }
        }

        let payloadLengthBuffer = Buffer.alloc(2);
        payloadLengthBuffer.writeUInt16BE(finalPayloadBuffer.length, 0);

        if (isConnectedToGameServer) {
            payloadLengthBuffer.writeUInt8(applyKey(payloadLengthBuffer.readUInt8(0), false), 0);
            payloadLengthBuffer.writeUInt8(applyKey(payloadLengthBuffer.readUInt8(1), false), 1);
        }

        if (isConnectedToGameServer) {
            for (let i = 0; i < finalPayloadBuffer.length; i++) {
                finalPayloadBuffer.writeUInt8(applyKey(finalPayloadBuffer.readUInt8(i), false), i);
            }
        }

        return Buffer.concat([commandByte, payloadLengthBuffer, finalPayloadBuffer]);
    }

    // Function to decode message from Java server
    function decodeMessage(buffer) {
        if (buffer.length < 3) { // Minimum 1 byte command + 2 bytes length
            console.warn('Received incomplete message buffer:', buffer);
            return null;
        }

        let currentOffset = 0;

        // Decode command byte
        let commandByte = buffer.readInt8(currentOffset);
        currentOffset += 1;

        if (isConnectedToGameServer) {
            commandByte = applyKey(commandByte, true);
        }

        // Decode payload length
        let payloadLengthBuffer = Buffer.alloc(2);
        buffer.copy(payloadLengthBuffer, 0, currentOffset, currentOffset + 2);
        currentOffset += 2;

        if (isConnectedToGameServer) {
            payloadLengthBuffer.writeUInt8(applyKey(payloadLengthBuffer.readUInt8(0), true), 0);
            payloadLengthBuffer.writeUInt8(applyKey(payloadLengthBuffer.readUInt8(1), true), 1);
        }
        const payloadLength = payloadLengthBuffer.readUInt16BE(0);


        if (buffer.length < currentOffset + payloadLength) {
            console.warn('Received incomplete payload buffer:', buffer);
            return null;
        }

        let payloadBuffer = Buffer.alloc(payloadLength);
        buffer.copy(payloadBuffer, 0, currentOffset, currentOffset + payloadLength);

        if (isConnectedToGameServer) {
            for (let i = 0; i < payloadBuffer.length; i++) {
                payloadBuffer.writeUInt8(applyKey(payloadBuffer.readUInt8(i), true), i);
            }
        }

        const payload = payloadBuffer.toString('utf8');

        return { command: commandByte, payload };
    }

    return {
        gameSessionKey,
        curR,
        curW,
        isConnectedToGameServer,
        applyKey,
        encodeMessage,
        decodeMessage,
        setSessionKey: (key) => {
            gameSessionKey = key;
            curR = 0;
            curW = 0;
            isConnectedToGameServer = true;
        },
        setIsConnectedToGameServer: (status) => {
            isConnectedToGameServer = status;
        }
    };
}

wss.on('connection', (ws) => {
    console.log('Frontend WebSocket connected');

    const tcpClient = new net.Socket(); // Khởi tạo tcpClient ở đây
    const sessionHandler = createSessionHandler(); // Tạo một session handler mới cho mỗi kết nối
    wsToTcpMap.set(ws, tcpClient);

    tcpClient.connect(GAME_SERVER_PORT, GAME_SERVER_HOST, () => {
        console.log(`TCP Client connected to game server at ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}`);
        ws.send(JSON.stringify({ type: 'status', message: `Connected to game server: ${GAME_SERVER_HOST}:${GAME_SERVER_PORT}` }));
    });

    tcpClient.on('data', (data) => {
        // Handle handshake message (-27)
        if (!sessionHandler.isConnectedToGameServer && data.length > 0 && data.readInt8(0) === -27) {
            const keyLength = data.readUInt8(1);
            const firstKeyByte = data.readUInt8(2);
            const receivedKey = Buffer.alloc(keyLength);
            receivedKey.writeUInt8(firstKeyByte, 0);

            for (let i = 1; i < keyLength; i++) {
                receivedKey.writeUInt8(data.readUInt8(2 + i) ^ receivedKey.readUInt8(i - 1), i);
            }
            sessionHandler.setSessionKey(receivedKey);
            ws.send(JSON.stringify({ type: 'status', message: 'Connected to game server and handshake complete!' }));
            console.log('Game server handshake complete. Session Key:', sessionHandler.gameSessionKey.toString('hex'));
            return; // Handshake message processed
        }

        // Giải mã dữ liệu từ game server
        const decodedMessage = sessionHandler.decodeMessage(data);
        console.log('Decoded message from game server:', decodedMessage);
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
        sessionHandler.setIsConnectedToGameServer(false);
        // Có thể thử kết nối lại hoặc thông báo cho người dùng
    });

    tcpClient.on('error', (err) => {
        console.error('TCP Client error:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: `Game server error: ${err.message}` }));
        tcpClient.destroy(); // Đảm bảo socket được đóng
        sessionHandler.setIsConnectedToGameServer(false);
    });

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'send_to_game' && tcpClient.writable) {
                // Sử dụng encodeMessage để mã hóa command và payload
                const encodedBuffer = sessionHandler.encodeMessage(parsedMessage.command, parsedMessage.payload);
                if (encodedBuffer) {
                    tcpClient.write(encodedBuffer);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to encode message.' }));
                }
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