// 认证状态管理模块

// 全局认证状态对象
window.cloudMailAuth = window.cloudMailAuth || {
	isAuthenticated: false,
	userInfo: null,
	
	// 初始化时从localStorage读取登录状态
	init() {
		// 首先尝试从localStorage获取登录状态
		const authData = localStorage.getItem('cloudMailAuth');
		if (authData) {
			try {
				const parsedData = JSON.parse(authData);
				this.isAuthenticated = parsedData.isAuthenticated;
				this.userInfo = parsedData.userInfo;
			} catch (error) {
				console.error('Failed to parse auth data:', error);
				// 解析失败，清除错误数据
				localStorage.removeItem('cloudMailAuth');
			}
		}
	},
	
	// 设置认证状态
	setAuthenticated(status, userInfo = null) {
		this.isAuthenticated = status;
		this.userInfo = userInfo;
		
		// 确保userInfo包含email字段，用于管理员权限检查
		if (status && !this.userInfo) {
			this.userInfo = {
				email: ''
			};
		}
		
		// 将登录状态保存到localStorage，支持跨节点共享
		if (status) {
			localStorage.setItem('cloudMailAuth', JSON.stringify({
				isAuthenticated: status,
				userInfo: this.userInfo
			}));
			
			// 同时保存到cookie，支持跨路径共享
			const cookieData = JSON.stringify({
				isAuthenticated: status,
				userInfo: this.userInfo
			});
			// 使用安全的cookie设置
			document.cookie = `cloudMailAuth=${btoa(cookieData)}; path=/; max-age=86400; SameSite=Lax`;
		} else {
			// 登出时清除登录状态
			localStorage.removeItem('cloudMailAuth');
			document.cookie = 'cloudMailAuth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		}
	},
	
	// 检查认证状态
	checkAuth() {
		if (!this.isAuthenticated) {
			// 如果未认证，尝试从cookie恢复登录状态
			this.restoreFromCookie();
			
			if (!this.isAuthenticated) {
				// 如果仍未认证，重定向到登录界面
				this.setAuthenticated(false);
				return false;
			}
		}
		return true;
	},
	
	// 从cookie恢复登录状态
	restoreFromCookie() {
		try {
			const cookie = document.cookie.split(';').find(cookie => cookie.trim().startsWith('cloudMailAuth='));
			if (cookie) {
				const cookieValue = cookie.split('=')[1];
				const authData = JSON.parse(atob(cookieValue));
				this.isAuthenticated = authData.isAuthenticated;
				this.userInfo = authData.userInfo;
				
				// 同步到localStorage
				localStorage.setItem('cloudMailAuth', JSON.stringify(authData));
			}
		} catch (error) {
			console.error('Failed to restore auth from cookie:', error);
		}
	}
};

// 初始化登录状态
window.cloudMailAuth.init();

// 检查URL参数中是否包含节点信息
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('r');
const pwdParam = urlParams.get('p');

// 如果有节点信息，自动填充表单但不自动提交
if (roomParam || pwdParam) {
	// 确保DOM加载完成后执行
	document.addEventListener('DOMContentLoaded', () => {
		// 只在登录页面执行
		if (document.body.classList.contains('login-page')) {
			// 恢复登录状态
			window.cloudMailAuth.restoreFromCookie();
		}
	});
}

// 检查是否为管理员账号
export function isAdmin() {
	return window.cloudMailAuth.isAuthenticated && 
		   window.cloudMailAuth.userInfo && 
		   window.cloudMailAuth.userInfo.email === 'admin@admin.admin';
}

// 导出认证对象
export { window as cloudMailAuth };