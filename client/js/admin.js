// 管理员后台逻辑

// 导入认证模块
import { isAdmin } from './auth.js';

// 检查认证状态并显示相应界面
export function checkAuth() {
	const loginPrompt = document.getElementById('login-prompt');
	const adminDashboard = document.getElementById('admin-dashboard');
	
	if (isAdmin()) {
		// 显示管理员后台
		loginPrompt.style.display = 'none';
		adminDashboard.style.display = '';
		
		// 初始化管理员后台功能
		initAdminDashboard();
	} else {
		// 显示登录提示
		loginPrompt.style.display = '';
		adminDashboard.style.display = 'none';
	}
}

// 初始化管理员后台功能
function initAdminDashboard() {
	// 初始化标签页切换
	initTabs();
	
	// 初始化群聊管理
	initChatManagement();
	
	// 初始化违禁词管理
	initWordFilter();
	
	// 初始化发布公告
	initAnnouncement();
	
	// 初始化违禁记录
	initViolationList();
	
	// 初始化返回聊天按钮
	const backToChatBtn = document.getElementById('back-to-chat-btn');
	backToChatBtn.addEventListener('click', () => {
		window.location.href = 'index.html';
	});
}

// 初始化标签页切换
function initTabs() {
	const tabBtns = document.querySelectorAll('.tab-btn');
	const tabContents = document.querySelectorAll('.tab-content');
	
	tabBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			// 移除所有活跃状态
			tabBtns.forEach(b => b.classList.remove('active'));
			tabContents.forEach(c => c.classList.remove('active'));
			
			// 添加当前按钮和内容的活跃状态
			btn.classList.add('active');
			const tabId = btn.dataset.tab;
			const tabContent = document.getElementById(tabId);
			if (tabContent) {
				tabContent.classList.add('active');
			}
		});
	});
}

// 初始化群聊管理
function initChatManagement() {
	const chatList = document.getElementById('chat-list');
	const chatView = document.getElementById('chat-view');
	const backToChatList = document.getElementById('back-to-chat-list');
	const currentChatName = document.getElementById('current-chat-name');
	const chatMessages = document.getElementById('chat-messages');
	const adminMessageInput = document.getElementById('admin-message');
	const sendAdminMessageBtn = document.getElementById('send-admin-message');
	
	// 模拟群聊数据
	const mockChats = [
		{ id: '1', name: '群聊1', members: 10, lastActive: '2小时前', hasViolation: true },
		{ id: '2', name: '群聊2', members: 5, lastActive: '1小时前', hasViolation: false },
		{ id: '3', name: '群聊3', members: 15, lastActive: '30分钟前', hasViolation: true },
		{ id: '4', name: '群聊4', members: 8, lastActive: '5分钟前', hasViolation: false }
	];
	
	// 渲染群聊列表
	function renderChatList() {
		chatList.innerHTML = '';
		
		mockChats.forEach(chat => {
			const chatItem = document.createElement('div');
			chatItem.className = `chat-item ${chat.hasViolation ? 'violated' : ''}`;
			chatItem.innerHTML = `
				<div class="chat-item-header">
					<span class="chat-item-name">${chat.name}</span>
					<span class="chat-item-info">${chat.members} 成员 · ${chat.lastActive}</span>
				</div>
			`;
			
			// 点击进入群聊详情
			chatItem.addEventListener('click', () => {
				openChatView(chat);
			});
			
			chatList.appendChild(chatItem);
		});
	}
	
	// 打开群聊详情
	function openChatView(chat) {
		currentChatName.textContent = chat.name;
		chatList.style.display = 'none';
		chatView.style.display = '';
		
		// 渲染聊天记录
		renderChatMessages(chat.id);
	}
	
	// 返回群聊列表
	backToChatList.addEventListener('click', () => {
		chatView.style.display = 'none';
		chatList.style.display = '';
	});
	
	// 渲染聊天记录
	function renderChatMessages(chatId) {
		chatMessages.innerHTML = '';
		
		// 模拟聊天记录
		const mockMessages = [
			{ id: '1', user: '用户1', content: '大家好！', timestamp: '10:00' },
			{ id: '2', user: '用户2', content: '你好！', timestamp: '10:01' },
			{ id: '3', user: '用户3', content: '欢迎加入！', timestamp: '10:02' }
		];
		
		mockMessages.forEach(msg => {
			const messageDiv = document.createElement('div');
			messageDiv.className = 'user-chat-message';
			messageDiv.innerHTML = `
				<div style="font-weight: bold; margin-bottom: 5px;">${msg.user}</div>
				<div>${msg.content}</div>
				<div style="font-size: 12px; color: #909399; text-align: right; margin-top: 5px;">${msg.timestamp}</div>
			`;
			chatMessages.appendChild(messageDiv);
		});
	}
	
	// 发送管理员消息
	sendAdminMessageBtn.addEventListener('click', () => {
		const message = adminMessageInput.value.trim();
		if (!message) return;
		
		const messageDiv = document.createElement('div');
		messageDiv.className = 'admin-chat-message';
		messageDiv.innerHTML = `
			<div style="font-weight: bold; margin-bottom: 5px;">管理员</div>
			<div>${message}</div>
			<div style="font-size: 12px; color: #909399; text-align: right; margin-top: 5px;">${new Date().toLocaleTimeString()}</div>
		`;
		chatMessages.appendChild(messageDiv);
		chatMessages.scrollTop = chatMessages.scrollHeight;
		
		adminMessageInput.value = '';
	});
	
	// 回车键发送消息
	adminMessageInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			sendAdminMessageBtn.click();
		}
	});
	
	// 初始渲染群聊列表
	renderChatList();
}

