/**
 * request.js - 网络请求封装
 * 统一处理 baseURL、错误提示、loading 状态
 */
const { BASE_URL } = require('./config')

/**
 * 封装 wx.request，返回 Promise
 * @param {string} url - 接口路径（相对路径）
 * @param {string} method - 请求方法，默认 GET
 * @param {object} data - 请求参数
 * @returns {Promise}
 */
const request = (url, method = 'GET', data = {}) => {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '加载中...', mask: true })

    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      timeout: 10000, // 10秒超时
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          const message = res.data?.detail || res.data?.message || `请求失败 (${res.statusCode})`
          wx.showToast({ title: message, icon: 'none' })
          reject(new Error(message))
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({ title: '网络连接失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

module.exports = { request }
