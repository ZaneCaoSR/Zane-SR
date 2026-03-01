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
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          wx.showToast({ title: '请求失败', icon: 'error' })
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'error' })
        reject(err)
      },
    })
  })
}

module.exports = { request }