// 初始化违禁词管理
function initWordFilter() {
	// 从localStorage获取违禁词列表
	let forbiddenWords = JSON.parse(localStorage.getItem('forbiddenWords') || '[]');
	
	// 渲染违禁词列表
	renderWordList(forbiddenWords);
	
	// 获取DOM元素
	const addWordBtn = document.getElementById('add-word-btn');
	const newWordInput = document.getElementById('new-word');
	const wordList = document.getElementById('word-list');
	const saveSettingsBtn = document.getElementById('save-settings-btn');
	const statusMessage = document.getElementById('status-message');
	
	// 添加违禁词
	addWordBtn.addEventListener('click', () => {
		const newWordText = newWordInput.value.trim();
		if (!newWordText) {
			showStatus('请输入要添加的违禁词', 'error');
			return;
		}
		
		// 支持用逗号分隔多个违禁词
		const newWords = newWordText.split(',').map(word => word.trim()).filter(word => word !== '');
		
		let addedCount = 0;
		let duplicateCount = 0;
		
		newWords.forEach(word => {
			if (!forbiddenWords.includes(word)) {
				forbiddenWords.push(word);
				addedCount++;
			} else {
				duplicateCount++;
			}
		});
		
		newWordInput.value = '';
		renderWordList(forbiddenWords);
		
		if (addedCount > 0) {
			showStatus(`成功添加 ${addedCount} 个违禁词`, 'success');
		}
		if (duplicateCount > 0) {
			showStatus(`有 ${duplicateCount} 个违禁词已存在，未重复添加`, 'error');
		}
	});
	
	// 回车键添加违禁词
	newWordInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			addWordBtn.click();
		}
	});
	
	// 保存设置
	saveSettingsBtn.addEventListener('click', () => {
		localStorage.setItem('forbiddenWords', JSON.stringify(forbiddenWords));
		showStatus('设置保存成功', 'success');
		
		// 保存到localStorage后，触发全局事件，通知所有客户端更新违禁词列表
		window.dispatchEvent(new Event('forbiddenWordsUpdated'));
	});
	
	// 显示状态消息
	function showStatus(message, type) {
		statusMessage.textContent = message;
		statusMessage.className = `status-message status-${type}`;
		statusMessage.style.display = '';
		
		// 3秒后自动隐藏
		setTimeout(() => {
			statusMessage.style.display = 'none';
		}, 3000);
	}
	
	// 渲染违禁词列表
	function renderWordList(words) {
		wordList.innerHTML = '';
		
		if (words.length === 0) {
			wordList.innerHTML = '<p style="color: #909399; font-size: 14px;">暂无违禁词</p>';
			return;
		}
		
		words.forEach(word => {
			const wordItem = document.createElement('div');
			wordItem.className = 'word-item';
			wordItem.innerHTML = `
				<span>${word}</span>
				<button class="delete-word-btn" title="删除">×</button>
			`;
			
			// 删除违禁词
			const deleteBtn = wordItem.querySelector('.delete-word-btn');
			deleteBtn.addEventListener('click', () => {
				forbiddenWords = forbiddenWords.filter(w => w !== word);
				renderWordList(forbiddenWords);
				showStatus('违禁词删除成功', 'success');
			});
			
			wordList.appendChild(wordItem);
		});
	}
}

