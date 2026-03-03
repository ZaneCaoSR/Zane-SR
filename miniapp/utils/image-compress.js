// 图片压缩工具
const CompressImage = {
  /**
   * 压缩图片
   * @param {string} filePath - 图片路径
   * @param {number} quality - 压缩质量 0-100
   * @param {number} maxWidth - 最大宽度
   */
  compress(filePath, quality = 80, maxWidth = 1280) {
    return new Promise((resolve, reject) => {
      // 先使用 wx.compressImage
      wx.compressImage({
        src: filePath,
        quality: quality < 80 ? 'low' : (quality < 95 ? 'medium' : 'high'),
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          // 压缩失败返回原图
          console.warn('图片压缩失败，使用原图', err);
          resolve(filePath);
        }
      });
    });
  },

  /**
   * 使用 Canvas 压缩图片
   * @param {string} filePath - 图片路径
   * @param {object} options - 压缩选项
   */
  compressWithCanvas(filePath, options = {}) {
    const { quality = 0.8, maxWidth = 1280, maxHeight = 1280 } = options;
    
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: (imageInfo) => {
          let width = imageInfo.width;
          let height = imageInfo.height;
          
          // 计算缩放比例
          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
          }
          
          // 创建 Canvas
          const ctx = wx.createCanvasContext('image-compress');
          ctx.drawImage(filePath, 0, 0, width, height);
          
          ctx.draw(false, () => {
            wx.canvasToTempFilePath({
              canvasId: 'image-compress',
              width,
              height,
              destWidth: width,
              destHeight: height,
              fileType: 'jpg',
              quality,
              success: (res) => {
                resolve(res.tempFilePath);
              },
              fail: reject
            });
          });
        },
        fail: reject
      });
    });
  }
};

module.exports = CompressImage;
