import { generateClientId, encryptMessage, decryptMessage, logEvent, isString, isObject, getTime } from './utils.js';

// Cloud Mail密码验证工具函数
const saltHashUtils = {
  generateSalt(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  },
  
  async genHashPassword(password, salt) {
    const data = new TextEncoder().encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashArray));
  },
  
  async verifyPassword(inputPassword, salt, storedHash) {
    const hash = await this.genHashPassword(inputPassword, salt);
    return hash === storedHash;
  }
};

// Cloud Mail登录验证处理函数
async function handleCloudMailLogin(request, env) {
  try {
    // 解析请求体
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 查询D1数据库获取用户信息
    // 注意：这里使用的是cloud-mail的user表结构
    const stmt = env.DB.prepare('SELECT * FROM user WHERE email = ? AND is_del = 0');
    const result = await stmt.bind(email).first();
    
    if (!result) {
      return new Response(JSON.stringify({ success: false, message: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 验证密码
    const isPasswordValid = await saltHashUtils.verifyPassword(password, result.salt, result.password);
    
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 检查用户状态
    if (result.status === 1) {
      return new Response(JSON.stringify({ success: false, message: 'User is banned' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 登录成功，返回用户信息
    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: result.user_id,
        email: result.email,
        // 使用email作为昵称
        nickname: result.email.split('@')[0]
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Cloud Mail login error:', error);
    return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 检查是否为管理员
function isAdmin(email) {
  // 允许admin@admin.admin访问
  return email === 'admin@admin.admin';
}

// 管理员API权限验证
async function verifyAdminAuth(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { success: false, response: new Response(JSON.stringify({ success: false, message: 'Authorization header required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }
  
  try {
    // 解析Authorization头
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return { success: false, response: new Response(JSON.stringify({ success: false, message: 'Invalid Authorization header format' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
    
    const token = parts[1];
    let decoded;
    try {
      decoded = JSON.parse(atob(token));
    } catch (decodeError) {
      return { success: false, response: new Response(JSON.stringify({ success: false, message: 'Invalid token format' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
    
    // 检查是否包含email字段
    if (!decoded || !decoded.email) {
      return { success: false, response: new Response(JSON.stringify({ success: false, message: 'Token missing email field' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
    
    // 检查是否为管理员
    if (!isAdmin(decoded.email)) {
      return { success: false, response: new Response(JSON.stringify({ success: false, message: 'Admin permission required' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) };
    }
    
    return { success: true, decoded };
  } catch (error) {
    console.error('Admin auth error:', error);
    return { success: false, response: new Response(JSON.stringify({ success: false, message: 'Internal authentication error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理WebSocket请求
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader === 'websocket') {
      const id = env.CHAT_ROOM.idFromName('chat-room');
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    // 处理API请求
    if (url.pathname.startsWith('/api/')) {
      // Cloud Mail登录验证API
      if (url.pathname === '/api/cloud-mail/login' && request.method === 'POST') {
        return handleCloudMailLogin(request, env);
      }
      
      // 管理员API
      if (url.pathname.startsWith('/api/admin/')) {
        // 验证管理员权限
        const authResult = await verifyAdminAuth(request);
        if (!authResult.success) {
          return authResult.response;
        }
        
        // 获取群聊列表
        if (url.pathname === '/api/admin/channels' && request.method === 'GET') {
          const id = env.CHAT_ROOM.idFromName('chat-room');
          const stub = env.CHAT_ROOM.get(id);
          return stub.fetch(new Request('http://localhost/api/admin/channels', { method: 'GET' }));
        }
        
        // 删除群聊
        if (url.pathname.match(/^\/api\/admin\/channels\/[^\/]+$/) && request.method === 'DELETE') {
          const channelId = url.pathname.split('/').pop();
          const id = env.CHAT_ROOM.idFromName('chat-room');
          const stub = env.CHAT_ROOM.get(id);
          return stub.fetch(new Request(`http://localhost/api/admin/channels/${channelId}`, { method: 'DELETE' }));
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    // 其余全部交给 ASSETS 处理（自动支持 hash 文件名和 SPA fallback）
    return env.ASSETS.fetch(request);
  }
};

export class ChatRoom {  constructor(state, env) {
		this.state = state;
		
		// Use objects like original server.js instead of Maps
		this.clients = {};
		this.channels = {};
		
		// 存储公告和违禁记录
		this.announcements = [];
		this.violations = [];
		// 存储群聊消息记录
		this.chatMessages = {};
		
		this.config = {
			seenTimeout: 60000,
			debug: false
		};
		
		// Initialize RSA key pair
		this.initRSAKeyPair();
	}

  async initRSAKeyPair() {
    try {
      let stored = await this.state.storage.get('rsaKeyPair');
      if (!stored) {
        console.log('Generating new RSA keypair...');
          const keyPair = await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
          },
          true,
          ['sign', 'verify']
        );

        // 并行导出公钥和私钥以提高性能
        const [publicKeyBuffer, privateKeyBuffer] = await Promise.all([
          crypto.subtle.exportKey('spki', keyPair.publicKey),
          crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
        ]);
        
        stored = {
          rsaPublic: btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer))),
          rsaPrivateData: Array.from(new Uint8Array(privateKeyBuffer)),
          createdAt: Date.now() // 记录密钥创建时间，用于后续判断是否需要轮换
        };
        
        await this.state.storage.put('rsaKeyPair', stored);
        console.log('RSA key pair generated and stored');
      }
      
      // Reconstruct the private key
      if (stored.rsaPrivateData) {
        const privateKeyBuffer = new Uint8Array(stored.rsaPrivateData);
        
        stored.rsaPrivate = await crypto.subtle.importKey(
          'pkcs8',
          privateKeyBuffer,
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
          },
          false,
          ['sign']
        );      }
        this.keyPair = stored;
      
      // 检查密钥是否需要轮换（如果已创建超过24小时）
      if (stored.createdAt && (Date.now() - stored.createdAt > 24 * 60 * 60 * 1000)) {
        // 如果没有任何客户端，则执行密钥轮换
        if (Object.keys(this.clients).length === 0) {
          console.log('密钥已使用24小时，进行轮换...');
          await this.state.storage.delete('rsaKeyPair');
          this.keyPair = null;
          await this.initRSAKeyPair();
        } else {
          // 否则标记需要在客户端全部断开后进行轮换
          await this.state.storage.put('pendingKeyRotation', true);
        }
      }
    } catch (error) {
      console.error('Error initializing RSA key pair:', error);
      throw error;
    }
  }

  async fetch(request) {
    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      // 处理HTTP API请求
      const url = new URL(request.url);
      
      // 管理员API：获取群聊列表
      if (url.pathname === '/api/admin/channels' && request.method === 'GET') {
        const channels = Object.keys(this.channels).map(channel => ({
          id: channel,
          name: channel, // 使用群聊ID作为名称，实际应用中可能需要单独存储名称
          members: this.channels[channel].length,
          lastActive: new Date().toISOString()
        }));
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            channels: channels
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      // 管理员API：删除群聊
      if (url.pathname.match(/^\/api\/admin\/channels\/[^\/]+$/) && request.method === 'DELETE') {
        const channelId = url.pathname.split('/').pop();
        
        if (this.channels[channelId]) {
          // 通知该群聊的所有成员
          for (const clientId of this.channels[channelId]) {
            const client = this.clients[clientId];
            if (client && client.connection && client.connection.readyState === 1) {
              try {
                const messageObj = {
                  a: 'channel_deleted',
                  p: `群聊 "${channelId}" 已被管理员删除`
                };
                const encrypted = encryptMessage(messageObj, client.shared);
                this.sendMessage(client.connection, encrypted);
                // 关闭连接
                client.connection.close();
              } catch (error) {
                logEvent('channel-delete-notify', [clientId, error], 'error');
              }
            }
          }
          
          // 删除群聊
          delete this.channels[channelId];
          
          return new Response(JSON.stringify({
            success: true,
            message: `群聊 "${channelId}" 已成功删除`
          }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            message: '群聊不存在'
          }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      // 管理员API：获取群聊消息
      if (url.pathname.match(/^\/api\/admin\/channels\/[^\/]+\/messages$/) && request.method === 'GET') {
        const channelId = url.pathname.split('/').slice(-2, -1)[0];
        const messages = this.chatMessages[channelId] || [];
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            messages: messages
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      // 管理员API：删除群聊消息
      if (url.pathname.match(/^\/api\/admin\/channels\/[^\/]+\/messages\/[^\/]+$/) && request.method === 'DELETE') {
        const pathParts = url.pathname.split('/');
        const channelId = pathParts[pathParts.length - 3];
        const messageId = pathParts[pathParts.length - 1];
        
        if (this.chatMessages[channelId]) {
          this.chatMessages[channelId] = this.chatMessages[channelId].filter(msg => msg.id !== messageId);
          
          return new Response(JSON.stringify({
            success: true,
            message: '消息删除成功'
          }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            message: '群聊不存在'
          }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      // 管理员API：清空群聊消息
      if (url.pathname.match(/^\/api\/admin\/channels\/[^\/]+\/messages$/) && request.method === 'DELETE') {
        const channelId = url.pathname.split('/').slice(-2, -1)[0];
        
        if (this.chatMessages[channelId]) {
          this.chatMessages[channelId] = [];
          
          return new Response(JSON.stringify({
            success: true,
            message: '消息清空成功'
          }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            message: '群聊不存在'
          }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      // 管理员API：发布公告
      if (url.pathname === '/api/admin/announcements' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { target, content } = body;
          
          // 生成公告ID
          const announcementId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
          
          // 保存公告
          const announcement = {
            id: announcementId,
            target: target,
            content: content,
            createdAt: new Date().toISOString()
          };
          this.announcements.push(announcement);
          
          // 通知目标群聊的成员
          if (target === 'all') {
            // 通知所有群聊成员
            for (const channelId in this.channels) {
              for (const clientId of this.channels[channelId]) {
                const client = this.clients[clientId];
                if (client && client.connection && client.connection.readyState === 1) {
                  try {
                    const messageObj = {
                      a: 'announcement',
                      p: content
                    };
                    const encrypted = encryptMessage(messageObj, client.shared);
                    this.sendMessage(client.connection, encrypted);
                  } catch (error) {
                    logEvent('announcement-notify', [clientId, error], 'error');
                  }
                }
              }
            }
          } else if (Array.isArray(target)) {
            // 通知特定群聊成员
            for (const channelId of target) {
              if (this.channels[channelId]) {
                for (const clientId of this.channels[channelId]) {
                  const client = this.clients[clientId];
                  if (client && client.connection && client.connection.readyState === 1) {
                    try {
                      const messageObj = {
                        a: 'announcement',
                        p: content
                      };
                      const encrypted = encryptMessage(messageObj, client.shared);
                      this.sendMessage(client.connection, encrypted);
                    } catch (error) {
                      logEvent('announcement-notify', [clientId, error], 'error');
                    }
                  }
                }
              }
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: '公告发布成功',
            data: announcement
          }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            message: '发布公告失败'
          }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      // 管理员API：获取违禁记录
      if (url.pathname === '/api/admin/violations' && request.method === 'GET') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            violations: this.violations
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      // 管理员API：处理违禁记录
      if (url.pathname.match(/^\/api\/admin\/violations\/[^\/]+$/) && request.method === 'PUT') {
        const violationId = url.pathname.split('/').pop();
        const violation = this.violations.find(v => v.id === violationId);
        
        if (violation) {
          violation.status = '已处理';
          
          return new Response(JSON.stringify({
            success: true,
            message: '违禁记录处理成功',
            data: violation
          }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            message: '违禁记录不存在'
          }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }

    // Ensure RSA keys are initialized
    if (!this.keyPair) {
      await this.initRSAKeyPair();
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }  // WebSocket connection event handler
  async handleSession(connection) {    connection.accept();

    // 清理旧连接
    await this.cleanupOldConnections();

    const clientId = generateClientId();

    if (!clientId || this.clients[clientId]) {
      this.closeConnection(connection);
      return;
    }

    logEvent('connection', clientId, 'debug');    // Store client information
    this.clients[clientId] = {
      connection: connection,
      seen: getTime(),
      key: null,
      shared: null,
      channel: null
    };

    // Send RSA public key
    try {
      logEvent('sending-public-key', clientId, 'debug');
      this.sendMessage(connection, JSON.stringify({
        type: 'server-key',
        key: this.keyPair.rsaPublic
      }));
    } catch (error) {
      logEvent('sending-public-key', error, 'error');
    }    // Handle messages
    connection.addEventListener('message', async (event) => {
      const message = event.data;

      if (!isString(message) || !this.clients[clientId]) {
        return;
      }

      this.clients[clientId].seen = getTime();

      if (message === 'ping') {
        this.sendMessage(connection, 'pong');
        return;
      }

      logEvent('message', [clientId, message], 'debug');      // Handle key exchange
      if (!this.clients[clientId].shared && message.length < 2048) {
        try {
          // Generate ECDH key pair using P-384 curve (equivalent to secp384r1)
          const keys = await crypto.subtle.generateKey(
            {
              name: 'ECDH',
              namedCurve: 'P-384'
            },
            true,
            ['deriveBits', 'deriveKey']
          );

          const publicKeyBuffer = await crypto.subtle.exportKey('raw', keys.publicKey);
          
          // Sign the public key using PKCS1 padding (compatible with original)
          const signature = await crypto.subtle.sign(
            {
              name: 'RSASSA-PKCS1-v1_5'
            },
            this.keyPair.rsaPrivate,
            publicKeyBuffer
          );

          // Convert hex string to Uint8Array for client public key
          const clientPublicKeyHex = message;
          const clientPublicKeyBytes = new Uint8Array(clientPublicKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
          
          // Import client's public key
          const clientPublicKey = await crypto.subtle.importKey(
            'raw',
            clientPublicKeyBytes,
            { name: 'ECDH', namedCurve: 'P-384' },
            false,
            []
          );

          // Derive shared secret bits (equivalent to computeSecret in Node.js)
          const sharedSecretBits = await crypto.subtle.deriveBits(
            {
              name: 'ECDH',
              public: clientPublicKey
            },
            keys.privateKey,
            384 // P-384 produces 48 bytes (384 bits)
          );          // Take bytes 8-40 (32 bytes) for AES-256 key
          this.clients[clientId].shared = new Uint8Array(sharedSecretBits).slice(8, 40);

          const response = Array.from(new Uint8Array(publicKeyBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('') + 
            '|' + btoa(String.fromCharCode(...new Uint8Array(signature)));
          
          this.sendMessage(connection, response);

        } catch (error) {
          logEvent('message-key', [clientId, error], 'error');
          this.closeConnection(connection);
        }

        return;
      }

      // Handle encrypted messages
      if (this.clients[clientId].shared && message.length <= (8 * 1024 * 1024)) {
        this.processEncryptedMessage(clientId, message);
      }
    });    // Handle connection close
    connection.addEventListener('close', async (event) => {
      logEvent('close', [clientId, event], 'debug');

      const channel = this.clients[clientId].channel;

      if (channel && this.channels[channel]) {
        this.channels[channel].splice(this.channels[channel].indexOf(clientId), 1);

        if (this.channels[channel].length === 0) {
          delete(this.channels[channel]);
        } else {
          try {
            const members = this.channels[channel];

            for (const member of members) {
              const client = this.clients[member];              if (this.isClientInChannel(client, channel)) {
                this.sendMessage(client.connection, encryptMessage({
                  a: 'l',
                  p: members.filter((value) => {
                    return (value !== member ? true : false);
                  })
                }, client.shared));
              }
            }

          } catch (error) {
            logEvent('close-list', [clientId, error], 'error');
          }
        }
      }

      if (this.clients[clientId]) {
        delete(this.clients[clientId]);
      }
    });
  }
  // Process encrypted messages
  processEncryptedMessage(clientId, message) {
    let decrypted = null;

    try {
      decrypted = decryptMessage(message, this.clients[clientId].shared);

      logEvent('message-decrypted', [clientId, decrypted], 'debug');

      if (!isObject(decrypted) || !isString(decrypted.a)) {
        return;
      }

      const action = decrypted.a;

      if (action === 'j') {
        this.handleJoinChannel(clientId, decrypted);
      } else if (action === 'c') {
        this.handleClientMessage(clientId, decrypted);
      } else if (action === 'w') {
        this.handleChannelMessage(clientId, decrypted);
      }

    } catch (error) {
      logEvent('process-encrypted-message', [clientId, error], 'error');
    } finally {
      decrypted = null;
    }
  }
  // Handle channel join requests
  handleJoinChannel(clientId, decrypted) {
    if (!isString(decrypted.p) || this.clients[clientId].channel) {
      return;
    }

    try {
      const channel = decrypted.p;

      this.clients[clientId].channel = channel;

      if (!this.channels[channel]) {
        this.channels[channel] = [clientId];
      } else {
        this.channels[channel].push(clientId);
      }

      this.broadcastMemberList(channel);

    } catch (error) {
      logEvent('message-join', [clientId, error], 'error');
    }
  }
  // Handle client messages
  handleClientMessage(clientId, decrypted) {
    if (!isString(decrypted.p) || !isString(decrypted.c) || !this.clients[clientId].channel) {
      return;
    }

    try {
      const channel = this.clients[clientId].channel;
      const targetClient = this.clients[decrypted.c];

      if (this.isClientInChannel(targetClient, channel)) {
        const messageObj = {
          a: 'c',
          p: decrypted.p,
          c: clientId
        };

        const encrypted = encryptMessage(messageObj, targetClient.shared);
        this.sendMessage(targetClient.connection, encrypted);

        messageObj.p = null;
      }

    } catch (error) {
      logEvent('message-client', [clientId, error], 'error');
    }
  }  // Handle channel messages
  handleChannelMessage(clientId, decrypted) {
    if (!isObject(decrypted.p) || !this.clients[clientId].channel) {
      return;
    }
    
    try {
      const channel = this.clients[clientId].channel;
      // 过滤有效的目标成员
      const validMembers = Object.keys(decrypted.p).filter(member => {
        const targetClient = this.clients[member];
        return isString(decrypted.p[member]) && this.isClientInChannel(targetClient, channel);
      });

      // 保存消息到群聊记录
      for (const member of validMembers) {
        const messageContent = decrypted.p[member];
        // 生成消息ID
        const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        
        // 创建消息对象
        const message = {
          id: messageId,
          userId: clientId,
          content: messageContent,
          timestamp: new Date().toISOString(),
          type: 'channel'
        };
        
        // 保存到群聊消息记录
        if (!this.chatMessages[channel]) {
          this.chatMessages[channel] = [];
        }
        this.chatMessages[channel].push(message);
        
        // 检查违禁词（这里简化处理，实际应该从数据库或配置中获取违禁词列表）
        const forbiddenWords = ['违禁词', '敏感词', '不良内容'];
        const hasForbiddenWord = forbiddenWords.some(word => messageContent.includes(word));
        
        if (hasForbiddenWord) {
          // 生成违禁记录
          const violationId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
          const violation = {
            id: violationId,
            chatName: channel,
            user: clientId,
            content: messageContent,
            forbiddenWord: forbiddenWords.find(word => messageContent.includes(word)),
            timestamp: new Date().toISOString(),
            status: '未处理'
          };
          this.violations.push(violation);
        }
      }

      // 处理所有有效的目标成员
      for (const member of validMembers) {
        const targetClient = this.clients[member];
        const messageObj = {
          a: 'c',
          p: decrypted.p[member],
          c: clientId
        };
        const encrypted = encryptMessage(messageObj, targetClient.shared);
        this.sendMessage(targetClient.connection, encrypted);

        messageObj.p = null;
      }

    } catch (error) {
      logEvent('message-channel', [clientId, error], 'error');
    }
  }
  // Broadcast member list to channel
  broadcastMemberList(channel) {
    try {
      const members = this.channels[channel];

      for (const member of members) {
        const client = this.clients[member];

        if (this.isClientInChannel(client, channel)) {
          const messageObj = {
            a: 'l',
            p: members.filter((value) => {
              return (value !== member ? true : false);
            })
          };

          const encrypted = encryptMessage(messageObj, client.shared);
          this.sendMessage(client.connection, encrypted);

          messageObj.p = null;
        }
      }
    } catch (error) {
      logEvent('broadcast-member-list', error, 'error');
    }
  }  // Check if client is in channel
  isClientInChannel(client, channel) {
    return (
      client &&
      client.connection &&
      client.shared &&
      client.channel &&
      client.channel === channel ?
      true :
      false
    );
  }
  // Send message helper
  sendMessage(connection, message) {
    try {
      // In Cloudflare Workers, WebSocket.READY_STATE_OPEN is 1
      if (connection.readyState === 1) {
        connection.send(message);
      }
    } catch (error) {
      logEvent('sendMessage', error, 'error');
    }
  }  // Close connection helper
  closeConnection(connection) {
    try {
      connection.close();    } catch (error) {
      logEvent('closeConnection', error, 'error');
    }
  }
  
  // 连接清理方法
  async cleanupOldConnections() {
    const seenThreshold = getTime() - this.config.seenTimeout;
    const clientsToRemove = [];

    // 先收集需要移除的客户端，避免在迭代时修改对象
    for (const clientId in this.clients) {
      if (this.clients[clientId].seen < seenThreshold) {
        clientsToRemove.push(clientId);
      }
    }

    // 然后一次性移除所有过期客户端
    for (const clientId of clientsToRemove) {
      try {
        logEvent('connection-seen', clientId, 'debug');
        this.clients[clientId].connection.close();
        delete this.clients[clientId];
      } catch (error) {
        logEvent('connection-seen', error, 'error');      }
    }
    
    // 如果没有任何客户端和房间，检查是否需要轮换密钥
    if (Object.keys(this.clients).length === 0 && Object.keys(this.channels).length === 0) {
      const pendingRotation = await this.state.storage.get('pendingKeyRotation');
      if (pendingRotation) {
        console.log('没有活跃客户端或房间，执行密钥轮换...');
        await this.state.storage.delete('rsaKeyPair');        await this.state.storage.delete('pendingKeyRotation');
        this.keyPair = null;
        await this.initRSAKeyPair();
      }
    }
    
    return clientsToRemove.length; // 返回清理的连接数量
  }
}
