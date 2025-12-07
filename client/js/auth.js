// 认证状态管理模块

// 全局认证状态对象
window.cloudMailAuth = window.cloudMailAuth || {
	isAuthenticated: false,
	userInfo: null,
	
	// 初始化时从localStorage读取登录状态
	init() {
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
		
		// 将登录状态保存到localStorage
		if (status) {
			localStorage.setItem('cloudMailAuth', JSON.stringify({
				isAuthenticated: status,
				userInfo: this.userInfo
			}));
		} else {
			// 登出时清除localStorage中的登录状态
			localStorage.removeItem('cloudMailAuth');
		}
	},
	
	// 检查认证状态
	checkAuth() {
		if (!this.isAuthenticated) {
			// 如果未认证，重定向到登录界面
			this.setAuthenticated(false);
			return false;
		}
		return true;
	}
};

// 初始化登录状态
window.cloudMailAuth.init();

// 检查是否为管理员账号
export function isAdmin() {
	return window.cloudMailAuth.isAuthenticated && 
		   window.cloudMailAuth.userInfo && 
		   window.cloudMailAuth.userInfo.email === 'admin@admin.admin';
}

// 导出认证对象
export { window as cloudMailAuth };