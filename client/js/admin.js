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
	
	// 添加群聊记录管理功能
	const chatManagementSection = document.createElement('div');
	chatManagementSection.className = 'chat-management-section';
	chatManagementSection.innerHTML = `
		<div class="chat-management-header">
			<h3>群聊记录管理</h3>
			<div class="chat-management-actions">
				<label><input type="checkbox" id="select-all-messages"> 全选</label>
				<button id="delete-selected-messages" style="margin-left: 10px; background-color: #ff4d4f; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer;">删除选中记录</button>
				<button id="delete-all-messages" style="margin-left: 10px; background-color: #ff7875; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer;">清空所有记录</button>
			</div>
		</div>
	`;
	chatView.insertBefore(chatManagementSection, chatMessages);
	
	// 获取当前用户信息
	function getCurrentUser() {
		return JSON.parse(localStorage.getItem('user')) || {};
	}
	
	// 获取认证Token
	function getAuthToken() {
		const user = getCurrentUser();
		return btoa(JSON.stringify(user));
	}
	
	// 获取群聊列表
	async function fetchChatList() {
		try {
			const response = await fetch('/api/admin/channels', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${getAuthToken()}`,
					'Content-Type': 'application/json'
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to fetch chat list');
			}
			
			const data = await response.json();
			return data.success ? data.data.channels : [];
		} catch (error) {
			console.error('Error fetching chat list:', error);
			return [];
		}
	}
	
	// 删除群聊
	async function deleteChat(chatId) {
		try {
			const response = await fetch(`/api/admin/channels/${chatId}`, {
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${getAuthToken()}`,
					'Content-Type': 'application/json'
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to delete chat');
			}
			
			const data = await response.json();
			return data.success;
		} catch (error) {
			console.error('Error deleting chat:', error);
			return false;
		}
	}
	
	// 渲染群聊列表
	async function renderChatList() {
		chatList.innerHTML = '<p style="color: #909399; font-size: 14px; text-align: center; padding: 20px;">加载中...</p>';
		
		const chats = await fetchChatList();
		
		chatList.innerHTML = '';
		
		if (chats.length === 0) {
			chatList.innerHTML = '<p style="color: #909399; font-size: 14px; text-align: center; padding: 20px;">暂无群聊</p>';
			return;
		}
		
		chats.forEach(chat => {
			const chatItem = document.createElement('div');
			chatItem.className = 'chat-item';
			chatItem.innerHTML = `
				<div class="chat-item-header">
					<span class="chat-item-name">${chat.name}</span>
					<span class="chat-item-info">${chat.members} 成员 · ${new Date(chat.lastActive).toLocaleString()}</span>
				</div>
				<div style="margin-top: 10px;">
					<button class="chat-action-btn view-btn" data-chat-id="${chat.id}" data-chat-name="${chat.name}">查看记录</button>
					<button class="chat-action-btn announce-btn" data-chat-id="${chat.id}" data-chat-name="${chat.name}">发送公告</button>
					<button class="chat-action-btn delete-btn" data-chat-id="${chat.id}" data-chat-name="${chat.name}">删除群聊</button>
				</div>
			`;
			
			// 查看记录按钮点击事件
			const viewBtn = chatItem.querySelector('.view-btn');
			viewBtn.addEventListener('click', () => {
				openChatView(chat);
			});
			
			// 发送公告按钮点击事件
			const announceBtn = chatItem.querySelector('.announce-btn');
			announceBtn.addEventListener('click', () => {
				openAnnounceModal(chat);
			});
			
			// 删除群聊按钮点击事件
			const deleteBtn = chatItem.querySelector('.delete-btn');
			deleteBtn.addEventListener('click', async () => {
				if (confirm(`确定要删除群聊 "${chat.name}" 吗？此操作将断开所有成员连接。`)) {
					const success = await deleteChat(chat.id);
					if (success) {
						alert('群聊删除成功');
						renderChatList(); // 重新渲染群聊列表
					} else {
						alert('群聊删除失败，请重试');
					}
				}
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
		
		// 初始化消息选择功能
		initMessageSelection();
	}
	
	// 返回群聊列表
	backToChatList.addEventListener('click', () => {
		chatView.style.display = 'none';
		chatList.style.display = '';
	});
	
	// 渲染聊天记录
	function renderChatMessages(chatId) {
		chatMessages.innerHTML = '';
		
		// 目前群聊记录存储在客户端，实际应用中应该从服务器获取
		// 这里暂时显示模拟数据
		const mockMessages = [
			{ id: '1', user: '用户1', content: '大家好！', timestamp: '10:00' },
			{ id: '2', user: '用户2', content: '你好！', timestamp: '10:01' },
			{ id: '3', user: '用户3', content: '欢迎加入！', timestamp: '10:02' }
		];
		
		mockMessages.forEach(msg => {
			const messageDiv = document.createElement('div');
			messageDiv.className = 'user-chat-message';
			messageDiv.dataset.messageId = msg.id;
			messageDiv.innerHTML = `
				<div class="message-selection"><input type="checkbox" class="message-checkbox" data-message-id="${msg.id}"></div>
				<div style="font-weight: bold; margin-bottom: 5px;">${msg.user}</div>
				<div>${msg.content}</div>
				<div style="font-size: 12px; color: #909399; text-align: right; margin-top: 5px;">${msg.timestamp}</div>
			`;
			
			// 添加样式，让消息选择框和内容并排显示
			const messageSelection = messageDiv.querySelector('.message-selection');
			messageSelection.style.float = 'left';
			messageSelection.style.marginRight = '10px';
			messageSelection.style.marginTop = '10px';
			
			chatMessages.appendChild(messageDiv);
		});
	}
	
	// 初始化消息选择功能
	function initMessageSelection() {
		const selectAllCheckbox = document.getElementById('select-all-messages');
		const deleteSelectedBtn = document.getElementById('delete-selected-messages');
		const deleteAllBtn = document.getElementById('delete-all-messages');
		const messageCheckboxes = document.querySelectorAll('.message-checkbox');
		
		// 全选功能
		selectAllCheckbox.addEventListener('change', () => {
			messageCheckboxes.forEach(checkbox => {
				checkbox.checked = selectAllCheckbox.checked;
			});
		});
		
		// 删除选中记录
		deleteSelectedBtn.addEventListener('click', () => {
			const selectedCheckboxes = document.querySelectorAll('.message-checkbox:checked');
			if (selectedCheckboxes.length === 0) {
				alert('请先选择要删除的记录');
				return;
			}
			
			if (confirm(`确定要删除选中的 ${selectedCheckboxes.length} 条记录吗？`)) {
				selectedCheckboxes.forEach(checkbox => {
					const messageDiv = checkbox.closest('.user-chat-message');
					if (messageDiv) {
						messageDiv.remove();
					}
				});
				selectAllCheckbox.checked = false;
			}
		});
		
		// 清空所有记录
		deleteAllBtn.addEventListener('click', () => {
			if (confirm('确定要清空所有记录吗？此操作不可恢复')) {
				chatMessages.innerHTML = '';
				selectAllCheckbox.checked = false;
			}
		});
	}
	
	// 发送管理员消息
	sendAdminMessageBtn.addEventListener('click', () => {
		const message = adminMessageInput.value.trim();
		if (!message) return;
		
		const messageDiv = document.createElement('div');
		messageDiv.className = 'admin-chat-message';
		messageDiv.innerHTML = `
			<div class="message-selection"><input type="checkbox" class="message-checkbox"></div>
			<div style="font-weight: bold; margin-bottom: 5px;">管理员</div>
			<div>${message}</div>
			<div style="font-size: 12px; color: #909399; text-align: right; margin-top: 5px;">${new Date().toLocaleTimeString()}</div>
		`;
		
		// 添加样式
		const messageSelection = messageDiv.querySelector('.message-selection');
		messageSelection.style.float = 'left';
		messageSelection.style.marginRight = '10px';
		messageSelection.style.marginTop = '10px';
		
		chatMessages.appendChild(messageDiv);
		chatMessages.scrollTop = chatMessages.scrollHeight;
		
		adminMessageInput.value = '';
		
		// 重新初始化消息选择功能
		initMessageSelection();
	});
	
	// 回车键发送消息
	adminMessageInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			sendAdminMessageBtn.click();
		}
	});
	
	// 添加删除群聊按钮样式
	const style = document.createElement('style');
	style.textContent = `
		.chat-action-btn.delete-btn {
			color: #ff4d4f;
			border-color: #ff4d4f;
		}
		.chat-action-btn.delete-btn:hover {
			background-color: #fff1f0;
		}
	`;
	document.head.appendChild(style);
	
	// 初始渲染群聊列表
	renderChatList();
}

