/**
 * app.js - 小程序入口
 * 负责全局登录，获取用户 openid（通过后端 code2session 或直接云调用）
 */
App({
  globalData: {
    openid: null,    // 用户 openid，登录后存储
    userCity: '杭州', // 用户订阅的城市
  },

  onLaunch() {
    // 小程序启动时获取登录凭证
    this.login()
  },

  /**
   * 微信登录，获取 code，换取 openid
   * 注意：openid 应由后端通过 code2session 换取，前端不直接获取
   * 此处简化：直接调用后端换取接口（需后端实现 /api/login 接口）
   */
  login() {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用后端接口，用 code 换 openid
          wx.request({
            url: require('./utils/config').BASE_URL + '/api/login',
            method: 'POST',
            data: { code: res.code },
            success: (loginRes) => {
              if (loginRes.data && loginRes.data.openid) {
                this.globalData.openid = loginRes.data.openid
                console.log('[App] 登录成功，openid:', this.globalData.openid)
              }
            },
            fail: (err) => {
              console.error('[App] 登录失败:', err)
            }
          })
        }
      }
    })
  }
})
