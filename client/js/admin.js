// 管理员后台逻辑

// 确保全局状态管理对象存在
if (!window.cloudMailAuth) {
	window.cloudMailAuth = {
		isAuthenticated: false,
		userInfo: null,
		
		// 设置认证状态
		setAuthenticated(status, userInfo = null) {
			this.isAuthenticated = status;
			this.userInfo = userInfo;
		},
		
		// 检查认证状态
		checkAuth() {
			if (!this.isAuthenticated) {
				return false;
			}
			return true;
		}
	};
}

// 检查管理员权限
function isAdmin() {
	return window.cloudMailAuth.isAuthenticated && 
		   window.cloudMailAuth.userInfo && 
		   window.cloudMailAuth.userInfo.email === 'admin@admin.admin';
}

// 检查认证状态并显示相应界面
export function checkAuth() {
	const loginPrompt = document.getElementById('login-prompt');
	const adminDashboard = document.getElementById('admin-dashboard');
	
	// 确保window.cloudMailAuth对象有init方法，如果没有则初始化
	if (window.cloudMailAuth && typeof window.cloudMailAuth.init === 'function') {
		window.cloudMailAuth.init();
	} else {
		// 如果没有init方法，则手动从localStorage获取登录状态
		const authData = localStorage.getItem('cloudMailAuth');
		if (authData) {
			try {
				const parsedData = JSON.parse(authData);
				window.cloudMailAuth.setAuthenticated(true, parsedData.userInfo);
			} catch (error) {
				console.error('Failed to parse auth data:', error);
			}
		}
	}
	
	if (isAdmin()) {
		// 显示管理员后台
		loginPrompt.style.display = 'none';
		adminDashboard.style.display = '';
		
		// 初始化违禁词管理
		initWordFilter();
	} else {
		// 显示登录提示
		loginPrompt.style.display = '';
		adminDashboard.style.display = 'none';
	}
}

// 初始化违禁词管理功能
function initWordFilter() {
	// 从localStorage获取违禁词列表
	let forbiddenWords = JSON.parse(localStorage.getItem('forbiddenWords') || '[]');
	
	// 渲染违禁词列表
	renderWordList(forbiddenWords);
	
	// 添加违禁词按钮点击事件
	const addWordBtn = document.getElementById('add-word-btn');
	const newWordInput = document.getElementById('new-word');
	const wordList = document.getElementById('word-list');
	const saveSettingsBtn = document.getElementById('save-settings-btn');
	const backToChatBtn = document.getElementById('back-to-chat-btn');
	const statusMessage = document.getElementById('status-message');
	
	// 添加违禁词
	addWordBtn.addEventListener('click', () => {
		const newWord = newWordInput.value.trim();
		if (!newWord) {
			showStatus('请输入要添加的违禁词', 'error');
			return;
		}
		
		if (forbiddenWords.includes(newWord)) {
			showStatus('该违禁词已存在', 'error');
			return;
		}
		
		forbiddenWords.push(newWord);
		newWordInput.value = '';
		renderWordList(forbiddenWords);
		showStatus('违禁词添加成功', 'success');
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
	
	// 返回聊天页面
	backToChatBtn.addEventListener('click', () => {
		window.location.href = 'index.html';
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
	
	// 替换所有违禁词为***
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