// 打开公告模态框
function openAnnounceModal(chat = null) {
	// 移除已存在的模态框
	const existingModal = document.getElementById('announce-modal');
	if (existingModal) {
		existingModal.remove();
	}
	
	// 创建公告模态框
	const modal = document.createElement('div');
	modal.id = 'announce-modal';
	modal.className = 'announce-modal';
	modal.innerHTML = `
		<div class="announce-modal-bg"></div>
		<div class="announce-modal-content">
			<div class="announce-modal-header">
				<h3>${chat ? `${chat.name} 公告` : '发送公告'}</h3>
				<button class="announce-modal-close">&times;</button>
			</div>
			<div class="announce-modal-body">
				<div class="announce-target">
					<h4>公告范围</h4>
					<div class="announce-target-options">
						<label><input type="radio" name="announce-target" value="all" ${!chat ? 'checked' : ''}> 所有群聊</label>
						<label><input type="radio" name="announce-target" value="selected" ${chat ? 'checked' : ''}> 特定群聊</label>
						<div id="selected-chats" style="margin-top: 10px; display: ${chat ? 'block' : 'none'};">
							${chat ? `<div class="selected-chat-item">${chat.name}</div>` : ''}
						</div>
					</div>
				</div>
				<div class="announce-content">
					<h4>公告内容</h4>
					<textarea id="announce-content" rows="5" placeholder="输入公告内容" maxlength="500"></textarea>
					<p style="font-size: 12px; color: #909399; margin-top: 5px;">最多500字</p>
				</div>
			</div>
			<div class="announce-modal-footer">
				<button id="cancel-announce" class="cancel-btn">取消</button>
				<button id="send-announce" class="send-btn">发送</button>
			</div>
		</div>
	</div>
	`;
	
	// 添加模态框样式
	const style = document.createElement('style');
	style.textContent = `
		.announce-modal {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 1000;
		}
		.announce-modal-bg {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0, 0, 0, 0.5);
		}
		.announce-modal-content {
			position: relative;
			background-color: white;
			border-radius: 8px;
			width: 80%;
			max-width: 600px;
			max-height: 80%;
			overflow: hidden;
		}
		.announce-modal-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 20px;
			border-bottom: 1px solid #e0e0e0;
		}
		.announce-modal-header h3 {
			margin: 0;
		}
		.announce-modal-close {
			background: none;
			border: none;
			font-size: 24px;
			cursor: pointer;
			color: #909399;
		}
		.announce-modal-body {
			padding: 20px;
		}
		.announce-target-options label {
			display: block;
			margin-bottom: 10px;
			cursor: pointer;
		}
		#announce-content {
			width: 100%;
			padding: 10px;
			border: 1px solid #dcdfe6;
			border-radius: 4px;
			font-size: 14px;
			resize: vertical;
		}
		.announce-modal-footer {
			display: flex;
			justify-content: flex-end;
			padding: 20px;
			border-top: 1px solid #e0e0e0;
			gap: 10px;
		}
		.cancel-btn {
			padding: 10px 20px;
			border: 1px solid #dcdfe6;
			border-radius: 4px;
			background-color: white;
			cursor: pointer;
		}
		.send-btn {
			padding: 10px 20px;
			border: none;
			border-radius: 4px;
			background-color: #409EFF;
			color: white;
			cursor: pointer;
		}
		.selected-chat-item {
			background-color: #f5f7fa;
			border: 1px solid #e4e7ed;
			border-radius: 4px;
			padding: 8px 12px;
			margin-bottom: 5px;
			display: inline-block;
			margin-right: 10px;
		}
		.chat-action-btn {
			padding: 5px 10px;
			border: 1px solid #dcdfe6;
			border-radius: 4px;
			background-color: white;
			cursor: pointer;
			margin-right: 5px;
		}
		.view-btn {
			color: #409EFF;
			border-color: #409EFF;
		}
		.announce-btn {
			color: #67C23A;
			border-color: #67C23A;
		}
		.chat-management-section {
			padding: 15px;
			background-color: #f5f7fa;
			border-bottom: 1px solid #e4e7ed;
			margin-bottom: 20px;
		}
		.chat-management-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 15px;
		}
		.chat-management-header h3 {
			margin: 0;
			font-size: 16px;
		}
		.chat-management-actions {
			display: flex;
			align-items: center;
		}
		.chat-management-actions label {
			cursor: pointer;
		}
	`;
	document.head.appendChild(style);
	document.body.appendChild(modal);
	
	// 关闭模态框
	const closeBtn = modal.querySelector('.announce-modal-close');
	const cancelBtn = modal.querySelector('#cancel-announce');
	const modalBg = modal.querySelector('.announce-modal-bg');
	
	function closeModal() {
		modal.remove();
		style.remove();
	}
	
	closeBtn.addEventListener('click', closeModal);
	cancelBtn.addEventListener('click', closeModal);
	modalBg.addEventListener('click', closeModal);
	
	// 公告范围选择
	const announceTargetRadios = modal.querySelectorAll('input[name="announce-target"]');
	const selectedChatsDiv = modal.querySelector('#selected-chats');
	
	announceTargetRadios.forEach(radio => {
		radio.addEventListener('change', () => {
			selectedChatsDiv.style.display = radio.value === 'selected' ? 'block' : 'none';
		});
	});
	
	// 发送公告
	const sendAnnounceBtn = modal.querySelector('#send-announce');
	sendAnnounceBtn.addEventListener('click', () => {
		const content = modal.querySelector('#announce-content').value.trim();
		if (!content) {
			alert('请输入公告内容');
			return;
		}
		
		// 发送公告（模拟）
		alert('公告发送成功！');
		closeModal();
		
		// 实际发送公告的逻辑可以在这里添加
		// 例如：向特定群聊或所有群聊发送公告
	});
}

// 初始化违禁词管理
function initWordFilter() {
	// 从localStorage获取违禁词列表
	let forbiddenWords = JSON.parse(localStorage.getItem('forbiddenWords') || '[]');
	
	// 获取DOM元素
	const addWordBtn = document.getElementById('add-word-btn');
	const newWordInput = document.getElementById('new-word');
	const wordList = document.getElementById('word-list');
	const saveSettingsBtn = document.getElementById('save-settings-btn');
	const statusMessage = document.getElementById('status-message');
	
	// 渲染违禁词列表
	renderWordList(forbiddenWords);
	
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
