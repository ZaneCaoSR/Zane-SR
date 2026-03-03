// 云函数封装

const CloudApi = {
  // 云函数基础路径
  functionName: {
    AI_ANALYZE: 'ai-analyze',
    GET_MONTH_PHOTOS: 'get-month-photos',
    UPDATE_PHOTO: 'update-photo',
    DELETE_PHOTO: 'delete-photo',
    GET_BABY_INFO: 'get-baby-info',
    SAVE_BABY_INFO: 'save-baby-info'
  },

  /**
   * 调用云函数
   * @param {string} name - 云函数名
   * @param {object} data - 参数
   */
  call(name, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: (res) => {
          if (res.result && res.result.errCode) {
            reject(res.result);
          } else {
            resolve(res.result);
          }
        },
        fail: reject
      });
    });
  },

  /**
   * AI 分析照片
   * @param {string} fileID - 云存储文件ID
   */
  analyzePhoto(fileID) {
    return this.call(this.functionName.AI_ANALYZE, { fileID });
  },

  /**
   * 获取月份照片
   * @param {number} year - 年份
   * @param {number} month - 月份
   */
  getMonthPhotos(year, month) {
    return this.call(this.functionName.GET_MONTH_PHOTOS, { year, month });
  },

  /**
   * 更新照片
   * @param {string} id - 照片ID
   * @param {object} data - 更新数据
   */
  updatePhoto(id, data) {
    return this.call(this.functionName.UPDATE_PHOTO, { id, data });
  },

  /**
   * 删除照片
   * @param {string} id - 照片ID
   */
  deletePhoto(id) {
    return this.call(this.functionName.DELETE_PHOTO, { id });
  },

  /**
   * 获取宝宝信息
   */
  getBabyInfo() {
    return this.call(this.functionName.GET_BABY_INFO);
  },

  /**
   * 保存宝宝信息
   * @param {object} data - 宝宝信息
   */
  saveBabyInfo(data) {
    return this.call(this.functionName.SAVE_BABY_INFO, data);
  },

  /**
   * 上传文件到云存储
   * @param {string} filePath - 本地文件路径
   * @param {string} cloudPath - 云端路径
   */
  uploadFile(filePath, cloudPath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 删除云存储文件
   * @param {string|array} fileList - 文件ID或ID列表
   */
  deleteFile(fileList) {
    const list = Array.isArray(fileList) ? fileList : [fileList];
    return new Promise((resolve, reject) => {
      wx.cloud.deleteFile({
        fileList: list,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 获取云存储临时链接
   * @param {string|array} fileList - 文件ID或ID列表
   */
  getTempFileURL(fileList) {
    const list = Array.isArray(fileList) ? fileList : [fileList];
    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: list,
        success: resolve,
        fail: reject
      });
    });
  }
};

module.exports = CloudApi;