// 初始化发布公告
function initAnnouncement() {
	const publishAnnouncementBtn = document.getElementById('publish-announcement');
	const announcementContent = document.getElementById('announcement-content');
	const statusMessage = document.getElementById('status-message');
	
	publishAnnouncementBtn.addEventListener('click', () => {
		const content = announcementContent.value.trim();
		if (!content) {
			showStatus('请输入公告内容', 'error');
			return;
		}
		
		// 模拟发布公告
		showStatus('公告发布成功', 'success');
		announcementContent.value = '';
	});
	
	// 显示状态消息
	function showStatus(message, type) {
		statusMessage.textContent = message;
		statusMessage.className = `status-message status-${type}`;
		statusMessage.style.display = '';
		
		// 3秒后自动隐藏
		setTimeout(() => {
			statusMessage.style.display = 'none';
		}, 3000);
	}
}

// 初始化违禁记录
function initViolationList() {
	const violationListContainer = document.getElementById('violation-list-container');
	
	// 模拟违禁记录数据
	const mockViolations = [
		{
			id: '1',
			chatName: '群聊1',
			user: '用户1',
			content: '这是一条包含违禁词的消息',
			forbiddenWord: '违禁词',
			timestamp: '2小时前',
			status: '未处理'
		},
		{
			id: '2',
			chatName: '群聊3',
			user: '用户2',
			content: '这条消息也包含了违禁词',
			forbiddenWord: '违禁词',
			timestamp: '1小时前',
			status: '未处理'
		}
	];
	
	// 渲染违禁记录
	function renderViolationList() {
		violationListContainer.innerHTML = '';
		
		if (mockViolations.length === 0) {
			violationListContainer.innerHTML = '<p style="color: #909399; font-size: 14px;">暂无违禁记录</p>';
			return;
		}
		
		mockViolations.forEach(violation => {
			const violationItem = document.createElement('div');
			violationItem.className = 'violation-item';
			violationItem.innerHTML = `
				<div class="violation-header">
					<div>
						<div style="font-weight: bold; margin-bottom: 5px;">${violation.chatName} - ${violation.user}</div>
						<div class="violation-info">违禁词: ${violation.forbiddenWord} · ${violation.timestamp}</div>
					</div>
					<div style="color: ${violation.status === '未处理' ? '#ff4d4f' : '#67c23a'};">${violation.status}</div>
				</div>
				<div class="violation-content">
					<div style="margin-bottom: 5px;">违规内容:</div>
					<div>${violation.content}</div>
				</div>
				<div class="violation-actions">
					<button class="cancel-violation-btn" data-id="${violation.id}">取消违禁</button>
				</div>
			`;
			
			// 取消违禁按钮点击事件
			const cancelBtn = violationItem.querySelector('.cancel-violation-btn');
			cancelBtn.addEventListener('click', () => {
				const violationId = cancelBtn.dataset.id;
				const violation = mockViolations.find(v => v.id === violationId);
				if (violation) {
					violation.status = '已取消';
					renderViolationList();
				}
			});
			
			violationListContainer.appendChild(violationItem);
		});
	}
	
	// 初始渲染违禁记录
	renderViolationList();
}

// 检查消息是否包含违禁词
export function checkForbiddenWords(message) {
	const forbiddenWords = JSON.parse(localStorage.getItem('forbiddenWords') || '[]');
	if (!forbiddenWords || forbiddenWords.length === 0) {
		return { allowed: true };
	}
	
	// 检查消息是否包含任何违禁词
	for (const word of forbiddenWords) {
		if (message.includes(word)) {
			return { allowed: false, forbiddenWord: word };
		}
	}
	
	return { allowed: true };
}

// 过滤消息中的违禁词
export function filterMessage(message) {
	let filteredMessage = message;
	const forbiddenWords = JSON.parse(localStorage.getItem('forbiddenWords') || '[]');
	
	// 替换所有违禁词为同等长度的*号
	for (const word of forbiddenWords) {
		const regex = new RegExp(word, 'gi');
		filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
	}
	
	return filteredMessage;
}

// 监听违禁词更新事件
window.addEventListener('forbiddenWordsUpdated', () => {
	console.log('Forbidden words updated');
});

// 监听聊天记录自动删除事件
setInterval(() => {
	// 模拟聊天记录自动删除逻辑
	console.log('Checking for expired chat records...');
	// 这里可以添加实际的自动删除逻辑
}, 24 * 60 * 60 * 1000); // 每天检查一次
